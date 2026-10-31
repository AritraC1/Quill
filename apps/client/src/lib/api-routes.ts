// API ROUTES
export const API_ROUTES = {
  // Auth Routes
  AUTH: {
    SIGN_UP: "/auth/sign-up",
    REQUEST_OTP: "/auth/request-otp",
    VERIFY_OTP: "/auth/verify-otp",
    REFRESH_TOKEN: "/auth/refresh-token",
    SESSION: "/auth/session",
    LOGOUT: "/auth/logout",
  },
  ONBOARDING: {
    ONBOARD: "/auth/onboard",
  },
  // User Routes
  USER: {
    ME: "/user/me",
    EDIT_PROFILE: "/user/edit-profile",
    PROFILE: (handle: string) => `/user/${handle}`,
    FOLLOWING: "/user/following",
    SUGGESTIONS: "/user/suggestions",
    FOLLOW: (handle: string) => `/user/${handle}/follow`,
    FOLLOWERS: (handle: string) => `/user/${handle}/followers`,
    AVATAR: "/user/avatar",
    SETTINGS: "/user/settings",
    ACCOUNT: "/user/account", // DELETE — permanent account deletion
  },
  // Blog Routes
  BLOG: {
    CREATE: "/blogs", // also the feed (list) endpoint
    FOLLOWING: "/blogs/following",
    GET: (id: string) => `/blogs/${id}`,
    UPDATE: (id: string) => `/blogs/${id}`,
    DELETE: (id: string) => `/blogs/${id}`,
    PUBLISH: (id: string) => `/blogs/${id}/publish`,
    SCHEDULE: (id: string) => `/blogs/${id}/schedule`, // DELETE cancels a scheduled publish
    BOOKMARK: (id: string) => `/blogs/${id}/bookmark`,
    COUNT: "/blogs/count",
    DRAFTS: "/blogs/drafts",
    PUBLISHED: "/blogs/published",
    BOOKMARKS: "/blogs/bookmarks",
  },
  // Comment Routes (CommentSection under a published story)
  COMMENT: {
    LIST: (blogId: string) => `/blogs/${blogId}/comments`,
    UPDATE: (commentId: string) => `/comments/${commentId}`,
    DELETE: (commentId: string) => `/comments/${commentId}`,
    REACTION: (commentId: string) => `/comments/${commentId}/reaction`,
  },
  // Notification Routes (bell in the navbar)
  NOTIFICATIONS: {
    LIST: "/notifications", // DELETE clears the whole list
    UNREAD_COUNT: "/notifications/unread-count",
    READ: (id: string) => `/notifications/${id}/read`,
    READ_ALL: "/notifications/read-all",
  },
} as const;
