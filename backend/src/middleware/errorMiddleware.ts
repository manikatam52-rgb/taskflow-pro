import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

/**
 * Central error handler. Produces a consistent JSON error envelope and never
 * leaks stack traces, secrets, or internals to the client.
 *
 * Recognizes:
 * - Mongoose validation errors        -> 400
 * - Mongoose CastError (bad ObjectId) -> 400
 * - Duplicate key (E11000)            -> 409
 * - Errors flagged with err.status    -> that status (used by routes)
 * - Anything else                     -> 500
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status = 500;
  let message = "Internal server error";

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    const first = Object.values(err.errors)[0];
    message = first ? first.message : "Validation failed";
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    status = 409;
    message = "Resource already exists";
  } else if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "message" in err
  ) {
    const e = err as { status: number; message: string };
    if (typeof e.status === "number") {
      status = e.status;
      message = e.message;
    }
  }

  // Full details go to the server console only.
  if (status === 500) {
    console.error("[error]", err);
  }

  res.status(status).json({ success: false, message });
}

/** Throws a well-typed operational error that errorMiddleware maps to `status`. */
export function httpError(status: number, message: string): Error & { status: number; message: string } {
  const err = new Error(message) as Error & { status: number; message: string };
  err.status = status;
  return err;
}
