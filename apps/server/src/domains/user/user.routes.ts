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

// Suggested users to follow (before the /:handle catch-all)
router.get("/suggestions", requireAuth, userController.listSuggestions);

// Saved settings — GET returns the user's preference snapshot, PUT validates
// and persists the complete snapshot ("Save changes", transactional; genres
// land in users.fav_genre). Both before the /:handle catch-all.
router.get("/settings", requireAuth, userController.getSettings);
router.put("/settings", requireAuth, userController.updateSettings);

// Permanent account deletion — DELETE /user/account (removes the user and,
// via ON DELETE CASCADE, blogs, bookmarks, follows, notifications, sessions)
router.delete("/account", requireAuth, userController.deleteAccount);

// Public profile by handle (must come after the fixed prefixes above)
router.get("/:handle", requireAuth, userController.getProfileByHandle);

// One page of a writer's followers (profile followers modal)
router.get("/:handle/followers", requireAuth, userController.listFollowers);

// Upload avatar — multipart/form-data, field name "avatar".
// Returns `{ url }`; the caller then PATCHes /edit-profile with `avatar: <url>`.
router.post("/avatar", requireAuth, avatarUpload, userController.uploadAvatar);

// Follow / unfollow a user by handle (creating the follow if exactly missing)
router.post("/:handle/follow", requireAuth, userController.followUser);
router.delete("/:handle/follow", requireAuth, userController.unfollowUser);

// Edit User profile
router.patch("/edit-profile", requireAuth, userController.editUserProfile);

export default router;
