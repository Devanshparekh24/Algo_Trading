// ---------------------------------------------------------------------------
// SmartAPI – Main barrel export
// ---------------------------------------------------------------------------
// Re-exports everything from the old smartapi.ts for backward compatibility.
// Consumers can import from "smartapi/index.js" directly, or continue using
// the old path if this is the entry point.
// ---------------------------------------------------------------------------

// Types
export type {
  LoginResponse,
  UserProfile,
  Position,
  Holding,
  TokenStore,
  HistoricalDataRequest,
  CandleData,
} from "./types.js";

// API functions
export {
  loginSmartAPI,
  refreshSmartAPISession,
  logoutSmartAPI,
  getUserProfile,
  getPositions,
  getHoldings,
  getCandleData,
} from "./api/index.js";

// Session management
export {
  getValidSession,
  startSessionScheduler,
} from "./session.js";

// Token store (debug/monitoring)
export {
  getStore as getTokenStore,
} from "./store.js";