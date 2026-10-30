import type { NotificationRowModel } from "./notification.model";
import { pool } from "../../core/database/db";

class NotificationRepository {
  // Insert one notification, idempotently. Returns true only when a new row
  // was created — a repeated event_key (worker retries, repeat follows) is a
  // silent no-op thanks to the unique index from migration 011.
  async create(event: {
    recipientId: string;
    actorId: string;
    blogId?: string | null;
    type: "new_follower" | "new_post";
    eventKey: string;
  }): Promise<boolean> {
    const query = `
      INSERT INTO notifications (recipient_id, actor_id, blog_id, type, event_key)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_key) DO NOTHING;
    `;
    const result = await pool.query(query, [
      event.recipientId,
      event.actorId,
      event.blogId ?? null,
      event.type,
      event.eventKey,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  // Idempotent bulk insert for the publish fan-out: one "new_post" per
  // follower of the author. The event_key is computed in SQL so a retried
  // batch (same blog + same follower) conflicts and is skipped, never doubled.
  async createNewPostBatch(
    followerIds: string[],
    authorId: string,
    blogId: string,
  ): Promise<number> {
    const query = `
      INSERT INTO notifications (recipient_id, actor_id, blog_id, type, event_key)
      SELECT f, $2, $3, 'new_post', 'publish:' || $3 || ':' || f
      FROM unnest($1::uuid[]) AS f
      ON CONFLICT (event_key) DO NOTHING;
    `;
    const result = await pool.query(query, [followerIds, authorId, blogId]);
    return result.rowCount ?? 0;
  }

  // One page of a user's notifications, newest first (bell dropdown).
  // Actor and blog are joined for rendering; deleted actors/blogs cascade
  // the notification row away, so missing names are not expected.
  async listForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: NotificationRowModel[]; total: number }> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT n.*, u.name AS actor_name, u.handle AS actor_handle,
             u.avatar AS actor_avatar, b.title AS blog_title,
             COUNT(*) OVER() AS total_count
      FROM notifications n
      JOIN users u ON u.id = n.actor_id
      LEFT JOIN blogs b ON b.id = n.blog_id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<NotificationRowModel & { total_count: string }>(
      query,
      [userId, limit, offset],
    );
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // The number on the bell badge
  async countUnread(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::INT AS count
      FROM notifications
      WHERE recipient_id = $1 AND read_at IS NULL;
    `;
    const result = await pool.query<{ count: number }>(query, [userId]);
    return result.rows[0]?.count ?? 0;
  }

  // Mark one notification read. Returns false when the id is not the
  // signed-in user's notification (or it is already read) — nothing to do.
  async markRead(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications
      SET read_at = NOW()
      WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL;
    `;
    const result = await pool.query(query, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Mark every unread notification of a user read
  async markAllRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications
      SET read_at = NOW()
      WHERE recipient_id = $1 AND read_at IS NULL;
    `;
    const result = await pool.query(query, [userId]);
    return result.rowCount ?? 0;
  }

  // "Clear" — wipe the whole list for the signed-in user
  async deleteAllForUser(userId: string): Promise<number> {
    const query = `DELETE FROM notifications WHERE recipient_id = $1;`;
    const result = await pool.query(query, [userId]);
    return result.rowCount ?? 0;
  }
}

export default NotificationRepository;
