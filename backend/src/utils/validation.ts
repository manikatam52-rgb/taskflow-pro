import { httpError } from "../middleware/errorMiddleware";
import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from "../models/Task";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: unknown): boolean {
  return typeof value === "string" && EMAIL_RE.test(value);
}

/** Password policy: at least 8 chars with at least one letter and one digit. */
export function isStrongPassword(value: unknown): boolean {
  return typeof value === "string" && value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "medium";
}

export function asStatus(value: unknown): TaskStatus {
  return STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "pending";
}

/** Accepts null, undefined, "", or a parseable date string; otherwise null. */
export function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Validates a task create/update body. Returns normalized fields. */
export function validateTaskBody(
  body: Record<string, unknown>,
  mode: "create" | "update"
): {
  title?: string;
  description?: string;
  scheduledAt?: Date | null;
  deadline?: Date | null;
  priority?: Priority;
  status?: TaskStatus;
  category?: string;
  tags?: string[];
} {
  const out: ReturnType<typeof validateTaskBody> = {};

  if (body.title !== undefined) {
    const title = asString(body.title).trim();
    if (mode === "create" && !title) {
      throw httpError(400, "Title is required");
    }
    if (title.length > 200) throw httpError(400, "Title must be at most 200 characters");
    out.title = title;
  } else if (mode === "create") {
    throw httpError(400, "Title is required");
  }

  if (body.description !== undefined) {
    out.description = asString(body.description).trim();
  }

  if (body.scheduledAt !== undefined) {
    out.scheduledAt = asDate(body.scheduledAt);
  }

  if (body.deadline !== undefined) {
    out.deadline = asDate(body.deadline);
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority as Priority)) {
      throw httpError(400, "Priority must be low, medium, or high");
    }
    out.priority = body.priority as Priority;
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as TaskStatus)) {
      throw httpError(400, "Status must be pending or completed");
    }
    out.status = body.status as TaskStatus;
  }

  if (body.category !== undefined) {
    out.category = asString(body.category, "general").trim() || "general";
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw httpError(400, "Tags must be an array of strings");
    out.tags = body.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  return out;
}
