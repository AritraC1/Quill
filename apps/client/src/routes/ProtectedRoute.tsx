import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../features/auth";

export const ProtectedRoute = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  // Wait for the session check so a refresh doesn't bounce a logged-in user to "/"
  if (isInitializing) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F6F3EC]">
        <Loader2
          className="w-6 h-6 animate-spin text-[#1F3D2F]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
};