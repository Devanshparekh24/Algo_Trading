import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import { handleApiError, SmartApiException } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

export interface GainersLosersRequest {
  datatype: "PercPriceGainers" | "PercPriceLosers" | "PercOIGainers" | "PercOILosers";
  expirytype: "NEAR" | "NEXT" | "FAR";
}

export interface RawGainerLoserItem {
  tradingSymbol?: string;
  symbolToken?: string;
  percentChange?: number;
  opnInterest?: number;
  netChangeOpnInterest?: number;
  [key: string]: unknown;
}

export interface GainersLosersResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: RawGainerLoserItem[];
}

// In-Memory Cache for Gainers / Losers (120s TTL to prevent rate limit spikes)
interface CachedGainersLosers {
  data: GainersLosersResponse;
  timestamp: number;
}
const cache = new Map<string, CachedGainersLosers>();
const inFlightRequests = new Map<string, Promise<GainersLosersResponse>>();
const CACHE_TTL_MS = 120000;
const GAINERS_LOSERS_TIMEOUT_MS = 6000; // Fast-fail timeout (6s) so auto-pilot scan loop is not blocked

export async function getGainersLosersData(
  request: GainersLosersRequest
): Promise<GainersLosersResponse> {
  const cacheKey = `${request.datatype}_${request.expirytype}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      return await executeSmartApiRequest(async () => {
        const cachedAgain = cache.get(cacheKey);
        if (cachedAgain && Date.now() - cachedAgain.timestamp < CACHE_TTL_MS) {
          return cachedAgain.data;
        }

        try {
          const jwtToken = await getValidSession();
          const config = getConfig();

          const url = `${BASE_URL}/rest/secure/angelbroking/marketData/v1/gainersLosers`;
          const headers = buildHeaders(config.API_KEY, jwtToken);

          const response = await axios.post<GainersLosersResponse>(url, request, {
            headers,
            timeout: GAINERS_LOSERS_TIMEOUT_MS,
          });
          const { status, message, errorcode } = response.data;

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
              : message || "Gainers/Losers fetch failed";
            console.warn("[SmartAPI] Gainers/Losers warning:", errMsg);
            return {
              status: false,
              message: errMsg,
              errorcode: errorcode || "",
              data: [],
            };
          }

          cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
          return response.data;
        } catch (error: any) {
          if (error?.isRateLimitStatus || error instanceof SmartApiException) {
            throw error;
          }
          if (
            axios.isAxiosError(error) &&
            (error.response?.status === 403 || error.response?.status === 429)
          ) {
            throw error;
          }

          // Handle network timeouts and connection resets gracefully without throwing fatal exceptions
          const isTimeoutOrNetwork =
            error?.code === "ECONNABORTED" ||
            error?.code === "ETIMEDOUT" ||
            error?.code === "ENOTFOUND" ||
            error?.code === "ECONNRESET" ||
            error?.message?.toLowerCase().includes("timeout") ||
            error?.message?.toLowerCase().includes("network error");

          if (isTimeoutOrNetwork) {
            console.warn(
              `[SmartAPI] Gainers/Losers notice (${cacheKey}): ${error.message}. Returning fallback data.`
            );
            const fallbackData: GainersLosersResponse = cached
              ? cached.data
              : {
                  status: false,
                  message: `Gainers/Losers non-critical timeout: ${error.message}`,
                  errorcode: "NETWORK_TIMEOUT",
                  data: [],
                };
            // Set 60-second cooldown so subsequent auto-pilot loops do not stall waiting on slow Angel One servers
            cache.set(cacheKey, {
              data: fallbackData,
              timestamp: Date.now() - (CACHE_TTL_MS - 60000),
            });
            return fallbackData;
          }

          handleApiError(error, "gainers/losers fetch");
        }
      }, `gainersLosers_${cacheKey}`);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
