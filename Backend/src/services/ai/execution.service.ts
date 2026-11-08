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
let signalResolver: ((id: string) => TradeSignal | undefined) | null = null;
let quoteResolver: ((token: string, symbol: string) => { ltp?: number } | undefined) | null = null;

export function setSignalResolver(fn: (id: string) => TradeSignal | undefined): void {
  signalResolver = fn;
}

export function setQuoteResolver(fn: (token: string, symbol: string) => { ltp?: number } | undefined): void {
  quoteResolver = fn;
}

/**
 * Server Restart Recovery & Position Persistence:
 * Reloads all OPEN trades from PostgreSQL AiTradeLog into activeAiPositions map,
 * ensuring stop-loss, profit-target, and theta-timeout monitoring resumes seamlessly.
 */
export async function loadPersistedOpenPositions(): Promise<number> {
  try {
    const openLogs = await prisma.aiTradeLog.findMany({
      where: { status: "OPEN" },
      orderBy: { enteredAt: "asc" },
    });

    let loadedCount = 0;
    for (const log of openLogs) {
      const posId = `pos_${log.orderId}`;
      const isFno = log.exchange === "NFO" || log.segment === "FNO";
      const targetPct = 35;
      const slPct = 18;

      const position: ActiveAiPosition = {
        id: posId,
        orderId: log.orderId,
        symbol: log.symbol,
        token: log.token,
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
      };

      activeAiPositions.set(posId, position);
      loadedCount++;
    }

    if (loadedCount > 0) {
      console.log(`[AI Position Persistence] Reloaded ${loadedCount} OPEN positions from PostgreSQL for active auto-exit monitoring.`);
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
      signal = signalResolver(signalId);
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

    const oType = options.orderType || "MARKET";
    const price = oType === "LIMIT" ? options.limitPrice || signal.currentPrice : 0;

    const orderReq: OrderPlacementRequest = {
      variety: "NORMAL",
      tradingsymbol: signal.symbol,
      symboltoken: signal.token,
      transactiontype: signal.action === "HOLD" ? "BUY" : signal.action,
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
    const actionToUse = (signal.action === "HOLD" ? "BUY" : signal.action) as "BUY" | "SELL";
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
      timeoutMinutes: options.thetaTimeoutMinutes || 45,
      mode: isPaper ? "PAPER" : "LIVE",
      status: "OPEN",
      pnl: 0,
      pnlPercent: 0,
      greeks: signal.greeks,
      exitRetryCount: 0,
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
    await prisma.aiTradeLog.create({
      data: {
        orderId: position.orderId,
        symbol: position.symbol,
        token: position.token,
        exchange: position.exchange,
        strategy: position.strategy || "GREEK_SNIPER",
        action: position.action,
        segment: isFno ? "FNO" : "EQUITY",
        contractType: signal?.contractType || null,
        strike: signal?.strike || null,
        expiry: signal?.expiry || null,
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
    console.log(`[Database] Logged AI trade entry for ${position.symbol} (${position.orderId})`);
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
 * Database Persistence: Update order exit & P&L in PostgreSQL AiTradeLog table
 */
export async function logTradeExitToDb(
  position: ActiveAiPosition,
  reason: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL"
): Promise<void> {
  try {
    await prisma.aiTradeLog.update({
      where: { orderId: position.orderId },
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
    console.log(`[Database] Updated AI trade exit for ${position.symbol} (${position.orderId}, Reason: ${reason}, PnL: ${position.pnl})`);
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
 * Retrieve Historical AI Trade Logs from PostgreSQL
 */
export async function getAiTradeLogs(limit = 100): Promise<any[]> {
  try {
    const logs = await prisma.aiTradeLog.findMany({
      orderBy: { enteredAt: "desc" },
      take: limit,
    });
    return logs.map((log) => ({
      ...log,
      id: String(log.id),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI trade logs:", err?.message || err);
    return [];
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
    console.log(`[Error Logged to DB] [${params.source}] ${params.message}`);
    broadcastSocketEvent("ai_error_logged", {
      ...params,
      createdAt: new Date().toISOString(),
    });
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
    const timeoutMins = pos.timeoutMinutes || config?.thetaTimeoutMinutes || 45;

    // Rule 1: Profit Target Hit
    if (pos.pnlPercent >= targetPct) {
      shouldExit = true;
      reason = "TARGET";
      exitMessage = `Target Hit (+${pos.pnlPercent}% net)`;
    }
    // Rule 2: Hard Stop-Loss Triggered
    else if (pos.pnlPercent <= -slPct) {
      shouldExit = true;
      reason = "STOP_LOSS";
      exitMessage = `Stop-Loss Triggered (${pos.pnlPercent}% net)`;
    }
    // Rule 3: Theta Timeout (Stagnant position held with minimal gain)
    else if (holdingMins >= timeoutMins && pos.pnlPercent < 8) {
      shouldExit = true;
      reason = "THETA_TIMEOUT";
      exitMessage = `Theta Timeout (Held ${pos.holdingMinutes}m > ${timeoutMins}m with stagnant momentum)`;
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

export function getActiveAiPositions(): ActiveAiPosition[] {
  return Array.from(activeAiPositions.values());
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
