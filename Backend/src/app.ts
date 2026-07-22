import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { getProfile } from "./controllers/user.controller.js";
import { swaggerDocument } from "./config/swagger.js";

const app = express();

app.use(cors());
app.use(express.json());

// Root health check endpoint
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Algo Trading API is running 🚀",
  });
});

// Root-level profile endpoint for compatibility
app.get("/profile", getProfile);

// Register Swagger documentation UI endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Register API routes
app.use("/api/v1", router);

// Register global error middleware (must be registered after all routes)
app.use(errorHandler);

export default app;
