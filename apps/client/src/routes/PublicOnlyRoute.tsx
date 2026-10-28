import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../features/auth";

export const PublicOnlyRoute = () => {
  const { isAuthenticated, isInitializing, onboardingCompleted } = useAuth();

  // Wait for the session check so a refresh doesn't flash the landing page
  if (isInitializing) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F7F3E9]">
        <Loader2
          className="w-6 h-6 animate-spin text-[#3B6255]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (isAuthenticated) {
    // Brand-new users (just verified their OTP) still need onboarding
    const target = onboardingCompleted === false ? "/onboarding" : "/feed";
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
};
