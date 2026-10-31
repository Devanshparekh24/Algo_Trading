// ---------------------------------------------------------------------------
// Webhook Controller
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  broadcastWebhookEvent,
  broadcastHoldingTick,
  broadcastPortfolioUpdate,
  type WebhookEventPayload,
} from "../services/websocket/socketService.js";
import { getHoldings } from "../services/smartapi/api/holdings.js";

/**
 * Handle incoming external webhooks (Angel One, TradingView, or custom alerts)
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const payload = req.body;
  const receivedAt = new Date().toISOString();

  console.log("[Webhook] Received incoming webhook:", JSON.stringify(payload));

  const eventPayload: WebhookEventPayload = {
    source: req.headers["x-webhook-source"] as string || (payload?.source || "EXTERNAL_WEBHOOK"),
    eventType: payload?.event || payload?.type || "ORDER_UPDATE",
    symbol: payload?.symbol || payload?.tradingsymbol || payload?.ticker,
    price: payload?.price !== undefined ? Number(payload.price) : payload?.ltp !== undefined ? Number(payload.ltp) : undefined,
    quantity: payload?.quantity !== undefined ? Number(payload.quantity) : payload?.qty !== undefined ? Number(payload.qty) : undefined,
    orderId: payload?.orderid || payload?.orderId,
    status: payload?.status || payload?.orderstatus || "COMPLETED",
    data: payload,
    receivedAt,
  };

  // Broadcast webhook event to all connected WebSocket clients
  broadcastWebhookEvent(eventPayload);

  // If the webhook contains a price tick update for a symbol
  if (eventPayload.symbol && eventPayload.price) {
    broadcastHoldingTick({
      tradingSymbol: eventPayload.symbol,
      ltp: eventPayload.price,
      timestamp: receivedAt,
    });
  }

  // Refresh holdings snapshot and broadcast updated portfolio
  try {
    const updatedHoldings = await getHoldings();
    broadcastPortfolioUpdate(updatedHoldings);
  } catch {
    // If portfolio fetch fails, still return webhook success
  }

  res.status(200).json(
    new ApiResponse(200, eventPayload, "Webhook processed and broadcasted in real-time")
  );
});

/**
 * Simulate a real-time webhook event (useful for testing or frontend demo)
 */
export const simulateWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { symbol = "SBIN-EQ", price, event = "SIMULATED_TICK" } = req.body || {};
  const receivedAt = new Date().toISOString();

  const simulatedPrice = price ? Number(price) : Number((570 + Math.random() * 20).toFixed(2));

  const eventPayload: WebhookEventPayload = {
    source: "WEBHOOK_SIMULATOR",
    eventType: event,
    symbol,
    price: simulatedPrice,
    receivedAt,
  };

  // Broadcast to all clients
  broadcastWebhookEvent(eventPayload);

  broadcastHoldingTick({
    tradingSymbol: symbol,
    ltp: simulatedPrice,
    timestamp: receivedAt,
  });

  res.status(200).json(
    new ApiResponse(200, eventPayload, `Simulated webhook broadcasted: ${symbol} @ ₹${simulatedPrice}`)
  );
});

