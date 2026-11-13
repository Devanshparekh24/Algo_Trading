// ---------------------------------------------------------------------------
// Order Controller – REST Handlers for Angel One Order APIs v1
// Endpoints: placeOrder, modifyOrder, cancelOrder, getOrderBook, getTradeBook, getLtpData, details
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";
import {
  placeSmartApiOrder,
  modifySmartApiOrder,
  cancelSmartApiOrder,
  getSmartApiOrderBook,
  getSmartApiTradeBook,
  getIndividualOrderDetails,
  getLtpData,
  type OrderPlacementRequest,
  type OrderModifyRequest,
} from "../services/smartapi/index.js";

/**
 * POST /api/v1/order/placeOrder
 * Place a new order (NORMAL, STOPLOSS, ROBO, AMO)
 * Supports live broker execution and paper simulation mode.
 */
export async function placeOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body || {};
    const {
      variety = "NORMAL",
      tradingsymbol,
      symboltoken,
      transactiontype,
      exchange = "NSE",
      ordertype = "MARKET",
      producttype = "INTRADAY",
      duration = "DAY",
      price = "0",
      triggerprice = "0",
      squareoff = "0",
      stoploss = "0",
      trailingStopLoss,
      quantity = "1",
      disclosedquantity = "0",
      ordertag,
      scripconsent = "yes",
      mode,
    } = body;

    if (!tradingsymbol || !symboltoken || !transactiontype) {
      res.status(400).json({
        status: false,
        message: "Missing required fields: tradingsymbol, symboltoken, transactiontype",
        errorcode: "VALIDATION_ERROR",
        data: null,
      });
      return;
    }

    const isPaper =
      mode === "PAPER" ||
      body.isPaperTrading === true ||
      String(body.isPaper) === "true";

    const orderReq: OrderPlacementRequest = {
      variety: String(variety).toUpperCase(),
      tradingsymbol: String(tradingsymbol),
      symboltoken: String(symboltoken),
      transactiontype: String(transactiontype).toUpperCase() as "BUY" | "SELL",
      exchange: String(exchange).toUpperCase(),
      ordertype: String(ordertype).toUpperCase(),
      producttype: String(producttype).toUpperCase(),
      duration: String(duration).toUpperCase(),
      price: String(price),
      triggerprice: String(triggerprice),
      squareoff: String(squareoff),
      stoploss: String(stoploss),
      trailingStopLoss: trailingStopLoss ? String(trailingStopLoss) : undefined,
      quantity: String(quantity),
      disclosedquantity: String(disclosedquantity),
      ordertag: ordertag ? String(ordertag).slice(0, 20) : undefined,
      scripconsent: scripconsent ?? "yes",
    };

    const result = await placeSmartApiOrder(orderReq, isPaper);

    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data: {
        script: result.script,
        orderid: result.orderid,
        uniqueorderid: result.uniqueorderid,
      },
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * POST /api/v1/order/modifyOrder
 * Modify an open / pending order
 */
export async function modifyOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body || {};
    const {
      variety = "NORMAL",
      orderid,
      ordertype,
      producttype,
      duration = "DAY",
      price,
      quantity,
      tradingsymbol,
      symboltoken,
      exchange = "NSE",
      triggerprice,
      disclosedquantity,
      mode,
    } = body;

    if (!orderid) {
      res.status(400).json({
        status: false,
        message: "orderid is required to modify an order",
        errorcode: "VALIDATION_ERROR",
        data: null,
      });
      return;
    }

    const isPaper =
      mode === "PAPER" ||
      String(orderid).startsWith("PAPER_") ||
      body.isPaperTrading === true;

    const modifyReq: OrderModifyRequest = {
      variety: String(variety).toUpperCase(),
      orderid: String(orderid),
      ordertype: ordertype ? String(ordertype).toUpperCase() : "LIMIT",
      producttype: producttype ? String(producttype).toUpperCase() : "INTRADAY",
      duration: String(duration).toUpperCase(),
      price: price !== undefined ? String(price) : "0",
      quantity: quantity !== undefined ? String(quantity) : "1",
      tradingsymbol: String(tradingsymbol || ""),
      symboltoken: String(symboltoken || ""),
      exchange: String(exchange).toUpperCase(),
      triggerprice: triggerprice !== undefined ? String(triggerprice) : undefined,
      disclosedquantity: disclosedquantity !== undefined ? String(disclosedquantity) : undefined,
    };

    const result = await modifySmartApiOrder(modifyReq, isPaper);

    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data: {
        orderid: result.orderid,
        uniqueorderid: result.uniqueorderid,
      },
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * POST /api/v1/order/cancelOrder
 * Cancel an open / pending order
 */
export async function cancelOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body || {};
    const orderid = body.orderid || req.query.orderid || req.params.orderid;
    const variety = body.variety || req.query.variety || "NORMAL";
    const mode = body.mode || req.query.mode;

    if (!orderid) {
      res.status(400).json({
        status: false,
        message: "orderid is required to cancel an order",
        errorcode: "VALIDATION_ERROR",
        data: null,
      });
      return;
    }

    const isPaper =
      mode === "PAPER" ||
      String(orderid).startsWith("PAPER_") ||
      body.isPaperTrading === true;

    const result = await cancelSmartApiOrder(
      String(orderid),
      String(variety).toUpperCase(),
      isPaper
    );

    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data: {
        orderid: result.orderid,
        uniqueorderid: result.uniqueorderid,
      },
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * GET /api/v1/order/getOrderBook
 * Retrieve current order book (live broker + paper trades)
 */
export async function getOrderBookController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await getSmartApiOrderBook();
    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data: orders,
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * GET /api/v1/order/getTradeBook
 * Retrieve trades for current day (live broker + paper trades)
 */
export async function getTradeBookController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const trades = await getSmartApiTradeBook();
    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data: trades,
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * POST /api/v1/order/getLtpData
 * Retrieve LTP data for a scrip
 */
export async function getLtpDataController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body || {};
    const exchange = body.exchange || "NSE";
    const tradingsymbol = body.tradingsymbol || body.tradingSymbol;
    const symboltoken = body.symboltoken || body.symbolToken;

    if (!tradingsymbol || !symboltoken) {
      res.status(400).json({
        status: false,
        message: "Missing required fields: tradingsymbol, symboltoken",
        errorcode: "VALIDATION_ERROR",
        data: null,
      });
      return;
    }

    const data = await getLtpData({
      exchange,
      tradingsymbol,
      symboltoken,
    });

    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data,
    });
  } catch (error: any) {
    next(error);
  }
}

/**
 * GET /api/v1/order/details/:uniqueorderid
 * Retrieve individual order status using Unique Order ID
 */
export async function getIndividualOrderDetailsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId =
      req.params.uniqueorderid ||
      req.params.id ||
      req.query.uniqueorderid;

    const uniqueorderid = Array.isArray(rawId)
      ? String(rawId[0] || "").trim()
      : String(rawId || "").trim();

    if (!uniqueorderid) {
      res.status(400).json({
        status: false,
        message: "uniqueorderid is required",
        errorcode: "VALIDATION_ERROR",
        data: null,
      });
      return;
    }

    const data = await getIndividualOrderDetails(uniqueorderid);

    res.json({
      status: true,
      message: "SUCCESS",
      errorcode: "",
      data,
    });
  } catch (error: any) {
    next(error);
  }
}
