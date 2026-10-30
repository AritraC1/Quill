import type {
  EditProfileDTO,
  OnboardRequestDTO,
  SignUpRequestDTO,
} from "@quill/shared";
import { pool } from "../../core/database/db";
import type { UserModel } from "./user.model";

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

  // Delete a user
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
