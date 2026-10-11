import type {
  SignUpRequestDTO,
  RequestOtpDTO,
  VerifyOtpDTO,
  AuthResponseDTO,
  RefreshTokenDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_STORAGE_KEY = "quill_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "quill_refresh_token";

// Retrieves the access token and refresh token from localStorage.
export const getStoredTokens = () => {
  return {
    accessToken: localStorage.getItem(TOKEN_STORAGE_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
  };
};

// Stores the access token and refresh token in localStorage,
// called after successful authentication or token refresh.
export const setStoredTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
};

// Removes authentication tokens from localStorage
// Used during logout or when token refresh fails
export const clearStoredTokens = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

// Common request helper with error handling
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
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
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

// Verify OTP
export async function verifyOtpApi(
  payload: VerifyOtpDTO,
): Promise<AuthResponseDTO> {
  const data = await sendRequest<AuthResponseDTO>(API_ROUTES.AUTH.VERIFY_OTP, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data?.accessToken && data?.refreshToken) {
    setStoredTokens(data.accessToken, data.refreshToken);
  }
  return data;
}

// Refresh Token (Rotates refresh token and returns new pair)
let refreshPromise: Promise<AuthResponseDTO> | null = null;

export async function refreshTokenApi(): Promise<AuthResponseDTO> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) {
    clearStoredTokens();
    throw new Error("No refresh token available");
  }

  // Prevent multiple concurrent refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const payload: RefreshTokenDTO = { refreshToken };
      const data = await sendRequest<AuthResponseDTO>(
        API_ROUTES.AUTH.REFRESH_TOKEN,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (data?.accessToken && data?.refreshToken) {
        setStoredTokens(data.accessToken, data.refreshToken);
      } else {
        clearStoredTokens();
      }

      return data;
    } catch (err) {
      clearStoredTokens();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Logout
export async function logoutApi(): Promise<{ success: boolean }> {
  const { accessToken } = getStoredTokens();
  try {
    if (accessToken) {
      await sendRequest<{ success: boolean }>(API_ROUTES.AUTH.LOGOUT, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
  } finally {
    clearStoredTokens();
  }
  return { success: true };
}

// Authenticated Fetch with Automatic Refresh Token Rotation
export async function fetchWithAuth<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  let { accessToken } = getStoredTokens();

  if (!accessToken) {
    // Attempt refresh if refresh token exists
    const refreshed = await refreshTokenApi();
    accessToken = refreshed.accessToken;
  }

  const makeAttempt = async (token: string) => {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return sendRequest<T>(endpoint, {
      ...options,
      headers,
    });
  };

  if (!accessToken) {
    throw new Error("User is not authenticated");
  }

  try {
    return await makeAttempt(accessToken);
  } catch (error: unknown) {
    // If unauthorized / token expired, rotate token once and retry
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("unauthorized") || message.includes("token")) {
      const newTokens = await refreshTokenApi();
      return await makeAttempt(newTokens.accessToken);
    }

    throw error;
  }
}
