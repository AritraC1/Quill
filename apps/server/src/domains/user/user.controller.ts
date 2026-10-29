import type { Request, Response, NextFunction } from "express";
import UserService from "./user.service";
import type { EditProfileDTO } from "@quill/shared";
import { BadRequestError } from "../../core/errors";

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
