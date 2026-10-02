import Redis from "ioredis";

import { env } from "./env";
import { logger } from "../logger/logger";

const redisConfig = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

redisConfig.on("error", (error) => {
    logger.error(error, "Redis connection error");
});

redisConfig.on("connect", () => {
    logger.info("Redis connected");
});

export default redisConfig;