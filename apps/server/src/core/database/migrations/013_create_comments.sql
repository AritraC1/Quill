-- Comments + reactions (the CommentSection under a published story)
--
-- comments is a tree: parent_comment_id is NULL for a top-level comment and
-- points at its parent comment for a reply. Threads are kept to two visible
-- levels — a reply to a reply is attached under that reply's top-level
-- ancestor at the service layer — so no recursive traversal is needed.
--
-- Deletions are soft (deleted_at): a removed parent keeps its replies, and
-- the client renders "Comment deleted" in its place. Hard deletion only
-- happens through the cascades when the blog or the account disappears.

CREATE TABLE IF NOT EXISTS comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id           UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One page of top-level comments for a blog, newest first
CREATE INDEX IF NOT EXISTS idx_comments_blog_created_at
ON comments(blog_id, created_at DESC);

-- Load the replies for a set of parents in one query
CREATE INDEX IF NOT EXISTS idx_comments_parent_created_at
ON comments(parent_comment_id, created_at);

-- One row per user per reaction per comment — a user may apply several
-- types ("like" and "heart" together); repeating the same type is a no-op.
CREATE TABLE IF NOT EXISTS comment_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id    UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'heart')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id, reaction_type)
);

-- Reaction totals per comment (counts grouped by comment + type)
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
ON comment_reactions(comment_id, reaction_type);
