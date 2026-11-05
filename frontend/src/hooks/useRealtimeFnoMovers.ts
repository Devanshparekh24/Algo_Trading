// ===========================================================================
// Real-time F&O Movers Live Stream Hook (Angel One 1.5s Live Ticks)
// ===========================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, requestFnoRefresh, type RealtimeTickData } from '../services/socketService';
import { queryKeys } from '../constants/queryKeys';
import type { FnoMoversResponse, FnoMoverItem } from '../types';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export const useRealtimeFnoMovers = () => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastKnownPrices = useRef<Record<string, number>>({});

  const handlePriceTick = useCallback(
    (tick: RealtimeTickData) => {
      const token = tick.symbolToken;
      const symbol = tick.tradingSymbol;
      const key = token || symbol;
      if (!key) return;

      const freshLtp = Number(tick.ltp);
      if (!freshLtp || isNaN(freshLtp)) return;

      setLastTickTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // 1. Determine tick direction (up/down flash)
      const prevPrice = lastKnownPrices.current[key] ?? freshLtp;
      const direction: 'up' | 'down' = freshLtp >= prevPrice ? 'up' : 'down';
      lastKnownPrices.current[key] = freshLtp;
      if (token) lastKnownPrices.current[token] = freshLtp;
      if (symbol) lastKnownPrices.current[symbol] = freshLtp;

      setFlashes((prev) => {
        const updated = { ...prev };
        if (token) updated[token] = direction;
        if (symbol) updated[symbol] = direction;
        return updated;
      });

      // Clear flash after 1200ms
      const flashKey = token || symbol || '';
      if (flashTimers.current[flashKey]) {
        clearTimeout(flashTimers.current[flashKey]);
      }
      flashTimers.current[flashKey] = setTimeout(() => {
        setFlashes((prev) => {
          const next = { ...prev };
          if (token) delete next[token];
          if (symbol) delete next[symbol];
          return next;
        });
      }, 1200);

      // 2. Optimistically update React Query F&O Movers cache in real-time
      const updateMoverItem = (item: FnoMoverItem): FnoMoverItem => {
        const matches =
          (token && item.symbolToken === token) ||
          (symbol && item.tradingSymbol.toUpperCase() === symbol.toUpperCase());

        if (!matches) return item;

        const closePrice = tick.close !== undefined ? Number(tick.close) : item.close || freshLtp;
        const change = tick.change !== undefined ? Number(tick.change) : Number((freshLtp - closePrice).toFixed(2));
        const percentChange =
          tick.percentChange !== undefined
            ? Number(tick.percentChange)
            : closePrice > 0
            ? Number((((freshLtp - closePrice) / closePrice) * 100).toFixed(2))
            : item.percentChange;

        const high = tick.high !== undefined ? Number(tick.high) : item.high ? Math.max(item.high, freshLtp) : freshLtp;
        const low = tick.low !== undefined ? Number(tick.low) : item.low ? Math.min(item.low, freshLtp) : freshLtp;

        return {
          ...item,
          ltp: freshLtp,
          netChange: change,
          percentChange,
          high,
          low,
          open: tick.open !== undefined ? Number(tick.open) : item.open,
          close: closePrice,
          tradeVolume: tick.tradeVolume !== undefined ? Number(tick.tradeVolume) : item.tradeVolume,
        };
      };

      const updateCache = (oldData?: FnoMoversResponse): FnoMoversResponse | undefined => {
        if (!oldData || !Array.isArray(oldData.all)) return oldData;

        const updatedAll = oldData.all.map(updateMoverItem);
        const updatedGainers = oldData.gainers.map(updateMoverItem);
        const updatedLosers = oldData.losers.map(updateMoverItem);
        const updatedCalls = oldData.calls.map(updateMoverItem);
        const updatedPuts = oldData.puts.map(updateMoverItem);
        const updatedFutures = oldData.futures.map(updateMoverItem);

        // Update Top Gainer, Top Loser & Most Volatile in summary if updated item matches
        const summary = oldData.summary ? { ...oldData.summary } : undefined;
        if (summary) {
          if (summary.topGainer) summary.topGainer = updateMoverItem(summary.topGainer);
          if (summary.topLoser) summary.topLoser = updateMoverItem(summary.topLoser);
          if (summary.mostVolatile) summary.mostVolatile = updateMoverItem(summary.mostVolatile);
          summary.lastUpdated = new Date().toISOString();
        }

        return {
          ...oldData,
          all: updatedAll,
          gainers: updatedGainers,
          losers: updatedLosers,
          calls: updatedCalls,
          puts: updatedPuts,
          futures: updatedFutures,
          summary: summary || oldData.summary,
        };
      };

      queryClient.setQueryData<FnoMoversResponse>(queryKeys.market.fnoMovers(false), updateCache);
      queryClient.setQueryData<FnoMoversResponse>(queryKeys.market.fnoMovers(true), updateCache);
    },
    [queryClient]
  );

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      requestFnoRefresh();
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onFnoTick = (tick: RealtimeTickData) => {
      handlePriceTick(tick);
    };

    const onAiPriceTick = (tick: RealtimeTickData) => {
      // Also apply ticks from ai_price_tick if they match F&O symbols
      handlePriceTick(tick);
    };

    const onFnoUpdate = (payload: { type: string; data: FnoMoversResponse }) => {
      if (payload && payload.data) {
        queryClient.setQueryData(queryKeys.market.fnoMovers(false), payload.data);
        queryClient.setQueryData(queryKeys.market.fnoMovers(true), payload.data);
        setLastTickTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };

    if (socket.connected) {
      setIsConnected(true);
      requestFnoRefresh();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('fno_tick', onFnoTick);
    socket.on('ai_price_tick', onAiPriceTick);
    socket.on('fno_update', onFnoUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('fno_tick', onFnoTick);
      socket.off('ai_price_tick', onAiPriceTick);
      socket.off('fno_update', onFnoUpdate);

      // Clean up timers
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, [queryClient, handlePriceTick]);

  const requestImmediateRefresh = useCallback(() => {
    requestFnoRefresh();
  }, []);

  return {
    isConnected,
    lastTickTime,
    flashes,
    requestImmediateRefresh,
  };
};

export default useRealtimeFnoMovers;
