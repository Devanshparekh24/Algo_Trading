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
    const response = await api.get<ApiResponse<Position[]>>(endpoint, { timeout: 7000 });
    return response.data?.data || [];
  } catch (err: any) {
    console.warn('[portfolioService] Positions fetch warning:', err?.message || err);
    return [];
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
    const response = await api.get<ApiResponse<HoldingsResponseData | Holding[]>>(endpoint, { timeout: 7000 });
    const data = response.data?.data;
    if (Array.isArray(data)) {
      return { holdings: data };
    }
    return {
      holdings: data?.holdings || [],
      totalholding: data?.totalholding,
    };
  } catch (err: any) {
    console.warn('[portfolioService] Holdings fetch warning:', err?.message || err);
    return {
      holdings: [],
      totalholding: {
        totalholdingvalue: 0,
        totalinvvalue: 0,
        totalprofitandloss: 0,
        totalpnlpercentage: 0,
      },
    };
  }
};
