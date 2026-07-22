import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * A wrapper to capture errors from asynchronous Express route handlers
 * and forward them to the global error middleware via next().
 */
export const asyncHandler = (requestHandler: AsyncRequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
