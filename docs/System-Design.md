# Quill — System Design

This document records the current data paths, runtime boundaries, and known operational limits as of 2026-11-09. No capacity, throughput, or service-level target has been load-tested. See [Architecture](./Architecture.md) for component details and [API](./API.md) for endpoint contracts.

## 1. Runtime topology

The Docker Compose stack defines:

| Service | Role | Host exposure |
|---|---|---|
| `client` | Nginx serves the React SPA and proxies API, socket, docs, upload, health, and metrics paths | Port 80 |
| `server` | Express API, health/metrics handlers, and club Socket.IO namespace | Internal port 3000 |
| `worker` | BullMQ email, scheduled-publish, and notification-fanout workers | Internal only |
| `postgres` | Durable application database | Port 5432 |
| `redis` | BullMQ queue backend | Internal only |
| `prometheus` | Scrapes API metrics | Port 9090 |
| `grafana` | Provisioned Prometheus datasource and dashboard | Port 3001 |
| `ai-service` | Python FastAPI recommender ranking the For You feed | Bound to `127.0.0.1`, port 8000 by default |


For local development, `./scripts/run.sh` starts PostgreSQL, Redis, Prometheus, and Grafana in Compose, then runs the API, worker, and client locally. It does not apply migrations. `bun run dev` starts workspaces with a `dev` script (client and API), but not the worker.

## 2. Data paths

### Authentication and account lifecycle

1. Signup creates a user record.
2. OTP request writes an active OTP record and queues an email job. Unknown email addresses receive the same successful API response to reduce account enumeration.
3. OTP verification consumes an active code, creates a handle if needed, and issues access and refresh cookies. Refresh token hashes are persisted.
4. Session restore and refresh use the path-scoped refresh cookie. Refresh rotates the token; logout revokes the current device or all stored sessions.
5. Account deletion removes the user transactionally; foreign-key cascades remove dependent user content and account data.

> **Critical development limitation:** OTP issuance and verification currently use the literal code `0000`. Do not expose this flow to the public.

Cookies are httpOnly and `SameSite=Lax`; `Secure` is enabled in production. CORS permits the configured client origin with credentials. Review CSRF posture, cookie policy, TLS termination, and origin configuration for the intended deployment.

### Posts, feeds, search, and reading

PostgreSQL stores user drafts, published posts, scheduled publication time, topic genres, bookmarks, follows, clubs, and reading sessions. The authenticated For You feed is ranked by the recommender service when available; the fallback feed applies saved genres to tagged posts while retaining untagged legacy posts, and it is chronological rather than personalized. The Following feed is limited to followed authors.

The API's `search` query filters published posts with case-insensitive substring matches over title, description, and content. This is not ranked PostgreSQL full-text or semantic search. Topic chips are an additional client-side filter over already-loaded feed pages.

Authenticated readers report reading-session progress for published posts. Each visit has a session ID and stores the maximum active seconds and scroll depth received; retries cannot inflate those values. A session is marked complete at 90% reported scroll depth. This is an imperfect engagement proxy, not proof that a story was read. The recommender service consumes it as implicit feedback for feed ranking, and there is no analytics service.

### Comments and clubs

Comments and reactions are persisted in PostgreSQL. Only published posts accept comments. Replies must belong to the same post and are rendered as two-level threads; a reply to a reply attaches to its top-level ancestor. Comment deletion is soft so child replies remain. A comment reaction is unique per `(comment_id, user_id, reaction_type)`; this is separate from post likes, which are not implemented.

Club operations are authenticated and enforce membership and role rules in the service layer. PostgreSQL stores clubs, memberships, invitations, applications, submissions/reviews, conversations/messages, and draft collaborators. Club draft writes use optimistic version checks to reject stale saves; they do not implement simultaneous live editing.

Chat history is paginated over REST. Text messages are persisted through the club service, then broadcast through Socket.IO `/club-chat` rooms. Image messages are uploaded through REST and broadcast after persistence. Presence and typing are realtime socket events; in-memory presence state is local to the API process, and Compose currently runs a single API instance.

### Notifications and preferences

In-app events cover follows, followed-writer publications, scheduled publications, comment replies, and club invitations/reviews. New-post events are queued for fan-out to followers in batches of 500; unique event keys make notification writes idempotent on retries. Notification lists and unread counts are HTTP-backed, not a general Socket.IO/SSE stream.

Settings are stored as a complete snapshot. Saved genres affect the For You feed; the saved feed tab is applied after settings load; text size and theme affect story reading. In-app notification preferences gate supported event types. Email preferences gate follower emails and the weekly digest. Product-news email is not delivered because no newsletter source exists.

### Avatars and uploaded chat images

Profile avatars are limited to JPEG, PNG, or WebP and 5 MB; they are written to local disk and served at `/uploads`. Compose mounts a named upload volume for the API. Club chat image uploads also pass through the server and are delivered to the chat room after persistence. This setup has no external object store, CDN, image-processing pipeline, or automated upload backup policy.

## 3. Background jobs

| Queue / worker | Trigger | Behavior |
|---|---|---|
| `email` | OTP request, follow event, weekly scheduler | Sends OTP and opted-in follower email; queues and sends opted-in weekly digests on Mondays at 09:00 UTC |
| `blog-publish` | Scheduled publish request | Delayed job checks and publishes a still-due draft, then initiates follower notification fan-out |
| `notification-fanout` | Newly published post | Creates follower notifications in batches; event keys prevent duplicate rows |

BullMQ jobs use retries with exponential backoff where configured. The weekly digest uses a repeatable scheduler and per-recipient/date job IDs. Workers report completion/failure telemetry, log errors, and capture failures in Sentry when configured. The worker is a separate required process for OTP/email, scheduled publishing, notification fan-out, and weekly digests; the API does not process these queues itself.

## 4. Database and migrations

Numbered SQL migrations `001`–`017` under `apps/server/src/core/database/migrations/` define users and profiles, authentication state, blogs, bookmarks, follows, notifications, settings, comments/reactions, clubs/chat/collaborators, reading sessions, topic genres, and notification event keys.

`bun run migrate` applies unapplied SQL files in filename order and records their names in the `migrations` table. Compose also mounts migration SQL into PostgreSQL's initialization directory; PostgreSQL processes those files only when it first initializes an empty data directory. Existing data volumes must use the migration runner. The API does not automatically migrate on startup.

Redis is used by BullMQ for jobs and is not an API response cache.

## 5. Security, observability, and operational limits

- Fixed OTP behavior must be removed before production exposure.
- IP-based rate limits are in-process: 300 requests per minute on `/api`, and 20 failed signup/OTP attempts per 10 minutes on auth routes.
- JSON request bodies are capped at 1 MB; avatar uploads are capped at 5 MB.
- Access and refresh cookies are httpOnly, `SameSite=Lax`, and `Secure` in production. Deployment-specific CSRF, TLS, and origin protections still require review.
- `/health` and `/api/health` check PostgreSQL and Redis and return 503 when either is unavailable. `/metrics` and `/api/metrics` expose HTTP, process, database-pool, and worker metrics.
- Compose includes Prometheus and provisioned Grafana dashboards. Sentry support exists for client, API, and worker, but requires configured DSNs. Metrics and error capture do not by themselves provide alerting.
- Uploaded files are on local disk. Plan for persistence, capacity, backup, and cleanup.
- Compose publishes PostgreSQL and has development-friendly default credentials; restrict ports and change defaults outside trusted local use.
- Account deletion is implemented; retention and legal policy remain operator and product decisions.
- No load-test results, backup/restore automation, or production SLOs are available.

## 6. Scaling and future work

There are no measured capacity figures or configured scale triggers. Before production sizing:

1. Define traffic expectations and service-level objectives.
2. Observe API latency/errors, database-pool saturation, job age/failures, and resource use under representative load.
3. Load-test actual database, API, worker, and chat paths.
4. Test migration, backup, restore, and account-deletion behavior.
5. Select external object storage and a deployment topology from measured requirements.

The current deployment does not configure multiple API replicas, a shared Socket.IO adapter, read replicas, a CDN, or recommendation precomputation. Evaluate such changes only when requirements and measurements justify them.

---