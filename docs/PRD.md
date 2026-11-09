# Quill — Product Requirements Document

> **Living document — checked against the repository on 2026-11-09.** “Implemented” means behavior exists in the checked-in client/API; it does not imply production readiness. See [Architecture](./Architecture.md), [API](./API.md), and [CHANGE-LOG.md](../CHANGE-LOG.md).

## 1. Product summary

Quill is a writing and reading platform for people who want to publish long-form stories and discover work from writers they care about. The current product includes account access, profiles, post creation and reading, feeds, follows, bookmarks, threaded comments, writer clubs, notifications, reader text-to-speech, and a settings surface.

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
| Posts | Markdown editor, drafts, edit/delete, immediate and scheduled publishing, up to five topic tags per post, browser text-to-speech narration | Rich publishing capabilities such as analytics |
| Feeds | Paginated For You and Following feeds; For You is ranked by the Python recommender service (reading sessions, bookmarks, comments; popularity/content/ALS/hybrid/LightGBM) with a graceful database-feed fallback; saved genres filter the fallback and untagged legacy posts remain visible | Artifacts are trained on synthetic data; no durable impression log; server search is substring matching, not ranked full-text search |
| Comments | Two-level threaded comments with owner edit/delete, soft delete, and like/heart reactions | No richer moderation tooling |
| Clubs | Writer clubs with memberships, invitations, join applications, post submission/review workflow, group and direct chat with images and live Socket.IO events, version-checked shared drafts | Realtime chat is not horizontally scalable (in-memory presence); no live simultaneous editing |
| Follows | Persisted follow graph, follower list, following list, and suggestions | Ranking/selection for suggestions is basic; no private accounts |
| Bookmarks | Persisted per-user reading list | None required for current MVP behavior |
| Reading signals | Authenticated reading sessions record active time and maximum scroll depth as recommender input | Signals are behavioral proxies; no impression tracking |
| Notifications | In-app follow, new-post, scheduled-publication, comment-reply, and club events; opted-in follower email and weekly digest | No product-news email source or realtime transport |
| Settings | Server-backed saved topics, default feed tab, reader text size/theme, and notification switches; applied to feed, reader, and supported delivery channels | Product-news email is disabled until a newsletter source exists |
| Account lifecycle | Self-service deletion removes user-owned/cascaded data and clears auth cookies | Confirm retention/legal policy before a public launch |

### Non-goals today

There are no likes, ranked full-text or semantic search, editorial roles, moderation tools, public anonymous reading API, or analytics pipeline. The platform does support threaded comment reactions, post topic tags, basic server-side substring search, and a ranker-backed For You feed.

## 5. User stories

### Reader

- ✅ Sign up with an email address, verify an OTP, and complete onboarding.
- ✅ Browse paginated published posts in the For You or Following feed.
- ✅ Follow and unfollow writers; view followers and people followed.
- ✅ Save and remove posts from a persistent bookmark list.
- ✅ Receive and manage in-app new-follower and new-post notifications.
- ✅ Save topics, feed-tab, and reading-appearance preferences across sessions; saved topics filter tagged posts in For You.
- ✅ Search published posts server-side by substring across title, description, and content; this is not ranked full-text or semantic search.
- ✅ Comment, reply, and react to comments; message writers inside clubs.

### Author

- ✅ Maintain a profile and avatar; change a handle subject to a six-month interval.
- ✅ Create and edit drafts in the markdown/rich-text/preview editor.
- ✅ Join writer clubs: submit drafts for review, chat with members, and collaborate on version-checked shared drafts.
- ✅ Publish immediately or schedule a future publication.
- ✅ View own drafts and published posts.

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

The settings page loads and saves a complete settings snapshot via `/api/user/settings`. Saved topics are also the user's profile genres and filter tagged posts in For You; untagged legacy posts remain as fallback. The selected default feed tab is applied after settings load. Reader text size and light/sepia/dark theme are applied to story bodies. In-app switches gate their corresponding event types, and email switches gate follower emails and a weekly digest. Product-news email is disabled until a newsletter source exists.

## 7. MVP priorities

### Complete before production exposure

- Remove fixed OTP behavior and test real OTP lifecycle end to end.
- Review auth throttling, session/cookie policy, CSRF posture, and email delivery configuration for the intended deployment.
- Configure HTTPS, secrets, backups/restore, monitoring, and persistent upload storage.
- Ensure database migrations are applied and recovery is tested.
- Keep the background worker running for scheduled digest and follower-email delivery.

### Product follow-up

- Add a real product-news subscription/source before enabling that email preference.
- Add server-side search and taxonomy only after the product requirements are defined.
- Define moderation, reporting, and content-retention expectations before opening the service broadly.

## 8. Success measures

Potential measures include onboarding completion, first post published, readers returning within seven days, posts read/saved per active reader, follows per active reader, and author time-to-publish. These are product goals only: no analytics instrumentation currently collects them.

## 9. Open decisions

- Should the product remain OTP-only, and what are the required OTP expiry, resend, and abuse-protection rules?
- How should “For You” ranking evolve as real reading-signal data accumulates beyond the synthetic training artifacts (the feed currently falls back to a chronological, genre-filtered database feed whenever the recommender is unavailable)?
- Should profile/post reading be available without sign-in?
- What retention, moderation, and account-deletion policy is required?
- Which settings should actively affect client behavior and outbound notifications?

---