// ---------------------------------------------------------------------------
// AI Trading Routes
// ---------------------------------------------------------------------------

import { Router } from "express";
import {
  getAiSignalsController,
  analyzeScripController,
  lookupOptionStrikeController,
  executeSignalController,
  placeManualTradeController,
  getOrderBookController,
  getAutoPilotController,
  updateAutoPilotController,
  getUniverseController,
  addUniverseScripController,
  removeUniverseScripController,
  resetUniverseController,
  budgetAdvisorController,
  getActivePositionsController,
  closePositionController,
  getAiTradeLogsController,
  getAiErrorLogsController,
  clearAiErrorLogsController,
  getGoldenHoursController,
} from "../controllers/aiTrading.controller.js";

const router = Router();

// AI Market Signals (supports ?segment=FNO or ?segment=EQUITY)
router.get("/signals", getAiSignalsController);

// AI Budget Trade Advisor & Sizing (User inputs budget -> tailored suggestions)
router.post("/budget-advisor", budgetAdvisorController);

// Dynamic F&O Option Strike Lookup & Analysis (e.g. NIFTY 25000 PE)
router.post("/fno/strike", lookupOptionStrikeController);

// Dynamic Scanning Universe Management (Equities & F&O)
router.get("/universe", getUniverseController);
router.post("/universe", addUniverseScripController);
router.delete("/universe/:token", removeUniverseScripController);
router.post("/universe/reset", resetUniverseController);

// On-Demand Deep AI Analysis for any Scrip
router.post("/analyze", analyzeScripController);

// 1-Click Execution for Signal
router.post("/execute-signal", executeSignalController);

// Direct Manual Order Execution
router.post("/place-order", placeManualTradeController);

// Order Book & Execution History
router.get("/orders", getOrderBookController);

// Auto-Pilot Configuration & Controls
router.get("/autopilot", getAutoPilotController);
router.post("/autopilot", updateAutoPilotController);

// Active AI Positions & Auto-Exit Management
router.get("/positions", getActivePositionsController);
router.post("/positions/:id/close", closePositionController);

// Database Trade Logs & Error Logs
router.get("/trade-logs", getAiTradeLogsController);
router.get("/error-logs", getAiErrorLogsController);
router.delete("/error-logs", clearAiErrorLogsController);

// Golden Hours Status Indicator
router.get("/golden-hours", getGoldenHoursController);

export default router;

