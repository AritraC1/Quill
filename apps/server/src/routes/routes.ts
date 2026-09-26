import express  from "express";
import authRoutes from "../domains/auth/auth.routes";

const router = express.Router();

// All routes

// Auth routes
router.use("/auth", authRoutes);

export default router;