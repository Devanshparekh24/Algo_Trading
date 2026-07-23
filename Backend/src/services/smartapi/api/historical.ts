// ---------------------------------------------------------------------------
// SmartAPI – Historical Data Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { HistoricalDataRequest, CandleData } from "../types.js";
import { handleApiError } from "./errorHandler.js";

/**
 * Helper to check if an error is an Angel One rate limit error.
 */
function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data;

    // Status 429 is standard Too Many Requests.
    // Status 403 is used by Angel One for rate limits.
    if (status === 429 || status === 403) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body || "");
      const lower = bodyStr.toLowerCase();
      return (
        lower.includes("exceeding access rate") ||
        lower.includes("rate limit") ||
        lower.includes("access denied")
      );
    }
  }
  return false;
}

/**
 * Simple sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch historical candle data.
 * Requires a valid JWT token.
 * Retries with exponential backoff on rate limit errors.
 * 
 * @param request The parameters for fetching historical data.
 */
export async function getCandleData(request: HistoricalDataRequest): Promise<CandleData[]> {
  const maxRetries = 5;
  let attempt = 0;
  let delay = 500; // ms

  while (true) {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.post<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: CandleData[];
      }>(url, request, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        if (message && (message.toLowerCase().includes("exceeding access rate") || message.toLowerCase().includes("rate limit"))) {
          throw {
            isRateLimitStatus: true,
            message,
          };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Historical data fetch failed (status: ${status}, response: ${JSON.stringify(response.data)})`;
        console.error(`[SmartAPI] Historical data fetch failed details:`, response.data);
        throw new Error(errMsg);
      }

      console.log(`[SmartAPI] Historical data fetched successfully for token: ${request.symboltoken}`);
      return data;
    } catch (error: any) {
      const isRateLimit = isRateLimitError(error) || error?.isRateLimitStatus;

      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        console.warn(
          `[SmartAPI] Rate limit hit for historical data. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`
        );
        await sleep(delay);
        delay *= 2;
        continue;
      }

      if (error?.isRateLimitStatus) {
        throw new Error(`[SmartAPI] Rate limit exceeded: ${error.message}`);
      }

      handleApiError(error, "historical data fetch");
    }
  }
}