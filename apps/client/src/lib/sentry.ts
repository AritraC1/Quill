import * as Sentry from "@sentry/react";

let clientSentryInitialized = false;

export const initClientSentry = (): void => {
  if (clientSentryInitialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[Sentry] VITE_SENTRY_DSN is not configured; frontend error tracking disabled");
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "development",
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      // Set tracesSampleRate to 1.0 in dev/staging, adjust down in high-traffic production
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      tracePropagationTargets: ["localhost", /^\/api/],
    });
    clientSentryInitialized = true;
    console.info("[Sentry] Frontend monitoring initialized");
  } catch (error) {
    console.error("[Sentry] Failed to initialize frontend Sentry:", error);
  }
};

export { Sentry };

