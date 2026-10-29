import { Worker } from "bullmq";
import BlogRepository from "../domains/blog/blog.repository";
import redisConfig from "../core/config/redis.config";
import { logger } from "../core/logger/logger";

// Defines the structure of a scheduled-publish job's data
export interface BlogPublishJobData {
  blogId: string;
  userId: string; // kept for logging / future notification hooks
}

// Repositories are stateless DB access (safe to share inside the worker)
const blogRepo = new BlogRepository();

// Creates a BullMQ worker that publishes blogs whose scheduled time has come.
// The repository update is idempotent, so jobs firing after a manual publish or a cancellation are harmless no-ops.
export const blogPublishWorker = new Worker<BlogPublishJobData>(
  "blog-publish",
  async (job) => {
    const published = await blogRepo.publishBlog(job.data.blogId);

    if (published) {
      logger.info(
        { blogId: published.id },
        "Scheduled blog published",
      );
    } else {
      logger.info(
        { blogId: job.data.blogId },
        "Scheduled publish skipped (already published or missing)",
      );
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
  },
);
