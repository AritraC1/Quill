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

function clubMembership(role: "admin" | "moderator" | "member") {
  return {
    club_id: "club-1",
    user_id: "viewer-1",
    role,
    joined_at: new Date(),
    last_seen_at: null,
  };
}

describe("BlogService — club review workflow guard", () => {
  it("allows club moderators to read pending submissions", async () => {
    const service = new BlogService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () =>
        blogRow({ club_id: "club-1", club_review_status: "pending" }),
      ),
      findBlogWithAuthor: mock(async () => null),
    };
    // @ts-ignore
    service.clubRepo = {
      getMembership: mock(async () => clubMembership("moderator")),
    };

    const result = await service.getBlog("moderator-1", "blog-1");

    expect(result.id).toBe("blog-1");
    expect(result.clubReviewStatus).toBe("pending");
  });

  it("keeps pending club submissions private from ordinary members", async () => {
    const service = new BlogService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () =>
        blogRow({ club_id: "club-1", club_review_status: "pending" }),
      ),
    };
    // @ts-ignore
    service.clubRepo = {
      getMembership: mock(async () => clubMembership("member")),
    };

    await expect(
      service.getBlog("member-1", "blog-1"),
    ).rejects.toThrow(ForbiddenError);
  });

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

  it("serves personalized recommendations in the For You feed when available", async () => {
    const recommendedRow1 = blogRow({ id: "blog-rec-1", title: "Recommended 1" });
    const recommendedRow2 = blogRow({ id: "blog-rec-2", title: "Recommended 2" });
    const listPublishedBlogsByIds = mock(async () => [recommendedRow1, recommendedRow2]);
    const mockRecommenderClient = {
      getRecommendations: mock(async () => ["blog-rec-1", "blog-rec-2"]),
    };

    // @ts-ignore
    const service = new BlogService(mockRecommenderClient);
    // @ts-ignore
    service.userRepo = {
      getSettings: mock(async () => settingsRow([])),
    };
    // @ts-ignore
    service.blogRepo = {
      listPublishedBlogsByIds,
      listPublishedBlogs: mock(async () => ({ items: [], total: 0 })),
    };

    const result = await service.listFeed("reader-1", { page: 1, limit: 10 });

    expect(mockRecommenderClient.getRecommendations).toHaveBeenCalledWith("reader-1", 100);
    expect(listPublishedBlogsByIds).toHaveBeenCalledWith("reader-1", ["blog-rec-1", "blog-rec-2"]);
    expect(result.items.map((b) => b.id)).toEqual(["blog-rec-1", "blog-rec-2"]);
    expect(result.total).toBe(2);
  });

  it("gracefully falls back to standard feed if recommender service fails", async () => {
    const fallbackRow = blogRow({ id: "blog-fallback", title: "Fallback Blog" });
    const listPublishedBlogs = mock(async () => ({ items: [fallbackRow], total: 1 }));
    const mockRecommenderClient = {
      getRecommendations: mock(async () => {
        throw new Error("AI service down");
      }),
    };

    // @ts-ignore
    const service = new BlogService(mockRecommenderClient);
    // @ts-ignore
    service.userRepo = {
      getSettings: mock(async () => settingsRow([])),
    };
    // @ts-ignore
    service.blogRepo = {
      listPublishedBlogsByIds: mock(async () => []),
      listPublishedBlogs,
    };

    const result = await service.listFeed("reader-1", { page: 1, limit: 10 });

    expect(listPublishedBlogs).toHaveBeenCalled();
    expect(result.items.map((b) => b.id)).toEqual(["blog-fallback"]);
  });
});
