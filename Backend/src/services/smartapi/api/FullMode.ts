import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { FullMode, FullModeRequest, FullModeResponse } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// ===========================================================================
// In-Memory Short-Lived Full Mode Quotes Cache & Deduplication
// ===========================================================================
interface CachedQuote {
  quote: FullMode;
  timestamp: number;
}

const QUOTE_TTL_MS = 4000; // 4 seconds TTL (keeps data live while avoiding rate limit spikes)
const quoteCache = new Map<string, CachedQuote>();
const unfetchedTokenCache = new Map<string, number>(); // Cache unfetched/invalid tokens for 15s to stop hammering

/**
 * Store a quote in cache across multiple index keys (token, symbol, exchange_token)
 */
export function cacheQuote(quote: FullMode): void {
  const entry: CachedQuote = { quote, timestamp: Date.now() };
  if (quote.symbolToken) {
    quoteCache.set(quote.symbolToken, entry);
    if (quote.exchange) {
      quoteCache.set(`${quote.exchange}_${quote.symbolToken}`, entry);
    }
  }
  if (quote.tradingSymbol) {
    quoteCache.set(quote.tradingSymbol.toUpperCase(), entry);
  }
}

/**
 * Retrieve quote from cache if still fresh
 */
export function getCachedQuote(key: string): FullMode | undefined {
  const cleanKey = key.trim().toUpperCase();
  const entry = quoteCache.get(cleanKey);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > QUOTE_TTL_MS) {
    quoteCache.delete(cleanKey);
    return undefined;
  }
  return entry.quote;
}

/**
 * Fetch Full Mode / Quote data for scrips.
 * Uses:
 * 1. 4-second TTL In-Memory Cache (prevents duplicate API calls)
 * 2. SmartAPI Central Request Rate Limiter Queue (prevents HTTP 403 access rate errors)
 * 3. Graceful handling for unfetched or expired tokens
 *
 * @param request The parameters for fetching Full Mode data.
 */
export async function getFullModeData(
  request: FullModeRequest
): Promise<FullModeResponse> {
  const exTokens = request.exchangeTokens || {};
  const cachedFetched: FullMode[] = [];
  const neededTokens: Record<string, string[]> = {};
  let totalRequested = 0;

  // 1. Check local cache first to avoid unnecessary broker API calls
  for (const [exchange, tokens] of Object.entries(exTokens)) {
    for (const t of tokens) {
      totalRequested++;
      // If token recently marked invalid/unfetched, skip hitting broker API
      const unfetchedAt = unfetchedTokenCache.get(t);
      if (unfetchedAt && Date.now() - unfetchedAt < 15000) {
        continue;
      }

      const cached = getCachedQuote(t) || getCachedQuote(`${exchange}_${t}`);
      if (cached) {
        cachedFetched.push(cached);
      } else {
        if (!neededTokens[exchange]) neededTokens[exchange] = [];
        neededTokens[exchange].push(t);
      }
    }
  }

  // If all requested tokens were found in cache, return immediately!
  const neededCount = Object.values(neededTokens).reduce((sum, arr) => sum + arr.length, 0);
  if (totalRequested > 0 && neededCount === 0) {
    return {
      status: true,
      message: "SUCCESS (from live cache)",
      errorcode: "",
      data: {
        fetched: cachedFetched,
        unfetched: [],
      },
    };
  }

  // 2. Dispatch network request through Central Rate Limiter Queue
  const prunedRequest: FullModeRequest = {
    mode: request.mode || "FULL",
    exchangeTokens: neededCount > 0 ? neededTokens : exTokens,
  };

  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    try {
      const response = await axios.post<FullModeResponse>(url, prunedRequest, { headers, timeout: DEFAULT_TIMEOUT_MS });
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
          : message || "Full Mode data fetch failed";
        console.warn(`[SmartAPI] Quote fetch warning: ${errMsg}`);
        return {
          status: false,
          message: errMsg,
          errorcode: errorcode || "",
          data: { fetched: cachedFetched, unfetched: [] },
        };
      }

      // Populate Cache with newly fetched quotes
      const newlyFetched = data.fetched || [];
      for (const q of newlyFetched) {
        cacheQuote(q);
      }

      // Cache unfetched tokens so we don't repeat calls for dead contracts
      for (const u of data.unfetched || []) {
        if (u.symbolToken) {
          unfetchedTokenCache.set(u.symbolToken, Date.now());
        }
      }

      const combinedFetched = [...cachedFetched, ...newlyFetched];

      return {
        status: true,
        message: "SUCCESS",
        errorcode: "",
        data: {
          fetched: combinedFetched,
          unfetched: data.unfetched || [],
        },
      };
    } catch (error: any) {
      if (error?.isRateLimitStatus) {
        throw error; // Let rate limiter queue pause & backoff
      }
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, "Full Mode quote fetch");
      return {
        status: false,
        message: error?.message || "Quote fetch error",
        errorcode: "",
        data: { fetched: cachedFetched, unfetched: [] },
      };
    }
  }, "getFullModeData");
}
