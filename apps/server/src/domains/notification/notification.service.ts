import type {
  NotificationDTO,
  NotificationListDTO,
  UnreadCountDTO,
} from "@quill/shared";
import NotificationRepository from "./notification.repository";
import type { NotificationRowModel } from "./notification.model";
import { notificationFanoutQueue } from "../../jobs/queue";
import { NotFoundError } from "../../core/errors";
import { logger } from "../../core/logger/logger";

// Pagination guard rails (same limits the blog list uses)
const MAX_LIMIT = 50;

/** Deterministic event keys — the unique index on event_key makes
 * (re)creating an event a no-op, so retries never duplicate notifications */
export const eventKeys = {
  follow: (followerId: string, targetId: string) =>
    `follow:${followerId}:${targetId}`,
  publish: (blogId: string, recipientId: string) =>
    `publish:${blogId}:${recipientId}`,
  // The outstanding invitation to this club for that invitee — a new
  // invitation attempt while one is pending dedupes to a no-op
  clubInvite: (clubId: string, inviteeId: string) =>
    `club-invite:${clubId}:${inviteeId}`,
  // One per club_reviews row: every review cycle notifies afresh, retries no-op
  clubReview: (reviewId: string) => `club-review:${reviewId}`,
};

class NotificationService {
  private notificationRepo: NotificationRepository;

  constructor() {
    this.notificationRepo = new NotificationRepository();
  }

  // Row -> serialized DTO (dates become ISO strings, joins become objects)
  private toNotificationListDTO(row: NotificationRowModel): NotificationDTO {
    return {
      id: row.id,
      type: row.type as NotificationDTO["type"],
      actor: {
        id: row.actor_id,
        name: row.actor_name ?? "Someone",
        handle: row.actor_handle ?? null,
        avatar: row.actor_avatar ?? null,
      },
      blog:
        row.blog_id && row.blog_title
          ? { id: row.blog_id, title: row.blog_title }
          : null,
      club:
        row.club_id && row.club_name
          ? { id: row.club_id, name: row.club_name }
          : null,
      createdAt: new Date(row.created_at).toISOString(),
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    };
  }

  // One page of the signed-in user's notifications (bell dropdown)
  async list(userId: string, page = 1, limit = 20): Promise<NotificationListDTO> {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const result = await this.notificationRepo.listForUser(
      userId,
      safePage,
      safeLimit,
    );
    return {
      items: result.items.map((row) => this.toNotificationListDTO(row)),
      total: result.total,
    };
  }

  // The number of unread notifications on the bell badge
  async unreadCount(userId: string): Promise<UnreadCountDTO> {
    return { count: await this.notificationRepo.countUnread(userId) };
  }

  // "Mark as read" on a single item
  async markRead(userId: string, notificationId: string): Promise<void> {
    const updated = await this.notificationRepo.markRead(
      notificationId,
      userId,
    );
    if (!updated) {
      throw new NotFoundError("Unread notification not found");
    }
  }

  // Mark everything read at once
  async markAllRead(userId: string): Promise<{ count: number }> {
    return { count: await this.notificationRepo.markAllRead(userId) };
  }

  // "Clear" — wipe the whole list
  async clearAll(userId: string): Promise<{ count: number }> {
    return { count: await this.notificationRepo.deleteAllForUser(userId) };
  }

  // Fired ONLY after the follow row is actually inserted (a repeat follow
  // must not ping the writer again). Best-effort: a failed insert must not
  // turn the already-successful follow into an error response.
  async notifyNewFollower(followerId: string, targetId: string): Promise<void> {
    try {
      await this.notificationRepo.create({
        recipientId: targetId,
        actorId: followerId,
        type: "new_follower",
        eventKey: eventKeys.follow(followerId, targetId),
      });
    } catch (error) {
      logger.warn({ error, followerId, targetId }, "Follow notification failed");
    }
  }

  // Fired ONLY after a club invitation was actually created. Best-effort.
  async notifyClubInvitation(
    inviteeId: string,
    inviterId: string,
    clubId: string,
  ): Promise<void> {
    try {
      await this.notificationRepo.create({
        recipientId: inviteeId,
        actorId: inviterId,
        clubId,
        type: "club_invite",
        eventKey: eventKeys.clubInvite(clubId, inviteeId),
      });
    } catch (error) {
      logger.warn({ error, inviteeId, clubId }, "Club invite notification failed");
    }
  }

  // Fired ONLY after a review row was written. The event key is the review's
  // row id, so every review cycle (approve / request changes / reject)
  // notifies the author once — worker retries no-op on the unique index.
  async notifyClubReview(
    authorId: string,
    reviewerId: string | null,
    reviewId: string,
    blogId: string,
    clubId: string,
  ): Promise<void> {
    try {
      await this.notificationRepo.create({
        recipientId: authorId,
        actorId: reviewerId ?? authorId,
        blogId,
        clubId,
        type: "club_review",
        eventKey: eventKeys.clubReview(reviewId),
      });
    } catch (error) {
      logger.warn({ error, reviewId, blogId }, "Club review notification failed");
    }
  }

  // Enqueue the post-publish fan-out on the BullMQ worker. The publish
  // request itself never inserts notifications directly — write fan-out
  // happens in batches in the worker, safe to retry. Never throws: the blog
  // is already published; notifications failing cannot undo that.
  async fanOutNewPost(blogId: string, authorId: string): Promise<void> {
    try {
      // Deterministic job id per blog: re-enqueues (manual publish after a
      // crashed scheduled job) are deduplicated while the job still exists
      await notificationFanoutQueue.add(
        "fanout",
        { blogId, authorId },
        {
          jobId: `fanout-${blogId}`,
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      );
    } catch (error) {
      logger.warn({ error, blogId }, "Could not enqueue publish fan-out");
    }
  }
}

export default NotificationService;
