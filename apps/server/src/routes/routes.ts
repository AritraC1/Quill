// All routes
import express from "express";

import authRoutes from "../domains/auth/auth.routes";
import userRoutes from "../domains/user/user.routes";
import blogRoutes from "../domains/blog/blog.routes";
import notificationRoutes from "../domains/notification/notification.routes";
import {
  blogCommentRoutes,
  commentRoutes,
} from "../domains/comment/comment.routes";

const router = express.Router();

// Auth Routes
router.use("/auth", authRoutes);

// User Routes
router.use("/user", userRoutes);

// Blog Routes
router.use("/blogs", blogRoutes);

// Comment Routes — threads that belong to a blog mount under its path;
// single-comment operations mount at /comments
router.use("/blogs/:blogId/comments", blogCommentRoutes);
router.use("/comments", commentRoutes);

// Notification Routes
router.use("/notifications", notificationRoutes);

export default router;
