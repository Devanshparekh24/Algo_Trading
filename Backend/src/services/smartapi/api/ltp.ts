import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { LtpDataRequest, LtpDataResponse } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";
import { getCachedQuote } from "./FullMode.js";

/**
 * Fetch last traded price (LTP) data for a scrip.
 * Checks quote cache first, then dispatches via rate limiter queue.
 *
 * @param request The parameters for fetching LTP data.
 */
export async function getLtpData(
  request: LtpDataRequest
): Promise<LtpDataResponse> {
  const token = request.symboltoken || request.symbolToken || "";
  const symbol = request.tradingsymbol || request.tradingSymbol || "";
  const payload = {
    exchange: request.exchange,
    tradingsymbol: symbol,
    symboltoken: token,
  };

  // Check cached quote first
  const cached =
    getCachedQuote(token) ||
    getCachedQuote(`${request.exchange}_${token}`) ||
    getCachedQuote(symbol);

  if (cached && cached.ltp) {
    return {
      exchange: cached.exchange || request.exchange,
      tradingSymbol: cached.tradingSymbol || symbol,
      symbolToken: cached.symbolToken || token,
      open: cached.open || cached.ltp,
      high: cached.high || cached.ltp,
      low: cached.low || cached.ltp,
      close: cached.close || cached.ltp,
      ltp: cached.ltp,
    };
  }

  return executeSmartApiRequest(async () => {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.post<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: LtpDataResponse;
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
          : message || `LTP data fetch failed`;
        console.warn(`[SmartAPI] LTP fetch warning: ${errMsg}`);
        throw new Error(errMsg);
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
      handleApiError(error, "LTP data fetch");
    }
  }, `ltp_${request.symboltoken}`);
}
