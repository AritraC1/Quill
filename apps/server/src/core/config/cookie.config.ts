import ms from "ms";

import { env, isProduction } from "./env";

// Cookie names exposed by the auth domain
export const AUTH_COOKIES = {
  access: {
    name: "quill_access_token",
    // Access token is needed by every authenticated /api route, so its path is "/"
    path: "/",
  },
  refresh: {
    name: "quill_refresh_token",
    // Refresh token is only ever sent to auth endpoints (refresh/logout/session),so a narrow path keeps it out of every other request
    path: "/api/auth",
  },
} as const;

const baseOptions = {
  /** JS cannot read these cookies — the core XSS protection */
  httpOnly: true,
  /** Only transmitted over HTTPS in production (localhost dev is exempt) */
  secure: isProduction,
  /** Sent on same-site requests; blocks most CSRF vectors cross-site */
  sameSite: "lax",
} as const;

export const accessCookieOptions = () => ({
  ...baseOptions,
  path: AUTH_COOKIES.access.path,
  maxAge: ms(env.JWT_EXPIRES_IN), // in sync with the JWT's own expiry
});

export const refreshCookieOptions = () => ({
  ...baseOptions,
  path: AUTH_COOKIES.refresh.path,
  maxAge: ms(env.JWT_REFRESH_EXPIRES_IN), // in sync with the token's DB expiry
});

export const clearCookieOptions = (path: string) => ({
  ...baseOptions,
  path, // must match the cookie's path for the browser to delete it
  maxAge: 0,
});
