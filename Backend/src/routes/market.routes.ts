import { Router } from "express";
import { getFullMode, getHistoricalData, getLtp, getNiftyQuote, getMajorIndices, getGainersLosers, getFnoMovers, getMarketStatusController } from "../controllers/market.controller.js";

const router = Router();

// POST /historical -> Fetch historical candle data from SmartAPI
router.post("/historical", (req, res, next) => {
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Historical Data Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            symbolToken: '3045',
            interval: 'FIVE_MINUTE',
            fromDate: '2026-07-20 09:15',
            toDate: '2026-07-22 15:30'
        }
  } */
  return getHistoricalData(req, res, next);
});

// POST /ltp -> Fetch Last Traded Price (LTP) data from SmartAPI
router.post("/ltp", (req, res, next) => {
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'LTP Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            tradingSymbol: 'SBIN-EQ',
            symbolToken: '3045'
        }
  } */
  return getLtp(req, res, next);
});

// POST /fullmode -> Fetch Full Mode / Quote data from SmartAPI
router.post("/fullmode", (req, res, next) => {
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Full Mode Request parameters',
        required: true,
        schema: {
            mode: 'FULL',
            exchangeTokens: {
                "NSE": ["3045"]
            },
            tradingsymbol: 'SBIN-EQ',
            exchange: 'NSE',
            symboltoken: '3045'
        }
  } */
  return getFullMode(req, res, next);
});

// GET /nifty -> Fetch Nifty 50 index live quote (current price + OHLC + change)
router.get("/nifty", getNiftyQuote);
router.get("/indices", getMajorIndices);

// GET & POST /gainers-losers -> Top gainers/losers in derivatives
router.get("/gainers-losers", getGainersLosers);
router.post("/gainers-losers", getGainersLosers);

// GET /fno-movers & /top-volatile -> Top volatile ups-down F&O (Futures & Options, Call & Put)
router.get("/fno-movers", getFnoMovers);
router.get("/top-volatile", getFnoMovers);

// GET /status -> Live Indian market open/closed status
router.get("/status", getMarketStatusController);

export default router;
