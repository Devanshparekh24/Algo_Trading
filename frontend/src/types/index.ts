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
  symboltoken?: string;
  producttype?: string;
  transactiontype?: string;
  quantity?: string | number;
  averageprice?: string | number;
  netqty?: string | number;
  lp?: string | number;
  pnl?: string | number;
  m2m?: string | number;
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
}


