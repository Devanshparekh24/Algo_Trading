import { useQuery } from '@tanstack/react-query';
import { getUserProfile, getRMSLimit } from '../services/authService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch Angel One connected client profile
 */
export const useUserProfile = () => {
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: getUserProfile,
    staleTime: 1000 * 60 * 5, // Profile is stable for 5 minutes
  });
};

/**
 * Hook to fetch live RMS trading limits & available margin
 */
export const useRMSLimit = () => {
  return useQuery({
    queryKey: queryKeys.user.rmsLimit(),
    queryFn: getRMSLimit,
    staleTime: 1000 * 30, // 30s stale time for live RMS margin
    refetchInterval: 1000 * 60, // Auto-refetch every 60s
  });
};
