import type { Request, Response, NextFunction } from "express";
import { AppError } from "./app-error";
import { logger } from "../logger/logger";
import { captureException } from "../sentry/sentry";

// Global Express error-handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Body-parser failures (e.g. JSON over the configured size limit) arrive as
  // generic errors with a `type` — surface them as friendly 413/400s
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ success: false, message: "Malformed JSON body" });
    return;
  }

  if (
    err instanceof Error &&
    "statusCode" in err &&
    !Number.isNaN(err.statusCode)
  ) {
    const status = (err as Error & { statusCode: number }).statusCode;
    if (status === 413) {
      res
        .status(413)
        .json({ success: false, message: "Request too large (max 2 MB JSON)" });
      return;
    }
  }

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

  // Capture unhandled 500 errors to Sentry
  captureException(err, {
    extra: {
      path: req.originalUrl,
      method: req.method,
      query: req.query,
      ip: req.ip,
    },
  });

  // Send the appropriate HTTP status code and error message to the client
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};
