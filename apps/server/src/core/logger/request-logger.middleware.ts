import pinoHttp from "pino-http";
import { logger } from "./logger";
import { randomUUID } from "crypto";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers["x-request-id"] || randomUUID(),
  customLogLevel: (_, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, _) => `${req.method} ${req.url} completed`,
  customErrorMessage: (req, _, err) =>
    `${req.method} ${req.url} failed: ${err.message}`,
});
