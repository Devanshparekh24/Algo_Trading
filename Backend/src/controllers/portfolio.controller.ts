import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getPositions as fetchPositions,
  getHoldings as fetchHoldings,
} from "../services/smartapi/index.js";

/**
 * Get open positions from the portfolio.
 * Never throws 500 or 403 to the frontend; returns 200 with positions (or empty list).
 * Supports ?refresh=true or ?force=true to bypass cache and fetch ultra fresh live market quotes.
 */
export const getPositions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    const positions = await fetchPositions(forceRefresh);
    res.status(200).json(
      new ApiResponse(200, positions || [], "Positions fetched successfully")
    );
  } catch (error: any) {
    console.warn("[PortfolioController] Error fetching positions, returning empty list:", error?.message || error);
    res.status(200).json(
      new ApiResponse(200, [], "Positions fetched (fallback)")
    );
  }
});

/**
 * Get equity holdings / portfolio.
 * Never throws 500 or 403 to the frontend; returns 200 with holdings and summary metrics.
 * Supports ?refresh=true or ?force=true to bypass cache and fetch ultra fresh live market quotes.
 */
export const getHoldings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    const holdings = await fetchHoldings(forceRefresh);
    res.status(200).json(
      new ApiResponse(200, holdings, "Holdings fetched successfully")
    );
  } catch (error: any) {
    console.warn("[PortfolioController] Error fetching holdings, returning fallback payload:", error?.message || error);
    res.status(200).json(
      new ApiResponse(
        200,
        {
          holdings: [],
          totalholding: {
            totalholdingvalue: 0,
            totalinvvalue: 0,
            totalprofitandloss: 0,
            totalpnlpercentage: 0,
          },
        },
        "Holdings fetched (fallback)"
      )
    );
  }
});
