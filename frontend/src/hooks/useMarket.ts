import { useQuery } from '@tanstack/react-query';
import {
  getNiftyQuote,
  getMajorIndices,
  getFnoMovers,
  getMarketStatus,
  getGainersLosers,
  type GainersLosersParams,
} from '../services/marketService';
import { queryKeys } from '../constants/queryKeys';

/**
 * Hook to fetch live NIFTY 50 quote
 * Auto-refetches every 30 seconds
 */
export const useNiftyQuote = () => {
  return useQuery({
    queryKey: queryKeys.market.niftyQuote(),
    queryFn: () => getNiftyQuote(),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};

/**
 * Hook to fetch major benchmark indices live quotes (Nifty 50, Bank Nifty, Fin Nifty)
 */
export const useMajorIndices = () => {
  return useQuery({
    queryKey: ['market', 'indices'],
    queryFn: () => getMajorIndices(),
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
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

/**
 * Hook to fetch official Angel One SmartAPI Top Gainers / Losers (Derivatives)
 * Supports PercPriceGainers, PercPriceLosers, PercOIGainers, PercOILosers across NEAR, NEXT, FAR expiry cycles.
 */
export const useGainersLosers = (params: GainersLosersParams) => {
  return useQuery({
    queryKey: ['market', 'gainersLosers', params.datatype, params.expirytype],
    queryFn: () => getGainersLosers(params),
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30,
  });
};
