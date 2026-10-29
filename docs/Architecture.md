# Quill — Architecture

This document describes the code that exists today. Product and infrastructure ideas that are not implemented are called out as future work rather than represented as running services.

## 1. System overview

Quill is a Bun-workspace monorepo with a React single-page client and an Express API. The API implements signup, email OTP authentication, session cookies, onboarding, profile publishing (handle, avatar, genres), drafts/published blogs with a server-backed feed, bookmarks, scheduled publishing through BullMQ, and a follow graph. The client renders real API data; local mock stories remain only as an offline fallback for the feed.

```text
Browser
  └── React 19 + Vite client
       └── /api requests (httpOnly cookies)
            └── Express 5 API
                 ├── PostgreSQL 16 — users, OTPs, refresh-token hashes, blogs, bookmarks, follows
                 ├── uploads/ on disk — avatar files, served statically at /uploads
                 └── Redis 7 — BullMQ queues (email, blog-publish)
                      └── separate Bun worker — OTP email + scheduled blog publishing
```

In the Docker Compose setup, Nginx serves the client on host port 80 and proxies `/api/`, `/docs/`, and `/uploads/` to the server. PostgreSQL and Redis are on the Compose network; the server and worker are not published as host ports. This is a local/self-hosted Compose topology, not evidence of a configured production deployment.

## 2. Repository and runtime components

### Client (`apps/client`)

React 19, TypeScript, React Router, Tailwind CSS v4, and Vite. Routes include the landing page, onboarding, feed, own profile (canonical Twitter-style `/:handle`, with `/profile` and `/u/:handle` forwarding), profile editing, and the write/blog pages.

- Authentication operations call the server and use `credentials: "include"`; JavaScript does not read the auth cookies.
- Feed stories and bookmarks come from the API (`GET /blogs`, bookmark endpoints); avatars upload as files (`POST /user/avatar`) instead of base64 blobs. Local story mocks appear only when the API is unreachable.
- Visitor profiles fetch real data (`GET /user/:handle`, `GET /blogs?author=<handle>`) and the follow button uses the follow API; the Following sidebar reads `GET /user/following`.
- `GET /user/me` responses are cached for 10 seconds in the client, and `clearMeCache()` runs on logout together with a wipe of all identity-related localStorage keys.
- The markdown renderer escapes all user content before applying inline formatting and only allows `http(s)`, `mailto`, relative and hash URLs — stored `<script>` payloads cannot execute.

### API (`apps/server`)

Bun runs Express 5 with TypeScript. `src/index.ts` configures credentialed CORS, request logging, JSON parsing (1 MB cap), cookie parsing, static `/uploads`, Swagger UI, rate limiting (300 req/min API-wide; tighter 20-per-10-min limit on auth endpoints), `/api` routes, and centralized error handling, followed by graceful shutdown on SIGTERM/SIGINT (drain connections, close the DB pool). The routes are grouped into:

- `domains/auth`: signup, OTP request/verification, refresh, session, logout, and protected onboarding.
- `domains/user`: `/user/me`, public profiles by handle, follow/unfollow, the following list, avatar upload (multer → disk), and protected profile update.
- `domains/blog`: full draft/publish/bookmark/schedule endpoints (see [API.md](./API.md)).

The server uses controller/service/repository classes in these domains. Request bodies on write endpoints are validated with zod (`core/validation/validation.ts`). PostgreSQL access is through `pg` and a connection pool. Migrations are applied by `bun run migrate` (`src/scripts/migrate.ts`). Redis is used by BullMQ for the email and blog-publish jobs; there is no Redis response cache.

### Shared package (`packages/shared`)

Exports TypeScript request/response DTOs shared by client and server. It is not a generated runtime validation or API client package.

### Email worker

`src/worker.ts` starts BullMQ workers for the `email` and `blog-publish` queues. `send-otp` delivers the verification code through Resend; `blog-publish` flips scheduled drafts live at their due time. Queue configuration specifies three attempts with exponential backoff; email jobs run up to ten concurrently. The worker process shuts down cleanly (worker `close()` + Redis `quit()`).

## 3. Implemented request flows

### Signup and login

1. The client posts a name and email to `POST /api/auth/sign-up`.
2. The API creates a `users` row in PostgreSQL.
3. The client requests an OTP; the API stores a bcrypt hash and enqueues the email job in Redis.
4. The user verifies the OTP. The API consumes the active OTP, creates a unique handle on first login, and issues access and refresh JWTs as httpOnly cookies.
5. On startup, the client checks `GET /api/auth/session`. Authenticated requests attach cookies; the client retries once after a 401 by calling the refresh endpoint.

**Important development limitation:** OTP generation is currently hard-coded to `0000`, and verification accepts `0000` as a bypass. Do not treat this auth flow as production-ready until that behavior is removed and tested.

### Onboarding

The protected `POST /api/auth/onboard` endpoint stores `fav_genre`, optional avatar and bio, and marks onboarding complete. The client requires at least one selected genre but does not block navigation when the API call fails, so local completion is not proof of server persistence.

### Reading and profiles

The feed is server-backed (`GET /blogs?page&limit`) with real pagination; bookmarks persist in `blog_bookmarks`. Profile pages read real data — own profiles from `/user/me` + writer stats, visitors from `GET /user/:handle` + `GET /blogs?author=<handle>` — and the follow button writes through the follow API. Search and topic filtering operate over the loaded feed client-side.

The profile edit form persists through `PATCH /api/user/edit-profile` (including the display name), and avatars upload via `POST /api/user/avatar` (multer → disk, URL stored in the DB, served from `/uploads`).

## 4. Data and infrastructure

The checked-in migrations create:

- `users`: name, email, onboarding fields, handle, website, handle-lock timestamp.
- `login_otps`: OTP hashes, expiry and revocation timestamps.
- `refresh_tokens`: hashes of refresh JWTs, expiry and revocation timestamps.
- `blogs`: title, description, images, markdown `content`, `status` (draft/published), `published_at`, `scheduled_publish_at`.
- `blog_bookmarks`: viewer ↔ blog unique pairs.
- `user_follows`: follower ↔ following unique pairs (no self-follow).

Handle changes are reserved-word checked and unique; unknown-email OTP responses are intentionally indistinguishable from wrong-OTP responses (enumeration defense).

Docker Compose defines PostgreSQL (migrations mounted as init scripts), Redis, API, worker, and Nginx/client services. The client Nginx configuration provides SPA fallback and proxies `/api/`, `/docs/`, and `/uploads/`; uploads live in the shared `uploads_data` volume. GitHub Actions CI (`.github/workflows/ci.yml`) runs strict root typecheck, `bun test`, and the client build. TLS termination, a public CDN, object storage, backups, deployment, and production monitoring are not configured by the checked-in Compose file.

## 5. Future architecture (not implemented)

Comments, tags/likes notifications, image hosting for blog bodies, recommendation jobs, cache usage, and production deployment controls remain future work. Keep these out of the description of current runtime behavior until they are implemented and verified.
