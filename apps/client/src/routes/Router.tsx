import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import StatusPage from "../pages/StatusPage";
import NotFoundPage from "../pages/NotFoundPage";
import ProfilePage from "../features/profile/page/ProfilePage";
import { OnboardingView } from "../features/auth";
import { FeedView } from "../features/feed";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicOnlyRoute } from "./PublicOnlyRoute";
import EditProfilePage from "../features/profile/page/EditProfilePage";
import WritePage from "../features/blog/page/WritePage";
import BlogPage from "../features/blog/page/BlogPage";
import SettingsPage from "../features/settings/page/Settings";
import MyClubsPage from "../features/club/pages/ClubPage";
import ClubBlogsPage from "../features/club/pages/ClubBlogsPage";

const Router = createBrowserRouter([
  {
    path: "/",
    errorElement: <NotFoundPage />,
    children: [
      // Public, but signed-in users are sent on to the app
      {
        element: <PublicOnlyRoute />,
        children: [{ index: true, element: <LandingPage /> }],
      },

      // Public for everyone
      { path: "status", element: <StatusPage /> },

      // Private
      {
        element: <ProtectedRoute />,
        children: [
          { path: "onboarding", element: <OnboardingView /> },
          { path: "feed", element: <FeedView /> },
          { path: "profile", element: <ProfilePage /> },
          // legacy alias — canonicalizes to /<handle> inside the page
          { path: "u/:handle", element: <ProfilePage /> },
          { path: "profile/edit", element: <EditProfilePage /> },
          { path: "write", element: <WritePage /> },
          { path: "write/:id", element: <WritePage /> },
          { path: "blog/:id", element: <BlogPage /> },
          { path: "settings", element: <SettingsPage /> },
          // Twitter-style profile path: /<handle>
          { path: ":handle", element: <ProfilePage /> },
          { path: "my-clubs", element: <MyClubsPage /> },
          // Club's public blog landing page
          { path: "clubs/:id", element: <ClubBlogsPage /> }
        ],
      },
    ],
  },
]);

export default Router;
