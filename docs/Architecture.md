# Quill — Architecture

This document describes the code that exists today. Product and infrastructure ideas that are not implemented are called out as future work rather than represented as running services.

## 1. System overview

Quill is a Bun-workspace monorepo with a React single-page client and an Express API. The API currently implements account signup, email OTP authentication, session cookies, onboarding, and a user profile update endpoint. The reading experience is a client-side prototype backed by local mock data; there is no post/feed API yet.

```text
Browser
  └── React 19 + Vite client
       └── /api requests (httpOnly cookies)
            └── Express 5 API
                 ├── PostgreSQL 16 — users, OTPs, refresh-token hashes, blog scaffold
                 └── Redis 7 — BullMQ email queue
                      └── separate Bun worker — OTP email delivery via Resend
```

In the Docker Compose setup, Nginx serves the client on host port 80 and proxies `/api/` and `/docs/` to the server. PostgreSQL and Redis are on the Compose network; the server and worker are not published as host ports. This is a local/self-hosted Compose topology, not evidence of a configured production deployment.

## 2. Repository and runtime components

### Client (`apps/client`)

React 19, TypeScript, React Router, Tailwind CSS v4, and Vite. Routes include the landing page, onboarding, feed, own profile, profile editing, and `/u/:handle`.

- Authentication operations call the server and use `credentials: "include"`; JavaScript does not read the auth cookies.
- Feed stories, author profiles, following, and bookmarks are mock/client-side state. Search, topic filtering, and the two feed tabs operate over the local story collection.
- Profile editing currently saves to browser `localStorage`; it does not call `PATCH /api/user/edit-profile`.
- Onboarding attempts to save genres/avatar/bio to the API, but client code treats a failed API save as a warning and still completes locally.

### API (`apps/server`)

Bun runs Express 5 with TypeScript. `src/index.ts` configures credentialed CORS, request logging, JSON parsing, cookie parsing, Swagger UI, `/api` routes, and centralized error handling. The routes are grouped into:

- `domains/auth`: signup, OTP request/verification, refresh, session, logout, and protected onboarding.
- `domains/user`: protected profile update.
- `domains/blog`: model/repository scaffold only; no controller/routes are mounted.

The server uses controller/service/repository classes in these domains. PostgreSQL access is through `pg` and a connection pool. Redis is used by BullMQ for OTP email jobs; there is no Redis response cache or feed computation.

### Shared package (`packages/shared`)

Exports TypeScript request/response DTOs shared by client and server. It is not a generated runtime validation or API client package.

### Email worker

`src/worker.ts` starts a BullMQ worker for the `email` queue. The only implemented job is `send-otp`, which sends the verification code through Resend. Queue configuration specifies three attempts with exponential backoff; the worker handles up to ten jobs concurrently. There are no scheduled, digest, image-processing, or feed-recomputation jobs.

## 3. Implemented request flows

### Signup and login

1. The client posts a name and email to `POST /api/auth/sign-up`.
2. The API creates a `users` row in PostgreSQL.
3. The client requests an OTP; the API stores a bcrypt hash and enqueues the email job in Redis.
4. The user verifies the OTP. The API consumes the active OTP, creates a unique handle on first login, and issues access and refresh JWTs as httpOnly cookies.
5. On startup, the client checks `GET /api/auth/session`. Authenticated requests attach cookies; the client retries once after a 401 by calling the refresh endpoint.

**Important development limitation:** OTP generation is currently hard-coded to `0000`, and verification accepts `0000` as a bypass. Do not treat this auth flow as production-ready until that behavior is removed and tested.

### Onboarding

The protected `POST /api/auth/onboard` endpoint stores `fav_genre`, optional avatar and bio, and marks onboarding complete. The client requires at least one selected genre but does not block navigation when the API call fails, so local completion is not proof of server persistence.

### Reading and profiles

Feed, public/author profile, search, follow, like, bookmark, and profile-edit experiences are currently implemented as client-side demo behavior. No corresponding feed, post, or public-profile endpoints are mounted. The user profile update endpoint exists, but the client edit form is not wired to it and the endpoint currently references database columns absent from the migrations (see [API.md](./API.md)).

## 4. Data and infrastructure

The checked-in migrations create:

- `users`: name, email, onboarding fields, and optional handle.
- `login_otps`: OTP hashes, expiry and revocation timestamps.
- `refresh_tokens`: hashes of refresh JWTs, expiry and revocation timestamps.
- `blogs`: a minimal user-owned blog record with title, description and images.

The blog repository is incomplete and is not exposed over HTTP. There are no migrations for posts, comments, tags, follows, reading history, likes, bookmarks, handle-change timestamps, or website fields.

Docker Compose defines PostgreSQL, Redis, API, worker, and Nginx/client services. The client Nginx configuration provides SPA fallback and proxies `/api/` and `/docs/`. TLS termination, a public CDN, object storage, backups, CI/CD deployment, and production monitoring are not configured by the checked-in Compose file.

## 5. Future architecture (not implemented)

Posts and publishing, persistent follow/engagement data, server-backed feeds and search, image/object storage, recommendation jobs, cache usage, and production deployment controls remain future work. Keep these out of the description of current runtime behavior until they are implemented and verified.
