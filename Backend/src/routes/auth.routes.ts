import { Router } from "express";
import { getProfile, getRMSLimit, logout } from "../controllers/auth.controller.js";

const router = Router();

// GET /profile -> Get user profile from SmartAPI
router.get("/profile", getProfile);

// GET /rms -> Get RMS / funds & margin details from SmartAPI
router.get("/rms", getRMSLimit);

// POST /logout -> Log out from SmartAPI
router.post("/logout", logout);

export default router;

