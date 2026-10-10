import { Queue } from "bullmq";
import redisConfig from "../core/config/redis.config";

// Creates the email queue for adding email jobs - backed by Redis
export const emailQueue = new Queue("email", { connection: redisConfig });
