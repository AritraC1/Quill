import { describe, expect, it, mock } from "bun:test";
import AuthService from "./auth.service";
import { BadRequestError, ConflictError } from "../../core/errors";


describe("AuthService", () => {
  it("should throw BadRequestError if name or email is missing", async () => {
    const authService = new AuthService();

    expect(authService.createAccount({ name: "", email: "" })).rejects.toThrow(
      BadRequestError,
    );
  });

  it("should throw ConflictError if user already exists", async () => {
    const authService = new AuthService();
    // Mock userRepo.findByEmail to return an existing user
    // @ts-ignore
    authService.userRepo = {
      findByEmail: mock(async () => ({
        id: "1",
        email: "test@quill.dev",
        name: "Test",
        fav_genre: [],
        onboarding_completed: false,
        handle: null,
        created_at: new Date(),
        updated_at: new Date(),
      })),
    };

    expect(
      authService.createAccount({ name: "Test", email: "test@quill.dev" }),
    ).rejects.toThrow(ConflictError);
  });

  it("should generate and save a name-based handle on first login", async () => {
    const authService = new AuthService();
    const user = {
      id: "user-1",
      name: "Alice Smith",
      email: "alice@quill.dev",
      fav_genre: [],
      onboarding_completed: false,
      handle: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const generateAccountHandle = mock(
      async (_userId: string, handle: string) => ({ ...user, handle }),
    );

    // @ts-ignore
    authService.userRepo = {
      findByEmail: mock(async (_email: string) => user),
      generateAccountHandle,
    };
    // @ts-ignore
    authService.otpRepo = {
      findActiveByEmail: mock(async () => ({
        id: "otp-1",
        user_id: user.id,
        code_hash: "unused",
        expires_at: new Date(),
        revoked_at: null,
        created_at: new Date(),
      })),
      revokeById: mock(async (_id: string) => null),
    };
    // @ts-ignore
    authService.tokenService = {
      generateAccessToken: mock(async () => "access-token"),
      generateRefreshToken: mock(async () => "refresh-token"),
    };

    await authService.verifyOtp({ email: user.email, otp: "0000" });

    expect(generateAccountHandle).toHaveBeenCalledTimes(1);
    expect(generateAccountHandle).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^alicesmith\d{6}$/),
    );
  });
});
