import type { Request, Response, NextFunction } from "express";
import type {
  BlogListQueryDTO,
  CreateBlogDTO,
  UpdateBlogDTO,
} from "@quill/shared";
import BlogService from "./blog.service";

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
      const data: CreateBlogDTO = req.body;
      const result = await this.blogService.createDraft(userId, data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Feed of published blogs — GET /blogs?page&limit
  listFeed = async (
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
      const result = await this.blogService.listFeed(userId, query);

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
      const result = await this.blogService.getBlog(userId, String(req.params.id));

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
      const data: UpdateBlogDTO = req.body;
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
  publishBlog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.blogService.publishBlog(userId, String(req.params.id));

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
}

export default BlogController;
