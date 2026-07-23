// ---------------------------------------------------------------------------
// SmartAPI Type Definitions
// ---------------------------------------------------------------------------

export interface LoginResponse {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  /** Human-readable message from the API */
  message?: string;
}

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
  quantity?: string;
  averageprice?: string;
  netqty?: string;
  lp?: string;
  pnl?: string;
  m2m?: string;
  [key: string]: unknown;
}

export interface Holding {
  tradingsymbol?: string;
  exchange?: string;
  symboltoken?: string;
  quantity?: number;
  product?: string;
  averageprice?: number;
  ltp?: number;
  close?: number;
  profitandloss?: number;
  realisedquantity?: number;
  [key: string]: unknown;
}

export interface TokenStore {
  jwtToken: string | null;
  refreshToken: string | null;
  feedToken: string | null;
  issuedAt: Date | null;
}

export interface HistoricalDataRequest {
  exchange: string;
  symboltoken: string;
  interval: string;
  fromdate: string;
  todate: string;
}

export type CandleData = [string, number, number, number, number, number];

export interface LtpDataRequest {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
}

export interface LtpDataResponse {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  ltp: number | string;
}