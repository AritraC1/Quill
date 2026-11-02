-- One row per authenticated reading session. Progress snapshots are monotonic,
-- so retrying a request cannot double-count time or reduce observed depth.
CREATE TABLE IF NOT EXISTS reading_sessions (
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blog_id             UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL,
  active_seconds      INTEGER NOT NULL DEFAULT 0
                      CHECK (active_seconds BETWEEN 0 AND 86400),
  max_scroll_percent  INTEGER NOT NULL DEFAULT 0
                      CHECK (max_scroll_percent BETWEEN 0 AND 100),
  completed           BOOLEAN NOT NULL DEFAULT FALSE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, blog_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_blog
ON reading_sessions(user_id, blog_id);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_blog_updated
ON reading_sessions(blog_id, updated_at DESC);
