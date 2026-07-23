import { Router } from "express";
import { getPositions, getHoldings } from "../controllers/portfolio.controller.js";

const router = Router();

// GET /positions -> Get open positions from SmartAPI
router.get("/positions", getPositions);

// GET /holdings -> Get equity holdings from SmartAPI
router.get("/holdings", getHoldings);

export default router;
