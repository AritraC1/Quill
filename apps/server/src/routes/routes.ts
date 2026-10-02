// All routes
import express  from "express";

import authRoutes from "../domains/auth/auth.routes";

const router = express.Router();

// Auth routes
router.use("/auth", authRoutes);

export default router;