import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { getProfile, logout, getPositions, getHoldings, getHistoricalData, getLtp } from "./controllers/user.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config", "swagger-output.json"), "utf8")
);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Root-level positions endpoint for compatibility
app.get("/positions", getPositions);

// Root-level holdings endpoint for compatibility
app.get("/holdings", getHoldings);

// Root-level historical data endpoint for compatibility
app.post("/historical", (req, res, next) => {
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'Historical Data Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            symbolToken: '3045',
            interval: 'FIVE_MINUTE',
            fromDate: '2026-07-20 09:15',
            toDate: '2026-07-22 15:30'
        }
  } */
  return getHistoricalData(req, res, next);
});

// Root-level ltp data endpoint for compatibility
app.post("/ltp", (req, res, next) => {
  /* #swagger.parameters['body'] = {
        in: 'body',
        description: 'LTP Request parameters',
        required: true,
        schema: {
            exchange: 'NSE',
            tradingSymbol: 'SBIN-EQ',
            symbolToken: '3045'
        }
  } */
  return getLtp(req, res, next);
});





// Register Swagger documentation UI endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Register API routes
app.use("/api/v1", router);

// Register global error middleware (must be registered after all routes)
app.use(errorHandler);

export default app;
