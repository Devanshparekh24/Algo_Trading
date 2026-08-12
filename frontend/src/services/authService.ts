import api from './api';
import type { ApiResponse, UserProfile, RMSData } from '../types';

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.get<ApiResponse<UserProfile>>('/api/v1/auth/profile');
    return response.data.data;
  } catch {
    const fallback = await api.get<ApiResponse<UserProfile>>('/profile');
    return fallback.data.data;
  }
};

export const getRMSLimit = async (): Promise<RMSData> => {
  try {
    const response = await api.get<ApiResponse<RMSData>>('/api/v1/auth/rms');
    return response.data.data;
  } catch {
    const fallback = await api.get<ApiResponse<RMSData>>('/rms');
    return fallback.data.data;
  }
};
