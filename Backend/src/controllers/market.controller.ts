import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { getCandleData, getFullModeData, getLtpData, getGainersLosersData, type FullModeRequest } from "../services/smartapi/index.js";
import { getTopFnoMovers } from "../services/smartapi/fnoMovers.service.js";
import { getIndianMarketStatus } from "../utils/marketHours.js";

/**
 * Fetch historical candle data.
 */
export const getHistoricalData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getHistoricalData] Raw request body:", req.body);
  
  const {
    exchange,
    symboltoken,
    symbolToken,
    interval,
    fromdate,
    fromDate,
    todate,
    toDate,
  } = req.body || {};

  const finalExchange = exchange;
  const finalSymbolToken = symboltoken || symbolToken;
  const finalInterval = interval;
  const finalFromDate = fromdate || fromDate;
  const finalToDate = todate || toDate;

  if (!finalExchange || !finalSymbolToken || !finalInterval || !finalFromDate || !finalToDate) {
    throw new ApiError(
      400,
      "Missing required parameters in request body (exchange, symboltoken/symbolToken, interval, fromdate/fromDate, todate/toDate)"
    );
  }

  const candles = await getCandleData({
    exchange: finalExchange,
    symboltoken: finalSymbolToken,
    interval: finalInterval,
    fromdate: finalFromDate,
    todate: finalToDate,
  });

  res.status(200).json(
    new ApiResponse(200, candles, "Historical candle data fetched successfully")
  );
});

/**
 * Fetch last traded price (LTP) data.
 */
export const getLtp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getLtp] Raw request body:", req.body);
  
  const {
    exchange,
    tradingsymbol,
    tradingSymbol,
    symboltoken,
    symbolToken,
  } = req.body || {};

  const finalExchange = exchange;
  const finalTradingSymbol = tradingsymbol || tradingSymbol;
  const finalSymbolToken = symboltoken || symbolToken;

  if (!finalExchange || !finalTradingSymbol || !finalSymbolToken) {
    throw new ApiError(
      400,
      "Missing required parameters in request body (exchange, tradingsymbol/tradingSymbol, symboltoken/symbolToken)"
    );
  }

  const ltpData = await getLtpData({
    exchange: finalExchange,
    tradingsymbol: finalTradingSymbol,
    symboltoken: finalSymbolToken,
  });

  res.status(200).json(
    new ApiResponse(200, ltpData, "LTP data fetched successfully")
  );
});

/**
 * Fetch Full Mode / Quote data.
 */
export const getFullMode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("[getFullMode] Raw request body:", req.body);

  const {
    mode,
    exchangeTokens,
    tradingsymbol,
    tradingSymbol,
    exchange,
    symboltoken,
    symbolToken,
  } = req.body || {};

  const finalMode = mode || "FULL";
  const finalExchange = exchange;
  const finalSymbolToken = symboltoken || symbolToken;
  const finalTradingSymbol = tradingsymbol || tradingSymbol;

  let finalExchangeTokens = exchangeTokens;

  // Auto-construct exchangeTokens if not explicitly provided but exchange & symboltoken are present
  if (!finalExchangeTokens && finalExchange && finalSymbolToken) {
    finalExchangeTokens = {
      [finalExchange]: [String(finalSymbolToken)],
    };
  }

  if (!finalExchangeTokens || typeof finalExchangeTokens !== "object" || Object.keys(finalExchangeTokens).length === 0) {
    throw new ApiError(
      400,
      "Missing required parameters in request body. Provide 'exchangeTokens' (e.g. {\"NSE\":[\"3045\"]}) or ('exchange' and 'symboltoken')"
    );
  }

  const requestData: FullModeRequest = {
    mode: finalMode,
    exchangeTokens: finalExchangeTokens,
  };

  if (finalTradingSymbol) requestData.tradingsymbol = finalTradingSymbol;
  if (finalExchange) requestData.exchange = finalExchange;
  if (finalSymbolToken) requestData.symboltoken = String(finalSymbolToken);

  const fullModeData = await getFullModeData(requestData);

  res.status(200).json(
    new ApiResponse(200, fullModeData, "Full Mode / Quote data fetched successfully")
  );
});

/**
 * Nifty 50 index token & trading symbol (from Angel One scrip master).
 * @see Backend/data/scripMaster.json
 */
const NIFTY_INDEX = {
  exchange: "NSE",
  tradingSymbol: "NIFTY",
  symbolToken: "99926000",
};

/**
 * Fetch the Nifty 50 index live quote (current price + OHLC + change stats).
 * Combines the LTP endpoint (current price / OHLC) with the Full Mode quote
 * endpoint (net change, % change, volume, 52 week high/low). If the richer
 * Full Mode payload fails, it gracefully falls back to LTP-only data.
 */
export const getNiftyQuote = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const { exchange, tradingSymbol, symbolToken } = NIFTY_INDEX;

  const ltpData = await getLtpData({
    exchange,
    tradingsymbol: tradingSymbol,
    symboltoken: symbolToken,
  });

  let change: Partial<{
    netChange: number | null;
    percentChange: number | null;
    avgPrice: number | null;
    tradeVolume: number | null;
    exchFeedTime: string | null;
    high52: number | null;
    low52: number | null;
  }> = {};

  try {
    const fullModeData = await getFullModeData({
      mode: "FULL",
      exchangeTokens: { [exchange]: [symbolToken] },
      tradingsymbol: tradingSymbol,
      exchange,
      symboltoken: symbolToken,
    });

    const details = fullModeData.data?.fetched?.[0];
    if (details) {
      change = {
        netChange: details.netChange ?? null,
        percentChange: details.percentChange ?? null,
        avgPrice: details.avgPrice ?? null,
        tradeVolume: details.tradeVolume ?? null,
        exchFeedTime: details.exchFeedTime ?? null,
        high52: details["52WeekHigh"] ?? null,
        low52: details["52WeekLow"] ?? null,
      };
    }
  } catch (err: any) {
    console.warn(
      `[getNiftyQuote] Full Mode quote unavailable, falling back to LTP only: ${err?.message}`
    );
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        exchange,
        tradingSymbol,
        symbolToken,
        ltp: ltpData.ltp,
        open: ltpData.open,
        high: ltpData.high,
        low: ltpData.low,
        close: ltpData.close,
        ...change,
      },
      "Nifty 50 live quote fetched successfully"
    )
  );
});

/**
 * Fetch Top Gainers & Losers (Derivatives market movers) from SmartAPI
 */
export const getGainersLosers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const datatype = (req.query.datatype || req.body?.datatype || "PercPriceGainers") as any;
  const expirytype = (req.query.expirytype || req.body?.expirytype || "NEAR") as any;

  const data = await getGainersLosersData({
    datatype,
    expirytype,
  });

  res.status(200).json(
    new ApiResponse(200, data.data, `Gainers/Losers fetched successfully (${datatype})`)
  );
});

/**
 * Fetch Top Volatile Ups & Downs F&O (Futures, Call Options, Put Options)
 */
export const getFnoMovers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
  const data = await getTopFnoMovers(forceRefresh);

  res.status(200).json(
    new ApiResponse(200, data, "Top volatile F&O movers (Futures & Options) fetched successfully")
  );
});

/**
 * Get live Indian market open/closed status (NSE / BSE / NFO)
 */
export const MAJOR_INDICES_CONFIG = [
  { name: "NIFTY 50", exchange: "NSE", tradingSymbol: "Nifty 50", symbolToken: "99926000" },
  { name: "NIFTY BANK", exchange: "NSE", tradingSymbol: "Nifty Bank", symbolToken: "99926009" },
  { name: "FIN NIFTY", exchange: "NSE", tradingSymbol: "Nifty Fin Service", symbolToken: "99926037" },
];

export const getMajorIndices = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const tokens = MAJOR_INDICES_CONFIG.map((i) => i.symbolToken);
  const fullModeRes = await getFullModeData({
    mode: "FULL",
    exchangeTokens: { NSE: tokens },
  });

  const fetched = fullModeRes.data?.fetched || [];
  const results = MAJOR_INDICES_CONFIG.map((idx) => {
    const live = fetched.find((f) => f.symbolToken === idx.symbolToken);
    return {
      name: idx.name,
      exchange: idx.exchange,
      tradingSymbol: live?.tradingSymbol || idx.tradingSymbol,
      symbolToken: idx.symbolToken,
      ltp: live ? Number(live.ltp) : 0,
      open: live ? Number(live.open) : 0,
      high: live ? Number(live.high) : 0,
      low: live ? Number(live.low) : 0,
      close: live ? Number(live.close) : 0,
      netChange: live ? Number(live.netChange) : 0,
      percentChange: live ? Number(live.percentChange) : 0,
      avgPrice: live ? Number(live.avgPrice) : 0,
      tradeVolume: live ? Number(live.tradeVolume) : 0,
      high52: live ? Number(live["52WeekHigh"] || 0) : null,
      low52: live ? Number(live["52WeekLow"] || 0) : null,
      exchFeedTime: live?.exchFeedTime || new Date().toISOString(),
    };
  });

  res.status(200).json(
    new ApiResponse(200, results, "Major market benchmark indices live quotes fetched successfully")
  );
});

export const getMarketStatusController = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const status = getIndianMarketStatus();

  res.status(200).json(
    new ApiResponse(200, status, "Market status fetched successfully")
  );
});

