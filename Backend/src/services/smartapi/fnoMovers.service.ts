import prisma from "../../config/prisma.js";
import { getFullModeData } from "./api/FullMode.js";
import { getGainersLosersData } from "./api/gainersLosers.js";

export interface FnoMoverItem {
  symbolToken: string;
  tradingSymbol: string;
  name: string;
  instrumentType: "FUT" | "CE" | "PE";
  strike: number | null;
  expiry: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  open?: number | undefined;
  high?: number | undefined;
  low?: number | undefined;
  close?: number | undefined;
  tradeVolume?: number | undefined;
  opnInterest?: number | undefined;
  exchange: string;
}

export interface FnoMoversSummary {
  totalCount: number;
  gainersCount: number;
  losersCount: number;
  callsCount: number;
  putsCount: number;
  futuresCount: number;
  topGainer: FnoMoverItem | null;
  topLoser: FnoMoverItem | null;
  mostVolatile: FnoMoverItem | null;
  marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  lastUpdated: string;
}

export interface FnoMoversResponse {
  summary: FnoMoversSummary;
  all: FnoMoverItem[];
  gainers: FnoMoverItem[];
  losers: FnoMoverItem[];
  calls: FnoMoverItem[];
  puts: FnoMoverItem[];
  futures: FnoMoverItem[];
}

// In-memory cache with 15-second TTL
let cachedData: FnoMoversResponse | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 1000;

/**
 * Helper to parse contract type and strike from symbol.
 */
function parseContractDetails(symbol: string, rawStrike?: string | null | undefined): {
  type: "FUT" | "CE" | "PE";
  strike: number | null;
} {
  const upper = symbol.toUpperCase().trim();
  if (upper.endsWith("CE")) {
    const strike = rawStrike ? parseFloat(rawStrike) / 100 : extractStrikeFromSymbol(upper, "CE");
    return { type: "CE", strike };
  }
  if (upper.endsWith("PE")) {
    const strike = rawStrike ? parseFloat(rawStrike) / 100 : extractStrikeFromSymbol(upper, "PE");
    return { type: "PE", strike };
  }
  return { type: "FUT", strike: null };
}

function extractStrikeFromSymbol(symbol: string, suffix: "CE" | "PE"): number | null {
  const withoutSuffix = symbol.slice(0, -suffix.length);
  const match = withoutSuffix.match(/(\d{4,6})$/);
  return match && match[1] ? parseFloat(match[1]) : null;
}

/**
 * Fetch and assemble top volatile F&O movers across Futures, Call Options, and Put Options.
 */
export async function getTopFnoMovers(forceRefresh = false): Promise<FnoMoversResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedData && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  const itemsMap = new Map<string, FnoMoverItem>();

  // 1. Fetch Top Futures Price Gainers & Losers from SmartAPI marketData
  try {
    const [gainersRes, losersRes] = await Promise.allSettled([
      getGainersLosersData({ datatype: "PercPriceGainers", expirytype: "NEAR" }),
      getGainersLosersData({ datatype: "PercPriceLosers", expirytype: "NEAR" }),
    ]);

    const rawFutures: any[] = [];
    if (gainersRes.status === "fulfilled" && Array.isArray(gainersRes.value.data)) {
      rawFutures.push(...gainersRes.value.data);
    }
    if (losersRes.status === "fulfilled" && Array.isArray(losersRes.value.data)) {
      rawFutures.push(...losersRes.value.data);
    }

    // Deduplicate futures
    for (const item of rawFutures) {
      if (!item.symbolToken && !item.tradingSymbol) continue;
      const symbol = item.tradingSymbol || "";
      const token = String(item.symbolToken || "");
      const { type, strike } = parseContractDetails(symbol);

      // Extract root name (e.g., TECHM from TECHM27OCT26FUT)
      const nameMatch = symbol.match(/^([A-Za-z\-]+?)(?:\d{2}[A-Za-z]{3}\d{2})/);
      const name = nameMatch ? nameMatch[1] : symbol.replace(/FUT$/i, "");

      itemsMap.set(token || symbol, {
        symbolToken: token,
        tradingSymbol: symbol,
        name,
        instrumentType: type,
        strike,
        expiry: "NEAR",
        ltp: typeof item.ltp === "number" ? item.ltp : parseFloat(item.ltp || "0"),
        netChange: typeof item.netChange === "number" ? item.netChange : parseFloat(item.netChange || "0"),
        percentChange: typeof item.percentChange === "number" ? item.percentChange : parseFloat(item.percentChange || "0"),
        open: item.open ? parseFloat(item.open) : undefined,
        high: item.high ? parseFloat(item.high) : undefined,
        low: item.low ? parseFloat(item.low) : undefined,
        close: item.close ? parseFloat(item.close) : undefined,
        tradeVolume: item.tradeVolume ? parseFloat(item.tradeVolume) : undefined,
        opnInterest: item.opnInterest ? parseFloat(item.opnInterest) : undefined,
        exchange: "NFO",
      });
    }
  } catch (err: any) {
    console.warn("[FnoMoversService] Futures gainers/losers fetch failed:", err.message);
  }

  // 2. Query PostgreSQL for active Call (CE) and Put (PE) options across NIFTY, BANKNIFTY, FINNIFTY and Top Stock options
  try {
    // Select near-expiry ATM/near-money options from DB
    // We target active NIFTY (19OCT26/27OCT26), BANKNIFTY (27OCT26), FINNIFTY (20OCT26/27OCT26), and top stock options
    const optionInstruments = await prisma.instrument.findMany({
      where: {
        exch_seg: "NFO",
        instrumenttype: { in: ["OPTIDX", "OPTSTK"] },
        OR: [
          // NIFTY active strikes
          {
            name: "NIFTY",
            expiry: { in: ["19OCT2026", "27OCT2026"] },
            strike: { in: ["2280000.000000", "2290000.000000", "2300000.000000", "2305000.000000", "2310000.000000", "2315000.000000", "2320000.000000", "2325000.000000", "2330000.000000", "2335000.000000", "2340000.000000", "2350000.000000"] },
          },
          // BANKNIFTY active strikes
          {
            name: "BANKNIFTY",
            expiry: { in: ["27OCT2026"] },
            strike: { in: ["5150000.000000", "5180000.000000", "5200000.000000", "5220000.000000", "5250000.000000", "5280000.000000", "5300000.000000", "5320000.000000"] },
          },
          // FINNIFTY active strikes
          {
            name: "FINNIFTY",
            expiry: { in: ["20OCT2026", "27OCT2026"] },
            strike: { in: ["2300000.000000", "2310000.000000", "2320000.000000", "2330000.000000", "2340000.000000", "2350000.000000"] },
          },
        ],
      },
      take: 45,
    });

    if (optionInstruments.length > 0) {
      const tokens = optionInstruments.map((inst) => inst.token);
      
      // Fetch FullMode live quotes for these options in a single API call
      try {
        const fullModeRes = await getFullModeData({
          mode: "FULL",
          exchangeTokens: { NFO: tokens },
        });

        const fetched = fullModeRes.data?.fetched || [];
        for (const item of fetched) {
          const instMeta = optionInstruments.find((i) => i.token === item.symbolToken);
          const symbol = item.tradingSymbol || instMeta?.symbol || "";
          const token = String(item.symbolToken);
          const rawStrike = instMeta?.strike;
          const { type, strike } = parseContractDetails(symbol, rawStrike);
          const name = instMeta?.name || (symbol.startsWith("BANKNIFTY") ? "BANKNIFTY" : symbol.startsWith("FINNIFTY") ? "FINNIFTY" : "NIFTY");

          itemsMap.set(token, {
            symbolToken: token,
            tradingSymbol: symbol,
            name,
            instrumentType: type,
            strike: strike ?? (instMeta?.strike ? parseFloat(instMeta.strike) / 100 : null),
            expiry: instMeta?.expiry || "NEAR",
            ltp: item.ltp || 0,
            netChange: item.netChange || 0,
            percentChange: item.percentChange || 0,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            tradeVolume: item.tradeVolume,
            opnInterest: item.opnInterest,
            exchange: "NFO",
          });
        }
      } catch (quoteErr: any) {
        console.warn("[FnoMoversService] FullMode option quotes fetch failed:", quoteErr.message);
      }
    }
  } catch (dbErr: any) {
    console.warn("[FnoMoversService] DB option instruments query failed:", dbErr.message);
  }

  const allItems = Array.from(itemsMap.values()).filter((item) => item.ltp > 0 || item.tradeVolume);

  // Sort by highest absolute percentage swing (Top Volatile)
  const allVolatile = [...allItems].sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
  );

  // Top Gainers (Ups)
  const gainers = allItems
    .filter((x) => x.percentChange > 0)
    .sort((a, b) => b.percentChange - a.percentChange);

  // Top Losers (Downs)
  const losers = allItems
    .filter((x) => x.percentChange < 0)
    .sort((a, b) => a.percentChange - b.percentChange);

  // Call Options (CE)
  const calls = allItems
    .filter((x) => x.instrumentType === "CE")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  // Put Options (PE)
  const puts = allItems
    .filter((x) => x.instrumentType === "PE")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  // Futures (FUT)
  const futures = allItems
    .filter((x) => x.instrumentType === "FUT")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  // Summary Metrics
  const gainersCount = gainers.length;
  const losersCount = losers.length;
  const topGainer = gainers[0] || null;
  const topLoser = losers[0] || null;
  const mostVolatile = allVolatile[0] || null;

  let marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (gainersCount > losersCount * 1.3) marketSentiment = "BULLISH";
  else if (losersCount > gainersCount * 1.3) marketSentiment = "BEARISH";

  const result: FnoMoversResponse = {
    summary: {
      totalCount: allItems.length,
      gainersCount,
      losersCount,
      callsCount: calls.length,
      putsCount: puts.length,
      futuresCount: futures.length,
      topGainer,
      topLoser,
      mostVolatile,
      marketSentiment,
      lastUpdated: new Date().toISOString(),
    },
    all: allVolatile,
    gainers,
    losers,
    calls,
    puts,
    futures,
  };

  cachedData = result;
  lastCacheTime = now;

  return result;
}
