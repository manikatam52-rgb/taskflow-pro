import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, type SafeUser } from "../models/User";
import { isEmail, isStrongPassword } from "../utils/validation";
import { httpError } from "../middleware/errorMiddleware";

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: SafeUser;
}

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: userId }, secret, options);
}

/** Registers a new account. Throws 409 on duplicate email. */
export async function register(email: unknown, password: unknown, name?: unknown): Promise<AuthResult> {
  if (!isEmail(email)) {
    throw httpError(400, "Please provide a valid email address");
  }
  if (!isStrongPassword(password)) {
    throw httpError(400, "Password must be at least 8 characters and include a letter and a number");
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw httpError(409, "An account with this email already exists");
  }

  const hashed = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const user = await User.create({
    email: normalizedEmail,
    password: hashed,
    name: typeof name === "string" ? name.trim() : "",
  });

  return { token: signToken(user._id.toString()), user: user.toSafeUser() };
}

/** Logs in with email + password. Throws 401 on bad credentials. */
export async function login(email: unknown, password: unknown): Promise<AuthResult> {
  if (!isEmail(email) || typeof password !== "string" || password.length === 0) {
    throw httpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  // Same generic message for unknown email and wrong password (no user enumeration).
  if (!user) throw httpError(401, "Invalid email or password");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw httpError(401, "Invalid email or password");

  return { token: signToken(user._id.toString()), user: user.toSafeUser() };
}
