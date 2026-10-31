import api from './api';
import type { ApiResponse, Position, Holding, HoldingsResponseData } from '../types';

/**
 * Fetch open positions from SmartAPI.
 */
export const getPositions = async (useRootEndpoint = false): Promise<Position[]> => {
  const endpoint = useRootEndpoint ? '/positions' : '/api/v1/portfolio/positions';
  try {
    const response = await api.get<ApiResponse<Position[]>>(endpoint);
    return response.data.data || [];
  } catch {
    const fallback = await api.get<ApiResponse<Position[]>>('/positions');
    return fallback.data.data || [];
  }
};

/**
 * Fetch equity holdings and portfolio summary from SmartAPI.
 */
export const getHoldings = async (useRootEndpoint = false): Promise<HoldingsResponseData> => {
  const endpoint = useRootEndpoint ? '/holdings' : '/api/v1/portfolio/holdings';
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
    const fallback = await api.get<ApiResponse<HoldingsResponseData | Holding[]>>('/holdings');
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
