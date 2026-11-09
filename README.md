<div align="center">

![alt text](apps/client/public/LandingPage.png)

# ✍🏻 Quill

Quill is a self-hostable writing and reading platform with passwordless sign-in, profiles, feeds, bookmarks, threaded comments, writer clubs, and asynchronous publishing.

</div>

---

## Stack

| Layer | Choice |
|---|---|
| Client app | React 19 + TypeScript, Vite, React Router 7, Tailwind CSS 4 |
| Server API | Bun + Express 5 + TypeScript, Socket.IO, Swagger UI |
| Worker / queue | Redis 7 + BullMQ |
| Database | PostgreSQL 16 + `pg` |
| Auth / security | JWT via `jose`, OTP email auth, cookie-based sessions |
| Validation / logging | Zod, Pino, structured HTTP logging |
| Email / notifications | Resend + background workers |
| Observability | Prometheus, Grafana, Sentry, `/health` + `/metrics` endpoints |
| AI / recommender | Python 3.11 + FastAPI, Pandas, SQLAlchemy, LightGBM |
| Package manager / monorepo | Bun workspaces |
| Deployment / local stack | Docker Compose, Nginx |

## Repository

```text
quill/
├── apps/
│   ├── client/       React SPA                           [README](apps/client/README.md)
│   └── server/       Express API and BullMQ workers      [README](apps/server/README.md)
├── packages/
│   └── shared/       Shared TypeScript DTOs               [README](packages/shared/README.md)
├── services/
│   └── ai/           Standalone FastAPI + recommender workspace [README](services/ai/README.md)
├── scripts/          Local helper scripts                 [README](scripts/README.md)
├── docs/             Product, API, and system docs         [index](docs/README.md)
├── docker-compose.yml
└── CHANGE-LOG.md
```

## Current functionality

- Email OTP signup/login with httpOnly access and rotating refresh cookies; logout can revoke the current device or all sessions.
- Onboarding, editable profile and handle, multipart avatar uploads, visitor profiles, follow/follower lists, and follow suggestions.
- Markdown post drafts, editing, immediate or scheduled publishing, paginated For You and Following feeds, and persistent bookmarks.
- Topic-tagged posts and a For You feed shaped by saved genres; untagged legacy posts remain available as fallback.
- Browser text-to-speech narration of posts with voice/language selection and a floating player.
- Reading sessions record active time and maximum scroll depth; the For You feed is ranked by the Python recommender service when it can serve results, with graceful fallback to a chronological, genre-aware feed if the AI service is unavailable.
- Threaded comments with replies, owner edit/delete, and like/heart comment reactions.
- Writer clubs with memberships, invitations and applications, post submission/review, group and direct chat, live club-chat events, image messages, and version-checked shared drafts. Shared drafts are not a simultaneous live editor.
- In-app alerts for follows, followed writers' posts, scheduled publications, comment replies, and club events; opted-in follower emails and a weekly reading digest are delivered by the worker.
- Saved feed-tab, topic, reader text-size/theme, and notification preferences are applied. Product-news email remains unavailable until a newsletter source exists.
- Self-service account deletion with dependent data removed through database cascades.

## Future work

Ideas for future product development; these are not currently implemented:

- [ ] Highlighting and annotations
- [ ] Newsletter, email subscribers, and RSS feeds
- [ ] A knowledge graph of articles and blogs
- [ ] Personal reading journal
- [ ] Reading library
- [ ] Read-later list (Queue with estimated reading time)
- [ ] Version history
- [ ] Live Blog Writing Competition (On-the-Spot Topic)
- [ ] Content Moderation
- [ ] Live simultaneous collaborative editing
- [ ] Series / Collection of Blogs (grouping)
- [ ] Upgrade rich text editor (TipTap / ProseMirror)
- [ ] Report and Block users
- [ ] Semantic search over full-text search
- [ ] AI writing assistant
- [ ] AI analytics dashboard and report generation
- [ ] Add skeleton while loading
- [ ] Blog Summariser using NLP

## Getting started

Prerequisites: Bun 1.3+, Docker Compose (or local PostgreSQL and Redis), and a Resend API key. Server startup validates `DATABASE_URL`, `REDIS_URL`, a JWT secret of at least 32 characters, and `RESEND_API_KEY`.

```bash
git clone https://github.com/AritraC1/quill.git
cd quill
cp .env.example .env
bun install
bun run migrate
```

### Docker Compose

```bash
cp .env.example .env
# Set JWT_SECRET (32+ characters) and RESEND_API_KEY before starting.
docker compose up --build -d
```

| Service | Host access | Purpose |
|---|---|---|
| `client` | `http://localhost:80` | Nginx SPA and reverse proxy |
| `server` | Internal port 3000 | Express API, Swagger UI and uploaded assets |
| `worker` | Internal only | OTP/follower/digest email, scheduled publishing, notification fan-out |
| `ai-service` | `http://127.0.0.1:8000` | FastAPI app with a health endpoint and a recommender workspace under `services/ai/src/recommender`; the server ranks the For You feed via its `/recommendations/{userId}` endpoint with a 2 s timeout and falls back to the database feed on any failure |
| `postgres` | `localhost:5432` | Persistent application data |
| `redis` | Internal only | BullMQ queue backend |
| `prometheus` | `http://localhost:9090` | Scrapes API metrics |
| `grafana` | `http://localhost:3001` | Pre-configured metrics dashboard (`admin`/`admin`) |

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

`bun run dev` starts workspaces with a `dev` script (client and API); it does not start the worker. `./scripts/run.sh` starts PostgreSQL, Redis, Prometheus, and Grafana with Compose, then runs the API, worker, and client locally; it does not run migrations.

**To Run this Project:**

***Option 1:*** In separate terminals, run `bun run dev` for the client and API and `bun run dev:worker` for background jobs. The client is served by Vite (default `http://localhost:5173`) and the API by Express (`http://localhost:3000`). The worker is required for OTP and follower email, weekly digests, scheduled publishing, and notification fan-out. If you use Docker Compose, PostgreSQL applies the migration SQL files when it initializes a new data volume; existing volumes do not automatically rerun those init scripts.

***Option 2:*** In same terminal run via this script - `./scripts/run.sh`. This will start everything.

See the [documentation index](docs/README.md), [API reference](docs/API.md), [architecture](docs/Architecture.md), [system design](docs/System-Design.md), and [change log](CHANGE-LOG.md).

---