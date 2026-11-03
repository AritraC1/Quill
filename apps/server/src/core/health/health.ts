import type { Request, Response } from "express";
import { pool } from "../database/db";
import redisConfig from "../config/redis.config";

export const healthCheckHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const startedAt = Date.now();
  let dbStatus = "up";
  let dbLatencyMs = 0;
  let redisStatus = "up";
  let redisLatencyMs = 0;

  // Test PostgreSQL connection
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = "down";
  }

  // Test Redis connection
  try {
    const redisStart = Date.now();
    await redisConfig.ping();
    redisLatencyMs = Date.now() - redisStart;
  } catch {
    redisStatus = "down";
  }

  const isHealthy = dbStatus === "up" && redisStatus === "up";
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    durationMs: Date.now() - startedAt,
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
      },
    },
  });
};

