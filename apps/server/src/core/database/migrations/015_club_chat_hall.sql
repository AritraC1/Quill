-- Club Chat Hall — the club-wide discussion area where every member is visible:
--   messages gain image attachments (stored on disk, URL in the DB, same
--   pattern as avatars), soft deletion lets admins/moderators moderate the
--   feed while preserving history, and club_members.last_seen_at powers the
--   presence dots ("online" = heartbeat within the last 2 minutes).

-- ---------- message attachments + moderation ----------

ALTER TABLE club_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- The original CHECK demanded non-empty text; a message may now be an image
-- with or without a caption. Deleted rows are exempt so the moderasor's
-- cleanup never fights the constraint.
ALTER TABLE club_messages
  DROP CONSTRAINT IF EXISTS club_messages_body_check;
ALTER TABLE club_messages
  ADD CONSTRAINT club_messages_body_check CHECK (
    deleted_at IS NOT NULL
    OR (
      length(btrim(body)) BETWEEN 1 AND 5000
      OR (attachment_url IS NOT NULL AND length(btrim(body)) <= 5000)
    )
  );

-- ---------- member presence ----------

ALTER TABLE club_members
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- The chat sidebar stamps last_seen on a heartbeat (client polls ~30s) and
-- reads this same column for every member; "online" = now - last_seen_at < 2 min
CREATE INDEX IF NOT EXISTS idx_club_members_last_seen
  ON club_members(club_id, last_seen_at DESC);
