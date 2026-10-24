import bcrypt from "bcrypt";
import crypto from "node:crypto";

import type {
  AuthResponseDTO,
  RefreshTokenDTO,
  RequestOtpDTO,
  SignUpRequestDTO,
  VerifyOtpDTO,
} from "@quill/shared";
import { BadRequestError, ConflictError } from "../../core/errors";
import UserRepository from "../user/user.repository";
import OtpRepository from "./otp.repository";
import type { UserModel } from "../user/user.model";
import { emailQueue } from "../../jobs/queue";
import TokenService from "./token.service";

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

    // check for user
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new BadRequestError("User does not exist");
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
  async verifyOtp(data: VerifyOtpDTO): Promise<AuthResponseDTO> {
    // validate data
    if (!data.email || !data.otp) {
      throw new BadRequestError("Email and OTP are required");
    }

    // check for user
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new BadRequestError("User does not exist");
    }

    // check for active otp
    const activeOtp = await this.otpRepo.findActiveByEmail(data.email);
    if (!activeOtp) {
      throw new BadRequestError("No active OTP found for this email");
    }

    // Verify OTP (allow test OTP 0000 or compare with stored hash)
    // const isVerified = await bcrypt.compare(data.otp, activeOtp.code_hash);
    const isVerified =
      data.otp === "0000" ||
      (await bcrypt.compare(data.otp, activeOtp.code_hash));
    if (!isVerified) {
      throw new BadRequestError("Invalid OTP");
    }

    // Consume OTP
    await this.otpRepo.revokeById(activeOtp.id);

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
  async refreshToken(data: RefreshTokenDTO): Promise<AuthResponseDTO> {
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

  // Logout
  async logout(userId: string): Promise<{ success: true }> {
    // validate user id
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    // revoke all refresh tokens for the user
    await this.tokenService.revokeAllRefreshTokens(userId);

    return { success: true };
  }
}

export default AuthService;
