-- Clubs ("My Clubs") — groups of writers with a review workflow:
--   open clubs     -> appear in Discover, users apply, admins/moderators decide
--   invite-only    -> hidden from Discover, members are invited by handle
-- Roles are admin / moderator / member (the UI's reviewer role = moderator).
-- Crises of consistency are all prevented at the DB level: unique memberships,
-- one pending application/invitation per user per club, one group conversation.

CREATE TABLE IF NOT EXISTS clubs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 60),
  description TEXT NOT NULL DEFAULT '',
  -- open = applications allowed (visible in Discover); invite = invitations only
  privacy     TEXT NOT NULL DEFAULT 'open' CHECK (privacy IN ('open', 'invite')),
  rules       TEXT[] NOT NULL DEFAULT '{}', -- one rule per UI line
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Discover search + landing pages
CREATE INDEX IF NOT EXISTS idx_clubs_name    ON clubs(name);
CREATE INDEX IF NOT EXISTS idx_clubs_created ON clubs(created_at DESC);

-- Membership: one row per user per club, admin / moderator / member
CREATE TABLE IF NOT EXISTS club_members (
  club_id   UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member'
            CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

-- "My clubs" list for the user, and per-club member lists
CREATE INDEX IF NOT EXISTS idx_club_members_user   ON club_members(user_id, club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_joined ON club_members(club_id, joined_at);

-- Join applications (open clubs). Note is required by the UI. History is kept:
-- status moves pending -> approved | rejected; decided_at/decided_by recorded.
CREATE TABLE IF NOT EXISTS club_applications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 500),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- At most one open application per user per club (partial index — history rows
-- of earlier rejected/decided applications do not block a new attempt)
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_application_pending
ON club_applications(club_id, user_id) WHERE status = 'pending';

-- Moderator review queue (badge count + pending list)
CREATE INDEX IF NOT EXISTS idx_club_applications_pending
ON club_applications(club_id) WHERE status = 'pending';

-- Invitations (invite-only clubs; open clubs may invite too). The inviter is
-- an admin/moderator; the invitee responds accept/decline.
CREATE TABLE IF NOT EXISTS club_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  inviter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- One pending invitation per user per club; re-inviting after a decline works
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_invitation_pending
ON club_invitations(club_id, invitee_id) WHERE status = 'pending';

-- "Invitations" tab: the viewer's open invites
CREATE INDEX IF NOT EXISTS idx_club_invitations_invitee_pending
ON club_invitations(invitee_id) WHERE status = 'pending';

-- Review history for club submissions (preserved across decisions; the live
-- review state itself lives on blogs.club_review_status so list queries stay
-- on one table)
CREATE TABLE IF NOT EXISTS club_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id     UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision    TEXT NOT NULL
              CHECK (decision IN ('approved', 'changes_requested', 'rejected')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_reviews_blog
ON club_reviews(blog_id, created_at DESC);

-- Collaborative club drafts: extra club members allowed to edit one draft blog
CREATE TABLE IF NOT EXISTS club_collaborators (
  blog_id  UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blog_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_collaborators_user
ON club_collaborators(user_id);

-- Admin dashboard activity feed (persisted events, same domain as metrics)
CREATE TABLE IF NOT EXISTS club_activity (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  actor_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  type      TEXT NOT NULL CHECK (type IN (
              'member_joined', 'submission', 'review_decision',
              'post_published', 'role_changed', 'application')),
  -- Human-readable sentence, prebuilt at write time (actor names resolved)
  detail    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_activity_club
ON club_activity(club_id, created_at DESC);

-- ******** Blogs: club attribution + review state + collaborative versioning ********

ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS club_review_status TEXT,
  -- Optimistic-concurrency counter for collaborative draft edits
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blogs_club_review_status_check'
  ) THEN
    ALTER TABLE blogs
      ADD CONSTRAINT blogs_club_review_status_check
      CHECK (club_review_status IN ('pending', 'changes_requested', 'rejected'));
  END IF;
END $$;

-- Published club posts (landing pages), newest first
CREATE INDEX IF NOT EXISTS idx_blogs_club_published
ON blogs(club_id, published_at DESC) WHERE status = 'published';

-- The review queue: only live (pending) submissions
CREATE INDEX IF NOT EXISTS idx_blogs_club_review_pending
ON blogs(club_id) WHERE club_review_status = 'pending';

-- ******** Chat: group conversation per club + member 1:1 conversations ********

CREATE TABLE IF NOT EXISTS club_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  -- true = the club's group conversation (exactly one per club, see index)
  is_group   BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_conversations_club
ON club_conversations(club_id);

-- Exactly one group conversation per club
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_group_conversation
ON club_conversations(club_id) WHERE is_group;

CREATE TABLE IF NOT EXISTS club_conversation_participants (
  conversation_id UUID NOT NULL REFERENCES club_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- "My conversations" sidebar
CREATE INDEX IF NOT EXISTS idx_ccp_user
ON club_conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS club_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES club_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_messages_conv
ON club_messages(conversation_id, created_at DESC);

-- ******** Notifications: club events extend (never break) the existing types ********

-- Club context for club_* notification types (new_post / new_follower keep it NULL)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%club%'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN ('new_follower', 'new_post', 'club_invite',
                      'club_application', 'club_review'));
  END IF;
END $$;
