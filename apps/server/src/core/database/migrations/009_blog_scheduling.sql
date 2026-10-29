-- Blog scheduling: a publish can be deferred to a future datetime; the
-- publishing worker (BullMQ delayed job) flips the row live at that moment.
-- The blog stays a draft (and out of the feed) until the job runs.

ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

-- The worker scans for blogs whose scheduled time is due
CREATE INDEX IF NOT EXISTS idx_blogs_scheduled_publish_at
ON blogs(scheduled_publish_at)
WHERE scheduled_publish_at IS NOT NULL;
