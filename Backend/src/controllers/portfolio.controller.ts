import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getPositions as fetchPositions,
  getHoldings as fetchHoldings,
} from "../services/smartapi/index.js";

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
