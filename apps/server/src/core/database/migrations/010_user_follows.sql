-- Social graph: one row per follow, symmetric-free (cannot follow yourself)

CREATE TABLE IF NOT EXISTS user_follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- Stop "self follow" at the DB level as well as in the service
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_no_self'
  ) THEN
    ALTER TABLE user_follows
      ADD CONSTRAINT user_follows_no_self
      CHECK (follower_id <> following_id);
  END IF;
END $$;

-- "Who follows X" (follower count on profiles)
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id
ON user_follows(following_id);

-- "Who X follows" (following list)
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id
ON user_follows(follower_id);
