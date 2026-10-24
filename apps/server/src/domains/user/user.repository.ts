import type { OnboardRequestDTO, SignUpRequestDTO } from "@quill/shared";
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
}

export default UserRepository;
