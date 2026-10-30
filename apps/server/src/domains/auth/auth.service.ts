import bcrypt from "bcrypt";
import crypto from "node:crypto";

import type {
  LogoutRequestDTO,
  RefreshTokenDTO,
  RequestOtpDTO,
  SessionResponseDTO,
  SignUpRequestDTO,
  VerifyOtpDTO,
} from "@quill/shared";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../core/errors";
import UserRepository from "../user/user.repository";
import OtpRepository from "./otp.repository";
import type { UserModel } from "../user/user.model";
import { emailQueue } from "../../jobs/queue";
import TokenService from "./token.service";

/** Internal result of issuing a token pair — the controller turns this into httpOnly cookies */
export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private userRepo: UserRepository;
  private otpRepo: OtpRepository;
  private tokenService: TokenService;

  constructor() {
    this.userRepo = new UserRepository();
    this.otpRepo = new OtpRepository();
    this.tokenService = new TokenService();
  }

  // Create a new account
  async createAccount(data: SignUpRequestDTO): Promise<UserModel> {
    // Validate data
    if (!data.name || !data.email) {
      throw new BadRequestError("Name and email are required");
    }

    // check existing user
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError("User already exists");
    }

    // Create user
    const newUser = await this.userRepo.createNewUser({
      name: data.name,
      email: data.email,
    });

    return newUser;
  }

  // Request OTP for login
  async requestOTP(data: RequestOtpDTO): Promise<{ success: true }> {
    // Validate data
    if (!data.email) {
      throw new BadRequestError("Email is required");
    }

    // check for user — response is intentionally identical to the
    // "user exists" path so the endpoint cannot be used to probe emails
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      return { success: true };
    }

    // revoke all otps for user
    await this.otpRepo.revokeAllForUser(user.id);

    // generate OTP (for testing set OTP 0000)
    // const otp = crypto.randomInt(100000, 1000000).toString();
    const otp = "0000";
    const codeHash = await bcrypt.hash(otp, 10);

    // create otp
    await this.otpRepo.createOtp({
      userId: user.id,
      codeHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });

    // send otp to user
    await emailQueue.add(
      "send-otp",
      { type: "otp", to: user.email, code: otp },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return { success: true };
  }

  // Verify OTP for Login
  async verifyOtp(
    data: VerifyOtpDTO,
  ): Promise<LoginTokens & { onboardingCompleted: boolean }> {
    // validate data
    if (!data.email || !data.otp) {
      throw new BadRequestError("Email and OTP are required");
    }

    // check for user
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      // Same message as the no-active-OTP case below, so unknown accounts
      // are indistinguishable from existing ones (enumeration defense)
      throw new BadRequestError("Invalid or expired OTP");
    }

    // check for active otp
    const activeOtp = await this.otpRepo.findActiveByEmail(data.email);
    if (!activeOtp) {
      throw new BadRequestError("Invalid or expired OTP");
    }

    // Verify OTP (allow test OTP 0000 or compare with stored hash)
    const isVerified =
      data.otp === "0000" ||
      (await bcrypt.compare(data.otp, activeOtp.code_hash));
    if (!isVerified) {
      throw new BadRequestError("Invalid or expired OTP");
    }

    // Consume OTP
    await this.otpRepo.revokeById(activeOtp.id);

    // Generate a handle once, on the user's first successful login
    if (!user.handle) {
      await this.generateAccountHandle(user);
    }

    // Generate Access Token
    const accessToken = await this.tokenService.generateAccessToken(user.id);

    // Generate Refresh Token
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    // Return Tokens and onboarding status
    return {
      accessToken,
      refreshToken,
      onboardingCompleted: Boolean(user.onboarding_completed),
    };
  }

  private async generateAccountHandle(user: UserModel): Promise<void> {
    const namePart =
      user.name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "user";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const handle = `${namePart}${crypto.randomInt(100_000, 1_000_000)}`;

      try {
        const updatedUser = await this.userRepo.generateAccountHandle(
          user.id,
          handle,
        );
        if (!updatedUser) {
          throw new BadRequestError("User does not exist");
        }
        return;
      } catch (error) {
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505";

        if (!isUniqueViolation || attempt === 4) {
          throw error;
        }
      }
    }
  }

  // Revoke all OTPs for a user
  async revokeAllOtpForUser(userId: string): Promise<{ success: true }> {
    // valid user id
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    // revoke all otps for user
    await this.otpRepo.revokeAllForUser(userId);

    return { success: true };
  }

  // Refresh Token
  async refreshToken(data: RefreshTokenDTO): Promise<LoginTokens> {
    // Validate data
    if (!data.refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    // Verify JWT + check refresh token in DB
    const payload = await this.tokenService.verifyRefreshToken(
      data.refreshToken,
    );

    // Revoke old refresh token
    await this.tokenService.revokeRefreshToken(data.refreshToken);

    // Generate new access token
    const accessToken = await this.tokenService.generateAccessToken(
      payload.userId,
    );

    // Generate and persist new refresh token
    const refreshToken = await this.tokenService.generateRefreshToken(
      payload.userId,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  // Logout — verifies the presented refresh token so we cannot be tricked
  // into revoking arbitrary users, then revokes:
  //   scope "device" (default) → only this session; other devices keep theirs
  //   scope "all"              → every refresh token for the user (sign-out-all)
  async logout(data: LogoutRequestDTO): Promise<{ success: true }> {
    // must have a refresh token to know who is logging out
    if (!data.refreshToken) {
      throw new UnauthorizedError("No active session");
    }

    // verify the presented token so we cannot be tricked into revoking arbitrary users
    const payload = await this.tokenService.verifyRefreshToken(
      data.refreshToken,
    );

    if ((data.scope ?? "device") === "all") {
      await this.tokenService.revokeAllRefreshTokens(payload.userId);
    } else {
      await this.tokenService.revokeRefreshToken(data.refreshToken);
    }

    return { success: true };
  }

  // Session — restores client state on boot from the httpOnly refresh cookie.
  // Does NOT rotate the token; cheap verification only.
  async session(data: RefreshTokenDTO): Promise<SessionResponseDTO> {
    if (!data.refreshToken) {
      throw new UnauthorizedError("Not authenticated");
    }

    const payload = await this.tokenService.verifyRefreshToken(
      data.refreshToken,
    );

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    return {
      authenticated: true,
      onboardingCompleted: Boolean(user.onboarding_completed),
    };
  }
}

export default AuthService;
