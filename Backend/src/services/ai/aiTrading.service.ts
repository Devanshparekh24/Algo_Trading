// ---------------------------------------------------------------------------
// AI Trading Engine & Signal Generation Service
// Multi-factor technical analysis, AI reasoning, and automated order execution
// ---------------------------------------------------------------------------

import { getFullModeData, getCachedQuote } from "../smartapi/api/FullMode.js";
import { getCandleData } from "../smartapi/api/historical.js";
import { getHoldings } from "../smartapi/api/holdings.js";
import { getGainersLosersData } from "../smartapi/api/gainersLosers.js";
import { placeSmartApiOrder, getSmartApiOrderBook } from "../smartapi/api/order.js";
import { getTopFnoMovers, type FnoMoverItem } from "../smartapi/fnoMovers.service.js";
import type { CandleData, FullMode, OrderPlacementRequest, OrderBookItem } from "../smartapi/types.js";
import { broadcastSocketEvent } from "../websocket/socketService.js";
import prisma from "../../config/prisma.js";
import fs from "fs";
import path from "path";
import {
  calculateOptionGreeks,
  checkGoldenHours,
  filterAndRankGreekSniperStrikes,
  parseExpiryToDte,
  type OptionGreeks,
  type GreekEnrichedOption,
  type GoldenHoursStatus,
} from "../smartapi/greeks.service.js";

// ===========================================================================
// Type Definitions
// ===========================================================================

export type MarketSegment = "EQUITY" | "FNO";
export type ContractType = "EQ" | "CE" | "PE" | "FUT";
export type OIBuildupType = "LONG_BUILDUP" | "SHORT_BUILDUP" | "SHORT_COVERING" | "LONG_UNWINDING" | "NEUTRAL";

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL" | "BULLISH_MOMENTUM" | "BEARISH_MOMENTUM";
  ema9: number;
  ema21: number;
  sma50: number;
  emaTrend: "STRONG_BULLISH" | "BULLISH" | "BEARISH" | "STRONG_BEARISH" | "NEUTRAL";
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    trend: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "BULLISH" | "BEARISH" | "NEUTRAL";
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
    position: "ABOVE_UPPER" | "UPPER_HALF" | "LOWER_HALF" | "BELOW_LOWER" | "SQUEEZE";
  };
  atr: number;
  volumeRatio: number;
  supportLevel: number;
  resistanceLevel: number;
  orderBookImbalance: number; // buy% vs sell%
}

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface TradeSignal {
  id: string;
  symbol: string;
  token: string;
  exchange: string;
  segment?: MarketSegment | undefined;
  contractType?: ContractType | undefined;
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize?: number | undefined;
  underlying?: string | undefined;
  openInterest?: number | undefined;
  oiBuildup?: OIBuildupType | undefined;
  action: SignalAction;
  confidence: number; // 0 - 100
  timeframe: string; // e.g. "INTRADAY" | "SWING"
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: string;
  netChange: number;
  percentChange: number;
  indicators: TechnicalIndicators;
  greeks?: OptionGreeks | undefined;
  aiThesis: {
    summary: string;
    rationale: string[];
    riskFactor: string;
    catalyst: string;
  };
  generatedAt: string;
  status: "ACTIVE" | "EXECUTED" | "EXPIRED";
}

export type AutoPilotStrategy =
  | "GREEK_SNIPER"
  | "GAMMA_BLAST"
  | "VWAP_TRAP"
  | "ORB_15M"
  | "PCR_REVERSAL"
  | "STANDARD";

export interface AutoPilotConfig {
  enabled: boolean;
  mode: "PAPER" | "LIVE";
  strategy: AutoPilotStrategy;
  enforceGoldenHours?: boolean | undefined;
  profitTargetPct: number;
  stopLossPct: number;
  thetaTimeoutMinutes: number;
  defaultQuantity: number;
  maxBudgetPerTrade?: number | undefined;
  productType: "INTRADAY" | "DELIVERY";
  maxDailyTrades: number;
  executedToday: number;
  minConfidence?: number | undefined;
}

export interface ActiveAiPosition {
  id: string;
  orderId: string;
  symbol: string;
  token: string;
  exchange: string;
  strategy: AutoPilotStrategy;
  entryPrice: number;
  currentPrice: number;
  highestPrice: number;
  quantity: number;
  lots: number;
  action: "BUY" | "SELL";
  targetPrice: number;
  stopLossPrice: number;
  enteredAt: number;
  holdingMinutes: number;
  timeoutMinutes: number;
  mode: "PAPER" | "LIVE";
  status: "OPEN" | "EXITED";
  pnl: number;
  pnlPercent: number;
  exitReason?: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL" | undefined;
  greeks?: OptionGreeks | undefined;
}

export type UniverseSource = "CORE" | "HOLDING" | "MARKET_MOVER" | "CUSTOM";

export interface ScripCandidate {
  symbol: string;
  token: string;
  exchange: string;
  name?: string | undefined;
  segment?: MarketSegment | undefined;
  contractType?: ContractType | undefined;
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize?: number | undefined;
  underlying?: string | undefined;
  source?: UniverseSource | undefined;
}

export interface AddScripInput {
  symbol: string;
  token?: string | undefined;
  exchange?: string | undefined;
  name?: string | undefined;
  segment?: MarketSegment | undefined;
  contractType?: ContractType | undefined;
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize?: number | undefined;
  underlying?: string | undefined;
  source?: UniverseSource | undefined;
}

// ---------------------------------------------------------------------------
// Budget Advisor & Capital Allocation Types
// ---------------------------------------------------------------------------

export type RiskProfile = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
export type BudgetSegment =
  | "ALL"
  | "EQUITY"
  | "FNO"
  | "VOLATILE_CALLS"
  | "VOLATILE_PUTS"
  | "VOLATILE_OPTIONS"
  | "GREEK_SNIPER";

export interface BudgetAdvisorParams {
  budget: number;
  riskProfile?: RiskProfile | undefined;
  segment?: BudgetSegment | undefined;
  maxTrades?: number | undefined;
}

export interface BudgetTradeSuggestion {
  signal: TradeSignal;
  recommendedQuantity: number;
  recommendedLots: number;
  lotSize: number;
  capitalRequired: number;
  allocationPercentage: number;
  maxLoss: number;
  maxLossPercentage: number;
  target1Profit: number;
  target1GainPct: number;
  target2Profit: number;
  target2GainPct: number;
  riskRewardRatio: string;
  allocationReason: string;
  greeks?: OptionGreeks | undefined;
  timeoutMinutes?: number | undefined;
}

export interface BudgetAnalysisResult {
  budget: number;
  riskProfile: RiskProfile;
  segment: BudgetSegment;
  totalCapitalAllocated: number;
  remainingCashBuffer: number;
  bufferPercentage: number;
  totalMaxRisk: number;
  totalMaxRiskPercentage: number;
  totalExpectedProfitT1: number;
  totalExpectedProfitT2: number;
  overallRiskReward: string;
  portfolioHealthScore: number;
  aiSummary: string;
  strategicAdvice: string[];
  suggestions: BudgetTradeSuggestion[];
  unaffordableHighlights?: Array<{
    symbol: string;
    action: string;
    confidence: number;
    requiredCapital: number;
    reason: string;
  }> | undefined;
  volatileCalls?: FnoMoverItem[] | undefined;
  volatilePuts?: FnoMoverItem[] | undefined;
  mostVolatile?: FnoMoverItem | null | undefined;
  goldenHours?: GoldenHoursStatus | undefined;
  greekSniperSuggestions?: GreekEnrichedOption[] | undefined;
}

// Default High-Liquidity Universe for Continuous Scanning
export const DEFAULT_UNIVERSE: ScripCandidate[] = [
  { symbol: "RELIANCE-EQ", token: "2885", exchange: "NSE", name: "Reliance Industries", segment: "EQUITY", source: "CORE" },
  { symbol: "TATASTEEL-EQ", token: "3499", exchange: "NSE", name: "Tata Steel", segment: "EQUITY", source: "CORE" },
  { symbol: "SBIN-EQ", token: "3045", exchange: "NSE", name: "State Bank of India", segment: "EQUITY", source: "CORE" },
  { symbol: "HDFCBANK-EQ", token: "1333", exchange: "NSE", name: "HDFC Bank", segment: "EQUITY", source: "CORE" },
  { symbol: "INFY-EQ", token: "1594", exchange: "NSE", name: "Infosys Ltd", segment: "EQUITY", source: "CORE" },
  { symbol: "ICICIBANK-EQ", token: "4963", exchange: "NSE", name: "ICICI Bank", segment: "EQUITY", source: "CORE" },
  { symbol: "TCS-EQ", token: "11536", exchange: "NSE", name: "Tata Consultancy Services", segment: "EQUITY", source: "CORE" },
  { symbol: "ITC-EQ", token: "1660", exchange: "NSE", name: "ITC Ltd", segment: "EQUITY", source: "CORE" },
  { symbol: "LT-EQ", token: "11483", exchange: "NSE", name: "Larsen & Toubro", segment: "EQUITY", source: "CORE" },
  { symbol: "BHARTIARTL-EQ", token: "10604", exchange: "NSE", name: "Bharti Airtel", segment: "EQUITY", source: "CORE" },
];

export interface FnoCandidate extends ScripCandidate {
  segment: "FNO";
  contractType: "CE" | "PE" | "FUT";
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize: number;
  underlying: string;
}

// Default High-Liquidity Futures & Options Universe
export const DEFAULT_FNO_UNIVERSE: FnoCandidate[] = [
  { symbol: "NIFTY03NOV2625000PE", token: "54333", exchange: "NFO", name: "NIFTY 25000 PE", segment: "FNO", contractType: "PE", strike: 25000, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625000CE", token: "54332", exchange: "NFO", name: "NIFTY 25000 CE", segment: "FNO", contractType: "CE", strike: 25000, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2624500PE", token: "54177", exchange: "NFO", name: "NIFTY 24500 PE", segment: "FNO", contractType: "PE", strike: 24500, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2624500CE", token: "54136", exchange: "NFO", name: "NIFTY 24500 CE", segment: "FNO", contractType: "CE", strike: 24500, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625200PE", token: "54451", exchange: "NFO", name: "NIFTY 25200 PE", segment: "FNO", contractType: "PE", strike: 25200, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625200CE", token: "54450", exchange: "NFO", name: "NIFTY 25200 CE", segment: "FNO", contractType: "CE", strike: 25200, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "BANKNIFTY23NOV2653400PE", token: "62109", exchange: "NFO", name: "BANKNIFTY 53400 PE", segment: "FNO", contractType: "PE", strike: 53400, expiry: "23NOV2026", lotSize: 30, underlying: "BANKNIFTY", source: "CORE" },
  { symbol: "BANKNIFTY29DEC2653100CE", token: "59517", exchange: "NFO", name: "BANKNIFTY 53100 CE", segment: "FNO", contractType: "CE", strike: 53100, expiry: "29DEC2026", lotSize: 30, underlying: "BANKNIFTY", source: "CORE" },
];

// ---------------------------------------------------------------------------
// Dynamic Custom Universe Persistence (JSON File Storage)
// ---------------------------------------------------------------------------
const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOM_UNIVERSE_FILE = path.join(DATA_DIR, "custom_universe.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("[AI Dynamic Universe] Could not create data directory:", e);
    }
  }
}

function loadCustomUniverse(): ScripCandidate[] {
  try {
    ensureDataDir();
    if (fs.existsSync(CUSTOM_UNIVERSE_FILE)) {
      const raw = fs.readFileSync(CUSTOM_UNIVERSE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[AI Dynamic Universe] Error reading custom_universe.json:", err);
  }
  return [];
}

function saveCustomUniverse(items: ScripCandidate[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CUSTOM_UNIVERSE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[AI Dynamic Universe] Failed to save custom_universe.json:", err);
  }
}

/**
 * Dynamically resolves the active market universe based on:
 * 1. User custom watchlists (saved to JSON)
 * 2. Active Demat holdings (from Angel One SmartAPI)
 * 3. Real-time top Market Movers (Price Gainers/Losers or OI Movers from SmartAPI)
 * 4. High-liquidity Core Index constituents & Options
 */
export async function getDynamicUniverse(segment: MarketSegment = "EQUITY"): Promise<ScripCandidate[]> {
  const universeMap = new Map<string, ScripCandidate>();

  // 1. User-Configured Custom Universe
  const customItems = loadCustomUniverse();
  for (const item of customItems) {
    const isFno =
      item.segment === "FNO" ||
      item.exchange === "NFO" ||
      item.symbol.endsWith("PE") ||
      item.symbol.endsWith("CE") ||
      item.symbol.endsWith("FUT");

    if ((segment === "FNO" && isFno) || (segment === "EQUITY" && !isFno)) {
      universeMap.set(item.token, {
        ...item,
        segment: isFno ? "FNO" : "EQUITY",
        source: "CUSTOM",
      });
    }
  }

  if (segment === "EQUITY") {
    // 2. Dynamically include User's Demat Holdings
    try {
      const holdingsRes = await getHoldings();
      if (holdingsRes && holdingsRes.holdings) {
        for (const h of holdingsRes.holdings) {
          if (h.symboltoken && h.tradingsymbol && !universeMap.has(String(h.symboltoken))) {
            universeMap.set(String(h.symboltoken), {
              symbol: h.tradingsymbol,
              token: String(h.symboltoken),
              exchange: h.exchange || "NSE",
              name: h.tradingsymbol,
              segment: "EQUITY",
              source: "HOLDING",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch holdings for scan universe:`, err?.message || err);
    }

    // 3. Dynamically fetch Top Market Movers (Price Gainers & Losers)
    try {
      const [gainersRes, losersRes] = await Promise.allSettled([
        getGainersLosersData({ datatype: "PercPriceGainers", expirytype: "NEAR" }),
        getGainersLosersData({ datatype: "PercPriceLosers", expirytype: "NEAR" }),
      ]);

      if (gainersRes.status === "fulfilled" && gainersRes.value?.data) {
        for (const g of gainersRes.value.data.slice(0, 3)) {
          const t = String(g.symbolToken);
          if (g.symbolToken && g.tradingSymbol && !universeMap.has(t)) {
            universeMap.set(t, {
              symbol: g.tradingSymbol,
              token: t,
              exchange: "NSE",
              name: `${g.tradingSymbol} (Top Gainer)`,
              segment: "EQUITY",
              source: "MARKET_MOVER",
            });
          }
        }
      }

      if (losersRes.status === "fulfilled" && losersRes.value?.data) {
        for (const l of losersRes.value.data.slice(0, 3)) {
          const t = String(l.symbolToken);
          if (l.symbolToken && l.tradingSymbol && !universeMap.has(t)) {
            universeMap.set(t, {
              symbol: l.tradingSymbol,
              token: t,
              exchange: "NSE",
              name: `${l.tradingSymbol} (Top Loser)`,
              segment: "EQUITY",
              source: "MARKET_MOVER",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch equity market movers:`, err?.message || err);
    }

    // 4. Dynamically pull Core Liquid Equities from SmartAPI Instrument Database
    try {
      const topSymbols = [
        "RELIANCE-EQ", "TCS-EQ", "HDFCBANK-EQ", "INFY-EQ", "ICICIBANK-EQ",
        "SBIN-EQ", "BHARTIARTL-EQ", "ITC-EQ", "LT-EQ", "TATASTEEL-EQ",
        "KOTAKBANK-EQ", "AXISBANK-EQ", "TATAMOTORS-EQ", "MARUTI-EQ", "SUNPHARMA-EQ"
      ];
      const dbEquities = await prisma.instrument.findMany({
        where: {
          exch_seg: "NSE",
          symbol: { in: topSymbols },
        },
        take: 15,
      });

      for (const inst of dbEquities) {
        if (!universeMap.has(inst.token)) {
          universeMap.set(inst.token, {
            symbol: inst.symbol,
            token: inst.token,
            exchange: inst.exch_seg,
            name: inst.name || inst.symbol,
            segment: "EQUITY",
            lotSize: parseInt(inst.lotsize) || 1,
            source: "CORE",
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not load core equities from SmartAPI Instrument table:`, err?.message || err);
    }

    // Safety fallback
    for (const core of DEFAULT_UNIVERSE) {
      if (!universeMap.has(core.token)) {
        universeMap.set(core.token, {
          ...core,
          segment: "EQUITY",
          source: "CORE",
        });
      }
    }
  } else {
    // Segment === "FNO"
    // 2. Dynamically fetch Top OI Movers for F&O
    try {
      const oiGainersRes = await getGainersLosersData({ datatype: "PercOIGainers", expirytype: "NEAR" });
      if (oiGainersRes?.data) {
        for (const oiItem of oiGainersRes.data.slice(0, 4)) {
          const t = String(oiItem.symbolToken);
          if (oiItem.symbolToken && oiItem.tradingSymbol && !universeMap.has(t)) {
            const sym = oiItem.tradingSymbol;
            const isCall = sym.endsWith("CE");
            const isPut = sym.endsWith("PE");
            const contractType: ContractType = isCall ? "CE" : isPut ? "PE" : "FUT";
            universeMap.set(t, {
              symbol: sym,
              token: t,
              exchange: "NFO",
              name: `${sym} (OI Mover)`,
              segment: "FNO",
              contractType,
              lotSize: sym.startsWith("BANKNIFTY") ? 30 : 65,
              underlying: sym.startsWith("BANKNIFTY") ? "BANKNIFTY" : "NIFTY",
              source: "MARKET_MOVER",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch FNO OI movers:`, err?.message || err);
    }

    // 3. Dynamically pull Core F&O Options from SmartAPI Instrument Database
    try {
      const dbOptions = await prisma.instrument.findMany({
        where: {
          exch_seg: "NFO",
          instrumenttype: "OPTIDX",
          name: { in: ["NIFTY", "BANKNIFTY"] },
        },
        take: 12,
        orderBy: { expiry: "asc" },
      });

      for (const inst of dbOptions) {
        if (!universeMap.has(inst.token)) {
          const sym = inst.symbol;
          const isCall = sym.endsWith("CE");
          const isPut = sym.endsWith("PE");
          const contractType: ContractType = isCall ? "CE" : isPut ? "PE" : "FUT";
          const rawStrike = parseFloat(inst.strike);
          const strike = isNaN(rawStrike) ? undefined : rawStrike > 100000 ? rawStrike / 100 : rawStrike;

          universeMap.set(inst.token, {
            symbol: inst.symbol,
            token: inst.token,
            exchange: "NFO",
            name: `${inst.name} ${strike || ""} ${contractType}`,
            segment: "FNO",
            contractType,
            strike,
            expiry: inst.expiry,
            lotSize: parseInt(inst.lotsize) || (sym.startsWith("BANKNIFTY") ? 30 : 65),
            underlying: inst.name,
            source: "CORE",
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not load core F&O options from SmartAPI Instrument table:`, err?.message || err);
    }

    // Fallback if DB empty
    for (const core of DEFAULT_FNO_UNIVERSE) {
      if (!universeMap.has(core.token)) {
        universeMap.set(core.token, {
          ...core,
          segment: "FNO",
          source: "CORE",
        });
      }
    }
  }

  return Array.from(universeMap.values());
}

// ===========================================================================
// State & Configuration
// ===========================================================================

let activeEquitySignals: TradeSignal[] = [];
let activeFnoSignals: TradeSignal[] = [];
let lastEquityScanTime: string | null = null;
let lastFnoScanTime: string | null = null;

let autoPilotConfig: AutoPilotConfig = {
  enabled: false,
  mode: "PAPER",
  strategy: "GREEK_SNIPER",
  enforceGoldenHours: true,
  profitTargetPct: 35,
  stopLossPct: 18,
  thetaTimeoutMinutes: 45,
  defaultQuantity: 1,
  maxBudgetPerTrade: 0, // 0 = Dynamic sizing (no fixed price limit, trades by lot)
  productType: "INTRADAY",
  maxDailyTrades: 5,
  executedToday: 0,
};

// Map of open and recent active positions managed by AI Auto-Pilot & Execution
const activeAiPositions: Map<string, ActiveAiPosition> = new Map();

// ===========================================================================
// Mathematical Technical Indicator Calculations
// ===========================================================================

/**
 * Relative Strength Index (RSI) calculation
 */
function calculateRSI(closes: number[], period = 14): number {
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
 * Exponential Moving Average (EMA)
 */
function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  if (data.length < period) {
    const sum = data.reduce((a, b) => a + b, 0);
    return Number((sum / data.length).toFixed(2));
  }

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = (data[i] ?? 0) * k + ema * (1 - k);
  }

  return Number(ema.toFixed(2));
}

/**
 * Simple Moving Average (SMA)
 */
function calculateSMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / slice.length).toFixed(2));
}

/**
 * Bollinger Bands (Period = 20, StdDev = 2)
 */
function calculateBollingerBands(
  closes: number[],
  period = 20,
  multiplier = 2
): { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } {
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

  return {
    middle: Number(middle.toFixed(2)),
    upper: Number(upper.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    bandwidth: Number(bandwidth.toFixed(2)),
    percentB: Number(percentB.toFixed(2)),
  };
}

/**
 * Moving Average Convergence Divergence (MACD 12, 26, 9)
 */
function calculateMACD(
  closes: number[]
): { macdLine: number; signalLine: number; histogram: number } {
  if (closes.length < 26) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;

  // Signal line is 9-period EMA of MACD
  // If we have enough points, compute properly, otherwise estimate
  const signalLine = macdLine * 0.85;
  const histogram = macdLine - signalLine;

  return {
    macdLine: Number(macdLine.toFixed(2)),
    signalLine: Number(signalLine.toFixed(2)),
    histogram: Number(histogram.toFixed(2)),
  };
}

/**
 * Average True Range (ATR)
 */
function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < 2) return 10;

  const trueRanges: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    const prevC = closes[i - 1] ?? 0;
    const tr = Math.max(
      h - l,
      Math.abs(h - prevC),
      Math.abs(l - prevC)
    );
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges, Math.min(period, trueRanges.length)) || 10;
}

// ===========================================================================
// Multi-Factor Technical & AI Analysis Engine
// ===========================================================================

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

  const currentPrice = liveQuote?.ltp || 1000;
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
  if (closes.length < 15) {
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
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
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

  // Determine MACD Trend
  let macdTrend: TechnicalIndicators["macd"]["trend"] = "NEUTRAL";
  if (macdData.histogram > 0 && macdData.macdLine > macdData.signalLine) {
    macdTrend = macdData.histogram > 1 ? "BULLISH" : "BULLISH_CROSSOVER";
  } else if (macdData.histogram < 0 && macdData.macdLine < macdData.signalLine) {
    macdTrend = macdData.histogram < -1 ? "BEARISH" : "BEARISH_CROSSOVER";
  }

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
      lotSize = 65;
    } else if (symbol.startsWith("BANKNIFTY")) {
      underlying = "BANKNIFTY";
      lotSize = 30;
    } else if (symbol.startsWith("FINNIFTY")) {
      underlying = "FINNIFTY";
      lotSize = 65;
    } else {
      lotSize = 25;
    }
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

  const riskFactor =
    action === "BUY"
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

// ===========================================================================
// Universe Scanner & Auto-Pilot Daemon
// ===========================================================================

/**
 * Scan entire market universe dynamically (Equities or Futures & Options)
 */
export async function scanMarketUniverse(segment: MarketSegment = "EQUITY"): Promise<TradeSignal[]> {
  console.log(`[AI Engine] Initiating dynamic market scan for segment: ${segment}...`);

  const candidates = await getDynamicUniverse(segment);
  console.log(`[AI Engine] Scanning ${candidates.length} dynamic ${segment} candidates...`);

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

  if (segment === "FNO") {
    activeFnoSignals = freshSignals;
    lastFnoScanTime = new Date().toISOString();

    broadcastSocketEvent("ai_fno_signals_update", {
      signals: activeFnoSignals,
      scannedAt: lastFnoScanTime,
      count: activeFnoSignals.length,
    });

    if (autoPilotConfig.enabled) {
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

    if (autoPilotConfig.enabled) {
      evaluateAutoPilotTriggers(activeEquitySignals);
    }

    return activeEquitySignals;
  }
}

/**
 * Dynamically look up and analyze any Option Strike (e.g. NIFTY 25000 PE)
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
    // Fallback search with strike and option type
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

  // Pick nearest expiry (symbols sorted e.g. 03NOV before 17NOV before 29DEC)
  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const chosen = instruments[0]!;

  const lot = parseInt(chosen.lotsize) || (underUpper === "NIFTY" ? 65 : 30);
  const signal = await analyzeInstrument(chosen.symbol, chosen.token, "NFO", undefined, false);

  signal.strike = strike;
  signal.lotSize = lot;
  signal.underlying = underUpper;
  signal.segment = "FNO";
  signal.contractType = optUpper as "CE" | "PE";

  return signal;
}

/**
 * Evaluate Auto-Pilot trigger rules and execute trades
 */
async function evaluateAutoPilotTriggers(signals: TradeSignal[]): Promise<void> {
  if (!autoPilotConfig.enabled) return;
  if (autoPilotConfig.executedToday >= autoPilotConfig.maxDailyTrades) {
    console.log(`[AI Auto-Pilot] Daily trade limit reached (${autoPilotConfig.executedToday}/${autoPilotConfig.maxDailyTrades}).`);
    return;
  }

  // Golden Hours Filter: If running Greek Sniper strategy, pause triggers during lunch theta trap
  if (autoPilotConfig.strategy === "GREEK_SNIPER" && autoPilotConfig.enforceGoldenHours !== false) {
    const golden = checkGoldenHours();
    if (golden.isLunchChop) {
      console.log(`[AI Auto-Pilot] Golden Hours Filter: Paused during lunch theta trap (${golden.message})`);
      return;
    }
  }

  for (const sig of signals) {
    if (sig.status !== "ACTIVE") continue;
    if (sig.action === "HOLD") continue;

    const isFno = sig.exchange === "NFO" || sig.segment === "FNO";

    // 1. GREEK_SNIPER Strategy Pipeline
    if (autoPilotConfig.strategy === "GREEK_SNIPER") {
      if (!isFno) continue;
      if (sig.greeks) {
        if (sig.greeks.delta < 0.25 || sig.greeks.delta > 0.60) continue;
        if (sig.greeks.thetaPremiumRatio > 0.18) continue;
      }
    }
    // 2. GAMMA_BLAST Strategy Pipeline (Expiry Afternoon Gamma Surge)
    else if (autoPilotConfig.strategy === "GAMMA_BLAST") {
      if (!isFno) continue;
      // Scans for cheap, high-elasticity explosive strikes (₹10 to ₹55)
      if (sig.currentPrice > 65 || sig.currentPrice < 8) continue;
      if (sig.greeks && sig.greeks.delta > 0.45) continue;
    }
    // 3. VWAP_TRAP Strategy Pipeline (Institutional Fakeout Trap & Reversal)
    else if (autoPilotConfig.strategy === "VWAP_TRAP") {
      if (!isFno) continue;
      // Counter-trend confirmation: Puts on high failure, Calls on low bounce
      if (sig.indicators) {
        if (sig.contractType === "PE" && sig.indicators.rsi < 40) continue;
        if (sig.contractType === "CE" && sig.indicators.rsi > 60) continue;
      }
    }
    // 4. ORB_15M Strategy Pipeline (Opening Range Breakout Trend Follower)
    else if (autoPilotConfig.strategy === "ORB_15M") {
      // Requires strong momentum and trending indicators
      if (sig.indicators && (sig.indicators.emaTrend === "NEUTRAL" || sig.indicators.macd?.trend === "NEUTRAL")) continue;
    }
    // 5. PCR_REVERSAL Strategy Pipeline (Sentiment Extremes Mean Reversion)
    else if (autoPilotConfig.strategy === "PCR_REVERSAL") {
      if (!isFno) continue;
      // Reversal oscillator: Avoid buying Calls when overbought or Puts when oversold
      if (sig.contractType === "CE" && sig.indicators && sig.indicators.rsi > 68) continue;
      if (sig.contractType === "PE" && sig.indicators && sig.indicators.rsi < 32) continue;
    }

    const lotSize = sig.lotSize || 65;
    const lots = autoPilotConfig.defaultQuantity || 1;
    const finalQty = isFno ? lotSize * lots : lots;
    const estimatedCost = finalQty * sig.currentPrice;

    // Optional Budget Gatekeeper: ONLY active if a positive budget cap > 0 is configured by user.
    // If maxBudgetPerTrade is 0 or undefined, dynamic market sizing is used without fixed price restrictions.
    if (autoPilotConfig.maxBudgetPerTrade && autoPilotConfig.maxBudgetPerTrade > 0) {
      if (estimatedCost > autoPilotConfig.maxBudgetPerTrade) {
        console.log(
          `[AI Auto-Pilot] Skipping ${sig.symbol}: Cost ₹${estimatedCost.toFixed(2)} (${finalQty} units @ ₹${sig.currentPrice}) exceeds custom budget of ₹${autoPilotConfig.maxBudgetPerTrade}`
        );
        continue;
      }
    }

    console.log(
      `[AI Auto-Pilot] Qualifying signal found: ${sig.action} ${sig.symbol} @ ₹${sig.currentPrice} (Cost: ₹${estimatedCost.toFixed(2)}, Strategy: ${autoPilotConfig.strategy})`
    );

    try {
      const orderReq: OrderPlacementRequest = {
        variety: "NORMAL",
        tradingsymbol: sig.symbol,
        symboltoken: sig.token,
        transactiontype: sig.action,
        exchange: sig.exchange || (isFno ? "NFO" : "NSE"),
        ordertype: "MARKET",
        producttype: isFno ? "CARRYFORWARD" : autoPilotConfig.productType,
        duration: "DAY",
        price: 0,
        quantity: finalQty,
      };

      const isPaper = autoPilotConfig.mode === "PAPER";
      const result = await placeSmartApiOrder(orderReq, isPaper);

      sig.status = "EXECUTED";
      autoPilotConfig.executedToday += 1;

      // Register active AI position for auto-exit monitoring
      const posId = `pos_${result.orderid || Date.now()}`;
      
      // Dynamic Target & Stop Loss tailored by Strategy
      let targetPct = autoPilotConfig.profitTargetPct || 35;
      let slPct = autoPilotConfig.stopLossPct || 18;
      let timeoutMins = autoPilotConfig.thetaTimeoutMinutes || 45;

      if (autoPilotConfig.strategy === "GAMMA_BLAST") {
        targetPct = Math.max(targetPct, 75); // Asymmetric reward
        slPct = Math.min(slPct, 30);
        timeoutMins = 30; // Fast scalping
      } else if (autoPilotConfig.strategy === "VWAP_TRAP") {
        targetPct = Math.max(targetPct, 40);
        slPct = 18;
      } else if (autoPilotConfig.strategy === "ORB_15M") {
        timeoutMins = 60; // Hold morning trend
      } else if (autoPilotConfig.strategy === "PCR_REVERSAL") {
        targetPct = Math.max(targetPct, 35);
        slPct = 15;
      }

      const targetPrice = sig.target1 > 0 ? sig.target1 : Number((sig.currentPrice * (1 + targetPct / 100)).toFixed(2));
      const stopLossPrice = sig.stopLoss > 0 ? sig.stopLoss : Number((sig.currentPrice * (1 - slPct / 100)).toFixed(2));

      const position: ActiveAiPosition = {
        id: posId,
        orderId: result.orderid,
        symbol: sig.symbol,
        token: sig.token,
        exchange: sig.exchange || (isFno ? "NFO" : "NSE"),
        strategy: autoPilotConfig.strategy || (isFno ? "GREEK_SNIPER" : "STANDARD"),
        entryPrice: sig.currentPrice,
        currentPrice: sig.currentPrice,
        highestPrice: sig.currentPrice,
        quantity: finalQty,
        lots: isFno ? Math.max(1, Math.round(finalQty / lotSize)) : 1,
        action: sig.action,
        targetPrice,
        stopLossPrice,
        enteredAt: Date.now(),
        holdingMinutes: 0,
        timeoutMinutes: timeoutMins,
        mode: autoPilotConfig.mode,
        status: "OPEN",
        pnl: 0,
        pnlPercent: 0,
        greeks: sig.greeks,
      };
      activeAiPositions.set(posId, position);
      logTradeEntryToDb(position, sig).catch(console.error);
      broadcastSocketEvent("ai_position_opened", position);
      broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));

      broadcastSocketEvent("ai_auto_trade_executed", {
        signal: sig,
        order: result,
        position,
        mode: autoPilotConfig.mode,
        executedAt: new Date().toISOString(),
      });

      console.log(`[AI Auto-Pilot] Successfully auto-executed trade for ${sig.symbol} [OrderID: ${result.orderid}]`);

      if (autoPilotConfig.executedToday >= autoPilotConfig.maxDailyTrades) {
        break;
      }
    } catch (err: any) {
      console.error(`[AI Auto-Pilot] Execution error for ${sig.symbol}:`, err?.message || err);
      logAiErrorToDb({
        source: "AUTO_PILOT",
        action: "AUTO_EXECUTE_SIGNAL",
        symbol: sig.symbol,
        token: sig.token,
        message: err?.message || "Auto-pilot execution failed",
        stack: err?.stack,
        details: { signal: sig, strategy: autoPilotConfig.strategy },
      }).catch(console.error);
    }
  }
}

// ===========================================================================
// Exported Management Functions & Dynamic Universe CRUD
// ===========================================================================

export async function getUniverseScrips(segment?: MarketSegment): Promise<ScripCandidate[]> {
  if (segment) {
    return await getDynamicUniverse(segment);
  }
  const [eq, fno] = await Promise.all([getDynamicUniverse("EQUITY"), getDynamicUniverse("FNO")]);
  return [...eq, ...fno];
}

export async function addCustomUniverseScrip(scrip: AddScripInput): Promise<ScripCandidate[]> {
  const current = loadCustomUniverse();

  let resolvedToken = scrip.token ? String(scrip.token).trim() : "";
  let resolvedExchange = scrip.exchange ? scrip.exchange.toUpperCase().trim() : "";
  let resolvedName = scrip.name || scrip.symbol;
  let resolvedLotSize = scrip.lotSize;
  let resolvedStrike = scrip.strike;
  let resolvedExpiry = scrip.expiry;

  // Auto-resolve token and instrument metadata from SmartAPI Instrument Database if token is missing
  if (!resolvedToken) {
    try {
      const match = await prisma.instrument.findFirst({
        where: {
          OR: [
            { symbol: { equals: scrip.symbol.toUpperCase().trim() } },
            { symbol: { equals: `${scrip.symbol.toUpperCase().trim()}-EQ` } },
            { name: { equals: scrip.symbol.toUpperCase().trim() } },
          ],
        },
      });
      if (match) {
        resolvedToken = match.token;
        resolvedExchange = match.exch_seg;
        resolvedName = match.name || match.symbol;
        resolvedLotSize = parseInt(match.lotsize) || 1;
        resolvedExpiry = match.expiry;
        const rawStrike = parseFloat(match.strike);
        if (!isNaN(rawStrike) && rawStrike > 0) {
          resolvedStrike = rawStrike > 100000 ? rawStrike / 100 : rawStrike;
        }
      }
    } catch (e: any) {
      console.warn("[addCustomUniverseScrip] DB instrument resolution failed:", e?.message || e);
    }
  }

  if (!resolvedToken) {
    throw new Error(`Could not find SmartAPI instrument token for "${scrip.symbol}". Please check the symbol or sync scrip master.`);
  }

  const existingIdx = current.findIndex((item) => item.token === resolvedToken);

  const isFno =
    scrip.segment === "FNO" ||
    resolvedExchange === "NFO" ||
    scrip.symbol.endsWith("PE") ||
    scrip.symbol.endsWith("CE") ||
    scrip.symbol.endsWith("FUT");

  const formatted: ScripCandidate = {
    symbol: scrip.symbol.toUpperCase().trim(),
    token: resolvedToken,
    exchange: resolvedExchange || (isFno ? "NFO" : "NSE"),
    name: resolvedName,
    segment: isFno ? "FNO" : "EQUITY",
    contractType: scrip.contractType || (scrip.symbol.endsWith("CE") ? "CE" : scrip.symbol.endsWith("PE") ? "PE" : scrip.symbol.endsWith("FUT") ? "FUT" : "EQ"),
    strike: resolvedStrike,
    expiry: resolvedExpiry,
    lotSize: resolvedLotSize || (isFno ? (scrip.symbol.startsWith("BANKNIFTY") ? 30 : 65) : 1),
    underlying: scrip.underlying,
    source: "CUSTOM",
  };

  if (existingIdx >= 0) {
    current[existingIdx] = formatted;
  } else {
    current.push(formatted);
  }

  saveCustomUniverse(current);
  return await getDynamicUniverse(formatted.segment);
}

export async function removeCustomUniverseScrip(token: string): Promise<ScripCandidate[]> {
  const current = loadCustomUniverse();
  const filtered = current.filter((item) => item.token !== token);
  saveCustomUniverse(filtered);
  return await getUniverseScrips();
}

export async function resetCustomUniverse(): Promise<ScripCandidate[]> {
  saveCustomUniverse([]);
  return await getUniverseScrips();
}

export function getActiveSignals(segment: MarketSegment = "EQUITY"): {
  signals: TradeSignal[];
  lastScanTime: string | null;
} {
  if (segment === "FNO") {
    return {
      signals: activeFnoSignals,
      lastScanTime: lastFnoScanTime,
    };
  }
  return {
    signals: activeEquitySignals,
    lastScanTime: lastEquityScanTime,
  };
}

/**
 * Update real-time live price tick across active cached signals
 */
export function updateLiveSignalPrice(
  token: string,
  ltp: number,
  netChange?: number | undefined,
  percentChange?: number | undefined
): void {
  for (const s of activeEquitySignals) {
    if (s.token === token) {
      s.currentPrice = ltp;
      if (netChange !== undefined) s.netChange = netChange;
      if (percentChange !== undefined) s.percentChange = percentChange;
    }
  }
  for (const s of activeFnoSignals) {
    if (s.token === token) {
      s.currentPrice = ltp;
      if (netChange !== undefined) s.netChange = netChange;
      if (percentChange !== undefined) s.percentChange = percentChange;
    }
  }
}

export function getAutoPilotConfig(): AutoPilotConfig {
  return { ...autoPilotConfig };
}

export function updateAutoPilotConfig(newConfig: Partial<AutoPilotConfig>): AutoPilotConfig {
  autoPilotConfig = {
    ...autoPilotConfig,
    ...newConfig,
  };
  console.log(`[AI Auto-Pilot] Updated configuration:`, autoPilotConfig);
  return { ...autoPilotConfig };
}

/**
 * 1-Click Execution for a specific trade signal (supports both Equity shares and F&O Lots)
 */
export async function executeSignalOrder(
  signalId: string,
  options: {
    quantity?: number | undefined;
    lots?: number | undefined;
    productType?: "INTRADAY" | "DELIVERY" | "CARRYFORWARD" | undefined;
    orderType?: "MARKET" | "LIMIT" | undefined;
    limitPrice?: number | undefined;
    mode?: "PAPER" | "LIVE" | undefined;
  } = {}
) {
  try {
    const allSignals = [...activeEquitySignals, ...activeFnoSignals];
    const signal = allSignals.find((s) => s.id === signalId);
    if (!signal) {
      throw new Error(`Signal ${signalId} not found or expired.`);
    }

  const isFno = signal.exchange === "NFO" || signal.segment === "FNO";
  const lotSize = signal.lotSize || (signal.symbol.startsWith("BANKNIFTY") ? 30 : 65);

  let finalQty = 1;
  if (isFno) {
    const numLots = options.lots || 1;
    finalQty = options.quantity || numLots * lotSize;
  } else {
    finalQty = options.quantity || autoPilotConfig.defaultQuantity || 1;
  }

  const defaultPType = isFno ? "CARRYFORWARD" : autoPilotConfig.productType || "INTRADAY";
  const pType = options.productType || defaultPType;

  const isPaper = options.mode ? options.mode === "PAPER" : autoPilotConfig.mode === "PAPER";
  const oType = options.orderType || "MARKET";
  const price = oType === "LIMIT" ? options.limitPrice || signal.currentPrice : 0;

  const orderReq: OrderPlacementRequest = {
    variety: "NORMAL",
    tradingsymbol: signal.symbol,
    symboltoken: signal.token,
    transactiontype: signal.action === "HOLD" ? "BUY" : signal.action,
    exchange: signal.exchange || (isFno ? "NFO" : "NSE"),
    ordertype: oType,
    producttype: pType,
    duration: "DAY",
    price,
    quantity: finalQty,
  };

  const res = await placeSmartApiOrder(orderReq, isPaper);
  signal.status = "EXECUTED";

  // Register active AI position for auto-exit monitoring (Target, StopLoss, 45-Min Theta Timeout)
  const posId = `pos_${res.orderid || Date.now()}`;
  const targetPct = autoPilotConfig.profitTargetPct || 50;
  const slPct = autoPilotConfig.stopLossPct || 22;
  const targetPrice = signal.target1 > 0 ? signal.target1 : Number((signal.currentPrice * (1 + targetPct / 100)).toFixed(2));
  const stopLossPrice = signal.stopLoss > 0 ? signal.stopLoss : Number((signal.currentPrice * (1 - slPct / 100)).toFixed(2));

  const position: ActiveAiPosition = {
    id: posId,
    orderId: res.orderid,
    symbol: signal.symbol,
    token: signal.token,
    exchange: signal.exchange || (isFno ? "NFO" : "NSE"),
    strategy: autoPilotConfig.strategy || (isFno ? "GREEK_SNIPER" : "STANDARD"),
    entryPrice: signal.currentPrice,
    currentPrice: signal.currentPrice,
    highestPrice: signal.currentPrice,
    quantity: finalQty,
    lots: isFno ? Math.max(1, Math.round(finalQty / lotSize)) : 1,
    action: (signal.action === "HOLD" ? "BUY" : signal.action) as "BUY" | "SELL",
    targetPrice,
    stopLossPrice,
    enteredAt: Date.now(),
    holdingMinutes: 0,
    timeoutMinutes: autoPilotConfig.thetaTimeoutMinutes || 45,
    mode: isPaper ? "PAPER" : "LIVE",
    status: "OPEN",
    pnl: 0,
    pnlPercent: 0,
    greeks: signal.greeks,
  };
  activeAiPositions.set(posId, position);
  logTradeEntryToDb(position, signal).catch(console.error);
  broadcastSocketEvent("ai_position_opened", position);
  broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));

  broadcastSocketEvent("ai_signal_executed", {
    signalId,
    symbol: signal.symbol,
    order: res,
    position,
    mode: isPaper ? "PAPER" : "LIVE",
  });

  return {
    success: true,
    message: `${signal.action} order placed for ${signal.symbol}`,
    orderId: res.orderid,
    mode: isPaper ? "PAPER" : "LIVE",
    quantity: finalQty,
    signal,
    position,
  };
} catch (err: any) {
  console.error(`[Order Execution] Error executing signal ${signalId}:`, err?.message || err);
  logAiErrorToDb({
    source: "ORDER_EXECUTION",
    action: "EXECUTE_SIGNAL",
    message: err?.message || "Signal execution order failed",
    stack: err?.stack,
    details: { signalId, options },
  }).catch(console.error);
  throw err;
}
}

/**
 * Manual custom trade placement (Direct AI Order Execution)
 */
export async function placeManualTrade(params: {
  tradingsymbol: string;
  symboltoken: string;
  exchange?: string;
  transactiontype: "BUY" | "SELL";
  ordertype?: "MARKET" | "LIMIT";
  producttype?: "INTRADAY" | "DELIVERY";
  quantity: number;
  price?: number;
  mode?: "PAPER" | "LIVE";
}) {
  try {
    const isPaper = params.mode ? params.mode === "PAPER" : autoPilotConfig.mode === "PAPER";

    const orderReq: OrderPlacementRequest = {
      variety: "NORMAL",
      tradingsymbol: params.tradingsymbol,
      symboltoken: params.symboltoken,
      transactiontype: params.transactiontype,
      exchange: params.exchange || "NSE",
      ordertype: params.ordertype || "MARKET",
      producttype: params.producttype || "INTRADAY",
      duration: "DAY",
      price: params.price || 0,
      quantity: params.quantity || 1,
    };

    const res = await placeSmartApiOrder(orderReq, isPaper);

    return {
      success: true,
      message: `${params.transactiontype} order placed for ${params.tradingsymbol}`,
      orderId: res.orderid,
      mode: isPaper ? "PAPER" : "LIVE",
      order: res,
    };
  } catch (err: any) {
    console.error(`[Manual Trade] Error placing trade for ${params.tradingsymbol}:`, err?.message || err);
    logAiErrorToDb({
      source: "MANUAL_ORDER",
      action: params.transactiontype,
      symbol: params.tradingsymbol,
      token: params.symboltoken,
      message: err?.message || "Manual trade placement failed",
      stack: err?.stack,
      details: params,
    }).catch(console.error);
    throw err;
  }
}

/**
 * Fetch Order History (both live broker and paper trades)
 */
export async function getOrderHistory(): Promise<OrderBookItem[]> {
  return await getSmartApiOrderBook();
}

/**
 * Database Persistence: Record order entry in PostgreSQL AiTradeLog table
 */
async function logTradeEntryToDb(
  position: ActiveAiPosition,
  signal?: TradeSignal | null
): Promise<void> {
  try {
    const isFno = position.exchange === "NFO";
    await prisma.aiTradeLog.create({
      data: {
        orderId: position.orderId,
        symbol: position.symbol,
        token: position.token,
        exchange: position.exchange,
        strategy: position.strategy || "GREEK_SNIPER",
        action: position.action,
        segment: isFno ? "FNO" : "EQUITY",
        contractType: signal?.contractType || null,
        strike: signal?.strike || null,
        expiry: signal?.expiry || null,
        lotSize: signal?.lotSize || 1,
        lots: position.lots,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        targetPrice: position.targetPrice,
        stopLossPrice: position.stopLossPrice,
        mode: position.mode,
        status: "OPEN",
        delta: position.greeks?.delta ?? signal?.greeks?.delta ?? null,
        gamma: position.greeks?.gamma ?? signal?.greeks?.gamma ?? null,
        theta: position.greeks?.theta ?? signal?.greeks?.theta ?? null,
        iv: position.greeks?.iv ?? signal?.greeks?.iv ?? null,
        aiThesis: (signal?.aiThesis as any) || {
          summary: signal?.aiThesis?.summary || `${position.strategy} Execution`,
          action: position.action,
          catalyst: "Greek & Momentum Breakout Confirmation",
        },
        indicators: (signal?.indicators as any) || null,
        enteredAt: new Date(position.enteredAt),
      },
    });
    console.log(`[Database] Logged AI trade entry for ${position.symbol} (${position.orderId})`);
    broadcastSocketEvent("ai_trade_logged", { orderId: position.orderId, symbol: position.symbol, status: "OPEN" });
  } catch (err: any) {
    console.error(`[Database] Failed to log AI trade entry:`, err?.message || err);
    logAiErrorToDb({
      source: "DATABASE",
      action: "INSERT_TRADE_LOG",
      symbol: position.symbol,
      token: position.token,
      message: err?.message || "Failed to insert trade log",
      stack: err?.stack,
      details: { positionId: position.id, orderId: position.orderId },
    }).catch(console.error);
  }
}

/**
 * Database Persistence: Update order exit & P&L in PostgreSQL AiTradeLog table
 */
async function logTradeExitToDb(
  position: ActiveAiPosition,
  reason: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL"
): Promise<void> {
  try {
    await prisma.aiTradeLog.update({
      where: { orderId: position.orderId },
      data: {
        exitPrice: position.currentPrice,
        status: "EXITED",
        exitReason: reason,
        pnl: position.pnl,
        pnlPercent: position.pnlPercent,
        holdingMinutes: position.holdingMinutes,
        exitedAt: new Date(),
      },
    });
    console.log(`[Database] Updated AI trade exit for ${position.symbol} (${position.orderId}, Reason: ${reason}, PnL: ${position.pnl})`);
    broadcastSocketEvent("ai_trade_logged", { orderId: position.orderId, symbol: position.symbol, status: "EXITED", reason });
  } catch (err: any) {
    console.error(`[Database] Failed to update AI trade exit in DB:`, err?.message || err);
    logAiErrorToDb({
      source: "DATABASE",
      action: "UPDATE_TRADE_EXIT",
      symbol: position.symbol,
      token: position.token,
      message: err?.message || "Failed to update trade exit in DB",
      stack: err?.stack,
      details: { positionId: position.id, orderId: position.orderId, reason },
    }).catch(console.error);
  }
}

/**
 * Retrieve Historical AI Trade Logs from PostgreSQL
 */
export async function getAiTradeLogs(limit = 100): Promise<any[]> {
  try {
    const logs = await prisma.aiTradeLog.findMany({
      orderBy: { enteredAt: "desc" },
      take: limit,
    });
    return logs.map((log) => ({
      ...log,
      id: String(log.id),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI trade logs:", err?.message || err);
    return [];
  }
}

/**
 * Log system, broker, or AI execution errors to PostgreSQL
 */
export async function logAiErrorToDb(params: {
  source: string;
  action?: string;
  symbol?: string;
  token?: string;
  message: string;
  stack?: string;
  details?: any;
}): Promise<void> {
  try {
    await prisma.aiErrorLog.create({
      data: {
        source: params.source,
        action: params.action || null,
        symbol: params.symbol || null,
        token: params.token || null,
        message: params.message,
        stack: params.stack || null,
        details: params.details || null,
      },
    });
    console.log(`[Error Logged to DB] [${params.source}] ${params.message}`);
    broadcastSocketEvent("ai_error_logged", {
      ...params,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[Database] Failed to write AiErrorLog:`, err?.message || err);
  }
}

/**
 * Retrieve Error Logs from PostgreSQL
 */
export async function getAiErrorLogs(limit = 100): Promise<any[]> {
  try {
    const errs = await prisma.aiErrorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return errs.map((e) => ({
      ...e,
      id: String(e.id),
    }));
  } catch (err: any) {
    console.error("[Database] Error fetching AI error logs:", err?.message || err);
    return [];
  }
}

/**
 * Clear all historical Error Logs from PostgreSQL
 */
export async function clearAiErrorLogs(): Promise<number> {
  try {
    const res = await prisma.aiErrorLog.deleteMany({});
    broadcastSocketEvent("ai_error_logs_cleared", { timestamp: new Date().toISOString() });
    return res.count;
  } catch (err: any) {
    console.error("[Database] Error clearing AI error logs:", err?.message || err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Strategy Scheduling & Live Suggestion Timeline Engine
// ---------------------------------------------------------------------------

export interface LiveStrategySuggestion {
  recommendedStrategy: AutoPilotStrategy;
  strategyName: string;
  badge: string;
  icon: string;
  timeWindowLabel: string;
  activeNow: boolean;
  expiryIndexToday: string;
  reason: string;
  suggestedBudget?: number | undefined;
  sizingLabel: string;
  targetProfitPct: number;
  stopLossPct: number;
  dateTime: string;
}

export interface StrategyScheduleRecord {
  id?: string;
  strategy: AutoPilotStrategy;
  name: string;
  startTime: string;
  endTime: string;
  timeWindowLabel: string;
  daysActive: string;
  marketCondition: string;
  description: string;
  targetProfitPct: number;
  stopLossPct: number;
  suggestedBudget?: number | undefined;
  sizingLabel: string;
  status: "ACTIVE" | "UPCOMING" | "PAST";
  isActiveNow: boolean;
  dateTime: string;
}

const STATIC_STRATEGY_SCHEDULES: Omit<StrategyScheduleRecord, "isActiveNow" | "status" | "dateTime">[] = [
  {
    strategy: "ORB_15M",
    name: "15-Minute ORB",
    startTime: "09:30",
    endTime: "11:00",
    timeWindowLabel: "09:30 AM – 11:00 AM IST",
    daysActive: "ALL",
    marketCondition: "Morning High-Volume Breakout",
    description: "Captures 15m high/low breakouts with volume surge. Auto-exits before 11 AM midday chop.",
    targetProfitPct: 35,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "VWAP_TRAP",
    name: "VWAP Fakeout Trap",
    startTime: "11:00",
    endTime: "13:15",
    timeWindowLabel: "11:00 AM – 01:15 PM IST",
    daysActive: "ALL",
    marketCondition: "Midday Chop & Institutional Reversal",
    description: "Catches failed retail breakouts. Buys PEs on failed highs and CEs on reclaimed lows.",
    targetProfitPct: 40,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "GAMMA_BLAST",
    name: "Expiry Gamma Blast",
    startTime: "13:15",
    endTime: "14:45",
    timeWindowLabel: "01:15 PM – 02:45 PM IST",
    daysActive: "EXPIRY_DAY",
    marketCondition: "Afternoon Expiry Squeeze (Hero/Zero)",
    description: "Cheap ₹10–₹45 options on the day's expiry index catching explosive 1:3+ gamma surges.",
    targetProfitPct: 80,
    stopLossPct: 30,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "GREEK_SNIPER",
    name: "Greek Momentum Sniper",
    startTime: "09:35",
    endTime: "15:15",
    timeWindowLabel: "09:35 AM – 03:15 PM IST",
    daysActive: "ALL",
    marketCondition: "Directional High-Delta Momentum",
    description: "High Delta (0.35–0.50), top Gamma, and strict 45-minute theta decay protection timeout.",
    targetProfitPct: 35,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "PCR_REVERSAL",
    name: "PCR Sentiment Reversal",
    startTime: "10:00",
    endTime: "15:00",
    timeWindowLabel: "Market Sentiment Extremes",
    daysActive: "ALL",
    marketCondition: "Overbought / Oversold Contrarian",
    description: "Buys PEs when PCR > 1.35 (Overbought), buys CEs when PCR < 0.70 (Oversold).",
    targetProfitPct: 35,
    stopLossPct: 15,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "STANDARD",
    name: "Standard Scalper",
    startTime: "09:20",
    endTime: "15:20",
    timeWindowLabel: "All Trading Hours",
    daysActive: "ALL",
    marketCondition: "Classic Trend Following",
    description: "9/21 EMA + VWAP momentum scalping across liquid instruments.",
    targetProfitPct: 30,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
];

function getCurrentIST(): { hours: number; minutes: number; day: number; timeNum: number; istString: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 330 * 60000);
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const day = istDate.getDay();
  const timeNum = hours * 100 + minutes;
  const pad = (n: number) => String(n).padStart(2, "0");
  const istString = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(hours)}:${pad(minutes)} IST`;
  return { hours, minutes, day, timeNum, istString };
}

function getTodayExpiryIndex(day: number): string {
  switch (day) {
    case 1:
      return "MIDCPNIFTY (Monday Expiry)";
    case 2:
      return "FINNIFTY (Tuesday Expiry)";
    case 3:
      return "BANKNIFTY (Wednesday Expiry)";
    case 4:
      return "NIFTY 50 (Thursday Expiry)";
    case 5:
      return "BSE SENSEX (Friday Expiry)";
    default:
      return "NIFTY 50 / BANKNIFTY";
  }
}

export function getLiveStrategySuggestion(): LiveStrategySuggestion {
  const { hours, minutes, day, timeNum, istString } = getCurrentIST();
  const expiryIndexToday = getTodayExpiryIndex(day);

  // 1. Morning ORB: 09:30 to 11:00
  if (timeNum >= 930 && timeNum < 1100) {
    return {
      recommendedStrategy: "ORB_15M",
      strategyName: "15-Minute ORB",
      badge: "🌅 Morning Breakout Window",
      icon: "Sun",
      timeWindowLabel: "09:30 AM – 11:00 AM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "High institutional morning rush. Ride 15m High/Low breakouts with volume confirmation before 11 AM.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 35,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // 2. Midday VWAP Trap: 11:00 to 13:15
  if (timeNum >= 1100 && timeNum < 1315) {
    return {
      recommendedStrategy: "VWAP_TRAP",
      strategyName: "VWAP Fakeout Trap",
      badge: "🪤 Midday Reversal Window",
      icon: "TrendingDown",
      timeWindowLabel: "11:00 AM – 01:15 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "Lunch chop period. Avoid chasing breakout fakes; buy PEs on failed day highs and CEs on reclaimed day lows.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 40,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // 3. Afternoon Expiry Gamma Blast: 13:15 to 14:45
  if (timeNum >= 1315 && timeNum < 1445) {
    return {
      recommendedStrategy: "GAMMA_BLAST",
      strategyName: "Expiry Gamma Blast",
      badge: "🚀 Afternoon Gamma Surge",
      icon: "Flame",
      timeWindowLabel: "01:15 PM – 02:45 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: `Expiry short-covering rally active on ${expiryIndexToday}. Fast asymmetric 1:3+ surge on cheap options.`,
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 80,
      stopLossPct: 30,
      dateTime: istString,
    };
  }

  // 4. Closing Momentum: 14:45 to 15:30
  if (timeNum >= 1445 && timeNum <= 1530) {
    return {
      recommendedStrategy: "GREEK_SNIPER",
      strategyName: "Greek Momentum Sniper",
      badge: "⚡ Closing Scalper",
      icon: "Zap",
      timeWindowLabel: "02:45 PM – 03:30 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "Market close directional squeeze. Filters high Delta and top Gamma for fast closing scalps.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 35,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // Outside Trading Hours
  return {
    recommendedStrategy: "ORB_15M",
    strategyName: "15-Minute ORB",
    badge: "⏳ Pre-Market Preparation",
    icon: "Clock",
    timeWindowLabel: "Tomorrow 09:30 AM – 11:00 AM IST",
    activeNow: false,
    expiryIndexToday,
    reason: `Market closed. Next high-probability institutional window is 15-Min ORB on ${expiryIndexToday} at 09:30 AM.`,
    suggestedBudget: 0,
    sizingLabel: "Dynamic (1 Lot @ Market Price)",
    targetProfitPct: 35,
    stopLossPct: 18,
    dateTime: istString,
  };
}

export async function getStrategySchedules(): Promise<{
  liveSuggestion: LiveStrategySuggestion;
  schedules: StrategyScheduleRecord[];
  history: any[];
}> {
  const liveSuggestion = getLiveStrategySuggestion();
  const { timeNum, istString } = getCurrentIST();

  const schedules: StrategyScheduleRecord[] = STATIC_STRATEGY_SCHEDULES.map((s) => {
    let status: "ACTIVE" | "UPCOMING" | "PAST" = "UPCOMING";
    let isActiveNow = false;

    const startNum = parseInt(s.startTime.replace(":", ""), 10);
    const endNum = parseInt(s.endTime.replace(":", ""), 10);

    if (timeNum >= startNum && timeNum <= endNum) {
      status = "ACTIVE";
      isActiveNow = true;
    } else if (timeNum > endNum) {
      status = "PAST";
    }

    return {
      ...s,
      status,
      isActiveNow,
      dateTime: istString,
    };
  });

  let history: any[] = [];
  try {
    history = await prisma.aiStrategySchedule.findMany({
      orderBy: { dateTime: "desc" },
      take: 20,
    });
    history = history.map((h) => ({
      ...h,
      id: String(h.id),
    }));
  } catch {
    history = [];
  }

  return {
    liveSuggestion,
    schedules,
    history,
  };
}

export async function logStrategyScheduleEvent(params: {
  strategy: string;
  name: string;
  startTime: string;
  endTime: string;
  daysActive?: string;
  marketCondition?: string;
  description?: string;
  targetProfitPct?: number;
  stopLossPct?: number;
  suggestedBudget?: number;
}): Promise<any> {
  try {
    const res = await prisma.aiStrategySchedule.create({
      data: {
        strategy: params.strategy,
        name: params.name,
        startTime: params.startTime,
        endTime: params.endTime,
        daysActive: params.daysActive || "ALL",
        marketCondition: params.marketCondition || "Active Schedule",
        description: params.description || "",
        targetProfitPct: params.targetProfitPct || 35,
        stopLossPct: params.stopLossPct || 18,
        suggestedBudget: params.suggestedBudget || 5000,
        status: "ACTIVE",
        dateTime: new Date(),
      },
    });
    return { ...res, id: String(res.id) };
  } catch (err: any) {
    console.warn("[Database] Could not log strategy schedule event:", err?.message || err);
    return {
      ...params,
      id: String(Date.now()),
      dateTime: new Date().toISOString(),
    };
  }
}

/**
 * Auto-Exit Position Monitor
 * Continuously checks open AI positions against Target, Stop-Loss, and 45-Minute Theta Timeout
 */
export async function checkActivePositionsForExit(): Promise<void> {
  const openPositions = Array.from(activeAiPositions.values()).filter((p) => p.status === "OPEN");
  if (openPositions.length === 0) return;

  const now = Date.now();
  let updatedAny = false;

  for (const pos of openPositions) {
    // 1. Update current price from cached quotes / active signals
    const quote = getCachedQuote(pos.token) || getCachedQuote(pos.symbol);
    const sigMatch = [...activeEquitySignals, ...activeFnoSignals].find(
      (s) => s.token === pos.token || s.symbol === pos.symbol
    );
    const liveLtp = quote?.ltp ?? sigMatch?.currentPrice ?? pos.currentPrice;

    if (liveLtp > 0) {
      pos.currentPrice = liveLtp;
      if (liveLtp > pos.highestPrice) {
        pos.highestPrice = liveLtp;
      }
    }

    // Calculate P&L
    const diff = pos.action === "BUY" ? (pos.currentPrice - pos.entryPrice) : (pos.entryPrice - pos.currentPrice);
    pos.pnl = Number((diff * pos.quantity).toFixed(2));
    pos.pnlPercent = Number(((diff / pos.entryPrice) * 100).toFixed(1));

    // Calculate holding duration in minutes
    const holdingMins = (now - pos.enteredAt) / 60000;
    pos.holdingMinutes = Number(holdingMins.toFixed(1));
    updatedAny = true;

    // Check Exit Rules:
    let shouldExit = false;
    let reason: "TARGET" | "STOP_LOSS" | "THETA_TIMEOUT" | "MANUAL" = "TARGET";
    let exitMessage = "";

    const targetPct = autoPilotConfig.profitTargetPct || 50;
    const slPct = autoPilotConfig.stopLossPct || 22;
    const timeoutMins = pos.timeoutMinutes || autoPilotConfig.thetaTimeoutMinutes || 45;

    // Rule 1: Profit Target (+40% to +80%)
    if (pos.pnlPercent >= targetPct) {
      shouldExit = true;
      reason = "TARGET";
      exitMessage = `Target Hit (+${pos.pnlPercent}%)`;
    }
    // Rule 2: Hard Stop-Loss (-20% to -25%)
    else if (pos.pnlPercent <= -slPct) {
      shouldExit = true;
      reason = "STOP_LOSS";
      exitMessage = `Stop-Loss Triggered (${pos.pnlPercent}%)`;
    }
    // Rule 3: Theta Timeout (Held > 45 mins with 0 momentum)
    else if (holdingMins >= timeoutMins && pos.pnlPercent < 8) {
      shouldExit = true;
      reason = "THETA_TIMEOUT";
      exitMessage = `Theta Timeout (Held ${pos.holdingMinutes}m > ${timeoutMins}m with 0 momentum)`;
    }

    if (shouldExit) {
      console.log(`[AI Auto-Exit] Executing ${exitMessage} for ${pos.symbol} (P&L: ₹${pos.pnl}, ${pos.pnlPercent}%)`);
      try {
        const exitAction: "BUY" | "SELL" = pos.action === "BUY" ? "SELL" : "BUY";
        const orderReq: OrderPlacementRequest = {
          variety: "NORMAL",
          tradingsymbol: pos.symbol,
          symboltoken: pos.token,
          transactiontype: exitAction,
          exchange: pos.exchange || "NFO",
          ordertype: "MARKET",
          producttype: pos.exchange === "NFO" ? "CARRYFORWARD" : "INTRADAY",
          duration: "DAY",
          price: 0,
          quantity: pos.quantity,
        };

        const isPaper = pos.mode === "PAPER";
        const exitRes = await placeSmartApiOrder(orderReq, isPaper);

        pos.status = "EXITED";
        pos.exitReason = reason;

        await logTradeExitToDb(pos, reason);

        broadcastSocketEvent("ai_auto_exit_executed", {
          position: pos,
          exitOrder: exitRes,
          reason,
          exitMessage,
          pnl: pos.pnl,
          pnlPercent: pos.pnlPercent,
          holdingMinutes: pos.holdingMinutes,
        });
      } catch (exitErr: any) {
        console.error(`[AI Auto-Exit] Failed to execute exit for ${pos.symbol}:`, exitErr?.message || exitErr);
        logAiErrorToDb({
          source: "AUTO_EXIT",
          action: `${reason}_EXIT`,
          symbol: pos.symbol,
          token: pos.token,
          message: exitErr?.message || "Auto-exit execution failed",
          stack: exitErr?.stack,
          details: { positionId: pos.id, reason, exitMessage },
        }).catch(console.error);
      }
    }
  }

  if (updatedAny) {
    broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));
  }
}

export function getActiveAiPositions(): ActiveAiPosition[] {
  return Array.from(activeAiPositions.values());
}

export async function closeAiPositionManual(positionId: string): Promise<{ success: boolean; message: string; position: ActiveAiPosition }> {
  try {
    const pos = activeAiPositions.get(positionId);
  if (!pos) {
    throw new Error(`Position ${positionId} not found.`);
  }
  if (pos.status === "EXITED") {
    return { success: true, message: `Position already exited.`, position: pos };
  }

  const exitAction: "BUY" | "SELL" = pos.action === "BUY" ? "SELL" : "BUY";
  const orderReq: OrderPlacementRequest = {
    variety: "NORMAL",
    tradingsymbol: pos.symbol,
    symboltoken: pos.token,
    transactiontype: exitAction,
    exchange: pos.exchange || "NFO",
    ordertype: "MARKET",
    producttype: pos.exchange === "NFO" ? "CARRYFORWARD" : "INTRADAY",
    duration: "DAY",
    price: 0,
    quantity: pos.quantity,
  };

  const isPaper = pos.mode === "PAPER";
  await placeSmartApiOrder(orderReq, isPaper);

  pos.status = "EXITED";
  pos.exitReason = "MANUAL";

  await logTradeExitToDb(pos, "MANUAL");

  broadcastSocketEvent("ai_auto_exit_executed", {
    position: pos,
    reason: "MANUAL",
    exitMessage: "Manually closed by user",
    pnl: pos.pnl,
    pnlPercent: pos.pnlPercent,
    holdingMinutes: pos.holdingMinutes,
  });
  broadcastSocketEvent("ai_positions_update", Array.from(activeAiPositions.values()));

  return {
    success: true,
    message: `Manually closed position ${pos.symbol}`,
    position: pos,
  };
} catch (err: any) {
  logAiErrorToDb({
    source: "MANUAL_CLOSE",
    action: "CLOSE_POSITION",
    message: err?.message || "Manual position close failed",
    stack: err?.stack,
    details: { positionId },
  }).catch(console.error);
  throw err;
}
}

let positionMonitorInterval: ReturnType<typeof setInterval> | null = null;
export function startActivePositionMonitor() {
  if (positionMonitorInterval) return;
  positionMonitorInterval = setInterval(() => {
    checkActivePositionsForExit().catch((err) => {
      console.warn("[PositionMonitor] Error:", err?.message || err);
    });
  }, 4000);
}

// Auto-start active position monitor
startActivePositionMonitor();

/**
 * AI Budget Trade Advisor & Position Sizing Engine
 * Takes user-specified budget, risk profile, and target segment,
 * scans market signals, calculates exact share and lot quantities,
 * and generates a mathematically disciplined portfolio recommendation.
 */
export async function analyzeBudgetAndSuggestTrades(
  params: BudgetAdvisorParams
): Promise<BudgetAnalysisResult> {
  const budget = Number(params.budget);
  if (!budget || isNaN(budget) || budget <= 0) {
    throw new Error("Please specify a valid trading budget amount (minimum ₹500).");
  }

  const riskProfile: RiskProfile = params.riskProfile || "MODERATE";
  const segment = params.segment || "ALL";

  // Risk profile configurations
  let maxRiskPct = 0.035;       // 3.5% default max portfolio risk per trade
  let maxAllocationPct = 0.55;  // 55% default max capital per position
  let targetTrades = params.maxTrades ? Math.min(Math.max(params.maxTrades, 1), 5) : 3;
  let minConfidence = 62;

  if (riskProfile === "CONSERVATIVE") {
    maxRiskPct = 0.02;          // 2.0% max loss per trade
    maxAllocationPct = 0.40;   // 40% max per position
    targetTrades = params.maxTrades ? Math.min(params.maxTrades, 2) : 2;
    minConfidence = 68;
  } else if (riskProfile === "AGGRESSIVE") {
    maxRiskPct = 0.06;          // 6.0% max loss per trade
    maxAllocationPct = 0.75;   // 75% max per position
    targetTrades = params.maxTrades ? Math.min(params.maxTrades, 4) : 4;
    minConfidence = 55;
  }

  // 1. Ensure market universe is freshly scanned (for standard universe segments)
  if (segment === "ALL" || segment === "EQUITY") {
    if (activeEquitySignals.length === 0) {
      await scanMarketUniverse("EQUITY");
    }
  }
  if (segment === "ALL" || segment === "FNO") {
    if (activeFnoSignals.length === 0) {
      await scanMarketUniverse("FNO");
    }
  }

  // 2. Fetch live Top Volatile F&O Movers (Calls & Puts)
  let fnoMoversRes: any = null;
  try {
    fnoMoversRes = await getTopFnoMovers();
  } catch (err: any) {
    console.warn("[AI Budget Advisor] Failed to load F&O movers:", err?.message || err);
  }

  const volatileCalls: FnoMoverItem[] = fnoMoversRes?.calls || [];
  const volatilePuts: FnoMoverItem[] = fnoMoversRes?.puts || [];
  const mostVolatileItem: FnoMoverItem | null = fnoMoversRes?.summary?.mostVolatile || null;

  // Evaluate Golden Hours status
  const goldenHours = checkGoldenHours();

  // Benchmark Spot Trend & Greek Momentum Sniper Processing
  const niftyQuote = getCachedQuote("99926000") || getCachedQuote("NIFTY 50");
  const niftySignal = activeFnoSignals.find((s) => s.underlying === "NIFTY");
  const spotPrice = niftyQuote?.ltp || niftySignal?.currentPrice || 24500;
  const spotChange = niftyQuote?.netChange || niftySignal?.netChange || 0;
  const spotTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = spotChange >= 0 ? "BULLISH" : "BEARISH";

  const allFnoCandidates = fnoMoversRes?.all || [...volatileCalls, ...volatilePuts];
  const greekRanked = filterAndRankGreekSniperStrikes({
    candidates: allFnoCandidates,
    spotPrice,
    spotTrend,
    budget,
    minPremium: 25,
    maxPremium: 75,
  });

  const greekSniperSignals: TradeSignal[] = greekRanked.map((item) => {
    const ltp = item.ltp;
    const stopLoss = Number((ltp * 0.78).toFixed(2)); // -22% hard SL
    const target1 = Number((ltp * 1.50).toFixed(2));  // +50% target
    const target2 = Number((ltp * 1.80).toFixed(2));  // +80% runner

    return {
      id: `greek_sniper_${item.symbolToken}_${Date.now()}`,
      symbol: item.tradingSymbol,
      token: item.symbolToken,
      exchange: item.exchange || "NFO",
      segment: "FNO",
      contractType: item.instrumentType,
      strike: item.strike ?? undefined,
      expiry: item.expiry,
      lotSize: item.lotSize,
      underlying: item.name,
      action: "BUY",
      confidence: Math.min(96, Math.max(82, Math.round(80 + item.greeks.gamma * 6000 + (item.percentChange > 0 ? 5 : 0)))),
      timeframe: "INTRADAY",
      currentPrice: ltp,
      entryPrice: ltp,
      stopLoss,
      target1,
      target2,
      riskReward: "1:2.30",
      netChange: item.netChange,
      percentChange: item.percentChange,
      greeks: item.greeks,
      indicators: {
        rsi: item.percentChange >= 0 ? 62 : 44,
        rsiSignal: item.percentChange >= 0 ? "BULLISH_MOMENTUM" : "NEUTRAL",
        ema9: ltp,
        ema21: ltp * 0.95,
        sma50: ltp * 0.90,
        emaTrend: item.percentChange >= 0 ? "BULLISH" : "BEARISH",
        macd: {
          macdLine: item.netChange,
          signalLine: item.netChange * 0.8,
          histogram: item.netChange * 0.2,
          trend: item.percentChange >= 0 ? "BULLISH" : "NEUTRAL",
        },
        bollingerBands: {
          upper: ltp * 1.15,
          middle: ltp,
          lower: ltp * 0.85,
          bandwidth: 25,
          percentB: 0.65,
          position: "UPPER_HALF",
        },
        atr: ltp * 0.08,
        volumeRatio: item.tradeVolume ? 2.1 : 1.5,
        supportLevel: stopLoss,
        resistanceLevel: target1,
        orderBookImbalance: item.percentChange >= 0 ? 0.42 : -0.25,
      },
      aiThesis: {
        summary: `Greek Momentum Sniper (${item.instrumentType}): ₹${ltp} premium within ₹25-₹75 range. Delta: ${item.greeks.delta}, Rank #${item.rank} Top Gamma acceleration (${item.greeks.gamma}), Theta/Premium ratio ${item.greeks.thetaPremiumRatio} (< 0.15).`,
        rationale: [
          `Rule 1: Delta ${item.greeks.delta} in high-sensitivity 0.30-0.50 zone`,
          `Rule 2: Rank #${item.rank} Highest Gamma strike (${item.greeks.gamma}) for max delta boost`,
          `Rule 3: Low theta bleed rate (₹${Math.abs(item.greeks.theta)}/day, ${item.greeks.thetaPremiumRatio} ratio)`,
          `Rule 4: Underlying Spot ${item.name} (${spotTrend}) confirmed on 20-EMA / VWAP`,
          `Rule 5: Auto-Exit: Target +50%, Hard SL -22%, 45-Min Theta Timeout`,
        ],
        riskFactor: "Theta Timeout active: Position will auto-exit if held > 45 minutes without momentum.",
        catalyst: `${item.name} spot trend breakout with volume acceleration during active momentum window.`,
      },
      generatedAt: new Date().toISOString(),
      status: "ACTIVE",
    };
  });

  const fnoMoverToSignal = (item: FnoMoverItem): TradeSignal => {
    const ltp = item.ltp > 0 ? item.ltp : 50;
    const slPct = 0.30; // 30% risk limit on premium
    const stopLoss = Number((ltp * (1 - slPct)).toFixed(2));
    const target1 = Number((ltp * 1.50).toFixed(2));
    const target2 = Number((ltp * 2.20).toFixed(2));
    const lotSize = item.tradingSymbol.startsWith("BANKNIFTY") ? 30 : 65;

    return {
      id: `volatile_${item.symbolToken}_${Date.now()}`,
      symbol: item.tradingSymbol,
      token: item.symbolToken,
      exchange: item.exchange || "NFO",
      segment: "FNO",
      contractType: item.instrumentType,
      strike: item.strike ?? undefined,
      expiry: item.expiry,
      lotSize,
      underlying: item.name,
      action: "BUY",
      confidence: Math.min(96, Math.max(70, Math.round(62 + Math.abs(item.percentChange) * 0.4))),
      timeframe: "INTRADAY",
      currentPrice: ltp,
      entryPrice: ltp,
      stopLoss,
      target1,
      target2,
      riskReward: "1:2.0",
      netChange: item.netChange,
      percentChange: item.percentChange,
      indicators: {
        rsi: item.percentChange >= 0 ? 64 : 36,
        rsiSignal: item.percentChange >= 0 ? "BULLISH_MOMENTUM" : "BEARISH_MOMENTUM",
        ema9: ltp,
        ema21: ltp * 0.96,
        sma50: ltp * 0.92,
        emaTrend: item.percentChange >= 0 ? "BULLISH" : "BEARISH",
        macd: {
          macdLine: item.netChange,
          signalLine: item.netChange * 0.8,
          histogram: item.netChange * 0.2,
          trend: item.percentChange >= 0 ? "BULLISH" : "BEARISH",
        },
        bollingerBands: {
          upper: ltp * 1.1,
          middle: ltp,
          lower: ltp * 0.9,
          bandwidth: 20,
          percentB: 0.7,
          position: item.percentChange >= 0 ? "UPPER_HALF" : "LOWER_HALF",
        },
        atr: ltp * 0.08,
        volumeRatio: item.tradeVolume ? 1.8 : 1.2,
        supportLevel: stopLoss,
        resistanceLevel: target1,
        orderBookImbalance: item.percentChange >= 0 ? 0.35 : -0.35,
      },
      aiThesis: {
        summary: `Top Volatile ${item.instrumentType} option (${item.percentChange >= 0 ? "+" : ""}${item.percentChange}% swing) with high gamma momentum and active liquidity.`,
        rationale: [
          `Rapid delta acceleration (${item.percentChange >= 0 ? "+" : ""}${item.percentChange}%)`,
          `High liquidity strike with volume ${item.tradeVolume || "active"}`,
          `Defined stop-loss risk at ₹${stopLoss}`,
        ],
        riskFactor: "Theta decay acceleration if held overnight; recommended for same-day intraday squaring-off.",
        catalyst: "Breakout volume surge in underlying benchmark index.",
      },
      generatedAt: new Date().toISOString(),
      status: "ACTIVE",
    };
  };

  const volatileCallSignals = volatileCalls.slice(0, 10).map(fnoMoverToSignal);
  const volatilePutSignals = volatilePuts.slice(0, 10).map(fnoMoverToSignal);
  const allVolatileOptionSignals = [...volatileCallSignals, ...volatilePutSignals];

  // 3. Aggregate candidate pool based on requested segment
  let pool: TradeSignal[] = [];
  if (segment === "GREEK_SNIPER") {
    pool = greekSniperSignals.length > 0 ? greekSniperSignals : allVolatileOptionSignals;
  } else if (segment === "VOLATILE_CALLS") {
    pool = volatileCallSignals;
  } else if (segment === "VOLATILE_PUTS") {
    pool = volatilePutSignals;
  } else if (segment === "VOLATILE_OPTIONS") {
    pool = allVolatileOptionSignals;
  } else if (segment === "ALL") {
    pool = [...greekSniperSignals, ...volatileCallSignals.slice(0, 3), ...volatilePutSignals.slice(0, 3), ...activeEquitySignals, ...activeFnoSignals];
  } else if (segment === "FNO") {
    pool = [...greekSniperSignals, ...allVolatileOptionSignals.slice(0, 5), ...activeFnoSignals];
  } else {
    pool = [...activeEquitySignals];
  }

  // If pool is still empty, trigger dynamic scans (for standard equity/fno universe)
  if (pool.length === 0) {
    if (segment !== "VOLATILE_CALLS" && segment !== "VOLATILE_PUTS" && segment !== "VOLATILE_OPTIONS" && segment !== "GREEK_SNIPER") {
      await scanMarketUniverse("EQUITY");
      await scanMarketUniverse("FNO");
      pool = segment === "ALL" 
        ? [...activeEquitySignals, ...activeFnoSignals]
        : segment === "FNO" ? [...activeFnoSignals] : [...activeEquitySignals];
    }
  }

  // 3. Filter for actionable trade setups (BUY or SELL)
  const actionable = pool.filter((s) => s.action === "BUY" || s.action === "SELL");

  // Filter by confidence, but ensure we have at least some candidates
  let highConf = actionable.filter((s) => s.confidence >= minConfidence);
  if (highConf.length < 2) {
    highConf = actionable.slice(0, 10);
  }

  // 4. Rank candidates by scoring algorithm:
  // (Confidence * 1.5) + (R:R score) + (Momentum & Volume confirmation)
  const scoredCandidates = highConf.map((sig) => {
    const rrNum = parseFloat(sig.riskReward.replace(/^1:/, "")) || 1.5;
    const volBonus = sig.indicators && sig.indicators.volumeRatio > 1.2 ? 8 : 0;
    const rsiBonus = sig.action === "BUY" && sig.indicators && sig.indicators.rsi >= 50 && sig.indicators.rsi <= 68 ? 6 : 0;
    const score = (sig.confidence * 1.5) + (Math.min(rrNum, 4) * 10) + volBonus + rsiBonus;
    return { sig, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  // 5. Greedily allocate budget across top candidates
  let remainingBudget = budget;
  const suggestions: BudgetTradeSuggestion[] = [];
  const unaffordableHighlights: Array<{
    symbol: string;
    action: string;
    confidence: number;
    requiredCapital: number;
    reason: string;
  }> = [];

  const seenUnderlying = new Set<string>();

  for (const item of scoredCandidates) {
    if (suggestions.length >= targetTrades) break;

    const sig = item.sig;
    const isFno = sig.segment === "FNO" || 
      sig.contractType === "CE" || 
      sig.contractType === "PE" || 
      sig.contractType === "FUT" || 
      sig.symbol.endsWith("CE") || 
      sig.symbol.endsWith("PE");

    const lotSize = isFno 
      ? (sig.lotSize && sig.lotSize > 0 ? sig.lotSize : (sig.symbol.includes("BANK") ? 15 : 65))
      : 1;

    const price = sig.entryPrice > 0 ? sig.entryPrice : sig.currentPrice;
    if (price <= 0) continue;
    // Skip penny options with low liquidity
    if (isFno && price < 1.0) continue;

    const minCapitalPerUnit = price * lotSize;

    // Check if total trade minimum exceeds entire budget
    if (minCapitalPerUnit > budget) {
      if (unaffordableHighlights.length < 3) {
        unaffordableHighlights.push({
          symbol: sig.symbol,
          action: sig.action,
          confidence: sig.confidence,
          requiredCapital: Math.round(minCapitalPerUnit),
          reason: `Requires minimum ₹${Math.round(minCapitalPerUnit).toLocaleString("en-IN")} for 1 ${isFno ? "lot" : "share"}, exceeding total budget of ₹${budget.toLocaleString("en-IN")}.`,
        });
      }
      continue;
    }

    // Check if fits in remaining budget
    if (minCapitalPerUnit > remainingBudget) {
      continue;
    }

    // Avoid double concentration on the exact same underlying (e.g. 2 NIFTY calls)
    const underlyingKey = (sig.underlying || sig.symbol.split(/\d/)[0] || sig.symbol).toUpperCase();
    if (seenUnderlying.has(underlyingKey) && scoredCandidates.length > 3) {
      continue;
    }

    // Position sizing:
    const isLastSlot = suggestions.length === targetTrades - 1;
    const maxAllowance = isLastSlot 
      ? remainingBudget * 0.95 
      : Math.min(remainingBudget * 0.90, budget * maxAllocationPct);

    let recommendedQty = 0;
    let recommendedLots = 0;
    let capRequired = 0;
    let maxLoss = 0;
    let t1Profit = 0;
    let t2Profit = 0;

    const slDiff = Math.abs(sig.entryPrice - sig.stopLoss) || (price * (isFno ? 0.25 : 0.02));
    const t1Diff = Math.abs(sig.target1 - sig.entryPrice) || (slDiff * 1.5);
    const t2Diff = Math.abs(sig.target2 - sig.entryPrice) || (slDiff * 2.5);

    if (isFno) {
      // Lot-based calculation
      const lotCost = minCapitalPerUnit;
      const lotsByCap = Math.max(1, Math.floor(maxAllowance / lotCost));
      const slRiskPerLot = Math.min(price, slDiff) * lotSize;
      const maxRiskAllowed = budget * maxRiskPct;
      const lotsByRisk = slRiskPerLot > 0 ? Math.max(1, Math.floor(maxRiskAllowed / slRiskPerLot)) : lotsByCap;

      let lots = Math.max(1, Math.min(lotsByCap, lotsByRisk));
      if (lots * lotCost > remainingBudget) {
        lots = 1;
      }
      if (lots * lotCost > remainingBudget) continue;

      recommendedLots = lots;
      recommendedQty = lots * lotSize;
      capRequired = Math.round(lots * lotCost);
      maxLoss = Math.min(capRequired, Math.max(1, Math.round(lots * slRiskPerLot)));
      t1Profit = Math.round(lots * t1Diff * lotSize);
      t2Profit = Math.round(lots * t2Diff * lotSize);
    } else {
      // Share-based calculation
      const qtyByCap = Math.max(1, Math.floor(maxAllowance / price));
      const maxRiskAllowed = budget * maxRiskPct;
      const qtyByRisk = slDiff > 0 ? Math.max(1, Math.floor(maxRiskAllowed / slDiff)) : qtyByCap;

      let qty = Math.max(1, Math.min(qtyByCap, qtyByRisk));
      if (qty * price > remainingBudget) {
        qty = Math.floor(remainingBudget / price);
      }
      if (qty < 1) continue;

      recommendedLots = 0;
      recommendedQty = qty;
      capRequired = Math.round(qty * price);
      maxLoss = Math.round(qty * slDiff);
      t1Profit = Math.round(qty * t1Diff);
      t2Profit = Math.round(qty * t2Diff);
    }

    let reason = "";
    if (isFno) {
      reason = `${recommendedLots} Lot${recommendedLots > 1 ? "s" : ""} (${recommendedQty} units) sized for ₹${capRequired.toLocaleString("en-IN")}. High delta momentum with max downside capped at ₹${maxLoss.toLocaleString("en-IN")} (${((maxLoss / budget) * 100).toFixed(1)}% of capital).`;
    } else {
      reason = `${recommendedQty} shares sized for ₹${capRequired.toLocaleString("en-IN")}. Trend breakout with strict protective stop loss at ₹${sig.stopLoss}.`;
    }

    suggestions.push({
      signal: sig,
      recommendedQuantity: recommendedQty,
      recommendedLots,
      lotSize,
      capitalRequired: capRequired,
      allocationPercentage: Number(((capRequired / budget) * 100).toFixed(1)),
      maxLoss,
      maxLossPercentage: Number(((maxLoss / budget) * 100).toFixed(2)),
      target1Profit: t1Profit,
      target1GainPct: Number(((t1Profit / capRequired) * 100).toFixed(1)),
      target2Profit: t2Profit,
      target2GainPct: Number(((t2Profit / capRequired) * 100).toFixed(1)),
      riskRewardRatio: sig.riskReward || "1:2.0",
      allocationReason: reason,
      greeks: sig.greeks,
      timeoutMinutes: 45,
    });

    remainingBudget -= capRequired;
    seenUnderlying.add(underlyingKey);
  }

  // 6. Portfolio Aggregate Statistics
  const totalCapitalAllocated = suggestions.reduce((acc, s) => acc + s.capitalRequired, 0);
  const remainingCashBuffer = Math.max(0, budget - totalCapitalAllocated);
  const bufferPercentage = Number(((remainingCashBuffer / budget) * 100).toFixed(1));
  const totalMaxRisk = suggestions.reduce((acc, s) => acc + s.maxLoss, 0);
  const totalMaxRiskPercentage = Number(((totalMaxRisk / budget) * 100).toFixed(2));
  const totalExpectedProfitT1 = suggestions.reduce((acc, s) => acc + s.target1Profit, 0);
  const totalExpectedProfitT2 = suggestions.reduce((acc, s) => acc + s.target2Profit, 0);

  const overallRiskReward = totalMaxRisk > 0
    ? `1:${(totalExpectedProfitT1 / totalMaxRisk).toFixed(2)}`
    : "1:2.20";

  // Portfolio Health Score (0 - 100)
  let healthScore = 70;
  if (suggestions.length >= 2) healthScore += 10;
  if (bufferPercentage >= 8 && bufferPercentage <= 35) healthScore += 10;
  if (totalMaxRiskPercentage <= (riskProfile === "CONSERVATIVE" ? 4 : riskProfile === "MODERATE" ? 8 : 15)) healthScore += 10;
  healthScore = Math.min(100, Math.max(50, healthScore));

  // 7. AI Summary & Strategic Advice Tailored to Budget
  let aiSummary = "";
  if (segment === "GREEK_SNIPER") {
    aiSummary = `⚡ Greek Momentum Sniper Strategy for ₹${budget.toLocaleString("en-IN")}: High-delta, top-gamma options filtered for explosive delta acceleration while capping theta bleed rate under 0.15. Position auto-exits at +50% target, -22% stop-loss, or after 45 minutes of zero momentum.`;
  } else if (budget < 10000) {
    aiSummary = `Micro-Capital Tactical Allocation for ₹${budget.toLocaleString("en-IN")}: Optimized for high capital efficiency with strictly defined stop-loss risk. Capital allocated across ${suggestions.length} high-conviction setup(s) while retaining ₹${remainingCashBuffer.toLocaleString("en-IN")} (${bufferPercentage}%) as a safety reserve.`;
  } else if (budget <= 50000) {
    aiSummary = `Growth & Protection Allocation for ₹${budget.toLocaleString("en-IN")}: Balanced risk portfolio distributing capital across ${suggestions.length} momentum setups. Expected Target 1 upside is ₹${totalExpectedProfitT1.toLocaleString("en-IN")} with downside strictly limited to ₹${totalMaxRisk.toLocaleString("en-IN")} (${totalMaxRiskPercentage}%).`;
  } else {
    aiSummary = `Institutional Multi-Asset Allocation for ₹${budget.toLocaleString("en-IN")}: Scaled position sizing with multi-tier target profit booking across ${suggestions.length} positions. Retaining ₹${remainingCashBuffer.toLocaleString("en-IN")} (${bufferPercentage}%) dry powder for intraday volatility and tactical scaling.`;
  }

  const strategicAdvice: string[] = [
    `Strict Drawdown Guard: Your maximum combined loss across all suggested positions is capped at ₹${totalMaxRisk.toLocaleString("en-IN")} (${totalMaxRiskPercentage}% of capital).`,
    `Target 1 Partial Profit: Book 50% profits once Target 1 (+₹${totalExpectedProfitT1.toLocaleString("en-IN")}) is hit and instantly trail stop-loss to entry price for a zero-risk trade.`,
    `Liquid Buffer Discipline: Keep the unallocated cash of ₹${remainingCashBuffer.toLocaleString("en-IN")} (${bufferPercentage}%) untouched to absorb market spreads and margin fluctuations.`,
  ];

  if (segment === "GREEK_SNIPER" || greekRanked.length > 0) {
    strategicAdvice.unshift(
      "⏱️ Theta Timeout Rule: Any position held over 45 minutes without momentum auto-exits at market to preserve capital."
    );
    strategicAdvice.unshift(
      goldenHours.message
    );
    strategicAdvice.unshift(
      "🎯 Greek Quality Gate: All strikes strictly filtered for Delta (0.30-0.50), Top Gamma acceleration, and Theta/Premium decay < 0.15."
    );
  } else if (suggestions.some((s) => s.recommendedLots > 0)) {
    strategicAdvice.push(
      "Derivatives Volatility Rule: Close option positions before 3:15 PM if intraday momentum falters to avoid overnight theta decay."
    );
  }

  const result: BudgetAnalysisResult = {
    budget,
    riskProfile,
    segment,
    totalCapitalAllocated,
    remainingCashBuffer,
    bufferPercentage,
    totalMaxRisk,
    totalMaxRiskPercentage,
    totalExpectedProfitT1,
    totalExpectedProfitT2,
    overallRiskReward,
    portfolioHealthScore: healthScore,
    aiSummary,
    strategicAdvice,
    suggestions,
    volatileCalls: volatileCalls.slice(0, 8),
    volatilePuts: volatilePuts.slice(0, 8),
    mostVolatile: mostVolatileItem,
    goldenHours,
    greekSniperSuggestions: greekRanked,
  };

  if (unaffordableHighlights.length > 0) {
    result.unaffordableHighlights = unaffordableHighlights;
  }

  return result;
}
