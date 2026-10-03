import type { Request, Response, NextFunction } from "express";
import TokenService from "./token.service";
import { UnauthorizedError } from "../../core/errors";

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
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("No token provided"));
  }

  const token = authHeader.slice(7).trim();

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
