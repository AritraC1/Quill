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
      avatar = COALESCE($2, avatar),
      bio = COALESCE($3, bio),
      fav_genre = COALESCE($4, fav_genre),
      handle = COALESCE($5, handle),
      website = COALESCE($6, website),
      -- the once-per-6-months clock only starts when the handle really changes
      handle_changed_at = CASE
        WHEN $5 IS NOT NULL AND handle IS DISTINCT FROM $5 THEN NOW()
        ELSE handle_changed_at
      END
    WHERE id = $1
    RETURNING *;
  `;

    const result = await pool.query<UserModel>(query, [
      userId,
      data.avatar ?? null,
      data.bio ?? null,
      data.favGenre ?? null,
      data.handle ?? null,
      data.website ?? null,
    ]);

    return result.rows[0] ?? null;
  }

  // Delete a user
}

export default UserRepository;
