import { describe, expect, it } from "bun:test";
import { readingProgressSchema } from "./validation";

describe("readingProgressSchema", () => {
  it("accepts bounded reading-session snapshots", () => {
    expect(
      readingProgressSchema.safeParse({
        sessionId: "0e6f09f9-d00f-4120-bb11-96ca3dca7ab5",
        activeSeconds: 30,
        maxScrollPercent: 75,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed, negative, and over-limit measurements", () => {
    expect(
      readingProgressSchema.safeParse({
        sessionId: "not-a-uuid",
        activeSeconds: 30,
        maxScrollPercent: 75,
      }).success,
    ).toBe(false);
    expect(
      readingProgressSchema.safeParse({
        sessionId: "0e6f09f9-d00f-4120-bb11-96ca3dca7ab5",
        activeSeconds: -1,
        maxScrollPercent: 75,
      }).success,
    ).toBe(false);
    expect(
      readingProgressSchema.safeParse({
        sessionId: "0e6f09f9-d00f-4120-bb11-96ca3dca7ab5",
        activeSeconds: 30,
        maxScrollPercent: 101,
      }).success,
    ).toBe(false);
  });
});
