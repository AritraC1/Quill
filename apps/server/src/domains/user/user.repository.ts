import type { SignUpRequestDTO } from "@quill/shared";
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
}

export default UserRepository;
