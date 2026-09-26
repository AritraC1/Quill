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
        created_at: new Date(),
        updated_at: new Date(),
      })),
    };

    expect(
      authService.createAccount({ name: "Test", email: "test@quill.dev" }),
    ).rejects.toThrow(ConflictError);
  });
});
