import "./jobs/email.job"; // side-effect: constructs the Worker
import "./jobs/blog-publish.job"; // side-effect: constructs the Worker
import { logger } from "./core/logger/logger";
import { emailWorker } from "./jobs/email.job";
import { blogPublishWorker } from "./jobs/blog-publish.job";
import redisConfig from "./core/config/redis.config";

logger.info("BullMQ workers started");

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
