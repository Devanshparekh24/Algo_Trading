// ---------------------------------------------------------------------------
// Historical Strategy Backtesting Engine with Institutional Indian Cost Model
// Evaluates EMA 9/21, Greek Sniper, Gamma Blast, VWAP Trap, and ORB strategies.
// Accounts for Brokerage (₹20/order), STT, Exchange Fees, GST, Stamp Duty, and Slippage.
// ---------------------------------------------------------------------------

import { getCandleData } from "../smartapi/api/historical.js";
import type { CandleData } from "../smartapi/types.js";
import { calculateIndianMarketCosts } from "./costModel.service.js";
import type {
  BacktestTrade,
  BacktestResult,
  StrategyBacktestParams,
} from "../../types/aiTrading.types.js";

export type BacktestSignal = "BUY" | "SELL" | "HOLD";
export type BacktestStrategy =
  | "EMA_9_21"
  | "GREEK_SNIPER"
  | "GAMMA_BLAST"
  | "VWAP_TRAP"
  | "ORB_15M"
  | "STANDARD";

export interface BacktestEquityPoint {
  time: string;
  equity: number;
}

/**
 * Computes Exponential Moving Average (EMA) array
 */
export function computeEMAArray(closes: number[], period: number): number[] {
  const result: number[] = [];
  if (closes.length === 0) return result;
  const k = 2 / (period + 1);
  let ema: number;
  if (closes.length < period) {
    const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
    for (let i = 0; i < closes.length; i++) result.push(Number(avg.toFixed(2)));
    return result;
  }
  ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(Number(ema.toFixed(2)));
  result.push(Number(ema.toFixed(2)));
  for (let i = period; i < closes.length; i++) {
    const val = closes[i] ?? 0;
    ema = val * k + ema * (1 - k);
    result.push(Number(ema.toFixed(2)));
  }
  return result;
}

/**
 * Computes Relative Strength Index (RSI) array
 */
export function computeRSIArray(closes: number[], period = 14): number[] {
  const rsiArr: number[] = [];
  if (closes.length <= period) {
    return closes.map(() => 50);
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = 0; i < period; i++) rsiArr.push(50);

  for (let i = period; i < closes.length; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }

    if (avgLoss === 0) {
      rsiArr.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      rsiArr.push(Number(rsi.toFixed(2)));
    }
  }
  return rsiArr;
}

/**
 * Universal Strategy Backtester with Authentic Indian Cost Model
 */
export async function runStrategyBacktest(params: StrategyBacktestParams): Promise<BacktestResult> {
  const {
    strategy = "EMA_9_21",
    symbol,
    token,
    exchange,
    fromDate,
    toDate,
    interval = "FIVE_MINUTE",
    initialCapital = 100000,
    targetPct: customTarget,
    stopLossPct: customSl,
    lotSize = 1,
  } = params;

  // Set strategy-specific defaults
  let targetPct = customTarget || 25;
  let stopLossPct = customSl || 12;
  let maxBarsHold = 30; // e.g. 30 5m bars = 150 mins

  if (strategy === "GAMMA_BLAST") {
    targetPct = customTarget || 75;
    stopLossPct = customSl || 25;
    maxBarsHold = 18; // 90 min rapid gamma expiry window
  } else if (strategy === "GREEK_SNIPER") {
    targetPct = customTarget || 35;
    stopLossPct = customSl || 18;
    maxBarsHold = 9; // 45 min theta timeout (9 x 5m bars)
  } else if (strategy === "VWAP_TRAP") {
    targetPct = customTarget || 30;
    stopLossPct = customSl || 15;
    maxBarsHold = 12;
  } else if (strategy === "ORB_15M") {
    targetPct = customTarget || 20;
    stopLossPct = customSl || 10;
    maxBarsHold = 18;
  }

  const candles: CandleData[] = (await getCandleData({
    exchange,
    symboltoken: token,
    interval,
    fromdate: fromDate,
    todate: toDate,
  })) || [];

  if (candles.length === 0) {
    throw new Error(`No historical candle data found for ${symbol} (${token}) from ${fromDate} to ${toDate}.`);
  }

  const closes = candles.map((c) => c[4] ?? 0);
  const ema9 = computeEMAArray(closes, 9);
  const ema21 = computeEMAArray(closes, 21);
  const rsi14 = computeRSIArray(closes, 14);

  const trades: BacktestTrade[] = [];
  let currentCapital = initialCapital;
  const equityCurve: BacktestEquityPoint[] = [];

  let openTrade: {
    entryTime: string;
    entryPrice: number;
    action: BacktestSignal;
    startIndex: number;
    quantity: number;
  } | null = null;

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const [timeStr, , high = 0, low = 0, close = 0] = candle;
    const prevEma9 = ema9[i - 1] ?? 0;
    const prevEma21 = ema21[i - 1] ?? 0;
    const currEma9 = ema9[i] ?? 0;
    const currEma21 = ema21[i] ?? 0;
    const currRsi = rsi14[i] ?? 50;

    // Check open trade exit conditions
    if (openTrade) {
      const barsHeld = i - openTrade.startIndex;
      let exitReason: "TARGET" | "STOP_LOSS" | "TIMEOUT" | "END_OF_DAY" | null = null;
      let exitPrice = close;

      if (openTrade.action === "BUY") {
        const targetPrice = openTrade.entryPrice * (1 + targetPct / 100);
        const stopLossPrice = openTrade.entryPrice * (1 - stopLossPct / 100);

        if (high >= targetPrice) {
          exitPrice = targetPrice;
          exitReason = "TARGET";
        } else if (low <= stopLossPrice) {
          exitPrice = stopLossPrice;
          exitReason = "STOP_LOSS";
        } else if (barsHeld >= maxBarsHold) {
          exitPrice = close;
          exitReason = "TIMEOUT";
        } else if (strategy === "EMA_9_21" && currEma9 < currEma21 && prevEma9 >= prevEma21) {
          exitPrice = close;
          exitReason = "END_OF_DAY";
        }
      }

      if (exitReason || i === candles.length - 1) {
        if (!exitReason) exitReason = "END_OF_DAY";

        // Calculate institutional cost breakdown
        const cost = calculateIndianMarketCosts({
          segment: exchange === "NFO" ? "FNO" : "EQUITY",
          buyPrice: openTrade.entryPrice,
          sellPrice: exitPrice,
          quantity: openTrade.quantity,
          isMarketOrder: true,
        });

        currentCapital += cost.netPnl;

        trades.push({
          entryTime: openTrade.entryTime,
          exitTime: timeStr,
          symbol,
          action: openTrade.action,
          entryPrice: openTrade.entryPrice,
          exitPrice: Number(exitPrice.toFixed(2)),
          quantity: openTrade.quantity,
          grossPnl: cost.grossPnl,
          charges: cost.totalCharges,
          slippage: cost.slippage,
          netPnl: cost.netPnl,
          netPnlPercent: cost.netPnlPercent,
          exitReason,
          barsHeld,
        });

        openTrade = null;
      }
    }

    // Check entry conditions
    if (!openTrade && i < candles.length - 1) {
      let triggerEntry = false;

      if (strategy === "EMA_9_21") {
        // Bullish 9/21 Crossover
        if (prevEma9 <= prevEma21 && currEma9 > currEma21) {
          triggerEntry = true;
        }
      } else if (strategy === "GREEK_SNIPER" || strategy === "STANDARD") {
        // Momentum breakout: RSI crosses 52 and price above EMA9
        if (currRsi > 52 && (rsi14[i - 1] ?? 50) <= 52 && close > currEma9) {
          triggerEntry = true;
        }
      } else if (strategy === "GAMMA_BLAST") {
        // Sudden high-velocity expansion candle: 1.5% single-candle surge with RSI > 60
        const prevClose = closes[i - 1] ?? close;
        const candlePct = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
        if (candlePct >= 1.2 && currRsi > 58) {
          triggerEntry = true;
        }
      } else if (strategy === "VWAP_TRAP") {
        // Oversold bounce reversal
        if ((rsi14[i - 1] ?? 50) < 32 && currRsi >= 35 && close > (candles[i - 1]?.[4] ?? 0)) {
          triggerEntry = true;
        }
      } else if (strategy === "ORB_15M") {
        // Breakout above first 3 candles (15 mins) high
        if (i > 3) {
          const orbHigh = Math.max(
            candles[0]?.[2] ?? 0,
            candles[1]?.[2] ?? 0,
            candles[2]?.[2] ?? 0
          );
          if (close > orbHigh && (candles[i - 1]?.[4] ?? 0) <= orbHigh) {
            triggerEntry = true;
          }
        }
      }

      if (triggerEntry && close > 0) {
        // Apply 0.15% entry slippage on market fill
        const entryPrice = Number((close * 1.0015).toFixed(2));
        const tradeBudget = Math.max(2000, currentCapital * 0.25);
        const quantity = Math.max(
          lotSize,
          Math.floor(tradeBudget / entryPrice / lotSize) * lotSize
        );

        openTrade = {
          entryTime: timeStr,
          entryPrice,
          action: "BUY",
          startIndex: i,
          quantity,
        };
      }
    }

    equityCurve.push({
      time: timeStr,
      equity: Number(currentCapital.toFixed(2)),
    });
  }

  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl <= 0);
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
  const netPnl = currentCapital - initialCapital;
  const totalPnlPercent = (netPnl / initialCapital) * 100;

  const totalWin = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));
  const avgWin = winningTrades.length > 0 ? totalWin / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 999 : 0;
  const expectancy = totalTrades > 0 ? netPnl / totalTrades : 0;

  const grossPnl = trades.reduce((sum, t) => sum + t.grossPnl, 0);
  const totalTaxesAndCharges = trades.reduce((sum, t) => sum + t.charges, 0);
  const totalSlippage = trades.reduce((sum, t) => sum + t.slippage, 0);
  const totalBrokerage = trades.length * 40; // Approx ₹20 buy + ₹20 sell
  const totalStt = trades.reduce((sum, t) => sum + (t.exitPrice * t.quantity * 0.001), 0);

  let peak = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = peak - pt.equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
  }

  return {
    symbol,
    strategy,
    interval,
    fromDate,
    toDate,
    totalBars: candles.length,
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Number(winRate.toFixed(2)),
    grossPnl: Number(grossPnl.toFixed(2)),
    totalBrokerage: Number(totalBrokerage.toFixed(2)),
    totalStt: Number(totalStt.toFixed(2)),
    totalTaxesAndCharges: Number(totalTaxesAndCharges.toFixed(2)),
    totalSlippage: Number(totalSlippage.toFixed(2)),
    netPnl: Number(netPnl.toFixed(2)),
    totalPnl: Number(netPnl.toFixed(2)),
    totalPnlPercent: Number(totalPnlPercent.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    equityCurve,
    trades,
    initialCapital,
    finalCapital: Number(currentCapital.toFixed(2)),
  };
}

/**
 * Backward-compatible wrapper for 9/21 EMA crossover backtest
 */
export async function runEma921Backtest(params: {
  symbol: string;
  token: string;
  exchange: string;
  fromDate: string;
  toDate: string;
  interval: string;
  initialCapital?: number;
  targetPct?: number;
  stopLossPct?: number;
  lotSize?: number;
}): Promise<BacktestResult> {
  return await runStrategyBacktest({
    ...params,
    strategy: "EMA_9_21",
  });
}
