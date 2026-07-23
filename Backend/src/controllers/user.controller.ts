import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {
  getUserProfile,
  logoutSmartAPI,
  getPositions as fetchPositions,
  getHoldings as fetchHoldings,
  getCandleData,
  getLtpData,
} from "../services/smartapi/index.js";

/**
 * Get user profile details from Angel One SmartAPI.
 */
export const getProfile = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const profile = await getUserProfile();
  res.status(200).json(
    new ApiResponse(200, profile, "User profile fetched successfully")
  );
});

/**
 * Terminate the Angel One session and clear local tokens.
 */
export const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const success = await logoutSmartAPI();
  res.status(200).json(
    new ApiResponse(200, { loggedOut: success }, success ? "Logged out successfully" : "No active session found")
  );
});

/**
 * Get open positions from the portfolio.
 */
export const getPositions = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const positions = await fetchPositions();
  res.status(200).json(
    new ApiResponse(200, positions, "Positions fetched successfully")
  );
});

/**
 * Get equity holdings / portfolio.
 */
export const getHoldings = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const holdings = await fetchHoldings();
  res.status(200).json(
    new ApiResponse(200, holdings, "Holdings fetched successfully")
  );
});

/**
 * Fetch historical candle data.
 */
export const getHistoricalData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // #swagger.description = 'Fetch historical candle data.'
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Historical Data Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            symbolToken: '3045',
            interval: 'FIVE_MINUTE',
            fromDate: '2026-07-20 09:15',
            toDate: '2026-07-22 15:30'
        }
  } */
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
  // #swagger.description = 'Fetch last traded price (LTP) data.'
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'LTP Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            tradingSymbol: 'SBIN-EQ',
            symbolToken: '3045'
        }
  } */
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




