// Comment routes. Two mount points (see routes.ts):
//   /blogs/:blogId/comments -> blogCommentRoutes (list + add for one blog)
//   /comments               -> commentRoutes    (edit/delete + reactions)
import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import CommentController from "./comment.controller";

const commentController = new CommentController();

// Mounted under /blogs/:blogId/comments. mergeParams keeps the mount-path
// `:blogId`, so handlers still read req.params.blogId.
const blogCommentRoutes = express.Router({ mergeParams: true });

// Read / Write
blogCommentRoutes.get("/", requireAuth, commentController.listComments);
blogCommentRoutes.post("/", requireAuth, commentController.createComment);

// Mounted at /comments — single-comment operations
const commentRoutes = express.Router();

commentRoutes.patch(
  "/:commentId",
  requireAuth,
  commentController.updateComment,
);
commentRoutes.delete(
  "/:commentId",
  requireAuth,
  commentController.deleteComment,
);
commentRoutes.put(
  "/:commentId/reaction",
  requireAuth,
  commentController.setReaction,
);
commentRoutes.delete(
  "/:commentId/reaction",
  requireAuth,
  commentController.removeReaction,
);

export { blogCommentRoutes, commentRoutes };
