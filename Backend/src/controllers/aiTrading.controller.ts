// ---------------------------------------------------------------------------
// AI Trading Controller
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
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
  getUniverseScrips,
  addCustomUniverseScrip,
  removeCustomUniverseScrip,
  resetCustomUniverse,
  analyzeBudgetAndSuggestTrades,
  scanOptionChainSignals,
  getActiveAiPositions,
  closeAiPositionManual,
  getAiTradeLogs,
  getAiErrorLogs,
  clearAiErrorLogs,
  getStrategySchedules,
  logStrategyScheduleEvent,
  type MarketSegment,
  type ScripCandidate,
} from "../services/ai/aiTrading.service.js";
import { checkGoldenHours } from "../services/smartapi/greeks.service.js";

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
    const { signalId, quantity, lots, productType, orderType, limitPrice, mode } = req.body;

    if (!signalId) {
      res.status(400).json({
        status: false,
        message: "signalId is required for execution",
      });
      return;
    }

    const result = await executeSignalOrder(String(signalId), {
      quantity: quantity ? Number(quantity) : undefined,
      lots: lots ? Number(lots) : undefined,
      productType,
      orderType,
      limitPrice: limitPrice ? Number(limitPrice) : undefined,
      mode,
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
export function getActivePositionsController(_req: Request, res: Response): void {
  try {
    const positions = getActiveAiPositions();
    res.json({
      status: true,
      message: "Active AI positions fetched successfully",
      data: positions,
      totalPositions: positions.length,
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
 * GET /api/v1/ai/trade-logs
 * Retrieve permanent historical database logs of executed AI trades, Greeks & PnL
 */
export async function getAiTradeLogsController(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await getAiTradeLogs(limit);
    res.json({
      status: true,
      message: "AI trade logs retrieved from database",
      data: logs,
      totalLogs: logs.length,
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
