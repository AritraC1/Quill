import type {
  SignUpRequestDTO,
  RequestOtpDTO,
  VerifyOtpDTO,
  AuthResponseDTO,
  SessionResponseDTO,
  OnboardRequestDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

/**
 * Auth tokens live in httpOnly cookies set by the server (see
 * apps/server/src/core/config/cookie.config.ts) — they are NEVER readable by
 * JavaScript. Every request carries credentials so the browser attaches them.
 */

/** Error carrying the HTTP status so callers can react to 401/403 precisely */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Common request helper. Cookies are always attached; the server reads the
// token from the httpOnly cookie (or Authorization header for API clients).
async function sendRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include", // attach the httpOnly auth cookies
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data?.data ?? data;
}

// Sign Up (Create Account)
export async function signUpApi(
  payload: SignUpRequestDTO,
): Promise<{ id: string; name: string; email: string }> {
  return sendRequest<{ id: string; name: string; email: string }>(
    API_ROUTES.AUTH.SIGN_UP,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// Request OTP
export async function requestOtpApi(
  payload: RequestOtpDTO,
): Promise<{ success: boolean }> {
  return sendRequest<{ success: boolean }>(API_ROUTES.AUTH.REQUEST_OTP, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Verify OTP — server sets the httpOnly cookies; body only has session metadata
export async function verifyOtpApi(
  payload: VerifyOtpDTO,
): Promise<AuthResponseDTO> {
  return sendRequest<AuthResponseDTO>(API_ROUTES.AUTH.VERIFY_OTP, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Refresh Token (server reads the refresh cookie, rotates and re-issues it)
let refreshPromise: Promise<AuthResponseDTO> | null = null;

export async function refreshTokenApi(): Promise<AuthResponseDTO> {
  // Prevent multiple concurrent refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      return await sendRequest<AuthResponseDTO>(API_ROUTES.AUTH.REFRESH_TOKEN, {
        method: "POST",
        body: "{}",
      });
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Session — shared (single-flight) boot-time auth state check. Being cached,
// every useAuth() consumer can call it on mount without one request each.
let sessionPromise: Promise<SessionResponseDTO> | null = null;

export function sessionApi(): Promise<SessionResponseDTO> {
  if (!sessionPromise) {
    sessionPromise = sendRequest<SessionResponseDTO>(API_ROUTES.AUTH.SESSION, {
      headers: { Accept: "application/json" },
    }).finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

// Logout (server revokes the session and clears the cookies)
export async function logoutApi(): Promise<{ success: boolean }> {
  return sendRequest<{ success: boolean }>(API_ROUTES.AUTH.LOGOUT, {
    method: "DELETE",
  });
}

// Authenticated Fetch — cookies ride along automatically; on 401 (expired
// access token) rotate the session once and retry
export async function fetchWithAuth<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await sendRequest<T>(endpoint, {
      ...options,
      credentials: "include",
    });
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshTokenApi();
      return await sendRequest<T>(endpoint, {
        ...options,
        credentials: "include",
      });
    }
    throw error;
  }
}

// Complete Onboarding
export async function onboardApi(
  payload: OnboardRequestDTO,
): Promise<{ success: boolean }> {
  return fetchWithAuth<{ success: boolean }>(API_ROUTES.ONBOARDING.ONBOARD, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
