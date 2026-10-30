# Quill — Product Requirements Document

> **Living document — checked against the repository on 2026-10-30.** “Implemented” means behavior exists in the checked-in client/API; it does not imply production readiness. See [Architecture](./Architecture.md), [API](./API.md), and [CHANGE-LOG.md](../CHANGE-LOG.md).

## 1. Product summary

Quill is a writing and reading platform for people who want to publish long-form stories and discover work from writers they care about. The current product includes account access, profiles, post creation and reading, feeds, follows, bookmarks, notifications, and a settings surface.

The codebase is an early, self-hostable application rather than a production service. Most user-facing core flows are connected to the API, but authentication still accepts a fixed test OTP, stored preferences are not yet applied to most corresponding client behaviors, and operational safeguards such as HTTPS, backups, and monitoring are not configured.

## 2. Target users

- **Readers** discover and save published writing, follow authors, and manage reading preferences.
- **Authors** maintain a profile, draft and publish posts, and schedule publication.
- **Operators** run the API, PostgreSQL, Redis-backed workers, and client using local tooling or Compose.

Administrative roles, moderation tooling, and multi-tenancy are not implemented.

## 3. Product goals

1. Make sign-up and initial onboarding straightforward.
2. Provide a usable writing workflow with drafts and explicit publishing.
3. Give readers server-backed feeds and persistent follows/bookmarks.
4. Keep account, profile, and reading-preference data manageable across sessions.
5. Keep implementation and deployment understandable in a small monorepo.

## 4. Current behavior and status

| Area | Current implementation | Remaining work |
|---|---|---|
| Identity | Email OTP signup/login, httpOnly cookies, refresh rotation, device/all-session logout, generated handles | Replace fixed OTP `0000`; verify real email flow and production abuse controls |
| Onboarding | Persists selected genres, optional avatar and bio through API | Client proceeds if persistence fails; align its UX/error handling |
| Profile | API-backed profile reads/edits, handle policy, disk-backed avatar uploads, visitor profiles | Add durable external/object storage and production upload lifecycle |
| Posts | Markdown editor, drafts, edit/delete, immediate and scheduled publishing | Rich publishing capabilities such as tags, comments, and analytics |
| Feeds | Paginated published feed and Following feed | “For You” is chronological, not personalized; search/topic filtering is client-side over loaded items |
| Follows | Persisted follow graph, follower list, following list, and suggestions | Ranking/selection for suggestions is basic; no moderation or private accounts |
| Bookmarks | Persisted per-user reading list | None required for current MVP behavior |
| Notifications | In-app notifications for follow and published-post events; read/unread operations | Preference switches are stored but do not currently suppress events; no email digest/realtime transport |
| Settings | Server-backed topic, default-tab, text-size, theme, and notification-preference snapshot | Most stored presentation/delivery preferences are not yet consumed by the rest of the app |
| Account lifecycle | Self-service deletion removes user-owned/cascaded data and clears auth cookies | Confirm retention/legal policy before a public launch |

### Non-goals today

There are no implemented comments/replies, likes, tags, full-text server search, editorial roles, moderation tools, recommendations, public anonymous reading API, or analytics pipeline. Do not treat UI labels or stored settings as proof that these behaviors are active.

## 5. User stories

### Reader

- ✅ Sign up with an email address, verify an OTP, and complete onboarding.
- ✅ Browse paginated published posts in the For You or Following feed.
- ✅ Follow and unfollow writers; view followers and people followed.
- ✅ Save and remove posts from a persistent bookmark list.
- ✅ Receive and manage in-app new-follower and new-post notifications.
- ✅ Save topic, feed-tab, and reading-appearance preferences across sessions.
- ⏳ Search and filter loaded feed content in the client; this is not server-side search or complete-corpus filtering.
- ⬜ Comment, reply, like, or privately message writers.

### Author

- ✅ Maintain a profile and avatar; change a handle subject to a six-month interval.
- ✅ Create and edit drafts in the markdown/rich-text/preview editor.
- ✅ Publish immediately or schedule a future publication.
- ✅ View own drafts and published posts.
- ⬜ Add tags, analytics, collaborative editing, or a full media library.

### Account owner

- ✅ Sign out on this device or revoke all refresh-token sessions.
- ✅ Permanently delete the account and associated records.

## 6. Important flows

### Signup and onboarding

1. Create an account with name and email.
2. Request and verify the email OTP; the API issues httpOnly access and refresh cookies and creates a handle on first successful login.
3. Choose at least one onboarding genre and optionally provide a bio/avatar.
4. The client navigates to the feed even if the onboarding API request fails, so a successful transition does not prove server persistence.

**Launch blocker:** OTP generation and verification currently use the literal code `0000`; verification accepts that code as a bypass when an active OTP exists.

### Create and publish

1. The editor creates/updates a server-side draft.
2. The author can publish immediately or schedule for a future time (limited by the queue delay ceiling).
3. The worker publishes due drafts and enqueues follower notifications.

### Settings

The settings page loads and saves a complete settings snapshot via `/api/user/settings`. The topics also map to the user's `fav_genre`. Values persist in PostgreSQL, but feed startup does not currently honor `defaultTab`, reading pages do not apply the saved theme/text size, and notification/email preferences are not yet used to filter delivery.

## 7. MVP priorities

### Complete before production exposure

- Remove fixed OTP behavior and test real OTP lifecycle end to end.
- Review auth throttling, session/cookie policy, CSRF posture, and email delivery configuration for the intended deployment.
- Configure HTTPS, secrets, backups/restore, monitoring, and persistent upload storage.
- Ensure database migrations are applied and recovery is tested.
- Decide whether settings are only saved preferences or are expected to control actual product behavior; wire or clearly label inactive preferences.

### Product follow-up

- Apply saved default-feed and reading-appearance preferences.
- Apply notification preferences and implement any promised email channels.
- Add server-side search and taxonomy only after the product requirements are defined.
- Define moderation, reporting, and content-retention expectations before opening the service broadly.

## 8. Success measures

Potential measures include onboarding completion, first post published, readers returning within seven days, posts read/saved per active reader, follows per active reader, and author time-to-publish. These are product goals only: no analytics instrumentation currently collects them.

## 9. Open decisions

- Should the product remain OTP-only, and what are the required OTP expiry, resend, and abuse-protection rules?
- What should “For You” mean beyond the current chronological published feed?
- Should profile/post reading be available without sign-in?
- What retention, moderation, and account-deletion policy is required?
- Which settings should actively affect client behavior and outbound notifications?
