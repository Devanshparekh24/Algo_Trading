import { useQuery } from '@tanstack/react-query';
import { getPositions } from '../services/portfolioService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch user's live portfolio positions
 */
export const usePositions = () => {
  return useQuery({
    queryKey: queryKeys.portfolio.positions(),
    queryFn: getPositions,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};
