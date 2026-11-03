import {
  collectDefaultMetrics,
  Registry,
  Counter,
  Histogram,
  Gauge,
} from "prom-client";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../database/db";

// Dedicated registry to isolate Quill metrics
export const register = new Registry();

// Collect Node.js process & event-loop metrics
collectDefaultMetrics({
  register,
  prefix: "quill_",
});

// --- HTTP Metrics ---

export const httpRequestsTotal = new Counter({
  name: "quill_http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "quill_http_request_duration_seconds",
  help: "Histogram of HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpActiveRequests = new Gauge({
  name: "quill_http_active_requests",
  help: "Number of active in-flight HTTP requests",
  labelNames: ["method"],
  registers: [register],
});

// --- Database Connection Pool Metrics ---

new Gauge({
  name: "quill_db_pool_total_connections",
  help: "Total number of database clients in the pool",
  registers: [register],
  collect() {
    this.set(pool.totalCount);
  },
});

new Gauge({
  name: "quill_db_pool_idle_connections",
  help: "Number of idle database clients in the pool",
  registers: [register],
  collect() {
    this.set(pool.idleCount);
  },
});

new Gauge({
  name: "quill_db_pool_waiting_requests",
  help: "Number of queued requests waiting for a database client",
  registers: [register],
  collect() {
    this.set(pool.waitingCount);
  },
});

// --- Worker & Job Metrics ---

export const workerJobsTotal = new Counter({
  name: "quill_worker_jobs_total",
  help: "Total number of BullMQ worker jobs processed",
  labelNames: ["queue", "status"],
  registers: [register],
});

export const workerJobDurationSeconds = new Histogram({
  name: "quill_worker_job_duration_seconds",
  help: "Histogram of BullMQ worker job execution time in seconds",
  labelNames: ["queue"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 15, 30, 60],
  registers: [register],
});

// --- Route Normalization Helper ---
// Prevents high cardinality metrics from dynamic IDs, handles, slugs, and UUIDs
function normalizeRoute(req: Request): string {
  // If Express matched a route pattern like /blogs/:id
  if (req.route?.path) {
    const base = req.baseUrl || "";
    const route = typeof req.route.path === "string" ? req.route.path : "";
    return `${base}${route}` || "/";
  }

  const rawPath = req.baseUrl || req.path || "/";

  // Sanitize UUIDs, numerical IDs, hex strings, and common hash tokens
  return rawPath
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/u\/[a-zA-Z0-9_.-]+/g, "/u/:handle");
}

// --- Express Metrics Middleware ---

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Do not record the scraping endpoint itself to prevent polluting telemetry
  if (req.path === "/metrics" || req.path === "/api/metrics") {
    next();
    return;
  }

  const start = process.hrtime();
  const method = req.method;

  httpActiveRequests.inc({ method });

  res.on("finish", () => {
    httpActiveRequests.dec({ method });

    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const statusCode = String(res.statusCode);
    const route = normalizeRoute(req);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode },
      durationSeconds,
    );
  });

  next();
};

// --- Prometheus Metrics Endpoint Handler ---

export const metricsHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.setHeader("Content-Type", register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
};

