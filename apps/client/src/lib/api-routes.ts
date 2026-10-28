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
} as const;
