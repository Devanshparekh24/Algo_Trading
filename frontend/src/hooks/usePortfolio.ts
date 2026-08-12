import { useQuery } from '@tanstack/react-query';
import { getPositions } from '../services/portfolioService';

export const usePositions = () => {
  return useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};
