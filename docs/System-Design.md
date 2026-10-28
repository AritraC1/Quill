# Quill — System Design

This document separates implemented design from proposals. No throughput, user-capacity, or production-readiness target has been load-tested.

## 1. Current deployment topology

The checked-in `docker-compose.yml` defines:

| Service | Current role | Exposure |
|---|---|---|
| `client` | Nginx serves the Vite SPA and proxies `/api/` and `/docs/` | Host port 80 |
| `server` | Express API | Internal Compose network, container port 3000 |
| `worker` | BullMQ OTP email processor | Internal Compose network |
| `postgres` | PostgreSQL 16 persistent application data | Internal network and host port 5432 |
| `redis` | Redis 7 queue backend | Internal Compose network |

This configuration is suitable as a Compose-based development/self-hosting starting point. It does not configure HTTPS, a reverse-proxy certificate flow, CDN, object storage, automated backups, deployment automation, or production observability. The sample Compose defaults for database credentials are development conveniences; deployers must set strong secrets and restrict database access.

## 2. Data and request paths

PostgreSQL is the source of truth for users, OTP records, refresh-token hashes, and the initial `blogs` table. Migrations do not currently define posts, comments, tags, follows, reading history, likes, bookmarks, or recommendation data.

Redis is currently used as BullMQ's backing store for email delivery. The code does not currently cache API responses or feed results.

The auth request path is:

1. The client calls the Express API with credentials enabled.
2. Express reads the access token from an httpOnly cookie (or a Bearer authorization header for programmatic clients).
3. OTP and refresh-token state is persisted in PostgreSQL; OTP emails are enqueued to BullMQ in Redis and sent by the separate worker through Resend.
4. The client restores auth state through the refresh cookie at `/api/auth/session` and rotates credentials after an authenticated request gets a 401.

### Auth and launch limitations

- OTP generation is hard-coded to `0000`; verification accepts that value as a bypass.
- No auth or write-endpoint rate limiting is configured.
- The access and refresh cookies are httpOnly and use `SameSite=Lax`; `Secure` is enabled in production. CORS allows the configured `CLIENT_URL` with credentials.
- There is no CSRF token mechanism. Review deployment origins and cookie behavior before exposing state-changing endpoints to a production browser client.
- Profile API SQL refers to `website` and profile logic refers to `handle_changed_at`, neither of which is added by the checked-in migrations. The current profile form uses local storage instead.

## 3. Background processing

The only queue job implemented today is OTP email delivery:

| Job | Trigger | Behavior |
|---|---|---|
| `send-otp` | OTP request | Resend delivery; three attempts with exponential backoff; worker concurrency 10 |

The codebase does not implement welcome-email enqueueing, password-reset email, comment notifications, image processing, recurring digest jobs, or feed/recommendation jobs.

## 4. Product features and proposed data design

The current feed and profile screens are client-side prototypes over mock data. Topic filtering, text search, “For you”/“Following” tabs, bookmarks, and follows are not backed by server APIs. User-selected onboarding genres are stored in the `users` table when the onboarding API succeeds, but no feed uses them.

When server-backed reading features are implemented, the schema and endpoints should be designed around concrete requirements for publishing, visibility, pagination, comments, follows, and engagement. A personalized feed could initially rank published posts using onboarding topics and later reading signals, but no affinity tables, ranking job, or feed cache currently exists. Treat collaborative filtering and precomputed recommendations as future options, not current architecture.

## 5. Scaling and operational work (future)

There are no measured capacity figures or configured scale triggers in the repository. Before selecting production sizing or scaling thresholds:

1. Define expected traffic and service-level objectives.
2. Add metrics for API latency/errors, database pool saturation, queue age/failures, and resource use.
3. Load-test actual API and database paths, then size the deployment from observed results.
4. Add and test backup/restore procedures, secret management, HTTPS, and alerting.
5. Scale components independently only when measurements identify a bottleneck.

Kubernetes, separate database hosts, read replicas, a CDN, object storage, and microservice decomposition are not configured and should be evaluated only against verified operational needs.
