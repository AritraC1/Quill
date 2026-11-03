import { Worker } from "bullmq";
import BlogRepository from "../domains/blog/blog.repository";
import UserRepository from "../domains/user/user.repository";
import NotificationRepository from "../domains/notification/notification.repository";
import redisConfig from "../core/config/redis.config";
import { logger } from "../core/logger/logger";

// Payload of a fan-out job: one published blog -> all of its author's followers
export interface NotificationFanoutJobData {
  blogId: string;
  authorId: string;
}

// Followers are processed in keyset paginated batches — publishing to a
// large audience never loads (or inserts) everything in one statement
const FOLLOWERS_PER_BATCH = 500;

// Repositories are stateless DB access (safe to share inside the worker)
const blogRepo = new BlogRepository();
const userRepo = new UserRepository();
const notificationRepo = new NotificationRepository();

// One "Alex published a new story" notification per follower. Idempotent by
// construction: the unique event_key (`publish:<blogId>:<recipientId>`)
// makes every batch insert a no-op for recipients already notified, so job
// retries and duplicate jobs never create duplicates.
// Respects each follower's `notif_app_posts` preference.
async function fanOutNewPost(job: { data: NotificationFanoutJobData }) {
  const { blogId, authorId } = job.data;

  // The blog must still exist and be published (it can be deleted between
  // enqueue and processing — inserting notifications then would violate the
  // blog foreign key with ON DELETE CASCADE having nothing to reference).
  const blog = await blogRepo.findBlogById(blogId);
  if (!blog || blog.status !== "published") {
    logger.info({ blogId }, "Fan-out skipped (blog missing or unpublished)");
    return;
  }

  let cursor: string | null = null;
  let notified = 0;

  for (;;) {
    const followerIds = await userRepo.listFollowerIdsBatch(
      authorId,
      FOLLOWERS_PER_BATCH,
      cursor,
    );
    if (followerIds.length === 0) break;

    // Fetch notification preferences for this batch of followers
    const notifSettings = await userRepo.getNotificationSettings(followerIds);

    // Filter to only those who want new post notifications
    const eligibleFollowers = followerIds.filter(
      (id) => notifSettings.get(id)?.appPosts !== false,
    );

    if (eligibleFollowers.length > 0) {
      notified += await notificationRepo.createNewPostBatch(
        eligibleFollowers,
        authorId,
        blogId,
      );
    }

    cursor = followerIds[followerIds.length - 1] ?? null;
    if (followerIds.length < FOLLOWERS_PER_BATCH) break;
  }

  logger.info(
    { blogId, authorId, notified },
    "Publish notifications fanned out",
  );
}

// Concurrency 1 keeps batch processing sequential per job (they can retry
// safely, but there is no need to run the same fan-out twice in parallel)
export const notificationFanoutWorker = new Worker<NotificationFanoutJobData>(
  "notification-fanout",
  fanOutNewPost,
  {
    connection: redisConfig,
    concurrency: 3,
  },
);
