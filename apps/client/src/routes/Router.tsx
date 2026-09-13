import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import StatusPage from "../pages/StatusPage";
import NotFoundPage from "../pages/NotFoundPage";

const Router = createBrowserRouter([
  {
    path: "/",
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "status", element: <StatusPage /> },
    ],
  },
]);

export default Router;
