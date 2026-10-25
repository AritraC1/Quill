import type { EditProfileDTO } from "@quill/shared";
import UserRepository from "./user.repository";
import type { UserModel } from "./user.model";
import { BadRequestError } from "../../core/errors";

class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  // Edit user repo
  async editUserProfile(
    userId: string,
    data: EditProfileDTO,
  ): Promise<UserModel> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BadRequestError("User not found");
    }

    // User can change Handle every once 6 months
    if (data.handle && data.handle !== user.handle) {
      if (user.handle_changed_at) {
        const nextAllowedChange = new Date(user.handle_changed_at);

        nextAllowedChange.setMonth(nextAllowedChange.getMonth() + 6);

        if (new Date() < nextAllowedChange) {
          throw new BadRequestError(
            "You can change your handle only once every 6 months",
          );
        }
      }
    }

    const updatedUser = await this.userRepo.editUserProfile(userId, data);

    if (!updatedUser) {
      throw new BadRequestError("Failed to update user profile");
    }

    return updatedUser;
  }
}

export default UserService;
