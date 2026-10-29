# Quill — API Reference

This reference describes routes mounted by `apps/server` and important implementation gaps.

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
| 201 | Account created or onboarding request accepted |
| 400 | Missing/invalid request data or rejected state |
| 401 | Missing, invalid, expired, or revoked authentication |
| 409 | Account already exists |
| 413 | JSON body over the 1 MB limit (avatars are files now, this is a safety net) |
| 500 | Unexpected error, including database/configuration failures |

### Request validation

Write endpoints (`/auth/*`, `/auth/onboard`, `PATCH /user/edit-profile`, `POST /blogs`,
`PATCH /blogs/:id`, `POST /blogs/:id/publish`) validate their bodies with zod
(`apps/server/src/core/validation/validation.ts`) and reply `400` with the first
violation as `"<field>: <message>"`.

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

Creates a 30-minute OTP record and queues an email job. Any previous active OTP for the user is revoked.

**Request:** `{ "email": "me@example.com" }`

**200 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `400` if email is missing or the account does not exist.

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

Accepts the refresh cookie or a legacy `{ "refreshToken": "..." }` body, revokes all refresh tokens for that user, and clears both cookies. This signs the user out of all sessions, not only the current browser.

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

At least one `favGenre` item is required; `avatar` and `bio` are optional.

**201 response:** `{ "success": true, "data": { "success": true } }`

**Errors:** `400` if no genre is supplied, the user is missing, or onboarding is already complete; `401` if not authenticated.

> The client currently logs an onboarding API failure and still writes local onboarding data and navigates to the feed. A successful UI transition therefore does not guarantee this endpoint succeeded.

## 3. User (`/user`)

### `GET /user/me` — authenticated

The signed-in user's profile. `bio` is whatever the user wrote during onboarding — `null` when they never wrote one, so the client About tab stays empty. `website` is written only via `PATCH /user/edit-profile` (schema pending migration).

**200 response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "About Test",
    "bio": "Bio written during onboarding.",
    "avatar": null,
    "handle": "abouttest611793",
    "website": null,
    "favGenre": ["essays"]
  }
}
```

**Errors:** `401` unauthenticated; `404` if the user row vanished.

### `PATCH /user/edit-profile` — authenticated

The server accepts `name`, `avatar`, `bio`, `favGenre`, `handle`, and `website`, and returns the updated database row on success.

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

Fields are applied with `COALESCE`, so omitted or `null` values leave stored values unchanged. The TypeScript DTO marks `favGenre` as required, though the repository can accept an omitted value at runtime.

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

## 4. Blog (`/blogs`) — all authenticated

Blogs are markdown documents stored with a `draft`/`published` status. Every write
flow persists as a draft; a draft becomes visible to everyone only when the
author explicitly publishes it. `content` holds the canonical markdown/rich-text
source; `blog_description` is an optional excerpt.

| Method | Path | Purpose |
|---|---|---|
| POST | `/blogs` | Create a blog — **always saved as a draft** |
| GET | `/blogs?page&limit` | Feed: every published blog, newest first, with the viewer's `isBookmarked` flag. Optional `?author=<handle>` narrows to one writer's published blogs (visitor profiles) |
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

## 5. System and documentation routes

| Path | Method | Description |
|---|---|---|
| `/docs` | GET | Swagger UI; route files currently have no endpoint annotations |
| `/health` | — | Not implemented |

The API router is mounted at `/api`; `/auth/*`, `/user/*`, and `/blogs/*` are mounted.

## 6. Background email job

The API enqueues `send-otp` jobs on the BullMQ queue named `email`. `apps/server/src/worker.ts` starts a worker with concurrency 10.

| Job | Payload | Retry behavior |
|---|---|---|
| `send-otp` | `{ "type": "otp", "to": "email", "code": "0000" }` | 3 attempts with exponential backoff, initial delay 5 seconds |

The worker sends OTP email through Resend. No other job types are implemented.

## 7. Database tables

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
| `listMyPublishedApi` | `GET /blogs/published` |
| `listDraftsApi` | `GET /blogs/drafts` |
| `blogCountApi` | `GET /blogs/count` |
| `bookmarkBlogApi` | `POST`/`DELETE /blogs/:id/bookmark` |
| `listBookmarksApi` | `GET /blogs/bookmarks` |
| `getBlogApi` | `GET /blogs/:id` (the `/blog/:id` reading page) |
| `getProfileByHandleApi` | `GET /user/:handle` (visitor profiles) |
| `setFollowApi` | `POST`/`DELETE /user/:handle/follow` |
| `listFollowingApi` | `GET /user/following` (profile Following sidebar) |
| `uploadAvatarApi` | `POST /user/avatar` (multipart), then `PATCH /user/edit-profile` with the URL |
| `assetUrl` | Resolves server-relative `/uploads/…` paths against the API origin |

The client write editor (`/write`, `/write/:id`) autosaves as a draft and only
publishes when the Publish button is pressed; the feed and profile tabs render
API blogs through the existing `StoryCard` format. The feed paginates server-side
(20 per page via the IntersectionObserver sentinel); mock stories appear only
when the API is unreachable.
