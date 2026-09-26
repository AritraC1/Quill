# Quill — Product Requirements Document (PRD)

## 1. Overview

Quill is a blog publishing and reading platform. Authors write and publish posts; readers discover content through personalized feeds, follow authors they like, and engage via comments, likes, and bookmarks. It is built as a learning project but scoped and structured as a real product.

## 2. Problem Statement

Existing blogging tools are either too simple (no discovery, no personalization — just a list of posts) or too heavy (full platforms with complexity unrelated to a small team's needs). Quill aims for a middle ground: a clean publishing experience for authors, paired with a genuinely useful personalized reading experience — comparable in spirit to Medium, but scoped to a single blog/small set of contributors rather than an open multi-tenant platform.

## 3. Target Users

- **Readers** — people who want a personalized, low-friction way to discover and read posts relevant to their interests
- **Authors** — people who want to write, format, and publish posts without fighting the tool
- **Admins/Editors** — manage content, moderate comments, and view basic analytics

## 4. Goals

- Fast, low-friction onboarding that gets a new user to relevant content immediately
- A genuinely personalized "For You" feed, not just a reverse-chronological list
- A clean writing/editing experience for authors (drafts, scheduling, tags, markdown)
- Reliable engagement features (comments, likes, follows) that make the platform feel alive
- A codebase and infrastructure that reflect real production practices (not just a toy CRUD app)

## 5. Non-Goals (for now)

- Multi-tenant publishing platform (anyone can sign up and publish under their own space) — Quill is scoped to a single blog/small set of authors, not an open platform like Medium itself
- Monetization/paywall features
- Native mobile apps
- Real-time collaborative editing
- Full microservices architecture — deferred until there's a concrete reason to split services

## 6. Core User Stories

### Reader
- As a reader, I can sign up and select a few topics I'm interested in, so my feed is relevant from the start.
- As a reader, I can switch between an "Authors I Follow" feed and a "For You" feed personalized to my reading habits.
- As a reader, I can comment on a post and reply to other comments.
- As a reader, I can like and bookmark posts to revisit later.
- As a reader, I can follow an author to see their new posts in my feed.
- As a reader, I can search for posts by keyword, tag, or author.

### Author
- As an author, I can write a post in markdown with a live preview.
- As an author, I can save a post as a draft and publish it later, or schedule it for a future date.
- As an author, I can tag my post with relevant categories.
- As an author, I can upload a featured image for my post.
- As an author, I can see basic stats (views, likes, comments) on my posts.

### Admin/Editor
- As an admin, I can moderate comments (approve/remove).
- As an admin, I can view platform-wide analytics (top posts, active users).
- As an admin, I can manage user roles.

## 7. Onboarding Flow

1. Sign up (email/password or OAuth)
2. Select favorite genres/topics (minimum 3, skippable)
3. Redirect directly to home feed — **not** a profile setup screen — so the user reaches value (seeing personalized content) immediately
4. Profile completion (avatar, bio) offered as a dismissible, non-blocking nudge afterward

Rationale: minimizing time-to-first-feed is prioritized over completeness of profile data, since the feed is the core "aha moment" of the product.

## 8. Feature Scope (by priority)

**Must-have (MVP)**
- Auth (signup/login, JWT, roles)
- Post CRUD (create, edit, delete, draft/publish)
- Tags/categories
- Comments (flat, then threaded)
- Follow system
- Basic feed (reverse chronological)

**Should-have**
- "For You" personalized feed (tag-affinity based)
- Likes, bookmarks
- Search
- Image upload with optimization
- Scheduled publishing

**Nice-to-have / later**
- Collaborative filtering for recommendations
- Real-time comment updates
- Notifications system
- RSS feed, SEO metadata
- Admin analytics dashboard
- Weekly digest emails

**Explicitly deferred**
- Multi-tenancy
- Microservices split / message broker pub-sub
- Kubernetes
- Paywall/monetization

## 9. Success Metrics

- **Activation:** % of new users who complete onboarding (genre selection) and reach the feed
- **Engagement:** average posts read per user per week; comment/like rate per post
- **Retention:** % of users returning within 7 days of signup
- **Feed quality:** click-through rate on "For You" recommendations vs. "Authors I Follow" feed
- **Author satisfaction:** average time to publish a post (editor friction proxy)

## 10. Open Questions

- What's the minimum reading history needed before the "For You" feed outperforms genre-only cold-start recommendations?
- Should comment moderation be pre- or post-publish?
- At what user/content volume does search need to move from Postgres full-text to a dedicated search engine (Elasticsearch)?

## 11. Related Documents

- `Architecture.md` — technical component breakdown
- `System-Design.md` — scaling, infra, and data model details

---