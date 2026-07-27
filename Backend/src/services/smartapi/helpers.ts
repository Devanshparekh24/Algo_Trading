// ---------------------------------------------------------------------------
// SmartAPI Helpers
// ---------------------------------------------------------------------------

import speakeasy from "speakeasy";
import { getConfig } from "../../config/env.js";
import axios from "axios";
/**
 * Generate a TOTP (6-digit code) from a base32-encoded secret.
 */
export function generateTOTP(secret: string): string {
  const token = speakeasy.totp({
    secret,
    encoding: "base32",
  });
  if (!token) {
    throw new Error("Failed to generate TOTP – check your TOTP_SECRET");
  }
  return token;
}

/**
 * Build the common headers required by every SmartAPI call.
 */
export function buildHeaders(apiKey: string, jwtToken?: string): Record<string, string> {
  const config = getConfig();
  const headers: Record<string, string> = {
    "X-PrivateKey": apiKey,
    "X-ClientLocalIP": config.STATIC_IP,
    "X-ClientPublicIP": config.STATIC_IP,
    "X-MACAddress": config.MAC_ADDRESS,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }
  return headers;
}



/**
 * Helper to check if an error is an Angel One rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data;

    if (status === 429 || status === 403) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body || "");
      const lower = bodyStr.toLowerCase();
      return (
        lower.includes("exceeding access rate") ||
        lower.includes("rate limit") ||
        lower.includes("access denied")
      );
    }
  }
  return false;
}