import { Router } from "express";
import authRoutes from "./auth.routes.js";
import portfolioRoutes from "./portfolio.routes.js";
import marketRoutes from "./market.routes.js";
import scripRoutes from "./scrip.routes.js";
import webhookRoutes from "./webhook.routes.js";

const router = Router();

// Mount modular routes
router.use("/auth", authRoutes);
router.use("/portfolio", portfolioRoutes);
router.use("/market", marketRoutes);
router.use("/scrips", scripRoutes);
router.use("/webhook", webhookRoutes);

export default router;
