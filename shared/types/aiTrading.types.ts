// ---------------------------------------------------------------------------
// Canonical AI Trading Domain Types & Interfaces
// Shared between Backend and Frontend to ensure 100% type safety and zero duplication.
// ---------------------------------------------------------------------------

export type SignalAction = "BUY" | "SELL" | "HOLD";
export type MarketSegment = "EQUITY" | "FNO";
export type ContractType = "EQ" | "CE" | "PE" | "FUT";
export type OIBuildupType =
  | "LONG_BUILDUP"
  | "SHORT_BUILDUP"
  | "SHORT_COVERING"
  | "LONG_UNWINDING"
  | "NEUTRAL";
export type UniverseSource = "CORE" | "HOLDING" | "MARKET_MOVER" | "CUSTOM";

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: "OVERSOLD" | "OVERBOUGHT" | "NEUTRAL" | "BULLISH_MOMENTUM" | "BEARISH_MOMENTUM";
  ema9: number;
  ema21: number;
  sma50: number;
  emaTrend: "STRONG_BULLISH" | "BULLISH" | "BEARISH" | "STRONG_BEARISH" | "NEUTRAL";
  emaCrossover?: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NO_CROSSOVER" | undefined;
  prevEma9?: number | undefined;
  prevEma21?: number | undefined;
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
  orderBookImbalance: number;
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  thetaPremiumRatio: number;
  isGreekEligible: boolean;
}

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
  confidence: number;
  timeframe: string;
  currentPrice: number;
  entryPrice: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: string;
  netChange: number;
  percentChange: number;
  greeks?: OptionGreeks | undefined;
  indicators: TechnicalIndicators;
  aiThesis: {
    summary: string;
    action?: string | undefined;
    rationale?: string[] | undefined;
    riskFactor?: string | undefined;
    catalyst?: string | undefined;
  };
  generatedAt: string;
  status: "ACTIVE" | "EXECUTED" | "EXPIRED";
  isSynthetic?: boolean | undefined;
  dataSource?: ("LIVE_EXCHANGE" | "SYNTHETIC_FALLBACK") | undefined;
  warning?: string | undefined;
}

export type AutoPilotStrategy =
  | "GREEK_SNIPER"
  | "GAMMA_BLAST"
  | "VWAP_TRAP"
  | "ORB_15M"
  | "PCR_REVERSAL"
  | "STANDARD"
  | "EMA_9_21";

export interface AutoPilotConfig {
  enabled: boolean;
  mode: "PAPER" | "LIVE" | "BOTH";
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
  maxDailyLoss?: number | undefined;
  maxOpenPositions?: number | undefined;
  confirmedLiveTrading?: boolean | undefined;
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
  exitRetryCount?: number | undefined;
  lastExitAttempt?: number | undefined;
  lastExitError?: string | undefined;
  isExitPending?: boolean | undefined;
  charges?: number | undefined;
  netPnl?: number | undefined;
}

export interface AiTradeLogItem {
  id: string;
  orderId: string;
  symbol: string;
  token: string;
  exchange: string;
  strategy: string;
  action: "BUY" | "SELL";
  segment: string;
  contractType?: string | undefined;
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize: number;
  lots: number;
  quantity: number;
  entryPrice: number;
  exitPrice?: number | undefined;
  targetPrice?: number | undefined;
  stopLossPrice?: number | undefined;
  mode: "PAPER" | "LIVE";
  status: "OPEN" | "EXITED" | "CANCELLED";
  exitReason?: string | undefined;
  pnl?: number | undefined;
  pnlPercent?: number | undefined;
  charges?: number | undefined;
  netPnl?: number | undefined;
  holdingMinutes?: number | undefined;
  delta?: number | undefined;
  gamma?: number | undefined;
  theta?: number | undefined;
  iv?: number | undefined;
  aiThesis?: {
    summary: string;
    action?: string | undefined;
    rationale?: string[] | undefined;
    riskFactor?: string | undefined;
    catalyst?: string | undefined;
  } | undefined;
  indicators?: TechnicalIndicators | undefined;
  enteredAt: string;
  exitedAt?: string | undefined;
}

export interface AiErrorLogItem {
  id: string;
  source: string;
  action?: string | undefined;
  symbol?: string | undefined;
  token?: string | undefined;
  message: string;
  stack?: string | undefined;
  details?: unknown;
  createdAt: string;
}

export interface UniverseScrip {
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

export type ScripCandidate = UniverseScrip;

export interface FnoCandidate extends ScripCandidate {
  segment: "FNO";
  contractType: "CE" | "PE" | "FUT";
  strike?: number | undefined;
  expiry?: string | undefined;
  lotSize: number;
  underlying: string;
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

export interface UniverseResponse {
  universe: UniverseScrip[];
  total: number;
  segment: string;
}

export type RiskProfile = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
export type BudgetSegment =
  | "ALL"
  | "EQUITY"
  | "FNO"
  | "VOLATILE_CALLS"
  | "VOLATILE_PUTS"
  | "VOLATILE_OPTIONS"
  | "GREEK_SNIPER";

export interface VolatileOptionItem {
  symbolToken: string;
  tradingSymbol: string;
  name: string;
  instrumentType: "CE" | "PE" | "FUT";
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
  lotSize?: number | undefined;
}

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
  volatileCalls?: VolatileOptionItem[] | undefined;
  volatilePuts?: VolatileOptionItem[] | undefined;
  mostVolatile?: VolatileOptionItem | null | undefined;
  goldenHours?: GoldenHoursStatus | undefined;
  greekSniperSuggestions?: any[] | undefined;
}

export interface OptionChainScanResult {
  underlying: string;
  spotPrice: number;
  pcr: number;
  pcrSentiment: string;
  maxPainStrike: number;
  signals: TradeSignal[];
}

export interface ScanOptionChainParams {
  underlying?: string | undefined;
  expiry?: string | undefined;
  strikeCount?: number | undefined;
}

export interface GoldenHoursStatus {
  isGoldenHour: boolean;
  windowName: string;
  isLunchChop: boolean;
  message: string;
  isMorningWindow?: boolean | undefined;
  isAfternoonWindow?: boolean | undefined;
  currentIstTime?: string | undefined;
  activeWindow?: string | undefined;
  canTrade?: boolean | undefined;
}

export interface LiveStrategySuggestion {
  recommendedStrategy: AutoPilotStrategy;
  strategyName: string;
  badge: string;
  icon: string;
  timeWindowLabel: string;
  activeNow: boolean;
  expiryIndexToday: string;
  reason: string;
  suggestedBudget: number;
  sizingLabel: string;
  targetProfitPct: number;
  stopLossPct: number;
  dateTime: string;
}

export interface StrategyScheduleRecord {
  id?: string;
  strategy: string;
  name: string;
  startTime: string;
  endTime: string;
  timeWindowLabel?: string;
  daysActive: string;
  marketCondition: string;
  description: string;
  badge?: string;
  icon?: string;
  targetProfitPct: number;
  stopLossPct: number;
  suggestedBudget?: number;
  sizingLabel?: string;
  status: "ACTIVE" | "UPCOMING" | "PAST";
  isActiveNow: boolean;
  dateTime: string;
}

export interface StrategyScheduleResponse {
  liveSuggestion: LiveStrategySuggestion;
  schedules: StrategyScheduleRecord[];
  history: unknown[];
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  symbol: string;
  action: SignalAction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  charges: number;
  slippage: number;
  netPnl: number;
  netPnlPercent: number;
  exitReason: "TARGET" | "STOP_LOSS" | "TIMEOUT" | "END_OF_DAY";
  barsHeld: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  interval: string;
  fromDate: string;
  toDate: string;
  totalBars: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossPnl: number;
  totalBrokerage: number;
  totalStt: number;
  totalTaxesAndCharges: number;
  totalSlippage: number;
  netPnl: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  expectancy: number;
  equityCurve: Array<{ time: string; equity: number }>;
  trades: BacktestTrade[];
  initialCapital: number;
  finalCapital: number;
}

export interface StrategyBacktestParams {
  strategy?: AutoPilotStrategy | undefined;
  symbol: string;
  token: string;
  exchange: string;
  fromDate: string;
  toDate: string;
  interval?: string | undefined;
  initialCapital?: number | undefined;
  targetPct?: number | undefined;
  stopLossPct?: number | undefined;
  lotSize?: number | undefined;
}
