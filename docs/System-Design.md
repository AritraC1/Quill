# Quill — System Design

This document records the current system and operational gaps. No capacity, throughput, or service-level target has been load-tested.

## 1. Current deployment topology

The checked-in `docker-compose.yml` defines:

| Service | Role | Exposure |
|---|---|---|
| `client` | Nginx SPA and reverse proxy for `/api/`, `/docs/`, `/uploads/` | Host port 80 |
| `server` | Express API | Compose network, container port 3000 |
| `worker` | BullMQ email, scheduled-publish, notification-fanout workers | Compose network |
| `postgres` | Persistent application database | Host port 5432 and Compose network |
| `redis` | BullMQ backend | Compose network |

This is a local/self-hosting topology, not a hardened production deployment. It does not configure HTTPS, a managed secret store, automated backups, external object storage, monitoring, or deployment automation. Compose includes development-friendly PostgreSQL defaults and exposes port 5432; change credentials and network exposure before use beyond a trusted local environment.

## 2. Data paths

### Authentication

The browser sends httpOnly cookies to the API. PostgreSQL stores OTP hashes and refresh-token hashes; Redis/BullMQ carries OTP email jobs, which the worker sends through Resend. The API rotates refresh tokens and can revoke one session or all sessions.

**Critical limitation:** OTP issuance and verification currently use the fixed code `0000`. Do not expose this authentication flow publicly.

Cookies use `SameSite=Lax`; `Secure` is enabled in production. CORS allows the configured `CLIENT_URL` with credentials. Review CSRF protections, origins, TLS termination, and cookie settings for the intended deployment before exposing state-changing browser endpoints.

### Posts and feeds

PostgreSQL is the source of truth for drafts, published posts, scheduled publish timestamps, bookmarks, and follows. The paginated For You feed currently returns published posts chronologically; the Following feed limits results to authors the reader follows. Search and topic filtering occur in the client over loaded results. There is no feed cache or recommendation pipeline.

### Notifications

Follow events create a new-follower notification. Publishing enqueues a fan-out job that writes one new-post notification per follower in batches of 500. Unique event keys prevent duplicate notifications on retries. The navbar polls unread count; there is no SSE/WebSocket transport or email notification/digest delivery.

### Settings

The settings API persists topic choices, default feed tab, text size, theme, and notification switches. Currently these values are stored but most are not wired into the corresponding feed, reader, or delivery behavior. Treat them as saved preferences, not active policies.

### Avatars

Avatar files are checked for supported image type and a 5 MB limit, written to the API's local `uploads/` directory, and served through `/uploads`. Compose uses a named volume for server uploads. This is not object storage, has no CDN/image processing, and requires an explicit backup and persistence strategy outside the sample topology.

## 3. Background jobs

| Queue / worker | Trigger | Behavior |
|---|---|---|
| `email` | OTP request | Resend OTP email; three job attempts with exponential backoff; worker concurrency 10 |
| `blog-publish` | Scheduled publish request | Delayed job publishes a still-due draft; scheduling is limited to 24 days |
| `notification-fanout` | Newly published post | Inserts follower notifications in batches; idempotent by database event key |

The `worker` service starts all three workers and closes them plus Redis on shutdown. Welcome emails, digests, replies, and email notification preferences are not implemented.

## 4. Database and migrations

PostgreSQL stores user/profile/settings data, authentication state, posts, bookmarks, follows, and notifications. Redis is the queue backend, not a response cache.

Numbered SQL files under `apps/server/src/core/database/migrations/` define the schema through migration `012_user_settings.sql`. `bun run migrate` applies unapplied files in filename order and records their names. Compose mounts the migration directory into PostgreSQL's init directory; those scripts run only when the database data directory is initialized for the first time, not on every container start. Existing volumes should use the migration runner.

## 5. Security and operational caveats

- Fixed OTP behavior must be removed before production.
- Rate limiting is in-process/IP-based: 300 requests per minute on `/api`, plus a 20-failure/10-minute auth limiter on signup, OTP request, and OTP verification. These defaults are not a substitute for deployment-level controls.
- Access and refresh cookies are httpOnly; `SameSite=Lax`, with `Secure` in production.
- API JSON bodies are limited to 1 MB; avatar uploads are separately limited to 5 MB.
- Local disk avatar storage requires durable-volume planning and backup.
- No health endpoint, metrics, tracing, alerting, backup/restore automation, or load-test results are provided.
- Account deletion is implemented and cascades user-associated content and identity records; retention/legal policy still needs product/operator definition.

## 6. Scaling and future work

There are no measured capacity figures or configured scale triggers. Before production sizing:

1. Define traffic expectations and service-level objectives.
2. Instrument API latency/errors, database-pool saturation, job age/failures, and resource use.
3. Load-test actual database, API, and queue paths.
4. Test migration, backup, restore, and account-deletion behavior.
5. Select external object storage, deployment topology, and scaling strategy from measured needs.

Kubernetes, read replicas, a CDN, microservice decomposition, event streaming, and recommendation precomputation are not configured. Evaluate them only when requirements and measurements justify them.
