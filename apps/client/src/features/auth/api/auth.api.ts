import type {
  SignUpRequestDTO,
  RequestOtpDTO,
  VerifyOtpDTO,
  AuthResponseDTO,
  RefreshTokenDTO,
} from "@quill/shared";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const TOKEN_STORAGE_KEY = "quill_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "quill_refresh_token";

export const getStoredTokens = () => {
  return {
    accessToken: localStorage.getItem(TOKEN_STORAGE_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
  };
};

export const setStoredTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
};

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

// 1. Sign Up (Create Account)
export async function signUpApi(payload: SignUpRequestDTO): Promise<{ id: string; name: string; email: string }> {
  return sendRequest<{ id: string; name: string; email: string }>("/auth/sign-up", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 2. Request OTP
export async function requestOtpApi(payload: RequestOtpDTO): Promise<{ success: boolean }> {
  return sendRequest<{ success: boolean }>("/auth/request-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 3. Verify OTP
export async function verifyOtpApi(payload: VerifyOtpDTO): Promise<AuthResponseDTO> {
  const data = await sendRequest<AuthResponseDTO>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (data?.accessToken && data?.refreshToken) {
    setStoredTokens(data.accessToken, data.refreshToken);
  }
  return data;
}

// 4. Refresh Token (Rotates refresh token and returns new pair)
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
      const data = await sendRequest<AuthResponseDTO>("/auth/refresh-token", {
        method: "POST",
        body: JSON.stringify(payload),
      });

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

// 5. Logout
export async function logoutApi(): Promise<{ success: boolean }> {
  const { accessToken } = getStoredTokens();
  try {
    if (accessToken) {
      await sendRequest<{ success: boolean }>("/auth/logout", {
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

// 6. Authenticated Fetch with Automatic Refresh Token Rotation
export async function fetchWithAuth<T = any>(
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
  } catch (error: any) {
    // If unauthorized / token expired, rotate token once and retry
    if (error?.message?.toLowerCase().includes("unauthorized") || error?.message?.toLowerCase().includes("token")) {
      const newTokens = await refreshTokenApi();
      return await makeAttempt(newTokens.accessToken);
    }
    throw error;
  }
}
