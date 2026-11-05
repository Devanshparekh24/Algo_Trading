// ---------------------------------------------------------------------------
// Realtime WebSocket & Socket.IO Service (Angel One Live Market Feed)
// ---------------------------------------------------------------------------

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import {
  getHoldings,
  getKnownHoldings,
  updateHoldingQuoteInCache,
  getPositions,
  getKnownPositions,
  updatePositionQuoteInCache,
  type HoldingsPayload,
  type Position,
} from "../smartapi/index.js";
import { getFullModeData } from "../smartapi/api/FullMode.js";
import { getUniverseScrips, updateLiveSignalPrice } from "../ai/aiTrading.service.js";
import {
  getKnownFnoMoverTokens,
  updateFnoMoverQuoteInCache,
  getTopFnoMovers,
} from "../smartapi/fnoMovers.service.js";

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

    // Client requests immediate live portfolio refresh (forces broker cache bypass)
    socket.on("request_portfolio_refresh", async () => {
      try {
        const [liveHoldingsData, livePositionsData] = await Promise.all([
          getHoldings(true),
          getPositions(true),
        ]);
        socket.emit("portfolio_update", {
          type: "REFRESH",
          data: {
            holdings: liveHoldingsData.holdings,
            totalholding: liveHoldingsData.totalholding,
            positions: livePositionsData,
          },
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
          bypassCache: true,
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
          bypassCache: true,
        });
        for (const q of quotesRes.data?.fetched || []) {
          const freshLtp = Number(q.ltp);
          const closePrice = Number(q.close || freshLtp);
          const change = Number(q.netChange ?? freshLtp - closePrice);
          const percentChange = Number(quotePercentChange(freshLtp, closePrice, q.percentChange));
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

    // Client requests immediate live refresh for F&O Movers
    socket.on("request_fno_refresh", async () => {
      try {
        const movers = await getTopFnoMovers(false);
        socket.emit("fno_update", {
          type: "REFRESH",
          data: movers,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        socket.emit("stream_error", { message: err?.message || "Failed to fetch F&O movers" });
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

function quotePercentChange(ltp: number, close: number, rawPct?: number): number {
  if (rawPct !== undefined && !isNaN(rawPct)) return rawPct;
  return close > 0 ? ((ltp - close) / close) * 100 : 0;
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
 * Broadcast updated live open position tick
 */
export function broadcastPositionTick(tick: RealtimeTickData): void {
  if (!io) return;
  io.emit("position_tick", tick);
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
 * Queries Angel One's live quotes API every 1500ms for portfolio holdings, open positions & benchmark indices.
 * Paces requests safely and updates all connected clients with zero price delay.
 */
export function startRealtimeBroadcaster(): void {
  if (streamInterval) clearInterval(streamInterval);

  streamInterval = setInterval(async () => {
    if (!io || io.engine.clientsCount === 0) {
      return; // Only query when frontend clients are actively connected
    }

    try {
      // 1. Gather active tokens from holdings & open positions
      const knownHoldings = getKnownHoldings();
      const knownPositions = getKnownPositions();

      const exchangeTokens: Record<string, string[]> = {
        NSE: [...MARKET_INDICES_TOKENS],
      };

      for (const h of knownHoldings) {
        if (h.symboltoken) {
          const ex = h.exchange || "NSE";
          const list = exchangeTokens[ex] ?? [];
          if (!list.includes(h.symboltoken)) {
            list.push(h.symboltoken);
          }
          exchangeTokens[ex] = list;
        }
      }

      for (const p of knownPositions) {
        if (p.symboltoken) {
          const ex = p.exchange || "NSE";
          const list = exchangeTokens[ex] ?? [];
          if (!list.includes(p.symboltoken)) {
            list.push(p.symboltoken);
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
      } catch {
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

      // Add active F&O Movers tokens (Futures & Options)
      try {
        const fnoTokens = getKnownFnoMoverTokens();
        for (const f of fnoTokens) {
          if (f.token) {
            const ex = f.exchange || "NFO";
            const list = exchangeTokens[ex] ?? [];
            if (!list.includes(f.token)) {
              list.push(f.token);
            }
            exchangeTokens[ex] = list;
          }
        }
      } catch {
        // Continue gracefully
      }

      // 2. Fetch true live market quotes from Angel One
      const quotesRes = await getFullModeData({
        mode: "FULL",
        exchangeTokens,
        bypassCache: true,
      });

      const fetchedQuotes = quotesRes.data?.fetched || [];
      let updatedHoldingsPayload: HoldingsPayload | null = null;
      let updatedPositionsList: Position[] | null = null;

      for (const quote of fetchedQuotes) {
        const freshLtp = Number(quote.ltp);
        const closePrice = Number(quote.close || freshLtp);
        const change = Number(quote.netChange ?? freshLtp - closePrice);
        const percentChange = Number(quotePercentChange(freshLtp, closePrice, quote.percentChange));

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

        // Benchmark Index
        if (MARKET_INDICES_TOKENS.includes(quote.symbolToken)) {
          broadcastMarketTick(tickData);
        }

        // Check if token matches holding
        const hPayload = updateHoldingQuoteInCache(quote.symbolToken, freshLtp, closePrice);
        if (hPayload) {
          updatedHoldingsPayload = hPayload;
          broadcastHoldingTick(tickData);
        }

        // Check if token matches position
        const pList = updatePositionQuoteInCache(quote.symbolToken, freshLtp);
        if (pList && pList.length > 0) {
          updatedPositionsList = pList;
          broadcastPositionTick(tickData);
        }

        // Check if token matches F&O Mover and update live price in memory
        const updatedFno = updateFnoMoverQuoteInCache(
          quote.symbolToken,
          freshLtp,
          tickData.change,
          tickData.percentChange,
          tickData.high,
          tickData.low,
          tickData.tradeVolume
        );
        if (updatedFno) {
          broadcastSocketEvent("fno_tick", tickData);
        }
      }

      // 3. Broadcast updated live portfolio calculation with TRUE updated prices
      if (updatedHoldingsPayload || updatedPositionsList) {
        broadcastPortfolioUpdate({
          holdings: updatedHoldingsPayload?.holdings ?? getKnownHoldings(),
          totalholding: updatedHoldingsPayload?.totalholding,
          positions: updatedPositionsList ?? getKnownPositions(),
        });
      }
    } catch (err: any) {
      console.warn("[SmartAPI Streamer] Live quote polling:", err?.message || err);
    }
  }, 1500);
}
