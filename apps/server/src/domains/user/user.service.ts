import type { EditProfileDTO, UserProfileDTO } from "@quill/shared";
import UserRepository from "./user.repository";
import type { UserModel } from "./user.model";
import { BadRequestError, ConflictError, NotFoundError } from "../../core/errors";

// System-generated handles look like "julianvance328641"; edits follow
// the same shape (3–30 chars, lowercase letters/numbers/underscore/hyphen)
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

// The handle starts its 6-month lock clock after every change
const HANDLE_LOCK_MONTHS = 6;

class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  // The signed-in user's profile — bio is whatever was written during
  // onboarding (or edited later); null when the user never wrote one
  async getMe(userId: string): Promise<UserProfileDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // `website` is written only via edit-profile; nullable until then
    const website = (user as UserModel & { website?: string }).website ?? null;

    return {
      id: user.id,
      name: user.name,
      bio: user.bio ?? null,
      avatar: user.avatar ?? null,
      handle: user.handle ?? null,
      handleChangedAt: user.handle_changed_at
        ? new Date(user.handle_changed_at).toISOString()
        : null,
      website,
      favGenre: user.fav_genre ?? [],
    };
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

    // Handle edits: normalized, shape-checked, unique, 1×/6 months
    if (data.handle !== undefined) {
      const handle = data.handle.trim().toLowerCase();

      if (!HANDLE_PATTERN.test(handle)) {
        throw new BadRequestError(
          "Handles are 3–30 characters: lowercase letters, numbers, underscores and hyphens",
        );
      }

      if (handle !== user.handle) {
        // User can change Handle every once 6 months
        if (user.handle_changed_at) {
          const nextAllowedChange = new Date(user.handle_changed_at);

          nextAllowedChange.setMonth(
            nextAllowedChange.getMonth() + HANDLE_LOCK_MONTHS,
          );

          if (new Date() < nextAllowedChange) {
            throw new BadRequestError(
              "You can change your handle only once every 6 months",
            );
          }
        }

        // Uniqueness is also enforced by a partial DB index (005)
        const taken = await this.userRepo.findByHandle(handle);
        if (taken) {
          throw new ConflictError("That handle is already taken");
        }

        data.handle = handle;
      } else {
        // unchanged handle — don't re-trigger the lock clock
        data.handle = undefined;
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
