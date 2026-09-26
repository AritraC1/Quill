import type { Request, Response, NextFunction } from "express";
import AuthService from "./auth.service";
import type { SignUpRequestDTO } from "@quill/shared";

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

  // sign-in
  login = async () => {};
}

export default AuthController;
