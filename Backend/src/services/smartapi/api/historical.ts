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
import { executeSmartApiRequest } from "../rateLimiter.js";

/**
 * Fetch historical candle data.
 * Requires a valid JWT token.
 * Uses central rate limiter queue.
 * 
 * @param request The parameters for fetching historical data.
 */
export async function getCandleData(request: HistoricalDataRequest): Promise<CandleData[]> {
  const payload = {
    exchange: request.exchange,
    symboltoken: request.symboltoken || request.symbolToken || "",
    interval: request.interval,
    fromdate: request.fromdate || request.fromDate || "",
    todate: request.todate || request.toDate || "",
  };

  return executeSmartApiRequest(async () => {
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
      }>(url, payload, { headers });

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
          : message || `Historical data fetch failed`;
        console.warn(`[SmartAPI] Historical data fetch failed details: ${errMsg}`);
        return [];
      }

      return data;
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
      handleApiError(error, "historical data fetch");
    }
  }, `historical_${request.symboltoken}`);
}
