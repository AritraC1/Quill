# Quill

Quill is a minimal, Medium-flavoured blog publishing and reading platform — people sign up passwordlessly (email OTP), pick topics they care about, and get a quiet feed. Authors write, share posts, and manage their profile; discovery, engagement, and scale concerns are documented in [`docs/System-Design.md`](docs/System-Design.md).

**Current status:** signup/OTP/session APIs and onboarding/profile endpoints exist, but OTP is hard-coded to `0000`. The feed and profile experience remains a client-side prototype using mock data and local storage; the blog scaffold is not wired to HTTP routes. See the [PRD](docs/PRD.md) for implementation status.

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
├── scripts/        → setup.sh, run.sh                                       [README](scripts/README.md)
├── docker-compose.yml
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── System-Design.md
│   └── API.md
└── CHANGE-LOG.md
```

## Core Features

**Implemented today**

- Passwordless auth — sign up, email OTP login, JWT access + rotating refresh tokens, logout
- Auto-generated unique `@handle` on first login
- Onboarding (genres + avatar + bio) can be persisted through the API; client continues locally if the API call fails
- Profile editing UI (browser-local only; not connected to the profile API)
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
| `server`   | 3000 (internal) | Express API (also at `/docs` Swagger UI; proxied by the client) |
| `worker`   | —    | BullMQ background job processor     |
| `postgres` | 5432 | Primary database                    |
| `redis`    | internal 6379 | BullMQ queue backend              |

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
| [`docs/PRD.md`](docs/PRD.md) | product requirements, scope, implementation status |
| [`docs/Architecture.md`](docs/Architecture.md) | implemented components, request flows, deployment topology |
| [`docs/System-Design.md`](docs/System-Design.md) | current infrastructure, data paths, and future operational work |
| [`docs/API.md`](docs/API.md) | full REST API reference |
| [`CHANGE-LOG.md`](CHANGE-LOG.md) | chronological change log |

---
