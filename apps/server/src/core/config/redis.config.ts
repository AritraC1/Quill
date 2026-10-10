import Redis from "ioredis";

import { env } from "./env";
import { logger } from "../logger/logger";

// Initialize the Redis client using the connection URL from environment variables
const redisConfig = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Log an error if the Redis connection encounters an issue
redisConfig.on("error", (error) => {
  logger.error(error, "Redis connection error");
});

// Log a message when the Redis connection is successfully established
redisConfig.on("connect", () => {
  logger.info("Redis connected");
});

// Export the Redis client for use throughout the application
export default redisConfig;
