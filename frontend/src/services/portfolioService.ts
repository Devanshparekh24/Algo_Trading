import api from './api';
import type { ApiResponse, Position } from '../types';

export const getPositions = async (): Promise<Position[]> => {
  try {
    const response = await api.get<ApiResponse<Position[]>>('/api/v1/portfolio/positions');
    return response.data.data || [];
  } catch {
    const fallback = await api.get<ApiResponse<Position[]>>('/positions');
    return fallback.data.data || [];
  }
};
