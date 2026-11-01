import { describe, expect, it, mock } from "bun:test";
import BlogService from "./blog.service";
import type { BlogModel } from "./blog.model";
import { ForbiddenError } from "../../core/errors";

// Row builder — blogs as Postgres returns them (snake_case), plus the club
// columns from migration 014
function blogRow(overrides: Partial<BlogModel> = {}): BlogModel {
  const now = new Date();
  return {
    id: "blog-1",
    user_id: "author-1",
    title: "A Quiet Manifesto",
    content: "Some thoughts.",
    description: "",
    images: null,
    status: "draft",
    published_at: now,
    scheduled_publish_at: null,
    created_at: now,
    updated_at: now,
    club_id: null,
    club_review_status: null,
    version: 1,
    ...overrides,
  };
}

describe("BlogService — club review workflow guard", () => {
  it("refuses to publicly publish a club draft still waiting for review", async () => {
    const service = new BlogService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () =>
        blogRow({ club_id: "club-1", club_review_status: "pending" }),
      ),
    };

    await expect(
      service.publishBlog("author-1", "blog-1"),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses to publicly publish a club draft parked after review", async () => {
    const service = new BlogService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () =>
        blogRow({ club_id: "club-1", club_review_status: "rejected" }),
      ),
    };

    await expect(
      service.publishBlog("author-1", "blog-1"),
    ).rejects.toThrow(ForbiddenError);
  });
});
