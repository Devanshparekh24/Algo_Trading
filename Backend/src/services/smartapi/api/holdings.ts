// ---------------------------------------------------------------------------
// SmartAPI – Holdings Endpoint (Enriched with Live Real Market Data)
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Holding, TotalHolding, HoldingsPayload } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { getFullModeData } from "./FullMode.js";

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
    const ltp = Number(h.ltp || 0);
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
 */
export async function getHoldings(): Promise<HoldingsPayload> {
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
    }>(url, { headers });

    if (response.data && response.data.status) {
      rawData = response.data.data;
      console.log("[SmartAPI] Successfully fetched from getAllHolding.");
    }
  } catch (err: any) {
    console.warn(`[SmartAPI] getAllHolding failed (${err?.message || err}), falling back to getHolding...`);
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
      }>(fallbackUrl, { headers });

      const { status, message, data, errorcode } = fallbackRes.data;

      if (!status) {
        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to fetch holdings`;
        console.error(`[SmartAPI] Holding fetch failed details:`, fallbackRes.data);
        throw new Error(errMsg);
      }

      rawData = data;
      console.log("[SmartAPI] Holdings fetched successfully via getHolding fallback.");
    } catch (error) {
      handleApiError(error, "holdings fetch");
    }
  }

  // 3. Normalize into standard Holdings list
  let holdings: Holding[] = [];
  if (Array.isArray(rawData)) {
    holdings = rawData;
  } else if (Array.isArray(rawData?.holdings)) {
    holdings = rawData.holdings;
  }

  // 4. Enrich with REAL LIVE MARKET DATA from Angel One Quote API
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
      }

      for (const h of holdings) {
        const quote = quoteMap.get(`${h.exchange || "NSE"}:${h.symboltoken}`);
        if (quote && quote.ltp) {
          const freshLtp = Number(quote.ltp);
          const closePrice = Number(quote.close || freshLtp);
          const qty = Number(h.quantity || 0);
          const avgPrice = Number(h.averageprice || 0);

          h.ltp = freshLtp;
          h.close = closePrice;
          h.profitandloss = Number(((freshLtp - avgPrice) * qty).toFixed(2));
          h.pnlpercentage = avgPrice > 0 ? Number((((freshLtp - avgPrice) / avgPrice) * 100).toFixed(2)) : 0;
        }
      }
      console.log(`[SmartAPI] Enriched ${holdings.length} holdings with Angel One live market quotes.`);
    }
  } catch (err: any) {
    console.warn("[SmartAPI] Could not enrich holdings with live quote:", err?.message || err);
  }

  const liveTotalHolding = computeTotalHolding(holdings);

  return {
    holdings,
    totalholding: liveTotalHolding,
  };
}
