import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";

import { jwtConfig } from "../../core/config/jwt.config";
import { BadRequestError, UnauthorizedError } from "../../core/errors";
import TokenRepository from "./token.repository";
import ms from "ms";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  userId: string;
  type: TokenType;
}

const secretKey = new TextEncoder().encode(jwtConfig.secret);

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

class TokenService {
  private tokenRepo: TokenRepository;

  constructor() {
    this.tokenRepo = new TokenRepository();
  }

  // Generate Access Token
  async generateAccessToken(userId: string): Promise<string> {
    return new SignJWT({
      userId,
      type: "access",
    })
      .setProtectedHeader({ alg: jwtConfig.algorithm })
      .setIssuedAt()
      .setExpirationTime(jwtConfig.accessTokenExpiry)
      .sign(secretKey);
  }

  // Generate Refresh Token
  async generateRefreshToken(userId: string): Promise<string> {
    const token = await new SignJWT({
      userId,
      type: "refresh",
    })
      .setProtectedHeader({ alg: jwtConfig.algorithm })
      .setIssuedAt()
      .setExpirationTime(jwtConfig.refreshTokenExpiry)
      .sign(secretKey);

    const tokenHash = hashToken(token);

    const expiresAt = new Date(Date.now() + this.getRefreshTokenExpiryMs());

    await this.tokenRepo.create(userId, tokenHash, expiresAt);

    return token;
  }

  // Verify Token
  async verifyToken(token: string): Promise<TokenPayload> {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [jwtConfig.algorithm],
    });

    if (
      typeof payload.userId !== "string" ||
      (payload.type !== "access" && payload.type !== "refresh")
    ) {
      throw new UnauthorizedError("Invalid token payload");
    }

    return {
      userId: payload.userId,
      type: payload.type,
    };
  }

  // Verify Refresh Token
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    const payload = await this.verifyToken(token);

    if (payload.type !== "refresh") {
      throw new UnauthorizedError("Refresh token required");
    }

    const tokenHash = hashToken(token);

    const storedToken = await this.tokenRepo.findActiveByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError("Refresh token is invalid or revoked");
    }

    return payload;
  }

  // Revoke Refresh Token
  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);

    const storedToken = await this.tokenRepo.findActiveByHash(tokenHash);

    if (storedToken) {
      await this.tokenRepo.revokeById(storedToken.id);
    }
  }

  // Revoke All Refresh Tokens
  async revokeAllRefreshTokens(userId: string): Promise<{ success: true }> {
    // validate user id
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }

    // revoke all refresh tokens for the user
    await this.tokenRepo.revokeAllByUserId(userId);

    return { success: true };
  }

  // Get Refresh Token Expiry in milliseconds
  private getRefreshTokenExpiryMs(): number {
    return ms(jwtConfig.refreshTokenExpiry);
  }
}

export default TokenService;
