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

