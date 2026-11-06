// ---------------------------------------------------------------------------
// SmartAPI – Order Placement & Order Book Endpoints
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { OrderPlacementRequest, OrderPlacementResponse, OrderBookItem } from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-memory paper trading order store for simulation mode
const paperOrders: OrderBookItem[] = [];

/**
 * Place a new order with Angel One SmartAPI (or paper trade simulation)
 */
export async function placeSmartApiOrder(
  request: OrderPlacementRequest,
  isPaperTrading = false
): Promise<OrderPlacementResponse> {
  const quantityStr = String(request.quantity || "1");
  const priceStr = String(request.price ?? "0");

  // Handle Paper Trading mode
  if (isPaperTrading) {
    const paperOrderId = `PAPER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const paperItem: OrderBookItem = {
      variety: request.variety || "NORMAL",
      ordertype: request.ordertype || "MARKET",
      producttype: request.producttype || "INTRADAY",
      duration: request.duration || "DAY",
      price: Number(priceStr) || 0,
      triggerprice: 0,
      quantity: quantityStr,
      disclosedquantity: "0",
      squareoff: 0,
      stoploss: 0,
      trailingstoploss: 0,
      tradingsymbol: request.tradingsymbol,
      transactiontype: request.transactiontype,
      exchange: request.exchange || "NSE",
      symboltoken: request.symboltoken,
      averageprice: Number(priceStr) || 100,
      filledshares: quantityStr,
      unfilledshares: "0",
      orderid: paperOrderId,
      status: "complete",
      orderstatus: "complete",
      updatetime: nowStr,
      exchtime: nowStr,
      exchorderupdatetime: nowStr,
      text: "Simulated Paper Trade Execution",
    };

    paperOrders.unshift(paperItem);
    console.log(`[PaperTrading] Executed simulated order: ${request.transactiontype} ${quantityStr}x ${request.tradingsymbol} @ ₹${priceStr} [${paperOrderId}]`);

    return {
      script: request.tradingsymbol,
      orderid: paperOrderId,
      uniqueorderid: `SIM_${paperOrderId}`,
    };
  }

  // Live Broker Order Placement via Angel One SmartAPI
  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    const ordertype = request.ordertype || "MARKET";
    const isMarket = ordertype === "MARKET";
    const exchange = request.exchange || (request.tradingsymbol?.endsWith("CE") || request.tradingsymbol?.endsWith("PE") || request.tradingsymbol?.endsWith("FUT") ? "NFO" : "NSE");
    const isFno = exchange === "NFO";
    let producttype = request.producttype || (isFno ? "CARRYFORWARD" : "INTRADAY");
    if (isFno && producttype === "DELIVERY") {
      producttype = "CARRYFORWARD";
    }

    const payload = {
      variety: request.variety || "NORMAL",
      tradingsymbol: request.tradingsymbol,
      symboltoken: String(request.symboltoken),
      transactiontype: request.transactiontype,
      exchange: exchange,
      ordertype: ordertype,
      producttype: producttype,
      duration: request.duration || "DAY",
      price: isMarket ? "0" : priceStr,
      squareoff: String(request.squareoff ?? "0"),
      stoploss: String(request.stoploss ?? "0"),
      quantity: quantityStr,
      triggerprice: isMarket ? "0" : String(request.triggerprice ?? "0"),
    };

    try {
      const response = await axios.post<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: {
          script: string;
          orderid: string;
          uniqueorderid?: string;
        };
      }>(url, payload, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        if (
          message &&
          (message.toLowerCase().includes("exceeding access rate") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("access denied"))
        ) {
          throw { isRateLimitStatus: true, message };
        }

        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to place order`;
        console.error(`[SmartAPI] Order placement failed:`, response.data);
        throw new Error(errMsg);
      }

      console.log(`[SmartAPI] Order placed successfully: OrderID ${data.orderid} for ${data.script}`);
      return data;
    } catch (error: any) {
      if (error?.isRateLimitStatus) throw error;
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, "order placement");
    }
  }, `placeOrder_${request.tradingsymbol}`);
}

/**
 * Retrieve the current Order Book from Angel One SmartAPI + Paper orders
 */
export async function getSmartApiOrderBook(): Promise<OrderBookItem[]> {
  return executeSmartApiRequest(async () => {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: OrderBookItem[] | null;
      }>(url, { headers });

      const liveOrders = response.data?.data || [];
      return [...paperOrders, ...liveOrders];
    } catch (err: any) {
      console.warn(`[SmartAPI] Live orderbook fetch error (${err?.message || err}), returning paper orders...`);
      return paperOrders;
    }
  }, "getOrderBook");
}

/**
 * Cancel an open order
 */
export async function cancelSmartApiOrder(orderid: string, variety = "NORMAL"): Promise<boolean> {
  // If paper order
  if (orderid.startsWith("PAPER_")) {
    const order = paperOrders.find((o) => o.orderid === orderid);
    if (order) {
      order.status = "cancelled";
      order.orderstatus = "cancelled";
      return true;
    }
  }

  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/cancelOrder`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    try {
      const response = await axios.post<{
        status: boolean;
        message: string;
        data?: unknown;
      }>(url, { variety, orderid }, { headers });

      return response.data?.status ?? false;
    } catch (error) {
      handleApiError(error, "order cancellation");
    }
  }, `cancelOrder_${orderid}`);
}

