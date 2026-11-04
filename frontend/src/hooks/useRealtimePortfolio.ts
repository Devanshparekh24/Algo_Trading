// ---------------------------------------------------------------------------
// Hook: Realtime Portfolio & Webhook Live Stream (Ultra-Low Latency)
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
import type { HoldingsResponseData, Holding, Position } from '../types';

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
      const token = tick.symbolToken;
      const key = symbol || token;
      if (!key) return;

      // Update flash direction indicator
      setFlashes((prev) => {
        const oldLtp = prev[key]?.ltp ?? tick.ltp;
        const direction: 'up' | 'down' = tick.ltp >= oldLtp ? 'up' : 'down';
        const updated = {
          ...prev,
          [key]: {
            ltp: tick.ltp,
            direction,
            timestamp: Date.now(),
          },
        };
        if (symbol && token && symbol !== token) {
          updated[token] = updated[key];
        }
        return updated;
      });

      // Optimistically update React Query Holdings cache in real time
      queryClient.setQueriesData<HoldingsResponseData>(
        { queryKey: queryKeys.portfolio.holdings() },
        (oldData) => {
          if (!oldData || !oldData.holdings) return oldData;

          const updatedHoldings = oldData.holdings.map((h: Holding) => {
            if (
              (symbol && h.tradingsymbol === symbol) ||
              (token && h.symboltoken === token)
            ) {
              const qty = Number(h.quantity || 0);
              const avg = Number(h.averageprice || 0);
              const newLtp = tick.ltp;
              const newPnl = (newLtp - avg) * qty;
              const newPnlPct = avg > 0 ? ((newLtp - avg) / avg) * 100 : 0;

              return {
                ...h,
                ltp: newLtp,
                close: tick.close !== undefined ? tick.close : h.close,
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

    // 2. Handle live open position tick
    const onPositionTick = (tick: RealtimeTickData) => {
      setLastTickTime(new Date().toLocaleTimeString());

      const symbol = tick.tradingSymbol;
      const token = tick.symbolToken;
      const key = symbol || token;
      if (!key) return;

      // Update flash direction indicator
      setFlashes((prev) => {
        const oldLtp = prev[key]?.ltp ?? tick.ltp;
        const direction: 'up' | 'down' = tick.ltp >= oldLtp ? 'up' : 'down';
        const updated = {
          ...prev,
          [key]: {
            ltp: tick.ltp,
            direction,
            timestamp: Date.now(),
          },
        };
        if (symbol && token && symbol !== token) {
          updated[token] = updated[key];
        }
        return updated;
      });

      // Optimistically update React Query Positions cache in real time
      queryClient.setQueriesData<Position[]>(
        { queryKey: queryKeys.portfolio.positions() },
        (oldPositions) => {
          if (!oldPositions || !Array.isArray(oldPositions)) return oldPositions;

          return oldPositions.map((pos) => {
            const matches =
              (symbol && (pos.tradingsymbol === symbol || pos.symbol === symbol)) ||
              (token && pos.symboltoken === token);

            if (matches) {
              const freshLtp = tick.ltp;
              const netQty = Number(pos.netqty || pos.quantity || 0);
              const avgPrice = Number(pos.averageprice || 0);
              let m2m = Number(pos.m2m || 0);
              let pnl = Number(pos.pnl || 0);

              if (netQty !== 0 && avgPrice > 0) {
                m2m = (freshLtp - avgPrice) * netQty;
                const realized = Number(pos.realised || (pos as any).realisedpnl || 0);
                pnl = realized + m2m;
              }

              return {
                ...pos,
                ltp: String(freshLtp),
                lp: String(freshLtp),
                m2m: String(Number(m2m.toFixed(2))),
                pnl: String(Number(pnl.toFixed(2))),
              };
            }
            return pos;
          });
        }
      );
    };

    // 3. Handle full portfolio update broadcast
    const onPortfolioUpdate = (payload: {
      type: string;
      data?: {
        holdings?: Holding[];
        totalholding?: any;
        positions?: Position[];
      } | HoldingsResponseData;
    }) => {
      setLastTickTime(new Date().toLocaleTimeString());
      const data = payload?.data;
      if (!data) return;

      if ('holdings' in data && data.holdings) {
        queryClient.setQueriesData<HoldingsResponseData>(
          { queryKey: queryKeys.portfolio.holdings() },
          (old) => ({
            ...old,
            holdings: data.holdings || [],
            totalholding: data.totalholding ?? old?.totalholding,
          })
        );
      }

      if ('positions' in data && Array.isArray(data.positions)) {
        queryClient.setQueriesData<Position[]>(
          { queryKey: queryKeys.portfolio.positions() },
          data.positions
        );
      }
    };

    // 4. Handle incoming Webhook event
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
    socket.on('position_tick', onPositionTick);
    socket.on('portfolio_update', onPortfolioUpdate);
    socket.on('webhook_event', onWebhookEvent);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('holding_tick', onHoldingTick);
      socket.off('position_tick', onPositionTick);
      socket.off('portfolio_update', onPortfolioUpdate);
      socket.off('webhook_event', onWebhookEvent);
    };
  }, [queryClient]);

  const requestImmediateRefresh = useCallback(() => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('request_portfolio_refresh');
    }
  }, []);

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
    requestImmediateRefresh,
    simulateTick,
    dismissWebhookBanner,
  };
};
