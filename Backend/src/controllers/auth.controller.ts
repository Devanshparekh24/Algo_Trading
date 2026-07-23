import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getUserProfile, logoutSmartAPI } from "../services/smartapi/index.js";

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
