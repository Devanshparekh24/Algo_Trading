import { Router } from "express";
import userRoutes from "./user.routes.js";

const router = Router();

// Mount user routes
router.use("/user", userRoutes);

export default router;
