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

  // Check and refresh token on mount if needed
  useEffect(() => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken && !tokens?.accessToken) {
      refreshTokenApi()
        .then((res) => {
          setTokens({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          });
        })
        .catch(() => {
          setTokens(null);
        });
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signUpApi({ name: name.trim(), email: email.trim().toLowerCase() });
      return user;
    } catch (err: any) {
      const msg = err.message || "Failed to create account";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await requestOtpApi({ email: email.trim().toLowerCase() });
      return res;
    } catch (err: any) {
      const msg = err.message || "Failed to send verification code";
      setError(msg);
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
    } catch (err: any) {
      const msg = err.message || "Invalid or expired OTP";
      setError(msg);
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
    } catch (err: any) {
      setError(err.message || "Logout failed");
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
