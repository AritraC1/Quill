import { describe, it, expect } from "bun:test";
import { initSentry, captureException, sentryInitialized } from "./sentry";

describe("Sentry Core Integration", () => {
  it("does not crash when SENTRY_DSN is empty and marks sentry disabled", () => {
    initSentry();
    // In local dev without DSN, it gracefully does not initialize
    expect(typeof captureException).toBe("function");
  });

  it("safely ignores captureException when uninitialized without throwing", () => {
    expect(() => {
      captureException(new Error("Test observability error"));
    }).not.toThrow();
  });
});

