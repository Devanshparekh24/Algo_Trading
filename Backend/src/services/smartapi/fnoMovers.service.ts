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

// In-memory cache with 45-second TTL & single-flight deduplication
let cachedData: FnoMoversResponse | null = null;
let lastCacheTime = 0;
let inFlightPromise: Promise<FnoMoversResponse> | null = null;
const CACHE_TTL_MS = 45 * 1000;

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

  // Deduplicate concurrent in-flight scans
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      console.log("[FnoMoversService] Starting getTopFnoMovers scan...");
      const itemsMap = new Map<string, FnoMoverItem>();

  // 1. Fetch Top Futures Price Gainers & Losers from SmartAPI marketData
  try {
    console.log("[FnoMoversService] Step 1: Fetching Futures Gainers...");
    const gainersRes = await getGainersLosersData({ datatype: "PercPriceGainers", expirytype: "NEAR" }).catch((e) => {
      console.warn("[FnoMoversService] Gainers error:", e?.message || e);
      return null;
    });
    console.log("[FnoMoversService] Step 2: Fetching Futures Losers...");
    const losersRes = await getGainersLosersData({ datatype: "PercPriceLosers", expirytype: "NEAR" }).catch((e) => {
      console.warn("[FnoMoversService] Losers error:", e?.message || e);
      return null;
    });

    const rawFutures: any[] = [];
    if (gainersRes && gainersRes.status && Array.isArray(gainersRes.data)) {
      rawFutures.push(...gainersRes.data);
    }
    if (losersRes && losersRes.status && Array.isArray(losersRes.data)) {
      rawFutures.push(...losersRes.data);
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

  // 2. Query PostgreSQL for active Call (CE) and Put (PE) options across NIFTY and BANKNIFTY
  try {
    console.log("[FnoMoversService] Step 3: Querying DB for near-expiry options...");
    const optionInstruments = await prisma.instrument.findMany({
      where: {
        exch_seg: "NFO",
        instrumenttype: "OPTIDX",
        name: { in: ["NIFTY", "BANKNIFTY"] },
      },
      take: 24,
      orderBy: { expiry: "asc" },
    });
    console.log(`[FnoMoversService] Step 3 complete: Found ${optionInstruments.length} options in DB.`);

    if (optionInstruments.length > 0) {
      const tokens = optionInstruments.map((inst) => inst.token);
      
      // Fetch FullMode live quotes for these options in a single API call
      try {
        console.log(`[FnoMoversService] Step 4: Fetching FullMode quotes for ${tokens.length} option tokens...`);
        const fullModeRes = await getFullModeData({
          mode: "FULL",
          exchangeTokens: { NFO: tokens },
        });
        console.log(`[FnoMoversService] Step 4 complete: FullMode returned ${fullModeRes.data?.fetched?.length || 0} quotes.`);

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

  if (allItems.length === 0 && cachedData && cachedData.all.length > 0) {
    return cachedData;
  }

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
      lastCacheTime = Date.now();

      return result;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Return all active tokens currently tracked in F&O Movers
 */
export function getKnownFnoMoverTokens(): Array<{ token: string; exchange: string; symbol: string }> {
  if (!cachedData || !Array.isArray(cachedData.all)) return [];
  return cachedData.all
    .filter((item) => item.symbolToken)
    .map((item) => ({
      token: item.symbolToken,
      exchange: item.exchange || "NFO",
      symbol: item.tradingSymbol,
    }));
}

/**
 * Live tick update for F&O Movers: updates LTP, Change, % Change, Volume, High, Low
 * in memory without waiting for full scan reload.
 */
export function updateFnoMoverQuoteInCache(
  tokenOrSymbol: string,
  freshLtp: number,
  change?: number,
  percentChange?: number,
  high?: number,
  low?: number,
  volume?: number
): FnoMoverItem | null {
  if (!cachedData || !Array.isArray(cachedData.all)) return null;

  const item = cachedData.all.find(
    (x) =>
      x.symbolToken === tokenOrSymbol ||
      x.tradingSymbol.toUpperCase() === tokenOrSymbol.toUpperCase()
  );

  if (!item) return null;

  item.ltp = freshLtp;
  if (change !== undefined) item.netChange = change;
  if (percentChange !== undefined) item.percentChange = percentChange;
  if (high !== undefined && (item.high === undefined || high > item.high)) item.high = high;
  if (low !== undefined && (item.low === undefined || low < item.low)) item.low = low;
  if (volume !== undefined) item.tradeVolume = volume;

  // Re-sort / re-rank in cachedData
  recomputeFnoMoversSummary();
  return item;
}

function recomputeFnoMoversSummary(): void {
  if (!cachedData) return;
  const allItems = cachedData.all;

  // Sort by highest absolute percentage swing (Top Volatile)
  const allVolatile = [...allItems].sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
  );

  const gainers = allItems
    .filter((x) => x.percentChange > 0)
    .sort((a, b) => b.percentChange - a.percentChange);

  const losers = allItems
    .filter((x) => x.percentChange < 0)
    .sort((a, b) => a.percentChange - b.percentChange);

  const calls = allItems
    .filter((x) => x.instrumentType === "CE")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  const puts = allItems
    .filter((x) => x.instrumentType === "PE")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  const futures = allItems
    .filter((x) => x.instrumentType === "FUT")
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  const gainersCount = gainers.length;
  const losersCount = losers.length;

  let marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (gainersCount > losersCount * 1.3) marketSentiment = "BULLISH";
  else if (losersCount > gainersCount * 1.3) marketSentiment = "BEARISH";

  cachedData.all = allVolatile;
  cachedData.gainers = gainers;
  cachedData.losers = losers;
  cachedData.calls = calls;
  cachedData.puts = puts;
  cachedData.futures = futures;

  cachedData.summary = {
    totalCount: allItems.length,
    gainersCount,
    losersCount,
    callsCount: calls.length,
    putsCount: puts.length,
    futuresCount: futures.length,
    topGainer: gainers[0] || null,
    topLoser: losers[0] || null,
    mostVolatile: allVolatile[0] || null,
    marketSentiment,
    lastUpdated: new Date().toISOString(),
  };
}
