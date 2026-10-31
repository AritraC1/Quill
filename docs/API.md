# Quill — API Reference

This reference describes routes currently mounted by `apps/server`, along with behavior that is stored but not yet applied elsewhere in the client.

- **Runtime:** Bun + Express 5
- **Base URL (local server):** `http://localhost:3000/api`
- **Base URL (through the Compose client):** `http://localhost/api`
- **Swagger UI:** `http://localhost:3000/docs` locally, or `/docs/` through the Compose client. Route annotations are not yet present, so the generated spec does not document these endpoints.

## 1. Conventions

Successful controller responses use:

```json
{ "success": true, "data": {} }
```

Known application errors use:

```json
{ "success": false, "message": "Human readable reason" }
```

Unexpected errors return status `500`; the message is masked as `Internal server error` in production and includes the underlying message in development. Express's default handling for unmatched routes is not guaranteed to use this JSON envelope.

### Authentication

Browser sessions use two httpOnly cookies; token strings are not returned in JSON:

| Cookie | Path | Default lifetime | Purpose |
|---|---|---|---|
| `quill_access_token` | `/` | 15 minutes | Access to protected API routes |
| `quill_refresh_token` | `/api/auth` | 7 days | Session restore, refresh, and logout |

Both use `SameSite=Lax`; `Secure` is enabled in production. Durations are configurable with `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`. The protected-route middleware also accepts `Authorization: Bearer <access-token>` for programmatic clients. The refresh endpoint and logout additionally accept a legacy `refreshToken` body field.

The client sends `credentials: "include"`, and the server allows the configured `CLIENT_URL` with credentialed CORS. For a cross-origin development setup, the browser's cookie policy and client/server origins must be configured consistently.

### Status codes

| Code | Use |
|---|---|
| 200 | Successful request |
| 201 | Account created, onboarding completed, blog created, or avatar uploaded |
| 400 | Missing/invalid request data or rejected state |
| 401 | Missing, invalid, expired, or revoked authentication |
| 409 | Account already exists |
| 413 | JSON body over the 1 MB limit (avatars are files now, this is a safety net) |
| 500 | Unexpected error, including database/configuration failures |

### Request validation

Auth, onboarding, blog create/update/publish, and `PUT /user/settings` validate
their bodies with Zod (`apps/server/src/core/validation/validation.ts`) and
reply `400` with the first violation as `"<field>: <message>"`. Profile edits
are validated in the service for name and handle rules, but do not currently
pass through the shared Zod body parser.

### Rate limiting

Two IP-based `express-rate-limit` tiers protect the API (`core/rate-limit.ts`):

| Limiter | Applies to | Window | Limit |
|---|---|---|---|
| `apiLimiter` | every `/api` route | 1 minute | 300 requests |
| `authLimiter` | `sign-up`, `request-otp`, `verify-otp` | 10 minutes | 20 requests (only failures count) |

Exceeding a limit returns `429` with `{ "success": false, "message": ... }`.

## 2. Authentication (`/auth`)

### `POST /auth/sign-up`

Creates an account. It does not sign the user in; request and verify an OTP separately.

**Request**

```json
{ "name": "Aritra Chatterjee", "email": "me@example.com" }
```

**201 response**

```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Aritra Chatterjee", "email": "me@example.com" }
}
```

**Errors:** `400` if name or email is missing; `409` if the email already exists.

### `POST /auth/request-otp`

Creates a 30-minute OTP record and queues an email job. Any previous active OTP for the user is revoked. For an unknown email, it intentionally returns the same success response without queuing a job.

**Request:** `{ "email": "me@example.com" }`

**200 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `400` if the email is missing or invalid.

> **Critical development limitation:** `auth.service.ts` currently generates the literal code `0000`, and verification accepts `0000` as a bypass. Do not expose this behavior in production.

### `POST /auth/verify-otp`

Verifies the code, consumes the active OTP, generates a unique handle if the user has none, and sets both auth cookies.

**Request:** `{ "email": "me@example.com", "otp": "0000" }`

**200 response** (cookies set; token values are not in the body):

```json
{ "success": true, "data": { "onboardingCompleted": false } }
```

**Errors:** `400` for missing email/OTP, unknown user, no active OTP, or invalid OTP. An active OTP record must exist even when the bypass value is used.

### `POST /auth/refresh-token`

Reads the refresh cookie (preferred) or legacy body value, verifies and revokes the old refresh token, then sets a new cookie pair.

**Legacy request body:** `{ "refreshToken": "..." }`. Browser clients normally send `{}` with the cookie attached.

**200 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `400` if no refresh token is supplied; `401` if token verification fails, the token is expired, or it is not an active stored token.

### `GET /auth/session`

Verifies the refresh cookie without rotating it, looks up the user, and returns session state for client startup.

**200 response:**

```json
{ "success": true, "data": { "authenticated": true, "onboardingCompleted": false } }
```

**Errors:** `401` if there is no valid refresh cookie or the user no longer exists.

### `DELETE /auth/logout`

Accepts the refresh cookie or a legacy `{ "refreshToken": "..." }` body. By default, it revokes only the presented refresh token; send `{ "scope": "all" }` to revoke every session for that user. Both cookies are cleared from the current browser in either case.

**Request:** `{ "scope": "device" }` (default) or `{ "scope": "all" }`.

**200 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `401` if there is no active session or the token cannot be verified.

### `POST /auth/onboard` — authenticated

Persists genres, optional avatar and bio, and marks onboarding complete. This endpoint rejects a repeat onboarding request.

**Request**

```json
{
  "favGenre": ["essays", "design"],
  "avatar": "data:image/jpeg;base64,...",
  "bio": "A short introduction"
}
```

`favGenre` must contain 1–5 entries; `avatar` and `bio` are optional. The avatar may be a URL or legacy data URL.

**201 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `400` if no genre is supplied, the user is missing, or onboarding is already complete; `401` if not authenticated.

> The client currently logs an onboarding API failure and still writes local onboarding data and navigates to the feed. A successful UI transition therefore does not guarantee this endpoint succeeded.

## 3. User (`/user`)

### `GET /user/me` — authenticated

The signed-in user's profile, including the private sign-in email, follower/following counts, and profile fields.

**200 response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Aritra Chatterjee",
    "email": "me@example.com",
    "bio": "A short introduction",
    "avatar": "/uploads/avatar.jpg",
    "handle": "aritra611793",
    "handleChangedAt": null,
    "website": null,
    "favGenre": ["Essays"],
    "followers": 3,
    "following": 2,
    "createdAt": "2026-10-28T15:38:34.508Z"
  }
}
```

**Errors:** `401` unauthenticated; `404` if the user row vanished.

### `PATCH /user/edit-profile` — authenticated

The server accepts optional `name`, `avatar`, `bio`, `favGenre`, `handle`, and `website`, and returns the updated database row on success. Name length and handle shape/reserved-name/uniqueness/lock rules are enforced in the service. Other fields currently do not use the shared Zod parser.

**Intended request shape**

```json
{
  "name": "Aritra Chatterjee",
  "avatar": "/uploads/1727500000-8f3a….jpg",
  "bio": "A short introduction",
  "favGenre": ["essays"],
  "handle": "aritra42",
  "website": "https://example.com"
}
```

Fields are applied with `COALESCE`, so omitted or `null` values leave stored values unchanged. The shared TypeScript DTO marks `favGenre` as required even though the repository can accept an omitted value at runtime.

**Handle policy:** every account starts with a system-generated handle (e.g. `julianvance328641`, issued at OTP verification). The handle can be changed once every 6 months — `users.handle_changed_at` is stamped only when the handle actually changes, and subsequent changes inside the window are rejected with `400 "You can change your handle only once every 6 months"`. Handles must match `^[a-z0-9][a-z0-9_-]{2,29}$` (lowercase; normalized) and are unique — a collision returns `409`.

The profile URL is `<client-origin>/<handle>` (Twitter-style). `/profile` and the legacy `/u/<handle>` paths forward to the canonical address, and the client "Copy link" / "Share profile" menu always shares that canonical URL.

**Note:** the client edit form persists changes server-side (`PATCH /user/edit-profile`, including the display name) and mirrors them to `localStorage` for instant UI updates. Sending `"avatar": ""` clears the stored photo.

Handles that would collide with static routes (`api`, `docs`, `uploads`, `feed`, `write`, …) are rejected as reserved (`400 "That handle is reserved"`).

### `POST /user/avatar` — authenticated (multipart)

Uploads a profile image. `multipart/form-data` with a single file field named
`avatar` (JPEG/PNG/WebP, max 5 MB). The file streams to disk under
`<server cwd>/uploads/` and the response carries only the small URL that should
subsequently be sent to `PATCH /user/edit-profile` as `avatar`:

```json
{ "success": true, "data": { "url": "/uploads/1727500000-8f3a….jpg" } }
```

**Errors:** `400` no file or unsupported type; `413` over 5 MB.

### `GET /user/:handle` — authenticated

Public profile of any writer. Visitors are logged-in users, so the route stays
behind `requireAuth` and returns the viewer's follow state:

```json
{
  "success": true,
  "data": {
    "id": "uuid", "name": "Bethany Torres", "bio": "…",
    "avatar": "/uploads/…", "handle": "bethanytorres",
    "website": null, "favGenre": ["essays"],
    "createdAt": "2026-10-28T…",
    "followers": 3, "isFollowing": false
  }
}
```

**Errors:** `404` unknown handle.

### `GET /user/:handle/followers` — authenticated

Returns a page of followers, newest first. Query parameters: `page` (default
1) and `limit` (default 10, maximum 50). Each follower includes `id`, `name`,
`handle`, `avatar`, and whether the viewer already follows them.

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "uuid", "name": "Sam Reader", "handle": "samreader", "avatar": null, "isFollowing": false }
    ],
    "total": 1
  }
}
```

### `POST /user/:handle/follow` / `DELETE /user/:handle/follow` — authenticated

Follow / unfollow. `POST` is idempotent; `DELETE` succeeds silently when not
following. Both return the new state:

```json
{ "success": true, "data": { "handle": "bethanytorres", "isFollowing": true, "followers": 4 } }
```

**Errors:** `404` unknown handle; `400` attempting to follow yourself.

### `GET /user/following` — authenticated

The people the signed-in user follows, newest first:

```json
{ "success": true, "data": [{ "id": "uuid", "name": "…", "handle": "…", "avatar": null }] }
```

This powers the profile-page Following sidebar. Route order in `user.routes.ts`
is load-bearing: `/me` and `/following` must be registered before the `/:handle`
catch-all.

### `GET /user/suggestions` — authenticated

Returns suggested accounts, excluding the current user and users they already
follow. `limit` defaults to 5 and is clamped to 1–20. Each item contains profile
summary fields and a follower count. Suggestions are basic and are not ranked
by a recommendation system.

### `GET /user/settings` / `PUT /user/settings` — authenticated

`GET` returns the complete saved preference snapshot, including defaults for
users who have never saved settings. `PUT` replaces the complete snapshot;
genres are stored in `users.fav_genre`, while the remaining values are stored
in `user_settings`. The write is transactional.

```json
{
  "genres": ["Essays", "Design"],
  "defaultTab": "for-you",
  "textSize": 18,
  "theme": "light",
  "notifications": {
    "appPosts": true,
    "appFollowers": true,
    "appScheduled": true,
    "appReplies": false,
    "emailDigest": true,
    "emailFollowers": false,
    "emailNews": false
  }
}
```

Allowed `defaultTab`: `for-you` or `following`; `textSize`: integer 15–24;
`theme`: `light`, `sepia`, or `dark`; at most 20 non-empty genres. All seven
notification switches are booleans. These settings are persisted, but the
client currently does not apply most of them to feed selection, reader styling,
or notification/email delivery.

### `DELETE /user/account` — authenticated

Permanently deletes the signed-in user and cascaded records (posts, bookmarks,
follows, notifications, OTPs, refresh tokens, and settings) in a database
transaction, then clears both auth cookies.

**200 response:**

```json
{
  "success": true,
  "data": { "deleted": true, "publishedPosts": 2, "drafts": 1, "bookmarks": 3 }
}
```

The counts are returned for the confirmation UI; deleted account data cannot
be restored.

## 4. Blog (`/blogs`) — all authenticated

Blogs are markdown documents stored with a `draft`/`published` status. Every write
flow persists as a draft; a draft becomes visible to everyone only when the
author explicitly publishes it. `content` holds the canonical markdown/rich-text
source; `blog_description` is an optional excerpt.

| Method | Path | Purpose |
|---|---|---|
| POST | `/blogs` | Create a blog — **always saved as a draft** |
| GET | `/blogs?page&limit` | Feed: every published blog, newest first, with the viewer's `isBookmarked` flag. Optional `?author=<handle>` narrows to one writer's published blogs (visitor profiles) |
| GET | `/blogs/following?page&limit` | Published blogs by writers the signed-in user follows, newest first |
| GET | `/blogs/count` | Writer statistics: `{ published, drafts, total }` |
| GET | `/blogs/drafts?page&limit` | The signed-in writer's drafts only |
| GET | `/blogs/published?page&limit` | The signed-in writer's published blogs |
| GET | `/blogs/bookmarks?page&limit` | The viewer's saved reading list |
| GET | `/blogs/:id` | Single blog — drafts are 403 for anyone but the author |
| PATCH | `/blogs/:id` | Partial edit (works while drafting and after publishing) |
| DELETE | `/blogs/:id` | Delete a draft or published blog (owner only) |
| POST | `/blogs/:id/publish` | Publish — `400` without a title, `400` if already published. Body `{}` = instant publish; body `{ "publishAt": "<ISO>" }` = scheduled publish (must be in the future, at most **24 days** ahead — BullMQ delays are 32-bit ms) |
| DELETE | `/blogs/:id/schedule` | Cancel a scheduled publish — the blog stays an ordinary draft |
| POST | `/blogs/:id/bookmark` | Save to the reading list |
| DELETE | `/blogs/:id/bookmark` | Remove from the reading list |

List responses are `{ items: BlogResponseDTO[], total }` and include the author
(`name`, `handle`, `avatar`) from the users join. `isBookmarked` reflects the
viewer's saved state on feed/detail/saved responses.

**Request (create/update)**

```json
{
  "title": "A Quiet Manifesto",
  "content": "# A Quiet Manifesto\n\nSome **bold** thoughts.",
  "description": "optional excerpt",
  "images": ["https://..."]
}
```

Current request validation accepts `title`, `content`, and `description`.
Although the database and shared DTO include `images`, the active Zod schema
does not currently accept that field (unknown body keys are stripped), so blog
image persistence is not available through these routes yet.

**Single blog response** (dates serialized as ISO strings):

```json
{
  "success": true,
  "data": {
    "id": "uuid", "userId": "uuid", "title": "...", "content": "...",
    "description": "", "images": null, "status": "published",
    "publishedAt": "2026-10-28T15:38:34.508Z",
    "scheduledPublishAt": null,
    "createdAt": "...", "updatedAt": "...",
    "author": { "id": "uuid", "name": "Test Writer", "handle": "quiet-writer", "avatar": null },
    "isBookmarked": false
  }
}
```

### Blog scheduling

`POST /blogs/:id/publish` with a future `publishAt` keeps the blog as a `draft`,
stores `scheduled_publish_at`, and enqueues a delayed BullMQ job on the
`blog-publish` queue (`jobId: publish:<blogId>`, delay = time remaining). The
worker process (`bun run dev:worker`, `src/worker.ts`) publishes the blog when
the job is dequeued; the repository update is idempotent, so a job firing after
a manual instant publish or cancellation is a safe no-op. Deleting the blog or
instant-publishing cancels the pending job; rescheduling replaces the previous
job id. Schema: `migrations/009_blog_scheduling.sql` (`blogs.scheduled_publish_at`).

**Errors:** `401` unauthenticated; `404` unknown blog; `403` editing/deleting or
reading someone else's draft; `400` publish without a title, duplicate publish,
invalid or stale `publishAt`, or oversized `title`/`content`/`description`;
`400` bookmarking an unpublished blog.

Bookmark state lives in `blog_bookmarks` (unique per `(user_id, blog_id)`), so
saved lists survive across devices.

### Comments (`/blogs/:blogId/comments`, `/comments`) — all authenticated

The CommentSection under a published story. Threads are a two-level tree:
`parent_comment_id` is `NULL` for a top-level comment and points at its parent
for a reply; replying to a reply attaches under that reply's top-level
ancestor (no third level is ever stored or served). Comments are soft-deleted
(`deleted_at`): a removed comment keeps its place rendered as "Comment
deleted" while its replies survive, and rows only disappear through the
`ON DELETE CASCADE` when the blog or the account is deleted.

| Method | Path | Purpose |
|---|---|---|
| GET | `/blogs/:blogId/comments?page&limit` | Page of top-level comments (newest first), each with direct replies inline, `replyCount`, reaction totals and the viewer's reactions |
| POST | `/blogs/:blogId/comments` | Add a comment; body `{ "body": "...", "parentCommentId": "uuid?" }` makes it a reply |
| PATCH | `/comments/:commentId` | Edit own comment `{ "body": "..." }` |
| DELETE | `/comments/:commentId` | Soft-delete own comment (owner only) |
| PUT | `/comments/:commentId/reaction` | Apply the viewer's reaction `{ "reactionType": "like" \| "heart" }` |
| DELETE | `/comments/:commentId/reaction` | Remove the viewer's reaction |

Each comment is returned as a `CommentDTO`:

```json
{
  "id": "…", "blogId": "…", "userId": "…",
  "parentCommentId": null, "body": "Great read!",
  "createdAt": "…", "updatedAt": "…", "deletedAt": null,
  "author": { "id": "…", "name": "Alex", "handle": "alex", "avatar": null },
  "replyCount": 2,
  "reactions": { "like": 3, "heart": 1, "total": 4 },
  "viewerReactions": ["like"],
  "replies": [ { "id": "…", "parentCommentId": "…", "body": "Thanks!", "replyCount": 0, "replies": null } ]
}
```

- **Pagination:** top-level comments page with `page`/`limit` (default 10, max 50).
  Replies are embedded; a thread never paginates.
- **Reactions:** one row per `(comment_id, user_id, reaction_type)` — a user may
  apply "like" and "heart" together; repeating the same type is a no-op
  (idempotent upsert), so double-clicks never double-count. Reaction totals are
  `COUNT` groups per comment + type.
- **Deletion behavior:** soft delete stamps `deleted_at`, the serialized `body`
  becomes `""` and the client renders "Comment deleted"; deleted comments
  cannot be reacted to or edited further.

**Errors:** `401` unauthenticated; `404` unknown blog, or comments requested on
someone else's draft; `400` body rules (`1–5,000 chars`), commenting on an
unpublished blog, replying cross-blog or to a deleted comment, editing a
deleted comment, reacting to a deleted comment; `403` editing/deleting another
writer's comment.

## 5. Notifications (`/notifications`) — all authenticated

In-app notifications for the navbar bell. There are exactly two events:

| Event | Recipient | Message rendered by the client |
|---|---|---|
| A writer publishes a blog | Their followers | "Alex published a new story" |
| Someone follows a writer | The writer being followed | "Sam started following you" |

### `GET /notifications` — authenticated

One page of the signed-in user's notifications, newest first. Query: `page`
(default 1), `limit` (default 20, max 50). Each item carries `id`, `type`
(`new_post` / `new_follower`), `actor` (`id`, `name`, `handle`, `avatar`),
`blog` (`id`, `title`, only for `new_post`), `createdAt` and `readAt` (null
while unread).

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "…",
        "type": "new_post",
        "actor": { "id": "…", "name": "Alex", "handle": "alex", "avatar": null },
        "blog": { "id": "…", "title": "On Slow Reading" },
        "createdAt": "2026-01-05T10:12:00.000Z",
        "readAt": null
      }
    ],
    "total": 1
  }
}
```

### `GET /notifications/unread-count`

`{ "data": { "count": 3 } }` — the number shown on the bell badge (unread
notifications only).

### `PATCH /notifications/:id/read`

Marks one notification read. `404` when the id is not an unread notification
of the signed-in user.

### `PATCH /notifications/read-all` / `DELETE /notifications`

`read-all` marks everything read (`{ "data": { "count": 5 } }` — rows updated);
`DELETE /notifications` clears the whole list for the signed-in user.

### Notification lifecycle

- Follow: created right after the follow row is actually inserted — a repeat
  follow is a no-op and pings nobody.
- Publish: fan-out is enqueued on the BullMQ queue `notification-fanout`
  (`jobId: fanout:<blogId>`) in the instant-publish path and by the
  scheduled-publish worker (`blog-publish`) the moment a blog actually flips
  draft → published. The worker inserts one notification per follower in
  batches of 500 (keyset pagination over `user_follows`).
- Idempotency: every notification carries a deterministic `event_key`
  (`follow:<follower>:<target>`, `publish:<blogId>:<recipient>`) enforced
  `UNIQUE` in Postgres, so job retries and re-enqueues never duplicate.
- Deletion: `actor_id`, `recipient_id`, and `blog_id` all reference with
  `ON DELETE CASCADE`; de-deleting a user or blog removes its notifications.
  Schema: `migrations/011_create_notifications.sql`. The client polls
  `/notifications/unread-count` every 30 s (live streaming via SSE/WebSockets
  is a future upgrade). The user settings notification switches are stored but
  do not currently filter in-app events or trigger email notifications.

## 6. System and documentation routes

| Path | Method | Description |
|---|---|---|
| `/docs` | GET | Swagger UI; route files currently have no endpoint annotations |
| `/health` | — | Not implemented |

The API router is mounted at `/api`; `/auth/*`, `/user/*`, `/blogs/*`, and
`/notifications/*` are mounted.

## 7. Background jobs

The API enqueues `send-otp` jobs on the BullMQ queue named `email`. `apps/server/src/worker.ts` starts a worker with concurrency 10.

| Job | Queue | Payload | Retry behavior |
|---|---|---|---|
| `send-otp` | `email` | `{ "type": "otp", "to": "email", "code": "0000" }` | 3 attempts with exponential backoff, initial delay 5 seconds |
| `publish` | `blog-publish` | `{ "blogId": "…" }` | Delayed job for scheduled publishes; flips `draft` → `published`, then enqueues fan-out |
| `fanout` | `notification-fanout` | `{ "blogId": "…", "authorId": "…" }` | Inserts one "published" notification per follower in 500-row batches; idempotent via unique event keys |

The email worker sends OTP email through Resend.

## 8. Database tables

| Table | Columns/role | Migration |
|---|---|---|
| `users` | `id`, `name`, `email`, `created_at`, `updated_at` | `001_create_users.sql` |
| `login_otps` | `user_id`, `code_hash`, `expires_at`, `revoked_at`, timestamps | `002_create_login_otps.sql` |
| `refresh_tokens` | `user_id`, SHA-256 token hash, `expires_at`, `revoked_at`, timestamps | `003_create_refresh_tokens.sql` |
| `users` onboarding fields | `fav_genre`, `avatar`, `bio`, `onboarding_completed` | `004_add_user_onboarding_fields.sql` |
| `users.handle` | Optional unique handle | `005_add_user_handle.sql` |
| `blogs` | `user_id`, title, description, images, timestamps | `006_create_blogs.sql` |
| `blogs` workflow | `status` (`draft`/`published`), `content` (markdown), `published_at` | `007_blog_status_content_bookmarks.sql` |
| `blog_bookmarks` | `user_id` ↔ `blog_id` unique pair, `created_at` | `007_blog_status_content_bookmarks.sql` |
| `users.website`, `users.handle_changed_at` | Profile link + 6-month handle-lock clock | `008_user_website_handle_changed_at.sql` |
| `blogs.scheduled_publish_at` | Scheduled-publish timestamp | `009_blog_scheduling.sql` |
| `user_follows` | `follower_id` ↔ `following_id` unique pair (no self-follow), `created_at` | `010_user_follows.sql` |
| `notifications` | `recipient_id`, `actor_id`, `blog_id`, `type`, unique `event_key`, `read_at`; unread index | `011_create_notifications.sql` |
| `user_settings` | Default feed tab, text size, theme, notification switches; genres remain in `users.fav_genre` | `012_user_settings.sql` |
| `comments` | `blog_id` + `user_id` (cascade), self-referencing `parent_comment_id` (tree), `body`, soft-delete `deleted_at`; blog/parent/reader indexes | `013_create_comments.sql` |
| `comment_reactions` | `comment_id` + `user_id` + `reaction_type` (`like`/`heart`) unique triple, `created_at`; per-comment count index | `013_create_comments.sql` |

Migrations are plain, idempotent SQL files in `src/core/database/migrations/`,
applied in filename order by the runner (`bun run migrate`,
`src/scripts/migrate.ts`), which records each in a `migrations` table.

## 8. Client API mapping

| Client operation | Endpoint |
|---|---|
| `signUpApi` | `POST /auth/sign-up` |
| `requestOtpApi` | `POST /auth/request-otp` |
| `verifyOtpApi` | `POST /auth/verify-otp` |
| `sessionApi` | `GET /auth/session` |
| `refreshTokenApi` | `POST /auth/refresh-token` |
| `logoutApi` | `DELETE /auth/logout` |
| `onboardApi` | `POST /auth/onboard` |
| `getMeApi` | `GET /user/me` (10s client-side cache; `clearMeCache()` on logout) |
| `fetchWithAuth` | Shared cookie-auth helper; retries once after a 401 by refreshing |
| `createBlogApi` | `POST /blogs` (draft) |
| `updateBlogApi` | `PATCH /blogs/:id` |
| `publishBlogApi` | `POST /blogs/:id/publish` |
| `deleteBlogApi` | `DELETE /blogs/:id` |
| `getBlogApi` | `GET /blogs/:id` |
| `listFeedApi` | `GET /blogs?page&limit` |
| `listFollowingFeedApi` | `GET /blogs/following?page&limit` |
| `listMyPublishedApi` | `GET /blogs/published` |
| `listDraftsApi` | `GET /blogs/drafts` |
| `blogCountApi` | `GET /blogs/count` |
| `bookmarkBlogApi` | `POST`/`DELETE /blogs/:id/bookmark` |
| `listBookmarksApi` | `GET /blogs/bookmarks` |
| `getBlogApi` | `GET /blogs/:id` (the `/blog/:id` reading page) |
| `getProfileByHandleApi` | `GET /user/:handle` (visitor profiles) |
| `setFollowApi` | `POST`/`DELETE /user/:handle/follow` |
| `listFollowingApi` | `GET /user/following` (profile Following sidebar) |
| `listFollowersApi` | `GET /user/:handle/followers?page&limit` |
| `listSuggestionsApi` | `GET /user/suggestions?limit` |
| `uploadAvatarApi` | `POST /user/avatar` (multipart), then `PATCH /user/edit-profile` with the URL |
| `assetUrl` | Resolves server-relative `/uploads/…` paths against the API origin |
| `listNotificationsApi` | `GET /notifications?page&limit` (bell dropdown) |
| `unreadCountApi` | `GET /notifications/unread-count` (polled every 30 s) |
| `markNotificationReadApi` | `PATCH /notifications/:id/read` |
| `markAllNotificationsReadApi` | `PATCH /notifications/read-all` |
| `clearNotificationsApi` | `DELETE /notifications` ("Clear" in the bell) |
| `getSettingsApi` / `saveSettingsApi` | `GET` / `PUT /user/settings` |
| `deleteAccountApi` | `DELETE /user/account` |
| `listCommentsApi` | `GET /blogs/:blogId/comments?page&limit` (CommentSection) |
| `createCommentApi` | `POST /blogs/:blogId/comments` (`parentCommentId` for replies) |
| `updateCommentApi` | `PATCH /comments/:commentId` |
| `deleteCommentApi` | `DELETE /comments/:commentId` (soft delete) |
| `setCommentReactionApi` / `removeCommentReactionApi` | `PUT` / `DELETE /comments/:commentId/reaction` |

The client write editor (`/write`, `/write/:id`) autosaves as a draft and
publishes immediately or schedules through the API. Feed and profile pages
render server blogs; feed requests are paginated (20 per server page). The For
You and Following feeds are separate endpoints. Search/topic filtering is
client-side over loaded posts; fallback stories can appear if a feed API request
fails. Settings persist, but most are not yet applied elsewhere in the client or
notification delivery.
