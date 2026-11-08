// ---------------------------------------------------------------------------
// AI Trading Engine Master Facade
// Re-exports modularized AI trading services:
// - indicators.service: High-precision technical analysis calculations
// - universe.service: Dynamic universe, Demat holdings, and Top Movers
// - execution.service: Active positions, auto-exit monitor, retries & DB persistence
// - autoPilot.service: Autonomous strategy scheduler, kill-switch, & triggers
// - signals.service: Deep multi-factor instrument analysis & scanner
// - budgetAdvisor.service: Capital allocation & volatile options portfolio sizing
// - costModel.service: Realistic Indian market transaction costs & slippage
// - backtest.service: Strategy backtesting engine
// ---------------------------------------------------------------------------

// 1. Technical Indicator Calculations
export * from "./indicators.service.js";

// 2. Market Universe & Custom Scrip Management
export * from "./universe.service.js";

// 3. Trade Execution, Position Tracking & Auto-Exit Management
export * from "./execution.service.js";

// 4. Auto-Pilot Daemon, Strategy Schedules & Risk Kill-Switch
export * from "./autoPilot.service.js";

// 5. Signal Generation, Instrument Analysis & Scanner
export * from "./signals.service.js";

// 6. Budget Advisor & Dynamic Position Sizing
export * from "./budgetAdvisor.service.js";

// 7. Cost Model (Brokerage, STT, Exchange Fees, GST & Slippage)
export * from "./costModel.service.js";

// 8. Backtest Service
export * from "./backtest.service.js";

// 9. Canonical Types
export * from "../../types/aiTrading.types.js";
