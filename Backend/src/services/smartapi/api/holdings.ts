// ---------------------------------------------------------------------------
// SmartAPI – Holdings Endpoint (Enriched with Live Real Market Data)
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Holding, TotalHolding, HoldingsPayload } from "../types.js";
import { getFullModeData } from "./FullMode.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-Memory Holdings Cache & Fallback Store
let cachedHoldings: HoldingsPayload | null = null;
let lastHoldingsFetchTime = 0;
const HOLDINGS_CACHE_TTL_MS = 30000; // 30s cache for holdings structure (live prices updated via WebSocket ticks)

// Demat shares cache (broker record of stocks owned)
let rawDematHoldings: Holding[] = [];
let lastDematFetchTime = 0;
const DEMAT_CACHE_TTL_MS = 60000; // 60s cache for raw Demat structure

let lastKnownHoldings: HoldingsPayload = {
  holdings: [],
  totalholding: {
    totalholdingvalue: 0,
    totalinvvalue: 0,
    totalprofitandloss: 0,
    totalpnlpercentage: 0,
  },
};

/**
 * Helper to compute totalholding metrics from live stock values
 */
export function computeTotalHolding(holdings: Holding[]): TotalHolding {
  let totalinvvalue = 0;
  let totalholdingvalue = 0;
  let totalprofitandloss = 0;

  for (const h of holdings) {
    const qty = Number(h.quantity || 0);
    const avg = Number(h.averageprice || 0);
    const ltp = Number(h.ltp || avg || 0);
    const pnl = Number(h.profitandloss ?? (ltp - avg) * qty);

    totalinvvalue += avg * qty;
    totalholdingvalue += ltp * qty;
    totalprofitandloss += pnl;
  }

  const totalpnlpercentage =
    totalinvvalue > 0 ? (totalprofitandloss / totalinvvalue) * 100 : 0;

  return {
    totalholdingvalue: Number(totalholdingvalue.toFixed(2)),
    totalinvvalue: Number(totalinvvalue.toFixed(2)),
    totalprofitandloss: Number(totalprofitandloss.toFixed(2)),
    totalpnlpercentage: Number(totalpnlpercentage.toFixed(2)),
  };
}

/**
 * Retrieve currently known holdings from memory
 */
export function getKnownHoldings(): Holding[] {
  if (cachedHoldings && cachedHoldings.holdings.length > 0) {
    return cachedHoldings.holdings;
  }
  if (rawDematHoldings.length > 0) {
    return rawDematHoldings;
  }
  return lastKnownHoldings.holdings;
}

/**
 * Retrieve full cached HoldingsPayload snapshot from memory
 */
export function getKnownHoldingsPayload(): HoldingsPayload {
  if (cachedHoldings && cachedHoldings.holdings.length > 0) {
    return cachedHoldings;
  }
  if (rawDematHoldings.length > 0) {
    const totalholding = computeTotalHolding(rawDematHoldings);
    return { holdings: rawDematHoldings, totalholding };
  }
  return lastKnownHoldings;
}

/**
 * Instantly update a holding's LTP and PnL in memory on incoming WebSocket tick
 */
export function updateHoldingQuoteInCache(
  tokenOrSymbol: string,
  ltp: number,
  close?: number
): HoldingsPayload | null {
  if (!cachedHoldings || !cachedHoldings.holdings || cachedHoldings.holdings.length === 0) {
    return null;
  }

  let updated = false;
  const holdings = cachedHoldings.holdings.map((h) => {
    if (
      h.symboltoken === tokenOrSymbol ||
      h.tradingsymbol?.toUpperCase() === tokenOrSymbol.toUpperCase()
    ) {
      updated = true;
      const qty = Number(h.quantity || 0);
      const avg = Number(h.averageprice || 0);
      const freshClose = close !== undefined ? close : Number(h.close || ltp);
      const freshPnl = (ltp - avg) * qty;
      const freshPnlPct = avg > 0 ? ((ltp - avg) / avg) * 100 : 0;

      return {
        ...h,
        ltp,
        close: freshClose,
        profitandloss: Number(freshPnl.toFixed(2)),
        pnlpercentage: Number(freshPnlPct.toFixed(2)),
      };
    }
    return h;
  });

  if (!updated) return null;

  const totalholding = computeTotalHolding(holdings);
  cachedHoldings = { holdings, totalholding };
  lastKnownHoldings = cachedHoldings;
  lastHoldingsFetchTime = Date.now();
  return cachedHoldings;
}

/**
 * Retrieve the user's current equity holdings and enrich with REAL LIVE market quotes from Angel One.
 * Tries `getAllHolding` (with fallback to `getHolding`), and queries live LTP quotes.
 * Supports forceRefresh to bypass all caches.
 */
export async function getHoldings(forceRefresh = false): Promise<HoldingsPayload> {
  const now = Date.now();
  if (!forceRefresh && cachedHoldings && now - lastHoldingsFetchTime < HOLDINGS_CACHE_TTL_MS) {
    return cachedHoldings;
  }

  return executeSmartApiRequest(async () => {
    if (!forceRefresh && cachedHoldings && Date.now() - lastHoldingsFetchTime < HOLDINGS_CACHE_TTL_MS) {
      return cachedHoldings;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const isDematFresh =
        !forceRefresh &&
        rawDematHoldings.length > 0 &&
        Date.now() - lastDematFetchTime < DEMAT_CACHE_TTL_MS;

      let holdings: Holding[] = [];

      if (isDematFresh) {
        holdings = rawDematHoldings.map((h) => ({ ...h }));
      } else {
        let rawData: any = null;

        // 1. Try modern 'getAllHolding' endpoint first
        try {
          const url = `${BASE_URL}/rest/secure/angelbroking/portfolio/v1/getAllHolding`;
          const response = await axios.get<{
            status: boolean;
            message: string;
            errorcode?: string;
            data?: {
              holdings?: Holding[];
              totalholding?: TotalHolding;
            } | Holding[] | null;
          }>(url, { headers, timeout: 4000 });

          if (response.data && response.data.status && response.data.data) {
            rawData = response.data.data;
            console.log("[SmartAPI] Successfully fetched from getAllHolding.");
          }
        } catch (err: any) {
          if (
            axios.isAxiosError(err) &&
            (err.response?.status === 403 || err.response?.status === 429)
          ) {
            console.warn("[SmartAPI] getAllHolding hit 403 rate limit, falling back...");
          } else {
            console.warn(`[SmartAPI] getAllHolding notice: ${err?.message || err}`);
          }
        }

        // 2. Fallback to 'getHolding' endpoint if needed
        if (!rawData) {
          try {
            const fallbackUrl = `${BASE_URL}/rest/secure/angelbroking/portfolio/v1/getHolding`;
            const fallbackRes = await axios.get<{
              status: boolean;
              message: string;
              errorcode?: string;
              data?: {
                holdings?: Holding[];
                totalholding?: TotalHolding;
              } | Holding[] | null;
            }>(fallbackUrl, { headers, timeout: 4000 });

            const { status, data } = fallbackRes.data;

            if (status && data) {
              rawData = data;
              console.log("[SmartAPI] Holdings fetched successfully via getHolding fallback.");
            }
          } catch (error: any) {
            console.warn(`[SmartAPI] getHolding fallback notice: ${error?.message || error}`);
          }
        }

        // Normalize into standard Holdings list
        if (Array.isArray(rawData)) {
          holdings = rawData;
        } else if (Array.isArray(rawData?.holdings)) {
          holdings = rawData.holdings;
        }

        if (holdings.length > 0) {
          rawDematHoldings = holdings.map((h) => ({ ...h }));
          lastDematFetchTime = Date.now();
        } else if (rawDematHoldings.length > 0) {
          holdings = rawDematHoldings.map((h) => ({ ...h }));
        }
      }

      // If holdings are present, enrich with real-time market quotes (non-blocking race)
      if (holdings.length > 0) {
        const needsQuote = holdings.some((h) => !h.ltp || Number(h.ltp) <= 0);

        if (needsQuote) {
          try {
            const exchangeTokens: Record<string, string[]> = {};
            for (const h of holdings) {
              if (h.symboltoken) {
                const ex = h.exchange || "NSE";
                if (!exchangeTokens[ex]) exchangeTokens[ex] = [];
                exchangeTokens[ex].push(h.symboltoken);
              }
            }

            if (Object.keys(exchangeTokens).length > 0) {
              const quoteTask = getFullModeData({
                mode: "FULL",
                exchangeTokens,
                bypassCache: false,
              });
              const timeoutTask = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
              const liveQuotesRes = await Promise.race([quoteTask, timeoutTask]);

              if (liveQuotesRes && liveQuotesRes.data?.fetched) {
                const fetchedQuotes = liveQuotesRes.data.fetched;
                const quoteMap = new Map<string, typeof fetchedQuotes[0]>();
                for (const q of fetchedQuotes) {
                  quoteMap.set(`${q.exchange}:${q.symbolToken}`, q);
                  quoteMap.set(`${q.symbolToken}`, q);
                  if (q.tradingSymbol) quoteMap.set(q.tradingSymbol.toUpperCase(), q);
                }

                for (const h of holdings) {
                  const quote =
                    quoteMap.get(`${h.exchange || "NSE"}:${h.symboltoken}`) ||
                    quoteMap.get(`${h.symboltoken}`) ||
                    (h.tradingsymbol ? quoteMap.get(h.tradingsymbol.toUpperCase()) : undefined);

                  if (quote && quote.ltp) {
                    h.ltp = quote.ltp;
                    h.close = quote.close;
                    const avg = Number(h.averageprice || 0);
                    const qty = Number(h.quantity || 0);
                    h.profitandloss = Number(((quote.ltp - avg) * qty).toFixed(2));
                    h.pnlpercentage =
                      avg > 0 ? Number((((quote.ltp - avg) / avg) * 100).toFixed(2)) : 0;
                  }
                }
              }
            }
          } catch (err: any) {
            console.warn("[SmartAPI] Live quote enrichment notice for holdings:", err?.message || err);
          }
        }

        const totalholding = computeTotalHolding(holdings);
        const result: HoldingsPayload = { holdings, totalholding };
        cachedHoldings = result;
        lastKnownHoldings = result;
        lastHoldingsFetchTime = Date.now();
        return result;
      }

      // If broker returned 0 holdings, keep previous holdings if non-empty, else return empty payload
      if (lastKnownHoldings.holdings.length > 0) {
        return lastKnownHoldings;
      }

      const emptyResult: HoldingsPayload = {
        holdings: [],
        totalholding: {
          totalholdingvalue: 0,
          totalinvvalue: 0,
          totalprofitandloss: 0,
          totalpnlpercentage: 0,
        },
      };
      cachedHoldings = emptyResult;
      lastHoldingsFetchTime = Date.now();
      return emptyResult;
    } catch (error: any) {
      console.warn(`[SmartAPI] Holdings fetch fallback: ${error?.message || error}`);
      return lastKnownHoldings;
    }
  }, "getHoldings");
}
