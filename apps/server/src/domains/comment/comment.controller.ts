// HTTP layer for comments — parses requests, delegates to CommentService,
// and wraps responses in the standard `{ success, data }` envelope.
import type { Request, Response, NextFunction } from "express";
import type {
  CommentListQueryDTO,
  CreateCommentDTO,
  UpdateCommentDTO,
} from "@quill/shared";
import CommentService from "./comment.service";
import {
  parseBody,
  createCommentSchema,
  updateCommentSchema,
  commentReactionSchema,
} from "../../core/validation/validation";

class CommentController {
  private commentService: CommentService;

  constructor() {
    this.commentService = new CommentService();
  }

  // Page of a blog's comments — GET /blogs/:blogId/comments?page&limit
  listComments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const blogId = String(req.params.blogId);
      const query: CommentListQueryDTO = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      };
      const result = await this.commentService.listComments(
        userId,
        blogId,
        query,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Add a comment (or a reply) — POST /blogs/:blogId/comments
  createComment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const blogId = String(req.params.blogId);
      const data: CreateCommentDTO = parseBody(createCommentSchema, req.body);
      const result = await this.commentService.createComment(
        userId,
        blogId,
        data,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Save an edit — PATCH /comments/:commentId
  updateComment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data: UpdateCommentDTO = parseBody(updateCommentSchema, req.body);
      const result = await this.commentService.updateComment(
        userId,
        String(req.params.commentId),
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

  // Delete (soft) — DELETE /comments/:commentId
  deleteComment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      await this.commentService.deleteComment(
        userId,
        String(req.params.commentId),
      );

      res.status(200).json({
        success: true,
        data: { id: req.params.commentId },
      });
    } catch (error) {
      next(error);
    }
  };

  // Apply the viewer's reaction — PUT /comments/:commentId/reaction
  setReaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { reactionType } = parseBody(commentReactionSchema, req.body);
      const result = await this.commentService.setReaction(
        userId,
        String(req.params.commentId),
        reactionType,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Remove the viewer's reaction — DELETE /comments/:commentId/reaction
  removeReaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { reactionType } = parseBody(commentReactionSchema, req.body);
      const result = await this.commentService.removeReaction(
        userId,
        String(req.params.commentId),
        reactionType,
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

export default CommentController;
