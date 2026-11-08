// ---------------------------------------------------------------------------
// Request Validation Middleware (Zod)
// Validates incoming HTTP request body against Zod schemas, returning clean
// structured 400 errors with actionable messages if validation fails.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import logger from "../config/logger.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));

        logger.warn({ path: req.path, method: req.method, issues }, "Request validation failed");

        res.status(400).json({
          status: false,
          message: "Request validation failed. Please check your payload parameters.",
          errors: issues,
        });
        return;
      }

      logger.error({ err }, "Unexpected error during request validation");
      res.status(500).json({
        status: false,
        message: "Internal server error during request validation",
      });
    }
  };
}
