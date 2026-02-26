import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { sendError } from "../utils/api-response";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err.message, { stack: err.stack });

  if (err.name === "UnauthorizedError" || err.message === "Unauthorized") {
    sendError(res, "Unauthorized", 401, "UNAUTHORIZED");
    return;
  }

  if (err.name === "ForbiddenError" || err.message === "Forbidden") {
    sendError(res, "Forbidden", 403, "FORBIDDEN");
    return;
  }

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  sendError(res, message, statusCode, "INTERNAL_ERROR");
}
