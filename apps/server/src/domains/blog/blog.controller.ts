import type { Request, Response, NextFunction } from "express";
import type {
  BlogListQueryDTO,
  CreateBlogDTO,
  UpdateBlogDTO,
} from "@quill/shared";
import BlogService from "./blog.service";
import {
  parseBody,
  createBlogSchema,
  updateBlogSchema,
  publishBlogSchema,
  readingProgressSchema,
} from "../../core/validation/validation";

class BlogController {
  private blogService: BlogService;

  constructor() {
    this.blogService = new BlogService();
  }

  // Create a new blog (always saved as a draft) — POST /blogs
  createBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data: CreateBlogDTO = parseBody(createBlogSchema, req.body);
      const result = await this.blogService.createDraft(userId, data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Feed of published blogs — GET /blogs?page&limit&author&search
  listFeed = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const query: BlogListQueryDTO & { author?: string; search?: string } = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        author:
          typeof req.query.author === "string" ? req.query.author : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      };
      const result = await this.blogService.listFeed(userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Following feed — GET /blogs/following?page&limit
  listFollowingFeed = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const query: BlogListQueryDTO = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      };
      const result = await this.blogService.listFollowingFeed(userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // My published blogs — GET /blogs/published?page&limit
  listPublished = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const query: BlogListQueryDTO = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      };
      const result = await this.blogService.listPublishedByUser(userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // My drafts — GET /blogs/drafts?page&limit
  listDrafts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const query: BlogListQueryDTO = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      };
      const result = await this.blogService.listDrafts(userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Number of blogs (published / drafts / total) — GET /blogs/count
  getBlogCount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.getBlogCount(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // My bookmarked blogs — GET /blogs/bookmarks?page&limit
  listBookmarks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const query: BlogListQueryDTO = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      };
      const result = await this.blogService.listBookmarks(userId, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get one blog — GET /blogs/:id
  getBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.getBlog(
        userId,
        String(req.params.id),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Save edits — PATCH /blogs/:id
  updateBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data: UpdateBlogDTO = parseBody(updateBlogSchema, req.body);
      const result = await this.blogService.updateBlog(
        userId,
        String(req.params.id),
        data,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete a blog — DELETE /blogs/:id
  deleteBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      await this.blogService.deleteBlog(userId, String(req.params.id));

      res.status(200).json({
        success: true,
        data: { id: req.params.id },
      });
    } catch (error) {
      next(error);
    }
  };

  // Publish a draft — POST /blogs/:id/publish
  // Body: {} (instant) or { publishAt: ISO } (scheduled — handled by the worker)
  publishBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const meta = parseBody(publishBlogSchema, req.body ?? {});
      const publishAt = meta.publishAt;
      const result = await this.blogService.publishBlog(
        userId,
        String(req.params.id),
        publishAt,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Cancel a scheduled publish — DELETE /blogs/:id/schedule
  cancelSchedule = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.cancelSchedule(
        userId,
        String(req.params.id),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Save to reading list — POST /blogs/:id/bookmark
  addBookmark = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.setBookmark(
        userId,
        String(req.params.id),
        true,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Remove from reading list — DELETE /blogs/:id/bookmark
  removeBookmark = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.setBookmark(
        userId,
        String(req.params.id),
        false,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Persist one monotonic progress snapshot for a reading session
  recordReadingProgress = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const progress = parseBody(readingProgressSchema, req.body);
      const result = await this.blogService.recordReadingProgress(
        req.user?.userId,
        String(req.params.id),
        progress,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default BlogController;
