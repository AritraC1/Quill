import type {
  EditProfileDTO,
  OnboardRequestDTO,
  SignUpRequestDTO,
  UpdateUserSettingsDTO,
} from "@quill/shared";
import { pool } from "../../core/database/db";
import type { UserModel } from "./user.model";
import type { DeleteAccountStats, UserSettingsRowModel } from "./settings.model";
import { logger } from "../../core/logger/logger";

const rollbackOrLog = async (client: import("pg").PoolClient) => {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    logger.error({ rollbackError }, "Settings transaction rollback failed");
  }
};

class UserRepository {
  // find by email
  async findByEmail(email: string): Promise<UserModel | null> {
    const query = `
      SELECT * FROM users WHERE email = $1 LIMIT 1;
    `;

    const result = await pool.query<UserModel>(query, [email]);
    return result.rows[0] || null;
  }

  // find by id
  async findById(id: string): Promise<UserModel | null> {
    const query = `
      SELECT * FROM users WHERE id = $1 LIMIT 1;
    `;

    const result = await pool.query<UserModel>(query, [id]);
    return result.rows[0] || null;
  }

  // find by handle (handle availability check)
  async findByHandle(handle: string): Promise<UserModel | null> {
    const query = `
      SELECT * FROM users WHERE handle = $1 LIMIT 1;
    `;

    const result = await pool.query<UserModel>(query, [handle]);
    return result.rows[0] || null;
  }

  // create new user
  async createNewUser(data: SignUpRequestDTO): Promise<UserModel> {
    const query = `
      INSERT INTO users (name, email)
      VALUES ($1, $2)
      RETURNING *;
    `;

    const result = await pool.query<UserModel>(query, [data.name, data.email]);
    return result.rows[0]!;
  }

  // complete onboarding
  async completeOnboarding(
    userId: string,
    data: OnboardRequestDTO,
  ): Promise<UserModel | null> {
    const query = `
    UPDATE users
    SET fav_genre = $2,
        avatar = COALESCE($3, avatar),
        bio = COALESCE($4, bio),
        onboarding_completed = TRUE
    WHERE id = $1
    AND onboarding_completed = FALSE
    RETURNING *;
  `;

    const result = await pool.query<UserModel>(query, [
      userId,
      data.favGenre,
      data.avatar ?? null,
      data.bio ?? null,
    ]);

    return result.rows[0] ?? null;
  }

  // generate account handle
  async generateAccountHandle(
    userId: string,
    handle: string,
  ): Promise<UserModel | null> {
    const query = `
      UPDATE users
      SET handle = COALESCE(handle, $2)
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query<UserModel>(query, [userId, handle]);
    return result.rows[0] ?? null;
  }

  // Edit User Profile
  async editUserProfile(
    userId: string,
    data: EditProfileDTO,
  ): Promise<UserModel | null> {
    const query = `
    UPDATE users
    SET
      name = COALESCE($2, name),
      avatar = COALESCE($3, avatar),
      bio = COALESCE($4, bio),
      fav_genre = COALESCE($5, fav_genre),
      handle = COALESCE($6, handle),
      website = COALESCE($7, website),
      -- the once-per-6-months clock only starts when the handle really changes
      handle_changed_at = CASE
        WHEN $6 IS NOT NULL AND handle IS DISTINCT FROM $6 THEN NOW()
        ELSE handle_changed_at
      END
    WHERE id = $1
    RETURNING *;
  `;

    const result = await pool.query<UserModel>(query, [
      userId,
      data.name ?? null,
      data.avatar ?? null,
      data.bio ?? null,
      data.favGenre ?? null,
      data.handle ?? null,
      data.website ?? null,
    ]);

    return result.rows[0] ?? null;
  }

  // Saved settings for the settings page — LEFT JOIN so a user who never
  // saved anything still gets the defaults (COALESCE) straight from the DB
  async getSettings(userId: string): Promise<UserSettingsRowModel | null> {
    const query = `
      SELECT
        u.fav_genre,
        COALESCE(us.default_tab, 'for-you')                                 AS default_tab,
        COALESCE(us.text_size, 18)                                          AS text_size,
        COALESCE(us.theme, 'light')                                         AS theme,
        COALESCE(us.notif_app_posts, TRUE)                                  AS notif_app_posts,
        COALESCE(us.notif_app_followers, TRUE)                              AS notif_app_followers,
        COALESCE(us.notif_app_scheduled, TRUE)                              AS notif_app_scheduled,
        COALESCE(us.notif_app_replies, FALSE)                               AS notif_app_replies,
        COALESCE(us.notif_email_digest, TRUE)                               AS notif_email_digest,
        COALESCE(us.notif_email_followers, FALSE)                           AS notif_email_followers,
        COALESCE(us.notif_email_news, FALSE)                                AS notif_email_news
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE u.id = $1
      LIMIT 1;
    `;

    const result = await pool.query<UserSettingsRowModel>(query, [userId]);
    return result.rows[0] ?? null;
  }

  // Persist the full settings snapshot in ONE transaction: genres go to
  // users.fav_genre (they are also the profile's topic pills), everything
  // else upserts into user_settings. Either write succeeds or neither does,
  // so the saved state can never disagree between the two tables.
  async saveSettings(
    userId: string,
    data: UpdateUserSettingsDTO,
  ): Promise<UserSettingsRowModel | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Genre snapshot lives with the profile row; if the user vanished the
      // UPDATE matches nothing and the transaction still writes settings —
      // the service turns a missing row into a clear 404 below
      const genreResult = await client.query<{ fav_genre: string[] }>(
        `UPDATE users SET fav_genre = $2 WHERE id = $1 RETURNING fav_genre;`,
        [userId, data.genres],
      );

      const upsertResult = await client.query<UserSettingsRowModel>(
        `
        INSERT INTO user_settings (
          user_id, default_tab, text_size, theme,
          notif_app_posts, notif_app_followers, notif_app_scheduled, notif_app_replies,
          notif_email_digest, notif_email_followers, notif_email_news
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11
        )
        ON CONFLICT (user_id) DO UPDATE SET
          default_tab           = EXCLUDED.default_tab,
          text_size             = EXCLUDED.text_size,
          theme                 = EXCLUDED.theme,
          notif_app_posts       = EXCLUDED.notif_app_posts,
          notif_app_followers   = EXCLUDED.notif_app_followers,
          notif_app_scheduled   = EXCLUDED.notif_app_scheduled,
          notif_app_replies     = EXCLUDED.notif_app_replies,
          notif_email_digest    = EXCLUDED.notif_email_digest,
          notif_email_followers = EXCLUDED.notif_email_followers,
          notif_email_news      = EXCLUDED.notif_email_news,
          updated_at            = NOW()
        RETURNING
          default_tab, text_size, theme,
          notif_app_posts, notif_app_followers, notif_app_scheduled, notif_app_replies,
          notif_email_digest, notif_email_followers, notif_email_news;
      `,
        [
          userId,
          data.defaultTab,
          data.textSize,
          data.theme,
          data.notifications.appPosts,
          data.notifications.appFollowers,
          data.notifications.appScheduled,
          data.notifications.appReplies,
          data.notifications.emailDigest,
          data.notifications.emailFollowers,
          data.notifications.emailNews,
        ],
      );

      await client.query("COMMIT");

      // fav_genre comes from the users UPDATE earlier in the transaction;
      // a missing row there (or a missing settings row) means the user
      // vanished and the service reports a 404 instead of a half snapshot
      const genre = genreResult.rows[0]?.fav_genre;
      const row = upsertResult.rows[0] ?? null;

      if (!row || !genre) return null;
      return {
        ...row,
        fav_genre: genre,
      };
    } catch (error) {
      await rollbackOrLog(client);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete the account for good. Every dependent row (blogs, drafts, bookmarks,
  // follows, notifications, refresh tokens, OTPs) cascades ON DELETE CASCADE —
  // the deletion is a single DELETE inside a transaction, and the counts are
  // captured first so the client can confirm exactly what was removed.
  async deleteAccount(userId: string): Promise<DeleteAccountStats | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const stats = await client.query<{
        published: number;
        drafts_count: number;
      }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'published')::INT AS published,
          COUNT(*) FILTER (WHERE status = 'draft')::INT     AS drafts_count
        FROM blogs WHERE user_id = $1;
      `,
        [userId],
      );

      const bookmarks = await client.query<{ count: number }>(
        `SELECT COUNT(*)::INT AS count FROM blog_bookmarks WHERE user_id = $1;`,
        [userId],
      );

      const deleted = await client.query<{ id: string }>(
        `DELETE FROM users WHERE id = $1 RETURNING id;`,
        [userId],
      );

      if (deleted.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query("COMMIT");

      return {
        publishedPosts: stats.rows[0]?.published ?? 0,
        drafts: stats.rows[0]?.drafts_count ?? 0,
        bookmarks: bookmarks.rows[0]?.count ?? 0,
      };
    } catch (error) {
      await rollbackOrLog(client);
      throw error;
    } finally {
      client.release();
    }
  }

  // ---------------- Social graph (migrations/010) ----------------

  // Follow a user (idempotent). Returns true only when the row was newly
  // inserted — a repeat follow (already a follower) inserts nothing, which
  // also means no "started following you" notification is created again.
  async followUser(followerId: string, followingId: string): Promise<boolean> {
    const query = `
      INSERT INTO user_follows (follower_id, following_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_id, following_id) DO NOTHING;
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Unfollow a user (no error when the follow row does not exist)
  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    const query = `
      DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2;
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Number of people who follow the given user
  async countFollowers(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::INT AS count FROM user_follows WHERE following_id = $1;
    `;
    const result = await pool.query<{ count: number }>(query, [userId]);
    return result.rows[0]?.count ?? 0;
  }

  // One batch of a writer's follower ids, ordered by follower_id (keyset
  // pagination). The notification fan-out worker walks this list in batches
  // so publishing to a large audience never loads every follower at once.
  async listFollowerIdsBatch(
    followingId: string,
    limit: number,
    afterId: string | null,
  ): Promise<string[]> {
    const query = `
      SELECT follower_id FROM user_follows
      WHERE following_id = $1
        AND follower_id > COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY follower_id ASC
      LIMIT $3;
    `;
    const result = await pool.query<{ following_id?: string; follower_id: string }>(
      query,
      [followingId, afterId, limit],
    );
    return result.rows.map((row) => row.follower_id);
  }

  // Handles the user follows — feeds the profile sidebar / follow state
  async listFollowingIds(userId: string): Promise<string[]> {
    const query = `
      SELECT following_id FROM user_follows WHERE follower_id = $1;
    `;
    const result = await pool.query<{ following_id: string }>(query, [userId]);
    return result.rows.map((row) => row.following_id);
  }

  // The users this user follows (profile "Following" sidebar)
  async listFollowingUsers(
    userId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
    }>
  > {
    const query = `
      SELECT u.id, u.name, u.handle, u.avatar
      FROM user_follows f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC;
    `;
    const result = await pool.query<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
    }>(query, [userId]);
    return result.rows;
  }

  // One page of the people following `userId`, newest follow first, plus a
  // per-row "does the viewer already follow them back?" flag
  async listFollowers(
    userId: string,
    viewerId: string,
    page: number,
    limit: number,
  ): Promise<import("@quill/shared").FollowerListDTO> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT u.id, u.name, u.handle, u.avatar,
             EXISTS (
               SELECT 1 FROM user_follows fb
               WHERE fb.follower_id = $2 AND fb.following_id = u.id
             ) AS is_following,
             COUNT(*) OVER() AS total_count
      FROM user_follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4;
    `;
    const result = await pool.query<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
      is_following: boolean;
      total_count: string;
    }>(query, [userId, viewerId, limit, offset]);
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        handle: row.handle,
        avatar: row.avatar,
        isFollowing: row.is_following,
      })),
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Is `followerId` currently following `followingId`?
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM user_follows
      WHERE follower_id = $1 AND following_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Users to follow — everyone except current user and already followed
  async listSuggestedUsers(
    userId: string,
    limit = 5,
  ): Promise<
    Array<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
      bio: string | null;
      followers: number;
    }>
  > {
    const query = `
      SELECT u.id, u.name, u.handle, u.avatar, u.bio,
             (SELECT COUNT(*)::INT FROM user_follows WHERE following_id = u.id) AS followers
      FROM users u
      WHERE u.id <> $1
        AND u.onboarding_completed = TRUE
        AND u.handle IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_follows
          WHERE follower_id = $1 AND following_id = u.id
        )
      ORDER BY followers DESC, u.created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
      bio: string | null;
      followers: number;
    }>(query, [userId, limit]);
    return result.rows;
  }

  // Delete a user
}

export default UserRepository;
