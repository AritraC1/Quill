import { useState, useCallback, useEffect } from "react";
import {
  signUpApi,
  requestOtpApi,
  verifyOtpApi,
  refreshTokenApi,
  logoutApi,
  getStoredTokens,
} from "../api/auth.api";
import type { AuthTokens } from "../types";

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

export function useAuth() {
  const [tokens, setTokens] = useState<AuthTokens | null>(() => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Refresh token on mount if we only have a refresh token stored
  useEffect(() => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!refreshToken || accessToken) return;

    let cancelled = false;

    refreshTokenApi()
      .then((res) => {
        if (cancelled) return;
        setTokens({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
      })
      .catch(() => {
        if (!cancelled) setTokens(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(async (name: string, email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await signUpApi({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create account"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await requestOtpApi({ email: email.trim().toLowerCase() });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to send verification code"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const authRes = await verifyOtpApi({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      setTokens({
        accessToken: authRes.accessToken,
        refreshToken: authRes.refreshToken,
      });
      return authRes;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid or expired OTP"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await logoutApi();
      setTokens(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Logout failed"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthenticated: Boolean(tokens?.accessToken),
    tokens,
    isLoading,
    error,
    clearError,
    signUp,
    requestOtp,
    verifyOtp,
    logout,
  };
}
