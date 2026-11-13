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

const QUOTE_TTL_MS = 1000; // 1 seconds TTL (keeps quotes ultra fresh without rate limit spikes)
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
 * Helper to split a record of exchange tokens into chunks of max 45 tokens
 * to stay safely within Angel One's 50-token-per-request cap.
 */
function chunkExchangeTokens(
  record: Record<string, string[]>,
  maxPerChunk = 45
): Record<string, string[]>[] {
  const entries: Array<{ exchange: string; token: string }> = [];
  for (const [ex, tokens] of Object.entries(record)) {
    for (const t of tokens) {
      entries.push({ exchange: ex, token: t });
    }
  }

  if (entries.length <= maxPerChunk) {
    return [record];
  }

  const chunks: Record<string, string[]>[] = [];
  for (let i = 0; i < entries.length; i += maxPerChunk) {
    const slice = entries.slice(i, i + maxPerChunk);
    const chunkRecord: Record<string, string[]> = {};
    for (const item of slice) {
      const list = chunkRecord[item.exchange] ?? [];
      list.push(item.token);
      chunkRecord[item.exchange] = list;
    }
    chunks.push(chunkRecord);
  }
  return chunks;
}

/**
 * Fetch Full Mode / Quote data for scrips.
 * Uses:
 * 1. 4-second TTL In-Memory Cache (prevents duplicate API calls)
 * 2. SmartAPI Central Request Rate Limiter Queue (prevents HTTP 403 access rate errors)
 * 3. Graceful handling for unfetched or expired tokens
 * 4. Automatic request chunking for large watchlists (>45 tokens)
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

  // 1. Check local cache first to avoid unnecessary broker API calls (unless bypassCache is requested)
  if (!request.bypassCache) {
    for (const [exchange, tokens] of Object.entries(exTokens)) {
      for (const t of tokens) {
        totalRequested++;
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

    const cachedCount = Object.values(neededTokens).reduce((sum, arr) => sum + arr.length, 0);
    if (totalRequested > 0 && cachedCount === 0) {
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
  } else {
    for (const [exchange, tokens] of Object.entries(exTokens)) {
      neededTokens[exchange] = [...tokens];
    }
  }

  const neededCount = Object.values(neededTokens).reduce((sum, arr) => sum + arr.length, 0);
  const targetTokens = neededCount > 0 ? neededTokens : exTokens;
  const tokenChunks = chunkExchangeTokens(targetTokens, 45);

  const newlyFetchedAccumulator: FullMode[] = [];
  const unfetchedAccumulator: any[] = [];

  for (const chunk of tokenChunks) {
    const prunedRequest: FullModeRequest = {
      mode: request.mode || "FULL",
      exchangeTokens: chunk,
    };

    const chunkResult = await executeSmartApiRequest(async () => {
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
            data: { fetched: [], unfetched: [] },
          };
        }

        // Populate Cache with newly fetched quotes
        const chunkFetched = data.fetched || [];
        for (const q of chunkFetched) {
          cacheQuote(q);
        }

        // Cache unfetched tokens so we don't repeat calls for dead contracts
        for (const u of data.unfetched || []) {
          if (u.symbolToken) {
            unfetchedTokenCache.set(u.symbolToken, Date.now());
          }
        }

        return {
          status: true,
          message: "SUCCESS",
          errorcode: "",
          data: {
            fetched: chunkFetched,
            unfetched: data.unfetched || [],
          },
        };
      } catch (error: any) {
        // ── Re-throw errors that the rate limiter needs to handle ────────────
        if (error?.isRateLimitStatus) {
          throw error;
        }
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 403 || error.response?.status === 429)
        ) {
          throw error;
        }

        // ── Classify the error ───────────────────────────────────────────────
        const errMsg: string = error?.message || String(error) || "";
        const errCode: string =
          error?.errorCode ||
          error?.response?.data?.errorcode ||
          (typeof errMsg === "string" ? (errMsg.match(/\[([A-Z]{2}\d{4})\]/i)?.[1] ?? "") : "") ||
          "";

        // AB2000 "stream has been aborted" / "Error not specified"  →  transient
        // network blip from Angel One.  Treat as a soft skip so the WebSocket
        // tick loop is NOT crashed.
        const isStreamAbort =
          errCode === "AB2000" ||
          errMsg.toLowerCase().includes("stream has been aborted") ||
          errMsg.toLowerCase().includes("stream aborted") ||
          errMsg.toLowerCase().includes("econnreset") ||
          errMsg.toLowerCase().includes("econnaborted") ||
          errMsg.toLowerCase().includes("socket hang up") ||
          errMsg.toLowerCase().includes("network error") ||
          error?.code === "ECONNRESET" ||
          error?.code === "ECONNABORTED" ||
          error?.code === "ERR_CANCELED";

        if (isStreamAbort) {
          // Log at debug level only – this is very common during market hours
          console.debug(
            `[FullMode] Transient stream abort (${errCode || error?.code || "unknown"}): ${errMsg.substring(0, 120)} – returning cached/empty quotes`
          );
          return {
            status: false,
            message: errMsg,
            errorcode: errCode || "AB2000",
            data: { fetched: [], unfetched: [] },
          };
        }

        // All other unexpected errors: log to DB but do NOT throw so the caller
        // (WebSocket tick loop) stays alive.
        try {
          handleApiError(error, "Full Mode quote fetch");
        } catch {
          // handleApiError re-throws; swallow here to keep the stream alive
        }
        return {
          status: false,
          message: errMsg || "Quote fetch error",
          errorcode: errCode || "",
          data: { fetched: [], unfetched: [] },
        };
      }
    }, "getFullModeData");

    if (chunkResult.data?.fetched) {
      newlyFetchedAccumulator.push(...chunkResult.data.fetched);
    }
    if (chunkResult.data?.unfetched) {
      unfetchedAccumulator.push(...chunkResult.data.unfetched);
    }
  }

  const combinedFetched = [...cachedFetched, ...newlyFetchedAccumulator];

  return {
    status: true,
    message: "SUCCESS",
    errorcode: "",
    data: {
      fetched: combinedFetched,
      unfetched: unfetchedAccumulator,
    },
  };
}
