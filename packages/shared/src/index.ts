// -------------- AUTH -------------- //

export interface SignUpRequestDTO {
  name: string;
  email: string;
}

export interface RequestOtpDTO {
  email: string;
}

export interface VerifyOtpDTO {
  email: string;
  otp: string;
}

/**
 * Login is transport-layered now:
 * - tokens are delivered as httpOnly cookies (never exposed to JS)
 * - the JSON body only carries non-sensitive session metadata
 */
export interface AuthResponseDTO {
  onboardingCompleted: boolean;
}

/** Result of GET /auth/session — used by the client to restore/verify auth state on boot */
export interface SessionResponseDTO {
  authenticated: boolean;
  onboardingCompleted?: boolean;
}

export interface RefreshTokenDTO {
  refreshToken?: string; // optional — the httpOnly cookie is preferred
}

// -------------- USER -------------- //

/** GET /user/me — the signed-in user's profile (bio comes from onboarding) */
export interface UserProfileDTO {
  id: string;
  name: string;
  bio?: string | null; // empty until written during onboarding or edited
  avatar?: string | null;
  handle?: string | null; // system-generated at first login; editable 1×/6 months
  handleChangedAt?: string | null; // ISO date of the last handle change
  website?: string | null;
  favGenre: string[];
  createdAt: string; // ISO — "member since" on the profile page
}

/** GET /user/:handle — any writer's public profile */
export interface PublicProfileDTO {
  id: string;
  name: string;
  bio?: string | null;
  avatar?: string | null;
  handle: string;
  website?: string | null;
  favGenre: string[];
  createdAt: string;
  followers: number;
  isFollowing: boolean; // viewer state (every /user route requires auth)
}

/** POST /user/avatar — uploaded image, stored on disk, referenced by URL */
export interface AvatarUploadDTO {
  url: string; // "/uploads/<name>" — resolve against the API origin
}

/** Result of following / unfollowing a writer */
export interface FollowResultDTO {
  handle: string;
  isFollowing: boolean;
  followers: number;
}

// Onboarding a new user
export interface OnboardRequestDTO {
  avatar?: string;
  bio?: string;
  favGenre: string[];
}

// Edit profile
export interface EditProfileDTO {
  name?: string; // real display name (2–50 chars, server-validated)
  avatar?: string;
  bio?: string;
  favGenre: string[];
  handle?: string;
  website?: string;
}

// -------------- BLOG -------------- //

// Blogs are always saved as drafts and only go live when explicitly published
export type BlogStatus = "draft" | "published";

export interface CreateBlogDTO {
  title?: string; // drafts may start untitled
  content?: string; // markdown / rich-text source
  description?: string;
  images?: string[];
}

export interface UpdateBlogDTO {
  title?: string;
  content?: string;
  description?: string;
  images?: string[];
}

export interface BlogAuthorDTO {
  id: string;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

/** Serialized blog as returned by every blog endpoint */
export interface BlogResponseDTO {
  id: string;
  userId: string;
  title: string;
  content: string;
  description: string;
  images?: string[] | null;
  status: BlogStatus;
  publishedAt: string | null;
  scheduledPublishAt?: string | null; // set while waiting for the publishing worker
  createdAt: string;
  updatedAt: string;
  author?: BlogAuthorDTO; // present on list/detail responses
  isBookmarked?: boolean; // last saved/unsaved state for the viewer
}

/** Writer statistics — GET /blogs/count */
export interface BlogCountDTO {
  published: number;
  drafts: number;
  total: number;
}

// Workflow body for POST /blogs/:id/publish
// Omit publishAt for an instant publish; set it to schedule the release
export interface PublishBlogDTO {
  publishAt?: string; // ISO datetime, must be in the future
}

/** Result of a bookmark toggle */
export interface BlogBookmarkDTO {
  blogId: string;
  isBookmarked: boolean;
}

/** Query params for list endpoints (GET /blogs, /blogs/drafts, ...) */
export interface BlogListQueryDTO {
  page?: number;
  limit?: number;
  /** Optional author handle — narrows the feed to one writer's published blogs */
  author?: string;
}
