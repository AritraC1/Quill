# Quill — API Reference

Full REST API reference for the Quill backend (`apps/server`).

- **Runtime:** Bun + Express 5
- **Base URL (dev):** `http://localhost:3000/api`
- **Base URL (prod, via nginx proxy):** `https://<your-host>/api`
- **Interactive docs (Swagger UI):** `http://localhost:3000/docs` — currently mostly empty; JSDoc/OpenAPI annotations have not been added to the route files yet. This document is the source of truth until then.

---

## 1. Conventions

### Response envelope

Every JSON endpoint returns one of two shapes:

```jsonc
// Success
{ "success": true, "data": { ... } }

// Error — produced by the global error handler (core/errors/error.middleware.ts)
{ "success": false, "message": "Human readable reason" }
```

### Authentication

Auth is **cookie-based** — tokens never exist in JS-readable storage:

- The server issues **httpOnly cookies** on `verify-otp` / `refresh-token` (see `core/config/cookie.config.ts`):
  - `quill_access_token` — JWT (HS256, 15 min default), path `/`, sent with every `/api` request
  - `quill_refresh_token` — rotating JWT (7 day default), **path `/api/auth`** so it only rides on refresh/logout/session calls
  - Both `HttpOnly` + `SameSite=Lax`; `Secure` is enabled in production
- 🔒 endpoints accept the access token from the **cookie** (browser) or a legacy `Authorization: Bearer <accessToken>` header (API clients)
- Rotation: every refresh revokes the used refresh token in `refresh_tokens` (stored as SHA-256 hash) and re-issues the cookie
- Clients no longer receive token values in JSON responses — login/refresh bodies carry only `{ onboardingCompleted }`; boot-time session restore is `GET /auth/session`
- CORS is credentialed (`credentials: true`) with the exact client origin — for credentialed requests the origin cannot be `*`

### Status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation failure / bad request |
| 401 | Missing, invalid or expired token |
| 409 | Conflict (e.g. email already registered) |
| 500 | Unhandled server error (message masked as `Internal server error` in production) |

---

## 2. Auth domain (`/auth`)

### 2.1 Sign up — `POST /auth/sign-up`

Creates a user account. Passwordless — login happens via emailed OTP.

**Body**

```jsonc
{
  "name": "Aritra Chatterjee",  // required, non-empty
  "email": "me@example.com"     // required, unique
}
```

**Response `201`**

```jsonc
{
  "success": true,
  "data": {
    "id": "d3f8…", "name": "Aritra Chatterjee", "email": "me@example.com"
  }
}
```

**Errors:** `400 Name and email are required` · `409 User already exists`

---

### 2.2 Request OTP — `POST /auth/request-otp`

Creates an OTP (hashed with bcrypt, 30 min expiry), revokes any previous active OTP for the user, and enqueues a delivery email via BullMQ.

> ⚠️ **Dev note:** the OTP is hard-coded to `"0000"` in `auth.service.ts` and `"0000"` is also accepted as a universal bypass in `verify-otp`. This must be removed before production (see CHANGE-LOG).

**Body**

```jsonc
{ "email": "me@example.com" }
```

**Response `200`**

```jsonc
{ "success": true, "data": { "success": true } }
```

**Errors:** `400 Email is required` · `400 User does not exist`

---

### 2.3 Verify OTP / Login — `POST /auth/verify-otp`

Consumes the active OTP and establishes a session by **setting both httpOnly cookies** (`quill_access_token`, `quill_refresh_token`). On the user's first successful login a unique `@handle` is generated from their name (5 retries, unique-violation aware). No token values appear in the response body.

**Body**

```jsonc
{ "email": "me@example.com", "otp": "482913" }  // or "0000" (dev bypass)
```

**Response `200`** — sets the auth cookies; body carries session metadata only:

```jsonc
{ "success": true, "data": { "onboardingCompleted": false } }
```

**Errors:** `400 Email and OTP are required` · `400 User does not exist` · `400 No active OTP found for this email` · `400 Invalid OTP`

---

### 2.4 Refresh token — `POST /auth/refresh-token`

Rotates the token pair. The presented refresh token (read from the `quill_refresh_token` **cookie**, or a legacy `{ "refreshToken": "…" }` body field) must exist, be unrevoked and unexpired in `refresh_tokens`; it is revoked immediately after use and the new pair is set as cookies.

**Response `200`**

```jsonc
{ "success": true, "data": { "success": true } }
```

**Errors:** `400 Refresh token is required` · `401 Refresh token required` · `401 Refresh token is invalid or revoked`

---

### 2.5 Session — `GET /auth/session`

Boot-time state restore for browser clients: verifies the refresh cookie (non-rotating) and reports who is logged in. Lets route guards know the `onboardingCompleted` state **without any token values leaking to JS**.

**Response `200`**

```jsonc
{ "success": true, "data": { "authenticated": true, "onboardingCompleted": false } }
```

**Errors:** `401 Not authenticated` (no/invalid/expired refresh cookie)

---

### 2.6 Logout — `DELETE /auth/logout`

Identifies the user from the refresh cookie (revoking **all** their active refresh tokens — sign-out-everywhere semantics) and **clears both auth cookies**.

**Response `200`**

```jsonc
{ "success": true, "data": { "success": true } }
```

**Errors:** `401 No active session` · `401 invalid/expired refresh token`
---

### 2.7 Complete onboarding 🔒 — `POST /auth/onboard`

Sets favourite genres, optional avatar/bio, and flips `onboarding_completed` to `true`. Idempotence-wise: a user who already completed onboarding gets `400`.

**Body**

```jsonc
{
  "favGenre": ["essays", "design"],  // required, ≥1 item
  "avatar": "data:image/jpeg;base64,…",  // optional
  "bio": "One-liner about you"           // optional
}
```

**Response `201`**

```jsonc
{ "success": true, "data": { "success": true } }
```

**Errors:** `400 At least one genre is required` · `400 User not found` · `400 Onboarding has already been completed`

---

## 3. User domain (`/user`)

### 3.1 Edit profile 🔒 — `PATCH /user/edit-profile`

Partial update — every field is optional (`COALESCE`-based update repels `null`s).

**Body**

```jsonc
{
  "avatar": "data:image/…",   // optional
  "bio": "…",                 // optional
  "favGenre": ["essays"],     // optional
  "handle": "aritra42",       // optional — max once per 6 months
  "website": "https://me.dev" // optional
}
```

**Response `200`** — the full updated user row:

```jsonc
{
  "success": true,
  "data": {
    "id": "…", "name": "…", "email": "…", "handle": "…",
    "avatar": "…", "bio": "…", "fav_genre": ["essays"],
    "onboarding_completed": true,
    "created_at": "2026-09-26T…", "updated_at": "2026-10-28T…"
  }
}
```

**Errors:** `401` · `400 User not found` · `400 You can change your handle only once every 6 months` · `400 Failed to update user profile`

> ⚠️ Known gap: `handle` and `website` are accepted by the API but `handle_changed_at`/`website` columns are not created by any migration — the update will fail at the DB level until a migration is added.

---

## 4. Blog domain (`/blog`) — ⚠️ NOT IMPLEMENTED

`apps/server/src/domains/blog/` exists as a scaffold:

| File | State |
|---|---|
| `blog.model.ts` | ✅ entity defined (`id, userId, title, description, images, created_at, updated_at`) |
| `blog.repository.ts` | ⚠️ partial: `findBlogById`, `findBlogByTitle`, `createNewBlog` implemented; `updateBlog` has a **broken SQL string** (missing `SET`, wrong arity — 4 placeholders, 1 supplied); delete/list/count are stubs |
| `blog.service.ts`, `blog.controller.ts`, `blog.routes.ts` | ❌ empty files — domain is **not mounted** in `routes.ts` |

Planned endpoints (from the PRD): `POST /blogs`, `GET /blogs/:id`, `PATCH /blogs/:id`, `DELETE /blogs/:id`, `GET /users/:handle/blogs`.

---

## 5. System endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/docs` | GET | Swagger UI (served from JSDoc annotations; currently empty spec) |
| `/health` | — | **Not implemented** — recommended addition (see System-Design.md §9) |

Unknown `/api/*` paths return `404` from Express' default handler.

---

## 6. Background jobs

Email delivery runs on the BullMQ `email` queue, processed by a separate worker process (`apps/server/src/worker.ts`, concurrency 10).

| Job name | Payload | Config |
|---|---|---|
| `send-otp` | `{ type: "otp", to: string, code: string }` | 3 attempts, exponential backoff, 5 s initial delay |

Email content: `otp.template.ts` (verification code), `welcome.template.ts` (sent on account creation — currently **never queued**, an integration gap).

---

## 7. Data model reference

Active tables (see `apps/server/src/core/database/migrations/`):

| Table | Key columns | Notes |
|---|---|---|
| `users` | id UUID, name, email UNIQUE, fav_genre TEXT[], avatar, bio, onboarding_completed, handle UNIQUE (partial idx) | passwordless |
| `login_otps` | user_id FK, code_hash, expires_at, revoked_at | one active OTP per user (partial unique index) |
| `refresh_tokens` | user_id FK, token_hash, expires_at, revoked_at | SHA-256 of the JWT |
| `blogs` | user_id FK, title, blog_description, images TEXT[] | created; API not wired yet |

Missing columns referenced in code: `users.handle_changed_at`, `users.website`, `blogs` access via `BlogModel.userId` vs camel/snake mapping inconsistencies.

---

## 8. Client mapping

The React client (`apps/client`) never touches token values — it sends `credentials: "include"` and the server reads the httpOnly cookies. It restores session state via `GET /auth/session`.

| Client function | Endpoint |
|---|---|
| `signUpApi` | `POST /auth/sign-up` |
| `requestOtpApi` | `POST /auth/request-otp` |
| `verifyOtpApi` | `POST /auth/verify-otp` (server sets cookie pair) |
| `sessionApi` | `GET /auth/session` (single-flight boot check) |
| `refreshTokenApi` | `POST /auth/refresh-token` (single-flight rotation) |
| `logoutApi` | `DELETE /auth/logout` (revokes + clears cookies) |
| `onboardApi` | `POST /auth/onboard` (via `fetchWithAuth`) |
| `fetchWithAuth` | any 🔒 endpoint — retries once after refresh on 401 |
| `edit-profile` | `PATCH /user/edit-profile` — **not integrated client-side yet** |
