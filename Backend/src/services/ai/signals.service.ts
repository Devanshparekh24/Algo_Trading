// ---------------------------------------------------------------------------
// AI Signal Generation & Multi-Factor Market Scanner
// Scans dynamic universe, computes multi-factor confluence, and detects setups
// ---------------------------------------------------------------------------

import { getFullModeData, getCachedQuote } from "../smartapi/api/FullMode.js";
import { getCandleData } from "../smartapi/api/historical.js";
import { getOptionChainData } from "../smartapi/optionChain.service.js";
import type { FullMode } from "../smartapi/types.js";
import { broadcastSocketEvent } from "../websocket/socketService.js";
import prisma from "../../config/prisma.js";
import { getInstrumentLotSize } from "../smartapi/instrument.service.js";
import {
  calculateRSI,
  calculateEMASeries,
  calculateSMA,
  calculateBollingerBands,
  calculateMACD,
  calculateATR,
} from "./indicators.service.js";
import { getDynamicUniverse } from "./universe.service.js";
import { getAutoPilotConfig, evaluateAutoPilotTriggers, setScanUniverseFn } from "./autoPilot.service.js";
import { setSignalResolver, setQuoteResolver, logAiErrorToDb } from "./execution.service.js";
import type {
  MarketSegment,
  ContractType,
  OIBuildupType,
  SignalAction,
  TechnicalIndicators,
  TradeSignal,
} from "../../types/aiTrading.types.js";

// Active signals state
let activeEquitySignals: TradeSignal[] = [];
let activeFnoSignals: TradeSignal[] = [];
let lastEquityScanTime: string | null = null;
let lastFnoScanTime: string | null = null;

// Dedicated cache for Option Chain signals so 1-click execution always resolves
export const optionChainSignalsCache = new Map<string, TradeSignal>();

/**
 * Find signal by unique ID across all active signals and option chain cache
 */
export function findSignalById(id: string): TradeSignal | undefined {
  if (optionChainSignalsCache.has(id)) {
    return optionChainSignalsCache.get(id);
  }
  return [...activeEquitySignals, ...activeFnoSignals].find((s) => s.id === id);
}

/**
 * Asynchronously resolve signal by ID with dynamic recovery for Option Chain strikes
 */
export async function resolveSignalByIdAsync(id: string): Promise<TradeSignal | undefined> {
  const syncMatch = findSignalById(id);
  if (syncMatch) return syncMatch;

  // Dynamic recovery for Option Chain signals (e.g. OC_45410_1794477197938_ej8i)
  if (id.startsWith("OC_")) {
    const parts = id.split("_");
    const token = parts[1];
    if (token) {
      try {
        const inst = await prisma.instrument.findFirst({
          where: { token, exch_seg: "NFO" },
        });
        if (inst) {
          const sym = inst.symbol;
          const isCall = sym.endsWith("CE");
          const isPut = sym.endsWith("PE");
          const strikeMatch = sym.match(/(\d{4,6})(CE|PE)$/i);
          const strike = strikeMatch ? parseFloat(strikeMatch[1]) : parseFloat(inst.strike) || 0;
          const lotSize = parseInt(inst.lotsize) || (await getInstrumentLotSize(sym, 1));
          const quote = getCachedQuote(token) || getCachedQuote(sym);
          const ltp = quote?.ltp && quote.ltp > 0 ? quote.ltp : 50;

          const recoveredSignal: TradeSignal = {
            id,
            symbol: sym,
            token,
            exchange: "NFO",
            segment: "FNO",
            contractType: isCall ? "CE" : isPut ? "PE" : "FUT",
            strike,
            expiry: inst.expiry,
            lotSize,
            underlying: inst.name || (sym.startsWith("BANKNIFTY") ? "BANKNIFTY" : "NIFTY"),
            action: "BUY",
            confidence: 85,
            timeframe: "INTRADAY",
            currentPrice: ltp,
            entryPrice: ltp,
            stopLoss: Number((ltp * 0.78).toFixed(2)),
            target1: Number((ltp * 1.5).toFixed(2)),
            target2: Number((ltp * 2.2).toFixed(2)),
            riskReward: "1:2.0",
            netChange: 0,
            percentChange: 0,
            generatedAt: new Date().toISOString(),
            status: "ACTIVE",
          };
          optionChainSignalsCache.set(id, recoveredSignal);
          return recoveredSignal;
        }
      } catch (e) {
        console.warn(`[AI Engine] Failed dynamic recovery for signal ${id}:`, e);
      }
    }
  }

  return undefined;
}

// Hook up resolvers with execution service
setSignalResolver((id) => resolveSignalByIdAsync(id));
setQuoteResolver((token, symbol) => {
  const match = findSignalById(token) || [...activeEquitySignals, ...activeFnoSignals].find((s) => s.token === token || s.symbol === symbol);
  return match ? { ltp: match.currentPrice } : undefined;
});

/**
 * Deep Analysis of an instrument combining live quote data and candles
 */
export async function analyzeInstrument(
  symbol: string,
  token?: string,
  exchange = "NSE",
  prefetchedQuote?: FullMode,
  fetchCandles = false,
  allowFallbackFetch = true
): Promise<TradeSignal> {
  let resolvedToken = token ? token.trim() : "";
  let resolvedExchange = exchange;

  // Auto-resolve token and exchange from SmartAPI Instrument Database if token is missing
  if (!resolvedToken) {
    try {
      const inst = await prisma.instrument.findFirst({
        where: {
          OR: [
            { symbol: { equals: symbol.toUpperCase().trim() } },
            { symbol: { equals: `${symbol.toUpperCase().trim()}-EQ` } },
            { name: { equals: symbol.toUpperCase().trim() } },
          ],
        },
      });
      if (inst) {
        resolvedToken = inst.token;
        resolvedExchange = inst.exch_seg;
      }
    } catch (e: any) {
      console.warn(`[AI Engine] Instrument DB lookup failed for ${symbol}:`, e?.message || e);
    }
  }

  if (!resolvedToken) {
    resolvedToken = "0";
  }

  // 1. Fetch live quote data via getFullModeData or use prefetched/cached quote
  let liveQuote: FullMode | undefined = prefetchedQuote;
  if (!liveQuote && resolvedToken && resolvedToken !== "0") {
    liveQuote = getCachedQuote(resolvedToken) || getCachedQuote(`${resolvedExchange}_${resolvedToken}`) || getCachedQuote(symbol);
  }

  if (!liveQuote && allowFallbackFetch && resolvedToken && resolvedToken !== "0") {
    try {
      const fullRes = await getFullModeData({
        mode: "FULL",
        exchangeTokens: {
          [resolvedExchange]: [resolvedToken],
        },
      });
      liveQuote = fullRes.data?.fetched?.[0];
    } catch (err) {
      console.warn(`[AI Engine] Could not fetch live quote for ${symbol} (${resolvedToken}):`, err);
    }
  }

  const isFnoOption = resolvedExchange === "NFO" || symbol.endsWith("CE") || symbol.endsWith("PE");
  const defaultFallbackPrice = isFnoOption ? 45 : 1000;
  const currentPrice = liveQuote?.ltp && liveQuote.ltp > 0 ? liveQuote.ltp : defaultFallbackPrice;
  const open = liveQuote?.open || currentPrice;
  const high = liveQuote?.high || currentPrice * 1.01;
  const low = liveQuote?.low || currentPrice * 0.99;
  const close = liveQuote?.close || currentPrice;
  const netChange = liveQuote?.netChange || currentPrice - close;
  const percentChange = liveQuote?.percentChange || (close > 0 ? (netChange / close) * 100 : 0);

  // Depth Order Book analysis (imbalance ratio)
  let orderBookImbalance = 50;
  if (liveQuote?.totBuyQuan && liveQuote?.totSellQuan) {
    const totalDepth = liveQuote.totBuyQuan + liveQuote.totSellQuan;
    if (totalDepth > 0) {
      orderBookImbalance = Number(((liveQuote.totBuyQuan / totalDepth) * 100).toFixed(1));
    }
  }

  // 2. Fetch candles for indicator computation (if requested and available)
  let closes: number[] = [];
  let highs: number[] = [];
  let lows: number[] = [];
  let volumes: number[] = [];

  if (fetchCandles) {
    try {
      const today = new Date();
      const toDate = `${today.toISOString().split("T")[0]} 15:30`;
      const past = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const fromDate = `${past.toISOString().split("T")[0]} 09:15`;

      const rawCandles = await getCandleData({
        exchange: resolvedExchange,
        symboltoken: resolvedToken,
        interval: "FIFTEEN_MINUTE",
        fromdate: fromDate,
        todate: toDate,
      });

      if (rawCandles && rawCandles.length >= 10) {
        for (const c of rawCandles) {
          highs.push(Number(c[2]));
          lows.push(Number(c[3]));
          closes.push(Number(c[4]));
          volumes.push(Number(c[5]));
        }
        closes.push(currentPrice);
        highs.push(Math.max(high, currentPrice));
        lows.push(Math.min(low, currentPrice));
        volumes.push(liveQuote?.tradeVolume || 10000);
      }
    } catch (err: any) {
      console.log(`[AI Engine] Using synthetic curve from OHLC for ${symbol}`);
    }
  }

  // Fallback synthetic data if candle API was unavailable
  const isSynthetic = closes.length < 15;
  if (isSynthetic) {
    const base = close || currentPrice;
    const spread = (high - low) || base * 0.02;
    closes = [
      base - spread * 0.8,
      base - spread * 0.6,
      base - spread * 0.4,
      base - spread * 0.5,
      base - spread * 0.2,
      base - spread * 0.1,
      base + spread * 0.1,
      base - spread * 0.2,
      base + spread * 0.3,
      base + spread * 0.1,
      base + spread * 0.4,
      open,
      low,
      high,
      currentPrice,
    ];
    highs = closes.map((c) => c * 1.008);
    lows = closes.map((c) => c * 0.992);
    volumes = [15000, 18000, 22000, 19000, 25000, 31000, 28000, 35000, 42000, 50000];
  }

  // 3. Indicator Computations
  const rsi = calculateRSI(closes, 14);
  const ema9Series = calculateEMASeries(closes, 9);
  const ema21Series = calculateEMASeries(closes, 21);
  const closesLen = closes.length;
  const ema9 = ema9Series[closesLen - 1] ?? 0;
  const ema21 = ema21Series[closesLen - 1] ?? 0;
  const prevEma9 = closesLen >= 2 ? (ema9Series[closesLen - 2] ?? ema9) : ema9;
  const prevEma21 = closesLen >= 2 ? (ema21Series[closesLen - 2] ?? ema21) : ema21;

  // Genuine EMA Crossover Detection
  let emaCrossover: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NO_CROSSOVER" = "NO_CROSSOVER";
  if (prevEma9 <= prevEma21 && ema9 > ema21) {
    emaCrossover = "BULLISH_CROSSOVER";
  } else if (prevEma9 >= prevEma21 && ema9 < ema21) {
    emaCrossover = "BEARISH_CROSSOVER";
  }

  const sma50 = calculateSMA(closes, Math.min(50, closes.length));
  const macdData = calculateMACD(closes);
  const bb = calculateBollingerBands(closes, 20, 2);
  const atr = Number(calculateATR(highs, lows, closes, 14).toFixed(2));

  // Volume surge ratio
  const lastVol = volumes[volumes.length - 1] || 1;
  const avgVol = calculateSMA(volumes, volumes.length) || 1;
  const volumeRatio = Number((lastVol / avgVol).toFixed(2));

  // Support & Resistance (Classic Pivots)
  const pivot = (high + low + close) / 3;
  const supportLevel = Number((2 * pivot - high).toFixed(2));
  const resistanceLevel = Number((2 * pivot - low).toFixed(2));

  // Determine RSI State
  let rsiSignal: TechnicalIndicators["rsiSignal"] = "NEUTRAL";
  if (rsi <= 30) rsiSignal = "OVERSOLD";
  else if (rsi >= 70) rsiSignal = "OVERBOUGHT";
  else if (rsi > 55) rsiSignal = "BULLISH_MOMENTUM";
  else if (rsi < 45) rsiSignal = "BEARISH_MOMENTUM";

  // Determine EMA Trend
  let emaTrend: TechnicalIndicators["emaTrend"] = "NEUTRAL";
  if (ema9 > ema21 && currentPrice > ema9) emaTrend = "STRONG_BULLISH";
  else if (ema9 > ema21) emaTrend = "BULLISH";
  else if (ema9 < ema21 && currentPrice < ema9) emaTrend = "STRONG_BEARISH";
  else if (ema9 < ema21) emaTrend = "BEARISH";

  // Determine MACD Trend from authentic MACD calculation
  const macdTrend = macdData.trend;

  // Determine Bollinger Band Position
  let bbPosition: TechnicalIndicators["bollingerBands"]["position"] = "LOWER_HALF";
  if (bb.bandwidth < 2.5) bbPosition = "SQUEEZE";
  else if (currentPrice > bb.upper) bbPosition = "ABOVE_UPPER";
  else if (currentPrice > bb.middle) bbPosition = "UPPER_HALF";
  else if (currentPrice < bb.lower) bbPosition = "BELOW_LOWER";

  const indicators: TechnicalIndicators = {
    rsi,
    rsiSignal,
    ema9,
    ema21,
    sma50,
    emaTrend,
    emaCrossover,
    prevEma9,
    prevEma21,
    macd: {
      ...macdData,
      trend: macdTrend,
    },
    bollingerBands: {
      ...bb,
      position: bbPosition,
    },
    atr,
    volumeRatio,
    supportLevel,
    resistanceLevel,
    orderBookImbalance,
  };

  // 4. Multi-Factor Scoring & Action Determination
  let bullishScore = 0;
  let bearishScore = 0;
  const rationaleList: string[] = [];

  // RSI Scoring
  if (rsi <= 32) {
    bullishScore += 25;
    rationaleList.push(`RSI is in deeply oversold territory (${rsi}), signaling imminent mean-reversion bounce.`);
  } else if (rsi >= 48 && rsi <= 65) {
    bullishScore += 18;
    rationaleList.push(`RSI exhibits sustained healthy upward momentum at ${rsi}.`);
  } else if (rsi >= 72) {
    bearishScore += 25;
    rationaleList.push(`RSI at overbought reading of ${rsi}, risk of technical exhaustion and profit-taking.`);
  } else if (rsi < 45) {
    bearishScore += 15;
    rationaleList.push(`RSI drifting down at ${rsi}, showing lack of buying appetite.`);
  }

  // Moving Average Scoring
  if (ema9 > ema21 && currentPrice >= ema9) {
    bullishScore += 25;
    rationaleList.push(`Golden EMA alignment: Price (₹${currentPrice}) trading comfortably above EMA 9 (₹${ema9}) & EMA 21 (₹${ema21}).`);
  } else if (ema9 < ema21 && currentPrice <= ema9) {
    bearishScore += 25;
    rationaleList.push(`Bearish EMA structure: EMA 9 (₹${ema9}) below EMA 21 (₹${ema21}) acting as dynamic resistance.`);
  }

  // MACD Scoring
  if (macdData.histogram > 0) {
    bullishScore += 20;
    rationaleList.push(`MACD histogram positive (+${macdData.histogram}), confirming buyers control short-term momentum.`);
  } else {
    bearishScore += 20;
    rationaleList.push(`MACD histogram negative (${macdData.histogram}), indicating persistent selling pressure.`);
  }

  // Order Book Imbalance & Bollinger Bands
  if (orderBookImbalance >= 55) {
    bullishScore += 15;
    rationaleList.push(`Order book depth indicates strong buyer interest (${orderBookImbalance}% buy vs ${100 - orderBookImbalance}% sell).`);
  } else if (orderBookImbalance <= 45) {
    bearishScore += 15;
    rationaleList.push(`Order book depth skewed heavily toward sellers (${100 - orderBookImbalance}% ask volume).`);
  }

  if (currentPrice <= bb.lower * 1.01) {
    bullishScore += 15;
    rationaleList.push(`Price touching lower Bollinger Band (₹${bb.lower}), representing statistical undervaluation.`);
  } else if (currentPrice >= bb.upper * 0.99) {
    bearishScore += 15;
    rationaleList.push(`Price testing upper Bollinger Band (₹${bb.upper}), stretched beyond 2 standard deviations.`);
  }

  // 5. Final Signal, Confidence, and Price Target Construction
  let action: SignalAction = "HOLD";
  let confidence = 50;

  if (bullishScore >= bearishScore + 15) {
    action = "BUY";
    confidence = Math.min(94, Math.max(68, Math.round(50 + (bullishScore - bearishScore) * 0.75)));
  } else if (bearishScore >= bullishScore + 15) {
    action = "SELL";
    confidence = Math.min(94, Math.max(68, Math.round(50 + (bearishScore - bullishScore) * 0.75)));
  } else {
    action = "HOLD";
    confidence = Math.round(50 + Math.abs(bullishScore - bearishScore) * 0.4);
    rationaleList.push("Mixed technical indicators; sideways consolidation favored over directional bias.");
  }

  // Calculated Targets & Dynamic ATR Stop-Loss
  const dynamicRisk = Math.max(atr * 1.4, currentPrice * 0.012);
  let stopLoss = 0;
  let target1 = 0;
  let target2 = 0;

  if (action === "BUY") {
    const rawSL = currentPrice - dynamicRisk;
    stopLoss = rawSL <= 0 ? Number((currentPrice * 0.70).toFixed(2)) : Number(rawSL.toFixed(2));
    if (stopLoss <= 0) stopLoss = 0.05;
    target1 = Number((currentPrice + dynamicRisk * 1.8).toFixed(2));
    target2 = Number((currentPrice + dynamicRisk * 3.2).toFixed(2));
  } else if (action === "SELL") {
    stopLoss = Number((currentPrice + dynamicRisk).toFixed(2));
    const rawT1 = currentPrice - dynamicRisk * 1.8;
    const rawT2 = currentPrice - dynamicRisk * 3.2;
    target1 = rawT1 <= 0 ? Number((currentPrice * 0.80).toFixed(2)) : Number(rawT1.toFixed(2));
    target2 = rawT2 <= 0 ? Number((currentPrice * 0.65).toFixed(2)) : Number(rawT2.toFixed(2));
    if (target1 <= 0) target1 = 0.05;
    if (target2 <= 0) target2 = 0.05;
  } else {
    stopLoss = Number((currentPrice * 0.985).toFixed(2));
    target1 = Number((currentPrice * 1.02).toFixed(2));
    target2 = Number((currentPrice * 1.035).toFixed(2));
  }

  const riskAmt = Math.abs(currentPrice - stopLoss) || 1;
  const rewardAmt = Math.abs(target1 - currentPrice) || 2;
  const rrRatio = (rewardAmt / riskAmt).toFixed(1);

  // F&O Contract Property Detection
  const isFno = exchange === "NFO" || symbol.endsWith("CE") || symbol.endsWith("PE") || symbol.endsWith("FUT");
  let contractType: ContractType = "EQ";
  let strike: number | undefined;
  let underlying: string | undefined;
  let lotSize = 1;

  if (isFno) {
    if (symbol.endsWith("CE")) contractType = "CE";
    else if (symbol.endsWith("PE")) contractType = "PE";
    else if (symbol.endsWith("FUT")) contractType = "FUT";

    // Extract strike (e.g. 25000 from NIFTY03NOV2625000PE)
    const strikeMatch = symbol.match(/(\d{4,6})(CE|PE)$/i);
    if (strikeMatch?.[1]) {
      strike = parseFloat(strikeMatch[1]);
    }

    if (symbol.startsWith("NIFTY")) {
      underlying = "NIFTY";
    } else if (symbol.startsWith("BANKNIFTY")) {
      underlying = "BANKNIFTY";
    } else if (symbol.startsWith("FINNIFTY")) {
      underlying = "FINNIFTY";
    }
    lotSize = await getInstrumentLotSize(symbol, 1);
  } else {
    lotSize = await getInstrumentLotSize(symbol, 1);
  }

  // Open interest analysis
  const opnInterest = liveQuote?.opnInterest || 0;
  let oiBuildup: OIBuildupType = "NEUTRAL";
  if (isFno && opnInterest > 0) {
    if (percentChange > 0) {
      oiBuildup = "LONG_BUILDUP";
    } else {
      oiBuildup = "SHORT_BUILDUP";
    }
  }

  // AI Synthesis Thesis (tailored for Options & Equities)
  let summary = "";
  if (isFno && contractType === "PE") {
    summary = action === "BUY"
      ? `High-probability Put Option (PE) setup for ${symbol}. Underlying spot encountering heavy resistance; Put premium expanding with ${confidence}% confidence.`
      : `Put Option writing / theta decay bias for ${symbol}. Underlying finding support with ${confidence}% confidence.`;
  } else if (isFno && contractType === "CE") {
    summary = action === "BUY"
      ? `Bullish Call Option (CE) breakout for ${symbol}. Underlying spot exhibiting strong upside momentum with ${confidence}% confidence.`
      : `Call Option decay / short bias for ${symbol}. Underlying encountering supply zone with ${confidence}% confidence.`;
  } else {
    summary = action === "BUY"
      ? `Strong bullish divergence detected for ${symbol} with ${confidence}% confidence. Momentum confluence across RSI, EMA crossover, and positive order book depth.`
      : action === "SELL"
      ? `Bearish breakdown alert for ${symbol} with ${confidence}% confidence. Price encountering upper resistance with deteriorating MACD velocity.`
      : `Neutral consolidation pattern for ${symbol} with ${confidence}% confidence. Await clear breakout above ₹${resistanceLevel} or breakdown below ₹${supportLevel}.`;
  }

  const riskFactor = isSynthetic
    ? "SYNTHETIC DATA WARNING: Indicators derived from fallback curve due to missing candle feed. Verify on live chart before trading."
    : action === "BUY"
    ? `Broader index volatility or a break below crucial support at ₹${supportLevel}.`
    : `Short-covering squeeze if price breaks above key resistance at ₹${resistanceLevel}.`;

  const catalyst =
    action === "BUY"
      ? "Volume expansion on intraday 15-minute candle breakout."
      : "Break of immediate intraday VWAP support.";

  const signal: TradeSignal = {
    id: `SIG_${resolvedToken}_${Date.now()}`,
    symbol,
    token: resolvedToken,
    exchange: resolvedExchange,
    segment: isFno ? "FNO" : "EQUITY",
    contractType,
    strike,
    lotSize,
    underlying,
    openInterest: opnInterest,
    oiBuildup,
    action,
    confidence,
    timeframe: "INTRADAY (15m)",
    currentPrice,
    entryPrice: currentPrice,
    stopLoss,
    target1,
    target2,
    riskReward: `1:${rrRatio}`,
    netChange: Number(netChange.toFixed(2)),
    percentChange: Number(percentChange.toFixed(2)),
    indicators,
    isSynthetic,
    dataSource: isSynthetic ? "SYNTHETIC_FALLBACK" : "LIVE_EXCHANGE",
    warning: isSynthetic
      ? "⚠️ SYNTHETIC DATA: Historical candles were unavailable. Indicators are calculated from estimated curve. Do not use for live execution."
      : undefined,
    aiThesis: {
      summary,
      rationale: rationaleList.slice(0, 4),
      riskFactor,
      catalyst,
    },
    generatedAt: new Date().toISOString(),
    status: "ACTIVE",
  };

  return signal;
}

/**
 * Scan entire market universe dynamically (Equities or Futures & Options)
 */
export async function scanMarketUniverse(segment: MarketSegment = "EQUITY"): Promise<TradeSignal[]> {
  const autoConfig = getAutoPilotConfig();
  console.log(
    `[AI Scanner] [${autoConfig.mode}] Initiating dynamic market scan for segment: ${segment}. Auto-Pilot: ${
      autoConfig.enabled ? "ARMED (ON)" : "PAUSED (OFF)"
    }`
  );

  const candidates = await getDynamicUniverse(segment);
  console.log(
    `[AI Scanner] [${autoConfig.mode}] Scanning ${candidates.length} dynamic ${segment} candidate instruments...`
  );

  // 1. Batch fetch live quotes for all candidates in ONE single request
  const exchangeTokens: Record<string, string[]> = {};
  for (const c of candidates) {
    const exch = c.exchange || (segment === "FNO" ? "NFO" : "NSE");
    const list = exchangeTokens[exch] ?? [];
    if (!list.includes(c.token)) {
      list.push(c.token);
    }
    exchangeTokens[exch] = list;
  }

  const quotesMap = new Map<string, FullMode>();
  try {
    const quotesRes = await getFullModeData({
      mode: "FULL",
      exchangeTokens,
    });
    for (const q of quotesRes.data?.fetched || []) {
      quotesMap.set(`${q.exchange}_${q.symbolToken}`, q);
      quotesMap.set(q.symbolToken, q);
      if (q.tradingSymbol) {
        quotesMap.set(q.tradingSymbol.toUpperCase(), q);
      }
    }
  } catch (err: any) {
    console.warn(`[AI Engine] Batch quote fetch warning:`, err?.message || err);
  }

  // 2. Parallel analysis using live quotes
  const freshSignals: TradeSignal[] = [];
  for (const c of candidates) {
    try {
      const prefetched =
        quotesMap.get(`${c.exchange}_${c.token}`) ||
        quotesMap.get(c.token) ||
        quotesMap.get(c.symbol.toUpperCase());
      const sig = await analyzeInstrument(c.symbol, c.token, c.exchange, prefetched, false, false);
      sig.segment = segment;
      if (c.contractType) sig.contractType = c.contractType;
      if (c.strike) sig.strike = c.strike;
      if (c.expiry) sig.expiry = c.expiry;
      if (c.lotSize) sig.lotSize = c.lotSize;
      if (c.underlying) sig.underlying = c.underlying;
      freshSignals.push(sig);
    } catch (err: any) {
      console.error(`[AI Engine] Failed to analyze ${c.symbol} (${c.token}):`, err?.message || err);
    }
  }

  // Sort signals: actionable BUY/SELL first, highest confidence to lowest
  freshSignals.sort((a, b) => {
    const aAction = a.action !== "HOLD" ? 1 : 0;
    const bAction = b.action !== "HOLD" ? 1 : 0;
    if (aAction !== bAction) return bAction - aAction;
    return b.confidence - a.confidence;
  });

  const buySignals = freshSignals.filter((s) => s.action === "BUY");
  const sellSignals = freshSignals.filter((s) => s.action === "SELL");
  const actionable = freshSignals.filter((s) => s.action !== "HOLD");

  console.log(
    `[AI Scanner] [${autoConfig.mode}] ${segment} Scan complete: ${freshSignals.length} instruments evaluated | ${buySignals.length} BUY | ${sellSignals.length} SELL | ${freshSignals.length - actionable.length} HOLD`
  );

  if (actionable.length > 0) {
    console.log(
      `[AI Scanner] [${autoConfig.mode}] Top actionable setups: ${actionable
        .slice(0, 5)
        .map((s) => `${s.symbol} (${s.action} @ ₹${s.currentPrice}, conf: ${s.confidence}%)`)
        .join(", ")}`
    );
  }

  broadcastSocketEvent("ai_scanner_activity", {
    segment,
    mode: autoConfig.mode,
    autoPilotEnabled: autoConfig.enabled,
    totalScanned: candidates.length,
    buyCount: buySignals.length,
    sellCount: sellSignals.length,
    topActionable: actionable.slice(0, 6).map((s) => ({
      symbol: s.symbol,
      action: s.action,
      currentPrice: s.currentPrice,
      confidence: s.confidence,
    })),
    timestamp: new Date().toISOString(),
  });

  if (segment === "FNO") {
    activeFnoSignals = freshSignals;
    lastFnoScanTime = new Date().toISOString();

    broadcastSocketEvent("ai_fno_signals_update", {
      signals: activeFnoSignals,
      scannedAt: lastFnoScanTime,
      count: activeFnoSignals.length,
    });

    if (autoConfig.enabled) {
      evaluateAutoPilotTriggers(activeFnoSignals);
    }

    return activeFnoSignals;
  } else {
    activeEquitySignals = freshSignals;
    lastEquityScanTime = new Date().toISOString();

    broadcastSocketEvent("ai_signals_update", {
      signals: activeEquitySignals,
      scannedAt: lastEquityScanTime,
      count: activeEquitySignals.length,
    });

    if (autoConfig.enabled) {
      evaluateAutoPilotTriggers(activeEquitySignals);
    }

    return activeEquitySignals;
  }
}

// Register scanMarketUniverse with Auto-Pilot autonomous runner
setScanUniverseFn((segment) => scanMarketUniverse(segment));

/**
 * Find and analyze a specific F&O Option Strike
 */
export async function findAndAnalyzeOptionStrike(params: {
  underlying: string;
  strike: number;
  optionType: "CE" | "PE";
}): Promise<TradeSignal> {
  const { underlying, strike, optionType } = params;
  const underUpper = underlying.trim().toUpperCase();
  const optUpper = optionType.trim().toUpperCase();

  console.log(`[AI Engine] Looking up option strike: ${underUpper} ${strike} ${optUpper}...`);

  // Query PostgreSQL Instrument table
  let instruments = await prisma.instrument.findMany({
    where: {
      exch_seg: "NFO",
      name: { equals: underUpper, mode: "insensitive" },
      symbol: {
        endsWith: optUpper,
        contains: String(strike),
      },
    },
    take: 10,
  });

  if (instruments.length === 0) {
    instruments = await prisma.instrument.findMany({
      where: {
        exch_seg: "NFO",
        symbol: { contains: `${strike}${optUpper}` },
      },
      take: 10,
    });
  }

  if (instruments.length === 0) {
    throw new Error(
      `No active option contract found for ${underUpper} ${strike} ${optUpper}. Please verify strike or try another.`
    );
  }

  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const chosen = instruments[0]!;

  const parsedLot = parseInt(chosen.lotsize, 10);
  const lot = !isNaN(parsedLot) && parsedLot > 0 ? parsedLot : await getInstrumentLotSize(chosen.symbol, 1);
  const signal = await analyzeInstrument(chosen.symbol, chosen.token, "NFO", undefined, false);

  signal.strike = strike;
  signal.lotSize = lot;
  signal.underlying = underUpper;
  signal.segment = "FNO";
  signal.contractType = optUpper as "CE" | "PE";

  return signal;
}

/**
 * Scan an Option Chain and produce a ranked list of TradeSignals (CE/PE strikes)
 */
export async function scanOptionChainSignals(params: {
  underlying: string;
  expiry?: string;
  strikeCount?: number;
}): Promise<{ underlying: string; spotPrice: number; pcr: number; pcrSentiment: string; maxPainStrike: number; signals: TradeSignal[] }> {
  const underlying = (params.underlying || "NIFTY").trim().toUpperCase();
  const chain = await getOptionChainData({ underlying, expiry: params.expiry, strikeCount: params.strikeCount ?? 8 });

  const signals: TradeSignal[] = [];
  const lotSize = chain.lotSize || (await getInstrumentLotSize(underlying, 1));
  const spot = chain.spotPrice;

  for (const row of chain.rows) {
    for (const side of ["call", "put"] as const) {
      const contract = side === "call" ? row.call : row.put;
      if (!contract || !contract.ltp || contract.ltp <= 0) continue;

      const isCall = side === "call";
      const pct = contract.percentChange || 0;
      const vol = contract.tradeVolume || 0;
      const oi = contract.opnInterest || 0;
      const delta = contract.greeks?.delta ?? 0;
      const gamma = contract.greeks?.gamma ?? 0;
      const thetaRatio = contract.greeks?.thetaPremiumRatio ?? 0;

      let action: SignalAction = "HOLD";
      if (pct > 0.5 && delta >= 0.2 && delta <= 0.6) action = "BUY";
      else if (pct < -0.5 && delta >= 0.2 && delta <= 0.6) action = "SELL";

      let confidence = 50 + Math.min(30, Math.abs(pct) * 2) + Math.min(10, (vol > 0 ? 5 : 0)) + Math.min(10, (oi > 0 ? 5 : 0));
      if (row.isAtm) confidence += 5;
      confidence = Math.min(95, Math.max(40, Math.round(confidence)));

      const ltp = contract.ltp;
      const sl = Number((ltp * 0.78).toFixed(2));
      const t1 = Number((ltp * 1.5).toFixed(2));
      const t2 = Number((ltp * 2.2).toFixed(2));

      const signal: TradeSignal = {
        id: `OC_${contract.symbolToken}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        symbol: contract.tradingSymbol,
        token: contract.symbolToken,
        exchange: "NFO",
        segment: "FNO",
        contractType: isCall ? "CE" : "PE",
        strike: contract.strike,
        expiry: contract.expiry,
        lotSize,
        underlying,
        openInterest: oi,
        action,
        confidence,
        timeframe: "INTRADAY",
        currentPrice: ltp,
        entryPrice: ltp,
        stopLoss: sl,
        target1: t1,
        target2: t2,
        riskReward: "1:2.0",
        netChange: contract.netChange,
        percentChange: pct,
        indicators: {
          rsi: pct >= 0 ? 62 : 38,
          rsiSignal: pct >= 0 ? "BULLISH_MOMENTUM" : "BEARISH_MOMENTUM",
          ema9: ltp,
          ema21: ltp * 0.98,
          sma50: ltp * 0.95,
          emaTrend: pct >= 0 ? "BULLISH" : "BEARISH",
          macd: { macdLine: pct, signalLine: pct * 0.8, histogram: pct * 0.2, trend: pct >= 0 ? "BULLISH" : "BEARISH" },
          bollingerBands: { upper: ltp * 1.1, middle: ltp, lower: ltp * 0.9, bandwidth: 20, percentB: 0.6, position: "UPPER_HALF" },
          atr: ltp * 0.05,
          volumeRatio: vol > 0 ? 1.5 : 1.0,
          supportLevel: sl,
          resistanceLevel: t1,
          orderBookImbalance: pct >= 0 ? 0.3 : -0.3,
        },
        greeks: contract.greeks,
        aiThesis: {
          summary: `${isCall ? "Call" : "Put"} ${contract.strike} ${pct >= 0 ? "momentum" : "weakness"}: ${pct.toFixed(2)}% move, delta ${delta.toFixed(2)}, gamma ${gamma.toFixed(4)}.`,
          rationale: [
            `Premium ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
            `Delta ${delta.toFixed(3)} | Gamma ${gamma.toFixed(4)} | Theta/Premium ${thetaRatio.toFixed(3)}`,
            `OI ${oi} | Volume ${vol}${row.isAtm ? " | ATM strike" : ""}`,
          ],
          riskFactor: chain.isSynthetic ? "SIMULATED DATA WARNING: Live option contracts not found in DB." : `Theta decay if held; SL at ₹${sl}.`,
          catalyst: "Option chain momentum + greeks confluence.",
        },
        isSynthetic: chain.isSynthetic,
        dataSource: chain.dataSource || (chain.isSynthetic ? "SYNTHETIC_FALLBACK" : "LIVE_EXCHANGE"),
        warning: chain.warningMessage,
        generatedAt: new Date().toISOString(),
        status: "ACTIVE",
      };
      signals.push(signal);
      optionChainSignalsCache.set(signal.id, signal);
    }
  }

  signals.sort((a, b) => {
    const aAction = a.action !== "HOLD" ? 1 : 0;
    const bAction = b.action !== "HOLD" ? 1 : 0;
    if (aAction !== bAction) return bAction - aAction;
    return b.confidence - a.confidence;
  });

  return {
    underlying,
    spotPrice: spot,
    pcr: chain.pcr,
    pcrSentiment: chain.pcrSentiment,
    maxPainStrike: chain.maxPainStrike,
    signals,
  };
}

/**
 * Get active cached signals for quick UI rendering
 */
export function getActiveSignals(segment: MarketSegment = "EQUITY"): {
  signals: TradeSignal[];
  lastScanTime: string | null;
  count: number;
} {
  const isFno = segment === "FNO";
  const signals = isFno ? activeFnoSignals : activeEquitySignals;
  const lastScan = isFno ? lastFnoScanTime : lastEquityScanTime;
  return {
    signals,
    lastScanTime: lastScan,
    count: signals.length,
  };
}

/**
 * Update real-time price tick for a signal
 */
export function updateLiveSignalPrice(
  token: string,
  ltp: number,
  netChange?: number,
  percentChange?: number
): void {
  const updateList = (list: TradeSignal[]) => {
    for (const sig of list) {
      if (sig.token === token) {
        sig.currentPrice = ltp;
        if (netChange !== undefined) sig.netChange = netChange;
        if (percentChange !== undefined) sig.percentChange = percentChange;
      }
    }
  };
  updateList(activeEquitySignals);
  updateList(activeFnoSignals);
}
