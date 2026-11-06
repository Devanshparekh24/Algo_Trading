import api from './api';
import type { ApiResponse, NiftyQuote, FnoMoversResponse, MarketStatusInfo } from '../types';

export const getNiftyQuote = async (): Promise<NiftyQuote> => {
  try {
    const response = await api.get<ApiResponse<NiftyQuote>>('/api/v1/market/nifty');
    return response.data.data;
  } catch {
    const fallback = await api.get<ApiResponse<NiftyQuote>>('/nifty');
    return fallback.data.data;
  }
};

export const getMajorIndices = async (): Promise<NiftyQuote[]> => {
  try {
    const response = await api.get<ApiResponse<NiftyQuote[]>>('/api/v1/market/indices');
    return response.data.data || [];
  } catch {
    const fallback = await api.get<ApiResponse<NiftyQuote[]>>('/indices');
    return fallback.data.data || [];
  }
};

export const getFnoMovers = async (forceRefresh = false): Promise<FnoMoversResponse> => {
  const url = forceRefresh ? '/api/v1/market/fno-movers?refresh=true' : '/api/v1/market/fno-movers';
  try {
    const response = await api.get<ApiResponse<FnoMoversResponse>>(url);
    return response.data.data;
  } catch {
    const fallbackUrl = forceRefresh ? '/fno-movers?refresh=true' : '/fno-movers';
    const fallback = await api.get<ApiResponse<FnoMoversResponse>>(fallbackUrl);
    return fallback.data.data;
  }
};

export const getMarketStatus = async (): Promise<MarketStatusInfo> => {
  try {
    const response = await api.get<ApiResponse<MarketStatusInfo>>('/api/v1/market/status');
    return response.data.data;
  } catch {
    const fallback = await api.get<ApiResponse<MarketStatusInfo>>('/market-status');
    return fallback.data.data;
  }
};

export type GainersLosersDataType = 'PercPriceGainers' | 'PercPriceLosers' | 'PercOIGainers' | 'PercOILosers';
export type GainersLosersExpiryType = 'NEAR' | 'NEXT' | 'FAR';

export interface GainerLoserItem {
  tradingSymbol: string;
  symbolToken: string | number;
  percentChange: number;
  ltp?: number;
  netChange?: number;
  opnInterest?: number;
  netChangeOpnInterest?: number;
  [key: string]: unknown;
}

export interface GainersLosersParams {
  datatype: GainersLosersDataType;
  expirytype: GainersLosersExpiryType;
}

/**
 * Official Angel One SmartAPI Top Gainers / Losers API (Derivatives Segment)
 * Supports PercPriceGainers, PercPriceLosers, PercOIGainers, PercOILosers across NEAR, NEXT, FAR expiry cycles.
 */
export const getGainersLosers = async (params: GainersLosersParams): Promise<GainerLoserItem[]> => {
  try {
    const response = await api.post<ApiResponse<GainerLoserItem[]>>('/api/v1/market/gainers-losers', params);
    return response.data.data || [];
  } catch {
    const fallback = await api.post<ApiResponse<GainerLoserItem[]>>('/gainers-losers', params);
    return fallback.data.data || [];
  }
};

export interface HistoricalCandleParams {
  exchange: string;
  symbolToken: string;
  interval: 'ONE_MINUTE' | 'THREE_MINUTE' | 'FIVE_MINUTE' | 'TEN_MINUTE' | 'FIFTEEN_MINUTE' | 'THIRTY_MINUTE' | 'ONE_HOUR' | 'ONE_DAY';
  fromDate: string;
  toDate: string;
}

export type RawCandleData = [string, number, number, number, number, number];

/**
 * Fetches historical OHLCV candlestick data from Angel One SmartAPI via backend.
 */
export const getHistoricalCandles = async (params: HistoricalCandleParams): Promise<RawCandleData[]> => {
  try {
    const response = await api.post<ApiResponse<RawCandleData[]>>('/api/v1/market/historical', params);
    return response.data.data || [];
  } catch {
    const fallback = await api.post<ApiResponse<RawCandleData[]>>('/market/historical', params);
    return fallback.data.data || [];
  }
};

