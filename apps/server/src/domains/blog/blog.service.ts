import type {
  BlogBookmarkDTO,
  BlogCountDTO,
  BlogResponseDTO,
  BlogStatus,
  BlogListQueryDTO,
  CreateBlogDTO,
  UpdateBlogDTO,
} from "@quill/shared";
import BlogRepository from "./blog.repository";
import UserRepository from "../user/user.repository";
import type { BlogWithAuthorModel } from "./blog.model";
import { blogPublishQueue } from "../../jobs/queue";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
import { logger } from "../../core/logger/logger";

// Row -> serialized DTO (dates become ISO strings for the JSON response)
function toBlogResponse(blog: BlogWithAuthorModel): BlogResponseDTO {
  return {
    id: blog.id,
    userId: blog.user_id,
    title: blog.title,
    content: blog.content,
    description: blog.description,
    images: blog.images ?? undefined,
    status: blog.status as BlogStatus,
    publishedAt: blog.published_at
      ? new Date(blog.published_at).toISOString()
      : null,
    scheduledPublishAt: blog.scheduled_publish_at
      ? new Date(blog.scheduled_publish_at).toISOString()
      : null,
    createdAt: new Date(blog.created_at).toISOString(),
    updatedAt: new Date(blog.updated_at).toISOString(),
    author: blog.author_name
      ? {
          id: blog.user_id,
          name: blog.author_name,
          handle: blog.author_handle ?? null,
          avatar: blog.author_avatar ?? null,
        }
      : undefined,
    isBookmarked: blog.bookmarked,
  };
}

// Pagination guard rails
const MAX_LIMIT = 50;

function parsePageLimit(query: BlogListQueryDTO): {
  page: number;
  limit: number;
} {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), MAX_LIMIT);
  return { page: Math.floor(page), limit: Math.floor(limit) };
}

// BullMQ delays live in Redis as 32-bit ms — anything beyond this window is
// not queueable, so scheduled publishes are capped slightly below it
const MAX_SCHEDULE_DAYS = 24;

class BlogService {
  private blogRepo: BlogRepository;
  private userRepo: UserRepository;

  constructor() {
    this.blogRepo = new BlogRepository();
    this.userRepo = new UserRepository();
  }

  // Deterministic BullMQ job id per blog, so rescheduling replaces the
  // previous delayed job instead of stacking duplicates
  private readonly scheduleJobId = (blogId: string) => `publish:${blogId}`;

  // Best-effort queue cleanup — deleting/cancelling never depends on Redis
  private async removePendingJob(blogId: string): Promise<void> {
    try {
      const job = await blogPublishQueue.getJob(this.scheduleJobId(blogId));
      await job?.remove();
    } catch (error) {
      logger.warn({ error }, "Could not remove pending publish job");
    }
  }

  // Create a new blog — everything is saved as a draft until /publish is hit
  async createDraft(
    userId: string,
    data: CreateBlogDTO,
  ): Promise<BlogResponseDTO> {
    this.validateContent(data);

    const created = await this.blogRepo.createNewBlog(userId, data);
    return toBlogResponse(created);
  }

  // Get a single blog. Drafts are only visible to their author (writers
  // preview their own work, the feed never leaks unpublished posts)
  async getBlog(userId: string, blogId: string): Promise<BlogResponseDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    const isAuthor = blog.user_id === userId;
    if (blog.status === "draft" && !isAuthor) {
      throw new ForbiddenError("Drafts are only visible to their author");
    }

    const withContext = await this.blogRepo.findBlogWithAuthor(blogId, userId);
    return toBlogResponse(withContext ?? blog);
  }

  // Save edits to a blog (works for both drafts and published posts)
  async updateBlog(
    userId: string,
    blogId: string,
    data: UpdateBlogDTO,
  ): Promise<BlogResponseDTO> {
    this.validateContent(data);

    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("You can only edit your own blogs");
    }

    const updated = await this.blogRepo.updateBlog(blogId, data);
    if (!updated) {
      throw new BadRequestError("Failed to update blog");
    }
    return toBlogResponse(updated);
  }

  // Publish a blog — requires a title; content stays editable afterwards.
  // Without publishAt the blog goes live immediately; with a future datetime
  // it stays a draft and a delayed BullMQ job publishes it when the time comes.
  async publishBlog(
    userId: string,
    blogId: string,
    publishAtISO?: string,
  ): Promise<BlogResponseDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("You can only publish your own blogs");
    }
    if (blog.status === "published") {
      throw new BadRequestError("Blog is already published");
    }
    if (!blog.title.trim()) {
      throw new BadRequestError("Add a title before publishing");
    }

    // Instant publish — also cancels a previously scheduled release
    if (!publishAtISO) {
      await this.removePendingJob(blogId);

      const published = await this.blogRepo.publishBlog(blogId);
      if (!published) {
        throw new BadRequestError("Failed to publish blog");
      }
      return toBlogResponse(published);
    }

    // Scheduled publish — validated, persisted, then handed to the worker
    const publishAt = new Date(publishAtISO);
    if (Number.isNaN(publishAt.getTime())) {
      throw new BadRequestError("Scheduled time is not a valid date");
    }
    if (publishAt.getTime() <= Date.now()) {
      throw new BadRequestError("Scheduled time must be in the future");
    }
    if (
      publishAt.getTime() - Date.now() >
      MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestError("You can schedule up to 24 days ahead");
    }

    const scheduled = await this.blogRepo.scheduleBlog(blogId, publishAt);
    if (!scheduled) {
      throw new BadRequestError("Failed to schedule the blog");
    }

    // Replace any previous delayed job for this blog before enqueueing
    await this.removePendingJob(blogId);
    try {
      await blogPublishQueue.add(
        "publish",
        { blogId, userId },
        {
          delay: publishAt.getTime() - Date.now(),
          jobId: this.scheduleJobId(blogId),
        },
      );
    } catch (error) {
      // Never leave a scheduled row behind without a queued job
      await this.blogRepo.cancelSchedule(blogId);
      throw new BadRequestError("Could not schedule the publish");
    }

    return toBlogResponse(scheduled);
  }

  // Cancel a scheduled publish — the blog stays an ordinary draft
  async cancelSchedule(
    userId: string,
    blogId: string,
  ): Promise<BlogResponseDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("You can only edit your own blogs");
    }

    await this.removePendingJob(blogId);

    const cancelled = await this.blogRepo.cancelSchedule(blogId);
    if (!cancelled) {
      throw new BadRequestError("This blog is not scheduled");
    }
    return toBlogResponse(cancelled);
  }

  // Delete a blog (draft or published)
  async deleteBlog(userId: string, blogId: string): Promise<void> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("You can only delete your own blogs");
    }

    // A scheduled release must not survive its blog
    await this.removePendingJob(blogId);

    await this.blogRepo.deleteBlog(blogId);
  }

  // The feed: every published blog, newest first, with the viewer's bookmarks.
  // Optional `author` handle narrows it to one writer (used by profile pages).
  async listFeed(
    userId: string,
    query: BlogListQueryDTO & { author?: string },
  ): Promise<{ items: BlogResponseDTO[]; total: number }> {
    const { page, limit } = parsePageLimit(query);

    // Resolve a handle -> id lazily. The feed endpoint and straight feeds
    // share one query; unknown handles yield an empty list rather than 404
    let authorId: string | null = null;
    if (query.author) {
      const author = await this.userRepo.findByHandle(
        query.author.trim().toLowerCase(),
      );
      if (!author) {
        return { items: [], total: 0 };
      }
      authorId = author.id;
    }

    const result = await this.blogRepo.listPublishedBlogs(
      userId,
      authorId,
      page,
      limit,
    );
    return {
      items: result.items.map(toBlogResponse),
      total: result.total,
    };
  }

  // Following feed: published blogs from users the viewer follows
  async listFollowingFeed(
    userId: string,
    query: BlogListQueryDTO,
  ): Promise<{ items: BlogResponseDTO[]; total: number }> {
    const { page, limit } = parsePageLimit(query);
    const result = await this.blogRepo.listFollowingFeed(userId, page, limit);
    return {
      items: result.items.map(toBlogResponse),
      total: result.total,
    };
  }

  // The writer's published blogs (profile "Stories" tab)
  async listPublishedByUser(
    userId: string,
    query: BlogListQueryDTO,
  ): Promise<{ items: BlogResponseDTO[]; total: number }> {
    const { page, limit } = parsePageLimit(query);

    const result = await this.blogRepo.listUserBlogs(
      userId,
      "published",
      page,
      limit,
    );
    return {
      items: result.items.map(toBlogResponse),
      total: result.total,
    };
  }

  // The writer's drafts (only the author ever sees these)
  async listDrafts(
    userId: string,
    query: BlogListQueryDTO,
  ): Promise<{ items: BlogResponseDTO[]; total: number }> {
    const { page, limit } = parsePageLimit(query);

    const result = await this.blogRepo.listUserBlogs(
      userId,
      "draft",
      page,
      limit,
    );
    return {
      items: result.items.map(toBlogResponse),
      total: result.total,
    };
  }

  // Writer statistics — "number of blogs" published and in draft
  async getBlogCount(userId: string): Promise<BlogCountDTO> {
    return this.blogRepo.countUserBlogs(userId);
  }

  // Bookmark / unbookmark a published blog
  async setBookmark(
    userId: string,
    blogId: string,
    bookmarked: boolean,
  ): Promise<BlogBookmarkDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.status !== "published") {
      throw new BadRequestError("Only published blogs can be bookmarked");
    }

    if (bookmarked) {
      await this.blogRepo.addBookmark(blogId, userId);
    } else {
      await this.blogRepo.removeBookmark(blogId, userId);
    }

    return { blogId, isBookmarked: bookmarked };
  }

  // The viewer's saved list ("Saved" tab)
  async listBookmarks(
    userId: string,
    query: BlogListQueryDTO,
  ): Promise<{ items: BlogResponseDTO[]; total: number }> {
    const { page, limit } = parsePageLimit(query);

    const result = await this.blogRepo.listUserBookmarks(userId, page, limit);
    return {
      items: result.items.map(toBlogResponse),
      total: result.total,
    };
  }

  // Light sanity checks — title cap, content cap (no external validation layer)
  private validateContent(data: CreateBlogDTO | UpdateBlogDTO): void {
    if (data.title !== undefined && data.title.length > 200) {
      throw new BadRequestError("Title is too long (max 200 characters)");
    }
    if (data.content !== undefined && data.content.length > 500_000) {
      throw new BadRequestError("Content is too long (max 500,000 characters)");
    }
    if (data.description !== undefined && data.description.length > 500) {
      throw new BadRequestError("Description is too long (max 500 characters)");
    }
  }
}

export default BlogService;
