// ---------------------------------------------------------------------------
// SmartAPI – User Profile Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { UserProfile } from "../types.js";
import { handleApiError } from "./errorHandler.js";

/**
 * Fetch the user profile / account details.
 * Requires a valid JWT token.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const jwtToken = await getValidSession();
  const config = getConfig();

  const url = `${BASE_URL}/rest/secure/angelbroking/user/v1/getProfile`;
  const headers = buildHeaders(config.API_KEY, jwtToken);

  try {
    const response = await axios.get<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: UserProfile;
    }>(url, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status || !data) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || `Profile fetch failed (status: ${status}, response: ${JSON.stringify(response.data)})`;
      console.error(`[SmartAPI] Profile fetch failed details:`, response.data);
      throw new Error(errMsg);
    }

    console.log("[SmartAPI] Profile fetched successfully.");
    return data;
  } catch (error) {
    handleApiError(error, "profile fetch");
  }
}