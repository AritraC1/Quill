import type { Request, Response, NextFunction } from "express";
import TokenService from "./token.service";
import { UnauthorizedError } from "../../core/errors";
import { AUTH_COOKIES } from "../../core/config/cookie.config";

const tokenService = new TokenService();

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    type: "access";
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  // Bearer header (programmatic clients) or httpOnly cookie (browser SPA)
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = req.cookies?.[AUTH_COOKIES.access.name] as string | undefined;
  }

  if (!token) {
    return next(new UnauthorizedError("No token provided"));
  }

  try {
    const payload = await tokenService.verifyToken(token);

    if (payload.type !== "access") {
      return next(new UnauthorizedError("Invalid token type"));
    }

    req.user = {
      userId: payload.userId,
      type: payload.type,
    };

    return next();
  } catch {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
}
