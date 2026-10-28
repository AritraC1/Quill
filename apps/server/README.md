# Quill Server

The Quill backend — an Express 5 + TypeScript REST API, OOP-styled and organised by **domain** (controller → service → repository → model), running on Bun with PostgreSQL, Redis, and BullMQ for background email jobs.

## Stack

| Concern | Choice |
|---|---|
| Runtime / package manager | Bun |
| HTTP framework | Express 5 |
| Language | TypeScript (strict, ESM) |
| Database | PostgreSQL 16 via `pg` Pool |
| Cache / queue | Redis 7 (ioredis) + BullMQ |
| Auth | `jose` JWTs (HS256) — passwordless (emailed OTP), rotating refresh tokens stored hashed |
| Validation | Zod (`core/config/env.ts` validates all env vars at boot) |
| Logging | pino + pino-http (request logging with request-IDs) |
| Email | Resend |
| Docs | Swagger UI at `/docs` (spec scaffolded; route annotations pending — see [API reference](../../docs/API.md)) |

## Getting Started

```bash
# from repo root
bun install
cp .env.example .env        # DATABASE_URL, REDIS_URL, JWT_SECRET (≥32 chars), RESEND_API_KEY
bun run dev:server          # http://localhost:3000
bun run dev:worker          # separate process, processes the BullMQ "email" queue
```

Docker Compose boots postgres + redis + server + worker together, and applies `src/core/database/migrations/*.sql` automatically on first postgres boot.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | API server with watch mode |
| `bun run dev:worker` | BullMQ worker with watch mode |
| `bun run test` (root) | Bun test runner (`auth.service.test.ts`) |

## Structure

```
apps/server/src/
├── index.ts                  express app — cors, request logger, /docs, /api, error handler
├── worker.ts                 BullMQ worker entry (separate process from the API)
├── routes/routes.ts          mounts every domain router under /api
├── domains/
│   ├── auth/
│   │   ├── auth.controller.ts     HTTP layer (try/catch → next(error))
│   │   ├── auth.service.ts        sign-up, OTP issue/verify, handle generation, token rotation
│   │   ├── auth.middleware.ts     requireAuth — verifies Bearer access token
│   │   ├── auth.routes.ts         /sign-up, /request-otp, /verify-otp, /refresh-token, /logout, /onboard
│   │   ├── auth.service.test.ts   Bun tests (validation, duplicate email, handle generation)
│   │   ├── onboarding.controller.ts / onboarding.service.ts   genre/bio/avatar completion
│   │   ├── token.service.ts       JWT sign/verify, refresh-token hash + DB lifecycle
│   │   ├── token.repository.ts    refresh_tokens CRUD
│   │   ├── otp.repository.ts      login_otps CRUD (issue, revoke, find-active)
│   │   └── *.model.ts             OtpModel, RefreshTokenModel
│   ├── user/
│   │   ├── user.controller.ts     PATCH /user/edit-profile
│   │   ├── user.service.ts        profile update rules (handle locked 6 months)
│   │   ├── user.repository.ts     users table queries
│   │   └── user.model.ts          UserModel
│   └── blog/
│   │   ├── blog.controller.ts     HTTP layer (POST/PATCH/DELETE/publish/bookmark handlers)
│   │   ├── blog.service.ts        draft rules, ownership + publish validation, DTO mapping
│   │   ├── blog.repository.ts     blogs + blog_bookmarks queries (CRUD, counts, lists)
│   │   ├── blog.routes.ts         /blogs CRUD + /:id/publish + /:id/bookmark
│   │   └── blog.model.ts          BlogModel, BlogWithAuthorModel
├── jobs/
│   ├── queue.ts                   emailQueue (BullMQ "email" queue)
│   └── email.job.ts               Worker — sends OTP emails via Resend (concurrency 10, retry ×3)
├── core/
│   ├── config/                    env.ts (zod-validated), database.config.ts, redis.config.ts,
│   │                              jwt.config.ts, swagger.config.ts
│   ├── database/                  db.ts (pg Pool) + migrations/*.sql (001–006)
│   ├── errors/                    AppError hierarchy (400/401/403/404/409/500) + global errorHandler
│   ├── email/                     resend.client.ts, email.service.ts, templates/ (otp, welcome)
│   └── logger/                    logger.ts (pino singleton), request-logger.middleware.ts
└── types/express.d.ts             Request.user augmentation
```

## API

See **[docs/API.md](../../docs/API.md)** for the full endpoint reference. Summary:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/sign-up` | — | create account |
| POST | `/api/auth/request-otp` | — | email a login code (30 min validity) |
| POST | `/api/auth/verify-otp` | — | consume OTP → **sets httpOnly auth cookies**; body = `{ onboardingCompleted }` |
| POST | `/api/auth/refresh-token` | cookie | rotate cookie pair (old refresh token revoked) |
| GET | `/api/auth/session` | cookie | boot-time restore: `{ authenticated, onboardingCompleted }` |
| DELETE | `/api/auth/logout` | cookie | revoke all refresh tokens + clear cookies |
| POST | `/api/auth/onboard` | 🔒 cookie/header | complete onboarding (genres, avatar, bio) |
| PATCH | `/api/user/edit-profile` | 🔒 cookie/header | partial profile update (handle change: 1×/6 months) |

Successful responses use `{ success: true, data: … }`; failures use `{ success: false, message }` via the central error handler.

## Notes / caveats

- **Cookies and cross-origin dev:** the client (Vite, port 5173) calls the API on port 3000 — same *site* (`localhost`), so `SameSite=Lax` cookies still attach to `credentials: "include"` fetches as long as CORS origin is exact (it is).
- **If you ever split the API onto its own domain in production**, cookies need `SameSite=None; Secure` and the client must keep `credentials: "include"` — prefer keeping the nginx same-origin proxy instead (already configured).

## Migrations

Applied automatically by the postgres container on first boot (`docker-entrypoint-initdb.d`). Numbered:

1. `001_create_users.sql`
2. `002_create_login_otps.sql` (partial unique index: one active OTP per user)
3. `003_create_refresh_tokens.sql`
4. `004_add_user_onboarding_fields.sql`
5. `005_add_user_handle.sql` (partial unique index)
6. `006_create_blogs.sql`
7. `007_blog_status_content_bookmarks.sql` (draft/published `status`, markdown `content`, `blog_bookmarks`)
8. `008_user_website_handle_changed_at.sql` (`users.website`, the 6-month handle-lock clock)

No migration runner is wired into the server itself — schema changes during development currently require re-creating the postgres volume (or hand-applying SQL). `007` is idempotent, so it can be applied safely to an existing dev volume with `psql -f 007_blog_status_content_bookmarks.sql`.

## Security notes

- OTPs are bcrypt-hashed before storage and revoked on successful use; only one active OTP per user
- Refresh tokens are stored only as SHA-256 hashes and rotated on every use
- `JWT_SECRET` must be ≥32 characters (zod-enforced); Postgres/Redis live on the internal Docker network only
- ⚠️ **Before production:** remove the hard-coded dev OTP `0000` (both in `requestOTP` and as a universal verify bypass), and add rate limiting on auth endpoints (`users.website` and `users.handle_changed_at` now exist via migration `008`)

## Known limitations

- `blog` domain mounted under `/api/blogs` (draft → publish workflow, bookmarks, counts)
- No `/health` endpoint, no rate limiting, no request body validation layer (controllers trust the DTO shape; blog service caps title 200 / content 500k / description 500 chars)
- Welcome email template exists but is never queued after sign-up
- `pool.on("error")` calls `process.exit(-1)` — the process wrapper restarts it, but a graceful drain would be safer
