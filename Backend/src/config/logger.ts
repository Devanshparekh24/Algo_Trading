// ---------------------------------------------------------------------------
// Structured Logging Engine (Pino)
// High-performance, structured JSON logging with pretty printing in development.
// ---------------------------------------------------------------------------

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    service: "algo-trading-backend",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (isDev) {
  options.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

export const logger = pino(options);
export default logger;
