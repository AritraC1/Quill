import type {
  DeleteAccountResultDTO,
  EditProfileDTO,
  FollowerListDTO,
  FollowResultDTO,
  PublicProfileDTO,
  UpdateUserSettingsDTO,
  UserSettingsDTO,
  UserProfileDTO,
} from "@quill/shared";
import UserRepository from "./user.repository";
import NotificationService from "../notification/notification.service";
import type { UserModel } from "./user.model";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../core/errors";
import type { UserSettingsRowModel } from "./settings.model";

// System-generated handles look like "julianvance328641"; edits follow
// the same shape (3–30 chars, lowercase letters/numbers/underscore/hyphen)
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

// The handle starts its 6-month lock clock after every change
const HANDLE_LOCK_MONTHS = 6;

// Handles that would be shadowed by static routes (/feed, /write, ...) and
// therefore unreachable — same list the client router treats as reserved
const RESERVED_HANDLES = new Set([
  "api",
  "docs",
  "auth",
  "user",
  "blogs",
  "uploads",
  "status",
  "onboarding",
  "feed",
  "profile",
  "write",
  "blog",
  "settings",
  "about",
  "login",
  "signup",
  "admin",
  "me",
  "topic",
]);

class UserService {
  private userRepo: UserRepository;
  private notificationService: NotificationService;

  constructor() {
    this.userRepo = new UserRepository();
    this.notificationService = new NotificationService();
  }

  // The signed-in user's profile — bio is whatever was written during
  // onboarding (or edited later); null when the user never wrote one
  async getMe(userId: string): Promise<UserProfileDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // `website` is written only via edit-profile; nullable until then
    const website = user.website ?? null;

    // Follower/following counts come from the backend so they're always
    // correct (e.g. when someone follows you, your own profile reflects it).
    const [followers, following] = await Promise.all([
      this.userRepo.countFollowers(userId),
      this.userRepo.listFollowingIds(userId),
    ]);

    return {
      id: user.id,
      name: user.name,
      // Signed-in user only (GET /user/me is behind requireAuth); public
      // profiles deliberately never include the email
      email: user.email,
      bio: user.bio ?? null,
      avatar: user.avatar ?? null,
      handle: user.handle ?? null,
      handleChangedAt: user.handle_changed_at
        ? new Date(user.handle_changed_at).toISOString()
        : null,
      website,
      favGenre: user.fav_genre ?? [],
      followers,
      following: following.length,
      createdAt: new Date(user.created_at).toISOString(),
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

    // Name edits: trimmed, 2–50 characters (same rules the client enforces)
    if (data.name !== undefined) {
      const name = data.name.trim();

      if (name.length < 2 || name.length > 50) {
        throw new BadRequestError("Name must be 2-50 characters");
      }

      data.name = name;
    }

    // Handle edits: normalized, shape-checked, unique, 1×/6 months
    if (data.handle !== undefined) {
      const handle = data.handle.trim().toLowerCase();

      if (!handle || !HANDLE_PATTERN.test(handle)) {
        throw new BadRequestError(
          "Handles are 3-30 characters: lowercase letters, numbers, underscores and hyphens",
        );
      }

      if (RESERVED_HANDLES.has(handle)) {
        throw new BadRequestError("That handle is reserved");
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

  // The signed-in user's saved preferences. A user who never saved anything
  // still gets a complete snapshot: the repo COALESCEs missing columns into
  // the same defaults the settings page seeds itself with.
  async getSettings(userId: string): Promise<UserSettingsDTO> {
    const row = await this.userRepo.getSettings(userId);
    if (!row) {
      throw new NotFoundError("User not found");
    }

    return this.toSettingsDTO(row);
  }

  // Validate + persist the complete snapshot ("Save changes" bar). The body
  // was schema-checked in the controller; here we normalize the genre list so
  // junk can never reach users.fav_genre (trim, dedupe, cap).
  async saveSettings(
    userId: string,
    data: UpdateUserSettingsDTO,
  ): Promise<UserSettingsDTO> {
    const genres = Array.from(
      new Set(data.genres.map((genre) => genre.trim()).filter(Boolean)),
    );

    if (genres.length > 20) {
      throw new BadRequestError("Choose at most 20 favourite topics");
    }

    const row = await this.userRepo.saveSettings(userId, {
      ...data,
      genres,
    });

    if (!row) {
      throw new NotFoundError("User not found");
    }

    return this.toSettingsDTO(row);
  }

  // Row → API shape (camelCase mirrors the client's Preferences)
  private toSettingsDTO(row: UserSettingsRowModel): UserSettingsDTO {
    return {
      genres: row.fav_genre ?? [],
      defaultTab: row.default_tab as "for-you" | "following",
      textSize: row.text_size,
      theme: row.theme as "light" | "sepia" | "dark",
      notifications: {
        appPosts: row.notif_app_posts,
        appFollowers: row.notif_app_followers,
        appScheduled: row.notif_app_scheduled,
        appReplies: row.notif_app_replies,
        emailDigest: row.notif_email_digest,
        emailFollowers: row.notif_email_followers,
        emailNews: row.notif_email_news,
      },
    };
  }

  // Permanent self-service account deletion. Blogs (published AND drafts),
  // bookmarks, follows, notifications, refresh tokens and OTPs are all
  // users.id ON DELETE CASCADE, so removing the user row removes exactly what
  // the settings page promises — the repo returns the counts as proof.
  async deleteAccount(userId: string): Promise<DeleteAccountResultDTO> {
    const stats = await this.userRepo.deleteAccount(userId);
    if (!stats) {
      throw new NotFoundError("User not found");
    }

    return { deleted: true, ...stats };
  }

  // Any writer's public profile — no email or internal flags leak out
  async getProfileByHandle(
    viewerId: string,
    handle: string,
  ): Promise<PublicProfileDTO> {
    const target = await this.userRepo.findByHandle(
      handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("User not found");
    }

    const [followers, isFollowing] = await Promise.all([
      this.userRepo.countFollowers(target.id),
      this.userRepo.isFollowing(viewerId, target.id),
    ]);

    return {
      id: target.id,
      name: target.name,
      bio: target.bio ?? null,
      avatar: target.avatar ?? null,
      handle: target.handle ?? handle,
      website: target.website ?? null,
      favGenre: target.fav_genre ?? [],
      createdAt: new Date(target.created_at).toISOString(),
      followers,
      isFollowing,
    };
  }

  // Follow a writer by handle
  async followUser(
    followerId: string,
    handle: string,
  ): Promise<FollowResultDTO> {
    const target = await this.userRepo.findByHandle(
      handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("User not found");
    }
    if (target.id === followerId) {
      throw new BadRequestError("You cannot follow yourself");
    }

    // Only a *new* follow notifies the writer — a repeat follow is a no-op
    // (the insert is idempotent) and must not create the event again
    const inserted = await this.userRepo.followUser(followerId, target.id);
    if (inserted) {
      await this.notificationService.notifyNewFollower(followerId, target.id);
    }

    const followers = await this.userRepo.countFollowers(target.id);

    return { handle: target.handle ?? handle, isFollowing: true, followers };
  }

  // Unfollow a writer by handle
  async unfollowUser(
    followerId: string,
    handle: string,
  ): Promise<FollowResultDTO> {
    const target = await this.userRepo.findByHandle(
      handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("User not found");
    }

    await this.userRepo.unfollowUser(followerId, target.id);
    const followers = await this.userRepo.countFollowers(target.id);

    return { handle: target.handle ?? handle, isFollowing: false, followers };
  }

  // The people a user follows (profile sidebar)
  async listFollowing(
    userId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
    }>
  > {
    return this.userRepo.listFollowingUsers(userId);
  }

  // One page of a writer's followers (profile followers modal)
  async listFollowers(
    viewerId: string,
    handle: string,
    page = 1,
    limit = 10,
  ): Promise<FollowerListDTO> {
    const target = await this.userRepo.findByHandle(
      handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("User not found");
    }

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    return this.userRepo.listFollowers(target.id, viewerId, safePage, safeLimit);
  }

  // Users to follow — everyone except current user and already followed
  async listSuggestedUsers(
    userId: string,
    limit = 5,
  ): Promise<
    Array<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
      bio: string | null;
      followers: number;
    }>
  > {
    return this.userRepo.listSuggestedUsers(userId, limit);
  }
}

export default UserService;
