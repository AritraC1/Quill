import type { Request, Response, NextFunction } from "express";
import UserService from "./user.service";
import type { EditProfileDTO, UserSettingsDTO } from "@quill/shared";
import { BadRequestError } from "../../core/errors";
import { parseBody, userSettingsSchema } from "../../core/validation/validation";
import {
  AUTH_COOKIES,
  clearCookieOptions,
} from "../../core/config/cookie.config";

class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // Get my profile — GET /user/me
  getMe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.userService.getMe(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Saved settings — GET /user/settings
  getSettings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.userService.getSettings(req.user?.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Save the complete settings snapshot — PUT /user/settings.
  // The user id comes from the access token only; the schema strips extra
  // keys from the body, so a forged "userId" reaches no code path.
  updateSettings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: UserSettingsDTO = parseBody(userSettingsSchema, req.body);
      const result = await this.userService.saveSettings(req.user?.userId, data);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Permanent account deletion — DELETE /user/account.
  // Clears the cookies on the way out so the browser is signed out locally;
  // every server-side session dies with the user row (ON DELETE CASCADE).
  deleteAccount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.userService.deleteAccount(req.user?.userId);

      res.clearCookie(
        AUTH_COOKIES.access.name,
        clearCookieOptions(AUTH_COOKIES.access.path),
      );
      res.clearCookie(
        AUTH_COOKIES.refresh.name,
        clearCookieOptions(AUTH_COOKIES.refresh.path),
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Edit User Profile
  editUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data: EditProfileDTO = req.body;
      const result = await this.userService.editUserProfile(userId, data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Public profile by handle — GET /user/:handle
  getProfileByHandle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const viewerId = req.user?.userId;
      const result = await this.userService.getProfileByHandle(
        viewerId,
        String(req.params.handle),
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Follow — POST /user/:handle/follow
  followUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const followerId = req.user?.userId;
      const result = await this.userService.followUser(
        followerId,
        String(req.params.handle),
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Unfollow — DELETE /user/:handle/follow
  unfollowUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const followerId = req.user?.userId;
      const result = await this.userService.unfollowUser(
        followerId,
        String(req.params.handle),
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // The authenticated user's follows — GET /user/following
  listFollowing = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.userService.listFollowing(req.user?.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Suggested users to follow — GET /user/suggestions
  listSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
      const result = await this.userService.listSuggestedUsers(
        req.user?.userId,
        limit,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // One page of a writer's followers — GET /user/:handle/followers?page&limit
  listFollowers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const viewerId = req.user?.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const result = await this.userService.listFollowers(
        viewerId,
        String(req.params.handle),
        page,
        limit,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Upload an avatar file — POST /user/avatar (multipart, field "avatar")
  uploadAvatar = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new BadRequestError("No avatar file received");
      }
      // Same mount as app.use("/uploads", ...) in index.ts; the DB keeps only
      // this small path instead of a base64 blob
      res.status(201).json({
        success: true,
        data: { url: `/uploads/${req.file.filename}` },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default UserController;
