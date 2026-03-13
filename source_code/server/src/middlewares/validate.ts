import { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { sendError } from "../utils/api-response";

type RequestField = "body" | "query" | "params";

export function validate(schema: z.ZodType, field: RequestField = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[field]);

    if (!result.success) {
      sendError(
        _res,
        "Validation failed",
        422,
        "VALIDATION_ERROR",
        result.error.format()
      );
      return;
    }

    req[field] = result.data;
    next();
  };
}
