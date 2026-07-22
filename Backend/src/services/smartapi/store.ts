// ---------------------------------------------------------------------------
// In-memory Token Store
// ---------------------------------------------------------------------------

import type { TokenStore } from "./types.js";

/**
 * In-memory token store for SmartAPI session tokens.
 * Tokens are stored here after login/refresh and cleared on logout.
 */
const store: TokenStore = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
  issuedAt: null,
};

/**
 * Get a read-only snapshot of the current token store.
 */
export function getStore(): Readonly<TokenStore> {
  return { ...store };
}

/**
 * Update the token store with new tokens.
 */
export function setStore(tokens: {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
}): void {
  store.jwtToken = tokens.jwtToken;
  store.refreshToken = tokens.refreshToken;
  store.feedToken = tokens.feedToken;
  store.issuedAt = new Date();
}

/**
 * Clear all tokens from the store (e.g. on logout).
 */
export function clearStore(): void {
  store.jwtToken = null;
  store.refreshToken = null;
  store.feedToken = null;
  store.issuedAt = null;
}