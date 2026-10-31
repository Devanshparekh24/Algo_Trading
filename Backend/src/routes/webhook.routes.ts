// ---------------------------------------------------------------------------
// Webhook Routes
// ---------------------------------------------------------------------------

import { Router } from "express";
import { handleWebhook, simulateWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// POST /api/v1/webhook -> Receive live trading webhooks
router.post("/", handleWebhook);

// POST /api/v1/webhook/simulate -> Test & trigger simulated live events
router.post("/simulate", simulateWebhook);

export default router;

