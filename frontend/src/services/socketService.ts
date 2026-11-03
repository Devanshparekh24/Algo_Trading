// ---------------------------------------------------------------------------
// Realtime Socket.IO Client Service
// ---------------------------------------------------------------------------

import { io, Socket } from 'socket.io-client';
import api from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export interface RealtimeTickData {
  symbolToken?: string;
  tradingSymbol?: string;
  exchange?: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  change?: number;
  percentChange?: number;
  avgPrice?: number;
  tradeVolume?: number;
  timestamp: string;
}

export interface WebhookEventPayload {
  source: string;
  eventType: string;
  symbol?: string;
  price?: number;
  quantity?: number;
  orderId?: string;
  status?: string;
  data?: unknown;
  receivedAt: string;
}

/**
 * Get or initialize the Socket.IO connection
 */
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend real-time stream:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected from stream:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
    });
  }

  return socket;
};

/**
 * Trigger simulated webhook for testing real-time pipelines
 */
export const triggerWebhookSimulation = async (
  symbol = 'SBIN-EQ',
  price?: number,
  event = 'TRADE_EXECUTION'
): Promise<WebhookEventPayload> => {
  const response = await api.post('/api/v1/webhook/simulate', {
    symbol,
    price,
    event,
  });
  return response.data.data;
};

/**
 * Request immediate live price refresh for AI trading universe
 */
export const requestAiPricesRefresh = (
  extraTokens?: Array<{ token: string; exchange?: string }>
): void => {
  const s = getSocket();
  if (s.connected) {
    s.emit('request_ai_prices_refresh', { extraTokens });
  }
};

