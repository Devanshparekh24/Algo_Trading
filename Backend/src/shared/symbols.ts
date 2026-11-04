// ===========================================================================
// Symbol Conversion Engine (Angel One <-> TradingView)
// ===========================================================================
// Breakdown / Conversion Formula:
// Angel One       TradingView
// ----------------------------
// NIFTY           NIFTY
// 01DEC26         261201 (YYMMDD)
// 24900           24900
// CE              C (or PE -> P)
//
// Output: NSE:NIFTY261201C24900

export interface ConvertedOptionFormula {
  brokerSymbol: string;
  tradingViewSymbol: string;
  underlying: string;
  expiryDateFormatted: string; // "261201" (YYMMDD)
  strike: string;
  optionTypeFormatted: "C" | "P"; // "C" for CE, "P" for PE
  fullTradingViewUrl: string;
  isOption: boolean;
}

const MONTH_TO_NUM: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

/**
 * Enterprise converter implementing the Angel One to TradingView Options Formula:
 * - Extracts Underlying (e.g. NIFTY, BANKNIFTY, FINNIFTY, RELIANCE)
 * - Converts DDMMMYY (e.g. 01DEC26) -> YYMMDD (e.g. 261201)
 * - Converts CE -> C, PE -> P
 * - Formats as NSE:UNDERLYING + YYMMDD + OPTION_TYPE + STRIKE
 */
export function convertAngelOneToTradingViewSymbol(
  angelSymbol: string,
  exchange = "NSE"
): ConvertedOptionFormula {
  if (!angelSymbol) {
    return {
      brokerSymbol: "",
      tradingViewSymbol: "NSE:NIFTYBEES",
      underlying: "NIFTY",
      expiryDateFormatted: "",
      strike: "",
      optionTypeFormatted: "C",
      fullTradingViewUrl: "https://www.tradingview.com/chart/?symbol=NSE%3ANIFTYBEES",
      isOption: false,
    };
  }

  let clean = angelSymbol.trim().toUpperCase();
  let exg = exchange.toUpperCase();

  if (clean.includes(":")) {
    const parts = clean.split(":");
    exg = parts[0] || "NSE";
    clean = parts[1] || "";
  }

  clean = clean.replace(/-EQ$/, "").replace(/-BE$/, "").replace(/-BL$/, "").trim();

  // Regex pattern matching: UNDERLYING + DDMMMYY + STRIKE + CE/PE
  // Example: NIFTY01DEC2624900CE
  const optPattern = /^([A-Z]+?)(\d{2})([A-Z]{3})(\d{2})(\d+)(CE|PE)$/;
  const match = clean.match(optPattern);

  if (match) {
    const underlying = match[1] ?? "";
    const day = match[2] ?? "";
    const monthStr = match[3] ?? "JAN";
    const yearShort = match[4] ?? "26";
    const strike = match[5] ?? "";
    const optType = match[6] ?? "CE";

    const monthNum = MONTH_TO_NUM[monthStr] || "01";
    // Convert DDMMMYY (01DEC26) -> YYMMDD (261201)
    const tvExpiry = `${yearShort}${monthNum}${day}`;
    // Convert CE -> C, PE -> P
    const tvOpt = optType === "PE" ? "P" : "C";
    const tvSymbol = `${exg}:${underlying}${tvExpiry}${tvOpt}${strike}`;

    return {
      brokerSymbol: angelSymbol,
      tradingViewSymbol: tvSymbol,
      underlying,
      expiryDateFormatted: tvExpiry,
      strike,
      optionTypeFormatted: tvOpt as "C" | "P",
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`,
      isOption: true,
    };
  }

  // Weekly index format e.g. NIFTY26D0124900CE
  const weeklyOptPattern = /^([A-Z]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/;
  const wMatch = clean.match(weeklyOptPattern);
  if (wMatch) {
    const underlying = wMatch[1] ?? "";
    const yearShort = wMatch[2] ?? "26";
    const monthCode = wMatch[3] ?? "1";
    const day = wMatch[4] ?? "";
    const strike = wMatch[5] ?? "";
    const optType = wMatch[6] ?? "CE";

    const tvOpt = optType === "PE" ? "P" : "C";
    const MONTH_CODE_MAP: Record<string, string> = {
      "1": "01", "2": "02", "3": "03", "4": "04", "5": "05", "6": "06",
      "7": "07", "8": "08", "9": "09", "O": "10", "N": "11", "D": "12",
    };
    const monthNum = MONTH_CODE_MAP[monthCode] || "01";
    const tvExpiry = `${yearShort}${monthNum}${day}`;
    const tvSymbol = `${exg}:${underlying}${tvExpiry}${tvOpt}${strike}`;

    return {
      brokerSymbol: angelSymbol,
      tradingViewSymbol: tvSymbol,
      underlying,
      expiryDateFormatted: tvExpiry,
      strike,
      optionTypeFormatted: tvOpt as "C" | "P",
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`,
      isOption: true,
    };
  }

  // Futures e.g. NIFTY26NOVFUT
  const futPattern = /^([A-Z]+?)(\d{2})([A-Z]{3})FUT$/;
  const fMatch = clean.match(futPattern);
  if (fMatch) {
    const underlying = fMatch[1] ?? "";
    const yearShort = fMatch[2] ?? "26";
    const monthStr = fMatch[3] ?? "NOV";

    const tvSymbol = `${exg}:${underlying}1!`;
    return {
      brokerSymbol: angelSymbol,
      tradingViewSymbol: tvSymbol,
      underlying,
      expiryDateFormatted: `${yearShort}${MONTH_TO_NUM[monthStr] || "01"}`,
      strike: "FUT",
      optionTypeFormatted: "C",
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`,
      isOption: false,
    };
  }

  // Standard Cash Equity
  const equitySymbol = `${exg}:${clean}`;
  return {
    brokerSymbol: angelSymbol,
    tradingViewSymbol: equitySymbol,
    underlying: clean,
    expiryDateFormatted: "",
    strike: "",
    optionTypeFormatted: "C",
    fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(equitySymbol)}`,
    isOption: false,
  };
}
