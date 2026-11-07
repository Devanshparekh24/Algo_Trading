// ---------------------------------------------------------------------------
// Backtesting Engine – Historical Strategy Performance (9/21 EMA Crossover)
// ---------------------------------------------------------------------------

import { getCandleData } from "../smartapi/api/historical.js";
import type { CandleData, HistoricalDataRequest } from "../smartapi/types.js";
import prisma from "../../config/prisma.js";

export type BacktestSignal = "BUY" | "SELL" | "HOLD";

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  symbol: string;
  action: BacktestSignal;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: "TARGET" | "STOP_LOSS" | "END_OF_DAY";
  barsHeld: number;
}

export interface BacktestEquityPoint {
  time: string;
  equity: number;
}

export interface BacktestResult {
  symbol: string;
  interval: string;
  fromDate: string;
  toDate: string;
  totalBars: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  expectancy: number;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  initialCapital: number;
  finalCapital: number;
}

function computeEMAArray(closes: number[], period: number): number[] {
  const result: number[] = [];
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
    ema = closes[i] * k + ema * (1 - k);
    result.push(Number(ema.toFixed(2)));
  }
  return result;
}
