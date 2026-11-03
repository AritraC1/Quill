# Quill Server

The backend is an Express 5 + TypeScript API running on Bun, with PostgreSQL for application data and Redis/BullMQ for asynchronous work.

## Stack

| Concern | Implementation |
|---|---|
| Runtime | Bun |
| HTTP | Express 5 |
| Database | PostgreSQL via `pg` Pool |
| Queues | Redis + BullMQ |
| Authentication | `jose` JWTs, httpOnly cookies, rotating refresh tokens stored as hashes |
| Validation | Zod on auth, onboarding, blog writes, and settings |
| Logging | Pino + pino-http |
| Email | Resend |
| API UI | Swagger UI at `/docs` (endpoint annotations are incomplete) |

## Local development

From the repository root, configure `.env` with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (at least 32 characters), `RESEND_API_KEY` (starts with `re_`), and optional `CLIENT_URL`, `PORT`, `EMAIL_FROM`, and JWT expiry values.

```bash
bun install
bun run migrate
bun run dev:server
```

Run the API worker separately:

```bash
bun run dev:worker
```

The API listens on port 3000 by default. Local PostgreSQL and Redis must be available, or start them with `docker compose up postgres redis`.

## Commands

| Root command | Description |
|---|---|
| `bun run dev:server` | API with Bun watch mode |
| `bun run dev:worker` | OTP/follower/digest email, scheduled-publish, and notification-fanout workers |
| `bun run migrate` | Apply pending SQL migrations |
| `bun run test:server` | Run server tests |

## Server areas

```text
src/
├── index.ts                    Express app, middleware, routes, shutdown
├── worker.ts                   BullMQ worker entry point
├── routes/routes.ts            Mounts auth, user, blog, notification routers
├── core/
│   ├── config/                 Env, cookies, database, Redis, Swagger
│   ├── database/               PostgreSQL pool and migrations 001–012
│   ├── email/                  Resend client and OTP templates
│   ├── errors/                 Application errors and error middleware
│   ├── logger/                 Pino logger and request logging
│   └── validation/             Zod body schemas
├── domains/
│   ├── auth/                   Signup, OTP, session, refresh, onboarding
│   ├── user/                   Profiles, follows, settings, account lifecycle
│   ├── blog/                   Drafts, topic tags, feeds, bookmarks, scheduling
│   └── notification/           In-app events and weekly email digests
├── jobs/                       Email, scheduled publish, and notification fan-out
└── scripts/migrate.ts          Migration runner
```

## API areas

All API routes are under `/api`; authenticated endpoints use the access cookie or an `Authorization: Bearer <access-token>` header.

| Area | Routes include |
|---|---|
| Auth | `/auth/sign-up`, `/auth/request-otp`, `/auth/verify-otp`, `/auth/session`, `/auth/refresh-token`, `/auth/logout`, `/auth/onboard` |
| User | `/user/me`, `/user/edit-profile`, `/user/avatar`, `/user/:handle`, follows/followers/suggestions, `/user/settings`, `/user/account` |
| Blog | `/blogs`, `/blogs/following`, drafts, published posts, bookmarks, publish/schedule |
| Notifications | `/notifications`, unread count, read/read-all, clear |

See the [complete API reference](../../docs/API.md) for request shapes and response details.

## Migrations

SQL migrations `001`–`017` are under `src/core/database/migrations/`. Run `bun run migrate` to apply pending files; the runner records applied filenames in a `migrations` table. Docker Compose also mounts migration SQL into PostgreSQL's initialization directory, which is processed only for a newly initialized data volume. The API does not run migrations automatically at startup.

## Security and operational limitations

- **Not production-ready:** OTP issuance and verification currently use the fixed value `0000`.
- In-process IP rate limits: 300 requests/minute on `/api`; 20 failed signup/OTP attempts per 10 minutes on the auth routes.
- Access and refresh cookies are httpOnly, `SameSite=Lax`, and `Secure` in production.
- JSON request bodies are capped at 1 MB; avatar uploads allow JPEG/PNG/WebP up to 5 MB.
- Avatars are stored on local disk (`uploads/`), not object storage.
- Saved genres filter tagged posts in the For You feed (untagged posts remain as fallback); saved reader appearance and in-app notification switches are applied.
- The worker sends opted-in follower emails and a weekly digest on Mondays at 09:00 UTC. Product-news email is disabled until a newsletter source exists.
- There is no `/health` endpoint; `/status` is a client placeholder. Swagger is mounted, but API annotations are incomplete.
- The Compose deployment does not configure TLS, managed secrets, backup/restore, monitoring, or production alerting.
