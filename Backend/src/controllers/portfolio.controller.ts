import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getPositions as fetchPositions,
  getHoldings as fetchHoldings,
  getKnownPositions,
  getKnownHoldingsPayload,
} from "../services/smartapi/index.js";

// Safe upper bound for portfolio HTTP requests (never let them hang or reach frontend axios timeout)
const MAX_PORTFOLIO_WAIT_MS = 5000;

/**
 * Get open positions from the portfolio.
 * Never throws 500, 403 or times out; returns 200 with positions (or cached snapshot).
 * Supports ?refresh=true or ?force=true to bypass cache and fetch fresh live quotes.
 */
export const getPositions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    
    // Race against 5-second cap so the client never hits a timeout
    const fetchPromise = fetchPositions(forceRefresh);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), MAX_PORTFOLIO_WAIT_MS)
    );

    const positions = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (positions !== null) {
      res.status(200).json(
        new ApiResponse(200, positions, "Positions fetched successfully")
      );
      return;
    }

    // Fast-fallback snapshot from memory
    const cached = getKnownPositions();
    console.warn("[PortfolioController] Positions fetch exceeded 5s cap; returning cached snapshot.");
    res.status(200).json(
      new ApiResponse(200, cached || [], "Positions fetched (cached snapshot)")
    );
  } catch (error: any) {
    console.warn("[PortfolioController] Error fetching positions, returning fallback:", error?.message || error);
    res.status(200).json(
      new ApiResponse(200, getKnownPositions() || [], "Positions fetched (fallback)")
    );
  }
});

/**
 * Get equity holdings / portfolio.
 * Never throws 500, 403 or times out; returns 200 with holdings and summary metrics.
 * Supports ?refresh=true or ?force=true to bypass cache and fetch fresh live quotes.
 */
export const getHoldings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    
    // Race against 5-second cap so the client never hits a timeout
    const fetchPromise = fetchHoldings(forceRefresh);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), MAX_PORTFOLIO_WAIT_MS)
    );

    const holdings = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (holdings !== null) {
      res.status(200).json(
        new ApiResponse(200, holdings, "Holdings fetched successfully")
      );
      return;
    }

    // Fast-fallback snapshot from memory
    const cached = getKnownHoldingsPayload();
    console.warn("[PortfolioController] Holdings fetch exceeded 5s cap; returning cached snapshot.");
    res.status(200).json(
      new ApiResponse(200, cached, "Holdings fetched (cached snapshot)")
    );
  } catch (error: any) {
    console.warn("[PortfolioController] Error fetching holdings, returning fallback payload:", error?.message || error);
    res.status(200).json(
      new ApiResponse(200, getKnownHoldingsPayload(), "Holdings fetched (fallback)")
    );
  }
});
