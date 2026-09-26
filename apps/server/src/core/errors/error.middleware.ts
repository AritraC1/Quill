import type { Request, Response, NextFunction } from "express";
import { AppError } from "./app-error";
import { logger } from "../logger/logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If it's a known operational AppError (e.g. 400, 404, 409)
  if (err instanceof AppError) {
    logger.warn({
      statusCode: err.statusCode,
      message: err.message,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Handle unexpected or programming errors (500)
  logger.error(
    {
      err,
      path: req.originalUrl,
      method: req.method,
    },
    "Unhandled Internal Server Error"
  );

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};
