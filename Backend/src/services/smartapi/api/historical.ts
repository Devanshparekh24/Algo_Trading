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
 * Fetch historical candle data.
 * Requires a valid JWT token.
 * 
 * @param request The parameters for fetching historical data.
 */
export async function getCandleData(request: HistoricalDataRequest): Promise<CandleData[]> {
  const jwtToken = await getValidSession();
  const config = getConfig();

  const url = `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`;
  const headers = buildHeaders(config.API_KEY, jwtToken);

  try {
    const response = await axios.post<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: CandleData[];
    }>(url, request, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || `Historical data fetch failed (status: ${status}, response: ${JSON.stringify(response.data)})`;
      console.error(`[SmartAPI] Historical data fetch failed details:`, response.data);
      throw new Error(errMsg);
    }

    console.log(`[SmartAPI] Historical data fetched successfully for token: ${request.symboltoken}`);
    return data;
  } catch (error) {
    handleApiError(error, "historical data fetch");
  }
}