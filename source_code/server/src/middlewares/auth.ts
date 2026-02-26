import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/api-response";
import { JwtPayload } from "../types";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "Authentication required", 401, "UNAUTHORIZED");
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    sendError(res, "Invalid or expired token", 401, "INVALID_TOKEN");
  }
}

export function requireRole(allowedRoles: Array<JwtPayload["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Authentication required", 401, "UNAUTHORIZED");
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, "Insufficient permissions", 403, "FORBIDDEN");
      return;
    }

    next();
  };
}
