// ---------------------------------------------------------------------------
// AI Trading Controller
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import prisma from "../config/prisma.js";
import {
  scanMarketUniverse,
  getActiveSignals,
  analyzeInstrument,
  findAndAnalyzeOptionStrike,
  executeSignalOrder,
  placeManualTrade,
  getOrderHistory,
  getAutoPilotConfig,
  updateAutoPilotConfig,
  resetAutoPilotKillSwitch,
  getUniverseScrips,
  addCustomUniverseScrip,
  removeCustomUniverseScrip,
  resetCustomUniverse,
  analyzeBudgetAndSuggestTrades,
  scanOptionChainSignals,
  getActiveAiPositions,
  closeAiPositionManual,
  getAiTradeLogs,
  clearAiTradeLogs,
  getAiAnalysisLogs,
  clearAiAnalysisLogs,
  getAiErrorLogs,
  clearAiErrorLogs,
  getStrategySchedules,
  logStrategyScheduleEvent,
  type MarketSegment,
  type ScripCandidate,
} from "../services/ai/aiTrading.service.js";
import { checkGoldenHours } from "../services/smartapi/greeks.service.js";
import { runStrategyBacktest } from "../services/ai/backtest.service.js";

/**
 * GET /api/v1/ai/signals
 * Fetch all active AI market signals. Can pass ?refresh=true and ?segment=FNO|EQUITY.
 */
export async function getAiSignalsController(req: Request, res: Response): Promise<void> {
  try {
    const forceRefresh = req.query.refresh === "true";
    const segment = (req.query.segment === "FNO" ? "FNO" : "EQUITY") as MarketSegment;
    let data = getActiveSignals(segment);

    if (forceRefresh || data.signals.length === 0) {
      await scanMarketUniverse(segment);
      data = getActiveSignals(segment);
    }

    res.json({
      status: true,
      message: `AI ${segment} signals fetched successfully`,
      data: {
        signals: data.signals,
        lastScanTime: data.lastScanTime,
        segment,
        totalSignals: data.signals.length,
        buySignals: data.signals.filter((s) => s.action === "BUY").length,
        sellSignals: data.signals.filter((s) => s.action === "SELL").length,
        holdSignals: data.signals.filter((s) => s.action === "HOLD").length,
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching signals:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch AI signals",
    });
  }
}

/**
 * POST /api/v1/ai/fno/strike
 * Dynamically look up and analyze any Option Strike (e.g. NIFTY 25000 PE)
 */
export async function lookupOptionStrikeController(req: Request, res: Response): Promise<void> {
  try {
    const { underlying, strike, optionType } = req.body;

    if (!underlying || !strike || !optionType) {
      res.status(400).json({
        status: false,
        message: "underlying, strike, and optionType (CE/PE) are required",
      });
      return;
    }

    const signal = await findAndAnalyzeOptionStrike({
      underlying: String(underlying),
      strike: Number(strike),
      optionType: String(optionType).toUpperCase() as "CE" | "PE",
    });

    res.json({
      status: true,
      message: `F&O Option Analysis complete for ${underlying} ${strike} ${optionType}`,
      data: signal,
    });
  } catch (error: any) {
    console.error("[AiController] Error looking up option strike:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to analyze option strike",
    });
  }
}

/**
 * POST /api/v1/ai/analyze
 * On-demand deep AI analysis of a specific symbol
 */
export async function analyzeScripController(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, token, exchange = "NSE" } = req.body;

    if (!symbol) {
      res.status(400).json({
        status: false,
        message: "Symbol is required for AI analysis",
      });
      return;
    }

    const signal = await analyzeInstrument(
      String(symbol),
      token ? String(token) : undefined,
      String(exchange),
      undefined,
      true
    );

    res.json({
      status: true,
      message: `AI analysis complete for ${symbol}`,
      data: signal,
    });
  } catch (error: any) {
    console.error("[AiController] Error analyzing scrip:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to analyze scrip",
    });
  }
}

/**
 * POST /api/v1/ai/execute-signal
 * 1-Click execution of an active AI signal
 */
export async function executeSignalController(req: Request, res: Response): Promise<void> {
  try {
    const {
      signalId,
      quantity,
      lots,
      productType,
      orderType,
      limitPrice,
      mode,
      options: bodyOptions,
      signal: bodySignal,
    } = req.body;

    if (!signalId) {
      res.status(400).json({
        status: false,
        message: "signalId is required for execution",
      });
      return;
    }

    const resolvedQuantity = quantity ?? bodyOptions?.quantity;
    const resolvedLots = lots ?? bodyOptions?.lots;
    const resolvedProductType = productType ?? bodyOptions?.productType;
    const resolvedOrderType = orderType ?? bodyOptions?.orderType;
    const resolvedLimitPrice = limitPrice ?? bodyOptions?.limitPrice;
    const resolvedMode = mode ?? bodyOptions?.mode;
    const resolvedSignal = bodySignal ?? bodyOptions?.signal;

    const result = await executeSignalOrder(String(signalId), {
      quantity: resolvedQuantity ? Number(resolvedQuantity) : undefined,
      lots: resolvedLots ? Number(resolvedLots) : undefined,
      productType: resolvedProductType,
      orderType: resolvedOrderType,
      limitPrice: resolvedLimitPrice ? Number(resolvedLimitPrice) : undefined,
      mode: resolvedMode,
      signal: resolvedSignal,
    });

    res.json({
      status: true,
      message: result.message,
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Error executing signal:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to execute AI signal order",
    });
  }
}

/**
 * POST /api/v1/ai/place-order
 * Direct manual trade placement
 */
export async function placeManualTradeController(req: Request, res: Response): Promise<void> {
  try {
    const {
      tradingsymbol,
      symboltoken,
      exchange,
      transactiontype,
      ordertype,
      producttype,
      quantity,
      price,
      mode,
    } = req.body;

    if (!tradingsymbol || !symboltoken || !transactiontype || !quantity) {
      res.status(400).json({
        status: false,
        message: "tradingsymbol, symboltoken, transactiontype, and quantity are required",
      });
      return;
    }

    const result = await placeManualTrade({
      tradingsymbol: String(tradingsymbol),
      symboltoken: String(symboltoken),
      exchange: exchange ? String(exchange) : "NSE",
      transactiontype,
      ordertype,
      producttype,
      quantity: Number(quantity),
      price: price ? Number(price) : 0,
      mode,
    });

    res.json({
      status: true,
      message: result.message,
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Error placing order:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to place order",
    });
  }
}

/**
 * GET /api/v1/ai/orders
 * Retrieve order book history (paper + live)
 */
export async function getOrderBookController(_req: Request, res: Response): Promise<void> {
  try {
    const orders = await getOrderHistory();

    res.json({
      status: true,
      message: "Order book retrieved successfully",
      data: {
        orders,
        totalOrders: orders.length,
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error getting order book:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to retrieve order book",
    });
  }
}

/**
 * GET /api/v1/ai/autopilot
 * Retrieve Auto-Pilot status and settings
 */
export function getAutoPilotController(_req: Request, res: Response): void {
  const config = getAutoPilotConfig();
  res.json({
    status: true,
    data: config,
  });
}

/**
 * POST /api/v1/ai/autopilot
 * Update Auto-Pilot configuration
 */
export function updateAutoPilotController(req: Request, res: Response): void {
  try {
    const updated = updateAutoPilotConfig(req.body);
    res.json({
      status: true,
      message: "Auto-Pilot configuration updated successfully",
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to update Auto-Pilot configuration",
    });
  }
}

/**
 * POST /api/v1/ai/autopilot/reset-kill-switch
 * Explicitly reset the daily kill-switch baseline and re-enable session trading
 */
export function resetKillSwitchController(_req: Request, res: Response): void {
  try {
    const updated = resetAutoPilotKillSwitch();
    res.json({
      status: true,
      message: "AI Auto-Pilot kill-switch has been reset successfully. Session loss baseline is refreshed.",
      data: updated,
    });
  } catch (error: any) {
    console.error("[AiController] Error resetting kill switch:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to reset kill-switch",
    });
  }
}

/**
 * GET /api/v1/ai/universe
 * Retrieve dynamic scanning universe (Equities and/or F&O)
 */
export async function getUniverseController(req: Request, res: Response): Promise<void> {
  try {
    const segment =
      req.query.segment === "FNO" || req.query.segment === "EQUITY"
        ? (req.query.segment as MarketSegment)
        : undefined;

    const universe = await getUniverseScrips(segment);
    res.json({
      status: true,
      message: "Dynamic scanner universe fetched successfully",
      data: {
        universe,
        total: universe.length,
        segment: segment || "ALL",
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching dynamic universe:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch dynamic universe",
    });
  }
}

/**
 * POST /api/v1/ai/universe
 * Add a custom instrument/strike to the AI scanning universe
 */
export async function addUniverseScripController(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, token, exchange, name, segment, contractType, strike, expiry, lotSize, underlying } = req.body;

    if (!symbol) {
      res.status(400).json({
        status: false,
        message: "symbol is required to add to scan universe",
      });
      return;
    }

    const updated = await addCustomUniverseScrip({
      symbol: String(symbol),
      token: token ? String(token) : undefined,
      exchange: exchange ? String(exchange) : "NSE",
      name: name ? String(name) : String(symbol),
      segment: segment ? (segment as MarketSegment) : undefined,
      contractType,
      strike: strike ? Number(strike) : undefined,
      expiry: expiry ? String(expiry) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
      underlying: underlying ? String(underlying) : undefined,
    });

    res.json({
      status: true,
      message: `Added ${symbol} to dynamic scan universe`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[AiController] Error adding scrip to universe:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to add scrip to universe",
    });
  }
}

/**
 * DELETE /api/v1/ai/universe/:token
 * Remove an instrument from the dynamic scan universe
 */
export async function removeUniverseScripController(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    if (!token) {
      res.status(400).json({
        status: false,
        message: "token parameter is required",
      });
      return;
    }

    const updated = await removeCustomUniverseScrip(token);
    res.json({
      status: true,
      message: `Removed instrument ${token} from dynamic scan universe`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[AiController] Error removing scrip from universe:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to remove scrip from universe",
    });
  }
}

/**
 * POST /api/v1/ai/universe/reset
 * Reset custom universe back to dynamic baseline defaults
 */
export async function resetUniverseController(_req: Request, res: Response): Promise<void> {
  try {
    const updated = await resetCustomUniverse();
    res.json({
      status: true,
      message: "Dynamic scan universe reset to baseline defaults",
      data: updated,
    });
  } catch (error: any) {
    console.error("[AiController] Error resetting universe:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to reset dynamic universe",
    });
  }
}

/**
 * POST /api/v1/ai/budget-advisor
 * AI Budget Trade Advisor & Position Sizing
 */
export async function budgetAdvisorController(req: Request, res: Response): Promise<void> {
  try {
    const { budget, riskProfile, segment, maxTrades } = req.body;

    const numBudget = Number(budget);
    if (!numBudget || isNaN(numBudget) || numBudget < 100) {
      res.status(400).json({
        status: false,
        message: "Please provide a valid trading budget (minimum ₹100)",
      });
      return;
    }

    const result = await analyzeBudgetAndSuggestTrades({
      budget: numBudget,
      riskProfile: riskProfile || "MODERATE",
      segment: segment || "ALL",
      maxTrades: maxTrades ? Number(maxTrades) : undefined,
    });

    res.json({
      status: true,
      message: "Budget analysis completed successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Error running budget advisor:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to generate budget suggestions",
    });
  }
}

/**
 * POST /api/v1/ai/option-chain/scan
 * Scan an option chain and return a ranked list of option signals
 */
export async function scanOptionChainController(req: Request, res: Response): Promise<void> {
  try {
    const { underlying, expiry, strikeCount } = req.body || {};
    const params: { underlying: string; expiry?: string; strikeCount?: number } = {
      underlying: String(underlying || "NIFTY"),
    };
    if (expiry) params.expiry = String(expiry);
    if (strikeCount) params.strikeCount = Number(strikeCount);

    const result = await scanOptionChainSignals(params);
    res.json({
      status: true,
      message: `Option chain scan complete for ${result.underlying}`,
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Option chain scan error:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to scan option chain",
    });
  }
}


/**
 * GET /api/v1/ai/positions
 * Retrieve all currently active AI sniper and auto-pilot positions with real-time P&L
 */
export function getActivePositionsController(req: Request, res: Response): void {
  try {
    const mode = req.query.mode ? String(req.query.mode) : undefined;
    const positions = getActiveAiPositions(mode);
    res.json({
      status: true,
      message: "Active AI positions fetched successfully",
      data: positions,
      totalPositions: positions.length,
      mode: mode || "ALL",
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching active positions:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch active positions",
    });
  }
}

/**
 * POST /api/v1/ai/positions/:id/close
 * Manual 1-click exit for an active AI position
 */
export async function closePositionController(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ status: false, message: "Position ID is required" });
      return;
    }
    const result = await closeAiPositionManual(id);
    res.json({
      status: true,
      message: result.message,
      data: result.position,
    });
  } catch (error: any) {
    console.error("[AiController] Error closing position:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to close position",
    });
  }
}

/**
 * GET /api/v1/ai/trader-orders
 * Retrieve institutional Master-Detail trade records (TraderOrderMaster + TraderOrderDetail)
 */
export async function getTraderOrdersController(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const mode = req.query.mode ? String(req.query.mode).toUpperCase() : undefined;
    const where: any = {};
    if (mode && mode !== "ALL" && mode !== "BOTH") {
      where.mode = mode;
    }

    const masters = await prisma.tradeOrderMaster.findMany({
      where,
      orderBy: { enteredAt: "desc" },
      take: limit,
      include: {
        details: {
          orderBy: { executedAt: "asc" },
        },
      },
    });

    const { getAutoPilotConfig } = await import("../services/ai/autoPilot.service.js");
    const cfg = getAutoPilotConfig();

    res.json({
      status: true,
      message: "Trade Order Master records retrieved successfully",
      activeScanningSlab: cfg.maxBudgetPerTrade || 0,
      totalOrders: masters.length,
      data: masters.map((m) => ({
        ...m,
        id: String(m.id),
        details: m.details.map((d) => ({
          ...d,
          id: String(d.id),
          masterId: String(d.masterId),
        })),
      })),
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching trade orders:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch trade orders",
    });
  }
}

/**
 * GET /api/v1/ai/trade-orders/report
 * Institutional From-Date to To-Date performance report and execution analytics
 */
export async function getTradeOrderReportController(req: Request, res: Response): Promise<void> {
  try {
    const { getTradeOrderReport } = await import("../services/ai/execution.service.js");
    const { fromDate, toDate, mode, strategy, underlying, status } = req.query;

    const report = await getTradeOrderReport({
      fromDate: fromDate ? String(fromDate) : undefined,
      toDate: toDate ? String(toDate) : undefined,
      mode: mode ? (String(mode).toUpperCase() as any) : undefined,
      strategy: strategy ? String(strategy) : undefined,
      underlying: underlying ? String(underlying) : undefined,
      status: status ? (String(status).toUpperCase() as any) : undefined,
    });

    const { getAutoPilotConfig } = await import("../services/ai/autoPilot.service.js");
    const cfg = getAutoPilotConfig();

    res.json({
      status: true,
      message: "Trade order report generated successfully",
      activeScanningSlab: cfg.maxBudgetPerTrade || 0,
      summary: report.summary,
      data: report.orders,
      totalOrders: report.orders.length,
      filters: {
        fromDate: fromDate || null,
        toDate: toDate || null,
        mode: mode || "ALL",
        strategy: strategy || "ALL",
        underlying: underlying || "ALL",
        status: status || "ALL",
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error generating trade order report:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to generate trade order report",
    });
  }
}

/**
 * GET /api/v1/ai/trade-logs
 * Retrieve permanent historical database logs of executed AI trades (BUY or SELL orders)
 */
export async function getAiTradeLogsController(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const action = req.query.action ? String(req.query.action) : undefined;
    const mode = req.query.mode ? String(req.query.mode) : undefined;
    const logs = await getAiTradeLogs(limit, action, mode);
    res.json({
      status: true,
      message: "AI trade logs retrieved from database",
      data: logs,
      totalLogs: logs.length,
      mode: mode || "ALL",
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching trade logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch AI trade logs",
    });
  }
}

/**
 * DELETE /api/v1/ai/trade-logs
 * Clear historical AI trade logs from database (supports ?mode=PAPER | LIVE | ALL)
 */
export async function clearAiTradeLogsController(req: Request, res: Response): Promise<void> {
  try {
    const rawMode = req.query.mode ? String(req.query.mode).toUpperCase() : "PAPER";
    const mode = (rawMode === "LIVE" || rawMode === "ALL" || rawMode === "PAPER") ? rawMode : "PAPER";
    const deletedCount = await clearAiTradeLogs(mode);
    res.json({
      status: true,
      message: `Cleared ${deletedCount} ${mode} trade logs from database`,
      deletedCount,
      mode,
    });
  } catch (error: any) {
    console.error("[AiController] Error clearing trade logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to clear AI trade logs",
    });
  }
}

/**
 * GET /api/v1/ai/analysis-logs
 * Retrieve permanent historical database logs of AI technical analysis & scanner evaluations
 */
export async function getAiAnalysisLogsController(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const segment = req.query.segment ? String(req.query.segment) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const logs = await getAiAnalysisLogs(limit, segment, action);
    res.json({
      status: true,
      message: "AI analysis logs retrieved from database",
      data: logs,
      totalLogs: logs.length,
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching analysis logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch AI analysis logs",
    });
  }
}

/**
 * DELETE /api/v1/ai/analysis-logs
 * Clear all historical AI analysis logs from database
 */
export async function clearAiAnalysisLogsController(req: Request, res: Response): Promise<void> {
  try {
    const deletedCount = await clearAiAnalysisLogs();
    res.json({
      status: true,
      message: `Cleared ${deletedCount} analysis logs from database`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("[AiController] Error clearing analysis logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to clear AI analysis logs",
    });
  }
}

/**
 * GET /api/v1/ai/error-logs
 * Retrieve database error logs for system, broker, or AI execution issues
 */
export async function getAiErrorLogsController(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const errors = await getAiErrorLogs(limit);
    res.json({
      status: true,
      message: "AI error logs retrieved from database",
      data: errors,
      totalErrors: errors.length,
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching error logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch AI error logs",
    });
  }
}

/**
 * DELETE /api/v1/ai/error-logs
 * Clear all historical error logs from database
 */
export async function clearAiErrorLogsController(req: Request, res: Response): Promise<void> {
  try {
    const deletedCount = await clearAiErrorLogs();
    res.json({
      status: true,
      message: `Cleared ${deletedCount} error logs from database`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("[AiController] Error clearing error logs:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to clear AI error logs",
    });
  }
}

/**
 * GET /api/v1/ai/golden-hours
 * Get current Indian market Golden Hours status and timing window
 */
export function getGoldenHoursController(_req: Request, res: Response): void {
  try {
    const status = checkGoldenHours();
    res.json({
      status: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to check golden hours",
    });
  }
}

/**
 * GET /api/v1/ai/strategy-schedule
 * Get strategy timetable with IST timings, active days, target/SL %, and current live suggestion
 */
export async function getStrategyScheduleController(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getStrategySchedules();
    res.json({
      status: true,
      message: "Strategy schedules and live suggestion retrieved successfully",
      data,
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching strategy schedules:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch strategy schedules",
    });
  }
}

/**
 * POST /api/v1/ai/strategy-schedule/log
 * Log an active strategy event or execution to the database with date and time
 */
export async function logStrategyScheduleController(req: Request, res: Response): Promise<void> {
  try {
    const result = await logStrategyScheduleEvent(req.body);
    res.json({
      status: true,
      message: "Strategy schedule logged successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Error logging strategy schedule:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to log strategy schedule",
    });
  }
}

/**
 * POST /api/v1/ai/backtest
 * Run historical backtest of a trading strategy with realistic Indian market cost model
 */
export async function runBacktestController(req: Request, res: Response): Promise<void> {
  try {
    const { strategy, symbol, token, exchange, fromDate, toDate, interval, initialCapital, targetPct, stopLossPct, lotSize } = req.body;

    if (!symbol || !token || !exchange || !fromDate || !toDate) {
      res.status(400).json({
        status: false,
        message: "symbol, token, exchange, fromDate, and toDate are required fields.",
      });
      return;
    }

    const result = await runStrategyBacktest({
      strategy,
      symbol,
      token,
      exchange,
      fromDate,
      toDate,
      interval,
      initialCapital: initialCapital ? Number(initialCapital) : undefined,
      targetPct: targetPct ? Number(targetPct) : undefined,
      stopLossPct: stopLossPct ? Number(stopLossPct) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
    });

    res.json({
      status: true,
      message: "Strategy backtest completed successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[AiController] Error running strategy backtest:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to execute strategy backtest",
    });
  }
}

/**
 * GET /api/v1/ai/news
 * Returns real-time live Indian market news & macroeconomic headlines
 */
export async function getLiveMarketNewsController(req: Request, res: Response): Promise<void> {
  try {
    const { getLiveMarketNews } = await import("../services/ai/marketNews.service.js");
    const news = await getLiveMarketNews(10);
    res.json({
      status: true,
      message: "Live Indian market news retrieved",
      data: news,
    });
  } catch (error: any) {
    console.error("[AiController] Error fetching market news:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to fetch market news",
    });
  }
}

/**
 * GET /api/v1/ai/gemini/post-mortem
 * Returns Gemini AI's deep analysis on historical trades
 */
export async function getGeminiPostMortemController(req: Request, res: Response): Promise<void> {
  try {
    const { analyzeDailyTradesWithGemini, isGeminiActive } = await import("../services/ai/gemini.service.js");
    const { getAiTradeLogs } = await import("../services/ai/execution.service.js");

    if (!isGeminiActive()) {
      res.json({
        status: false,
        message: "Gemini API key is not configured in Backend/.env",
        data: null,
      });
      return;
    }

    const trades = await getAiTradeLogs(25);
    const analysis = await analyzeDailyTradesWithGemini(trades);

    res.json({
      status: true,
      message: "Gemini post-mortem analysis generated",
      data: {
        analysis,
        tradeCount: trades.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error generating Gemini post-mortem:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to generate post-mortem",
    });
  }
}

/**
 * POST /api/v1/ai/gemini/copilot
 * Interactive AI Trading Copilot query
 */
export async function queryGeminiCopilotController(req: Request, res: Response): Promise<void> {
  try {
    const { question, context } = req.body;
    if (!question || typeof question !== "string") {
      res.status(400).json({
        status: false,
        message: "A valid question string is required",
      });
      return;
    }

    const { queryGeminiTradingCopilot } = await import("../services/ai/gemini.service.js");
    const reply = await queryGeminiTradingCopilot(question, context);

    res.json({
      status: true,
      message: "Copilot reply generated",
      data: {
        reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AiController] Error querying Gemini copilot:", error);
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to query copilot",
    });
  }
}

/**
 * GET /api/v1/ai/gemini/status
 * Returns operational status of the Gemini AI Decision Engine
 */
export async function getGeminiStatusController(req: Request, res: Response): Promise<void> {
  try {
    const { isGeminiActive } = await import("../services/ai/gemini.service.js");
    const { getLiveMarketNews } = await import("../services/ai/marketNews.service.js");
    const news = await getLiveMarketNews(3);

    res.json({
      status: true,
      data: {
        active: isGeminiActive(),
        model: "gemini-3.5-flash",
        autonomousGateEnabled: true,
        newsHeadlinesCount: news.items.length,
        lastNewsSync: news.fetchedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error?.message || "Failed to check Gemini status",
    });
  }
}
