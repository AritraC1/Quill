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
    FOLLOW: (handle: string) => `/user/${handle}/follow`,
    AVATAR: "/user/avatar",
  },
  // Blog Routes
  BLOG: {
    CREATE: "/blogs", // also the feed (list) endpoint
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
} as const;
