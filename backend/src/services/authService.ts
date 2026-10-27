import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { toSafeUser, type SafeUser, type UserRow } from "../models/User";
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

  const existing = await query<UserRow>(
    "SELECT * FROM users WHERE email = $1",
    [normalizedEmail]
  );
  if (existing.rows.length > 0) {
    throw httpError(409, "An account with this email already exists");
  }

  const hashed = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const inserted = await query<UserRow>(
    `INSERT INTO users (email, password, name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [normalizedEmail, hashed, typeof name === "string" ? name.trim() : ""]
  );

  const user = inserted.rows[0];
  return { token: signToken(user.id), user: toSafeUser(user) };
}

/** Logs in with email + password. Throws 401 on bad credentials. */
export async function login(email: unknown, password: unknown): Promise<AuthResult> {
  if (!isEmail(email) || typeof password !== "string" || password.length === 0) {
    throw httpError(400, "Email and password are required");
  }

  const found = await query<UserRow>(
    "SELECT * FROM users WHERE email = $1",
    [String(email).toLowerCase().trim()]
  );

  // Same generic message for unknown email and wrong password (no user enumeration).
  if (found.rows.length === 0) throw httpError(401, "Invalid email or password");

  const user = found.rows[0];
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw httpError(401, "Invalid email or password");

  return { token: signToken(user.id), user: toSafeUser(user) };
}

/** Fetches a user by id (used by the auth middleware). */
export async function findUserById(id: string): Promise<SafeUser | null> {
  const found = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return found.rows.length > 0 ? toSafeUser(found.rows[0]) : null;
}
