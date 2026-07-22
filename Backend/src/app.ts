import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { getProfile, logout } from "./controllers/user.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config", "swagger-output.json"), "utf8")
);

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

// Root-level logout endpoint for compatibility
app.post("/logout", logout);


// Register Swagger documentation UI endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Register API routes
app.use("/api/v1", router);

// Register global error middleware (must be registered after all routes)
app.use(errorHandler);

export default app;
