import type { Request, Response, NextFunction } from "express";
import UserService from "./user.service";
import type { EditProfileDTO } from "@quill/shared";

class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

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
}

export default UserController;
