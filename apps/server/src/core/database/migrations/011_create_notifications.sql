-- In-app notifications (bell in the navbar)
-- Only two event types exist:
--   new_follower — someone follows a writer          -> recipient is the writer
--   new_post     — a writer publishes a blog         -> recipients are their followers
--
-- event_key makes every notification idempotent: the publish worker (and any
-- retry) can insert the same event twice without producing duplicates.

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Actor = who caused the event (the follower / the publishing writer).
  -- Cascades so a deleted account does not leave orphaned notifications.
  actor_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Set only for "new_post" — confirmed on the blog being deleted as well
  blog_id      UUID REFERENCES blogs(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('new_follower', 'new_post')),
  -- Deterministic event identity, e.g. "follow:<follower>:<target>",
  -- "publish:<blogId>:<recipientId>" — unique => idempotent inserts
  event_key    TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ
);

-- The notification list: newest first, per recipient
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
ON notifications(recipient_id, created_at DESC);

-- The bell badge: count unread without scanning read rows
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON notifications(recipient_id) WHERE read_at IS NULL;
