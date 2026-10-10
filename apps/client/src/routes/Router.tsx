import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import StatusPage from "../pages/StatusPage";
import NotFoundPage from "../pages/NotFoundPage";
import { OnboardingView } from "../features/onboarding";
import { FeedView } from "../features/feed";

const Router = createBrowserRouter([
  {
    path: "/",
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "onboarding", element: <OnboardingView /> },
      { path: "feed", element: <FeedView /> },
      { path: "status", element: <StatusPage /> },
    ],
  },
]);

export default Router;
