# Quill

Quill is a minimal, Medium-flavoured blog publishing and reading platform — people sign up passwordlessly (email OTP), pick topics they care about, and get a quiet feed. Authors write, share posts, and manage their profile; discovery, engagement, and scale concerns are documented in `System-Design.md`.

**Current status:** auth → onboarding → feed flows are complete and working end-to-end; the blog/post domain is scaffolded but not wired (see [PRD status](#documentation)).

## Tech Stack

| Layer | Choice |
|---|---|
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 + Vite |
| **Backend** | Express 5 + TypeScript (OOP, domain-driven) on Bun |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7 + BullMQ (background email jobs) |
| **Email** | Resend |
| **Package manager** | Bun (monorepo via workspaces) |
| **Containerization** | Docker + Docker Compose (multi-stage builds) |

## Monorepo Structure

```
quill/
├── apps/
│   ├── client/     → React (TSX) + Tailwind, domain-driven feature folders  [README](apps/client/README.md)
│   └── server/     → Express + TS, controller/service/repository per domain [README](apps/server/README.md)
├── packages/
│   └── shared/     → shared TypeScript DTO types                            [README](packages/shared/README.md)
├── docs/
│   └── API.md      → REST API reference
├── scripts/        → setup.sh, run.sh                                       [README](scripts/README.md)
├── docker-compose.yml
├── PRD.md
├── Architecture.md
├── System-Design.md
└── CHANGE-LOG.md
```

## Core Features

**Implemented today**

- Passwordless auth — sign up, email OTP login, JWT access + rotating refresh tokens, logout
- Auto-generated unique `@handle` on first login
- Onboarding (genres + avatar + bio) persisted to Postgres
- Profile editing UI (local, with validation, avatar crop)
- Token refresh with single-flight protection and automatic retry on 401

**Scaffolded / in progress**

- Blog CRUD (repository partial, service/controller/routes empty)
- Personalized "For You" / "Following" feed (frontend mocked in `apps/client/src/data`)
- Swagger docs (spec exists, annotations not yet written)

## Getting Started (local dev)

```bash
git clone https://github.com/AritraC1/quill.git
cd quill
cp .env.example .env          # fill in JWT_SECRET (32+ chars) and RESEND_API_KEY
bun install                   # or: docker compose up --build
bun run db:migrate            # optional — tables auto-apply on first postgres boot via docker-entrypoint-initdb.d
bun run dev                   # client + server + worker
```

### Docker (full stack)

```bash
cp .env.example .env
docker compose up --build
```

This starts:

| Service    | Port | Description                         |
|------------|------|-------------------------------------|
| `client`   | 80   | Static SPA served via nginx         |
| `server`   | 3000 | Express API (also at `/docs` Swagger UI) |
| `worker`   | —    | BullMQ background job processor     |
| `postgres` | 5432 | Primary database                    |
| `redis`    | 6379 | Cache + BullMQ queue backend        |

## Scripts (from root)

```bash
bun run dev:client     # run client only
bun run dev:server     # run server only
bun run dev:worker     # run worker only
bun run dev            # run all workspaces
bun run build          # build all workspaces
bun run test           # run all tests (server has Bun tests)
```

## Documentation

| Document | Contents |
|---|---|
| [`PRD.md`](PRD.md) | product requirements, scope, implementation status |
| [`Architecture.md`](Architecture.md) | component breakdown, request flow, deployment |
| [`System-Design.md`](System-Design.md) | scaling strategy, caching, recommendation system, infra sizing |
| [`docs/API.md`](docs/API.md) | full REST API reference |
| [`CHANGE-LOG.md`](CHANGE-LOG.md) | chronological change log |

---
