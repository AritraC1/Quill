import { useState, useCallback, useEffect } from "react";
import type { LogoutScope } from "@quill/shared";
import type { AuthSuccessResult } from "../types/auth.types";
import {
  logoutApi,
  refreshTokenApi,
  requestOtpApi,
  sessionApi,
  signUpApi,
  verifyOtpApi,
} from "../api/auth.api";
import { clearStoredUser, saveStoredUser } from "../../../lib/user-store";
import { clearMeCache } from "../../profile/api/profile.api";

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

interface AuthSession {
  authenticated: boolean;
  onboardingCompleted: boolean | null;
}

const SIGNED_OUT: AuthSession = {
  authenticated: false,
  onboardingCompleted: null,
};

export function useAuth() {
  // Session state derived from the httpOnly auth cookies (via GET /auth/session).
  // Tokens themselves are never held in JS.
  const [session, setSession] = useState<AuthSession>(SIGNED_OUT);

  // Session is being verified on boot — route guards wait for this so a
  // refresh doesn't bounce a signed-in user to the landing page
  const [isInitializing, setIsInitializing] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Restore session on mount (single-flight: many useAuth() call sites,
  // one network request)
  useEffect(() => {
    let cancelled = false;

    sessionApi()
      .then((res) => {
        if (!cancelled) {
          setSession({
            authenticated: true,
            onboardingCompleted: res.onboardingCompleted ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(SIGNED_OUT);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(async (name: string, email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signUpApi({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      // Keep the name for display while the API has no "get me" endpoint yet
      saveStoredUser({ id: user.id, name: user.name, email: user.email });
      return user;
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

  const verifyOtp = useCallback(
    async (email: string, otp: string): Promise<AuthSuccessResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await verifyOtpApi({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        });
        setSession({
          authenticated: true,
          onboardingCompleted: res.onboardingCompleted,
        });
        return { onboardingCompleted: res.onboardingCompleted };
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Invalid or expired OTP"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (scope: LogoutScope = "device") => {
    setIsLoading(true);
    setError(null);
    try {
      await logoutApi(scope);
      setSession(SIGNED_OUT);
      clearStoredUser();
      clearMeCache();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message ? err.message : "Logout failed",
      );
      // Even on API failure the local identity should not survive
      clearStoredUser();
      clearMeCache();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthenticated: session.authenticated,
    onboardingCompleted: session.onboardingCompleted,
    isInitializing,
    isLoading,
    error,
    clearError,
    signUp,
    requestOtp,
    verifyOtp,
    logout,
    // Kept for callers that need to force a rotation manually
    refreshToken: refreshTokenApi,
  };
}
