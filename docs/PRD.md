# Quill — Product Requirements Document (PRD)

> **Status: Living document — last updated 2026-10-28** to reflect what has actually been built (auth/onboarding/profile) versus what remains in the backlog. See the "Status" markers throughout, and `CHANGE-LOG.md` for the technical history.

## 1. Overview

Quill is a blog publishing and reading platform. Authors write and publish posts; readers discover content through personalized feeds, follow authors they like, and engage via comments, likes, and bookmarks. It is built as a learning project but scoped and structured as a real product.

**Implemented so far:** the end-to-end identity layer — passwordless auth (email OTP + JWT access/rotating refresh tokens), auto-generated handles, onboarding (genres/avatar/bio), profile editing, and a shell of the reading experience (feed/profile UI currently powered by mock data while the blog domain is scaffolded on the server).

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

## 5. Scope Evolution (what actually changed from the original plan)

The original plan assumed password-based auth + roles. The built product took a different shape, and the PRD tracks it:

| Original assumption | Actual build | Rationale / implication |
|---|---|---|
| Email + password signup/signin | **Passwordless — sign-up with name+email, login via emailed OTP**; account creation and first login can technically be one flow | Removes password management entirely (no password reset UX, less phishing surface); Resend delivers codes |
| Roles: admin / editor / reader | **Not implemented** — single user type | Deferred until moderation exists (there is nothing to moderate yet) |
| "Posts" domain | Scaffolding exists as a **`blog` domain** (entity + partial repository) — no service/routes yet | Naming drifted; unify as `posts` when wiring up |
| Personalized feed from onboarding genres | Onboarding genres persist to Postgres (`users.fav_genre`); the feed UI reads only **local mock data** | Backend feed logic is the next major work item |
| OAuth (Google/Facebook) buttons | UI buttons present, **non-functional** | Either build OAuth or remove the buttons before launch |

## 6. Core User Stories — with status

### Reader
- ✅ As a reader, I can sign up and select topics I'm interested in, so my feed is relevant from the start. *(genres persisted server-side; feed not yet consuming them)*
- ⏳ As a reader, I can switch between an "Authors I Follow" feed and a "For You" feed personalized to my reading habits. *(both tabs exist in UI; backed by local mocks)*
- ❌ As a reader, I can comment on a post and reply to other comments.
- ⏳ As a reader, I can like and bookmark posts to revisit later. *(bookmarks are localStorage-only right now)*
- ⏳ As a reader, I can follow an author to see their new posts in my feed. *(follow state is localStorage-only)*
- ⏳ As a reader, I can search for posts by keyword, tag, or author. *(header search filters mock data only)*

### Author
- ✅ As an author, I can upload a profile image and bio. *(client-side crop/resize; stored as data URL — object storage integration pending)*
- ✅ As an author, I have a unique public handle for my profile URL (/u/:handle).
- ⬜ As an author, I can write a post in markdown with a live preview.
- ⬜ As an author, I can save a post as a draft and publish it later, or schedule it for a future date.
- ⬜ As an author, I can tag my post with relevant categories.
- ⬜ As an author, I can see basic stats (views, likes, comments) on my posts.

### Admin/Editor
- ❌ All admin stories — deferred until multi-role content exists.

## 7. Onboarding Flow — built as specified

1. ✅ Sign up (name/email; OTP verification doubles as login)
2. ✅ Select favorite genres (minimum 1 enforced client- and server-side; skippable is NOT enforced — original plan said min 3 skippable; we enforce ≥1)
3. ✅ Redirect directly to home feed — **not** a profile setup screen
4. ✅ Profile completion (avatar, bio) is part of onboarding, and editable later via `/profile/edit`

Rationale: minimizing time-to-first-feed is prioritized over completeness of profile data, since the feed is the core "aha moment" of the product.

## 8. Feature Scope (by priority — current state)

**Must-have (MVP)**

| Item | Status |
|---|---|
| Auth (signup via OTP, JWT access + rotating refresh tokens) | ✅ done |
| Account handle generation (first-login, unique, collision-retried) | ✅ done |
| Post CRUD (create, edit, delete, draft/publish) | ⬜ next up — `blog` domain scaffolded (repository partial; service/controller/routes empty) |
| Tags/categories | ⬜ blocked on posts |
| Comments (flat, then threaded) | ⬜ |
| Follow system (persistent, server-side) | ⬜ (localStorage mock exists) |
| Basic feed (reverse chronological) | ⬜ (UI exists; mock data) |

**Should-have**

| Item | Status |
|---|---|
| "For You" personalized feed (tag-affinity based) | ⬜ design in `System-Design.md` §6 |
| Likes, bookmarks (persisted) | ⬜ (client-side mock exists) |
| Search | ⬜ |
| Image upload with optimization (server-side) | ⬜ (avatars currently base64 client-side) |
| Scheduled publishing | ⬜ |

**Nice-to-have / later**

- Collaborative filtering for recommendations
- Real-time comment updates
- Notifications system
- RSS feed, SEO metadata
- Admin analytics dashboard
- Weekly digest emails (worker infra ✅ already exists — the job just needs creating)

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

> Metrics are still aspirational: no analytics are collected yet. Instrumentation should come with the posts domain.

## 10. Open Questions

- What's the minimum reading history needed before the "For You" feed outperforms genre-only cold-start recommendations?
- Should comment moderation be pre- or post-publish?
- At what user/content volume does search need to move from Postgres full-text to a dedicated search engine (Elasticsearch)?
- **New:** do we keep passwordless-OTP-only login long term, or layer OAuth on top? The Google/Facebook buttons are dead UI until decided.
- **New:** `handle_changed_at` and `website` columns are missing from migrations — finalize handle-change policy UI before launching edit-profile to real users.

## 11. Related Documents

| Document | Contents |
|---|---|
| [`Architecture.md`](Architecture.md) | technical component breakdown |
| [`System-Design.md`](System-Design.md) | scaling, infra, and data model details |
| [`docs/API.md`](docs/API.md) | full REST API reference (what's built today) |
| [`CHANGE-LOG.md`](CHANGE-LOG.md) | chronological change log |
