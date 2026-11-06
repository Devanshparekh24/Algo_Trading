// ---------------------------------------------------------------------------
// AI Trading Service Client
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:5000/api/v1/ai';

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL' | 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM';
  ema9: number;
  ema21: number;
  sma50: number;
  emaTrend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' | 'NEUTRAL';
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    trend: 'BULLISH_CROSSOVER' | 'BEARISH_CROSSOVER' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
    position: 'ABOVE_UPPER' | 'UPPER_HALF' | 'LOWER_HALF' | 'BELOW_LOWER' | 'SQUEEZE';
  };
  atr: number;
  volumeRatio: number;
  supportLevel: number;
  resistanceLevel: number;
  orderBookImbalance: number;
}

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';
export type MarketSegment = 'EQUITY' | 'FNO';
export type ContractType = 'EQ' | 'CE' | 'PE' | 'FUT';
export type OIBuildupType = 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING' | 'NEUTRAL';
export type UniverseSource = 'CORE' | 'HOLDING' | 'MARKET_MOVER' | 'CUSTOM';

export interface UniverseScrip {
  symbol: string;
  token: string;
  exchange: string;
  name?: string;
  segment?: MarketSegment;
  contractType?: ContractType;
  strike?: number;
  expiry?: string;
  lotSize?: number;
  underlying?: string;
  source?: UniverseSource;
}

export interface UniverseResponse {
  universe: UniverseScrip[];
  total: number;
  segment: string;
}

export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
export type BudgetSegment = 'ALL' | 'EQUITY' | 'FNO' | 'VOLATILE_CALLS' | 'VOLATILE_PUTS' | 'VOLATILE_OPTIONS' | 'GREEK_SNIPER';

export interface VolatileOptionItem {
  symbolToken: string;
  tradingSymbol: string;
  name: string;
  instrumentType: 'CE' | 'PE' | 'FUT';
  strike: number | null;
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
}

export interface BudgetAdvisorParams {
  budget: number;
  riskProfile?: RiskProfile;
  segment?: BudgetSegment;
  maxTrades?: number;
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
  }>;
  volatileCalls?: VolatileOptionItem[];
  volatilePuts?: VolatileOptionItem[];
  mostVolatile?: VolatileOptionItem | null;
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
  segment?: MarketSegment;
  contractType?: ContractType;
  strike?: number;
  expiry?: string;
  lotSize?: number;
  underlying?: string;
  openInterest?: number;
  oiBuildup?: OIBuildupType;
  action: SignalAction;
  confidence: number;
  timeframe: string;
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: string;
  netChange: number;
  percentChange: number;
  indicators: TechnicalIndicators;
  greeks?: OptionGreeks;
  aiThesis: {
    summary: string;
    rationale: string[];
    riskFactor: string;
    catalyst: string;
  };
  generatedAt: string;
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED';
}

export type AutoPilotStrategy =
  | 'GREEK_SNIPER'
  | 'GAMMA_BLAST'
  | 'VWAP_TRAP'
  | 'ORB_15M'
  | 'PCR_REVERSAL'
  | 'STANDARD';

export interface AutoPilotConfig {
  enabled: boolean;
  mode: 'PAPER' | 'LIVE';
  strategy: AutoPilotStrategy;
  enforceGoldenHours?: boolean;
  profitTargetPct: number;
  stopLossPct: number;
  thetaTimeoutMinutes: number;
  defaultQuantity: number;
  maxBudgetPerTrade?: number;
  productType: 'INTRADAY' | 'DELIVERY';
  maxDailyTrades: number;
  executedToday: number;
  minConfidence?: number;
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
  action: 'BUY' | 'SELL';
  targetPrice: number;
  stopLossPrice: number;
  enteredAt: number;
  holdingMinutes: number;
  timeoutMinutes: number;
  mode: 'PAPER' | 'LIVE';
  status: 'OPEN' | 'EXITED';
  pnl: number;
  pnlPercent: number;
  exitReason?: 'TARGET' | 'STOP_LOSS' | 'THETA_TIMEOUT' | 'MANUAL';
  greeks?: OptionGreeks;
}

export interface AiTradeLogItem {
  id: string;
  orderId: string;
  symbol: string;
  token: string;
  exchange: string;
  strategy: string;
  action: 'BUY' | 'SELL';
  segment: string;
  contractType?: string;
  strike?: number;
  expiry?: string;
  lotSize: number;
  lots: number;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  mode: 'PAPER' | 'LIVE';
  status: 'OPEN' | 'EXITED' | 'CANCELLED';
  exitReason?: string;
  pnl?: number;
  pnlPercent?: number;
  holdingMinutes?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  iv?: number;
  aiThesis?: {
    summary: string;
    action?: string;
    rationale?: string[];
    riskFactor?: string;
    catalyst?: string;
  };
  indicators?: TechnicalIndicators;
  enteredAt: string;
  exitedAt?: string;
}

export interface AiErrorLogItem {
  id: string;
  source: string;
  action?: string;
  symbol?: string;
  token?: string;
  message: string;
  stack?: string;
  details?: any;
  createdAt: string;
}

export interface GoldenHoursStatus {
  isMorningWindow: boolean;
  isAfternoonWindow: boolean;
  isLunchChop: boolean;
  currentIstTime: string;
  activeWindow: string;
  message: string;
  canTrade: boolean;
}

export interface LiveStrategySuggestion {
  recommendedStrategy: 'GREEK_SNIPER' | 'GAMMA_BLAST' | 'VWAP_TRAP' | 'ORB_15M' | 'PCR_REVERSAL' | 'STANDARD';
  strategyName: string;
  badge: string;
  icon: string;
  timeWindowLabel: string;
  activeNow: boolean;
  expiryIndexToday: string;
  reason: string;
  suggestedBudget?: number;
  sizingLabel?: string;
  targetProfitPct: number;
  stopLossPct: number;
  dateTime: string;
}

export interface StrategyScheduleRecord {
  strategy: 'GREEK_SNIPER' | 'GAMMA_BLAST' | 'VWAP_TRAP' | 'ORB_15M' | 'PCR_REVERSAL' | 'STANDARD';
  name: string;
  badge: string;
  icon: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  daysActive: string;
  bestDays: string;
  marketCondition: string;
  description: string;
  targetProfitPct: number;
  stopLossPct: number;
  suggestedBudget?: number;
  sizingLabel?: string;
  status: 'ACTIVE' | 'UPCOMING' | 'PAST';
  isActiveNow: boolean;
  dateTime: string;
}

export interface StrategyScheduleResponse {
  liveSuggestion: LiveStrategySuggestion;
  schedules: StrategyScheduleRecord[];
  history: any[];
}

export interface OrderBookItem {
  variety: string;
  ordertype: string;
  producttype: string;
  duration: string;
  price: number;
  triggerprice: number;
  quantity: string | number;
  tradingsymbol: string;
  transactiontype: 'BUY' | 'SELL';
  exchange: string;
  symboltoken: string;
  averageprice: number;
  filledshares: string | number;
  orderid: string;
  status: string;
  orderstatus: string;
  updatetime: string;
  text?: string;
}

export interface SignalsResponse {
  signals: TradeSignal[];
  lastScanTime: string | null;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
}

/**
 * Fetch AI Signals (supports optional forced re-scan and segment: EQUITY vs FNO)
 */
export async function fetchAiSignals(refresh = false, segment: MarketSegment = 'EQUITY'): Promise<SignalsResponse> {
  const url = `${API_BASE}/signals?segment=${segment}${refresh ? '&refresh=true' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch AI signals');
  return json.data;
}

/**
 * Dynamically look up and analyze any Option Strike (e.g. NIFTY 25000 PE)
 */
export async function lookupOptionStrike(params: {
  underlying: string;
  strike: number;
  optionType: 'CE' | 'PE';
}): Promise<TradeSignal> {
  const res = await fetch(`${API_BASE}/fno/strike`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to analyze option strike');
  return json.data;
}

/**
 * Run on-demand AI analysis for a specific instrument
 */
export async function analyzeScrip(symbol: string, token: string, exchange = 'NSE'): Promise<TradeSignal> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, token, exchange }),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to analyze scrip');
  return json.data;
}

/**
 * 1-Click Execution for an active signal (supports shares and F&O lots)
 */
export async function executeSignalOrder(params: {
  signalId: string;
  quantity?: number;
  lots?: number;
  productType?: 'INTRADAY' | 'DELIVERY' | 'CARRYFORWARD';
  orderType?: 'MARKET' | 'LIMIT';
  limitPrice?: number;
  mode?: 'PAPER' | 'LIVE';
}): Promise<{ success: boolean; message: string; orderId: string; mode: string; quantity: number }> {
  const res = await fetch(`${API_BASE}/execute-signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to execute order');
  return json.data;
}

/**
 * Fetch Order History (paper simulation + live broker orders)
 */
export async function fetchOrderHistory(): Promise<{ orders: OrderBookItem[]; totalOrders: number }> {
  const res = await fetch(`${API_BASE}/orders`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch order history');
  return json.data;
}

/**
 * Fetch Auto-Pilot Configuration
 */
export async function fetchAutoPilotConfig(): Promise<AutoPilotConfig> {
  const res = await fetch(`${API_BASE}/autopilot`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch Auto-Pilot configuration');
  return json.data;
}

/**
 * Update Auto-Pilot Configuration
 */
export async function updateAutoPilotConfig(config: Partial<AutoPilotConfig>): Promise<AutoPilotConfig> {
  const res = await fetch(`${API_BASE}/autopilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to update Auto-Pilot configuration');
  return json.data;
}

/**
 * Fetch dynamic scanning universe (Equities & F&O)
 */
export async function fetchScanUniverse(segment?: MarketSegment): Promise<UniverseResponse> {
  const url = `${API_BASE}/universe${segment ? `?segment=${segment}` : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch scan universe');
  return json.data;
}

/**
 * Add a custom instrument/strike to the AI scanning universe
 */
export async function addUniverseScrip(scrip: Partial<UniverseScrip>): Promise<UniverseScrip[]> {
  const res = await fetch(`${API_BASE}/universe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scrip),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to add scrip to universe');
  return json.data;
}

/**
 * Remove an instrument from the AI scanning universe
 */
export async function removeUniverseScrip(token: string): Promise<UniverseScrip[]> {
  const res = await fetch(`${API_BASE}/universe/${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to remove scrip from universe');
  return json.data;
}

/**
 * Reset dynamic universe back to default core & holdings
 */
export async function resetUniverse(): Promise<UniverseScrip[]> {
  const res = await fetch(`${API_BASE}/universe/reset`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to reset dynamic universe');
  return json.data;
}

/**
 * Search Instrument table for adding to dynamic universe
 */
export async function searchInstrumentsApi(query: string, limit = 15): Promise<any[]> {
  try {
    const res = await fetch(`http://localhost:5000/api/v1/scrips/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    const json = await res.json();
    if (!json.success && !json.status) return [];
    return json.data || [];
  } catch (err) {
    console.error('Failed to search instruments:', err);
    return [];
  }
}

/**
 * AI Budget Trade Advisor: Analyze user's capital/budget and generate tailored trade suggestions
 */
export async function fetchBudgetAdvice(params: BudgetAdvisorParams): Promise<BudgetAnalysisResult> {
  const res = await fetch(`${API_BASE}/budget-advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to generate budget trade suggestions');
  return json.data;
}

/**
 * Fetch all live active AI positions with live P&L and 45-min theta timeout countdown
 */
export async function fetchActivePositions(): Promise<ActiveAiPosition[]> {
  const res = await fetch(`${API_BASE}/positions`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch active positions');
  return json.data || [];
}

/**
 * 1-Click manual exit for an open AI position
 */
export async function closeActivePosition(id: string): Promise<ActiveAiPosition> {
  const res = await fetch(`${API_BASE}/positions/${encodeURIComponent(id)}/close`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to close position');
  return json.data;
}

/**
 * Retrieve permanent historical database logs of executed AI trades
 */
export async function fetchAiTradeLogs(limit = 100): Promise<AiTradeLogItem[]> {
  const res = await fetch(`${API_BASE}/trade-logs?limit=${limit}`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch trade logs');
  return json.data || [];
}

/**
 * Retrieve database error logs for system, broker, or AI execution issues
 */
export async function fetchAiErrorLogs(limit = 100): Promise<AiErrorLogItem[]> {
  const res = await fetch(`${API_BASE}/error-logs?limit=${limit}`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch error logs');
  return json.data || [];
}

/**
 * Clear all historical error logs from PostgreSQL
 */
export async function clearAiErrorLogs(): Promise<number> {
  const res = await fetch(`${API_BASE}/error-logs`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to clear error logs');
  return json.deletedCount || 0;
}

/**
 * Get current Indian market Golden Hours status and timing window
 */
export async function fetchGoldenHoursStatus(): Promise<GoldenHoursStatus> {
  const res = await fetch(`${API_BASE}/golden-hours`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch golden hours status');
  return json.data;
}

/**
 * Fetch strategy schedules and live IST strategy suggestion
 */
export async function fetchStrategySchedule(): Promise<StrategyScheduleResponse> {
  const res = await fetch(`${API_BASE}/strategy-schedule`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to fetch strategy schedules');
  return json.data;
}

/**
 * Log strategy schedule action or event to backend
 */
export async function logStrategySchedule(payload: Partial<StrategyScheduleRecord>): Promise<any> {
  const res = await fetch(`${API_BASE}/strategy-schedule/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Failed to log strategy schedule');
  return json.data;
}

