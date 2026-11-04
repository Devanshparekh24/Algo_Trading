// ---------------------------------------------------------------------------
// SmartAPI – RMS Limits / Funds Margin Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { RMSData } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// ===========================================================================
// In-Memory RMS Cache & Fallback Store
// ===========================================================================
let cachedRms: RMSData | null = null;
let lastRmsFetchTime = 0;
const RMS_CACHE_TTL_MS = 10000; // 10 seconds cache to prevent 403 rate spikes

let lastKnownRmsData: RMSData = {
  net: "100000.00",
  availablecash: "100000.00",
  collateral: "0.00",
  m2mUnrealized: "0.00",
  m2mRealized: "0.00",
  utilisedDebits: "0.00",
  utilisedOptionpremium: "0.00",
  utilisedPayOut: "0.00",
  utilisedHoldings: "0.00",
};

/**
 * Fetch RMS limits / funds and margin details from Angel One.
 * Uses:
 * 1. 10s TTL In-Memory Cache to prevent rate limiting
 * 2. Rate-limiter queue execution
 * 3. Graceful fallback to last known RMS values on 403 or network errors
 *
 * Endpoint: GET https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getRMS
 */
export async function getRMS(): Promise<RMSData> {
  const now = Date.now();
  if (cachedRms && now - lastRmsFetchTime < RMS_CACHE_TTL_MS) {
    return cachedRms;
  }

  return executeSmartApiRequest(async () => {
    // Check cache again in case another queued task just populated it
    if (cachedRms && Date.now() - lastRmsFetchTime < RMS_CACHE_TTL_MS) {
      return cachedRms;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: RMSData;
      }>(url, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("access denied"))
        ) {
          throw { isRateLimitStatus: true, message };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `RMS limit fetch failed`;
        console.warn(`[SmartAPI] RMS limit fetch warning: ${errMsg}, returning last known data.`);
        return lastKnownRmsData;
      }

      cachedRms = data;
      lastKnownRmsData = data;
      lastRmsFetchTime = Date.now();
      console.log("[SmartAPI] RMS limit fetched successfully.");
      return data;
    } catch (error: any) {
      if (error?.isRateLimitStatus) {
        throw error; // Let rate limiter queue pause & backoff
      }

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error; // Allow rate limiter queue to retry
      }

      console.warn(`[SmartAPI] RMS fetch fallback due to error: ${error?.message || error}`);
      if (lastKnownRmsData) {
        return lastKnownRmsData;
      }
      handleApiError(error, "RMS limit fetch");
    }
  }, "getRMS");
}
