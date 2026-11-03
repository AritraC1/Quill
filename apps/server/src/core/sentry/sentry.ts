import * as Sentry from "@sentry/node";
import { env } from "../config/env";
import { logger } from "../logger/logger";

let sentryInitialized = false;

export const initSentry = (): void => {
  if (sentryInitialized) return;

  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    logger.info("Sentry DSN is not configured; error tracking disabled (local mode)");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: env.NODE_ENV,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
      // Release versioning
      release: process.env.npm_package_version || "quill-server@1.0.0",
    });
    sentryInitialized = true;
    logger.info({ environment: env.NODE_ENV }, "Sentry initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Sentry");
  }
};

export const captureException = (
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1],
): void => {
  if (!sentryInitialized) return;
  Sentry.captureException(error, context);
};

export { Sentry, sentryInitialized };

