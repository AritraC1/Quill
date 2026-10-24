import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import StatusPage from "../pages/StatusPage";
import NotFoundPage from "../pages/NotFoundPage";
import ProfilePage from "../pages/ProfilePage";
import { OnboardingView } from "../features/auth";
import { FeedView } from "../features/feed";
import { ProtectedRoute } from "./ProtectedRoute";

const Router = createBrowserRouter([
  {
    path: "/",
    errorElement: <NotFoundPage />,
    children: [
      // Public
      { index: true, element: <LandingPage /> },
      { path: "status", element: <StatusPage /> },

      // Private
      {
        element: <ProtectedRoute />,
        children: [
          { path: "onboarding", element: <OnboardingView /> },
          { path: "feed", element: <FeedView /> },
          { path: "profile", element: <ProfilePage /> },
          { path: "u/:handle", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);

export default Router;
