import { RouterProvider } from "react-router-dom";
import Router from "./routes/Router";
import { BlogTtsProvider } from "./features/blog/context/BlogTtsContext";

function App() {
  return (
    <BlogTtsProvider>
      <RouterProvider router={Router} />
    </BlogTtsProvider>
  );
}

export default App;
