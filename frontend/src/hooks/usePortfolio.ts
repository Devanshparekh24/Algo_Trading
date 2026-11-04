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
    staleTime: 1000 * 30, // 30s stale time (real-time ticks handled via WebSocket)
    refetchInterval: 1000 * 30, // 30s background sync fallback
  });
};

/**
 * Hook to fetch user's live equity holdings from SmartAPI with ultra-low latency
 */
export const useHoldings = (useRootEndpoint = false) => {
  return useQuery({
    queryKey: [...queryKeys.portfolio.holdings(), { useRootEndpoint }],
    queryFn: () => getHoldings(useRootEndpoint),
    staleTime: 1000 * 30, // 30s stale time (real-time ticks handled via WebSocket)
    refetchInterval: 1000 * 30, // 30s background sync fallback
  });
};
