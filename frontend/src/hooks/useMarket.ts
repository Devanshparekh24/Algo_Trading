import { useQuery } from '@tanstack/react-query';
import { getNiftyQuote } from '../services/marketService';

export const useNiftyQuote = () => {
  return useQuery({
    queryKey: ['niftyQuote'],
    queryFn: getNiftyQuote,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30, // auto refresh the live quote every 30s
  });
};