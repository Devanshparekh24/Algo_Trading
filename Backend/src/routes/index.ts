import { Router } from "express";
import userRoutes from "./user.routes.js";
import scripRoutes from "./scrip.routes.js";

const router = Router();

// Mount user routes
router.use("/user", userRoutes);

// Mount scrip routes
router.use("/scrips", scripRoutes);

export default router;
