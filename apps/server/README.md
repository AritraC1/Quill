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
| Validation | Zod on auth, onboarding, blog writes, comments, and settings |
| Logging | Pino + pino-http |
| Email | Resend |
| Realtime | Socket.IO namespace `/club-chat` for club chat events and presence |
| Recommender client | `domains/blog/recommender.client.ts` calls the FastAPI service in `services/ai` (2 s timeout) to rank the For You feed; any failure falls back to the database feed |
| Observability | Prometheus metrics, health checks, and optional Sentry |
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

Set `AI_SERVICE_URL` to point the recommender client at the FastAPI service (Compose defaults it to `http://ai-service:8000`; locally the default is `http://localhost:8000`).

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
├── routes/routes.ts            Mounts auth, user, blog, comment, club,
│                               and notification routers
├── core/
│   ├── config/                 Env, cookies, database, Redis, Swagger
│   ├── database/               PostgreSQL pool and migrations 001–017
│   ├── email/                  Resend client and OTP templates
│   ├── errors/                 Application errors and error middleware
│   ├── logger/                 Pino logger and request logging
│   └── validation/             Zod body schemas
├── domains/
│   ├── auth/                   Signup, OTP, session, refresh, onboarding
│   ├── user/                   Profiles, follows, settings, account lifecycle
│   ├── blog/                   Drafts, topic tags, feeds, bookmarks, scheduling,
│   │                           and reading-session progress
│   ├── comment/                Threaded comments, replies, and reactions
│   ├── club/                   Membership, applications, invitations, reviews,
│   │                           chat, and version-checked shared drafts
│   └── notification/           In-app events and notification preferences
├── jobs/                       Email, scheduled publish, and notification fan-out
└── scripts/migrate.ts          Migration runner
```

## API areas

All API routes are under `/api`; authenticated endpoints use the access cookie or an `Authorization: Bearer <access-token>` header.

| Area | Routes include |
|---|---|
| Auth | `/auth/sign-up`, `/auth/request-otp`, `/auth/verify-otp`, `/auth/session`, `/auth/refresh-token`, `/auth/logout`, `/auth/onboard` |
| User | `/user/me`, `/user/edit-profile`, `/user/avatar`, `/user/:handle`, follows/followers/suggestions, `/user/settings`, `/user/account` |
| Blog | `/blogs` feed/search/author, `/blogs/following`, drafts, published posts, bookmarks, publish/schedule, `/blogs/:id/reading-session` |
| Comments | `/blogs/:blogId/comments`, `/comments/:commentId` and reactions |
| Clubs | `/clubs` membership, applications, invitations, submissions/reviews, conversations/messages, shared drafts |
| Notifications | `/notifications`, unread count, read/read-all, clear |

See the [complete API reference](../../docs/API.md) for request shapes and response details.

Health and metrics are exposed at `/health`, `/api/health`, `/metrics`, and `/api/metrics`. Prometheus scrapes the server in Compose; Sentry is optional and configured by DSN.

## Migrations

SQL migrations `001`–`017` are under `src/core/database/migrations/`, covering identity, posts, follows, notifications/settings, comments, clubs/chat, reading sessions, and genres/notification events. Run `bun run migrate` to apply pending files; the runner records applied filenames in a `migrations` table. Docker Compose also mounts migration SQL into PostgreSQL's initialization directory, which is processed only for a newly initialized data volume. The API does not run migrations automatically at startup.

## Security and operational limitations

- **Not production-ready:** OTP issuance and verification currently use the fixed value `0000`.
- In-process IP rate limits: 300 requests/minute on `/api`; 20 failed signup/OTP attempts per 10 minutes on the auth routes.
- Access and refresh cookies are httpOnly, `SameSite=Lax`, and `Secure` in production.
- JSON request bodies are capped at 1 MB; avatar uploads allow JPEG/PNG/WebP up to 5 MB.
- Avatars are stored on local disk (`uploads/`), not object storage.
- Saved genres filter the fallback For You feed (untagged posts remain as fallback); the authenticated For You feed is ranked by the recommender service when it responds within the 2-second timeout. Saved reader appearance and in-app notification switches are applied.
- The worker sends opted-in follower emails and a weekly digest on Mondays at 09:00 UTC. Product-news email is disabled until a newsletter source exists.
- `/status` is a client placeholder; use the API health endpoints. Swagger is mounted, but API annotations are incomplete.
- Compose includes Prometheus/Grafana, metrics, and optional Sentry integration, but does not configure TLS, managed secrets, backup/restore, or production alerting.
- Club chat is the realtime Socket.IO feature; regular notification lists are loaded through HTTP and are not a general realtime notification stream.

---