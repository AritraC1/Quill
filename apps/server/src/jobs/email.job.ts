import { Worker } from "bullmq";
import { otpEmailTemplate } from "../core/email/templates/otp.template";
import EmailService from "../core/email/email.service";
import redisConfig from "../core/config/redis.config";
import { emailQueue } from "./queue";
import NotificationRepository from "../domains/notification/notification.repository";
import UserRepository from "../domains/user/user.repository";
import { logger } from "../core/logger/logger";

// Defines the structure of an OTP email job's data
interface OtpEmailJobData {
  type: "otp";
  to: string;
  code: string;
}

interface NewFollowerEmailJobData {
  type: "new-follower";
  recipientId: string;
  followerName: string;
}

interface WeeklyDigestRunJobData {
  type: "weekly-digest-run";
}

interface WeeklyDigestEmailJobData {
  type: "weekly-digest-email";
  recipientId: string;
  posts: Array<{ id: string; title: string; authorName: string }>;
}

// Defines the supported email job data types
type EmailJobData =
  | OtpEmailJobData
  | NewFollowerEmailJobData
  | WeeklyDigestRunJobData
  | WeeklyDigestEmailJobData;

// Creates an instance of the email service to handle email delivery
const emailService = new EmailService();
const notificationRepo = new NotificationRepository();
const userRepo = new UserRepository();

// Weekly, UTC schedule is shared by every worker process through BullMQ's
// repeatable-job identity; repeated worker starts do not create extra digests.
void emailQueue
  .upsertJobScheduler(
    "weekly-digest",
    { pattern: "0 9 * * 1" },
    {
      name: "weekly-digest-run",
      data: { type: "weekly-digest-run" },
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      },
    },
  )
  .catch((error: unknown) => {
    logger.error({ error }, "Could not schedule weekly email digests");
  });

// Creates a BullMQ worker to process email jobs from the "email" queue.
export const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    switch (job.data.type) {
      case "otp":
        otpEmailTemplate(job.data.code);
        await emailService.sendOtpEmail(job.data.to, job.data.code);
        return;
      case "new-follower": {
        const [settings, recipient] = await Promise.all([
          userRepo.getNotificationSettings([job.data.recipientId]),
          userRepo.findById(job.data.recipientId),
        ]);
        if (
          settings.get(job.data.recipientId)?.emailFollowers !== true ||
          !recipient?.email
        ) {
          return;
        }
        await emailService.sendNewFollowerEmail(
          recipient.email,
          job.data.followerName,
        );
        return;
      }
      case "weekly-digest-run": {
        const recipients = await notificationRepo.listWeeklyDigestRecipients();
        const dateKey = new Date(job.timestamp).toISOString().slice(0, 10);
        for (const recipient of recipients) {
          await emailQueue.add(
            "weekly-digest-email",
            {
              type: "weekly-digest-email",
              recipientId: recipient.recipient_id,
              posts: recipient.posts,
            },
            {
              jobId: `weekly-digest-${dateKey}-${recipient.recipient_id}`,
              attempts: 3,
              backoff: { type: "exponential", delay: 30_000 },
              removeOnComplete: { age: 60 * 60 * 24 * 60 },
              removeOnFail: { age: 60 * 60 * 24 * 60 },
            },
          );
        }
        logger.info(
          { queued: recipients.length, dateKey },
          "Queued weekly reading digests",
        );
        return;
      }
      case "weekly-digest-email": {
        const [settings, recipient] = await Promise.all([
          userRepo.getNotificationSettings([job.data.recipientId]),
          userRepo.findById(job.data.recipientId),
        ]);
        if (
          settings.get(job.data.recipientId)?.emailDigest !== true ||
          !recipient?.email ||
          job.data.posts.length === 0
        ) {
          return;
        }
        await emailService.sendWeeklyDigestEmail(
          recipient.email,
          recipient.name,
          job.data.posts,
        );
      }
    }
  },
  {
    connection: redisConfig, // Uses Redis to connect to the BullMQ queue
    concurrency: 10, // Processes up to 10 jobs concurrently
  },
);
