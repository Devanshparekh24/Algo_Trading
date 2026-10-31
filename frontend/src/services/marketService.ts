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