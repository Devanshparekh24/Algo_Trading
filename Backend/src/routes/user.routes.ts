import { Router } from "express";
import { getProfile, logout, getPositions, getHoldings, getHistoricalData, getLtp } from "../controllers/user.controller.js";

const router = Router();

// GET /profile -> Get user profile from SmartAPI
router.get("/profile", getProfile);

// POST /logout -> Log out from SmartAPI
router.post("/logout", logout);

// GET /positions -> Get open positions from SmartAPI
router.get("/positions", getPositions);

// GET /holdings -> Get equity holdings from SmartAPI
router.get("/holdings", getHoldings);

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

export default router;

