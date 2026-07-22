import { Router } from "express";
import { getProfile, logout, getPositions, getHoldings } from "../controllers/user.controller.js";

const router = Router();

// GET /profile -> Get user profile from SmartAPI
router.get("/profile", getProfile);

// POST /logout -> Log out from SmartAPI
router.post("/logout", logout);

// GET /positions -> Get open positions from SmartAPI
router.get("/positions", getPositions);

// GET /holdings -> Get equity holdings from SmartAPI
router.get("/holdings", getHoldings);

export default router;
