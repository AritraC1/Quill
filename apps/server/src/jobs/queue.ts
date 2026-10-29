import { Queue } from "bullmq";
import redisConfig from "../core/config/redis.config";

// Creates the email queue for adding email jobs - backed by Redis
export const emailQueue = new Queue("email", { connection: redisConfig });

// Publishes scheduled blogs — jobs carry a future `delay` equal to the time
// remaining until the requested publish moment, and the worker flips the
// blog live when it is dequeued
export const blogPublishQueue = new Queue("blog-publish", {
  connection: redisConfig,
});
