import { Router } from "express";
import { getProfile } from "../controllers/user.controller.js";

const router = Router();

// GET /profile -> Get user profile from SmartAPI
router.get("/profile", getProfile);

export default router;
