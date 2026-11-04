// ---------------------------------------------------------------------------
// SmartAPI – Positions Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Position } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-Memory Positions Cache
let cachedPositions: Position[] = [];
let lastPositionsFetchTime = 0;
const POSITIONS_CACHE_TTL_MS = 5000; // 5s cache

/**
 * Retrieve the user's current open trading positions.
 * Requires a valid JWT token.
 * Uses 5s cache and central rate-limiter queue.
 */
export async function getPositions(): Promise<Position[]> {
  const now = Date.now();
  if (cachedPositions.length > 0 && now - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
    return cachedPositions;
  }

  return executeSmartApiRequest(async () => {
    if (cachedPositions.length > 0 && Date.now() - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
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
      }>(url, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status) {
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
          : message || `Failed to fetch positions`;
        console.warn(`[SmartAPI] Position fetch warning: ${errMsg}`);
        return cachedPositions;
      }

      cachedPositions = data || [];
      lastPositionsFetchTime = Date.now();
      console.log("[SmartAPI] Positions fetched successfully.");
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
      if (cachedPositions) {
        console.warn(`[SmartAPI] Positions fetch returning cached positions due to error: ${error?.message || error}`);
        return cachedPositions;
      }
      handleApiError(error, "position fetch");
    }
  }, "getPositions");
}
