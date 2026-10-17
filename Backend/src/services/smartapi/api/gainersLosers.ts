import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders, isRateLimitError } from "../helpers.js";
import { getValidSession } from "../session.js";
import { handleApiError } from "./errorHandler.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export async function getGainersLosersData(
  request: GainersLosersRequest
): Promise<GainersLosersResponse> {
  const maxRetries = 3;
  let attempt = 0;
  let delay = 500;

  while (true) {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/marketData/v1/gainersLosers`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.post<GainersLosersResponse>(url, request, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status) {
        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || "Gainers/Losers fetch failed";
        console.error("[SmartAPI] Gainers/Losers failed:", response.data);
        throw new Error(errMsg);
      }

      return response.data;
    } catch (error: any) {
      const isRateLimit = isRateLimitError(error);
      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        console.warn(`[SmartAPI] Rate limit hit for gainersLosers. Retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 2;
        continue;
      }
      handleApiError(error, "gainers/losers fetch");
    }
  }
}
