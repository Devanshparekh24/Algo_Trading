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
  RMSData,
  Position,
  Holding,
  TokenStore,
  HistoricalDataRequest,
  CandleData,
  LtpDataRequest,
  LtpDataResponse,
  FullModeRequest,
  FullModeResponse,
  FullMode,
  MarketDepth,
  DepthOrder,
  UnFetched,
} from "./types.js";

// API functions
export {
  loginSmartAPI,
  refreshSmartAPISession,
  logoutSmartAPI,
  getUserProfile,
  getRMS,
  getPositions,
  getHoldings,
  getCandleData,
  getLtpData,
  getFullModeData,
  getGainersLosersData,
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

// Instrument service (Postgres backed)
export {
  syncInstruments,
  searchInstruments,
  startInstrumentScheduler,
} from "./instrument.service.js";