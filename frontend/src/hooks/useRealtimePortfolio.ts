// ---------------------------------------------------------------------------
// Hook: Realtime Portfolio & Webhook Live Stream
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getSocket,
  triggerWebhookSimulation,
  type RealtimeTickData,
  type WebhookEventPayload,
} from '../services/socketService';
import { queryKeys } from '../constants/queryKeys';
import type { HoldingsResponseData, Holding } from '../types';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export const useRealtimePortfolio = () => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const [lastWebhookEvent, setLastWebhookEvent] = useState<WebhookEventPayload | null>(null);
  const [flashes, setFlashes] = useState<Record<string, PriceTickFlash>>({});

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // 1. Handle live holding tick
    const onHoldingTick = (tick: RealtimeTickData) => {
      setLastTickTime(new Date().toLocaleTimeString());

      const symbol = tick.tradingSymbol;
      if (!symbol) return;

      // Update flash direction indicator
      setFlashes((prev) => {
        const oldLtp = prev[symbol]?.ltp ?? tick.ltp;
        const direction: 'up' | 'down' = tick.ltp >= oldLtp ? 'up' : 'down';
        return {
          ...prev,
          [symbol]: {
            ltp: tick.ltp,
            direction,
            timestamp: Date.now(),
          },
        };
      });

      // Optimistically update React Query Holdings cache in real time
      queryClient.setQueriesData<HoldingsResponseData>(
        { queryKey: queryKeys.portfolio.holdings() },
        (oldData) => {
          if (!oldData || !oldData.holdings) return oldData;

          const updatedHoldings = oldData.holdings.map((h: Holding) => {
            if (h.tradingsymbol === symbol || (tick.symbolToken && h.symboltoken === tick.symbolToken)) {
              const qty = Number(h.quantity || 0);
              const avg = Number(h.averageprice || 0);
              const newLtp = tick.ltp;
              const newPnl = (newLtp - avg) * qty;
              const newPnlPct = avg > 0 ? ((newLtp - avg) / avg) * 100 : 0;

              return {
                ...h,
                ltp: newLtp,
                profitandloss: Number(newPnl.toFixed(2)),
                pnlpercentage: Number(newPnlPct.toFixed(2)),
              };
            }
            return h;
          });

          // Recalculate totals
          let totalInv = 0;
          let totalVal = 0;
          let totalPnl = 0;

          for (const item of updatedHoldings) {
            const q = Number(item.quantity || 0);
            const a = Number(item.averageprice || 0);
            const l = Number(item.ltp || 0);
            totalInv += q * a;
            totalVal += q * l;
            totalPnl += (l - a) * q;
          }

          return {
            ...oldData,
            holdings: updatedHoldings,
            totalholding: {
              totalinvvalue: Number(totalInv.toFixed(2)),
              totalholdingvalue: Number(totalVal.toFixed(2)),
              totalprofitandloss: Number(totalPnl.toFixed(2)),
              totalpnlpercentage: totalInv > 0 ? Number(((totalPnl / totalInv) * 100).toFixed(2)) : 0,
            },
          };
        }
      );
    };

    // 2. Handle full portfolio update broadcast
    const onPortfolioUpdate = (payload: { type: string; data: HoldingsResponseData }) => {
      setLastTickTime(new Date().toLocaleTimeString());
      if (payload?.data) {
        queryClient.setQueriesData({ queryKey: queryKeys.portfolio.holdings() }, payload.data);
      }
    };

    // 3. Handle incoming Webhook event
    const onWebhookEvent = (event: WebhookEventPayload) => {
      console.log('[Realtime] Incoming webhook notification received:', event);
      setLastWebhookEvent(event);
      setLastTickTime(new Date().toLocaleTimeString());

      // Invalidate queries so live data syncs with fresh backend state
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('holding_tick', onHoldingTick);
    socket.on('portfolio_update', onPortfolioUpdate);
    socket.on('webhook_event', onWebhookEvent);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('holding_tick', onHoldingTick);
      socket.off('portfolio_update', onPortfolioUpdate);
      socket.off('webhook_event', onWebhookEvent);
    };
  }, [queryClient]);

  const simulateTick = useCallback(async (symbol = 'SBIN-EQ', price?: number) => {
    return await triggerWebhookSimulation(symbol, price, 'LIVE_TICK_SIMULATION');
  }, []);

  const dismissWebhookBanner = useCallback(() => {
    setLastWebhookEvent(null);
  }, []);

  return {
    isConnected,
    lastTickTime,
    lastWebhookEvent,
    flashes,
    simulateTick,
    dismissWebhookBanner,
  };
};

