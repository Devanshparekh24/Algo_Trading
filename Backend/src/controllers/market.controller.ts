// ---------------------------------------------------------------------------
// Market Controller – REST handlers for all /api/v1/market/* routes
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";
import {
  getCandleData,
  getLtpData,
  getFullModeData,
  getGainersLosersData,
  getOptionChainData,
  smartApiRateLimiter,
} from "../services/smartapi/index.js";
import { getTopFnoMovers } from "../services/smartapi/fnoMovers.service.js";
import { getIndianMarketStatus } from "../utils/marketHours.js";
import { getMarketHolidaysFromDb, getSundayMarketOpenFromDb } from "../services/marketHoliday.service.js";

// ---------------------------------------------------------------------------
// Nifty 50 & major-indices token map
// ---------------------------------------------------------------------------
// Angel One NSE index tokens (verified against SmartAPI instrument dump)
const NIFTY_INDEX_TOKEN = "99926000"; // Nifty 50 (NSE)
const MAJOR_INDEX_TOKENS: Array<{ label: string; exchange: "NSE" | "BSE"; token: string }> = [
  { label: "NIFTY 50",      exchange: "NSE", token: "99926000" },
  { label: "BANK NIFTY",    exchange: "NSE", token: "99926009" },
  { label: "NIFTY IT",      exchange: "NSE", token: "99926013" },
  { label: "NIFTY MIDCAP",  exchange: "NSE", token: "99926044" },
  { label: "SENSEX",        exchange: "BSE", token: "99919000" },
];

// ---------------------------------------------------------------------------
// Historical candle data
// ---------------------------------------------------------------------------
export async function getHistoricalData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = (req.body || {}) as Record<string, string>;
    const exchange = body.exchange;
    const symboltoken = body.symboltoken || body.symbolToken;
    const interval = body.interval;
    const fromdate = body.fromdate || body.fromDate;
    const todate = body.todate || body.toDate;

    if (!exchange || !symboltoken || !interval || !fromdate || !todate) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: exchange, symbolToken (or symboltoken), interval, fromDate (or fromdate), toDate (or todate)",
      });
      return;
    }
    const data = await getCandleData({ exchange, symboltoken, interval, fromdate, todate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// LTP – Last Traded Price
// ---------------------------------------------------------------------------
export async function getLtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = (req.body || {}) as Record<string, string>;
    const exchange = body.exchange;
    const tradingsymbol = body.tradingsymbol || body.tradingSymbol;
    const symboltoken = body.symboltoken || body.symbolToken;

    if (!exchange || !tradingsymbol || !symboltoken) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: exchange, tradingSymbol (or tradingsymbol), symbolToken (or symboltoken)",
      });
      return;
    }
    const data = await getLtpData({ exchange, tradingsymbol, symboltoken });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Full Mode / Quote data
// ---------------------------------------------------------------------------
export async function getFullMode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getFullModeData(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Nifty 50 live quote
// ---------------------------------------------------------------------------
export async function getNiftyQuote(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getFullModeData({
      mode: "FULL",
      exchangeTokens: { NSE: [NIFTY_INDEX_TOKEN] },
    });
    const quote = result.data?.fetched?.[0] ?? null;
    res.json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Major indices (Nifty 50, Bank Nifty, Sensex, etc.)
// ---------------------------------------------------------------------------
export async function getMajorIndices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Group tokens by exchange for the API call
    const exchangeTokens: Record<string, string[]> = {};
    for (const idx of MAJOR_INDEX_TOKENS) {
      if (!exchangeTokens[idx.exchange]) exchangeTokens[idx.exchange] = [];
      exchangeTokens[idx.exchange]!.push(idx.token);
    }

    const result = await getFullModeData({ mode: "FULL", exchangeTokens });

    // Merge labels back into quotes
    const labelled = (result.data?.fetched ?? []).map((q: any) => {
      const meta = MAJOR_INDEX_TOKENS.find(
        (m) => m.token === (q.symbolToken as string)
      );
      return { ...q, label: meta?.label ?? q.tradingSymbol ?? q.symbolToken };
    });

    res.json({ success: true, data: labelled });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Top Gainers & Losers (derivatives)
// ---------------------------------------------------------------------------
export async function getGainersLosers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Fetch the 4 standard derivative gainer/loser lists in parallel
    const [percGainers, percLosers, oiGainers, oiLosers] = await Promise.allSettled([
      getGainersLosersData({ datatype: "PercPriceGainers", expirytype: "NEAR" }),
      getGainersLosersData({ datatype: "PercPriceLosers",  expirytype: "NEAR" }),
      getGainersLosersData({ datatype: "PercOIGainers",    expirytype: "NEAR" }),
      getGainersLosersData({ datatype: "PercOILosers",     expirytype: "NEAR" }),
    ]);

    const extract = (r: PromiseSettledResult<{ data: unknown[] }>) =>
      r.status === "fulfilled" ? r.value.data ?? [] : [];

    res.json({
      success: true,
      data: {
        percPriceGainers: extract(percGainers as PromiseSettledResult<{ data: unknown[] }>),
        percPriceLosers:  extract(percLosers  as PromiseSettledResult<{ data: unknown[] }>),
        percOIGainers:    extract(oiGainers   as PromiseSettledResult<{ data: unknown[] }>),
        percOILosers:     extract(oiLosers    as PromiseSettledResult<{ data: unknown[] }>),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// F&O Movers – top volatile F&O contracts
// ---------------------------------------------------------------------------
export async function getFnoMovers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const forceRefresh = req.query.refresh === "true";
    const data = await getTopFnoMovers(forceRefresh);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Market Status – open / closed / muhurat / pre-open
// ---------------------------------------------------------------------------
export function getMarketStatusController(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const status = getIndianMarketStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Rate Limits – SmartAPI rate limit metrics partitioned by client code
// ---------------------------------------------------------------------------
export function getRateLimitsController(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const metrics = smartApiRateLimiter.getTelemetry();
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Option Chain – live derivatives matrix with Greeks & PCR
// ---------------------------------------------------------------------------
export async function getOptionChainController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const underlying =
      (req.query.underlying as string) ||
      (req.query.symbol as string) ||
      (req.body?.underlying as string) ||
      (req.body?.symbol as string) ||
      "NIFTY";
    const expiry =
      (req.query.expiry as string) || (req.body?.expiry as string) || undefined;
    const strikeCount = Number(
      (req.query.strikeCount as string) ||
      (req.query.strikes as string) ||
      (req.body?.strikeCount as string) ||
      (req.body?.strikes as string) ||
      10
    );

    const data = await getOptionChainData({
      underlying,
      ...(expiry ? { expiry } : {}),
      strikeCount,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Market Holidays – dynamic DB-backed NSE/BSE holiday calendar
// GET /api/v1/market/holidays?year=2026
// ---------------------------------------------------------------------------
export async function getMarketHolidaysController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    const holidays = await getMarketHolidaysFromDb(yearParam);
    res.json({ success: true, data: holidays, count: holidays.length });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Sunday Market Open / Weekend Holidays – dynamic DB-backed
// GET /api/v1/market/sunday-market-open?year=2026
// ---------------------------------------------------------------------------
export async function getSundayMarketOpenController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    const holidays = await getSundayMarketOpenFromDb(yearParam);
    res.json({ success: true, data: holidays, count: holidays.length });
  } catch (err) {
    next(err);
  }
}

