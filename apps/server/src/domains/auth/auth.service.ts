import bcrypt from "bcrypt";
import crypto from "node:crypto";

import type {
  RequestOtpDTO,
  SignUpRequestDTO,
  VerifyOtpDTO,
} from "@quill/shared";
import { BadRequestError, ConflictError } from "../../core/errors";
import UserRepository from "../user/user.repository";
import OtpRepository from "./otp.repository";
import type { UserModel } from "../user/user.model";
import { emailQueue } from "../../jobs/queue";

class AuthService {
  private userRepo: UserRepository;
  private otpRepo: OtpRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.otpRepo = new OtpRepository();
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

    // generate OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
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
  async verifyOtp(data: VerifyOtpDTO): Promise<{ accessToken: string }> {
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

    // Verify OTP
    const isVerified = await bcrypt.compare(data.otp, activeOtp.code_hash);
    if (!isVerified) {
      throw new BadRequestError("Invalid OTP");
    }

    // Generate Access Token
    // TODO: Implement JWT

    // Return Access Token
    return { accessToken: "TODO: Implement JWT" };
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
}

export default AuthService;
