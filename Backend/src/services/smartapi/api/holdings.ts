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
const HOLDINGS_CACHE_TTL_MS = 10000; // 10s cache

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
function computeTotalHolding(holdings: Holding[]): TotalHolding {
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
 * Retrieve the user's current equity holdings and enrich with REAL LIVE market quotes from Angel One.
 * Tries `getAllHolding` (with fallback to `getHolding`), and queries live LTP quotes.
 * Uses rate limiter queue and 10s cache.
 */
export async function getHoldings(): Promise<HoldingsPayload> {
  const now = Date.now();
  if (cachedHoldings && now - lastHoldingsFetchTime < HOLDINGS_CACHE_TTL_MS) {
    return cachedHoldings;
  }

  return executeSmartApiRequest(async () => {
    if (cachedHoldings && Date.now() - lastHoldingsFetchTime < HOLDINGS_CACHE_TTL_MS) {
      return cachedHoldings;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();
      const headers = buildHeaders(config.API_KEY, jwtToken);

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
        }>(url, { headers, timeout: DEFAULT_TIMEOUT_MS });

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
          }>(fallbackUrl, { headers, timeout: DEFAULT_TIMEOUT_MS });

          const { status, data } = fallbackRes.data;

          if (status && data) {
            rawData = data;
            console.log("[SmartAPI] Holdings fetched successfully via getHolding fallback.");
          }
        } catch (error: any) {
          console.warn(`[SmartAPI] getHolding fallback notice: ${error?.message || error}`);
        }
      }

      // 3. Normalize into standard Holdings list
      let holdings: Holding[] = [];
      if (Array.isArray(rawData)) {
        holdings = rawData;
      } else if (Array.isArray(rawData?.holdings)) {
        holdings = rawData.holdings;
      }

      // If holdings are present, enrich with real-time market data
      if (holdings.length > 0) {
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
            const liveQuotesRes = await getFullModeData({
              mode: "FULL",
              exchangeTokens,
            });

            const fetchedQuotes = liveQuotesRes.data?.fetched || [];
            const quoteMap = new Map<string, typeof fetchedQuotes[0]>();
            for (const q of fetchedQuotes) {
              quoteMap.set(`${q.exchange}:${q.symbolToken}`, q);
              quoteMap.set(`${q.symbolToken}`, q);
            }

            for (const h of holdings) {
              const quote =
                quoteMap.get(`${h.exchange || "NSE"}:${h.symboltoken}`) ||
                quoteMap.get(`${h.symboltoken}`);
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
        } catch (err: any) {
          console.warn("[SmartAPI] Live quote enrichment warning for holdings:", err?.message || err);
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
