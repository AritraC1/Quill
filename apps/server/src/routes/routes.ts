// All routes
import express from "express";

import authRoutes from "../domains/auth/auth.routes";
import userRoutes from "../domains/user/user.routes";

const router = express.Router();

// Auth Routes
router.use("/auth", authRoutes);

// User Routes
router.use("/user", userRoutes);

export default router;
