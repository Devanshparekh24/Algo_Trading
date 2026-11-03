// ---------------------------------------------------------------------------
// Realtime WebSocket & Socket.IO Service (Angel One Live Market Feed)
// ---------------------------------------------------------------------------

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { getHoldings } from "../smartapi/api/holdings.js";
import { getFullModeData } from "../smartapi/api/FullMode.js";
import { getUniverseScrips, updateLiveSignalPrice } from "../ai/aiTrading.service.js";

let io: SocketIOServer | null = null;
let streamInterval: NodeJS.Timeout | null = null;

// Dynamic in-memory set of actively monitored tokens (e.g. from user chart views or strike queries)
const dynamicWatchedTokens = new Map<string, string>(); // token -> exchange

export function registerWatchedToken(token: string, exchange = "NSE"): void {
  if (token) {
    dynamicWatchedTokens.set(token, exchange);
  }
}

export const MARKET_INDICES_TOKENS = ["99926000", "99926009", "99926037"];

export interface RealtimeTickData {
  symbolToken?: string | undefined;
  tradingSymbol?: string | undefined;
  exchange?: string | undefined;
  ltp: number;
  open?: number | undefined;
  high?: number | undefined;
  low?: number | undefined;
  close?: number | undefined;
  change?: number | undefined;
  percentChange?: number | undefined;
  avgPrice?: number | undefined;
  tradeVolume?: number | undefined;
  timestamp: string;
}

export interface WebhookEventPayload {
  source: string;
  eventType: string;
  symbol?: string | undefined;
  price?: number | undefined;
  quantity?: number | undefined;
  orderId?: string | undefined;
  status?: string | undefined;
  data?: unknown;
  receivedAt: string;
}

/**
 * Initialize Socket.IO with HTTP Server
 */
export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (Total: ${io?.engine.clientsCount})`);

    // Send connection acknowledgement
    socket.emit("connected", {
      status: "connected",
      socketId: socket.id,
      timestamp: new Date().toISOString(),
      message: "Connected to Angel One SmartAPI Realtime Live Market Stream 🚀",
    });

    // Client requests immediate live portfolio refresh
    socket.on("request_portfolio_refresh", async () => {
      try {
        const liveHoldingsData = await getHoldings();
        socket.emit("portfolio_update", {
          type: "REFRESH",
          data: liveHoldingsData,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        socket.emit("stream_error", { message: err?.message || "Failed to fetch portfolio" });
      }
    });

    // Client requests immediate live market indices refresh
    socket.on("request_market_refresh", async () => {
      try {
        const quotesRes = await getFullModeData({
          mode: "FULL",
          exchangeTokens: { NSE: MARKET_INDICES_TOKENS },
        });
        const fetched = quotesRes.data?.fetched || [];
        for (const q of fetched) {
          socket.emit("market_tick", {
            symbolToken: q.symbolToken,
            tradingSymbol: q.tradingSymbol,
            exchange: q.exchange,
            ltp: Number(q.ltp),
            open: Number(q.open),
            high: Number(q.high),
            low: Number(q.low),
            close: Number(q.close),
            change: Number(q.netChange),
            percentChange: Number(q.percentChange),
            avgPrice: Number(q.avgPrice),
            tradeVolume: Number(q.tradeVolume),
            timestamp: q.exchFeedTime || new Date().toISOString(),
          });
        }
      } catch (err: any) {
        socket.emit("stream_error", { message: err?.message || "Failed to fetch market indices" });
      }
    });

    // Client requests immediate live refresh for AI Trading universe
    socket.on("request_ai_prices_refresh", async (payload?: { extraTokens?: Array<{ token: string; exchange?: string }> }) => {
      try {
        if (payload?.extraTokens && Array.isArray(payload.extraTokens)) {
          for (const item of payload.extraTokens) {
            if (item && item.token) {
              dynamicWatchedTokens.set(item.token, item.exchange || "NSE");
            }
          }
        }

        const universe = await getUniverseScrips();
        const exchangeTokens: Record<string, string[]> = { NSE: [...MARKET_INDICES_TOKENS] };
        for (const u of universe) {
          if (u.token) {
            const ex = u.exchange || (u.segment === "FNO" ? "NFO" : "NSE");
            const list = exchangeTokens[ex] ?? [];
            if (!list.includes(u.token)) {
              list.push(u.token);
            }
            exchangeTokens[ex] = list;
          }
        }

        // Add dynamic watched tokens (extra stocks/options)
        for (const [token, ex] of dynamicWatchedTokens.entries()) {
          const list = exchangeTokens[ex] ?? [];
          if (!list.includes(token)) {
            list.push(token);
          }
          exchangeTokens[ex] = list;
        }
        const quotesRes = await getFullModeData({
          mode: "FULL",
          exchangeTokens,
        });
        for (const q of quotesRes.data?.fetched || []) {
          const freshLtp = Number(q.ltp);
          const closePrice = Number(q.close || freshLtp);
          const change = Number(q.netChange ?? freshLtp - closePrice);
          const percentChange = Number(q.percentChange ?? (closePrice > 0 ? (change / closePrice) * 100 : 0));
          const tickData: RealtimeTickData = {
            symbolToken: q.symbolToken,
            tradingSymbol: q.tradingSymbol,
            exchange: q.exchange,
            ltp: freshLtp,
            open: Number(q.open),
            high: Number(q.high),
            low: Number(q.low),
            close: closePrice,
            change: Number(change.toFixed(2)),
            percentChange: Number(percentChange.toFixed(2)),
            avgPrice: Number(q.avgPrice),
            tradeVolume: Number(q.tradeVolume),
            timestamp: q.exchFeedTime || new Date().toISOString(),
          };
          socket.emit("ai_price_tick", tickData);
          updateLiveSignalPrice(q.symbolToken, freshLtp, tickData.change, tickData.percentChange);
        }
      } catch (err: any) {
        socket.emit("stream_error", { message: err?.message || "Failed to fetch live AI prices" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  // Start background live market feed loop
  startRealtimeBroadcaster();

  return io;
}

/**
 * Access the Socket.IO instance
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("[Socket.IO] Socket server has not been initialized!");
  }
  return io;
}

/**
 * Broadcast generic socket event to all connected clients
 */
export function broadcastSocketEvent(event: string, payload: unknown): void {
  if (!io) return;
  io.emit(event, payload);
}

/**
 * Broadcast an incoming Webhook event to all connected clients
 */
export function broadcastWebhookEvent(event: WebhookEventPayload): void {
  if (!io) return;
  console.log(`[Socket.IO] Broadcasting webhook event [${event.eventType}] to ${io.engine.clientsCount} clients`);
  io.emit("webhook_event", event);
}

/**
 * Broadcast updated live holding tick
 */
export function broadcastHoldingTick(tick: RealtimeTickData): void {
  if (!io) return;
  io.emit("holding_tick", tick);
}

/**
 * Broadcast updated live market index tick (NIFTY 50, BANK NIFTY, FIN NIFTY)
 */
export function broadcastMarketTick(tick: RealtimeTickData): void {
  if (!io) return;
  io.emit("market_tick", tick);
}

/**
 * Broadcast whole portfolio update
 */
export function broadcastPortfolioUpdate(payload: unknown): void {
  if (!io) return;
  io.emit("portfolio_update", {
    type: "REALTIME_UPDATE",
    data: payload,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Real-time background ticker:
 * Queries Angel One's live quotes API every 3 seconds for both holding stocks & major benchmark indices
 */
export function startRealtimeBroadcaster(): void {
  if (streamInterval) clearInterval(streamInterval);

  streamInterval = setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) {
      return; // Only query when frontend clients are actively connected
    }

    try {
      // 1. Fetch current holdings
      const holdingsPayload = await getHoldings();
      const holdings = holdingsPayload.holdings || [];

      // 2. Batch tokens by exchange for Angel One Quote API (include major indices, holdings & AI universe)
      const exchangeTokens: Record<string, string[]> = {
        NSE: [...MARKET_INDICES_TOKENS],
      };

      for (const h of holdings) {
        if (h.symboltoken) {
          const ex = h.exchange || "NSE";
          const list = exchangeTokens[ex] ?? [];
          if (!list.includes(h.symboltoken)) {
            list.push(h.symboltoken);
          }
          exchangeTokens[ex] = list;
        }
      }

      // Add dynamic AI Universe tokens (Equities & F&O)
      try {
        const universe = await getUniverseScrips();
        for (const u of universe) {
          if (u.token) {
            const ex = u.exchange || (u.segment === "FNO" ? "NFO" : "NSE");
            const list = exchangeTokens[ex] ?? [];
            if (!list.includes(u.token)) {
              list.push(u.token);
            }
            exchangeTokens[ex] = list;
          }
        }
      } catch (err: any) {
        // Continue gracefully
      }

      // Add dynamic watched tokens (currently charted stocks or options)
      for (const [token, ex] of dynamicWatchedTokens.entries()) {
        const list = exchangeTokens[ex] ?? [];
        if (!list.includes(token)) {
          list.push(token);
        }
        exchangeTokens[ex] = list;
      }

      // 3. Fetch true live market quote from Angel One
      const quotesRes = await getFullModeData({
        mode: "FULL",
        exchangeTokens,
      });

      const fetchedQuotes = quotesRes.data?.fetched || [];

      for (const quote of fetchedQuotes) {
        const freshLtp = Number(quote.ltp);
        const closePrice = Number(quote.close || freshLtp);
        const change = Number(quote.netChange ?? freshLtp - closePrice);
        const percentChange = Number(quote.percentChange ?? (closePrice > 0 ? (change / closePrice) * 100 : 0));

        const tickData: RealtimeTickData = {
          symbolToken: quote.symbolToken,
          tradingSymbol: quote.tradingSymbol,
          exchange: quote.exchange,
          ltp: freshLtp,
          open: Number(quote.open),
          high: Number(quote.high),
          low: Number(quote.low),
          close: closePrice,
          change: Number(change.toFixed(2)),
          percentChange: Number(percentChange.toFixed(2)),
          avgPrice: Number(quote.avgPrice),
          tradeVolume: Number(quote.tradeVolume),
          timestamp: quote.exchFeedTime || new Date().toISOString(),
        };

        // Broadcast to AI Trading Screen
        broadcastSocketEvent("ai_price_tick", tickData);
        updateLiveSignalPrice(quote.symbolToken, freshLtp, tickData.change, tickData.percentChange);

        // If it's a benchmark index
        if (MARKET_INDICES_TOKENS.includes(quote.symbolToken)) {
          broadcastMarketTick(tickData);
        } else {
          // If it's a portfolio holding stock
          broadcastHoldingTick(tickData);
        }
      }

      // Broadcast updated live portfolio calculation
      broadcastPortfolioUpdate(holdingsPayload);
    } catch (err: any) {
      // Avoid breaking ticker if rate limit or network glitch occurs
      console.warn("[SmartAPI Streamer] Live quote polling:", err?.message || err);
    }
  }, 3000);
}
