// ---------------------------------------------------------------------------
// AI Order Execution & Position Management Engine
// Order placement, active positions map, auto-exit monitor, retries, and DB persistence
// ---------------------------------------------------------------------------

import prisma from "../../config/prisma.js";
import { placeSmartApiOrder, getSmartApiOrderBook } from "../smartapi/api/order.js";
import { getCachedQuote } from "../smartapi/api/FullMode.js";
import { broadcastSocketEvent } from "../websocket/socketService.js";
import { getInstrumentLotSize } from "../smartapi/instrument.service.js";
import {
  calculateIndianMarketCosts,
  getSlippageAdjustedPrice,
} from "./costModel.service.js";
import type {
  ActiveAiPosition,
  AutoPilotStrategy,
  TradeSignal,
} from "../../types/aiTrading.types.js";
import type { OrderPlacementRequest, OrderBookItem } from "../smartapi/types.js";

// Map of open and recent active positions managed by AI Execution
export const activeAiPositions: Map<string, ActiveAiPosition> = new Map();

// Pluggable signal resolver to avoid circular dependency with signals.service
var signalResolver: ((id: string) => Promise<TradeSignal | undefined> | TradeSignal | undefined) | null = null;
var quoteResolver: ((token: string, symbol: string) => { ltp?: number } | undefined) | null = null;

export function setSignalResolver(fn: (id: string) => Promise<TradeSignal | undefined> | TradeSignal | undefined): void {
  signalResolver = fn;
}

export function setQuoteResolver(fn: (token: string, symbol: string) => { ltp?: number } | undefined): void {
  quoteResolver = fn;
}

/**
 * Server Restart Recovery & Position Persistence:
 * Reloads all OPEN trades from PostgreSQL TradeOrderMaster into activeAiPositions map,
 * ensuring stop-loss, profit-target, and theta-timeout monitoring resumes seamlessly.
 */
export async function loadPersistedOpenPositions(): Promise<number> {
  try {
    const openLogs = await prisma.tradeOrderMaster.findMany({
      where: { status: "OPEN" },
      orderBy: { enteredAt: "asc" },
    });

    let loadedCount = 0;
    for (const log of openLogs) {
      const posId = `pos_${log.masterOrderId}`;
      const isFno = log.exchange === "NFO" || log.segment === "FNO";
      const targetPct = 35;
      const slPct = 18;
      const dynamicRisk = Math.max(500, Math.round(log.entryPrice * log.quantity * 0.15));

      const position: ActiveAiPosition = {
        id: posId,
        orderId: log.masterOrderId,
        symbol: log.symbol,
        token: log.token || "",
        exchange: log.exchange,
        strategy: (log.strategy as AutoPilotStrategy) || (isFno ? "GREEK_SNIPER" : "STANDARD"),
        entryPrice: log.entryPrice,
        currentPrice: log.exitPrice || log.entryPrice,
        highestPrice: log.entryPrice,
        quantity: log.quantity,
        lots: log.lots,
        action: (log.action === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        targetPrice: log.targetPrice || Number((log.entryPrice * (1 + targetPct / 100)).toFixed(2)),
        stopLossPrice: log.stopLossPrice || Number((log.entryPrice * (1 - slPct / 100)).toFixed(2)),
        enteredAt: new Date(log.enteredAt).getTime(),
        slabAmount: log.slabAmount || 0,
        holdingMinutes: log.holdingMinutes || 0,
        timeoutMinutes: 45,
        mode: (log.mode as "PAPER" | "LIVE") || "PAPER",
        status: "OPEN",
        pnl: log.pnl || 0,
        pnlPercent: log.pnlPercent || 0,
        charges: log.charges || 0,
        netPnl: log.netPnl || 0,
        greeks:
          log.delta != null
            ? {
                delta: log.delta,
                gamma: log.gamma || 0,
                theta: log.theta || 0,
                vega: 0,
                iv: log.iv || 0,
                thetaPremiumRatio: 0,
                isGreekEligible: true,
              }
            : undefined,
        exitRetryCount: 0,
        isBreakevenLocked: false,
        trailingStep: 0,
        maxRiskRupees: dynamicRisk,
      };

      activeAiPositions.set(posId, position);
      loadedCount++;
    }

    if (loadedCount > 0) {
      console.log(`[AI Position Persistence] Reloaded ${loadedCount} OPEN positions from PostgreSQL TradeOrderMaster for active auto-exit monitoring.`);
      broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));
    }
    return loadedCount;
  } catch (err: any) {
    console.error("[AI Position Persistence] Error loading active positions from database:", err?.message || err);
    return 0;
  }
}

/**
 * Register a position into active positions map
 */
export function registerActiveAiPosition(position: ActiveAiPosition): void {
  activeAiPositions.set(position.id, position);
  broadcastSocketEvent("ai_position_opened", position);
  broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));
}

/**
 * 1-Click Execution for a specific trade signal (supports both Equity shares and F&O Lots)
 */
export async function executeSignalOrder(
  signalId: string,
  options: {
    quantity?: number | undefined;
    lots?: number | undefined;
    productType?: "INTRADAY" | "DELIVERY" | "CARRYFORWARD" | undefined;
    orderType?: "MARKET" | "LIMIT" | undefined;
    limitPrice?: number | undefined;
    mode?: "PAPER" | "LIVE" | undefined;
    confirmed?: boolean | undefined;
    strategy?: AutoPilotStrategy | undefined;
    profitTargetPct?: number | undefined;
    stopLossPct?: number | undefined;
    thetaTimeoutMinutes?: number | undefined;
    signal?: TradeSignal | undefined;
  } = {}
) {
  try {
    let signal = options.signal;
    if (!signal && signalResolver) {
      signal = await signalResolver(signalId);
    }

    if (!signal) {
      throw new Error(`Signal ${signalId} not found or expired.`);
    }

    const isFno = signal.exchange === "NFO" || signal.segment === "FNO";
    const lotSize = signal.lotSize || (await getInstrumentLotSize(signal.symbol, 1));

    let finalQty = 1;
    if (isFno) {
      const numLots = options.lots || 1;
      finalQty = options.quantity || numLots * lotSize;
    } else {
      finalQty = options.quantity || 1;
    }

    const defaultPType = isFno ? "CARRYFORWARD" : "INTRADAY";
    const pType = options.productType || defaultPType;

    const isPaper = options.mode ? options.mode === "PAPER" : true;
    if (!isPaper && !options.confirmed) {
      throw new Error("LIVE trading requires explicit confirmation before executing real orders with Angel One.");
    }

    if (signal.action === "HOLD") {
      throw new Error(`Cannot execute trade: Signal action for ${signal.symbol} is HOLD.`);
    }

    if (!signal.currentPrice || signal.currentPrice <= 0) {
      throw new Error(`Cannot execute trade: Signal for ${signal.symbol} has invalid price (₹${signal.currentPrice}).`);
    }

    const oType = options.orderType || "MARKET";
    const price = oType === "LIMIT" ? options.limitPrice || signal.currentPrice : 0;

    const orderReq: OrderPlacementRequest = {
      variety: "NORMAL",
      tradingsymbol: signal.symbol,
      symboltoken: signal.token,
      transactiontype: signal.action,
      exchange: signal.exchange || (isFno ? "NFO" : "NSE"),
      ordertype: oType,
      producttype: pType,
      duration: "DAY",
      price,
      quantity: finalQty,
    };

    const res = await placeSmartApiOrder(orderReq, isPaper);
    signal.status = "EXECUTED";

    // Register active AI position for auto-exit monitoring (Target, StopLoss, Theta Timeout)
    const posId = `pos_${res.orderid || Date.now()}`;
    const targetPct = options.profitTargetPct || 50;
    const slPct = options.stopLossPct || 22;

    // Apply realistic simulated slippage on paper trade fills (0.15% adverse slippage)
    const actionToUse = signal.action;
    const fillPrice = isPaper ? getSlippageAdjustedPrice(signal.currentPrice, actionToUse) : signal.currentPrice;

    const targetPrice = signal.target1 > 0 ? signal.target1 : Number((fillPrice * (1 + targetPct / 100)).toFixed(2));
    const stopLossPrice = signal.stopLoss > 0 ? signal.stopLoss : Number((fillPrice * (1 - slPct / 100)).toFixed(2));

    const position: ActiveAiPosition = {
      id: posId,
      orderId: res.orderid,
      symbol: signal.symbol,
      token: signal.token,
      exchange: signal.exchange || (isFno ? "NFO" : "NSE"),
      strategy: options.strategy || (isFno ? "GREEK_SNIPER" : "STANDARD"),
      entryPrice: fillPrice,
      currentPrice: fillPrice,
      highestPrice: fillPrice,
      quantity: finalQty,
      lots: isFno ? Math.max(1, Math.round(finalQty / lotSize)) : 1,
      action: actionToUse,
      targetPrice,
      stopLossPrice,
      enteredAt: Date.now(),
      holdingMinutes: 0,
      timeoutMinutes: options.thetaTimeoutMinutes || 25,
      mode: isPaper ? "PAPER" : "LIVE",
      status: "OPEN",
      pnl: 0,
      pnlPercent: 0,
      greeks: signal.greeks,
      exitRetryCount: 0,
      isBreakevenLocked: false,
      trailingStep: 0,
      maxRiskRupees: (isFno ? Math.max(1, Math.round(finalQty / lotSize)) : 1) * 180,
    };

    activeAiPositions.set(posId, position);
    logTradeEntryToDb(position, signal).catch(console.error);
    broadcastSocketEvent("ai_position_opened", position);
    broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));

    broadcastSocketEvent("ai_signal_executed", {
      signalId,
      symbol: signal.symbol,
      order: res,
      position,
      mode: isPaper ? "PAPER" : "LIVE",
    });

    return {
      success: true,
      message: `${signal.action} order placed for ${signal.symbol}`,
      orderId: res.orderid,
      mode: isPaper ? "PAPER" : "LIVE",
      quantity: finalQty,
      signal,
      position,
    };
  } catch (err: any) {
    console.error(`[Order Execution] Error executing signal ${signalId}:`, err?.message || err);
    logAiErrorToDb({
      source: "ORDER_EXECUTION",
      action: "EXECUTE_SIGNAL",
      message: err?.message || "Signal execution order failed",
      stack: err?.stack,
      details: { signalId, options },
    }).catch(console.error);
    throw err;
  }
}

/**
 * Manual custom trade placement (Direct AI Order Execution)
 */
export async function placeManualTrade(params: {
  tradingsymbol: string;
  symboltoken: string;
  exchange?: string;
  transactiontype: "BUY" | "SELL";
  ordertype?: "MARKET" | "LIMIT";
  producttype?: "INTRADAY" | "DELIVERY";
  quantity: number;
  price?: number;
  mode?: "PAPER" | "LIVE";
}) {
  try {
    const isPaper = params.mode === "PAPER";

    const orderReq: OrderPlacementRequest = {
      variety: "NORMAL",
      tradingsymbol: params.tradingsymbol,
      symboltoken: params.symboltoken,
      transactiontype: params.transactiontype,
      exchange: params.exchange || "NSE",
      ordertype: params.ordertype || "MARKET",
      producttype: params.producttype || "INTRADAY",
      duration: "DAY",
      price: params.price || 0,
      quantity: params.quantity || 1,
    };

    const res = await placeSmartApiOrder(orderReq, isPaper);

    return {
      success: true,
      message: `${params.transactiontype} order placed for ${params.tradingsymbol}`,
      orderId: res.orderid,
      mode: isPaper ? "PAPER" : "LIVE",
      order: res,
    };
  } catch (err: any) {
    console.error(`[Manual Trade] Error placing trade for ${params.tradingsymbol}:`, err?.message || err);
    logAiErrorToDb({
      source: "MANUAL_ORDER",
      action: params.transactiontype,
      symbol: params.tradingsymbol,
      token: params.symboltoken,
      message: err?.message || "Manual trade placement failed",
      stack: err?.stack,
      details: params,
    }).catch(console.error);
    throw err;
  }
}

/**
 * Fetch Order History (both live broker and paper trades)
 */
export async function getOrderHistory(): Promise<OrderBookItem[]> {
  return await getSmartApiOrderBook();
}

/**
 * Database Persistence: Record order entry in PostgreSQL AiTradeLog table
 */
export async function logTradeEntryToDb(
  position: ActiveAiPosition,
  signal?: TradeSignal | null
): Promise<void> {
  try {
    const isFno = position.exchange === "NFO";
    const underlying = position.symbol.startsWith("BANKNIFTY")
      ? "BANKNIFTY"
      : position.symbol.startsWith("NIFTY")
      ? "NIFTY"
      : position.symbol.startsWith("FINNIFTY")
      ? "FINNIFTY"
      : signal?.underlying || null;

    // 1. Primary Institutional Master-Detail Logging: TradeOrderMaster
    const master = await prisma.tradeOrderMaster.create({
      data: {
        masterOrderId: position.orderId,
        symbol: position.symbol,
        underlying,
        token: position.token,
        exchange: position.exchange,
        strategy: position.strategy || "GREEK_SNIPER",
        action: position.action,
        segment: isFno ? "FNO" : "EQUITY",
        contractType: signal?.contractType || (position.symbol.endsWith("CE") ? "CE" : position.symbol.endsWith("PE") ? "PE" : null),
        strike: signal?.strike || null,
        expiry: signal?.expiry || null,
        slabAmount: position.slabAmount || 0,
        lotSize: signal?.lotSize || 1,
        lots: position.lots,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        targetPrice: position.targetPrice,
        stopLossPrice: position.stopLossPrice,
        mode: position.mode,
        status: "OPEN",
        delta: position.greeks?.delta ?? signal?.greeks?.delta ?? null,
        gamma: position.greeks?.gamma ?? signal?.greeks?.gamma ?? null,
        theta: position.greeks?.theta ?? signal?.greeks?.theta ?? null,
        iv: position.greeks?.iv ?? signal?.greeks?.iv ?? null,
        aiThesis: (signal?.aiThesis as any) || {
          summary: signal?.aiThesis?.summary || `${position.strategy} Execution`,
          action: position.action,
          catalyst: "Greek & Momentum Breakout Confirmation",
        },
        indicators: (signal?.indicators as any) || null,
        enteredAt: new Date(position.enteredAt),
      },
    });

    // 2. Insert Entry Leg into TradeOrderDetail
    await prisma.tradeOrderDetail.create({
      data: {
        masterId: master.id,
        orderId: position.orderId,
        legType: "ENTRY",
        symbol: position.symbol,
        token: position.token,
        exchange: position.exchange,
        action: position.action,
        quantity: position.quantity,
        lots: position.lots,
        price: position.entryPrice,
        triggerPrice: position.stopLossPrice,
        status: "COMPLETE",
        charges: position.charges || 0,
        delta: position.greeks?.delta ?? signal?.greeks?.delta ?? null,
        gamma: position.greeks?.gamma ?? signal?.greeks?.gamma ?? null,
        theta: position.greeks?.theta ?? signal?.greeks?.theta ?? null,
        iv: position.greeks?.iv ?? signal?.greeks?.iv ?? null,
        executedAt: new Date(position.enteredAt),
      },
    });
    console.log(`[Database] Persisted TradeOrderMaster & TradeOrderDetail for ${position.symbol} (${position.orderId})`);
    broadcastSocketEvent("ai_trade_logged", { orderId: position.orderId, symbol: position.symbol, status: "OPEN" });
  } catch (err: any) {
    console.error(`[Database] Failed to log AI trade entry:`, err?.message || err);
    logAiErrorToDb({
      source: "DATABASE",
      action: "INSERT_TRADE_LOG",
      symbol: position.symbol,
      token: position.token,
      message: err?.message || "Failed to insert trade log",
      stack: err?.stack,
      details: { positionId: position.id, orderId: position.orderId },
    }).catch(console.error);
  }
}

/**
 * Database Persistence: Update order exit & P&L in PostgreSQL TradeOrderMaster and TradeOrderDetail
 */
export async function logTradeExitToDb(
  position: ActiveAiPosition,
  reason: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL"
): Promise<void> {
  try {
    // 1. Update Institutional TradeOrderMaster
    const updatedMaster = await prisma.tradeOrderMaster.update({
      where: { masterOrderId: position.orderId },
      data: {
        exitPrice: position.currentPrice,
        status: "EXITED",
        exitReason: reason,
        pnl: position.pnl,
        pnlPercent: position.pnlPercent,
        charges: position.charges || 0,
        netPnl: position.netPnl || position.pnl,
        holdingMinutes: position.holdingMinutes,
        exitedAt: new Date(),
      },
    });

    // 2. Insert Exit Leg into TradeOrderDetail
    await prisma.tradeOrderDetail.create({
      data: {
        masterId: updatedMaster.id,
        orderId: `EXIT_${position.orderId}_${Date.now()}`,
        legType: reason === "STOP_LOSS" ? "STOP_LOSS" : reason === "TARGET" ? "TARGET" : "EXIT",
        symbol: position.symbol,
        token: position.token,
        exchange: position.exchange,
        action: position.action === "BUY" ? "SELL" : "BUY",
        quantity: position.quantity,
        lots: position.lots,
        price: position.currentPrice,
        status: "COMPLETE",
        charges: position.charges || 0,
        executedAt: new Date(),
      },
    });
    console.log(`[Database] Updated TradeOrderMaster & inserted Exit Leg into TradeOrderDetail for ${position.symbol} (Reason: ${reason}, NetPnL: ${position.netPnl})`);
    broadcastSocketEvent("ai_trade_logged", { orderId: position.orderId, symbol: position.symbol, status: "EXITED", reason });
  } catch (err: any) {
    console.error(`[Database] Failed to update AI trade exit in DB:`, err?.message || err);
    logAiErrorToDb({
      source: "DATABASE",
      action: "UPDATE_TRADE_EXIT",
      symbol: position.symbol,
      token: position.token,
      message: err?.message || "Failed to update trade exit in DB",
      stack: err?.stack,
      details: { positionId: position.id, orderId: position.orderId, reason },
    }).catch(console.error);
  }
}

/**
 * Retrieve Historical AI Trade Logs from PostgreSQL TradeOrderMaster with associated TradeOrderDetail legs
 */
export async function getAiTradeLogs(limit = 100, action?: string, mode?: string): Promise<any[]> {
  try {
    const whereClause: any = {};
    if (action && action !== "ALL") {
      whereClause.action = action.toUpperCase();
    }
    if (mode && mode !== "ALL" && mode !== "BOTH") {
      whereClause.mode = mode.toUpperCase();
    }

    const masters = await prisma.tradeOrderMaster.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        details: {
          orderBy: { executedAt: "asc" },
        },
      },
      orderBy: { enteredAt: "desc" },
      take: limit,
    });

    return masters.map((m) => ({
      ...m,
      id: String(m.id),
      orderId: m.masterOrderId,
      details: m.details.map((d) => ({
        ...d,
        id: String(d.id),
        masterId: String(d.masterId),
      })),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI trade logs:", err?.message || err);
    return [];
  }
}

/**
 * Clear historical AI trade logs from database (TradeOrderMaster and cascading TradeOrderDetail)
 * Supports filtering by mode (PAPER, LIVE, or ALL)
 */
export async function clearAiTradeLogs(mode: "PAPER" | "LIVE" | "ALL" = "PAPER"): Promise<number> {
  try {
    const whereClause: any = {};
    if (mode !== "ALL") {
      whereClause.mode = mode.toUpperCase();
    }
    const res = await prisma.tradeOrderMaster.deleteMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    // Also clean exited positions from in-memory map
    for (const [key, pos] of activeAiPositions.entries()) {
      if (pos.status === "EXITED") {
        if (mode === "ALL" || pos.mode === mode) {
          activeAiPositions.delete(key);
        }
      }
    }

    broadcastSocketEvent("ai_trade_logs_cleared", {
      mode,
      count: res.count,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Database] Cleared ${res.count} TradeOrderMaster records (mode: ${mode}).`);
    return res.count;
  } catch (err: any) {
    console.error("[Database] Error clearing AI trade logs:", err?.message || err);
    throw err;
  }
}

export interface TradeOrderReportFilter {
  fromDate?: string | undefined;
  toDate?: string | undefined;
  mode?: "PAPER" | "LIVE" | "ALL" | undefined;
  strategy?: string | undefined;
  underlying?: string | undefined;
  status?: "OPEN" | "EXITED" | "ALL" | undefined;
}

export interface TradeOrderReportSummary {
  totalOrders: number;
  openOrders: number;
  closedOrders: number;
  winTrades: number;
  lossTrades: number;
  breakEvenTrades: number;
  winRatePct: number;
  grossPnL: number;
  totalCharges: number;
  netPnL: number;
  maxProfit: number;
  maxDrawdown: number;
  avgHoldingMinutes: number;
  profitFactor: number;
  byStrategy: Record<string, { count: number; winRate: number; netPnl: number }>;
  byUnderlying: Record<string, { count: number; winRate: number; netPnl: number }>;
  bySlab: Record<string, { count: number; winRate: number; netPnl: number }>;
}

/**
 * Institutional From-Date to To-Date Trade Performance Report Generator
 * Aggregates master orders and leg execution details across user-defined date ranges and filters
 */
export async function getTradeOrderReport(filter: TradeOrderReportFilter = {}): Promise<{
  summary: TradeOrderReportSummary;
  orders: any[];
}> {
  try {
    const whereClause: any = {};

    if (filter.mode && filter.mode !== "ALL") {
      whereClause.mode = filter.mode.toUpperCase();
    }
    if (filter.strategy && filter.strategy !== "ALL") {
      whereClause.strategy = filter.strategy;
    }
    if (filter.underlying && filter.underlying !== "ALL") {
      whereClause.underlying = filter.underlying;
    }
    if (filter.status && filter.status !== "ALL") {
      whereClause.status = filter.status.toUpperCase();
    }

    // Date Range Filtering (From Date to To Date)
    if (filter.fromDate || filter.toDate) {
      whereClause.enteredAt = {};
      if (filter.fromDate) {
        const from = new Date(filter.fromDate);
        from.setHours(0, 0, 0, 0);
        whereClause.enteredAt.gte = from;
      }
      if (filter.toDate) {
        const to = new Date(filter.toDate);
        to.setHours(23, 59, 59, 999);
        whereClause.enteredAt.lte = to;
      }
    }

    const masters = await prisma.tradeOrderMaster.findMany({
      where: whereClause,
      include: {
        details: {
          orderBy: { executedAt: "asc" },
        },
      },
      orderBy: { enteredAt: "desc" },
    });

    const orders = masters.map((m) => ({
      ...m,
      id: String(m.id),
      orderId: m.masterOrderId,
      details: m.details.map((d) => ({
        ...d,
        id: String(d.id),
        masterId: String(d.masterId),
      })),
    }));

    // Aggregate Metrics
    const totalOrders = orders.length;
    let openOrders = 0;
    let closedOrders = 0;
    let winTrades = 0;
    let lossTrades = 0;
    let breakEvenTrades = 0;
    let grossPnL = 0;
    let totalCharges = 0;
    let netPnL = 0;
    let maxProfit = 0;
    let maxDrawdown = 0;
    let totalHoldingMinutes = 0;
    let grossGains = 0;
    let grossLosses = 0;

    const byStrategy: Record<string, { count: number; wins: number; netPnl: number }> = {};
    const byUnderlying: Record<string, { count: number; wins: number; netPnl: number }> = {};
    const bySlab: Record<string, { count: number; wins: number; netPnl: number }> = {};

    for (const order of orders) {
      const pnl = order.pnl || 0;
      const chg = order.charges || 0;
      const net = order.netPnl != null ? order.netPnl : pnl - chg;
      const strat = order.strategy || "UNKNOWN";
      const und = order.underlying || "OTHER";
      const slabKey = order.slabAmount ? `₹${(order.slabAmount / 1000).toFixed(0)}k` : "Dynamic";

      if (!byStrategy[strat]) byStrategy[strat] = { count: 0, wins: 0, netPnl: 0 };
      byStrategy[strat].count++;
      byStrategy[strat].netPnl += net;

      if (!byUnderlying[und]) byUnderlying[und] = { count: 0, wins: 0, netPnl: 0 };
      byUnderlying[und].count++;
      byUnderlying[und].netPnl += net;

      if (!bySlab[slabKey]) bySlab[slabKey] = { count: 0, wins: 0, netPnl: 0 };
      bySlab[slabKey].count++;
      bySlab[slabKey].netPnl += net;

      if (order.status === "OPEN") {
        openOrders++;
      } else {
        closedOrders++;
        grossPnL += pnl;
        totalCharges += chg;
        netPnL += net;
        totalHoldingMinutes += order.holdingMinutes || 0;

        if (net > 0) {
          winTrades++;
          grossGains += net;
          byStrategy[strat].wins++;
          byUnderlying[und].wins++;
          bySlab[slabKey].wins++;
        } else if (net < 0) {
          lossTrades++;
          grossLosses += Math.abs(net);
        } else {
          breakEvenTrades++;
        }

        if (net > maxProfit) maxProfit = net;
        if (net < maxDrawdown) maxDrawdown = net;
      }
    }

    const winRatePct = closedOrders > 0 ? Number(((winTrades / closedOrders) * 100).toFixed(1)) : 0;
    const profitFactor = grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : grossGains > 0 ? 999 : 0;
    const avgHoldingMinutes = closedOrders > 0 ? Number((totalHoldingMinutes / closedOrders).toFixed(1)) : 0;

    const formattedByStrategy: Record<string, { count: number; winRate: number; netPnl: number }> = {};
    for (const [k, v] of Object.entries(byStrategy)) {
      formattedByStrategy[k] = {
        count: v.count,
        winRate: v.count > 0 ? Number(((v.wins / v.count) * 100).toFixed(1)) : 0,
        netPnl: Number(v.netPnl.toFixed(2)),
      };
    }

    const formattedByUnderlying: Record<string, { count: number; winRate: number; netPnl: number }> = {};
    for (const [k, v] of Object.entries(byUnderlying)) {
      formattedByUnderlying[k] = {
        count: v.count,
        winRate: v.count > 0 ? Number(((v.wins / v.count) * 100).toFixed(1)) : 0,
        netPnl: Number(v.netPnl.toFixed(2)),
      };
    }

    const formattedBySlab: Record<string, { count: number; winRate: number; netPnl: number }> = {};
    for (const [k, v] of Object.entries(bySlab)) {
      formattedBySlab[k] = {
        count: v.count,
        winRate: v.count > 0 ? Number(((v.wins / v.count) * 100).toFixed(1)) : 0,
        netPnl: Number(v.netPnl.toFixed(2)),
      };
    }

    const summary: TradeOrderReportSummary = {
      totalOrders,
      openOrders,
      closedOrders,
      winTrades,
      lossTrades,
      breakEvenTrades,
      winRatePct,
      grossPnL: Number(grossPnL.toFixed(2)),
      totalCharges: Number(totalCharges.toFixed(2)),
      netPnL: Number(netPnL.toFixed(2)),
      maxProfit: Number(maxProfit.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      avgHoldingMinutes,
      profitFactor,
      byStrategy: formattedByStrategy,
      byUnderlying: formattedByUnderlying,
      bySlab: formattedBySlab,
    };

    return { summary, orders };
  } catch (err: any) {
    console.error("[Database] Error generating TradeOrder report:", err?.message || err);
    throw err;
  }
}

/**
 * Database Persistence: Record AI technical analysis / scanner evaluation into PostgreSQL AiAnalysisLog table
 */
export async function logAnalysisEntryToDb(
  signal: TradeSignal,
  source = "SCANNER"
): Promise<void> {
  try {
    await prisma.aiAnalysisLog.create({
      data: {
        symbol: signal.symbol,
        token: signal.token,
        exchange: signal.exchange || "NSE",
        segment: signal.segment || (signal.exchange === "NFO" ? "FNO" : "EQUITY"),
        contractType: signal.contractType || null,
        strike: signal.strike || null,
        expiry: signal.expiry || null,
        action: signal.action,
        confidence: signal.confidence || 50,
        timeframe: signal.timeframe || "INTRADAY",
        currentPrice: signal.currentPrice || signal.entryPrice || 0,
        entryPrice: signal.entryPrice || null,
        target1: signal.target1 || null,
        target2: signal.target2 || null,
        stopLoss: signal.stopLoss || null,
        riskReward: signal.riskReward || null,
        rsi: signal.indicators?.rsi || null,
        emaTrend: signal.indicators?.emaTrend || null,
        macdTrend: signal.indicators?.macd?.trend || null,
        delta: signal.greeks?.delta || null,
        gamma: signal.greeks?.gamma || null,
        theta: signal.greeks?.theta || null,
        iv: signal.greeks?.iv || null,
        pcr: null,
        aiThesisSummary: signal.aiThesis?.summary || null,
        source,
      },
    });
    broadcastSocketEvent("ai_analysis_logged", {
      symbol: signal.symbol,
      action: signal.action,
      confidence: signal.confidence,
      source,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[Database] Failed to log AI analysis entry:`, err?.message || err);
  }
}

/**
 * Retrieve Historical AI Analysis Logs from PostgreSQL (distinct from trade execution logs)
 */
export async function getAiAnalysisLogs(
  limit = 100,
  segment?: string,
  action?: string
): Promise<any[]> {
  try {
    const whereClause: any = {};
    if (segment && segment !== "ALL") {
      whereClause.segment = segment.toUpperCase();
    }
    if (action && action !== "ALL") {
      whereClause.action = action.toUpperCase();
    }

    const logs = await prisma.aiAnalysisLog.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return logs.map((log) => ({
      ...log,
      id: String(log.id),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI analysis logs:", err?.message || err);
    return [];
  }
}

/**
 * Clear all historical Analysis Logs from PostgreSQL
 */
export async function clearAiAnalysisLogs(): Promise<number> {
  try {
    const res = await prisma.aiAnalysisLog.deleteMany({});
    broadcastSocketEvent("ai_analysis_logs_cleared", { timestamp: new Date().toISOString() });
    return res.count;
  } catch (err: any) {
    console.error("[Database] Error clearing AI analysis logs:", err?.message || err);
    throw err;
  }
}

/**
 * Log system, broker, or AI execution errors to PostgreSQL
 */
export async function logAiErrorToDb(params: {
  source: string;
  action?: string;
  symbol?: string;
  token?: string;
  message: string;
  stack?: string;
  details?: any;
}): Promise<void> {
  try {
    await prisma.aiErrorLog.create({
      data: {
        source: params.source,
        action: params.action || null,
        symbol: params.symbol || null,
        token: params.token || null,
        message: params.message,
        stack: params.stack || null,
        details: params.details || null,
      },
    });
    const isAuditEvent =
      params.source === "AUTOPILOT_STATUS" ||
      params.source === "SCANNER" ||
      params.action === "ORDER_EXECUTED" ||
      params.action === "SLAB_CONFIG_UPDATED" ||
      params.action === "SLAB_EXCEEDED" ||
      params.action === "AUTOPILOT_ENABLED" ||
      params.action === "AUTOPILOT_DISABLED";

    if (isAuditEvent) {
      console.log(`[Audit Event Logged to DB] [${params.source}] ${params.message}`);
      broadcastSocketEvent("ai_audit_event_logged", {
        ...params,
        createdAt: new Date().toISOString(),
      });
    } else {
      console.log(`[Error Logged to DB] [${params.source}] ${params.message}`);
      broadcastSocketEvent("ai_error_logged", {
        ...params,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.error(`[Database] Failed to write AiErrorLog:`, err?.message || err);
  }
}

/**
 * Retrieve Error Logs from PostgreSQL
 */
export async function getAiErrorLogs(limit = 100): Promise<any[]> {
  try {
    const errs = await prisma.aiErrorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return errs.map((e) => ({
      ...e,
      id: String(e.id),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI error logs:", err?.message || err);
    return [];
  }
}

/**
 * Clear all historical Error Logs from PostgreSQL
 */
export async function clearAiErrorLogs(): Promise<number> {
  try {
    const res = await prisma.aiErrorLog.deleteMany({});
    broadcastSocketEvent("ai_error_logs_cleared", { timestamp: new Date().toISOString() });
    return res.count;
  } catch (err: any) {
    console.error("[Database] Error clearing AI error logs:", err?.message || err);
    throw err;
  }
}

/**
 * Auto-Exit Position Monitor with Realistic Cost Model, Retries & Critical Escalation
 * Continuously checks open AI positions against Target, Stop-Loss, and Theta Timeout.
 * Retries failed exit orders with backoff and sounds critical alarms if execution fails.
 */
export async function checkActivePositionsForExit(config?: {
  profitTargetPct?: number;
  stopLossPct?: number;
  thetaTimeoutMinutes?: number;
}): Promise<void> {
  const openPositions = Array.from(activeAiPositions.values()).filter((p) => p.status === "OPEN");
  if (openPositions.length === 0) return;

  const now = Date.now();
  let updatedAny = false;

  for (const pos of openPositions) {
    // 1. Update current price from cached quotes / active signals
    const quote = getCachedQuote(pos.token) || getCachedQuote(pos.symbol);
    const resolvedQuote = quoteResolver ? quoteResolver(pos.token, pos.symbol) : undefined;
    const liveLtp = quote?.ltp ?? resolvedQuote?.ltp ?? pos.currentPrice;

    if (liveLtp > 0) {
      // CIRCUIT BREAKER: Price Anomaly & Corrupt Feed Guard
      // Protects against feed glitches or instrument mismatches (e.g. quote jumping > 800% or dropping > 95% from entry)
      if (pos.entryPrice > 0) {
        const priceRatio = liveLtp / pos.entryPrice;
        if (priceRatio > 8.0 || priceRatio < 0.05) {
          console.warn(
            `[AI Price Anomaly Circuit Breaker] Suspect price feed spike on ${pos.symbol} (Entry: ₹${pos.entryPrice}, LiveLTP: ₹${liveLtp}, Ratio: ${priceRatio.toFixed(2)}x). Skipping exit evaluation for tick to protect capital.`
          );
          continue;
        }
      }

      pos.currentPrice = liveLtp;
      if (liveLtp > pos.highestPrice) {
        pos.highestPrice = liveLtp;
      }
    }

    // 2. Calculate realistic net P&L incorporating Indian transaction costs & slippage
    const isFno = pos.exchange === "NFO";
    const costBreakdown = calculateIndianMarketCosts({
      segment: isFno ? "FNO" : "EQUITY",
      buyPrice: pos.action === "BUY" ? pos.entryPrice : pos.currentPrice,
      sellPrice: pos.action === "BUY" ? pos.currentPrice : pos.entryPrice,
      quantity: pos.quantity,
      isMarketOrder: true,
    });

    pos.charges = costBreakdown.totalCost;
    pos.netPnl = costBreakdown.netPnl;
    pos.pnl = costBreakdown.netPnl; // Record net PnL after brokerage, STT, and slippage
    pos.pnlPercent = costBreakdown.netPnlPercent;

    // Calculate holding duration in minutes
    const holdingMins = (now - pos.enteredAt) / 60000;
    pos.holdingMinutes = Number(holdingMins.toFixed(1));
    updatedAny = true;

    // Check Exit Rules:
    let shouldExit = false;
    let reason: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL" = "TARGET";
    let exitMessage = "";

    const targetPct = config?.profitTargetPct || 35;
    const slPct = config?.stopLossPct || 18;
    const positionInvestedValue = (pos.quantity || ((pos.lots || 1) * 65)) * pos.entryPrice;
    // Dynamic Rupee Loss Cap: allows 18% SL breathing room plus buffer (minimum ₹1,200/lot instead of choking ₹180)
    const dynamicLossCap = Math.max((pos.lots || 1) * 1200, (positionInvestedValue * (slPct / 100)) * 1.25);
    const hardLossCapRupees = pos.maxRiskRupees || dynamicLossCap;

    // Rule 1: Trailing Stop-Loss to Breakeven & Dynamic Profit Locking
    // A. Breakeven Lock at +10% net gain
    if (pos.pnlPercent >= 10 && !pos.isBreakevenLocked) {
      pos.isBreakevenLocked = true;
      if (pos.action === "BUY") {
        const bePrice = Number((pos.entryPrice * 1.015).toFixed(2));
        if (pos.stopLossPrice < bePrice) pos.stopLossPrice = bePrice;
      } else {
        const bePrice = Number((pos.entryPrice * 0.985).toFixed(2));
        if (pos.stopLossPrice > bePrice) pos.stopLossPrice = bePrice;
      }
      console.log(
        `[AI Profit Lock] Locked stop-loss to breakeven for ${pos.symbol} @ ₹${pos.stopLossPrice} (Net gain: +${pos.pnlPercent}%)`
      );
    }

    // B. +10% Profit Lock at +20% net gain
    if (pos.pnlPercent >= 20 && (pos.trailingStep || 0) < 1) {
      pos.trailingStep = 1;
      if (pos.action === "BUY") {
        const trail1Price = Number((pos.entryPrice * 1.10).toFixed(2));
        if (pos.stopLossPrice < trail1Price) pos.stopLossPrice = trail1Price;
      } else {
        const trail1Price = Number((pos.entryPrice * 0.90).toFixed(2));
        if (pos.stopLossPrice > trail1Price) pos.stopLossPrice = trail1Price;
      }
      console.log(
        `[AI Profit Lock] Trailed stop-loss to lock +10% for ${pos.symbol} @ ₹${pos.stopLossPrice} (Net gain: +${pos.pnlPercent}%)`
      );
    }

    // C. +20% Profit Lock at +30% net gain
    if (pos.pnlPercent >= 30 && (pos.trailingStep || 0) < 2) {
      pos.trailingStep = 2;
      if (pos.action === "BUY") {
        const trail2Price = Number((pos.entryPrice * 1.20).toFixed(2));
        if (pos.stopLossPrice < trail2Price) pos.stopLossPrice = trail2Price;
      } else {
        const trail2Price = Number((pos.entryPrice * 0.80).toFixed(2));
        if (pos.stopLossPrice > trail2Price) pos.stopLossPrice = trail2Price;
      }
      console.log(
        `[AI Profit Lock] Trailed stop-loss to lock +20% for ${pos.symbol} @ ₹${pos.stopLossPrice} (Net gain: +${pos.pnlPercent}%)`
      );
    }

    // Rule 2: Hard Rupee Loss Cap (Strictly max ₹150–₹180 risk per lot)
    const currentNetLoss = pos.netPnl != null ? pos.netPnl : pos.pnl;
    if (currentNetLoss <= -hardLossCapRupees) {
      shouldExit = true;
      reason = "STOP_LOSS";
      exitMessage = `Hard Rupee Loss Cap Triggered (Net Loss ₹${Math.abs(currentNetLoss).toFixed(2)} reached ₹${hardLossCapRupees} cap for ${pos.lots || 1} lot(s))`;
    }

    // Rule 1 Verification: Price-Based Stop-Loss & Breakeven/Trailing SL Trigger
    if (!shouldExit && pos.stopLossPrice > 0) {
      if (pos.action === "BUY" && liveLtp <= pos.stopLossPrice) {
        shouldExit = true;
        reason = "STOP_LOSS";
        exitMessage = pos.isBreakevenLocked
          ? `Breakeven/Trailing SL Hit @ ₹${liveLtp} (SL: ₹${pos.stopLossPrice}, Net PnL: ${pos.pnlPercent}%)`
          : `Stop-Loss Price Hit @ ₹${liveLtp} (SL: ₹${pos.stopLossPrice}, Net PnL: ${pos.pnlPercent}%)`;
      } else if (pos.action === "SELL" && liveLtp >= pos.stopLossPrice) {
        shouldExit = true;
        reason = "STOP_LOSS";
        exitMessage = pos.isBreakevenLocked
          ? `Breakeven/Trailing SL Hit @ ₹${liveLtp} (SL: ₹${pos.stopLossPrice}, Net PnL: ${pos.pnlPercent}%)`
          : `Stop-Loss Price Hit @ ₹${liveLtp} (SL: ₹${pos.stopLossPrice}, Net PnL: ${pos.pnlPercent}%)`;
      }
    }

    // Target Check: Price-based or Profit Target %
    if (!shouldExit && pos.targetPrice > 0) {
      if (pos.action === "BUY" && liveLtp >= pos.targetPrice) {
        shouldExit = true;
        reason = "TARGET";
        exitMessage = `Target Price Hit @ ₹${liveLtp} (Target: ₹${pos.targetPrice}, +${pos.pnlPercent}% net)`;
      } else if (pos.action === "SELL" && liveLtp <= pos.targetPrice) {
        shouldExit = true;
        reason = "TARGET";
        exitMessage = `Target Price Hit @ ₹${liveLtp} (Target: ₹${pos.targetPrice}, +${pos.pnlPercent}% net)`;
      }
    }

    if (!shouldExit && pos.pnlPercent >= targetPct) {
      shouldExit = true;
      reason = "TARGET";
      exitMessage = `Target Percentage Hit (+${pos.pnlPercent}% net >= +${targetPct}%)`;
    }

    // Stop-Loss Percentage Trigger
    if (!shouldExit && pos.pnlPercent <= -slPct) {
      shouldExit = true;
      reason = "STOP_LOSS";
      exitMessage = `Stop-Loss Percentage Hit (${pos.pnlPercent}% net <= -${slPct}%)`;
    }

    // Rule 4: Accelerated Theta Harvester (20–25 Minute Cutoff)
    // If trade momentum is stagnant (< 15% net), exit and release capital
    const effectiveTimeout = Math.min(pos.timeoutMinutes || 25, 25);
    if (!shouldExit && holdingMins >= effectiveTimeout && pos.pnlPercent < 15) {
      shouldExit = true;
      reason = "THETA_TIMEOUT";
      exitMessage = `Accelerated Theta Timeout (Held ${pos.holdingMinutes}m >= ${effectiveTimeout}m with stagnant momentum < +15%)`;
    } else if (!shouldExit && holdingMins >= 45) {
      shouldExit = true;
      reason = "THETA_TIMEOUT";
      exitMessage = `Max Holding Timeout (Held ${pos.holdingMinutes}m >= 45m capital recycle)`;
    }

    if (shouldExit) {
      // Prevent overlapping concurrent exit order attempts for the same position
      if (pos.isExitPending) {
        continue;
      }
      pos.isExitPending = true;

      console.log(`[AI Auto-Exit] Executing ${exitMessage} for ${pos.symbol} (Net P&L: ₹${pos.pnl}, ${pos.pnlPercent}%)`);

      const exitAction: "BUY" | "SELL" = pos.action === "BUY" ? "SELL" : "BUY";
      const isPaper = pos.mode === "PAPER";
      const orderReq: OrderPlacementRequest = {
        variety: "NORMAL",
        tradingsymbol: pos.symbol,
        symboltoken: pos.token,
        transactiontype: exitAction,
        exchange: pos.exchange || (isFno ? "NFO" : "NSE"),
        ordertype: "MARKET",
        producttype: isFno ? "CARRYFORWARD" : "INTRADAY",
        duration: "DAY",
        price: 0,
        quantity: pos.quantity,
      };

      // Auto-exit execution with 3 retries and exponential backoff
      let exitSuccess = false;
      let exitOrderResult: any = null;
      let lastError: any = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          pos.lastExitAttempt = Date.now();
          exitOrderResult = await placeSmartApiOrder(orderReq, isPaper);
          exitSuccess = true;
          break;
        } catch (attemptErr: any) {
          lastError = attemptErr;
          console.warn(
            `[AI Auto-Exit] Attempt ${attempt}/${maxRetries} failed for ${pos.symbol}:`,
            attemptErr?.message || attemptErr
          );
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (exitSuccess) {
        pos.status = "EXITED";
        pos.exitReason = reason;
        pos.isExitPending = false;
        pos.exitRetryCount = 0;
        pos.lastExitError = undefined;

        await logTradeExitToDb(pos, reason);

        broadcastSocketEvent("ai_auto_exit_executed", {
          position: pos,
          exitOrder: exitOrderResult,
          reason,
          exitMessage,
          grossPnl: costBreakdown.grossPnl,
          charges: costBreakdown.totalCost,
          netPnl: costBreakdown.netPnl,
          pnl: pos.pnl,
          pnlPercent: pos.pnlPercent,
          holdingMinutes: pos.holdingMinutes,
        });

        console.log(`[AI Auto-Exit] Successfully exited ${pos.symbol}. Net PnL: ₹${pos.pnl}`);
      } else {
        // All retries exhausted! Critical escalation
        pos.isExitPending = false;
        pos.exitRetryCount = (pos.exitRetryCount || 0) + 1;
        pos.lastExitError = lastError?.message || "Auto-exit order failed after 3 attempts";

        console.error(
          `[AI Auto-Exit CRITICAL] ALL ${maxRetries} exit attempts failed for ${pos.symbol}! Alerting user.`
        );

        await logAiErrorToDb({
          source: "AUTO_EXIT_CRITICAL",
          action: `${reason}_EXIT_FAILED`,
          symbol: pos.symbol,
          token: pos.token,
          message: `CRITICAL: Auto-exit failed after ${maxRetries} retries: ${pos.lastExitError}`,
          stack: lastError?.stack,
          details: { positionId: pos.id, orderId: pos.orderId, retryCount: pos.exitRetryCount, reason },
        }).catch(console.error);

        // Broadcast high-priority emergency alert
        broadcastSocketEvent("ai_critical_exit_failed", {
          positionId: pos.id,
          symbol: pos.symbol,
          orderId: pos.orderId,
          retryCount: pos.exitRetryCount,
          reason,
          error: pos.lastExitError,
          actionRequired: "EMERGENCY_MANUAL_EXIT_REQUIRED",
          pnl: pos.pnl,
          pnlPercent: pos.pnlPercent,
        });
      }
    }
  }

  if (updatedAny) {
    broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));
  }
}

export function getActiveAiPositions(mode?: string): ActiveAiPosition[] {
  const all = Array.from(activeAiPositions.values());
  if (mode && mode !== "ALL" && mode !== "BOTH") {
    return all.filter((p) => p.mode === mode.toUpperCase());
  }
  return all;
}

export async function closeAiPositionManual(positionId: string): Promise<{ success: boolean; message: string; position: ActiveAiPosition }> {
  try {
    const pos = activeAiPositions.get(positionId);
    if (!pos) {
      throw new Error(`Position ${positionId} not found.`);
    }
    if (pos.status === "EXITED") {
      return { success: true, message: `Position already exited.`, position: pos };
    }

    const isFno = pos.exchange === "NFO";
    const exitAction: "BUY" | "SELL" = pos.action === "BUY" ? "SELL" : "BUY";
    const orderReq: OrderPlacementRequest = {
      variety: "NORMAL",
      tradingsymbol: pos.symbol,
      symboltoken: pos.token,
      transactiontype: exitAction,
      exchange: pos.exchange || (isFno ? "NFO" : "NSE"),
      ordertype: "MARKET",
      producttype: isFno ? "CARRYFORWARD" : "INTRADAY",
      duration: "DAY",
      price: 0,
      quantity: pos.quantity,
    };

    const isPaper = pos.mode === "PAPER";
    const exitRes = await placeSmartApiOrder(orderReq, isPaper);

    pos.status = "EXITED";
    pos.exitReason = "MANUAL";
    pos.exitRetryCount = 0;
    pos.lastExitError = undefined;

    // Calculate realistic net PnL after costs
    const costBreakdown = calculateIndianMarketCosts({
      segment: isFno ? "FNO" : "EQUITY",
      buyPrice: pos.action === "BUY" ? pos.entryPrice : pos.currentPrice,
      sellPrice: pos.action === "BUY" ? pos.currentPrice : pos.entryPrice,
      quantity: pos.quantity,
      isMarketOrder: true,
    });
    pos.charges = costBreakdown.totalCost;
    pos.netPnl = costBreakdown.netPnl;
    pos.pnl = costBreakdown.netPnl;
    pos.pnlPercent = costBreakdown.netPnlPercent;

    await logTradeExitToDb(pos, "MANUAL");

    broadcastSocketEvent("ai_auto_exit_executed", {
      position: pos,
      exitOrder: exitRes,
      reason: "MANUAL",
      exitMessage: "Manually closed by user",
      pnl: pos.pnl,
      pnlPercent: pos.pnlPercent,
      charges: pos.charges,
      holdingMinutes: pos.holdingMinutes,
    });
    broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));

    return {
      success: true,
      message: `Manually closed position ${pos.symbol}`,
      position: pos,
    };
  } catch (err: any) {
    logAiErrorToDb({
      source: "MANUAL_CLOSE",
      action: "CLOSE_POSITION",
      message: err?.message || "Manual position close failed",
      stack: err?.stack,
      details: { positionId },
    }).catch(console.error);
    throw err;
  }
}

let positionMonitorInterval: ReturnType<typeof setInterval> | null = null;
export function startActivePositionMonitor() {
  if (positionMonitorInterval) return;
  positionMonitorInterval = setInterval(() => {
    checkActivePositionsForExit().catch((err) => {
      console.warn("[PositionMonitor] Error:", err?.message || err);
    });
  }, 4000);
}

// Auto-start active position monitor
startActivePositionMonitor();
