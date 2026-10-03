import type { Request, Response, NextFunction } from "express";
import AuthService from "./auth.service";
import type {
  RefreshTokenDTO,
  RequestOtpDTO,
  SignUpRequestDTO,
  VerifyOtpDTO,
} from "@quill/shared";
import { BadRequestError } from "../../core/errors";

class AuthController {
  // constructor
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // sign-up
  createAccount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: SignUpRequestDTO = req.body;
      const result = await this.authService.createAccount(data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      // Forward the error to the centralized error handler
      next(error);
    }
  };

  // Request OTP
  requestOTP = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: RequestOtpDTO = req.body;
      const result = await this.authService.requestOTP(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Verify OTP
  verifyOTP = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: VerifyOtpDTO = req.body;
      const result = await this.authService.verifyOtp(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Refresh Token
  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: RefreshTokenDTO = req.body;
      const result = await this.authService.refreshToken(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Logout
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new BadRequestError("User ID is required");
      }

      const result = await this.authService.logout(userId as string);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
