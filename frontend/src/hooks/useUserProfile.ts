import { useQuery } from '@tanstack/react-query';
import { getUserProfile, getRMSLimit } from '../services/authService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch Angel One connected client profile.
 * Configured for ONE-TIME ONLY fetch per session:
 * - staleTime: Infinity (never expires during the session)
 * - gcTime: Infinity (never removed from query cache)
 * - refetchOnMount: false (never refetches on route changes or component mounting)
 * - refetchOnWindowFocus: false (never refetches on tab focus)
 * - refetchOnReconnect: false (never refetches on network reconnection)
 */
export const useUserProfile = () => {
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: getUserProfile,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
