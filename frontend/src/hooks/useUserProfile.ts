import { useQuery } from '@tanstack/react-query';
import { getUserProfile, getRMSLimit } from '../services/authService';

export const useUserProfile = () => {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: getUserProfile,
    staleTime: 1000 * 60 * 5,
  });
};

export const useRMSLimit = () => {
  return useQuery({
    queryKey: ['rmsLimit'],
    queryFn: getRMSLimit,
    staleTime: 1000 * 30, // 30s stale time for live RMS margin
    refetchInterval: 1000 * 60, // auto refetch every minute
  });
};
