import { useQuery } from '@tanstack/react-query';
import { getNiftyQuote, getFnoMovers, getMarketStatus } from '../services/marketService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch live NIFTY 50 quote
 * Auto-refetches every 30 seconds
 */
export const useNiftyQuote = () => {
  return useQuery({
    queryKey: queryKeys.market.niftyQuote(),
    queryFn: () => getNiftyQuote(),
    staleTime: 1000 * 15, // Consider fresh for 15s
    refetchInterval: 1000 * 30, // Polling interval
  });
};

/**
 * Hook to fetch top volatile Futures & Options (F&O) movers
 * Auto-refetches every 20 seconds
 */
export const useFnoMovers = (forceRefresh = false) => {
  return useQuery({
    queryKey: queryKeys.market.fnoMovers(forceRefresh),
    queryFn: () => getFnoMovers(forceRefresh),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 20,
  });
};

/**
 * Hook to fetch Indian market status & closure reason
 * Auto-refetches every 30 seconds
 */
export const useMarketStatus = () => {
  return useQuery({
    queryKey: queryKeys.market.status(),
    queryFn: () => getMarketStatus(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
};