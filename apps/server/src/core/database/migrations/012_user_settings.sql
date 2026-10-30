-- Saved user settings (settings page — GET/PUT /user/settings).
-- Favourite genres stay in users.fav_genre (shared with onboarding/profile);
-- this table holds everything the profile DTO doesn't: reading appearance,
-- feed defaults and the notification switches.
--
-- All the preference columns are NOT NULL with defaults so the GET join can
-- COALESCE a missing row (user who never saved yet) into the defaults.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_tab           TEXT NOT NULL DEFAULT 'for-you' CHECK (default_tab IN ('for-you', 'following')),
  text_size             INT  NOT NULL DEFAULT 18 CHECK (text_size BETWEEN 15 AND 24),
  theme                 TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'sepia', 'dark')),
  -- notification switches (dot-notation mirrors the client keys: appPosts, ...)
  notif_app_posts       BOOLEAN NOT NULL DEFAULT TRUE,
  notif_app_followers   BOOLEAN NOT NULL DEFAULT TRUE,
  notif_app_scheduled   BOOLEAN NOT NULL DEFAULT TRUE,
  notif_app_replies     BOOLEAN NOT NULL DEFAULT FALSE,
  notif_email_digest    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_email_followers BOOLEAN NOT NULL DEFAULT FALSE,
  notif_email_news      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
