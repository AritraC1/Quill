import type { Request, Response, NextFunction } from "express";
import { AppError } from "./app-error";
import { logger } from "../logger/logger";

// Global Express error-handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Handle known operational errors defined by the AppError class
  // Examples include 400 Bad Request, 404 Not Found, and 409 Conflict
  if (err instanceof AppError) {
    // Log expected application errors as warnings with request details
    logger.warn({
      statusCode: err.statusCode,
      message: err.message,
      path: req.originalUrl,
      method: req.method,
    });

    // Send the appropriate HTTP status code and error message to the client
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Handle unexpected errors, including programming errors and unhandled exceptions
  // These errors are treated as internal server errors (HTTP 500)
  logger.error(
    {
      err,
      path: req.originalUrl,
      method: req.method,
    },
    "Unhandled Internal Server Error",
  );

  // Send the appropriate HTTP status code and error message to the client
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};
