// ---------------------------------------------------------------------------
// SmartAPI Token Store with File-Based Cache Persistence
// Survives server restarts and dev hot-reloads to prevent repeated login rate limits.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import type { TokenStore } from "./types.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SESSION_CACHE_FILE = path.join(DATA_DIR, "session_cache.json");

const store: TokenStore = {
  jwtToken: null,
  refreshToken: null,
  feedToken: null,
  issuedAt: null,
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (err) {
      console.warn("[TokenStore] Could not create data directory:", err);
    }
  }
}

/**
 * Load persisted session tokens from disk on startup
 */
function loadPersistedSession(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(SESSION_CACHE_FILE)) {
      const raw = fs.readFileSync(SESSION_CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.jwtToken && parsed.issuedAt) {
        store.jwtToken = parsed.jwtToken;
        store.refreshToken = parsed.refreshToken || null;
        store.feedToken = parsed.feedToken || null;
        store.issuedAt = new Date(parsed.issuedAt);
        console.log("[TokenStore] Restored SmartAPI session from persistent cache.");
      }
    }
  } catch (err: any) {
    console.warn("[TokenStore] Could not load persisted session cache:", err?.message || err);
  }
}

/**
 * Save current session tokens to disk
 */
function savePersistedSession(): void {
  try {
    ensureDataDir();
    const dataToSave = {
      jwtToken: store.jwtToken,
      refreshToken: store.refreshToken,
      feedToken: store.feedToken,
      issuedAt: store.issuedAt ? store.issuedAt.toISOString() : null,
    };
    fs.writeFileSync(SESSION_CACHE_FILE, JSON.stringify(dataToSave, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("[TokenStore] Failed to save session cache to disk:", err?.message || err);
  }
}

// Load cached session on module initialization
loadPersistedSession();

/**
 * Get a read-only snapshot of the current token store.
 */
export function getStore(): Readonly<TokenStore> {
  return { ...store };
}

/**
 * Update the token store with new tokens and persist to disk.
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
  savePersistedSession();
}

/**
 * Clear all tokens from memory and remove persistent cache file.
 */
export function clearStore(): void {
  store.jwtToken = null;
  store.refreshToken = null;
  store.feedToken = null;
  store.issuedAt = null;
  try {
    if (fs.existsSync(SESSION_CACHE_FILE)) {
      fs.unlinkSync(SESSION_CACHE_FILE);
    }
  } catch {
    // Ignore error
  }
}
