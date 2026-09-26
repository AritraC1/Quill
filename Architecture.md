# Quill — Architecture

## 1. High-Level Overview

Quill is a monolithic-but-modular application: a single Express API and a single React client, organized internally by domain, backed by Postgres and Redis, with background work handled by BullMQ. A message broker is reserved for a future stage where services are split apart.

```
Client (React) → Reverse Proxy (Caddy, HTTPS) → Express API
                                                      │
                            ┌─────────────────────────┼─────────────────────────┐
                            ▼                          ▼                         ▼
                        PostgreSQL                  Redis                Message broker
                     (primary data)         (cache + BullMQ queue)         (future, pub/sub)
                                                      │
                                                      ▼
                                              BullMQ workers
                                             (background jobs)
```

All of the above runs inside Docker containers on a single VPS at current scale (see `System-Design.md` for sizing and scaling triggers).

## 2. Components

### Client (`apps/client`)
React + TypeScript + Tailwind, built with Vite. Structured by **feature domain**, not by file type:

```
apps/client/src/
├── features/       → posts, comments, feed, follows, auth, profile, notifications
├── pages/          → route-level compositions (LandingPage, HomePage, PostPage, etc.)
├── components/     → shared, generic UI (Button, Modal, Avatar)
├── lib/            → api client, query client, utils
├── routes/         → router.tsx (path → page mapping), ProtectedRoute
└── store/          → global state (auth, etc.)
```

Each feature folder owns its own components, hooks, and API calls — mirroring the server's domain split one-to-one, so `features/posts` on the client maps directly to `domains/posts` on the server.

### Server (`apps/server`)
Express + TypeScript, OOP, structured by domain:

```
apps/server/src/
├── domains/        → auth, users, posts, comments, tags, follows, feed, notifications
│   └── each domain: controller → service → repository → entity → routes
├── jobs/           → BullMQ job definitions (email, image-resize, feed-recompute)
├── core/           → database clients, error handling, config, logging
├── routes/         → mounts all domain routes
├── index.ts        → Express app entry point
└── worker.ts       → BullMQ worker process entry point
```

Each domain is self-contained: **controller** (HTTP layer) → **service** (business logic, OOP classes) → **repository** (DB queries) → **entity** (domain model). Adding a feature means adding one folder, not touching five scattered ones.

### Shared package (`packages/shared`)
TypeScript interfaces used by both client and server (`Post`, `User`, `Comment`, etc.), linked via Bun workspaces (`workspace:*`) — no publishing, no version drift, edit once and both apps see it.

### PostgreSQL
Primary datastore — users, posts, comments, tags, follows, reading history.

### Redis
Two roles:
- **Cache** — hot post pages, session data, computed "For You" feed results
- **Queue backend** — BullMQ's underlying storage for jobs and their state

### BullMQ workers
A separate process (`worker.ts`) from the API, so background work never blocks request handling and can scale/restart independently. Current jobs:
- Transactional emails (welcome, password reset, comment notifications)
- Image resizing/optimization on upload
- Nightly recomputation of per-user tag affinity for the "For You" feed

### Message broker (future)
Not active yet. Reserved for the point where Quill splits into independent services (e.g. `auth-service`, `post-service`, `notification-service`) that need to publish/subscribe to events rather than call each other directly.

## 3. Request Flow (example: viewing a post)

1. Client requests `/posts/:slug`
2. Reverse proxy forwards to Express API
3. `posts.controller` receives the request, delegates to `posts.service`
4. `posts.service` checks Redis cache first; on miss, queries Postgres via `posts.repository`
5. Response cached in Redis with a short TTL, returned to client
6. Async, non-blocking: a "record view" event enqueues a BullMQ job to update `reading_history` (used later by the feed recommendation job)

## 4. Feed Personalization Flow

1. User reads posts → `reading_history` table grows (`user_id`, `post_id`, `read_at`)
2. Nightly BullMQ job recomputes each user's top tag affinities from their reading history
3. Results stored in a `user_tag_affinity` table, and the computed "For You" feed is cached in Redis per user
4. On new-user onboarding (no reading history yet), the genres picked during onboarding seed the initial affinity — solving the cold-start problem
5. "Following" tab is a simpler direct query: posts from followed authors, no precomputation needed

## 5. Deployment Architecture

- Single Hostinger VPS running all services via Docker Compose (`docker-compose.prod.yml`)
- Caddy as reverse proxy — auto HTTPS, serves the client's static build, proxies `/api` to Express
- Cloudflare in front for CDN + DDoS protection
- Images offloaded to object storage (S3/R2/B2) rather than local disk
- Automated Postgres backups (pg_dump → off-site storage)
- GitHub Actions for CI/CD — build, push, deploy on merge to main

See `System-Design.md` for the reasoning behind these choices and when to scale beyond a single VPS.

---