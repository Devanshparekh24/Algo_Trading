// ---------------------------------------------------------------------------
// Technical Indicator Engine
// High-precision calculations for RSI, EMA, SMA, MACD, Bollinger Bands, ATR,
// and Order Book Imbalance with genuine crossover detection.
// ---------------------------------------------------------------------------

import type { TechnicalIndicators } from "../../types/aiTrading.types.js";

/**
 * Relative Strength Index (RSI) calculation
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number(rsi.toFixed(2));
}

/**
 * Exponential Moving Average (EMA) Series across an entire array of prices
 */
export function calculateEMASeries(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [];
  const k = 2 / (period + 1);

  if (data.length < period) {
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    for (let i = 0; i < data.length; i++) {
      result.push(Number(avg.toFixed(2)));
    }
    return result;
  }

  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) {
    result.push(Number(ema.toFixed(2)));
  }
  result.push(Number(ema.toFixed(2)));

  for (let i = period; i < data.length; i++) {
    const val = data[i] ?? 0;
    ema = val * k + ema * (1 - k);
    result.push(Number(ema.toFixed(2)));
  }

  return result;
}

/**
 * Exponential Moving Average (EMA) for latest bar
 */
export function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const series = calculateEMASeries(data, period);
  return series[series.length - 1] ?? 0;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / slice.length).toFixed(2));
}

/**
 * Bollinger Bands (Period = 20, StdDev = 2)
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  multiplier = 2
): {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
  position: "ABOVE_UPPER" | "UPPER_HALF" | "LOWER_HALF" | "BELOW_LOWER" | "SQUEEZE";
} {
  const currentClose = closes[closes.length - 1] || 100;
  if (closes.length < period) {
    const avg = calculateSMA(closes, closes.length);
    const mockUpper = avg * 1.02;
    const mockLower = avg * 0.98;
    return {
      middle: avg,
      upper: Number(mockUpper.toFixed(2)),
      lower: Number(mockLower.toFixed(2)),
      bandwidth: 4.0,
      percentB: 0.5,
      position: "UPPER_HALF",
    };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  const percentB = upper !== lower ? (currentClose - lower) / (upper - lower) : 0.5;

  let position: "ABOVE_UPPER" | "UPPER_HALF" | "LOWER_HALF" | "BELOW_LOWER" | "SQUEEZE" = "UPPER_HALF";
  if (bandwidth < 2.5) {
    position = "SQUEEZE";
  } else if (currentClose >= upper) {
    position = "ABOVE_UPPER";
  } else if (currentClose >= middle) {
    position = "UPPER_HALF";
  } else if (currentClose >= lower) {
    position = "LOWER_HALF";
  } else {
    position = "BELOW_LOWER";
  }

  return {
    middle: Number(middle.toFixed(2)),
    upper: Number(upper.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    bandwidth: Number(bandwidth.toFixed(2)),
    percentB: Number(percentB.toFixed(2)),
    position,
  };
}

/**
 * Moving Average Convergence Divergence (MACD 12, 26, 9)
 * Genuine 9-period EMA signal line over MACD series with true crossover detection.
 */
export function calculateMACD(
  closes: number[]
): {
  macdLine: number;
  signalLine: number;
  histogram: number;
  trend: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "BULLISH" | "BEARISH" | "NEUTRAL";
} {
  if (closes.length < 26) {
    return { macdLine: 0, signalLine: 0, histogram: 0, trend: "NEUTRAL" };
  }

  const ema12Series = calculateEMASeries(closes, 12);
  const ema26Series = calculateEMASeries(closes, 26);
  const macdSeries: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const v12 = ema12Series[i] ?? 0;
    const v26 = ema26Series[i] ?? 0;
    macdSeries.push(Number((v12 - v26).toFixed(4)));
  }

  // Authentic 9-period EMA of MACD series
  const signalSeries = calculateEMASeries(macdSeries, 9);

  const len = macdSeries.length;
  const currMacd = macdSeries[len - 1] ?? 0;
  const currSignal = signalSeries[len - 1] ?? 0;
  const prevMacd = len >= 2 ? (macdSeries[len - 2] ?? 0) : currMacd;
  const prevSignal = len >= 2 ? (signalSeries[len - 2] ?? 0) : currSignal;

  const histogram = currMacd - currSignal;

  let trend: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (prevMacd <= prevSignal && currMacd > currSignal) {
    trend = "BULLISH_CROSSOVER";
  } else if (prevMacd >= prevSignal && currMacd < currSignal) {
    trend = "BEARISH_CROSSOVER";
  } else if (histogram > 0) {
    trend = "BULLISH";
  } else if (histogram < 0) {
    trend = "BEARISH";
  }

  return {
    macdLine: Number(currMacd.toFixed(2)),
    signalLine: Number(currSignal.toFixed(2)),
    histogram: Number(histogram.toFixed(2)),
    trend,
  };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < 2) return 10;

  const trueRanges: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    const prevC = closes[i - 1] ?? 0;

    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges, Math.min(period, trueRanges.length)) || 10;
}

/**
 * Order Book Imbalance (% of buyers vs sellers)
 */
export function calculateOrderBookImbalance(
  totBuyQuant?: number,
  totSellQuant?: number
): number {
  const buy = totBuyQuant || 0;
  const sell = totSellQuant || 0;
  const total = buy + sell;
  if (total === 0) return 50;
  return Number(((buy / total) * 100).toFixed(1));
}

/**
 * Computes full multi-factor Technical Indicators snapshot
 */
export function computeMultiFactorIndicators(params: {
  closes: number[];
  highs: number[];
  lows: number[];
  currentPrice: number;
  totBuyQuant?: number | undefined;
  totSellQuant?: number | undefined;
}): TechnicalIndicators {
  const { closes, highs, lows, currentPrice, totBuyQuant, totSellQuant } = params;

  const rsi = calculateRSI(closes, 14);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const sma50 = calculateSMA(closes, 50);
  const macd = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes, 20);
  const atr = calculateATR(highs, lows, closes, 14);
  const orderBookImbalance = calculateOrderBookImbalance(totBuyQuant, totSellQuant);

  // EMA Series & Crossover Detection
  const ema9Series = calculateEMASeries(closes, 9);
  const ema21Series = calculateEMASeries(closes, 21);
  const prevEma9 = ema9Series.length >= 2 ? (ema9Series[ema9Series.length - 2] ?? ema9) : ema9;
  const prevEma21 = ema21Series.length >= 2 ? (ema21Series[ema21Series.length - 2] ?? ema21) : ema21;

  let emaCrossover: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NO_CROSSOVER" = "NO_CROSSOVER";
  if (prevEma9 <= prevEma21 && ema9 > ema21) {
    emaCrossover = "BULLISH_CROSSOVER";
  } else if (prevEma9 >= prevEma21 && ema9 < ema21) {
    emaCrossover = "BEARISH_CROSSOVER";
  }

  // RSI Signal
  let rsiSignal: TechnicalIndicators["rsiSignal"] = "NEUTRAL";
  if (rsi <= 30) rsiSignal = "OVERSOLD";
  else if (rsi >= 70) rsiSignal = "OVERBOUGHT";
  else if (rsi > 55) rsiSignal = "BULLISH_MOMENTUM";
  else if (rsi < 45) rsiSignal = "BEARISH_MOMENTUM";

  // EMA Trend
  let emaTrend: TechnicalIndicators["emaTrend"] = "NEUTRAL";
  if (currentPrice > ema9 && ema9 > ema21) {
    emaTrend = currentPrice > sma50 ? "STRONG_BULLISH" : "BULLISH";
  } else if (currentPrice < ema9 && ema9 < ema21) {
    emaTrend = currentPrice < sma50 ? "STRONG_BEARISH" : "BEARISH";
  }

  const supportLevel = Number((currentPrice - atr * 1.5).toFixed(2));
  const resistanceLevel = Number((currentPrice + atr * 1.5).toFixed(2));

  return {
    rsi,
    rsiSignal,
    ema9,
    ema21,
    sma50,
    emaTrend,
    emaCrossover,
    prevEma9,
    prevEma21,
    macd,
    bollingerBands,
    atr,
    volumeRatio: 1.0,
    supportLevel,
    resistanceLevel,
    orderBookImbalance,
  };
}
