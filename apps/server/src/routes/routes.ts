// All routes
import express from "express";

import authRoutes from "../domains/auth/auth.routes";
import userRoutes from "../domains/user/user.routes";
import blogRoutes from "../domains/blog/blog.routes";

const router = express.Router();

// Auth Routes
router.use("/auth", authRoutes);

// User Routes
router.use("/user", userRoutes);

// Blog Routes
router.use("/blogs", blogRoutes);

export default router;
