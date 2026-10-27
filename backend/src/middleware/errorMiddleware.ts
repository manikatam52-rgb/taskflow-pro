import type { NextFunction, Request, Response } from "express";

/**
 * Central error handler. Produces a consistent JSON error envelope and never
 * leaks stack traces, secrets, or internals to the client.
 *
 * Recognizes:
 * - PostgreSQL unique violation (23505) -> 409
 * - PostgreSQL check/invalid value errors (23514, 22P02) -> 400
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

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  ) {
    const pgCode = (err as { code: string }).code;
    if (pgCode === "23505") {
      status = 409;
      message = "Resource already exists";
    } else if (pgCode === "23514" || pgCode === "22P02") {
      status = 400;
      message = "Invalid value provided";
    }
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
