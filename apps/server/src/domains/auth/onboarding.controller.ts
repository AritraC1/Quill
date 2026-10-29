import type { Request, Response, NextFunction } from "express";
import OnboardingService from "./onboarding.service";
import type { OnboardRequestDTO } from "@quill/shared";
import { onboardSchema, parseBody } from "../../core/validation/validation";

class OnboardingController {
  private onboardService: OnboardingService;

  constructor() {
    this.onboardService = new OnboardingService();
  }

  // Onboard
  onboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: OnboardRequestDTO = parseBody(onboardSchema, req.body);
      const result = await this.onboardService.onboard(req.user.userId, data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default OnboardingController;
