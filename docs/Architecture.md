# Quill — Architecture

This describes the checked-in implementation, not a proposed production architecture. For request/response contracts, see [API.md](./API.md).

## 1. System overview

Quill is a Bun-workspace monorepo with a React single-page client, an Express API, PostgreSQL, and a separate BullMQ worker process.

```text
Browser
  └── React 19 + Vite client
       └── /api requests with httpOnly cookies
            └── Express 5 API (Bun)
                 ├── PostgreSQL — users, auth state, blogs, follows, bookmarks,
                 │                notifications, and settings
                 ├── local uploads directory — profile avatars (/uploads)
                 └── Redis / BullMQ
                      └── worker — OTP email, scheduled publishing,
                                   notification fan-out
```

In Compose, Nginx serves the client on port 80 and proxies `/api/`, `/docs/`, and `/uploads/` to the server. PostgreSQL is published on host port 5432; Redis, the API, and worker are internal to the Compose network. Compose is a local/self-hosting starting point and does not configure production TLS, backups, external object storage, or observability.

## 2. Components

### Client (`apps/client`)

React 19, TypeScript, React Router 7, Tailwind CSS 4, and Vite. Feature areas include auth/onboarding, blog editor/reader, feed, notifications, profile, and settings. Routes include `/`, `/status`, `/onboarding`, `/feed`, `/profile`, `/profile/edit`, `/write`, `/write/:id`, `/blog/:id`, `/settings`, `/u/:handle` (legacy), and `/:handle` (canonical profile route).

- Auth requests use `credentials: "include"`; JavaScript cannot read the httpOnly cookies.
- Feed, blog, bookmark, follow, notification, profile, settings, and account lifecycle operations use API endpoints.
- The client keeps limited UI state and profile/session cache data in local storage. The feed can show local mock stories if its API request fails; server-backed blog flows use API data.
- Feed search/topic filtering is client-side over loaded content; there is no server search endpoint.
- User markdown is escaped and URL schemes are restricted before rendering.

### API (`apps/server`)

`src/index.ts` configures credentialed CORS, Pino request logging, JSON parsing with a 1 MB limit, cookie parsing, static `/uploads`, Swagger UI, a general API rate limiter, mounted `/api` routers, centralized errors, and graceful shutdown.

Domains:

- `auth`: signup, OTP, session restore, refresh rotation, logout, and onboarding.
- `user`: own/public profiles, profile updates, avatar upload, follow graph, followers, suggestions, settings, and account deletion.
- `blog`: drafts, published feed, Following feed, author feed, bookmarks, scheduling, and writer counts.
- `notification`: list, unread count, read operations, and clear.

Write validation is implemented for auth, onboarding, blog create/update/publish, and settings. `PATCH /user/edit-profile` currently passes its request body to service-level validation rather than the shared Zod parser. PostgreSQL access uses `pg`; migrations live under `src/core/database/migrations` and are applied with `bun run migrate`.

### Shared package (`packages/shared`)

Exports request/response DTOs, settings constants, and shared domain types. It provides compile-time contracts, not runtime validation or a generated API client.

### Worker (`apps/server/src/worker.ts`)

Runs three BullMQ workers in a separate process:

- `email`: sends OTP messages through Resend (concurrency 10).
- `blog-publish`: publishes due scheduled drafts.
- `notification-fanout`: inserts post notifications for followers in batches (concurrency 3).

The worker closes its workers and Redis connection on SIGTERM/SIGINT.

## 3. Key request flows

### Authentication

The client creates an account, requests an OTP, and verifies it. The API stores an OTP hash, enqueues email delivery, consumes the OTP, generates a handle if needed, and issues access/refresh JWT cookies. The access cookie is sent to API routes; the path-scoped refresh cookie is used for session restore, refresh, and logout. On an authenticated request's 401, the client attempts one single-flight refresh and retries.

**Critical development limitation:** OTP generation and verification currently use the fixed value `0000`; this is not production-ready.

### Publishing and notifications

New posts are drafts. Immediate publishing changes the post state and enqueues follower fan-out. Scheduling stores `scheduled_publish_at` and enqueues a delayed job; the worker checks and publishes the due draft, then enqueues fan-out. Notification event keys are unique in PostgreSQL to make retries idempotent.

### User settings and account lifecycle

`GET/PUT /api/user/settings` reads/writes one complete snapshot; the settings row and `users.fav_genre` are stored in PostgreSQL. These preferences are persisted, but the client has not yet wired most of them into feed selection, reader styling, or notification delivery. `DELETE /api/user/account` removes the account in a transaction and relies on foreign-key cascades for related content, sessions, follows, bookmarks, and notifications.

## 4. Data and infrastructure

The checked-in migrations create:

- `users`, onboarding/profile fields, and saved `user_settings`
- `login_otps` and hashed `refresh_tokens`
- `blogs` with draft/published state and scheduled-publish time
- `blog_bookmarks` and `user_follows`
- `notifications` with unique event keys and unread indexes

Redis is used for BullMQ queues; it is not an API response cache. Avatars are written to local disk and served at `/uploads`; Compose shares the server's upload volume, but local filesystem storage is not a scalable or externally durable media solution.

The migration runner tracks applied SQL filenames in a `migrations` table. PostgreSQL's Docker entrypoint applies SQL files only on first initialization of an empty data directory; use the runner for an existing database. The application does not automatically invoke the migration runner at API startup.

## 5. Known gaps

- Fixed OTP `0000` blocks production readiness.
- Saved preference switches are persisted but are not generally applied to feed selection, reading appearance, or notification/email delivery.
- No comments, replies, likes, tags, server-side search, recommendation engine, analytics, or public anonymous read API.
- Swagger UI is mounted, but endpoint annotations are incomplete.
- Compose does not provide production TLS, secret management, backups, external media storage, or monitoring.
