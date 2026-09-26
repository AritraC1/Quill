# Quill — Backend

## Overview

Quill's backend is an Express + TypeScript API, structured with OOP principles and organized by **domain** rather than by technical layer. Each domain owns its full stack — controller, service, repository, and entity — making the codebase easy to extend one feature at a time.

## Tech Stack

- Express + TypeScript
- PostgreSQL (primary datastore)
- Redis (cache + BullMQ queue backend)
- BullMQ (background job processing)
- Bun (runtime + package manager)
- Message broker (future — reserved for pub/sub once services are split apart)

## Folder Structure

```
apps/server/src/
├── domains/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.middleware.ts      (JWT verify, role guard)
│   │   └── auth.types.ts
│   │
│   ├── users/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.entity.ts
│   │   ├── user.routes.ts
│   │   └── user.types.ts
│   │
│   ├── posts/
│   │   ├── post.controller.ts
│   │   ├── post.service.ts
│   │   ├── post.repository.ts
│   │   ├── post.entity.ts
│   │   ├── post.routes.ts
│   │   └── post.types.ts
│   │
│   ├── comments/
│   │   ├── comment.controller.ts
│   │   ├── comment.service.ts
│   │   ├── comment.repository.ts
│   │   ├── comment.entity.ts
│   │   └── comment.routes.ts
│   │
│   ├── tags/
│   │   ├── tag.controller.ts
│   │   ├── tag.service.ts
│   │   ├── tag.repository.ts
│   │   └── tag.routes.ts
│   │
│   ├── follows/
│   │   ├── follow.controller.ts
│   │   ├── follow.service.ts
│   │   ├── follow.repository.ts
│   │   └── follow.routes.ts
│   │
│   ├── feed/                        (Following + For You tabs)
│   │   ├── feed.controller.ts
│   │   ├── feed.service.ts          (recommendation logic)
│   │   ├── feed.repository.ts
│   │   └── feed.routes.ts
│   │
│   └── notifications/
│       ├── notification.controller.ts
│       ├── notification.service.ts
│       └── notification.routes.ts
│
├── jobs/                             (BullMQ job definitions)
│   ├── email.job.ts
│   ├── image-resize.job.ts
│   ├── feed-recompute.job.ts
│   └── queues.ts                     (queue instances/registry)
│
├── core/                             (cross-cutting, not domain-specific)
│   ├── database/
│   │   ├── postgres.ts
│   │   ├── redis.ts
│   │   └── migrations/
│   ├── errors/
│   │   ├── app-error.ts
│   │   └── error-handler.middleware.ts
│   ├── config/
│   │   └── env.ts
│   └── logger/
│       └── logger.ts
│
├── routes/
│   └── index.ts                      (mounts all domain routes)
│
├── index.ts                          (Express app entry point)
└── worker.ts                         (BullMQ worker process entry point)
```

## Design Principles

- **Domain-per-folder:** each domain is self-contained. Controller (HTTP layer) → Service (business logic, OOP classes) → Repository (DB queries) → Entity (domain model). Adding a feature means adding one new folder, not touching five scattered ones.
- **Worker is a separate process from the API** (`worker.ts` vs `index.ts`) — background jobs never block request handling, and each can scale/restart independently.
- **`core/`** holds nothing domain-specific — just infrastructure plumbing (DB clients, error handling, config, logging) shared across all domains.

## Data Model (core entities)

- `users` — id, email, password_hash, display_name, role, profile_complete
- `posts` — id, title, slug, content, author_id, status (draft/published), published_at
- `comments` — id, post_id, author_id, parent_comment_id (nullable, for threading), content
- `tags` / `post_tags` — categories and their many-to-many join to posts
- `follows` — follower_id, followed_id
- `reading_history` — user_id, post_id, read_at, time_spent
- `user_tag_affinity` — user_id, tag_id, affinity_score (recomputed nightly)
- `likes`, `bookmarks` — user_id, post_id (or comment_id)

## Background Jobs (BullMQ)

Run in `worker.ts`, backed by Redis:

| Job | Trigger |
|---|---|
| Welcome email | User signup |
| Password reset email | User request |
| Comment notification | New comment on followed post |
| Image resize/optimize | Image upload |
| Feed tag-affinity recompute | Nightly (scheduled) |
| Weekly digest email | Scheduled (repeatable job) |

All jobs get automatic retry with backoff on failure.

## Feed Recommendation Logic (`feed` domain)

- **Following tab:** direct query — posts from followed authors, newest first
- **For You tab:**
  - Cold start: genres selected at onboarding seed initial tag affinity
  - `feed-recompute.job.ts` nightly job derives top tags per user from `reading_history`
  - Results stored in `user_tag_affinity`, cached in Redis per user
  - `feed.service.ts` serves from cache; falls back to on-demand query on cache miss

## Security

- Password hashing via bcrypt/argon2
- JWT-based auth (short-lived access token + refresh token)
- Role-based access control (admin/editor/reader) enforced in `auth.middleware.ts`
- Input validation/sanitization on all write endpoints (XSS prevention)
- Rate limiting on auth and comment endpoints
- Postgres/Redis reachable only on the internal Docker network — never exposed publicly

## Local Development

```bash
docker compose up server worker postgres redis
```

Runs the Express API (port `4000`) with hot reload, the BullMQ worker process, Postgres (`5432`), and Redis (`6379`).

---