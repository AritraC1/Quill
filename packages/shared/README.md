# `@quill/shared`

Shared compile-time TypeScript DTOs and constants consumed by `apps/client` and `apps/server` through Bun workspaces. This package has no runtime validation layer; server request validation lives in `apps/server/src/core/validation`.

## Usage

```ts
import type { UserProfileDTO, BlogResponseDTO } from "@quill/shared";
import { SETTINGS_GENRES, TEXT_SIZE_RANGE } from "@quill/shared";
```

Add `"@quill/shared": "workspace:*"` to a consuming workspace package's dependencies.

## Export groups

| Group | Representative exports |
|---|---|
| Auth | `SignUpRequestDTO`, `RequestOtpDTO`, `VerifyOtpDTO`, `LogoutRequestDTO`, `LogoutScope`, `AuthResponseDTO`, `SessionResponseDTO`, `RefreshTokenDTO` |
| User/profile | `UserProfileDTO`, `PublicProfileDTO`, `EditProfileDTO`, `OnboardRequestDTO`, `AvatarUploadDTO`, `FollowResultDTO`, `FollowerDTO`, `FollowerListDTO` |
| Settings | `UserSettingsDTO`, `UpdateUserSettingsDTO`, `SettingsNotificationsDTO`, feed/theme preference types, `SETTINGS_GENRES`, `TEXT_SIZE_RANGE` |
| Account | `DeleteAccountResultDTO` |
| Blog and reading | `BlogStatus`, `CreateBlogDTO`, `UpdateBlogDTO`, `BlogAuthorDTO`, `BlogResponseDTO`, `BlogCountDTO`, `PublishBlogDTO`, `BlogBookmarkDTO`, `BlogListQueryDTO` |
| Comments | `CommentDTO`, `CommentListDTO`, create/update DTOs, reaction types and summaries |
| Clubs and chat | Club, membership, application, invitation, submission/review, conversation, message, activity, and collaborative-draft DTOs |
| Notifications | Notification types, actors, blog/club previews, list and unread-count DTOs |

These are compile-time API/data contracts, not runtime validators or a generated API client. For implemented behavior and API routes, see the [API reference](../../docs/API.md).

## Source

Types and shared constants are defined in [`src/index.ts`](./src/index.ts). Bun resolves the package source directly; there is no separate build or publish step.
