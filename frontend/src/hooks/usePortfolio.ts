import { useQuery } from '@tanstack/react-query';
import { getPositions, getHoldings } from '../services/portfolioService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch user's live portfolio positions
 */
export const usePositions = (useRootEndpoint = false) => {
  return useQuery({
    queryKey: [...queryKeys.portfolio.positions(), { useRootEndpoint }],
    queryFn: () => getPositions(useRootEndpoint),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};

/**
 * Hook to fetch user's live equity holdings from SmartAPI
 */
export const useHoldings = (useRootEndpoint = false) => {
  return useQuery({
    queryKey: [...queryKeys.portfolio.holdings(), { useRootEndpoint }],
    queryFn: () => getHoldings(useRootEndpoint),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};
