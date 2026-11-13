// ---------------------------------------------------------------------------
// Expiry Date Resolver & Contract Expiration Validator
// Accurately validates NSE / NFO derivative contracts and filters expired scrips
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/**
 * Parses an expiry string or extracts expiry date from trading symbol.
 * Expiry takes effect at 15:30:00 IST (10:00:00 UTC) on the expiry date.
 */
export function parseExpiryDate(
  expiryStr?: string | null,
  symbol?: string | null
): Date | null {
  // 1. Try explicit expiryStr
  if (expiryStr && typeof expiryStr === "string") {
    const clean = expiryStr.trim().toUpperCase();
    if (clean !== "NEAR" && clean !== "FAR" && clean !== "NEXT") {
      // Format: DDMMMYYYY (e.g. 17NOV2026, 03NOV2026)
      const ddmmyyyy = clean.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
      if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = MONTH_MAP[ddmmyyyy[2]];
        const year = parseInt(ddmmyyyy[3], 10);
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, month, day, 10, 0, 0));
        }
      }

      // Format: DD-MMM-YYYY (e.g. 17-NOV-2026)
      const hyphenMatch = clean.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
      if (hyphenMatch && hyphenMatch[1] && hyphenMatch[2] && hyphenMatch[3]) {
        const day = parseInt(hyphenMatch[1], 10);
        const month = MONTH_MAP[hyphenMatch[2]];
        const year = parseInt(hyphenMatch[3], 10);
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, month, day, 10, 0, 0));
        }
      }

      // Format: YYYY-MM-DD
      const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          return new Date(Date.UTC(year, month, day, 10, 0, 0));
        }
      }

      // Format: DDMMMYY (e.g. 17NOV26)
      const ddmmyy = clean.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
      if (ddmmyy && ddmmyy[1] && ddmmyy[2] && ddmmyy[3]) {
        const day = parseInt(ddmmyy[1], 10);
        const month = MONTH_MAP[ddmmyy[2]];
        const year = 2000 + parseInt(ddmmyy[3], 10);
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(Date.UTC(year, month, day, 10, 0, 0));
        }
      }
    }
  }

  // 2. Extract from trading symbol if expiryStr was missing or unparseable
  if (symbol && typeof symbol === "string") {
    const upperSym = symbol.trim().toUpperCase();
    // Typical Angel One NFO symbol: NIFTY17NOV2624500CE or NIFTY03NOV2625000CE
    const symMatch = upperSym.match(/(\d{2})([A-Z]{3})(\d{2})/);
    if (symMatch && symMatch[1] && symMatch[2] && symMatch[3]) {
      const day = parseInt(symMatch[1], 10);
      const month = MONTH_MAP[symMatch[2]];
      const year = 2000 + parseInt(symMatch[3], 10);
      if (month !== undefined && !isNaN(day)) {
        return new Date(Date.UTC(year, month, day, 10, 0, 0));
      }
    }
  }

  return null;
}

/**
 * Checks whether an option or futures contract has already expired.
 * Returns true if the contract is in the past, false if currently tradeable.
 */
export function isContractExpired(
  expiryStr?: string | null,
  symbol?: string | null
): boolean {
  const expiryDate = parseExpiryDate(expiryStr, symbol);
  if (!expiryDate) return false;
  return Date.now() > expiryDate.getTime();
}

