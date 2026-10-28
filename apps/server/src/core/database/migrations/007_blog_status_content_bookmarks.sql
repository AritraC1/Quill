-- Blog writing workflow: markdown content, draft/published state, bookmarks

-- The client previously assumed every blog is live, so existing rows become
-- published; new blogs start as drafts and are only published explicitly.
ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS content    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE blogs
SET status = 'published',
    published_at = COALESCE(published_at, created_at)
WHERE status <> 'published';

-- Idempotent so the file can be hand-applied to a pre-existing dev volume
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blogs_status_check'
  ) THEN
    ALTER TABLE blogs
      ADD CONSTRAINT blogs_status_check
      CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

-- Full feed: newest published stories first
CREATE INDEX IF NOT EXISTS idx_blogs_status_published_at
ON blogs(status, published_at DESC);

-- Bookmarks ("reading list") — one entry per user per blog
CREATE TABLE IF NOT EXISTS blog_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blog_id    UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, blog_id)
);

-- Saved list: newest saves first
CREATE INDEX IF NOT EXISTS idx_blog_bookmarks_user_created_at
ON blog_bookmarks(user_id, created_at DESC);
