import api from './api';
import type { ApiResponse, NiftyQuote } from '../types';

export const getNiftyQuote = async (): Promise<NiftyQuote> => {
  try {
    const response = await api.get<ApiResponse<NiftyQuote>>('/api/v1/market/nifty');
    return response.data.data;
  } catch {
    const fallback = await api.get<ApiResponse<NiftyQuote>>('/nifty');
    return fallback.data.data;
  }
};