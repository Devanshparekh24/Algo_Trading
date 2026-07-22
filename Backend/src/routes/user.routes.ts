import { Router } from "express";
import { getProfile, logout } from "../controllers/user.controller.js";

const router = Router();

// GET /profile -> Get user profile from SmartAPI
router.get("/profile", getProfile);

// POST /logout -> Log out from SmartAPI
router.post("/logout", logout);

export default router;
