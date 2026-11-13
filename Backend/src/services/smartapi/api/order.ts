// ---------------------------------------------------------------------------
// SmartAPI – Order Placement, Modification, Cancellation & Tracking Endpoints
// Official Angel One Order API v1 Implementation
// ---------------------------------------------------------------------------

import axios from "axios";
import { randomUUID } from "crypto";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type {
  OrderPlacementRequest,
  OrderPlacementResponse,
  OrderModifyRequest,
  OrderModifyResponse,
  OrderCancelRequest,
  OrderCancelResponse,
  OrderBookItem,
  TradeBookItem,
  IndividualOrderDetails,
} from "../types.js";
import { handleApiError } from "./errorHandler.js";
import { executeSmartApiRequest } from "../rateLimiter.js";

// In-memory paper trading order & trade stores for simulation mode
const paperOrders: OrderBookItem[] = [];
const paperTrades: TradeBookItem[] = [];

/**
 * Generate a realistic Unique Order ID for simulated paper trades
 */
function generateSimUniqueOrderId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * 1. Place a new order with Angel One SmartAPI (or paper trade simulation)
 * POST https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder
 */
export async function placeSmartApiOrder(
  request: OrderPlacementRequest,
  isPaperTrading = false
): Promise<OrderPlacementResponse> {
  const quantityStr = String(request.quantity || "1");
  const priceStr = String(request.price ?? "0");
  const ordertype = request.ordertype || "MARKET";
  const isMarket = ordertype === "MARKET";
  const exchange =
    request.exchange ||
    (request.tradingsymbol?.endsWith("CE") ||
    request.tradingsymbol?.endsWith("PE") ||
    request.tradingsymbol?.endsWith("FUT")
      ? "NFO"
      : "NSE");
  const isFno = exchange === "NFO";
  let producttype = request.producttype || (isFno ? "CARRYFORWARD" : "INTRADAY");
  if (isFno && producttype === "DELIVERY") {
    producttype = "CARRYFORWARD";
  }

  // Handle Paper Trading mode
  if (isPaperTrading) {
    const paperOrderId = `PAPER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const uniqueorderid = generateSimUniqueOrderId();
    const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const fillPrice = Number(priceStr) > 0 ? Number(priceStr) : 100;

    const paperItem: OrderBookItem = {
      variety: request.variety || "NORMAL",
      ordertype,
      producttype,
      duration: request.duration || "DAY",
      price: Number(priceStr) || 0,
      triggerprice: Number(request.triggerprice ?? "0") || 0,
      quantity: quantityStr,
      disclosedquantity: String(request.disclosedquantity ?? "0"),
      squareoff: Number(request.squareoff ?? "0") || 0,
      stoploss: Number(request.stoploss ?? "0") || 0,
      trailingstoploss: Number(request.trailingStopLoss ?? "0") || 0,
      tradingsymbol: request.tradingsymbol,
      transactiontype: request.transactiontype,
      exchange,
      symboltoken: String(request.symboltoken),
      averageprice: fillPrice,
      filledshares: quantityStr,
      unfilledshares: "0",
      orderid: paperOrderId,
      uniqueorderid,
      ordertag: request.ordertag ? request.ordertag.slice(0, 20) : undefined,
      status: "complete",
      orderstatus: "complete",
      updatetime: nowStr,
      exchtime: nowStr,
      exchorderupdatetime: nowStr,
      text: "Simulated Paper Trade Execution",
    };

    paperOrders.unshift(paperItem);

    // Also record in paper trade book
    const paperTrade: TradeBookItem = {
      exchange,
      producttype,
      tradingsymbol: request.tradingsymbol,
      instrumenttype: isFno ? "OPTIDX" : "EQ",
      symbolgroup: isFno ? "FO" : "EQ",
      strikeprice: -1,
      optiontype: "",
      expirydate: "",
      marketlot: 1,
      precision: "2",
      multiplier: "-1",
      tradevalue: (fillPrice * Number(quantityStr)).toFixed(2),
      transactiontype: request.transactiontype,
      fillprice: fillPrice.toFixed(2),
      fillsize: quantityStr,
      orderid: paperOrderId,
      fillid: `FILL_${Date.now()}`,
      filltime: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      uniqueorderid,
    };
    paperTrades.unshift(paperTrade);

    console.log(
      `[PaperTrading] Executed simulated order: ${request.transactiontype} ${quantityStr}x ${request.tradingsymbol} @ ₹${fillPrice} [${paperOrderId}] (uniqueorderid: ${uniqueorderid})`
    );

    return {
      script: request.tradingsymbol,
      orderid: paperOrderId,
      uniqueorderid,
    };
  }

  // Live Broker Order Placement via Angel One SmartAPI
  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    const payload: Record<string, string> = {
      variety: request.variety || "NORMAL",
      tradingsymbol: request.tradingsymbol,
      symboltoken: String(request.symboltoken),
      transactiontype: request.transactiontype,
      exchange,
      ordertype,
      producttype,
      duration: request.duration || "DAY",
      price: isMarket ? "0" : priceStr,
      squareoff: String(request.squareoff ?? "0"),
      stoploss: String(request.stoploss ?? "0"),
      quantity: quantityStr,
      triggerprice: isMarket ? "0" : String(request.triggerprice ?? "0"),
      disclosedquantity: String(request.disclosedquantity ?? "0"),
      scripconsent: request.scripconsent ?? "yes", // Keep "yes" for scrips under surveillance
    };

    if (request.trailingStopLoss) {
      payload.trailingStopLoss = String(request.trailingStopLoss);
    }
    if (request.ordertag) {
      payload.ordertag = request.ordertag.slice(0, 20); // Length must be < 20 characters
    }

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

      const uniqueorderid = data.uniqueorderid || data.orderid;
      console.log(
        `[SmartAPI] Order placed successfully: OrderID ${data.orderid} for ${data.script} (uniqueorderid: ${uniqueorderid})`
      );

      return {
        script: data.script,
        orderid: data.orderid,
        uniqueorderid,
      };
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
 * 2. Modify an existing open order with Angel One SmartAPI (or paper trade simulation)
 * POST https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/modifyOrder
 */
export async function modifySmartApiOrder(
  request: OrderModifyRequest,
  isPaperTrading = false
): Promise<OrderModifyResponse> {
  const orderid = request.orderid;
  const isPaper = isPaperTrading || orderid.startsWith("PAPER_");

  if (isPaper) {
    const existing = paperOrders.find(
      (o) => o.orderid === orderid || (o.uniqueorderid && o.uniqueorderid === orderid)
    );
    if (!existing) {
      throw new Error(`Paper order ${orderid} not found to modify`);
    }

    if (request.price !== undefined) existing.price = Number(request.price);
    if (request.quantity !== undefined) existing.quantity = String(request.quantity);
    if (request.ordertype) existing.ordertype = request.ordertype;
    if (request.duration) existing.duration = request.duration;
    if (request.triggerprice !== undefined) existing.triggerprice = Number(request.triggerprice);
    existing.updatetime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    return {
      orderid: existing.orderid,
      uniqueorderid: existing.uniqueorderid || existing.orderid,
    };
  }

  // Live Modify Order via SmartAPI
  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/modifyOrder`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    const payload: Record<string, string> = {
      variety: request.variety || "NORMAL",
      orderid: request.orderid,
      ordertype: request.ordertype,
      producttype: request.producttype,
      duration: request.duration || "DAY",
      price: String(request.price),
      quantity: String(request.quantity),
      tradingsymbol: request.tradingsymbol,
      symboltoken: String(request.symboltoken),
      exchange: request.exchange,
    };

    if (request.triggerprice !== undefined) {
      payload.triggerprice = String(request.triggerprice);
    }
    if (request.disclosedquantity !== undefined) {
      payload.disclosedquantity = String(request.disclosedquantity);
    }

    try {
      const response = await axios.post<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: {
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
          : message || `Failed to modify order`;
        console.error(`[SmartAPI] Order modification failed:`, response.data);
        throw new Error(errMsg);
      }

      const uniqueorderid = data.uniqueorderid || data.orderid;
      console.log(
        `[SmartAPI] Order modified successfully: OrderID ${data.orderid} (uniqueorderid: ${uniqueorderid})`
      );

      return {
        orderid: data.orderid,
        uniqueorderid,
      };
    } catch (error: any) {
      if (error?.isRateLimitStatus) throw error;
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, "order modification");
    }
  }, `modifyOrder_${request.orderid}`);
}

/**
 * 3. Cancel an open order with Angel One SmartAPI (or paper trade simulation)
 * POST https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/cancelOrder
 */
export async function cancelSmartApiOrder(
  orderParam: string | OrderCancelRequest,
  variety = "NORMAL",
  isPaperTrading = false
): Promise<OrderCancelResponse> {
  const orderid = typeof orderParam === "string" ? orderParam : orderParam.orderid;
  const orderVariety = typeof orderParam === "string" ? variety : (orderParam.variety || variety || "NORMAL");
  const isPaper = isPaperTrading || orderid.startsWith("PAPER_");

  // If paper order
  if (isPaper) {
    const order = paperOrders.find(
      (o) => o.orderid === orderid || (o.uniqueorderid && o.uniqueorderid === orderid)
    );
    if (order) {
      order.status = "cancelled";
      order.orderstatus = "cancelled";
      order.updatetime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      return {
        orderid: order.orderid,
        uniqueorderid: order.uniqueorderid || `SIM_${order.orderid}`,
      };
    }
    return {
      orderid,
      uniqueorderid: `SIM_${orderid}`,
    };
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
        errorcode?: string;
        data?: {
          orderid: string;
          uniqueorderid?: string;
        };
      }>(url, { variety: orderVariety, orderid }, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status) {
        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to cancel order`;
        console.error(`[SmartAPI] Order cancellation failed:`, response.data);
        throw new Error(errMsg);
      }

      const returnedOrderId = data?.orderid || orderid;
      const uniqueorderid = data?.uniqueorderid || returnedOrderId;

      console.log(
        `[SmartAPI] Order cancelled successfully: OrderID ${returnedOrderId} (uniqueorderid: ${uniqueorderid})`
      );

      return {
        orderid: returnedOrderId,
        uniqueorderid,
      };
    } catch (error: any) {
      if (error?.isRateLimitStatus) throw error;
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, "order cancellation");
    }
  }, `cancelOrder_${orderid}`);
}

/**
 * 4. Retrieve the current Order Book from Angel One SmartAPI + Paper orders
 * GET https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getOrderBook
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

      const liveOrders = (response.data?.data || []).map((o) => ({
        ...o,
        uniqueorderid: o.uniqueorderid || o.orderid,
      }));

      return [...paperOrders, ...liveOrders];
    } catch (err: any) {
      console.warn(
        `[SmartAPI] Live orderbook fetch error (${err?.message || err}), returning paper orders...`
      );
      return paperOrders;
    }
  }, "getOrderBook");
}

/**
 * 5. Retrieve the Trade Book (trades for the current day) from Angel One SmartAPI + Paper trades
 * GET https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getTradeBook
 */
export async function getSmartApiTradeBook(): Promise<TradeBookItem[]> {
  return executeSmartApiRequest(async () => {
    try {
      const jwtToken = await getValidSession();
      const config = getConfig();

      const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getTradeBook`;
      const headers = buildHeaders(config.API_KEY, jwtToken);

      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: TradeBookItem[] | null;
      }>(url, { headers });

      const liveTrades = (response.data?.data || []).map((t) => ({
        ...t,
        uniqueorderid: t.uniqueorderid || t.orderid,
      }));

      return [...paperTrades, ...liveTrades];
    } catch (err: any) {
      console.warn(
        `[SmartAPI] Live tradebook fetch error (${err?.message || err}), returning paper trades...`
      );
      return paperTrades;
    }
  }, "getTradeBook");
}

/**
 * 6. Retrieve individual order status using "uniqueorderid"
 * GET https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/details/{UniqueOrderID}
 */
export async function getIndividualOrderDetails(
  uniqueorderid: string
): Promise<IndividualOrderDetails> {
  if (!uniqueorderid || !uniqueorderid.trim()) {
    throw new Error("uniqueorderid is required to fetch order details");
  }

  const cleanId = uniqueorderid.trim();

  // Check paper orders first
  const paperOrder = paperOrders.find(
    (o) => o.uniqueorderid === cleanId || o.orderid === cleanId
  );
  if (paperOrder) {
    return {
      variety: paperOrder.variety,
      ordertype: paperOrder.ordertype,
      producttype: paperOrder.producttype,
      duration: paperOrder.duration,
      price: paperOrder.price,
      triggerprice: paperOrder.triggerprice,
      quantity: paperOrder.quantity,
      disclosedquantity: paperOrder.disclosedquantity || "0",
      squareoff: paperOrder.squareoff || 0,
      stoploss: paperOrder.stoploss || 0,
      trailingstoploss: paperOrder.trailingstoploss || 0,
      tradingsymbol: paperOrder.tradingsymbol,
      transactiontype: paperOrder.transactiontype,
      exchange: paperOrder.exchange,
      symboltoken: paperOrder.symboltoken,
      averageprice: paperOrder.averageprice,
      filledshares: paperOrder.filledshares,
      unfilledshares: paperOrder.unfilledshares,
      orderid: paperOrder.orderid,
      text: paperOrder.text || "Paper Trade Execution",
      status: paperOrder.status,
      orderstatus: paperOrder.orderstatus,
      updatetime: paperOrder.updatetime || "",
      exchtime: paperOrder.exchtime || "",
      exchorderupdatetime: paperOrder.exchorderupdatetime || "",
      fillid: paperOrder.fillid || "",
      filltime: paperOrder.filltime || "",
      parentorderid: paperOrder.parentorderid || "",
      ordertag: paperOrder.ordertag || "",
      uniqueorderid: paperOrder.uniqueorderid || paperOrder.orderid,
    };
  }

  // Live order status via Angel One details endpoint
  return executeSmartApiRequest(async () => {
    const jwtToken = await getValidSession();
    const config = getConfig();

    const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/details/${encodeURIComponent(cleanId)}`;
    const headers = buildHeaders(config.API_KEY, jwtToken);

    try {
      const response = await axios.get<{
        status: boolean;
        message: string;
        errorcode?: string;
        data?: IndividualOrderDetails;
      }>(url, { headers });

      const { status, message, data, errorcode } = response.data;

      if (!status || !data) {
        const errMsg = errorcode
          ? `[${errorcode}] ${message}`
          : message || `Failed to fetch order details for ${cleanId}`;
        console.error(`[SmartAPI] Fetch order details failed:`, response.data);
        throw new Error(errMsg);
      }

      return {
        ...data,
        uniqueorderid: data.uniqueorderid || cleanId,
      };
    } catch (error: any) {
      if (error?.isRateLimitStatus) throw error;
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 429)
      ) {
        throw error;
      }
      handleApiError(error, `fetch order details for ${cleanId}`);
    }
  }, `orderDetails_${cleanId}`);
}
