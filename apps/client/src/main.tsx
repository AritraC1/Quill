import "./index.css";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { initClientSentry, Sentry } from "./lib/sentry";

// Initialize Sentry client tracking
initClientSentry();

function ErrorFallback({ error }: { error?: unknown }) {
  if (import.meta.env.DEV && error) {
    console.error("Client error caught by Sentry ErrorBoundary:", error);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-gray-800">
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">
          An unexpected error occurred. The incident has been recorded for analysis.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={({ error }) => <ErrorFallback error={error} />}>
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
            textAlign: "-khtml-center",
          },
        }}
      />
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
