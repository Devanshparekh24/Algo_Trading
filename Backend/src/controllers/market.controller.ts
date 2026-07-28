import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { getCandleData, getFullModeData, getLtpData, type FullModeRequest } from "../services/smartapi/index.js";

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

/**
 * Fetch Full Mode / Quote data.
 */
export const getFullMode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getFullMode] Raw request body:", req.body);

  const {
    mode,
    exchangeTokens,
    tradingsymbol,
    tradingSymbol,
    exchange,
    symboltoken,
    symbolToken,
  } = req.body || {};

  const finalMode = mode || "FULL";
  const finalExchange = exchange;
  const finalSymbolToken = symboltoken || symbolToken;
  const finalTradingSymbol = tradingsymbol || tradingSymbol;

  let finalExchangeTokens = exchangeTokens;

  // Auto-construct exchangeTokens if not explicitly provided but exchange & symboltoken are present
  if (!finalExchangeTokens && finalExchange && finalSymbolToken) {
    finalExchangeTokens = {
      [finalExchange]: [String(finalSymbolToken)],
    };
  }

  if (!finalExchangeTokens || typeof finalExchangeTokens !== "object" || Object.keys(finalExchangeTokens).length === 0) {
    throw new ApiError(
      400,
      "Missing required parameters in request body. Provide 'exchangeTokens' (e.g. {\"NSE\":[\"3045\"]}) or ('exchange' and 'symboltoken')"
    );
  }

  const requestData: FullModeRequest = {
    mode: finalMode,
    exchangeTokens: finalExchangeTokens,
  };

  if (finalTradingSymbol) requestData.tradingsymbol = finalTradingSymbol;
  if (finalExchange) requestData.exchange = finalExchange;
  if (finalSymbolToken) requestData.symboltoken = String(finalSymbolToken);

  const fullModeData = await getFullModeData(requestData);

  res.status(200).json(
    new ApiResponse(200, fullModeData, "Full Mode / Quote data fetched successfully")
  );
});
