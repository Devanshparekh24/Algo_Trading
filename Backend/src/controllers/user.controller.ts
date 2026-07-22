import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getUserProfile,
  logoutSmartAPI,
  getPositions as fetchPositions,
  getHoldings as fetchHoldings,
  getCandleData,
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
  const { exchange, symboltoken, interval, fromdate, todate } = req.body;
  const candles = await getCandleData({ exchange, symboltoken, interval, fromdate, todate });
  res.status(200).json(
    new ApiResponse(200, candles, "Historical candle data fetched successfully")
  );
});




