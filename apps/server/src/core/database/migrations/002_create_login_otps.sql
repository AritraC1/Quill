CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS login_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,   
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup of a user's OTPs (e.g. "find the active one for this user")
CREATE INDEX IF NOT EXISTS idx_login_otps_user_id ON login_otps (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_login_otps_active_per_user
  ON login_otps (user_id)
  WHERE revoked_at IS NULL;