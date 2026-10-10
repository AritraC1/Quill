import { env } from "./env";

// JWT (JSON Web Token) configuration
export const jwtConfig = {
  // Secret key used to sign and verify JWTs
  secret: env.JWT_SECRET,

  // Expiration time for access and refresh tokens
  accessTokenExpiry: env.JWT_EXPIRES_IN,
  refreshTokenExpiry: env.JWT_REFRESH_EXPIRES_IN,

  // Signing algorithm used to generate and verify JWTs
  algorithm: "HS256" as const,
};
