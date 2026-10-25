import "./index.css";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster
      position="bottom-center"
      offset={32}
      mobileOffset={{ bottom: 80 }}
      toastOptions={{
        style: {
          background: "#A8D5BA",
          color: "black",
          border: "none",
          borderRadius: "999px",
          fontSize: "13px",
          fontFamily: "Inter, sans-serif",
          textAlign: "-khtml-center"
        },
      }}
    />
    <App />
  </StrictMode>,
);
