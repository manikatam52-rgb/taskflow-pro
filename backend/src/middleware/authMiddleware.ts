import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { User, type UserDocument } from "../models/User";

export interface AuthRequest extends Request {
  authUser?: HydratedDocument<UserDocument>;
}

/**
 * Verifies the Bearer JWT and loads the authenticated user onto the request.
 * Task ownership is ALWAYS derived from this verified identity, never from a
 * user id supplied by the client.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Missing authentication token" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  let payload: { sub?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    payload = jwt.verify(token, secret) as { sub?: string };
  } catch {
    // Covers expired, tampered, and malformed tokens alike.
    res.status(401).json({ success: false, message: "Invalid or expired token" });
    return;
  }

  if (!payload.sub) {
    res.status(401).json({ success: false, message: "Invalid token" });
    return;
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user) {
      // Token is valid but the account no longer exists — treat as unauthenticated.
      res.status(401).json({ success: false, message: "Account not found" });
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
