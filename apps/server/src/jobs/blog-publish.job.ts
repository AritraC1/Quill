import { Worker } from "bullmq";
import BlogRepository from "../domains/blog/blog.repository";
import NotificationService from "../domains/notification/notification.service";
import redisConfig from "../core/config/redis.config";
import { logger } from "../core/logger/logger";

// Defines the structure of a scheduled-publish job's data
export interface BlogPublishJobData {
  blogId: string;
  userId: string; // kept for logging / future notification hooks
}

// Repositories are stateless DB access (safe to share inside the worker)
const blogRepo = new BlogRepository();
// Stateless service; only used for the BullMQ fan-out enqueue
const notificationService = new NotificationService();

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

      await notificationService.notifyScheduledPostPublished(
        published.user_id,
        published.id,
      );

      // The scheduled release just went live — notify the author's followers.
      // Fan-out runs on its own worker and is idempotent, so it is safe even
      // if the instant-publish path had already enqueued it.
      await notificationService.fanOutNewPost(
        published.id,
        published.user_id,
      );
    } else {
      // Job retries can land here: a previous attempt may have published the
      // blog but failed before fan-out. Re-enqueue anyway — fan-out inserts
      // are idempotent, so no follower is ever notified twice — but only when
      // we still can find a live blog belonging to the job's author.
      const blog = await blogRepo.findBlogById(job.data.blogId);
      if (blog && blog.status === "published" && blog.user_id === job.data.userId) {
        await notificationService.fanOutNewPost(blog.id, blog.user_id);
        logger.info(
          { blogId: blog.id },
          "Scheduled publish was already done — ensured follower fan-out",
        );
      } else {
        logger.info(
          { blogId: job.data.blogId },
          "Scheduled publish skipped (already published or missing)",
        );
      }
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
  },
);
