import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getUserProfile, getRMS, logoutSmartAPI } from "../services/smartapi/index.js";

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
 * Get RMS (Risk Management System) funds and margin limits from Angel One.
 */
export const getRMSLimit = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const rmsData = await getRMS();
  res.status(200).json(
    new ApiResponse(200, rmsData, "RMS limits fetched successfully")
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

