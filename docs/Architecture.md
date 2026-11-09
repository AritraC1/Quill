# Quill — Architecture

This document describes the checked-in implementation as of 2026-11-09. For request and response contracts, see [API.md](./API.md); for product scope and limitations, see [PRD.md](./PRD.md).

## 1. System overview

Quill is a Bun-workspace monorepo. The browser runs a React SPA; the API and BullMQ workers are separate Bun processes. PostgreSQL is the source of truth for application data, and Redis backs the job queues.

```text
Browser
  └── React 19 + Vite SPA
       ├── HTTP /api requests with httpOnly cookies
       └── Socket.IO /socket.io for club chat
            └── Nginx (Compose)
                 └── Express 5 API (Bun)
                      ├── PostgreSQL — accounts, content, settings, clubs
                      ├── local uploads directory — avatars and club images
                      ├── Redis / BullMQ — email, scheduled publishing,
                      │                   notification fan-out
                      └── Socket.IO — authenticated club chat and presence

BullMQ worker (separate process) ── Redis queues ── PostgreSQL / Resend
Python FastAPI service ── /health + recommendations; ranks the For You feed
```

In Docker Compose, Nginx serves the client on port 80 and proxies `/api/`, `/socket.io/`, `/docs/`, `/uploads/`, `/health`, and `/metrics` to the server. Compose also defines PostgreSQL, Redis, Prometheus, Grafana, and the standalone AI service. It is a local/self-hosting starting point, not a hardened production deployment.

## 2. Components

### Client (`apps/client`)

React 19, TypeScript, React Router 7, Tailwind CSS 4, and Vite. Authenticated routes cover onboarding, feeds, profiles, post writing/reading, settings, and clubs. The public `/status` route is a UI placeholder, not a health probe.

- Auth requests include credentials. Browser tokens are httpOnly cookies and are not read by JavaScript. After a 401, the API helper attempts one single-flight session refresh and retry.
- The client uses API-backed profiles, posts, bookmarks, follows, comments, notifications, settings, and club operations. When feed requests fail, local mock stories can be shown as a fallback; server-backed blog and profile flows otherwise require the API.
- Search is sent to the server. It matches published title, description, or content using case-insensitive substring matching; it is not ranked full-text or semantic search. Topic chips filter feed pages already loaded by the client.
- Saved default feed tab, reader text size/theme, and supported notification switches are applied. The published story reader includes text-to-speech and sends periodic authenticated reading-session progress.
- User markdown is escaped and unsafe URL schemes are rejected before render.

### API (`apps/server`)

`src/index.ts` configures credentialed CORS, Pino request logging, JSON parsing with a 1 MB limit, cookie parsing, static `/uploads`, Swagger UI, API rate limiting, mounted `/api` routers, health/metrics endpoints, centralized error handling, and graceful shutdown. PostgreSQL access uses `pg`; SQL migrations are under `src/core/database/migrations`.

Domains:

- `auth`: signup, OTP request/verification, session restore, refresh rotation, logout, and onboarding.
- `user`: own/public profiles, profile updates, avatar upload, follows, followers, suggestions, settings, and account deletion.
- `blog`: drafts, publishing/scheduling, feeds/search, bookmarks, tags, and reading-session progress.
- `comment`: threaded comments, replies, owner edit/delete, and like/heart comment reactions.
- `club`: club membership, applications, invitations, submissions/reviews, conversations, messages, and version-checked shared drafts.
- `notification`: in-app event creation, listing, unread counts, and read/clear operations.

Zod request-body validation is used on auth, onboarding, blog writes, comments, and settings. Profile edits also have service-level validation. Swagger is mounted at `/docs`, but endpoint annotations are incomplete. `/health` and `/api/health` check PostgreSQL and Redis; `/metrics` and `/api/metrics` expose Prometheus metrics.

### Realtime club chat

Socket.IO shares the API HTTP server and uses the `/club-chat` namespace. Handshake authentication accepts the access cookie or a Bearer token; joining a room goes through club membership checks. Persisted text messages are broadcast to room members, and presence/typing events are realtime. Chat history and multipart image sends use REST; REST image sends also broadcast the persisted message. Realtime functionality is specific to club chat; regular notification lists are HTTP-backed.

### Background worker (`apps/server/src/worker.ts`)

The worker process runs three BullMQ workers:

- `email`: OTP messages, opted-in follower email, and weekly reading digests (Mondays at 09:00 UTC).
- `blog-publish`: publishes due scheduled drafts and initiates notification fan-out.
- `notification-fanout`: inserts post notifications for followers in batches.

Email and scheduled jobs use retries/backoff. Notification event keys and digest job IDs support idempotency. The worker reports job telemetry and closes its workers and Redis connection on SIGTERM/SIGINT.

### Shared package and AI service

`packages/shared` exports compile-time DTOs and constants for auth, users, settings, blogs, comments, clubs/chat, and notifications. It is not a runtime validator or generated API client.

`services/ai` is a separate Python FastAPI app in the Compose topology. Its
`/recommendations/{userId}` endpoint ranks the authenticated For You feed:
`apps/server/src/domains/blog/recommender.client.ts` calls it with a 2-second
timeout, and any failure falls back to the regular database feed. The service
trains on stored reading-session, bookmark, and comment signals; seeing
recommendations therefore depends on generated artifacts being available, and
the feed degrades gracefully without them.

## 3. Key request and data flows

### Authentication

Signup creates the account; OTP request queues email; verification consumes an active OTP, generates a handle if needed, and issues access/refresh JWT cookies. The refresh cookie is path-scoped to `/api/auth`; the client can restore its session with `/auth/session`. Refresh tokens are stored as hashes and rotated. Logout can revoke the current device or all sessions.

> **Critical development limitation:** OTP issuance and verification currently use the fixed value `0000`. Do not expose this authentication behavior in production.

### Writing, publication, and reading

New posts are drafts. Authors can edit and publish immediately or schedule a future publication (the queue delay ceiling limits scheduling to 24 days). The worker verifies a due draft before publishing and enqueues follower notification fan-out. PostgreSQL stores posts, topic genres, bookmarks, and reading-session progress.

The For You API is ranked by the recommender service when it responds within
its 2-second timeout, and otherwise falls back to a database feed that applies
saved genres to tagged posts while retaining untagged legacy posts. The
Following feed is based on the follow graph. Server-side search filters
published posts by case-insensitive substring match in title, description, and
content. Topic chips additionally filter only feed pages already loaded in the
client.

The authenticated reader periodically sends active seconds and maximum scroll depth for a visit. The server stores maximum reported values to avoid double-counting retried progress and marks a session complete at 90% scroll depth. This completion value is a proxy, not proof of reading.

### Comments and clubs

Comments belong to published posts. Replies are constrained to the same post and displayed as two-level threads; replying to a reply attaches to its top-level ancestor. Owner deletions are soft deletions so replies remain visible. Reaction rows are unique per comment, user, and reaction type.

Club routes enforce authentication and service-level membership/role checks. They support club membership and governance, invitation/application flows, post submissions and review, group/direct conversations, and collaborator access to club drafts. Collaborative draft saves use versions to detect conflicts; this is not live simultaneous editing. Chat messages persist via the club service, with Socket.IO room broadcasts for live messages and presence.

### Notifications and preferences

In-app notification records cover follows, new posts, scheduled publications, comment replies, and club invitations/reviews. New-post events fan out through BullMQ; unique event keys make inserts retry-safe. The client loads the notification list and polls unread count over HTTP.

Settings are stored as a snapshot in PostgreSQL. Saved genres influence the For You feed; default feed tab and reader appearance are applied by the client. In-app notification preferences gate supported event types; email preferences gate follower emails and the weekly digest. Product-news email remains unavailable until a newsletter source exists.

### Account deletion and avatars

Account deletion removes the user in a transaction and relies on foreign-key cascades for dependent account data. Avatars are validated as JPEG, PNG, or WebP (up to 5 MB), stored on local disk, and served from `/uploads`. Compose mounts a volume for uploads, but this is not external/object storage.

## 4. Data and infrastructure

Migrations `001`–`017` create and extend user/auth tables, profiles/settings, blogs and scheduling, follows/bookmarks, notifications, comments/reactions, clubs/chat/collaborators, reading sessions, and post genres/notification event keys. The migration runner records applied SQL filenames. PostgreSQL's Docker entrypoint runs mounted SQL only for a newly initialized data directory; use `bun run migrate` for an existing database. The API does not automatically run migrations at startup.

Redis is the BullMQ backend, not an API response cache. Compose publishes the client, PostgreSQL, Prometheus, and Grafana ports; API, worker, Redis, and AI service are on the internal network. The AI service is additionally bound to localhost on the host. Compose includes Prometheus/Grafana and persistent volumes but does not configure TLS, production secrets, backups, or external media storage.

## 5. Known limitations

- The fixed OTP `0000` is a production blocker.
- Avatar storage is local disk; uploads, database, and Redis require an operator-managed persistence and backup plan.
- There is no post-like action, ranked full-text/semantic search, analytics pipeline, moderation/reporting system, or product-news subscriber source. The recommender is a research baseline: its committed artifacts are trained on synthetic data and there is no impression log, so recommendations are confidence-limited.
- Feed topic chips apply only to loaded pages; general notifications do not use a realtime transport.
- The Python AI service ranks the For You feed behind a fallback; it is not otherwise integrated (no impression log, no online learning, and artifacts are excluded from the Docker image).
- Swagger route annotations are incomplete; `/status` is not a server health endpoint.
- Compose is a development/self-hosting baseline, not a production security or operations configuration.

---