import dotenv from "dotenv";
dotenv.config();

import { initSentry, captureException } from "./core/sentry/sentry";
initSentry();

import "./jobs/email.job"; // side-effect: constructs the Worker
import "./jobs/blog-publish.job"; // side-effect: constructs the Worker
import "./jobs/notification-fanout.job"; // side-effect: constructs the Worker
import { logger } from "./core/logger/logger";
import { emailWorker } from "./jobs/email.job";
import { blogPublishWorker } from "./jobs/blog-publish.job";
import { notificationFanoutWorker } from "./jobs/notification-fanout.job";
import redisConfig from "./core/config/redis.config";
import { workerJobsTotal } from "./core/metrics/metrics";

logger.info("BullMQ workers started");

// Attach telemetry and error listeners to BullMQ workers
const workers = [
  { name: "email", instance: emailWorker },
  { name: "blog-publish", instance: blogPublishWorker },
  { name: "notification-fanout", instance: notificationFanoutWorker },
];

for (const { name, instance } of workers) {
  instance.on("completed", (job) => {
    workerJobsTotal.inc({ queue: name, status: "completed" });
  });

  instance.on("failed", (job, err) => {
    workerJobsTotal.inc({ queue: name, status: "failed" });
    logger.error({ queue: name, jobId: job?.id, error: err }, "BullMQ worker job failed");
    captureException(err, {
      extra: {
        queue: name,
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
      },
    });
  });

  instance.on("error", (err) => {
    logger.error({ queue: name, error: err }, "BullMQ worker error");
    captureException(err, { extra: { queue: name } });
  });
}

// Graceful shutdown — let running jobs finish, close the workers and Redis
let closing = false;
const shutdown = async (signal: string) => {
  if (closing) return; // SIGINT + SIGTERM can both fire
  closing = true;
  logger.info(`Worker shutting down (${signal})…`);

  try {
    await Promise.all([
      emailWorker.close(),
      blogPublishWorker.close(),
      notificationFanoutWorker.close(),
      redisConfig.quit(),
    ]);
    logger.info("Worker shut down cleanly");
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during worker shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
