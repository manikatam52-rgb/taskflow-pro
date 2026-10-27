import { query } from "../config/database";
import {
  taskRowToDTO,
  type TaskDTO,
  type TaskRow,
  type Priority,
  type TaskStatus,
} from "../models/Task";
import { httpError } from "../middleware/errorMiddleware";
import { validateTaskBody } from "../utils/validation";
import { broadcastTaskEvent } from "../realtime/wsServer";

export type TaskSortBy =
  | "smart"
  | "deadline"
  | "priority"
  | "createdAt"
  | "updatedAt";

export interface TaskQuery {
  userId: string;
  status?: TaskStatus;
  priority?: Priority;
  category?: string;
  search?: string;
  sortBy?: TaskSortBy;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTaskId(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Server-side smart urgency score (documented in docs/ARCHITECTURE.md):
 * - overdue pending:      1000 + priorityWeight
 * - has deadline:         100 - hoursUntilDeadline (clamped >= 0) + priorityWeight
 * - no deadline pending:  10 + priorityWeight
 * - completed:            -1000 (always last)
 * priorityWeight: high=30, medium=20, low=10
 */
export function urgencyScore(task: {
  status: TaskStatus;
  priority: Priority;
  deadline: Date | null;
}): number {
  if (task.status === "completed") return -1000;
  const weight = task.priority === "high" ? 30 : task.priority === "medium" ? 20 : 10;

  if (task.deadline && task.deadline.getTime() < Date.now()) return 1000 + weight;
  if (task.deadline) {
    const hours = (task.deadline.getTime() - Date.now()) / 3_600_000;
    return 100 - Math.min(Math.max(hours, 0), 100) + weight;
  }
  return 10 + weight;
}

/** Builds the SQL WHERE clause from query params, always scoped to the user. */
function buildWhere(userId: string, q: Record<string, unknown>): { sql: string; params: unknown[] } {
  const clauses: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];

  const status = q.status;
  if (typeof status === "string" && ["pending", "completed"].includes(status)) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  const priority = q.priority;
  if (typeof priority === "string" && ["low", "medium", "high"].includes(priority)) {
    params.push(priority);
    clauses.push(`priority = $${params.length}`);
  }
  if (typeof q.category === "string" && q.category.trim()) {
    params.push(q.category.trim().toLowerCase());
    clauses.push(`category = $${params.length}`);
  }
  if (typeof q.search === "string" && q.search.trim()) {
    const term = q.search.trim();
    params.push(`%${term}%`);
    const idx = params.length;
    clauses.push(
      `(title ILIKE $${idx} OR description ILIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE $${idx}))`
    );
  }
  return { sql: clauses.join(" AND "), params };
}

/** Deterministic in-memory sort applied after fetching (keeps "smart" ordering). */
function sortTasks(tasks: TaskDTO[], sortBy: TaskSortBy): TaskDTO[] {
  const copy = [...tasks];
  const priorityWeight = (p: Priority) => (p === "high" ? 30 : p === "medium" ? 20 : 10);
  const dl = (t: TaskDTO) => (t.deadline ? t.deadline.getTime() : Infinity);

  copy.sort((a, b) => {
    switch (sortBy) {
      case "smart": {
        const diff = urgencyScore(b) - urgencyScore(a);
        return diff || dl(a) - dl(b) || a.createdAt.getTime() - b.createdAt.getTime();
      }
      case "deadline":
        return dl(a) - dl(b) || a.createdAt.getTime() - b.createdAt.getTime();
      case "priority":
        return priorityWeight(b.priority) - priorityWeight(a.priority) || dl(a) - dl(b);
      case "updatedAt":
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      case "createdAt":
      default:
        return b.createdAt.getTime() - a.createdAt.getTime();
    }
  });
  return copy;
}

export async function listTasks(userId: string, q: Record<string, unknown>): Promise<TaskDTO[]> {
  const where = buildWhere(userId, q);
  const sortBy: TaskSortBy = (
    typeof q.sortBy === "string" &&
      ["smart", "deadline", "priority", "createdAt", "updatedAt"].includes(q.sortBy)
      ? q.sortBy
      : "smart"
  ) as TaskSortBy;

  const result = await query<TaskRow>(
    `SELECT * FROM tasks WHERE ${where.sql}`,
    where.params
  );
  const dtos = result.rows.map(taskRowToDTO);
  return sortTasks(dtos, sortBy);
}

export async function getTaskById(userId: string, id: string): Promise<TaskDTO> {
  if (!isTaskId(id)) throw httpError(400, "Invalid task id");
  const result = await query<TaskRow>(
    "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (result.rows.length === 0) throw httpError(404, "Task not found");
  return taskRowToDTO(result.rows[0]);
}

export async function createTask(
  userId: string,
  body: Record<string, unknown>
): Promise<TaskDTO> {
  const fields = validateTaskBody(body, "create");
  const result = await query<TaskRow>(
    `INSERT INTO tasks (user_id, title, description, scheduled_at, deadline, priority, status, category, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      fields.title ?? "",
      fields.description ?? "",
      fields.scheduledAt ?? null,
      fields.deadline ?? null,
      fields.priority ?? "medium",
      fields.status ?? "pending",
      fields.category ?? "general",
      fields.tags ?? [],
    ]
  );
  const dto = taskRowToDTO(result.rows[0]);
  broadcastTaskEvent({ type: "task.created", task: dto, at: new Date().toISOString() }, userId);
  return dto;
}

export async function updateTask(
  userId: string,
  id: string,
  body: Record<string, unknown>
): Promise<TaskDTO> {
  if (!isTaskId(id)) throw httpError(400, "Invalid task id");
  // Only editable fields are taken from the body; userId/protected fields ignored.
  const fields = validateTaskBody(body, "update");
  if (Object.keys(fields).length === 0) throw httpError(400, "No editable fields provided");

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (fields.title !== undefined) add("title", fields.title);
  if (fields.description !== undefined) add("description", fields.description);
  if (fields.scheduledAt !== undefined) add("scheduled_at", fields.scheduledAt);
  if (fields.deadline !== undefined) add("deadline", fields.deadline);
  if (fields.priority !== undefined) add("priority", fields.priority);
  if (fields.status !== undefined) {
    add("status", fields.status);
    add("completed_at", fields.status === "completed" ? new Date() : null);
  }
  if (fields.category !== undefined) add("category", fields.category);
  if (fields.tags !== undefined) add("tags", fields.tags);

  params.push(id, userId);
  const result = await query<TaskRow>(
    `UPDATE tasks SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw httpError(404, "Task not found");
  const dto = taskRowToDTO(result.rows[0]);
  broadcastTaskEvent({ type: "task.updated", task: dto, at: new Date().toISOString() }, userId);
  return dto;
}

/** Toggles completion, or forces a target status when body.status given. */
export async function toggleComplete(
  userId: string,
  id: string,
  targetStatus?: TaskStatus
): Promise<TaskDTO> {
  if (!isTaskId(id)) throw httpError(400, "Invalid task id");

  const existing = await query<TaskRow>(
    "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (existing.rows.length === 0) throw httpError(404, "Task not found");
  const current = existing.rows[0];

  const next: TaskStatus =
    targetStatus ??
    (current.status === "completed" ? "pending" : "completed");

  const result = await query<TaskRow>(
    `UPDATE tasks
     SET status = $3, completed_at = $4, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, next, next === "completed" ? new Date() : null]
  );
  const dto = taskRowToDTO(result.rows[0]);
  broadcastTaskEvent({ type: "task.updated", task: dto, at: new Date().toISOString() }, userId);
  return dto;
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  if (!isTaskId(id)) throw httpError(400, "Invalid task id");
  const result = await query<TaskRow>(
    "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  if (result.rows.length === 0) throw httpError(404, "Task not found");
  broadcastTaskEvent({ type: "task.deleted", id, at: new Date().toISOString() }, userId);
}
