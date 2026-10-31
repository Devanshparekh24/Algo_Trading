// ---------------------------------------------------------------------------
// Hook: Realtime Market Stream (Angel One Live Quotes)
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, type RealtimeTickData } from '../services/socketService';
import { queryKeys } from '../constants/queryKeys';
import type { NiftyQuote } from '../types';

export interface MarketPriceFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export const useRealtimeMarket = () => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMarketTickTime, setLastMarketTickTime] = useState<string | null>(null);
  const [flashes, setFlashes] = useState<Record<string, MarketPriceFlash>>({});

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('request_market_refresh');
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onMarketTick = (tick: RealtimeTickData) => {
      setLastMarketTickTime(new Date().toLocaleTimeString());

      const token = tick.symbolToken;
      const symbol = tick.tradingSymbol || token;
      if (!token && !symbol) return;

      const key = token || symbol || '';

      // Set price flash direction
      setFlashes((prev) => {
        const oldLtp = prev[key]?.ltp ?? tick.ltp;
        const direction: 'up' | 'down' = tick.ltp >= oldLtp ? 'up' : 'down';
        return {
          ...prev,
          [key]: {
            ltp: tick.ltp,
            direction,
            timestamp: Date.now(),
          },
        };
      });

      // 1. Update Nifty quote cache if it's Nifty 50
      if (token === '99926000' || (symbol && symbol.toLowerCase().includes('nifty 50'))) {
        queryClient.setQueryData<NiftyQuote>(queryKeys.market.niftyQuote(), (old) => {
          if (!old) return old;
          return {
            ...old,
            ltp: tick.ltp,
            open: tick.open ?? old.open,
            high: tick.high ?? old.high,
            low: tick.low ?? old.low,
            close: tick.close ?? old.close,
            netChange: tick.change ?? old.netChange,
            percentChange: tick.percentChange ?? old.percentChange,
            avgPrice: tick.avgPrice ?? old.avgPrice,
            tradeVolume: tick.tradeVolume ?? old.tradeVolume,
            exchFeedTime: tick.timestamp || old.exchFeedTime,
          };
        });
      }

      // 2. Update Major Indices list cache
      queryClient.setQueryData<NiftyQuote[]>(['market', 'indices'], (oldList) => {
        if (!oldList || !Array.isArray(oldList)) return oldList;
        return oldList.map((item) => {
          if (item.symbolToken === token || item.tradingSymbol === symbol) {
            return {
              ...item,
              ltp: tick.ltp,
              open: tick.open ?? item.open,
              high: tick.high ?? item.high,
              low: tick.low ?? item.low,
              close: tick.close ?? item.close,
              netChange: tick.change ?? item.netChange,
              percentChange: tick.percentChange ?? item.percentChange,
              avgPrice: tick.avgPrice ?? item.avgPrice,
              tradeVolume: tick.tradeVolume ?? item.tradeVolume,
              exchFeedTime: tick.timestamp || item.exchFeedTime,
            };
          }
          return item;
        });
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('market_tick', onMarketTick);

    if (socket.connected) {
      setIsConnected(true);
      socket.emit('request_market_refresh');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('market_tick', onMarketTick);
    };
  }, [queryClient]);

  const requestLiveRefresh = useCallback(() => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('request_market_refresh');
    }
  }, []);

  return {
    isConnected,
    lastMarketTickTime,
    flashes,
    requestLiveRefresh,
  };
};

