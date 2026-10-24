import type { OnboardRequestDTO } from "@quill/shared";
import { BadRequestError } from "../../core/errors";
import UserRepository from "../user/user.repository";

class OnboardingService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  // Onboard new user
  async onboard(
    userId: string,
    data: OnboardRequestDTO,
  ): Promise<{ success: true }> {
    if (!data.favGenre?.length) {
      throw new BadRequestError("At least one genre is required");
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BadRequestError("User not found");
    }

    if (user.onboarding_completed) {
      throw new BadRequestError("Onboarding has already been completed");
    }

    const updatedUser = await this.userRepo.completeOnboarding(
      userId,
      data,
    );

    if (!updatedUser) {
      throw new BadRequestError("Onboarding has already been completed");
    }

    return { success: true };
  }
}

export default OnboardingService;
