ALTER TABLE users
  ADD COLUMN IF NOT EXISTS handle TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
  ON users (handle)
  WHERE handle IS NOT NULL;
