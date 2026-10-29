import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import UserController from "./user.controller";
import { avatarUpload } from "./avatar-upload";

const router = express.Router();
const userController = new UserController();

// My profile
router.get("/me", requireAuth, userController.getMe);

// My following list (before the /:handle catch-all)
router.get("/following", requireAuth, userController.listFollowing);

// Public profile by handle (must come after the fixed prefixes above)
router.get("/:handle", requireAuth, userController.getProfileByHandle);

// Upload avatar — multipart/form-data, field name "avatar".
// Returns `{ url }`; the caller then PATCHes /edit-profile with `avatar: <url>`.
router.post("/avatar", requireAuth, avatarUpload, userController.uploadAvatar);

// Follow / unfollow a user by handle (creating the follow if exactly missing)
router.post("/:handle/follow", requireAuth, userController.followUser);
router.delete("/:handle/follow", requireAuth, userController.unfollowUser);

// Edit User profile
router.patch("/edit-profile", requireAuth, userController.editUserProfile);

export default router;
