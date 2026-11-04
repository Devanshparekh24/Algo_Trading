// ---------------------------------------------------------------------------
// SmartAPI – Positions Endpoint (Enriched with Live Real Market Quotes)
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL, DEFAULT_TIMEOUT_MS } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Position } from "../types.js";
import { executeSmartApiRequest } from "../rateLimiter.js";
import { getFullModeData } from "./FullMode.js";

// In-Memory Positions Cache & Fallback
let cachedPositions: Position[] = [];
let lastPositionsFetchTime = 0;
let hasPositionsFetchedOnce = false;
const POSITIONS_CACHE_TTL_MS = 1500; // 1.5s cache for live positions

/**
 * Retrieve currently known positions from memory
 */
export function getKnownPositions(): Position[] {
  return cachedPositions;
}

/**
 * Instantly update a position's LTP and PnL in memory on incoming WebSocket tick
 */
export function updatePositionQuoteInCache(
  tokenOrSymbol: string,
  ltp: number
): Position[] {
  if (cachedPositions.length === 0) return cachedPositions;

  let updated = false;
  cachedPositions = cachedPositions.map((pos) => {
    if (
      pos.symboltoken === tokenOrSymbol ||
      pos.tradingsymbol?.toUpperCase() === tokenOrSymbol.toUpperCase()
    ) {
      updated = true;
      const netQty = Number(pos.netqty || pos.quantity || 0);
      const avgPrice = Number(pos.averageprice || 0);
      const ltpStr = String(ltp);

      let m2mStr = pos.m2m || "0";
      let pnlStr = pos.pnl || "0";

      if (netQty !== 0 && avgPrice > 0) {
        const m2m = (ltp - avgPrice) * netQty;
        m2mStr = String(Number(m2m.toFixed(2)));
        const realized = Number(pos.realised || (pos as any).realisedpnl || 0);
        pnlStr = String(Number((realized + m2m).toFixed(2)));
      }

      return {
        ...pos,
        ltp: ltpStr,
        lp: ltpStr,
        m2m: m2mStr,
        pnl: pnlStr,
      };
    }
    return pos;
  });

  if (updated) {
    lastPositionsFetchTime = Date.now();
  }

  return cachedPositions;
}

/**
 * Retrieve the user's current open trading positions from Angel One SmartAPI,
 * enriched with REAL LIVE market quotes.
 * Supports forceRefresh to bypass all caches.
 */
export async function getPositions(forceRefresh = false): Promise<Position[]> {
  const now = Date.now();
  if (!forceRefresh && hasPositionsFetchedOnce && now - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
    return cachedPositions;
  }

  return executeSmartApiRequest(async () => {
    if (!forceRefresh && hasPositionsFetchedOnce && Date.now() - lastPositionsFetchTime < POSITIONS_CACHE_TTL_MS) {
      return cachedPositions;
    }

    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: Position[] | null;
      }>(url, { headers, timeout: DEFAULT_TIMEOUT_MS });

      const { status, message, data, errorcode } = response.data;

      if (!status) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("access denied") ||
            message.toLowerCase().includes("ag8001"))
        ) {
          throw { isRateLimitStatus: true, message };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to fetch positions`;
        console.warn(`[SmartAPI] Position fetch warning: ${errMsg}`);
        return cachedPositions;
      }

      let positions: Position[] = data || [];

      // Enrich positions with live market LTP quotes if available
      if (positions.length > 0) {
        try {
          const exchangeTokens: Record<string, string[]> = {};
          for (const pos of positions) {
            if (pos.symboltoken) {
              const ex = pos.exchange || "NSE";
              if (!exchangeTokens[ex]) exchangeTokens[ex] = [];
              if (!exchangeTokens[ex].includes(pos.symboltoken)) {
                exchangeTokens[ex].push(pos.symboltoken);
              }
            }
          }

          if (Object.keys(exchangeTokens).length > 0) {
            const liveQuotesRes = await getFullModeData({
              mode: "FULL",
              exchangeTokens,
              bypassCache: forceRefresh,
            });

            const fetchedQuotes = liveQuotesRes.data?.fetched || [];
            const quoteMap = new Map<string, typeof fetchedQuotes[0]>();
            for (const q of fetchedQuotes) {
              quoteMap.set(`${q.exchange}:${q.symbolToken}`, q);
              quoteMap.set(`${q.symbolToken}`, q);
              if (q.tradingSymbol) quoteMap.set(q.tradingSymbol.toUpperCase(), q);
            }

            positions = positions.map((pos) => {
              const quote =
                quoteMap.get(`${pos.exchange || "NSE"}:${pos.symboltoken}`) ||
                quoteMap.get(`${pos.symboltoken || ""}`) ||
                (pos.tradingsymbol ? quoteMap.get(pos.tradingsymbol.toUpperCase()) : undefined);

              if (quote && quote.ltp) {
                const freshLtp = Number(quote.ltp);
                const ltpStr = String(freshLtp);
                const netQty = Number(pos.netqty || pos.quantity || 0);
                const avgPrice = Number(pos.averageprice || 0);

                let m2mStr = pos.m2m || "0";
                let pnlStr = pos.pnl || "0";

                if (netQty !== 0 && avgPrice > 0) {
                  const m2m = (freshLtp - avgPrice) * netQty;
                  m2mStr = String(Number(m2m.toFixed(2)));
                  const realized = Number(pos.realised || (pos as any).realisedpnl || 0);
                  pnlStr = String(Number((realized + m2m).toFixed(2)));
                }

                return {
                  ...pos,
                  ltp: ltpStr,
                  lp: ltpStr,
                  m2m: m2mStr,
                  pnl: pnlStr,
                };
              }
              return pos;
            });
          }
        } catch (err: any) {
          console.warn("[SmartAPI] Live quote enrichment warning for positions:", err?.message || err);
        }
      }

      cachedPositions = positions;
      lastPositionsFetchTime = Date.now();
      hasPositionsFetchedOnce = true;
      console.log(`[SmartAPI] Positions fetched successfully (${cachedPositions.length} positions).`);
      return cachedPositions;
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
      console.warn(`[SmartAPI] Positions fetch fallback: ${error?.message || error}`);
      return cachedPositions;
    }
  }, "getPositions");
}
