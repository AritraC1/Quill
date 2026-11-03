-- Post topic tags power the saved-topic feed preference.
ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_blogs_genres
ON blogs USING GIN (genres);

-- No product-news email source exists yet; legacy opt-ins stay disabled until
-- a newsletter or product-announcement workflow is introduced.
UPDATE user_settings SET notif_email_news = FALSE WHERE notif_email_news = TRUE;

-- Preferences now create these additional in-app event types.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_follower',
    'new_post',
    'scheduled_post_published',
    'comment_reply',
    'club_invite',
    'club_application',
    'club_review'
  ));
