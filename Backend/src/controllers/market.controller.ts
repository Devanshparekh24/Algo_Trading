import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { getCandleData, getLtpData } from "../services/smartapi/index.js";

/**
 * Fetch historical candle data.
 */
export const getHistoricalData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getHistoricalData] Raw request body:", req.body);
  
  const {
    exchange,
    symboltoken,
    symbolToken,
    interval,
    fromdate,
    fromDate,
    todate,
    toDate,
  } = req.body || {};

  const finalExchange = exchange;
  const finalSymbolToken = symboltoken || symbolToken;
  const finalInterval = interval;
  const finalFromDate = fromdate || fromDate;
  const finalToDate = todate || toDate;

  if (!finalExchange || !finalSymbolToken || !finalInterval || !finalFromDate || !finalToDate) {
    throw new ApiError(
      400,
      "Missing required parameters in request body (exchange, symboltoken/symbolToken, interval, fromdate/fromDate, todate/toDate)"
    );
  }

  const candles = await getCandleData({
    exchange: finalExchange,
    symboltoken: finalSymbolToken,
    interval: finalInterval,
    fromdate: finalFromDate,
    todate: finalToDate,
  });

  res.status(200).json(
    new ApiResponse(200, candles, "Historical candle data fetched successfully")
  );
});

/**
 * Fetch last traded price (LTP) data.
 */
export const getLtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getLtp] Raw request body:", req.body);
  
  const {
    exchange,
    tradingsymbol,
    tradingSymbol,
    symboltoken,
    symbolToken,
  } = req.body || {};

  const finalExchange = exchange;
  const finalTradingSymbol = tradingsymbol || tradingSymbol;
  const finalSymbolToken = symboltoken || symbolToken;

  if (!finalExchange || !finalTradingSymbol || !finalSymbolToken) {
    throw new ApiError(
      400,
      "Missing required parameters in request body (exchange, tradingsymbol/tradingSymbol, symboltoken/symbolToken)"
    );
  }

  const ltpData = await getLtpData({
    exchange: finalExchange,
    tradingsymbol: finalTradingSymbol,
    symboltoken: finalSymbolToken,
  });

  res.status(200).json(
    new ApiResponse(200, ltpData, "LTP data fetched successfully")
  );
});
