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

/** Body of DELETE /auth/logout.
 * - `scope: "device"` (default) revokes ONLY the presented session — the other
 *   signed-in devices keep working.
 * - `scope: "all"` is "sign out everywhere": every refresh token for the user
 *   is revoked, so every device has to sign back in with an email code.
 */
export interface LogoutRequestDTO {
  refreshToken?: string; // optional — the httpOnly cookie is preferred
  scope?: LogoutScope;
}

export type LogoutScope = "device" | "all";

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
  email: string; // sign-in address, authenticated responses ONLY (never on /user/:handle)
  bio?: string | null; // empty until written during onboarding or edited
  avatar?: string | null;
  handle?: string | null; // system-generated at first login; editable 1×/6 months
  handleChangedAt?: string | null; // ISO date of the last handle change
  website?: string | null;
  favGenre: string[];
  followers: number; // how many people follow this user (backend-sourced)
  following: number; // how many people this user follows (backend-sourced)
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

/** One follower in a page of GET /user/:handle/followers */
export interface FollowerDTO {
  id: string;
  name: string;
  handle: string | null;
  avatar?: string | null;
  /** Does the viewer already follow this person back? ("Follow back" button) */
  isFollowing: boolean;
}

/** Page result of GET /user/:handle/followers?page&limit */
export interface FollowerListDTO {
  items: FollowerDTO[];
  total: number;
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

// -------------- SETTINGS -------------- //

/** Default feed tab — the tab you land on when you open Quill */
export type FeedTabPreference = "for-you" | "following";

/** Reading theme ("dark" is a valid stored value but not selectable in the UI yet) */
export type ReadingThemePreference = "light" | "sepia" | "dark";

/** Notification switches mirrored by GET/PUT /user/settings */
export type SettingsNotificationKey =
  | "appPosts"
  | "appFollowers"
  | "appScheduled"
  | "appReplies"
  | "emailDigest"
  | "emailFollowers"
  | "emailNews";

export interface SettingsNotificationsDTO {
  appPosts: boolean;
  appFollowers: boolean;
  appScheduled: boolean;
  appReplies: boolean;
  emailDigest: boolean;
  emailFollowers: boolean;
  emailNews: boolean;
}

/** Text-size bounds for the reader slider — shared so client and server agree */
export const TEXT_SIZE_RANGE = { min: 15, max: 24, default: 18 } as const;

/** The genre list shown as chips — server validates against these plus anything
 * already saved from onboarding (older lowercase values), so it is advisory */
export const SETTINGS_GENRES = [
  "Essays",
  "Design",
  "Technology",
  "Philosophy",
  "Culture",
  "Science",
  "Fiction",
  "Poetry",
  "History",
  "Travel",
] as const;

/** GET/PUT /user/settings — the user's saved preference snapshot.
 * GET returns it; PUT accepts the complete snapshot (always an object with
 * every field, so a save is the full state of the page's unsaved-changes bar.
 * The authenticated user id comes from the access token — a user id in the
 * body is ignored/stripped, never trusted). */
export interface UserSettingsDTO {
  /** Favourite genres — persisted in users.fav_genre (also the profile shapes) */
  genres: string[];
  defaultTab: FeedTabPreference;
  /** 15–24 px body text size */
  textSize: number;
  theme: ReadingThemePreference;
  notifications: SettingsNotificationsDTO;
}

/** PUT /user/settings is the same shape — kept as an alias so the request
 * contract is explicit in route/controller signatures */
export type UpdateUserSettingsDTO = UserSettingsDTO;

/** Result of DELETE /user/account — counts so the client can confirm honestly */
export interface DeleteAccountResultDTO {
  deleted: boolean;
  publishedPosts: number;
  drafts: number;
  bookmarks: number;
}

// -------------- BLOG -------------- //

// Blogs are always saved as drafts and only go live when explicitly published
export type BlogStatus = "draft" | "published";

export interface CreateBlogDTO {
  title?: string; // drafts may start untitled
  content?: string; // markdown / rich-text source
  description?: string;
  images?: string[];
  genres?: string[];
}

export interface UpdateBlogDTO {
  title?: string;
  content?: string;
  description?: string;
  images?: string[];
  genres?: string[];
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
  genres: string[];
  status: BlogStatus;
  publishedAt: string | null;
  scheduledPublishAt?: string | null; // set while waiting for the publishing worker
  createdAt: string;
  updatedAt: string;
  author?: BlogAuthorDTO; // present on list/detail responses
  isBookmarked?: boolean; // last saved/unsaved state for the viewer
  clubId?: string | null; // set when the blog is attributed to a club
  clubReviewStatus?: "pending" | "changes_requested" | "rejected" | null; // live review state of a club submission
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

// -------------- COMMENTS -------------- //

/** Reaction types on a comment — "like" (clap) and "heart" (love) */
export type CommentReactionType = "like" | "heart";

/** Query for the comment page: GET /blogs/:blogId/comments?page&limit */
export interface CommentListQueryDTO {
  page?: number;
  limit?: number;
}

/** Comment author — joined from users on every comment response */
export interface CommentAuthorDTO {
  id: string;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

/** Reaction totals for one comment, per type + combined */
export interface CommentReactionSummaryDTO {
  like: number;
  heart: number;
  total: number;
}

/** Serialized comment as returned by every comment endpoint.
 * Top-level comments in a list result carry their direct replies inline
 * (two visible levels: replies never have children of their own). */
export interface CommentDTO {
  id: string;
  blogId: string;
  userId: string; // author id (ownership checks on the client)
  parentCommentId: string | null; // null = top-level comment
  /** Soft-deleted comments answer "" — the client shows "Comment deleted" */
  body: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt: string | null; // null while the comment is alive
  author: CommentAuthorDTO;
  replyCount: number; // live (non-deleted) direct replies
  reactions: CommentReactionSummaryDTO;
  /** The viewer's reaction types on this comment, ["like"], ["heart"], or both */
  viewerReactions: CommentReactionType[];
  replies?: CommentDTO[]; // only present on top-level comments of a list
}

/** Body of POST /blogs/:blogId/comments (parentCommentId makes it a reply) */
export interface CreateCommentDTO {
  body: string;
  parentCommentId?: string;
}

/** Body of PATCH /comments/:commentId */
export interface UpdateCommentDTO {
  body: string;
}

/** Page result of GET /blogs/:blogId/comments?page&limit */
export interface CommentListDTO {
  items: CommentDTO[];
  total: number;
}

/** Result of PUT / DELETE /comments/:commentId/reaction */
export interface CommentReactionResultDTO {
  commentId: string;
  /** The viewer's reaction types on the comment after the change */
  viewerReactions: CommentReactionType[];
}

// -------------- CLUBS -------------- //

// "My Clubs" writing collectives. Open clubs appear in Discover and accept
// applications; invite-only clubs are hidden from Discover and use
// invitations. Blogs published through a club keep their real author
// (user_id) internally while being attributed to the club (blog.club_id).

export type ClubPrivacy = "open" | "invite";
/** The UI's reviewer role is "moderator" */
export type ClubRole = "admin" | "moderator" | "member";
export type ClubApplicationStatus = "pending" | "approved" | "rejected";
export type ClubInvitationStatus = "pending" | "accepted" | "declined";
/** Decision of an admin/moderator on a club submission */
export type ClubReviewDecision = "approved" | "changes_requested" | "rejected";
export type ClubActivityType =
  | "member_joined"
  | "submission"
  | "review_decision"
  | "post_published"
  | "role_changed"
  | "application";

/** A lightweight person shape used across club payloads (members, authors,
 * reviewers, chat senders, activity actors) */
export interface ClubUserDTO {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
}

/** Serialized club as returned by Mine / Discover / invitations / detail */
export interface ClubDTO {
  id: string;
  name: string;
  description: string;
  privacy: ClubPrivacy;
  rules: string[];
  /** The viewer's role; null = not a member (Discover cards) */
  role: ClubRole | null;
  memberCount: number;
  /** Submissions waiting for review — surfaced to admins/moderators only */
  pendingReviews: number;
  createdAt: string;
}

export interface ClubListDTO {
  items: ClubDTO[];
  total: number;
}

/** POST /clubs — the creator becomes the admin */
export interface CreateClubDTO {
  name: string;
  description: string;
  privacy: ClubPrivacy;
  rules?: string[]; // one rule per line in the UI
  inviteHandles?: string[]; // optional @handles invited right away
}

export interface UpdateClubDTO {
  name?: string;
  description?: string;
  privacy?: ClubPrivacy;
  rules?: string[];
}

/** A club member with their profile */
export interface ClubMemberDTO extends ClubUserDTO {
  role: ClubRole;
  joinedAt: string;
  /** Chat Hall presence — stamped by the client's heartbeat (~30s);
   * null = has never opened the club chat */
  lastSeenAt?: string | null;
  /** lastSeenAt within the last 2 minutes */
  online?: boolean;
}

export interface ClubMemberListDTO {
  items: ClubMemberDTO[];
  total: number;
}

/** A join application (open clubs) with its mandatory note */
export interface ClubApplicationDTO {
  id: string;
  clubId: string;
  user: ClubUserDTO;
  note: string;
  createdAt: string;
}

export interface ClubApplicationListDTO {
  items: ClubApplicationDTO[];
  total: number;
}

/** POST /clubs/:id/applications */
export interface CreateClubApplicationDTO {
  note: string;
}

/** POST /clubs/:id/applications/:applicationId/decision (admin/moderator) */
export interface ClubApplicationDecisionDTO {
  decision: "approved" | "rejected";
}

/** An invitation, in the invitee's view */
export interface ClubInvitationDTO {
  id: string;
  club: { id: string; name: string; privacy: ClubPrivacy };
  inviter: ClubUserDTO;
  createdAt: string;
}

export interface ClubInvitationListDTO {
  items: ClubInvitationDTO[];
  total: number;
}

/** POST /clubs/:id/invitations — invite users by handle */
export interface CreateClubInvitationDTO {
  handles: string[];
}

/** How many invitations actually went out (unknown handles skipped) */
export interface ClubInvitationResultDTO {
  invited: number;
}

/** Result of POST /clubs/invitations/:invitationId/accept|decline */
export interface ClubInvitationResponseDTO {
  id: string;
  clubId: string;
  status: ClubInvitationStatus;
}

/** A blog waiting in the club's review queue */
export interface ClubSubmissionDTO {
  id: string; // blog id
  title: string;
  description: string;
  author: ClubUserDTO;
  words: number;
  submittedAt: string; // ISO
}

export interface ClubSubmissionListDTO {
  items: ClubSubmissionDTO[];
  total: number;
}

/** POST /clubs/:id/submissions — submit a draft into the club's review queue */
export interface CreateClubSubmissionDTO {
  title?: string;
  content?: string;
  description?: string;
  genres?: string[];
}

/** Result of POST /clubs/:id/submissions/:blogId (re-submit a handled draft) */
export interface ClubSubmissionResultDTO {
  blogId: string;
  clubReviewStatus: "pending";
}

/** One recorded review decision (history is never deleted) */
export interface ClubReviewDTO {
  id: string;
  blogId: string;
  clubId: string;
  decision: ClubReviewDecision;
  note: string | null;
  reviewer: ClubUserDTO | null;
  createdAt: string;
}

export interface ClubReviewListDTO {
  items: ClubReviewDTO[];
  total: number;
}

/** POST /clubs/:id/submissions/:blogId/review (admin/moderator) */
export interface CreateClubReviewDTO {
  decision: ClubReviewDecision;
  /** Required to request changes or reject; optional on approve */
  note?: string | null;
}

/** One chat message (group or 1:1 club conversation) */
export interface ClubMessageDTO {
  id: string;
  conversationId: string;
  sender: ClubUserDTO;
  body: string;
  /** Relative /uploads/… path of an attached image (resolve with assetUrl) */
  attachmentUrl?: string | null;
  /** Soft-deleted: admins/moderators keep history; content is replaced */
  deleted?: boolean;
  createdAt: string;
}

export interface ClubMessageListDTO {
  items: ClubMessageDTO[];
  total: number;
}

/** POST body of POST /clubs/:id/conversations/:conversationId/messages */
export interface CreateClubMessageDTO {
  body: string;
}

export interface ClubConversationDTO {
  id: string;
  clubId: string;
  isGroup: boolean;
  updatedAt: string;
  participants: ClubUserDTO[];
}

export interface ClubConversationListDTO {
  items: ClubConversationDTO[];
}

/** POST /clubs/:id/conversations/direct — 1:1 with a fellow member (@handle) */
export interface CreateClubDirectConversationDTO {
  handle: string;
}

/** One dashboard activity entry */
export interface ClubActivityDTO {
  id: string;
  type: ClubActivityType;
  detail: string;
  actor: ClubUserDTO | null;
  createdAt: string;
}

/** GET /clubs/:id/dashboard — persisted metrics, admins only */
export interface ClubDashboardDTO {
  totalMembers: number;
  publishedPosts: number;
  pendingReviews: number;
  recentActivity: ClubActivityDTO[];
}

/** GET /clubs/:id/landing — the club's public blog page (subject to privacy) */
export interface ClubLandingDTO {
  club: ClubDTO;
  posts: BlogResponseDTO[];
  total: number;
}

/** A collaborator on a club blog draft */
export interface ClubCollaboratorDTO extends ClubUserDTO {
  addedAt: string;
}

export interface ClubCollaboratorListDTO {
  items: ClubCollaboratorDTO[];
  total: number;
}

/** POST /clubs/:id/drafts/:blogId/collaborators — the author adds members */
export interface CreateClubCollaboratorDTO {
  handle: string;
}

/** PUT /clubs/:id/drafts/:blogId — collaborative draft save with optimistic
 * concurrency: the edit carries the version it started from */
export interface ClubCollaborativeSaveDTO {
  title?: string;
  content?: string;
  description?: string;
  images?: string[];
  /** blogs.version at the time the edit started — a stale version is 409 */
  version: number;
}

export interface ClubCollaborativeSaveResultDTO {
  blog: BlogResponseDTO;
  version: number;
}

// -------------- NOTIFICATIONS -------------- //

/**
 * Quill notification events:
 *  - "new_follower": someone follows a writer (recipient = the writer)
 *  - "new_post":     a followed writer publishes a blog (recipient = follower)
 *  - "club_invite":  a club member invites a writer (recipient = the invitee)
 *  - "club_review":  a reviewer decides on the author's club submission
 *                    (recipient = the author)
 *  - "scheduled_post_published": a scheduled story is live (recipient = author)
 *  - "comment_reply": someone replies to the recipient's comment
 * "club_application" exists in the DB too; the server does not create it yet.
 */
export type NotificationType =
  | "new_follower"
  | "new_post"
  | "scheduled_post_published"
  | "comment_reply"
  | "scheduled_post_published"
  | "comment_reply"
  | "club_invite"
  | "club_application"
  | "club_review";

/** Who caused the event — the name shown in the rendered message */
export interface NotificationActorDTO {
  id: string;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

/** The story behind a "new_post" notification (for deep-linking) */
export interface NotificationBlogDTO {
  id: string;
  title: string;
}

/** The club behind club_* notifications (null for everything else) */
export interface NotificationClubDTO {
  id: string;
  name: string;
}

/** One entry in the bell dropdown */
export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actor: NotificationActorDTO;
  blog: NotificationBlogDTO | null; // null for follow/club notifications
  club: NotificationClubDTO | null; // null for follow/post notifications
  createdAt: string; // ISO
  readAt: string | null; // null while unread (the badge counts these)
}

/** Page result of GET /notifications?page&limit */
export interface NotificationListDTO {
  items: NotificationDTO[];
  total: number;
}

/** Result of GET /notifications/unread-count */
export interface UnreadCountDTO {
  count: number;
}
