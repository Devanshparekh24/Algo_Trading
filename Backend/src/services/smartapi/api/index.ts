// ---------------------------------------------------------------------------
// SmartAPI – API barrel export
// ---------------------------------------------------------------------------

export { loginSmartAPI, refreshSmartAPISession, logoutSmartAPI } from "./auth.js";
export { getUserProfile } from "./profile.js";
export { getRMS } from "./rms.js";

export { getPositions, getKnownPositions, updatePositionQuoteInCache } from "./positions.js";
export { getHoldings, getKnownHoldings, getKnownHoldingsPayload, updateHoldingQuoteInCache } from "./holdings.js";
export { getCandleData } from "./historical.js";
export { getLtpData } from "./ltp.js";
export { getFullModeData, cacheQuote, getCachedQuote } from "./FullMode.js";
export { getGainersLosersData } from "./gainersLosers.js";
export { placeSmartApiOrder, getSmartApiOrderBook, cancelSmartApiOrder } from "./order.js";
