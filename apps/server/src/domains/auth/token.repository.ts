import { pool } from "../../core/database/db";
import type { RefreshTokenModel } from "./refresh-token.model";

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

const mapRowToModel = (row: RefreshTokenRow): RefreshTokenModel => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
});

class TokenRepository {
  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenModel> {
    const result = await pool.query<RefreshTokenRow>(
      `
        INSERT INTO refresh_tokens (
          user_id,
          token_hash,
          expires_at
        )
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [userId, tokenHash, expiresAt],
    );

    return mapRowToModel(result.rows[0]!);
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenModel | null> {
    const result = await pool.query<RefreshTokenRow>(
      `
        SELECT *
        FROM refresh_tokens
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToModel(result.rows[0]!);
  }

  async revokeById(id: string): Promise<void> {
    await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
          AND revoked_at IS NULL
      `,
      [id],
    );
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [userId],
    );
  }

  async findAllByUserId(userId: string): Promise<RefreshTokenModel[]> {
    const result = await pool.query<RefreshTokenRow>(
      `
        SELECT *
        FROM refresh_tokens
        WHERE user_id = $1
      `,
      [userId],
    );

    return result.rows.map(mapRowToModel);
  }
}

export default TokenRepository;
