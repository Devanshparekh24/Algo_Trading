import { Router } from "express";
import { getFullMode, getHistoricalData, getLtp, getNiftyQuote } from "../controllers/market.controller.js";

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

export default router;
