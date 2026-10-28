# Quill Client

The React single-page app for Quill — landing page, passwordless auth (email OTP), onboarding, feed, and profile management.

## Stack

- **React 19** + **TypeScript**
- **Vite 8** (dev server + bundler)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **react-router-dom v7** (`createBrowserRouter` + route guards)
- **sonner** for toasts, **lucide-react** / **react-icons** for icons
- Shared DTO types from `@quill/shared` (workspace package)

## Getting Started

```bash
# from repo root
bun install
cp .env.example .env           # VITE_API_URL must point at the API (default http://localhost:3000/api)
bun run dev:client             # Vite dev server at http://localhost:5173
```

The dev server reads `.env` from the **repo root** (`envDir` in `vite.config.ts`), so auth-related env vars live next to the server's.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` (inside `apps/client`) | Vite dev server with HMR |
| `bun run build` | `tsc -b` type check + production bundle → `dist/` |
| `bun run lint` | ESLint |
| `bun run preview` | Serve the production build locally |

## Structure

```
apps/client/src/
├── main.tsx                 entry (createRoot, StrictMode, Toaster)
├── App.tsx                  mounts RouterProvider
├── routes/
│   ├── Router.tsx           path → page mapping (createBrowserRouter)
│   ├── ProtectedRoute.tsx   redirects unauthenticated users to "/"
│   └── PublicOnlyRoute.tsx  bounces signed-in users to /feed or /onboarding
├── features/                domain-driven feature folders
│   ├── auth/
│   │   ├── api/             auth.api.ts — fetch helpers, localStorage token store, single-flight refresh
│   │   ├── hooks/           useAuth() — session/initialization state
│   │   ├── components/      AuthPopupForm (multi-step auth modal), RememberMe
│   │   └── onboarding/      OnboardingView — genres, avatar, bio → POST /auth/onboard
│   ├── feed/                FeedPage — For you / Following tabs, StoryCard list (data mocked)
│   └── profile/             ProfilePage (/profile, /u/:handle), EditProfilePage, useOwnProfile hook
├── components/
│   ├── layout/AppShell.tsx  sticky header, search, avatar menu, footer, mobile nav
│   └── ui/                  StoryCard, SocialButton, TopicPill, CurvedArrow, InkIllustration
├── pages/                   LandingPage, StatusPage, NotFoundPage
├── hooks/useStoredSet.ts    localStorage-backed set state (bookmarks, follows)
├── data/                    mock stories/authors while the blog API is unwired
├── lib/api-routes.ts        route constants shared with API calls
└── index.css                Tailwind import, fonts, ink-draw animation, grain texture
```

## Routes

| Path | Access | Description |
|---|---|---|
| `/` | public (redirects if signed in) | Landing page + auth modal |
| `/status` | public | Service status (stub) |
| `/onboarding` | protected | Genre/avatar/bio selection |
| `/feed` | protected | For you / Following feed |
| `/profile` | protected | Own profile (stories, drafts, saved, about) |
| `/profile/edit` | protected | Edit name, bio, topics, avatar, website |
| `/u/:handle` | protected | Public author profile |
| `*` | — | 404 "torn page" |

## Auth flow

1. `AuthPopupForm` collects name/email → `POST /auth/sign-up`, then `POST /auth/request-otp`
2. OTP entry → `POST /auth/verify-otp` → the server **sets httpOnly auth cookies** (`quill_access_token` path `/`, `quill_refresh_token` path `/api/auth`); `HttpOnly` + `SameSite=Lax` (`Secure` in production) means the tokens are **never readable by JavaScript**
3. `useAuth()` restores the session on mount via `GET /auth/session` (single-flight — one request regardless of how many components call `useAuth()`), which also returns the `onboardingCompleted` flag
4. `fetchWithAuth()` sends `credentials: "include"`; on a `401` (expired access token) it rotates the session once via `POST /auth/refresh-token` and retries
5. Logout → `DELETE /auth/logout` revokes all refresh tokens server-side and clears both cookies

> Dev convenience: OTP `0000` always verifies while `AUTH_TEST_OTP` is enabled in the server (see server README before deploying).

## Docker

`Dockerfile` is multi-stage:

- `dev` — Vite dev server with hot reload, `--host 0.0.0.0`
- `build` → `production` — static bundle served by **nginx:alpine**; `nginx.conf` provides SPA fallback (`try_files … /index.html`) and reverse-proxies `/api/` → `server:3000` and `/docs/` so the browser never needs CORS in production

## Known limitations

- Feed, profile stories/drafts/following, and search are **mocked locally** (`src/data/`) — the blog/feed domain is not wired to the API yet
- **Auth tokens are httpOnly cookies** (`quill_access_token` path `/`, `quill_refresh_token` path `/api/auth`) — session state is restored boot-time via `GET /auth/session`; the display name is persisted separately in `quill_user` while a "get me" API doesn't exist
- No error boundary — a render error currently blanks the page (root-level loader only)
- Avatar images are stored as base64 data URLs in localStorage (size-limited); real uploads need object storage
