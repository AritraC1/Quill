# Quill Client

The React single-page application for Quill: passwordless auth, onboarding, reading feeds, author profiles, post writing/reading, notifications, and settings.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- React Router 7
- `sonner`, `lucide-react`, and `react-icons`
- Shared DTOs from `@quill/shared`

## Local development

From the repository root:

```bash
bun install
cp .env.example .env
bun run dev:client
```

Vite runs on `http://localhost:5173`. It reads the root `.env` (`envDir` in `vite.config.ts`). The client uses `VITE_API_URL` if set; otherwise development defaults to `http://localhost:3000/api`, while a production build uses the same-origin `/api` path.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Vite development server |
| `bun run build` | TypeScript project build and production bundle in `dist/` |
| `bun run lint` | ESLint |
| `bun run preview` | Preview the production bundle locally |

## Structure

```text
src/
├── routes/                 Router and route guards
├── pages/                  Landing, status placeholder, and not-found pages
├── features/
│   ├── auth/                OTP auth and onboarding
│   ├── blog/                API client, editor, reader, and markdown utilities
│   ├── feed/                For You / Following feeds and suggestions
│   ├── notifications/       Notification API and navbar bell
│   ├── profile/             Profiles, followers, and profile editing
│   └── settings/            Account, profile, reading, notification, privacy,
│                            and data/account settings UI
├── components/              Shared layout and UI components
├── data/                    Fallback stories/profile data
├── hooks/                   Shared React hooks
└── lib/                     API routes, date, initials, and user helpers
```

## Routes

| Path | Access | Purpose |
|---|---|---|
| `/` | Public; authenticated users are redirected | Landing page and auth flow |
| `/status` | Public | Placeholder page, not a health probe |
| `/onboarding` | Authenticated | Topic, avatar, and bio onboarding |
| `/feed` | Authenticated | Paginated For You and Following feeds |
| `/profile` | Authenticated | Own profile; canonicalizes to the user's `/:handle` path |
| `/profile/edit` | Authenticated | Edit profile |
| `/u/:handle` | Authenticated | Legacy profile URL |
| `/:handle` | Authenticated | Canonical writer profile |
| `/write`, `/write/:id` | Authenticated | Create/edit drafts and publish or schedule |
| `/blog/:id` | Authenticated | Read a post |
| `/settings` | Authenticated | Account, reading preferences, notifications, and data controls |
| `*` | — | Not-found page |

## Authentication and API behavior

The API sets `quill_access_token` and `quill_refresh_token` as httpOnly cookies; client JavaScript never reads the token values. Requests include credentials. `useAuth()` restores the session through `/auth/session`; `fetchWithAuth()` performs a single-flight refresh and retries once after a 401. Logout supports this device or all sessions.

The client uses API-backed profiles, posts, bookmarks, follows, follower lists, suggestions, notifications, settings, and account deletion. The For You feed uses saved genres to filter tagged posts while retaining untagged legacy posts; topic chips filter pages currently loaded in the client. Story search queries the server across published posts using substring matching (not ranked full-text or semantic search). If a feed request fails, profile and blog operations otherwise depend on the API.

Saved default tab, reader text size and theme, and in-app notification switches are applied. The worker sends opted-in follower emails and weekly digests (Mondays at 09:00 UTC). Product-news email is disabled until a newsletter source exists. The status route is only a placeholder.

> **Development limitation:** the server currently issues and accepts the fixed OTP `0000`. Do not deploy this auth flow publicly until the test behavior is removed.

## Docker

The multi-stage `Dockerfile` has a Vite dev target and a production target that serves the build with Nginx. `nginx.conf` provides SPA fallback and proxies `/api/`, `/docs/`, and `/uploads/` to the server service.
