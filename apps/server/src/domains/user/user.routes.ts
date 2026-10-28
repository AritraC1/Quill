import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import UserController from "./user.controller";

const router = express.Router();
const userController = new UserController();

// My profile
router.get("/me", requireAuth, userController.getMe);

// Edit User profile
router.patch("/edit-profile", requireAuth, userController.editUserProfile);

export default router;
