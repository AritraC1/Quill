# Quill

Quill is a full-featured blog publishing and reading platform — built for people to write, share posts, discover content through personalized feeds, engagement, and fast, reliable performance at scale.

## Tech Stack

- **Frontend:** React (TSX) + Tailwind CSS + Vite
- **Backend:** Express + TypeScript (OOP architecture)
- **Database:** PostgreSQL
- **Cache / Queue:** Redis + BullMQ
- **Messaging:** Message broker for pub/sub between services
- **Package manager:** Bun (monorepo via Bun workspaces)
- **Containerization:** Docker + Docker Compose
- **Deployment:** Hostinger VPS

## Monorepo Structure

```
quill/
├── apps/
│   ├── client/     → React (TSX) + Tailwind, domain-driven feature folders
│   └── server/     → Express + TS, domain-driven (controller/service/repository per domain)
├── packages/
│   └── shared/     → shared TypeScript types (Post, User, Comment, etc.)
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

See `Architecture.md` for the full breakdown of both `apps/client` and `apps/server`.

## Core Features

- Auth (JWT, roles: admin/editor/reader)
- Posts (drafts, scheduling, tags, slugs, markdown editor)
- Comments (threaded)
- Likes, bookmarks, follows
- Two feed tabs: **Following** and **For You** (personalized via reading-habit tag affinity)
- Background jobs via BullMQ (emails, image processing, feed recomputation)
- Admin dashboard, moderation, analytics

## Getting Started (local dev)

```bash
git clone https://github.com/AritraC1/quill.git
cd quill
cp .env.example .env
docker compose up --build
```

This starts:
| Service    | Port | Description                     |
|------------|------|---------------------------------|
| `client`   | 5173 | Vite dev server (React)         |
| `server`   | 3000 | Express API                     |
| `worker`   | —    | BullMQ background job processor |
| `postgres` | 5432 | Primary database                |
| `redis`    | 6379 | Cache + BullMQ queue backend    |

## Scripts (from root)

```bash
bun run dev:server     # run server only
bun run dev:client     # run client only
bun run dev:worker     # run worker only
bun run build          # build all workspaces
```

## Documentation

- `Architecture.md` — component breakdown, request flow, folder structure rationale
- `System-Design.md` — scaling strategy, caching, recommendation system, infra sizing
- `PRD.md` — product requirements, user stories, goals/non-goals

---