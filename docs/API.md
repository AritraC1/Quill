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
| 500 | Unexpected error, including database/configuration failures |

There is no general request-schema validation middleware; the endpoint behavior below reflects the checks currently present in service code.

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

### `PATCH /user/edit-profile` — authenticated

The server accepts `avatar`, `bio`, `favGenre`, `handle`, and `website`, and returns the updated database row on success. The endpoint does not update `name`.

**Intended request shape**

```json
{
  "avatar": "data:image/jpeg;base64,...",
  "bio": "A short introduction",
  "favGenre": ["essays"],
  "handle": "aritra42",
  "website": "https://example.com"
}
```

Fields are applied with `COALESCE`, so omitted or `null` values leave stored values unchanged. The TypeScript DTO marks `favGenre` as required, though the repository can accept an omitted value at runtime.

**Current blocker:** the SQL query references `users.website`, which is not created by any checked-in migration, so the update currently fails at the database. The handle-change service also references `users.handle_changed_at`, which is not migrated; the six-month policy is therefore not enforced by the current schema. The client edit form does not call this endpoint and stores edits in `localStorage`.

## 4. Blog scaffold — no HTTP endpoints

`blogs` is the only content-related table created by the migrations. It has `id`, `user_id`, `title`, `blog_description`, `images`, `created_at`, and `updated_at`.

The blog repository has partial lookup/create methods. Its update SQL is incomplete, and delete/list/count methods are absent. Blog service/controller/routes are not implemented or mounted. There are no post, feed, comment, tag, follow, like, bookmark, or public-profile API routes.

## 5. System and documentation routes

| Path | Method | Description |
|---|---|---|
| `/docs` | GET | Swagger UI; route files currently have no endpoint annotations |
| `/health` | — | Not implemented |

The API router is mounted at `/api`; only `/auth/*` and `/user/edit-profile` are currently mounted.

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

No migration currently creates `users.website` or `users.handle_changed_at`.

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
| `fetchWithAuth` | Shared cookie-auth helper; retries once after a 401 by refreshing |

The profile update UI has no API integration. No client calls exist for blog, post, feed, follow, comment, like, bookmark, or search APIs.
