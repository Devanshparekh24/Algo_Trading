// ---------------------------------------------------------------------------
// Option Chain Matrix Service (SmartAPI Derivatives & Greeks Engine)
// ---------------------------------------------------------------------------

import prisma from "../../config/prisma.js";
import { getFullModeData } from "./api/FullMode.js";
import { calculateOptionGreeks, parseExpiryToDte, type OptionGreeks } from "./greeks.service.js";
import { registerWatchedToken } from "../websocket/socketService.js";
import { getInstrumentLotSize } from "./instrument.service.js";

export interface OptionContractDetails {
  symbolToken: string;
  tradingSymbol: string;
  instrumentType: "CE" | "PE";
  strike: number;
  expiry: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  tradeVolume?: number;
  opnInterest?: number;
  greeks?: OptionGreeks;
  isItm: boolean;
}

export interface OptionChainStrikeRow {
  strike: number;
  isAtm: boolean;
  call?: OptionContractDetails | undefined;
  put?: OptionContractDetails | undefined;
}

export interface OptionChainData {
  underlying: string;
  spotPrice: number;
  spotChange: number;
  spotPercentChange: number;
  atmStrike: number;
  selectedExpiry: string;
  availableExpiries: string[];
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
  pcr: number;
  pcrSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  maxPainStrike: number;
  lotSize: number;
  isSynthetic?: boolean;
  dataSource?: "LIVE_EXCHANGE" | "SYNTHETIC_FALLBACK";
  warningMessage?: string;
  lastUpdated: string;
  rows: OptionChainStrikeRow[];
}

// Major Index Metadata (Spot Tokens & Standard Strike Interval)
const UNDERLYING_METADATA: Record<string, { token: string; exchange: string; strikeStep: number; defaultLotSize: number }> = {
  NIFTY: { token: "99926000", exchange: "NSE", strikeStep: 50, defaultLotSize: 65 },
  BANKNIFTY: { token: "99926009", exchange: "NSE", strikeStep: 100, defaultLotSize: 30 },
  FINNIFTY: { token: "99926037", exchange: "NSE", strikeStep: 50, defaultLotSize: 65 },
  MIDCPNIFTY: { token: "99926074", exchange: "NSE", strikeStep: 25, defaultLotSize: 120 },
};

/**
 * Helper to fetch spot price for an underlying symbol (e.g. NIFTY, BANKNIFTY or Equities)
 */
async function getSpotPrice(underlying: string): Promise<{ spotPrice: number; spotChange: number; spotPercentChange: number }> {
  const meta = UNDERLYING_METADATA[underlying.toUpperCase()];
  if (meta) {
    try {
      const quoteRes = await getFullModeData({
        mode: "FULL",
        exchangeTokens: { [meta.exchange]: [meta.token] },
      });
      const quote = quoteRes.data?.fetched?.[0];
      if (quote && quote.ltp && quote.ltp > 0) {
        const ltp = Number(quote.ltp);
        const close = Number(quote.close || ltp);
        const netChange = Number(quote.netChange ?? (ltp - close));
        const percentChange = Number(quote.percentChange ?? (close > 0 ? ((ltp - close) / close) * 100 : 0));
        return {
          spotPrice: Number(ltp.toFixed(2)),
          spotChange: Number(netChange.toFixed(2)),
          spotPercentChange: Number(percentChange.toFixed(2)),
        };
      }
    } catch (err: any) {
      console.warn(`[OptionChain] Failed to fetch spot quote for ${underlying} token ${meta.token}:`, err?.message || err);
    }
  }

  // Fallback default index spot prices if off-market / fetch error
  const fallbacks: Record<string, number> = {
    NIFTY: 24150,
    BANKNIFTY: 51800,
    FINNIFTY: 23900,
    MIDCPNIFTY: 12400,
  };
  const fallbackPrice = fallbacks[underlying.toUpperCase()] || 24000;
  return {
    spotPrice: fallbackPrice,
    spotChange: 0,
    spotPercentChange: 0,
  };
}

/**
 * Generate standard synthetic strike rows if database instruments are unpopulated
 */
function generateFallbackOptionRows(
  underlying: string,
  spotPrice: number,
  expiry: string,
  strikeStep: number,
  strikeCount: number
): { rows: OptionChainStrikeRow[]; atmStrike: number; totalCallOI: number; totalPutOI: number; totalCallVolume: number; totalPutVolume: number; maxPainStrike: number; pcr: number } {
  const atmStrike = Math.round(spotPrice / strikeStep) * strikeStep;
  const startStrike = atmStrike - strikeCount * strikeStep;
  const endStrike = atmStrike + strikeCount * strikeStep;

  const rows: OptionChainStrikeRow[] = [];
  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  const dte = parseExpiryToDte(expiry);

  for (let strike = startStrike; strike <= endStrike; strike += strikeStep) {
    const isAtm = strike === atmStrike;
    const callItm = spotPrice > strike;
    const putItm = spotPrice < strike;

    // Estimate realistic synthetic prices & OI based on distance from ATM
    const dist = (strike - spotPrice) / spotPrice;
    const callIntrinsic = Math.max(0, spotPrice - strike);
    const putIntrinsic = Math.max(0, strike - spotPrice);
    const timeValue = Math.max(15, Math.round(spotPrice * 0.008 * Math.sqrt(Math.max(1, dte))));

    const callLtp = Number((callIntrinsic + (callItm ? timeValue * 0.7 : timeValue * Math.exp(-Math.abs(dist) * 12))).toFixed(2));
    const putLtp = Number((putIntrinsic + (putItm ? timeValue * 0.7 : timeValue * Math.exp(-Math.abs(dist) * 12))).toFixed(2));

    const callOI = Math.round(120000 * Math.exp(-Math.pow(strike - (atmStrike + strikeStep * 2), 2) / (2 * Math.pow(strikeStep * 6, 2))));
    const putOI = Math.round(135000 * Math.exp(-Math.pow(strike - (atmStrike - strikeStep * 2), 2) / (2 * Math.pow(strikeStep * 6, 2))));
    const callVol = Math.round(callOI * 1.8);
    const putVol = Math.round(putOI * 1.7);

    totalCallOI += callOI;
    totalPutOI += putOI;
    totalCallVolume += callVol;
    totalPutVolume += putVol;

    const callGreeks = calculateOptionGreeks({
      spotPrice,
      strikePrice: strike,
      marketPrice: callLtp,
      timeToExpiryDays: dte,
      isCall: true,
    });

    const putGreeks = calculateOptionGreeks({
      spotPrice,
      strikePrice: strike,
      marketPrice: putLtp,
      timeToExpiryDays: dte,
      isCall: false,
    });

    rows.push({
      strike,
      isAtm,
      call: {
        symbolToken: `SIM_CE_${strike}`,
        tradingSymbol: `${underlying}${expiry}${strike}CE`,
        instrumentType: "CE",
        strike,
        expiry,
        ltp: callLtp,
        netChange: Number((callLtp * 0.04).toFixed(2)),
        percentChange: 4.2,
        tradeVolume: callVol,
        opnInterest: callOI,
        greeks: callGreeks,
        isItm: callItm,
      },
      put: {
        symbolToken: `SIM_PE_${strike}`,
        tradingSymbol: `${underlying}${expiry}${strike}PE`,
        instrumentType: "PE",
        strike,
        expiry,
        ltp: putLtp,
        netChange: Number((-putLtp * 0.035).toFixed(2)),
        percentChange: -3.5,
        tradeVolume: putVol,
        opnInterest: putOI,
        greeks: putGreeks,
        isItm: putItm,
      },
    });
  }

  const pcr = Number((totalPutOI / (totalCallOI || 1)).toFixed(2));
  return {
    rows,
    atmStrike,
    totalCallOI,
    totalPutOI,
    totalCallVolume,
    totalPutVolume,
    maxPainStrike: atmStrike,
    pcr,
  };
}

/**
 * Fetch and construct complete Option Chain Matrix with live quotes and Greeks
 */
export async function getOptionChainData(params: {
  underlying?: string | undefined;
  expiry?: string | undefined;
  strikeCount?: number | undefined;
}): Promise<OptionChainData> {
  const underlying = (params.underlying || "NIFTY").toUpperCase().trim();
  const meta = UNDERLYING_METADATA[underlying] || {
    token: "0",
    exchange: "NSE",
    strikeStep: 50,
    defaultLotSize: 50,
  };
  const strikeCount = Math.max(5, Math.min(25, Number(params.strikeCount) || 12));

  // 1. Fetch current spot price
  const spotInfo = await getSpotPrice(underlying);
  const spotPrice = spotInfo.spotPrice;
  const atmStrike = Math.round(spotPrice / meta.strikeStep) * meta.strikeStep;

  // 2. Query available instruments for this underlying in PostgreSQL
  let dbInstruments: any[] = [];
  try {
    dbInstruments = await prisma.instrument.findMany({
      where: {
        name: { equals: underlying, mode: "insensitive" },
        exch_seg: "NFO",
        instrumenttype: { in: ["OPTIDX", "OPTSTK"] },
      },
      select: {
        token: true,
        symbol: true,
        name: true,
        expiry: true,
        strike: true,
        lotsize: true,
        instrumenttype: true,
      },
    });
  } catch (err: any) {
    console.warn(`[OptionChain] DB lookup warning for ${underlying}:`, err?.message || err);
    dbInstruments = [];
  }

  // 3. Determine available expiries
  const rawExpiries = Array.from(new Set(dbInstruments.map((i) => i.expiry).filter(Boolean)));
  // Sort expiries chronologically
  const sortedExpiries = rawExpiries.sort((a, b) => parseExpiryToDte(a) - parseExpiryToDte(b));

  // Fallback standard expiries if DB is empty
  const availableExpiries = sortedExpiries.length > 0
    ? sortedExpiries
    : ["12NOV2026", "19NOV2026", "26NOV2026", "31DEC2026"];

  const selectedExpiry = params.expiry && availableExpiries.includes(params.expiry)
    ? params.expiry
    : availableExpiries[0] || "NEAR";

  const dbLot = dbInstruments[0]?.lotsize ? parseInt(dbInstruments[0].lotsize, 10) : NaN;
  const lotSize = !isNaN(dbLot) && dbLot > 0 ? dbLot : await getInstrumentLotSize(underlying, meta.defaultLotSize);

  // If no DB instruments available for this expiry, provide realistic synthetic grid
  const contractsForExpiry = dbInstruments.filter((i) => i.expiry === selectedExpiry);
  if (contractsForExpiry.length === 0) {
    const fallback = generateFallbackOptionRows(
      underlying,
      spotPrice,
      selectedExpiry,
      meta.strikeStep,
      strikeCount
    );

    return {
      underlying,
      spotPrice,
      spotChange: spotInfo.spotChange,
      spotPercentChange: spotInfo.spotPercentChange,
      atmStrike,
      selectedExpiry,
      availableExpiries,
      totalCallOI: fallback.totalCallOI,
      totalPutOI: fallback.totalPutOI,
      totalCallVolume: fallback.totalCallVolume,
      totalPutVolume: fallback.totalPutVolume,
      pcr: fallback.pcr,
      pcrSentiment: fallback.pcr >= 1.2 ? "BULLISH" : fallback.pcr <= 0.8 ? "BEARISH" : "NEUTRAL",
      maxPainStrike: fallback.maxPainStrike,
      lotSize,
      isSynthetic: true,
      dataSource: "SYNTHETIC_FALLBACK",
      warningMessage: "SIMULATED DATA: No active market contracts found in database for this expiry. Do NOT place real trades based on this simulated chain.",
      lastUpdated: new Date().toISOString(),
      rows: fallback.rows,
    };
  }

  // 4. Map DB contracts by parsed strike
  const strikeMap = new Map<number, { call?: any; put?: any }>();
  for (const inst of contractsForExpiry) {
    const rawStrike = parseFloat(inst.strike);
    if (isNaN(rawStrike)) continue;
    const strike = rawStrike > 100000 ? rawStrike / 100 : rawStrike;
    const entry = strikeMap.get(strike) || {};

    if (inst.symbol.endsWith("CE")) {
      entry.call = inst;
    } else if (inst.symbol.endsWith("PE")) {
      entry.put = inst;
    }
    strikeMap.set(strike, entry);
  }

  // 5. Select strikes bounded around ATM strike
  const allStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);
  const atmIndex = allStrikes.reduce(
    (closestIdx, currStrike, idx) =>
      Math.abs(currStrike - atmStrike) < Math.abs((allStrikes[closestIdx] ?? 0) - atmStrike) ? idx : closestIdx,
    0
  );

  const startIdx = Math.max(0, atmIndex - strikeCount);
  const endIdx = Math.min(allStrikes.length - 1, atmIndex + strikeCount);
  const selectedStrikes = allStrikes.slice(startIdx, endIdx + 1);

  // 6. Collect tokens to fetch live quotes
  const tokensToFetch: string[] = [];
  for (const strike of selectedStrikes) {
    const pair = strikeMap.get(strike);
    if (pair?.call?.token) tokensToFetch.push(pair.call.token);
    if (pair?.put?.token) tokensToFetch.push(pair.put.token);
  }

  // Register tokens for WebSocket streaming
  for (const tok of tokensToFetch) {
    registerWatchedToken(tok, "NFO");
  }

  // 7. Fetch live quotes for selected option tokens
  let quoteMap = new Map<string, any>();
  try {
    if (tokensToFetch.length > 0) {
      const quotesRes = await getFullModeData({
        mode: "FULL",
        exchangeTokens: { NFO: tokensToFetch },
        bypassCache: true,
      });
      const fetched = quotesRes.data?.fetched || [];
      for (const q of fetched) {
        quoteMap.set(String(q.symbolToken), q);
      }
    }
  } catch (err: any) {
    console.warn("[OptionChain] Failed to fetch quotes for option contracts:", err?.message || err);
  }

  // 8. Assemble rows and calculate Greeks
  const rows: OptionChainStrikeRow[] = [];
  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  const dte = parseExpiryToDte(selectedExpiry);

  for (const strike of selectedStrikes) {
    const pair = strikeMap.get(strike);
    const isAtm = strike === atmStrike;
    const callItm = spotPrice > strike;
    const putItm = spotPrice < strike;

    let callDetails: OptionContractDetails | undefined = undefined;
    if (pair?.call) {
      const q = quoteMap.get(String(pair.call.token));
      const ltp = Number(q?.ltp || 0);
      const close = Number(q?.close || ltp);
      const netChange = Number(q?.netChange ?? (ltp - close));
      const pct = close > 0 ? ((ltp - close) / close) * 100 : 0;
      const vol = Number(q?.tradeVolume || 0);
      const oi = Number(q?.opnInterest || 0);

      totalCallOI += oi;
      totalCallVolume += vol;

      const greeks = calculateOptionGreeks({
        spotPrice,
        strikePrice: strike,
        marketPrice: Math.max(0.05, ltp),
        timeToExpiryDays: dte,
        isCall: true,
      });

      callDetails = {
        symbolToken: pair.call.token,
        tradingSymbol: pair.call.symbol,
        instrumentType: "CE",
        strike,
        expiry: selectedExpiry,
        ltp,
        netChange: Number(netChange.toFixed(2)),
        percentChange: Number((q?.percentChange ?? pct).toFixed(2)),
        open: Number(q?.open || 0),
        high: Number(q?.high || 0),
        low: Number(q?.low || 0),
        close,
        tradeVolume: vol,
        opnInterest: oi,
        greeks,
        isItm: callItm,
      };
    }

    let putDetails: OptionContractDetails | undefined = undefined;
    if (pair?.put) {
      const q = quoteMap.get(String(pair.put.token));
      const ltp = Number(q?.ltp || 0);
      const close = Number(q?.close || ltp);
      const netChange = Number(q?.netChange ?? (ltp - close));
      const pct = close > 0 ? ((ltp - close) / close) * 100 : 0;
      const vol = Number(q?.tradeVolume || 0);
      const oi = Number(q?.opnInterest || 0);

      totalPutOI += oi;
      totalPutVolume += vol;

      const greeks = calculateOptionGreeks({
        spotPrice,
        strikePrice: strike,
        marketPrice: Math.max(0.05, ltp),
        timeToExpiryDays: dte,
        isCall: false,
      });

      putDetails = {
        symbolToken: pair.put.token,
        tradingSymbol: pair.put.symbol,
        instrumentType: "PE",
        strike,
        expiry: selectedExpiry,
        ltp,
        netChange: Number(netChange.toFixed(2)),
        percentChange: Number((q?.percentChange ?? pct).toFixed(2)),
        open: Number(q?.open || 0),
        high: Number(q?.high || 0),
        low: Number(q?.low || 0),
        close,
        tradeVolume: vol,
        opnInterest: oi,
        greeks,
        isItm: putItm,
      };
    }

    rows.push({
      strike,
      isAtm,
      call: callDetails,
      put: putDetails,
    });
  }

  // 9. Compute Max Pain Strike
  let minTotalPain = Infinity;
  let maxPainStrike = atmStrike;
  for (const s of selectedStrikes) {
    let totalPain = 0;
    for (const r of rows) {
      // Call intrinsic loss if underlying finishes at s
      if (s > r.strike && r.call?.opnInterest) {
        totalPain += (s - r.strike) * r.call.opnInterest;
      }
      // Put intrinsic loss if underlying finishes at s
      if (s < r.strike && r.put?.opnInterest) {
        totalPain += (r.strike - s) * r.put.opnInterest;
      }
    }
    if (totalPain < minTotalPain) {
      minTotalPain = totalPain;
      maxPainStrike = s;
    }
  }

  const pcr = Number((totalPutOI / (totalCallOI || 1)).toFixed(2));
  const pcrSentiment = pcr >= 1.2 ? "BULLISH" : pcr <= 0.8 ? "BEARISH" : "NEUTRAL";

  return {
    underlying,
    spotPrice,
    spotChange: spotInfo.spotChange,
    spotPercentChange: spotInfo.spotPercentChange,
    atmStrike,
    selectedExpiry,
    availableExpiries,
    totalCallOI,
    totalPutOI,
    totalCallVolume,
    totalPutVolume,
    pcr,
    pcrSentiment,
    maxPainStrike,
    lotSize,
    isSynthetic: false,
    dataSource: "LIVE_EXCHANGE",
    lastUpdated: new Date().toISOString(),
    rows,
  };
}
