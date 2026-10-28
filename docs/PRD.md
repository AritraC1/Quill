# Quill — Product Requirements Document (PRD)

> **Status: Living document — last checked against the codebase on 2026-10-28.** Status distinguishes server-backed behavior from UI prototypes and browser-local state. See [`CHANGE-LOG.md`](../CHANGE-LOG.md) for technical history.

## 1. Overview

Quill is an in-progress blog publishing and reading platform. Its product direction is to let authors publish writing and help readers discover it through a calm, relevant reading experience.

**Implemented today:** a passwordless identity API (signup, OTP login, cookie-backed access/refresh sessions), generated user handles, onboarding and profile-update endpoints, plus a React client. The feed, author profiles, following, bookmarks, and profile editing are currently prototypes using mock data or browser storage. The server has no mounted post or feed API. OTP generation and the verification bypass are hard-coded to `0000`, so authentication is not production-ready.

## 2. Problem Statement

The product aims to balance a simple writing experience with useful content discovery, without the complexity of a large multi-tenant publishing platform. Publishing, discovery, and engagement are product goals, not features currently delivered by the backend.

## 3. Target Users

- **Readers** — people who want a low-friction way to discover writing relevant to their interests.
- **Authors** — people who want to write, format, and publish posts.
- **Admins/editors** — people who manage content and moderate discussion; this role and its tools are not implemented.

## 4. Goals

- Get readers through onboarding and into a relevant reading experience.
- Provide an accessible writing and publishing workflow.
- Support reliable comments, follows, and other reader engagement.
- Build with maintainable application and deployment practices.

These are goals; the current implementation only covers part of the identity/onboarding flow and a mock reading UI.

## 5. Scope Evolution

| Original assumption | Current implementation | Implication |
|---|---|---|
| Email + password signup/signin | Signup uses name/email; login uses email OTP. OTP generation and the verification bypass are currently hard-coded to `0000`. | Remove the test code/bypass and add appropriate abuse protection before production. |
| Roles: admin / editor / reader | Not implemented; there is no role-based authorization or moderation workflow. | Defer roles until authorization requirements exist. |
| Post publishing domain | A `blogs` migration and partial repository exist, but no service/controller/routes are mounted. The repository update query is incomplete. | Post CRUD, drafts, publishing, and public content APIs remain unimplemented. |
| Personalized feed from onboarding interests | Onboarding API can store genres in `users.fav_genre`; the client proceeds even if that API request fails. The feed uses local mock stories. | No server feed or recommendation logic exists. |
| OAuth sign-in | Social sign-in UI is present but is not connected to OAuth providers. | Implement it or remove the UI before launch. |
| Persistent profile editing | The server exposes a profile update route, but the client edit form saves to browser storage. The API also references columns missing from migrations. | Complete schema/API integration before claiming profile edits persist. |

## 6. Core User Stories — with status

### Reader

- ⏳ Sign up and choose topics so the feed is relevant. *(Onboarding has an API endpoint, but the client treats API failure as non-fatal; the feed does not use genres.)*
- ⏳ Switch between “Following” and “For you.” *(Both tabs exist over local mock stories; no server feed exists.)*
- ⬜ Comment on posts and reply to comments. *(No post or comment API.)*
- ⏳ Like or bookmark posts. *(Bookmarks are browser-local; displayed likes are mock data.)*
- ⏳ Follow authors and see their posts. *(Following state and profiles are client-side mock/local data.)*
- ⏳ Search for posts by keyword, topic, or author. *(Search filters the local story collection.)*

### Author

- ⏳ Add a profile image and bio. *(Onboarding attempts server sync; profile editing is local-only. Images are data URLs; no object storage.)*
- ⏳ Have a unique public handle/profile URL. *(The server generates a unique handle on first successful login, but there is no public profile lookup API.)*
- ⬜ Write and preview a post.
- ⬜ Save drafts, publish, or schedule a post.
- ⬜ Tag posts and view post analytics.

### Admin/editor

- ⬜ Admin/editor roles, moderation, and analytics are not implemented.

## 7. Onboarding Flow — current behavior

1. ✅ Create an account with name and email.
2. ✅ Request and verify an email OTP. **Current development limitation:** the code is hard-coded to `0000`, which is also accepted as a bypass.
3. ⏳ Select at least one favorite genre. The UI requires one; `POST /api/auth/onboard` also enforces one and stores genres/avatar/bio when it succeeds. The UI logs a failed API save and continues with browser-local state.
4. ⏳ Navigate to the feed prototype, which currently displays mock stories.
5. ⏳ Edit profile at `/profile/edit`; current changes persist only in local storage and do not call the profile API.

## 8. Feature Scope

### Must-have (MVP)

| Item | Status |
|---|---|
| Signup, OTP login, and cookie-based access/refresh sessions | ⏳ Implemented as an API flow, but hard-coded OTP behavior blocks production readiness |
| Handle generation | ✅ Server-side generation with unique constraint and collision retry |
| Post CRUD, drafts, and publish | ⬜ Not implemented; only an incomplete `blogs` repository scaffold exists |
| Tags/categories | ⬜ Not implemented |
| Comments | ⬜ Not implemented |
| Persistent follows | ⬜ Not implemented; client uses local storage |
| Server-backed chronological feed | ⬜ Not implemented; client uses mock data |

### Should-have

| Item | Status |
|---|---|
| Personalized feed | ⬜ No server feed, ranking, or recommendation jobs |
| Persistent likes and bookmarks | ⬜ Bookmarks are local-only; likes are mock content |
| Search | ⬜ Client-only filtering of mock content |
| Image uploads and optimization | ⬜ Images are client-side data URLs; no object storage or image worker |
| Scheduled publishing | ⬜ Not implemented |

### Later

- Collaborative filtering, real-time comments, notifications, RSS/SEO, analytics, and digest emails are not implemented.
- The worker currently handles OTP email delivery only.

### Explicitly deferred

- Multi-tenancy.
- Microservice decomposition and message broker/pub-sub.
- Kubernetes.
- Paywall/monetization.

## 9. Success Metrics

- **Activation:** users completing onboarding and reaching the feed.
- **Engagement:** posts read per user and comment/like rate.
- **Retention:** users returning within seven days.
- **Feed quality:** interaction with recommendations versus followed-author content.
- **Author satisfaction:** time to publish.

No analytics or instrumentation currently collects these metrics.

## 10. Open Questions and launch blockers

- What is the publishing/content model: posts, blogs, or both?
- What should feed ranking use, and what privacy/retention policy should apply to reading history?
- What is the moderation workflow?
- Should OTP-only sign-in remain the sole authentication method?
- Add migrations for `users.website` and `users.handle_changed_at` before relying on profile API behavior; complete and test the profile endpoint.
- Remove the hard-coded OTP and bypass, then add abuse protection and test the production email flow.

## 11. Related Documents

| Document | Contents |
|---|---|
| [`Architecture.md`](./Architecture.md) | Implemented component and request-flow overview |
| [`System-Design.md`](./System-Design.md) | Current infrastructure and future operational considerations |
| [`API.md`](./API.md) | REST API reference and implementation gaps |
| [`../CHANGE-LOG.md`](../CHANGE-LOG.md) | Chronological technical change log |
