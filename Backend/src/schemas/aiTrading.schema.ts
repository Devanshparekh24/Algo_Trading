// ---------------------------------------------------------------------------
// AI Trading Zod Validation Schemas
// Enforces strict typing, parameter boundaries, and sanitary payload input.
// ---------------------------------------------------------------------------

import { z } from "zod";

export const executeSignalSchema = z.object({
  signalId: z.string().min(1, "signalId is required"),
  quantity: z.number().int().positive().optional(),
  lots: z.number().int().positive().optional(),
  productType: z.enum(["INTRADAY", "DELIVERY", "CARRYFORWARD"]).optional(),
  orderType: z.enum(["MARKET", "LIMIT"]).optional(),
  limitPrice: z.number().positive().optional(),
  mode: z.enum(["PAPER", "LIVE"]).optional(),
  confirmed: z.boolean().optional(),
});

export const placeManualOrderSchema = z.object({
  tradingsymbol: z.string().min(1, "tradingsymbol is required"),
  symboltoken: z.string().min(1, "symboltoken is required"),
  exchange: z.string().default("NSE"),
  transactiontype: z.enum(["BUY", "SELL"]),
  ordertype: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  producttype: z.enum(["INTRADAY", "DELIVERY", "CARRYFORWARD"]).default("INTRADAY"),
  quantity: z.number().int().positive("quantity must be at least 1"),
  price: z.number().min(0).optional(),
  mode: z.enum(["PAPER", "LIVE"]).optional(),
});

export const updateAutoPilotSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["PAPER", "LIVE"]).optional(),
  strategy: z
    .enum([
      "GREEK_SNIPER",
      "GAMMA_BLAST",
      "VWAP_TRAP",
      "ORB_15M",
      "PCR_REVERSAL",
      "STANDARD",
      "EMA_9_21",
    ])
    .optional(),
  enforceGoldenHours: z.boolean().optional(),
  profitTargetPct: z.number().min(5).max(300).optional(),
  stopLossPct: z.number().min(2).max(100).optional(),
  thetaTimeoutMinutes: z.number().min(5).max(360).optional(),
  defaultQuantity: z.number().int().positive().optional(),
  maxBudgetPerTrade: z.number().min(0).optional(),
  productType: z.enum(["INTRADAY", "DELIVERY"]).optional(),
  maxDailyTrades: z.number().int().min(1).max(100).optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  maxDailyLoss: z.number().min(0).optional(),
  maxOpenPositions: z.number().int().min(1).max(20).optional(),
  confirmedLiveTrading: z.boolean().optional(),
});

export const budgetAdvisorSchema = z.object({
  budget: z.number().positive("Budget must be a positive number"),
  riskProfile: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).optional(),
  segment: z
    .enum([
      "ALL",
      "EQUITY",
      "FNO",
      "VOLATILE_CALLS",
      "VOLATILE_PUTS",
      "VOLATILE_OPTIONS",
      "GREEK_SNIPER",
    ])
    .optional(),
  maxTrades: z.number().int().positive().max(10).optional(),
});

export const backtestSchema = z.object({
  strategy: z
    .enum(["EMA_9_21", "GREEK_SNIPER", "GAMMA_BLAST", "VWAP_TRAP", "ORB_15M", "STANDARD"])
    .optional(),
  symbol: z.string().min(1, "symbol is required"),
  token: z.string().min(1, "token is required"),
  exchange: z.string().min(1, "exchange is required"),
  fromDate: z.string().min(1, "fromDate is required (e.g. YYYY-MM-DD HH:mm)"),
  toDate: z.string().min(1, "toDate is required (e.g. YYYY-MM-DD HH:mm)"),
  interval: z.string().optional(),
  initialCapital: z.number().positive().optional(),
  targetPct: z.number().positive().optional(),
  stopLossPct: z.number().positive().optional(),
  lotSize: z.number().int().positive().optional(),
});

export const scanOptionChainSchema = z.object({
  underlying: z.string().optional(),
  expiry: z.string().optional(),
  strikeCount: z.number().int().positive().max(100).optional(),
});

export const fnoStrikeLookupSchema = z.object({
  underlying: z.string().min(1, "underlying is required (e.g. NIFTY, BANKNIFTY)"),
  strike: z.number().positive("strike price must be positive"),
  optionType: z.enum(["CE", "PE"]),
  expiry: z.string().optional(),
});

export const analyzeScripSchema = z.object({
  symbol: z.string().min(1, "symbol is required"),
  token: z.string().min(1, "token is required"),
  exchange: z.string().optional(),
  timeframe: z.string().optional(),
  segment: z.enum(["EQUITY", "FNO"]).optional(),
});

export const customUniverseSchema = z.object({
  symbol: z.string().min(1, "symbol is required"),
  token: z.string().min(1, "token is required"),
  exchange: z.string().optional(),
  name: z.string().optional(),
  segment: z.enum(["EQUITY", "FNO"]).optional(),
  contractType: z.enum(["EQ", "CE", "PE", "FUT"]).optional(),
  strike: z.number().optional(),
  expiry: z.string().optional(),
  lotSize: z.number().int().positive().optional(),
  underlying: z.string().optional(),
});

export const strategyScheduleLogSchema = z.object({
  strategy: z.string().min(1, "strategy is required"),
  name: z.string().min(1, "name is required"),
  startTime: z.string().min(1, "startTime is required"),
  endTime: z.string().min(1, "endTime is required"),
  daysActive: z.string().optional(),
  marketCondition: z.string().optional(),
  description: z.string().optional(),
  targetProfitPct: z.number().optional(),
  stopLossPct: z.number().optional(),
  suggestedBudget: z.number().optional(),
});
