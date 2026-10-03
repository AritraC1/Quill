import { env } from "./env";

export const jwtConfig = {
  secret: env.JWT_SECRET,
  accessTokenExpiry: env.JWT_EXPIRES_IN,
  refreshTokenExpiry: env.JWT_REFRESH_EXPIRES_IN,
  algorithm: "HS256" as const,
};
