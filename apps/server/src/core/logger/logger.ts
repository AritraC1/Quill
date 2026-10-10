import pino from "pino";

// Determine whether the application is running outside production
const isDev = process.env.NODE_ENV !== "production";

class Logger {
  // Store a single logger instance to be shared across the application
  private static instance: pino.Logger;

  static getInstance(): pino.Logger {
    if (!Logger.instance) {
      Logger.instance = pino({
        level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
        transport: isDev
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
              },
            }
          : undefined, // raw JSON in production — parseable by log aggregators
        base: {
          service: "quill-server",
        },
      });
    }
    return Logger.instance;
  }
}

export const logger = Logger.getInstance();
