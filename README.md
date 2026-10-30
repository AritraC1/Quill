# Quill

Quill is a writing and reading platform built as a Bun-workspace monorepo. The current app supports passwordless email sign-in, onboarding, profile management, publishing and scheduling markdown posts, server-backed feeds, follows, bookmarks, in-app notifications, saved reading preferences, and account deletion.

> **Development and launch note:** OTP generation and verification currently use the fixed code `0000`. Do not deploy this authentication flow to production until that test behavior is removed. Compose is a self-hosting/development setup, not a production deployment configuration.

## Stack

| Layer | Choice |
|---|---|
| Client | React 19, TypeScript, React Router 7, Tailwind CSS 4, Vite |
| API | Express 5 + TypeScript on Bun |
| Database | PostgreSQL 16 (`pg`) |
| Background jobs | Redis 7 + BullMQ |
| Email | Resend |
| Validation / logging | Zod, Pino |
| Package manager | Bun workspaces |
| Containers | Docker Compose, Nginx |

## Repository

```text
quill/
├── apps/
│   ├── client/       React SPA                           [README](apps/client/README.md)
│   └── server/       Express API and BullMQ workers      [README](apps/server/README.md)
├── packages/
│   └── shared/       Shared TypeScript DTOs               [README](packages/shared/README.md)
├── scripts/          Local helper scripts                 [README](scripts/README.md)
├── docs/             Product, API, and system docs         [index](docs/README.md)
├── docker-compose.yml
└── CHANGE-LOG.md
```

## Current functionality

- Email OTP signup/login with httpOnly access and rotating refresh cookies; logout can revoke the current device or all sessions.
- Onboarding, editable profile and handle, multipart avatar uploads, visitor profiles, follow/follower lists, and follow suggestions.
- Markdown post drafts, editing, immediate or scheduled publishing, paginated For You and Following feeds, and persistent bookmarks.
- In-app notifications for new followers and posts from followed writers.
- Settings API for favorite topics, feed-tab preference, reading appearance, and notification preferences; settings are stored, though most preferences are not yet applied elsewhere in the client or notification delivery.
- Self-service account deletion with dependent data removed through database cascades.

The client uses the server for these core features. Search and topic filtering are client-side over the currently loaded feed, and selected local-storage values still support UI state/cache behavior. See the [PRD](docs/PRD.md) and [API reference](docs/API.md) for precise behavior and limitations.

## Getting started

Prerequisites: Bun 1.3+, Docker Compose (or local PostgreSQL and Redis), and a Resend API key. Server startup validates `DATABASE_URL`, `REDIS_URL`, a JWT secret of at least 32 characters, and `RESEND_API_KEY`.

```bash
git clone https://github.com/AritraC1/quill.git
cd quill
cp .env.example .env
# Set DATABASE_URL, REDIS_URL, JWT_SECRET, RESEND_API_KEY, EMAIL_FROM.
bun install
bun run migrate
```

In separate terminals, run `bun run dev` for the client and API and `bun run dev:worker` for background jobs. The client is served by Vite (default `http://localhost:5173`) and the API by Express (`http://localhost:3000`). The worker is required for OTP email, scheduled publishing, and notification fan-out. If you use Docker Compose, PostgreSQL applies the migration SQL files when it initializes a new data volume; existing volumes do not automatically rerun those init scripts.

### Docker Compose

```bash
cp .env.example .env
# Set JWT_SECRET (32+ characters) and RESEND_API_KEY before starting.
docker compose up --build
```

| Service | Host access | Purpose |
|---|---|---|
| `client` | `http://localhost:80` | Nginx SPA and reverse proxy |
| `server` | Internal port 3000 | Express API, Swagger UI and uploaded assets |
| `worker` | Internal only | OTP email, scheduled publishing, notification fan-out |
| `postgres` | `localhost:5432` | Persistent application data |
| `redis` | Internal only | BullMQ queue backend |

The Compose file has development-friendly PostgreSQL defaults and publishes PostgreSQL on the host. Set strong credentials and appropriately restrict access before using it beyond a trusted local environment.

## Root commands

```bash
bun run dev:client
bun run dev:server
bun run dev:worker
bun run dev
bun run migrate
bun run build
bun run test
bun run test:server
bun run test:client
```

`bun run dev` starts workspaces with a `dev` script (client and API); it does not start the worker.

See the [documentation index](docs/README.md), [API reference](docs/API.md), [architecture](docs/Architecture.md), [system design](docs/System-Design.md), and [change log](CHANGE-LOG.md).
