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
  OrderPlacementRequest,
  OrderPlacementResponse,
  OrderModifyRequest,
  OrderModifyResponse,
  OrderCancelRequest,
  OrderCancelResponse,
  OrderBookItem,
  TradeBookItem,
  IndividualOrderDetails,
  HoldingsPayload,
} from "./types.js";

// API functions
export {
  loginSmartAPI,
  refreshSmartAPISession,
  logoutSmartAPI,
  getUserProfile,
  clearProfileCache,
  getRMS,
  getPositions,
  getKnownPositions,
  updatePositionQuoteInCache,
  getHoldings,
  getKnownHoldings,
  getKnownHoldingsPayload,
  updateHoldingQuoteInCache,
  getCandleData,
  getLtpData,
  getFullModeData,
  getGainersLosersData,
  placeSmartApiOrder,
  modifySmartApiOrder,
  cancelSmartApiOrder,
  getSmartApiOrderBook,
  getSmartApiTradeBook,
  getIndividualOrderDetails,
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

// Rate Limiting & Concurrency Queue
export {
  executeSmartApiRequest,
  smartApiRateLimiter,
  smartApiRateLimiter as smartApiPacer,
  smartApiRateLimiter as smartApiQueue,
  RATE_LIMIT_CONFIGS,
} from "./rateLimiter.js";

// Option Chain Service
export {
  getOptionChainData,
  type OptionChainData,
  type OptionChainStrikeRow,
  type OptionContractDetails,
} from "./optionChain.service.js";