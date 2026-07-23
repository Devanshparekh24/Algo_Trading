import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { syncInstruments, searchInstruments } from "../services/smartapi/index.js";

/**
 * Manually trigger a download and caching of the Angel One Scrip Master.
 */
export const syncScripMaster = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  try {
    await syncInstruments();
    res.status(200).json(
      new ApiResponse(200, null, "Scrip master synced and saved to database successfully")
    );
  } catch (error: any) {
    throw new ApiError(500, error.message || "Failed to sync instruments database");
  }
});

/**
 * Search the cached scrip master by symbol/name and segment.
 */
export const searchScripsController = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { query, exchange, limit } = req.query;

  if (!query || typeof query !== "string") {
    throw new ApiError(400, "Query parameter is required and must be a string");
  }

  if (query.trim().length < 2) {
    throw new ApiError(400, "Query search term must be at least 2 characters long");
  }

  const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
  if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit <= 0)) {
    throw new ApiError(400, "Limit must be a positive integer");
  }

  try {
    const scrips = await searchInstruments({
      query: query.trim(),
      exchange: typeof exchange === "string" ? exchange.trim() : undefined,
      limit: parsedLimit,
    });

    res.status(200).json(
      new ApiResponse(200, scrips, `Found ${scrips.length} matching scrips`)
    );
  } catch (error: any) {
    throw new ApiError(400, error.message || "Failed to search scrips in database.");
  }
});
