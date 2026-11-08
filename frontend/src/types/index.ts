export interface UserProfile {
  clientcode: string;
  name: string;
  email: string;
  mobileno: string;
  exg: string[];
  lastaccesstime: string;
}

export interface Position {
  exchange?: string;
  tradingsymbol?: string;
  symbol?: string;
  symboltoken?: string;
  producttype?: string;
  transactiontype?: string;
  quantity?: string | number;
  averageprice?: string | number;
  netqty?: string | number;
  lp?: string | number;
  ltp?: string | number;
  pnl?: string | number;
  m2m?: string | number;
  realised?: string | number;
  [key: string]: any;
}

export interface Holding {
  tradingsymbol?: string;
  exchange?: string;
  isin?: string;
  t1quantity?: number;
  realisedquantity?: number;
  quantity?: number;
  authorisedquantity?: number;
  product?: string;
  collateralquantity?: number | null;
  collateraltype?: string | null;
  haircut?: number;
  averageprice?: number;
  ltp?: number;
  symboltoken?: string;
  close?: number;
  profitandloss?: number;
  pnlpercentage?: number;
  [key: string]: unknown;
}

export interface TotalHolding {
  totalholdingvalue?: number;
  totalinvvalue?: number;
  totalprofitandloss?: number;
  totalpnlpercentage?: number;
  [key: string]: unknown;
}

export interface HoldingsResponseData {
  holdings: Holding[];
  totalholding?: TotalHolding;
}

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export interface RMSData {
  net?: string | number;
  availablecash?: string | number;
  collateral?: string | number;
  m2mUnrealized?: string | number;
  m2mRealized?: string | number;
  utilisedDebits?: string | number;
  utilisedOptionpremium?: string | number;
  utilisedPayOut?: string | number;
  utilisedHoldings?: string | number;
  [key: string]: unknown;
}

export interface NiftyQuote {
  name?: string;
  exchange?: string;
  tradingSymbol?: string;
  symbolToken?: string;
  ltp?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  netChange?: number | null;
  percentChange?: number | null;
  avgPrice?: number | null;
  tradeVolume?: number | null;
  exchFeedTime?: string | null;
  high52?: number | null;
  low52?: number | null;
}

export interface FnoMoverItem {
  symbolToken: string;
  tradingSymbol: string;
  name: string;
  instrumentType: 'FUT' | 'CE' | 'PE';
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
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
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

export interface MarketStatusInfo {
  isOpen: boolean;
  status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';
  subStatus: string;
  message: string;
  closeReason?: string;
  exchange: string;
  timeIST: string;
  tradingHours: string;
  isWeekend: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  nextSession: string;
  isMuhuratTrading?: boolean;
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

export interface OptionContractDetails {
  symbolToken: string;
  tradingSymbol: string;
  instrumentType: 'CE' | 'PE';
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
  call?: OptionContractDetails;
  put?: OptionContractDetails;
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
  pcrSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  maxPainStrike: number;
  lotSize: number;
  isSynthetic?: boolean;
  dataSource?: 'LIVE_EXCHANGE' | 'SYNTHETIC_FALLBACK';
  warningMessage?: string;
  lastUpdated: string;
  rows: OptionChainStrikeRow[];
}

