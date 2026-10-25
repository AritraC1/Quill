CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create blog table
CREATE TABLE IF NOT EXISTS blogs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  blog_description      TEXT NOT NULL,
  images                TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fetch blogs belonging to a user
CREATE INDEX IF NOT EXISTS idx_blogs_user_id
ON blogs(user_id);

-- Sort a user's blogs by creation date (newest first)
CREATE INDEX IF NOT EXISTS idx_blogs_user_created_at
ON blogs(user_id, created_at DESC);