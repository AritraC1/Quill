import type { OtpModel } from "./otp.model";
import { pool } from "../../core/database/db";

interface CreateOtpInput {
  userId: string;
  codeHash: string;
  expiresAt: Date;
}

class OtpRepository {
  // Create new otp
  async createOtp({
    userId,
    codeHash,
    expiresAt,
  }: CreateOtpInput): Promise<OtpModel> {
    const query = `
          INSERT INTO login_otps (user_id, code_hash, expires_at)
          VALUES ($1, $2, $3)
          RETURNING *;
        `;

    const result = await pool.query<OtpModel>(query, [
      userId,
      codeHash,
      expiresAt,
    ]);

    return result.rows[0]!;
  }

  // Find active otp by user id
  async findActiveByUserId(userId: string): Promise<OtpModel | null> {
    const query = `
          SELECT *
          FROM login_otps
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `;
    const result = await pool.query<OtpModel>(query, [userId]);
    return result.rows[0] ?? null;
  }

  // Find active otp by email
  async findActiveByEmail(email: string): Promise<OtpModel | null> {
    const query = `
          SELECT o.*
          FROM login_otps o
          INNER JOIN users u ON u.id = o.user_id
          WHERE u.email = $1
            AND o.revoked_at IS NULL
            AND o.expires_at > NOW()
          ORDER BY o.created_at DESC
          LIMIT 1;
        `;
    const result = await pool.query<OtpModel>(query, [email]);
    return result.rows[0] ?? null;
  }

  // Revoke all otps for a user
  async revokeAllForUser(userId: string): Promise<OtpModel[]> {
    const query = `
          UPDATE login_otps
          SET revoked_at = NOW()
          WHERE user_id = $1
            AND revoked_at IS NULL
          RETURNING *;
        `;
    const result = await pool.query<OtpModel>(query, [userId]);
    return result.rows;
  }

  // Revoke otp by id
  async revokeById(id: string): Promise<OtpModel | null> {
    const query = `
          UPDATE login_otps
          SET revoked_at = NOW()
          WHERE id = $1
            AND revoked_at IS NULL
          RETURNING *;
        `;
    const result = await pool.query<OtpModel>(query, [id]);
    return result.rows[0] ?? null;
  }
}

export default OtpRepository;
