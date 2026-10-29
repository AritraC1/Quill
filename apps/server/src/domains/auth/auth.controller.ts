import type { Request, Response, NextFunction } from "express";
import AuthService, { type LoginTokens } from "./auth.service";
import type {
  RefreshTokenDTO,
  RequestOtpDTO,
  SessionResponseDTO,
  SignUpRequestDTO,
  VerifyOtpDTO,
  AuthResponseDTO,
} from "@quill/shared";
import {
  AUTH_COOKIES,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from "../../core/config/cookie.config";
import {
  parseBody,
  requestOtpSchema,
  signUpSchema,
  verifyOtpSchema,
} from "../../core/validation/validation";

/** Issues the token pair as httpOnly cookies and strips the tokens from the JSON body */
const issueCookies = (res: Response, tokens: LoginTokens): void => {
  res.cookie(
    AUTH_COOKIES.access.name,
    tokens.accessToken,
    accessCookieOptions(),
  );
  res.cookie(
    AUTH_COOKIES.refresh.name,
    tokens.refreshToken,
    refreshCookieOptions(),
  );
};

/** Deletes both auth cookies (paths must match how they were set) */
const clearCookies = (res: Response): void => {
  res.clearCookie(
    AUTH_COOKIES.access.name,
    clearCookieOptions(AUTH_COOKIES.access.path),
  );
  res.clearCookie(
    AUTH_COOKIES.refresh.name,
    clearCookieOptions(AUTH_COOKIES.refresh.path),
  );
};

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
      const data: SignUpRequestDTO = parseBody(signUpSchema, req.body);
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
      const data: RequestOtpDTO = parseBody(requestOtpSchema, req.body);
      const result = await this.authService.requestOTP(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Verify OTP — tokens delivered as httpOnly cookies, never in the body
  verifyOTP = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: VerifyOtpDTO = parseBody(verifyOtpSchema, req.body);
      const { accessToken, refreshToken, onboardingCompleted } =
        await this.authService.verifyOtp(data);

      issueCookies(res, { accessToken, refreshToken });

      res.status(200).json({
        success: true,
        data: { onboardingCompleted } satisfies AuthResponseDTO,
      });
    } catch (error) {
      next(error);
    }
  };

  // Refresh Token — rotates the pair presented via httpOnly cookie (or legacy body field)
  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const cookieToken = req.cookies?.[AUTH_COOKIES.refresh.name] ?? undefined;
      const data: RefreshTokenDTO = {
        refreshToken: cookieToken ?? req.body?.refreshToken,
      };

      const { accessToken, refreshToken } =
        await this.authService.refreshToken(data);

      // The old pair (including the presented refresh cookie) is revoked by the service
      issueCookies(res, { accessToken, refreshToken });

      res.status(200).json({
        success: true,
        data: { success: true },
      });
    } catch (error) {
      next(error);
    }
  };

  // Session — lets the client restore auth state on boot without reading tokens via JS
  session = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: RefreshTokenDTO = {
        refreshToken: req.cookies?.[AUTH_COOKIES.refresh.name],
      };

      const result: SessionResponseDTO = await this.authService.session(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Logout — revokes every refresh token for the user and clears the cookies
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data: RefreshTokenDTO = {
        refreshToken:
          req.cookies?.[AUTH_COOKIES.refresh.name] ?? req.body?.refreshToken,
      };

      await this.authService.logout(data);

      clearCookies(res);

      res.status(200).json({
        success: true,
        data: { success: true },
      });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
