# Quill — Frontend

## Overview

Quill's frontend is a React + TypeScript application, styled with Tailwind CSS and built with Vite. It's structured by **feature domain** rather than by file type, so each part of the product (posts, comments, feed, auth, profile) owns its own components, hooks, and API calls end to end.

## Tech Stack

- React (TSX)
- Tailwind CSS
- Vite (dev server + build)
- React Router (routing)
- Bun (package manager, monorepo workspace)

## Folder Structure

```
apps/client/src/
├── features/
│   ├── auth/
│   │   ├── components/        (LoginForm, SignupForm)
│   │   ├── hooks/              (useAuth)
│   │   ├── api/                (auth.api.ts)
│   │   └── types.ts
│   │
│   ├── posts/
│   │   ├── components/         (PostCard, PostEditor, PostList)
│   │   ├── hooks/               (usePosts, usePost)
│   │   ├── api/                 (posts.api.ts)
│   │   └── types.ts
│   │
│   ├── comments/
│   │   ├── components/          (CommentThread, CommentForm)
│   │   ├── hooks/                (useComments)
│   │   └── api/                  (comments.api.ts)
│   │
│   ├── feed/                     (Following + For You tabs)
│   │   ├── components/           (FeedTabs, FollowingFeed, ForYouFeed)
│   │   ├── hooks/                 (useFeed)
│   │   └── api/                   (feed.api.ts)
│   │
│   ├── profile/
│   │   ├── components/           (ProfileHeader, FollowButton)
│   │   ├── hooks/                 (useProfile)
│   │   └── api/                   (profile.api.ts)
│   │
│   └── notifications/
│       ├── components/            (NotificationBell)
│       ├── hooks/                  (useNotifications)
│       └── api/                    (notifications.api.ts)
│
├── pages/                          (route-level compositions)
│   ├── LandingPage.tsx
│   ├── HomePage.tsx                (the feed, post-login)
│   ├── PostPage.tsx                (single post view)
│   ├── ProfilePage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── OnboardingPage.tsx          (genre selection)
│   └── NotFoundPage.tsx
│
├── components/                     (shared, generic UI)
│   ├── ui/                         (Button, Modal, Avatar, Spinner)
│   └── layout/                     (Navbar, Sidebar, PageLayout)
│
├── lib/                             (cross-cutting utilities)
│   ├── api-client.ts                (base fetch instance)
│   ├── query-client.ts              (data-fetching/caching config)
│   └── utils.ts
│
├── routes/
│   ├── router.tsx                   (path → page mapping, layout nesting, route guards)
│   └── ProtectedRoute.tsx
│
├── store/                            (global state — auth, etc.)
│   └── auth.store.ts
│
├── App.tsx
└── main.tsx
```

## Design Principles

- **`features/`** holds real business logic — data fetching, mutations, domain-specific state. Mirrors the backend's domain split one-to-one (`features/posts` ↔ `domains/posts` on the server).
- **`pages/`** are composition roots — thin, layout-focused, pulling together components from one or more features. They don't own business logic themselves.
- **`components/`** stays strictly generic and reusable — a `Button` or `Avatar` has no knowledge of posts, comments, or any domain.
- **`router.tsx`** only wires paths to pages and applies layout/auth guards — it never contains data fetching or business logic.

## Key Flows

**Onboarding → Feed**
1. Signup → `OnboardingPage` (genre selection, minimum 3, skippable)
2. On completion, redirect directly to `HomePage` (the feed) — not a profile setup screen
3. `useFeed` hook fetches the "For You" feed, seeded by selected genres if no reading history exists yet

**Feed Tabs**
- `FeedTabs` component switches between `FollowingFeed` (posts from followed authors) and `ForYouFeed` (personalized recommendations)
- Both call `feed.api.ts`, which hits the backend's `feed` domain endpoints

**Auth Guarding**
- `ProtectedRoute` checks `auth.store` and redirects unauthenticated users to `/login`
- Wraps any route requiring login (feed, profile, post editor)

## Local Development

```bash
docker compose up client
```

Runs the Vite dev server with hot reload on port `5173`, proxying API calls to the Express backend on `4000`.

---