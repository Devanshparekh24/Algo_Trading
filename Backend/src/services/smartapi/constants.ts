// ---------------------------------------------------------------------------
// SmartAPI Constants
// ---------------------------------------------------------------------------

/** Base URL for Angel One SmartAPI */
export const BASE_URL = "https://apiconnect.angelone.in";

/** JWT token lifetime (2 hours) */
export const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

/** Refresh threshold – refresh if less than 5 minutes remaining */
export const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** Default session scheduler interval (30 minutes) */
export const DEFAULT_SCHEDULER_INTERVAL_MS = 30 * 60 * 1000;