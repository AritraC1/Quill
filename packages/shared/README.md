# @quill/shared

Shared TypeScript type definitions used by both `apps/client` and `apps/server`, distributed through Bun workspaces (`"workspace:*"` — no publishing, no version drift).

## Usage

```ts
import type { SignUpRequestDTO, AuthResponseDTO } from "@quill/shared";
```

Add the workspace dependency in the consuming package.json:

```jsonc
"dependencies": { "@quill/shared": "workspace:*" }
```

## Exports

### Auth

| Type | Used by | Shape |
|---|---|---|
| `SignUpRequestDTO` | client & server | `{ name, email }` |
| `RequestOtpDTO` | client & server | `{ email }` |
| `VerifyOtpDTO` | client & server | `{ email, otp }` |
| `RefreshTokenDTO` | client & server | `{ refreshToken }` |
| `AuthResponseDTO` | client & server | `{ accessToken, refreshToken, onboardingCompleted? }` |

### User

| Type | Used by | Shape |
|---|---|---|
| `OnboardRequestDTO` | client & server | `{ avatar?, bio?, favGenre }` |
| `EditProfileDTO` | client & server | `{ avatar?, bio?, favGenre, handle?, website? }` |

### Blog

| Type | Used by | Shape |
|---|---|---|
| `CreateBlogDTO` | server (repository) | `{ title, description, images? }` |
| `UpdateBlogDTO` | server (repository) | `{ title, description, images? }` |

> **Note:** the blog domain is scaffolded only — these DTOs are referenced by `blog.repository.ts` but no route accepts them yet.

## Source

Everything lives in a single file: [`src/index.ts`](./src/index.ts). Add new DTOs there; both apps pick them up on the next dev/build run (Bun resolves the workspace package directly, no build step needed for typos — though a restart of `bun run dev` is required to re-resolve type changes).
