import { describe, expect, it, mock } from "bun:test";
import BlogService from "./blog.service";
import type { BlogModel } from "./blog.model";
import type { UserSettingsRowModel } from "../user/settings.model";
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

describe("BlogService — saved topic feed", () => {
  const settingsRow = (fav_genre: string[]): UserSettingsRowModel => ({
    fav_genre,
    default_tab: "for-you",
    text_size: 18,
    theme: "light",
    notif_app_posts: true,
    notif_app_followers: true,
    notif_app_scheduled: true,
    notif_app_replies: false,
    notif_email_digest: true,
    notif_email_followers: false,
    notif_email_news: false,
  });

  it("uses the viewer's saved genres only for the For you feed", async () => {
    const listPublishedBlogs = mock(async () => ({ items: [], total: 0 }));
    const service = new BlogService();
    // @ts-ignore
    service.userRepo = {
      getSettings: mock(async () => settingsRow(["Essays", "Poetry"])),
    };
    // @ts-ignore
    service.blogRepo = { listPublishedBlogs };

    await service.listFeed("reader-1", { page: 1, limit: 20 });

    expect(listPublishedBlogs).toHaveBeenCalledWith(
      "reader-1",
      null,
      1,
      20,
      undefined,
      ["Essays", "Poetry"],
    );
  });

  it("does not apply saved genres to author profiles or search results", async () => {
    const listPublishedBlogs = mock(async () => ({ items: [], total: 0 }));
    const service = new BlogService();
    // @ts-ignore
    service.userRepo = {
      getSettings: mock(async () => settingsRow(["Essays"])),
      findByHandle: mock(async () => ({
        id: "author-1",
        name: "Writer",
        email: "writer@example.com",
        fav_genre: [],
        onboarding_completed: true,
        handle: "writer",
        created_at: new Date(),
        updated_at: new Date(),
      })),
    };
    // @ts-ignore
    service.blogRepo = { listPublishedBlogs };

    await service.listFeed("reader-1", { author: "writer" });
    await service.listFeed("reader-1", { search: "query" });

    expect(listPublishedBlogs).toHaveBeenNthCalledWith(
      1,
      "reader-1",
      "author-1",
      1,
      10,
      undefined,
      [],
    );
    expect(listPublishedBlogs).toHaveBeenNthCalledWith(
      2,
      "reader-1",
      null,
      1,
      10,
      "query",
      [],
    );
  });
});
