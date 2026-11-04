import { useQuery } from '@tanstack/react-query';
import { getPositions, getHoldings } from '../services/portfolioService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch user's live portfolio positions with ultra-low latency
 */
export const usePositions = (useRootEndpoint = false) => {
  return useQuery({
    queryKey: [...queryKeys.portfolio.positions(), { useRootEndpoint }],
    queryFn: () => getPositions(useRootEndpoint),
    staleTime: 1000 * 2, // 2s stale time for responsive live updates
    refetchInterval: 1000 * 5, // 5s fallback polling if websocket disconnects
  });
};

/**
 * Hook to fetch user's live equity holdings from SmartAPI with ultra-low latency
 */
export const useHoldings = (useRootEndpoint = false) => {
  return useQuery({
    queryKey: [...queryKeys.portfolio.holdings(), { useRootEndpoint }],
    queryFn: () => getHoldings(useRootEndpoint),
    staleTime: 1000 * 2, // 2s stale time for responsive live updates
    refetchInterval: 1000 * 5, // 5s fallback polling if websocket disconnects
  });
};
