// All routes
import express from "express";

import authRoutes from "../domains/auth/auth.routes";
import userRoutes from "../domains/user/user.routes";
import blogRoutes from "../domains/blog/blog.routes";
import notificationRoutes from "../domains/notification/notification.routes";

const router = express.Router();

// Auth Routes
router.use("/auth", authRoutes);

// User Routes
router.use("/user", userRoutes);

// Blog Routes
router.use("/blogs", blogRoutes);

// Notification Routes
router.use("/notifications", notificationRoutes);

export default router;
