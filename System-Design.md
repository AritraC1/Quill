# Quill — System Design

## 1. Scale Target

Designed initially for **~5,000 registered users**, realistic blog traffic pattern (mostly reads, occasional writes, low-to-moderate concurrency — likely 50–200 concurrent users at peak rather than all 5,000 simultaneously).

## 2. Infrastructure Sizing

| Resource | Spec | Reasoning |
|---|---|---|
| VPS | 2–4 vCPU, 4–8 GB RAM | Handles Express + Postgres + Redis + BullMQ together at this scale |
| Storage | 50–80 GB SSD | DB + logs; media offloaded to object storage, not local disk |
| CDN | Cloudflare (free tier) | Caches static assets, absorbs spikes, adds DDoS protection |
| Object storage | Cloudflare R2 / Backblaze B2 / S3 | Uploaded images — avoids VPS disk/bandwidth pressure |

**Deliberately not used at this scale:** Kubernetes, multiple app servers, load balancer, managed database service. All are premature at 5,000 users and add operational overhead with no measurable benefit yet.

## 3. Scaling Triggers (when to revisit)

| Signal | Action |
|---|---|
| CPU/RAM consistently >70% | Vertical scale the VPS first (cheapest) |
| Concurrent users in the thousands | Separate DB onto its own VPS; add load balancer + 2+ app servers |
| Read-heavy pages straining Postgres | Add a read replica; lean harder on Redis caching |
| Media/bandwidth costs rising | CDN + object storage becomes non-negotiable (should already be in place by default) |
| Multiple independently-scaling services needed | Split into microservices; introduce message broker for pub/sub; consider Kubernetes only once there are several real services to orchestrate |

## 4. Caching Strategy

- **Redis** caches:
  - Hot post pages (short TTL, invalidated on edit)
  - Session/auth tokens
  - Precomputed "For You" feed results per user
- **CDN (Cloudflare)** caches static assets (JS/CSS bundles, images) at the edge
- Cache invalidation: on post edit/delete, explicitly bust the relevant Redis keys rather than relying purely on TTL expiry

## 5. Background Jobs (BullMQ)

Run as a separate worker process from the API server (see `Architecture.md`), backed by Redis.

| Job | Trigger | Notes |
|---|---|---|
| Welcome email | User signup | Async, non-blocking |
| Password reset email | User request | Includes retry on provider failure |
| Comment notification | New comment on followed post | Batched if possible to avoid spam |
| Image resize/optimize | Image upload | Runs before serving the final URL |
| Feed tag-affinity recompute | Nightly, scheduled | Powers the "For You" tab |
| Weekly digest email | Scheduled (repeatable job) | Top posts summary |

All jobs get automatic retry with backoff on failure — this is one of BullMQ's core advantages over a hand-rolled queue.

## 6. Personalized Feed — Recommendation Design

Two tabs, two different strategies:

**"Authors I Follow"**
- Direct query: `SELECT * FROM posts WHERE author_id IN (followed authors) ORDER BY created_at DESC`
- No precomputation needed; cache per-user in Redis if it becomes a hot path

**"For You"**
- **Cold start:** genres selected during onboarding seed initial tag affinity
- **Level 1 (current):** tag/category affinity — derive a user's top tags from `reading_history`, recommend unread posts matching those tags, ranked by recency/popularity
- **Level 2 (future):** collaborative filtering — "users who read what you read also read X," computed via co-occurrence counts
- **Level 3 (future):** weighted scoring combining tag match + recency + popularity + author proximity
- Computation happens in a nightly BullMQ job, not on-request, to keep feed loads fast; results cached in Redis

## 7. Data Model (core entities)

- `users` — id, email, password_hash, display_name, role, profile_complete
- `posts` — id, title, slug, content, author_id, status (draft/published), published_at
- `comments` — id, post_id, author_id, parent_comment_id (nullable, for threading), content
- `tags` — id, name
- `post_tags` — many-to-many join
- `follows` — follower_id, followed_id
- `reading_history` — user_id, post_id, read_at, time_spent
- `user_tag_affinity` — user_id, tag_id, affinity_score (recomputed nightly)
- `likes`, `bookmarks` — user_id, post_id (or comment_id)

## 8. Security Considerations

- Password hashing via bcrypt/argon2
- JWT-based auth with short-lived access tokens + refresh tokens
- Role-based access control (admin/editor/reader) enforced at the middleware layer
- Input validation and sanitization on all write endpoints (XSS prevention on comments/posts)
- Rate limiting on auth endpoints (login attempts) and comment posting (spam prevention)
- Postgres/Redis never exposed publicly — only reachable on the internal Docker network; only the reverse proxy is internet-facing

## 9. Observability

- `docker compose logs` / `docker stats` initially
- Log rotation configured to avoid disk exhaustion on the VPS
- Bull Board (or similar) for inspecting BullMQ queue health and failed jobs
- Basic uptime/health check endpoint (`/health`) polled externally (e.g. UptimeRobot)

---