import { Router } from "express";
import { syncScripMaster, searchScripsController } from "../controllers/scrip.controller.js";

const router = Router();

// POST /sync -> Sync/download scrip master
router.post("/sync", syncScripMaster);

// GET /search -> Search local cached scrip master
router.get("/search", searchScripsController);

export default router;
