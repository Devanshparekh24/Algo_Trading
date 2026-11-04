// ---------------------------------------------------------------------------
// SmartAPI – Positions Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Position } from "../types.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-Memory Positions Cache & Fallback
let cachedPositions: Position[] = [];
let lastPositionsFetchTime = 0;
let hasPositionsFetchedOnce = false;
const POSITIONS_CACHE_TTL_MS = 5000; // 5s cache

/**
 * Retrieve the user's current open trading positions from Angel One SmartAPI.
 * Features:
 * 1. 5s In-Memory cache to prevent rate limit spikes
 * 2. Queued execution via SmartAPI Rate Limiter
 * 3. Graceful fallback on network or broker rate limit errors
 */
export async function getPositions(): Promise<Position[]> {
  const now = Date.now();
  if (hasPositionsFetchedOnce && now - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
    return cachedPositions;
  }

  return executeSmartApiRequest(async () => {
    if (hasPositionsFetchedOnce && Date.now() - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
      return cachedPositions;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: Position[] | null;
      }>(url, { headers, timeout: DEFAULT_TIMEOUT_MS });

      const { status, message, data, errorcode } = response.data;

      if (!status) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("access denied") ||
            message.toLowerCase().includes("ag8001"))
        ) {
          throw { isRateLimitStatus: true, message };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to fetch positions`;
        console.warn(`[SmartAPI] Position fetch warning: ${errMsg}`);
        return cachedPositions;
      }

      cachedPositions = data || [];
      lastPositionsFetchTime = Date.now();
      hasPositionsFetchedOnce = true;
      console.log(`[SmartAPI] Positions fetched successfully (${cachedPositions.length} positions).`);
      return cachedPositions;
    } catch (error: any) {
      if (error?.isRateLimitStatus) {
        throw error;
      }
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      console.warn(`[SmartAPI] Positions fetch fallback: ${error?.message || error}`);
      return cachedPositions;
    }
  }, "getPositions");
}
