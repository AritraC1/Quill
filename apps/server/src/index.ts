import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import type { Server } from "node:http";

import routes from "./routes/routes";
import { swaggerSpec } from "./core/config/swagger.config";
import { requestLogger } from "./core/logger/request-logger.middleware";
import { errorHandler } from "./core/errors";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";
import { apiLimiter } from "./core/rate-limit";
import { UPLOAD_DIR } from "./domains/user/avatar-upload";
import { pool } from "./core/database/db";

// Declarations
const app = express();

// Middlewares
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(requestLogger);
// JSON body cap — avatars used to be base64 blobs (which silently 413'd at
// the default 100 KB); now avatars upload as files and this is a safety net
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Uploaded media (avatars etc.), served next to the API
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, { maxAge: "365d", immutable: true }),
);

// Routes
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", apiLimiter, routes);
app.use(errorHandler);

// Server start + graceful shutdown so docker-compose restarts and redeploys
// finish in-flight requests instead of dropping them
const server: Server = app.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = async () => {
  logger.info("Shutting down server…");
  server.close(async () => {
    try {
      await pool.end();
      logger.info("Server shut down cleanly");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Error while closing the DB pool");
      process.exit(1);
    }
  });
  // Force-exit if connections hang around
  setTimeout(() => {
    logger.warn("Force exiting after shutdown timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
