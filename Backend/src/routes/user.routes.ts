import { Router } from "express";
import { getProfile, logout, getPositions, getHoldings, getHistoricalData } from "../controllers/user.controller.js";

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
router.post("/historical", getHistoricalData);

export default router;

