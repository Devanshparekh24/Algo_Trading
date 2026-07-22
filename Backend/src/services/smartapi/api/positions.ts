// ---------------------------------------------------------------------------
// SmartAPI – Positions Endpoint
// ---------------------------------------------------------------------------

import axios from "axios";
import { getConfig } from "../../../config/env.js";
import { BASE_URL } from "../constants.js";
import { buildHeaders } from "../helpers.js";
import { getValidSession } from "../session.js";
import type { Position } from "../types.js";

/**
 * Retrieve the user's current open trading positions.
 * Requires a valid JWT token.
 */
export async function getPositions(): Promise<Position[]> {
  const jwtToken = await getValidSession();
  const config = getConfig();

  const url = `${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`;
  const headers = buildHeaders(config.API_KEY, jwtToken);

  try {
    const response = await axios.get<{
      status: boolean;
      message: string;
      errorcode?: string;
      data?: Position[] | null;
    }>(url, { headers });

    const { status, message, data, errorcode } = response.data;

    if (!status) {
      const errMsg = errorcode
        ? `[${errorcode}] ${message}`
        : message || `Failed to fetch positions (status: ${status}, response: ${JSON.stringify(response.data)})`;
      console.error(`[SmartAPI] Position fetch failed details:`, response.data);
      throw new Error(errMsg);
    }

    console.log("[SmartAPI] Positions fetched successfully.");
    return data || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        console.error("[SmartAPI] Network error during position fetch:", error.message);
        throw new Error(`Position fetch failed due to network error: ${error.message}`);
      }
      const status = error.response.status;
      const body = error.response.data;
      console.error(
        `[SmartAPI] Position fetch failed (HTTP ${status}):`,
        JSON.stringify(body)
      );
      throw new Error(
        `Position fetch failed (HTTP ${status}): ${JSON.stringify(body)}`
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Unexpected position fetch error: ${String(error)}`);
  }
}