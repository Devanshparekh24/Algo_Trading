import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import { handleApiError } from "./errorHandler.js";
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

// In-Memory Cache for Gainers / Losers (5s TTL)
interface CachedGainersLosers {
  data: GainersLosersResponse;
  timestamp: number;
}
const cache = new Map<string, CachedGainersLosers>();
const CACHE_TTL_MS = 5000;

export async function getGainersLosersData(
  request: GainersLosersRequest
): Promise<GainersLosersResponse> {
  const cacheKey = `${request.datatype}_${request.expirytype}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  return executeSmartApiRequest(async () => {
    const cachedAgain = cache.get(cacheKey);
    if (cachedAgain && Date.now() - cachedAgain.timestamp < CACHE_TTL_MS) {
      return cachedAgain.data;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/marketData/v1/gainersLosers`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.post<GainersLosersResponse>(url, request, { headers });
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
      if (error?.isRateLimitStatus) {
        throw error;
      }
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, "gainers/losers fetch");
    }
  }, `gainersLosers_${cacheKey}`);
}
