import { Response } from "express";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const response: ApiSuccessResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code?: string,
  details?: unknown
): void {
  if (statusCode === 400) {
    console.error(`[DEBUG 400] sendError called with message: ${message}`, { code, details });
  }
  const response: ApiErrorResponse = {
    success: false,
    error: { message, code, details },
  };
  res.status(statusCode).json(response);
}
