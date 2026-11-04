import api from './api';
import type { ApiResponse, Position, Holding, HoldingsResponseData } from '../types';

/**
 * Fetch open positions from SmartAPI (enriched with live market quotes).
 * Supports refresh flag to force cache bypass on backend.
 */
export const getPositions = async (useRootEndpoint = false, refresh = false): Promise<Position[]> => {
  const base = useRootEndpoint ? '/positions' : '/api/v1/portfolio/positions';
  const endpoint = refresh ? `${base}?refresh=true` : base;
  try {
    const response = await api.get<ApiResponse<Position[]>>(endpoint);
    return response.data.data || [];
  } catch {
    const fallbackEndpoint = refresh ? '/positions?refresh=true' : '/positions';
    const fallback = await api.get<ApiResponse<Position[]>>(fallbackEndpoint);
    return fallback.data.data || [];
  }
};

/**
 * Fetch equity holdings and portfolio summary from SmartAPI (enriched with live market quotes).
 * Supports refresh flag to force cache bypass on backend.
 */
export const getHoldings = async (useRootEndpoint = false, refresh = false): Promise<HoldingsResponseData> => {
  const base = useRootEndpoint ? '/holdings' : '/api/v1/portfolio/holdings';
  const endpoint = refresh ? `${base}?refresh=true` : base;
  try {
    const response = await api.get<ApiResponse<HoldingsResponseData | Holding[]>>(endpoint);
    const data = response.data.data;
    if (Array.isArray(data)) {
      return { holdings: data };
    }
    return {
      holdings: data?.holdings || [],
      totalholding: data?.totalholding,
    };
  } catch {
    const fallbackEndpoint = refresh ? '/holdings?refresh=true' : '/holdings';
    const fallback = await api.get<ApiResponse<HoldingsResponseData | Holding[]>>(fallbackEndpoint);
    const data = fallback.data.data;
    if (Array.isArray(data)) {
      return { holdings: data };
    }
    return {
      holdings: data?.holdings || [],
      totalholding: data?.totalholding,
    };
  }
};
