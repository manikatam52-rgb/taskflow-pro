import { Types } from "mongoose";
import { Task, type TaskDTO, type Priority, type TaskStatus } from "../models/Task";
import { httpError } from "../middleware/errorMiddleware";
import { validateTaskBody } from "../utils/validation";

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

/** Builds the Mongo filter from query params, always scoped to the user. */
function buildFilter(userId: string, q: Record<string, unknown>) {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

  const status = q.status;
  if (typeof status === "string" && ["pending", "completed"].includes(status)) {
    filter.status = status;
  }
  const priority = q.priority;
  if (typeof priority === "string" && ["low", "medium", "high"].includes(priority)) {
    filter.priority = priority;
  }
  if (typeof q.category === "string" && q.category.trim()) {
    filter.category = q.category.trim().toLowerCase();
  }
  if (typeof q.search === "string" && q.search.trim()) {
    const rx = new RegExp(q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
  }
  return filter;
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
        return diff !== 0 ? diff : dl(a) - dl(b) || dl(b) - dl(a) * 0 || a.createdAt.getTime() - b.createdAt.getTime();
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
  const filter = buildFilter(userId, q);
  const sortBy: TaskSortBy = (
    typeof q.sortBy === "string" &&
      ["smart", "deadline", "priority", "createdAt", "updatedAt"].includes(q.sortBy)
      ? q.sortBy
      : "smart"
  ) as TaskSortBy;

  const docs = await Task.find(filter).lean();
  const dtos: TaskDTO[] = docs.map((d) => ({
    _id: (d._id as Types.ObjectId).toString(),
    userId: (d.userId as Types.ObjectId).toString(),
    title: d.title,
    description: d.description ?? "",
    scheduledAt: (d.scheduledAt as Date) ?? null,
    deadline: (d.deadline as Date) ?? null,
    priority: d.priority as Priority,
    status: d.status as TaskStatus,
    category: d.category ?? "general",
    tags: (d.tags as string[]) ?? [],
    createdAt: d.createdAt as Date,
    updatedAt: d.updatedAt as Date,
    completedAt: (d.completedAt as Date) ?? null,
  }));
  return sortTasks(dtos, sortBy);
}

export async function getTaskById(userId: string, id: string): Promise<TaskDTO> {
  if (!Types.ObjectId.isValid(id)) throw httpError(400, "Invalid task id");
  const doc = await Task.findOne({ _id: id, userId: new Types.ObjectId(userId) });
  if (!doc) throw httpError(404, "Task not found");
  return doc.toDTO();
}

export async function createTask(
  userId: string,
  body: Record<string, unknown>
): Promise<TaskDTO> {
  const fields = validateTaskBody(body, "create");
  const doc = await Task.create({ ...fields, userId: new Types.ObjectId(userId) });
  return doc.toDTO();
}

export async function updateTask(
  userId: string,
  id: string,
  body: Record<string, unknown>
): Promise<TaskDTO> {
  if (!Types.ObjectId.isValid(id)) throw httpError(400, "Invalid task id");
  // Only editable fields are taken from the body; userId/protected fields ignored.
  const fields = validateTaskBody(body, "update");
  if (Object.keys(fields).length === 0) throw httpError(400, "No editable fields provided");

  const doc = await Task.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId) },
    { $set: fields },
    { new: true, runValidators: true }
  );
  if (!doc) throw httpError(404, "Task not found");
  return doc.toDTO();
}

/** Toggles completion, or forces a target status when body.status given. */
export async function toggleComplete(
  userId: string,
  id: string,
  targetStatus?: TaskStatus
): Promise<TaskDTO> {
  if (!Types.ObjectId.isValid(id)) throw httpError(400, "Invalid task id");

  const existing = await Task.findOne({ _id: id, userId: new Types.ObjectId(userId) });
  if (!existing) throw httpError(404, "Task not found");

  const next: TaskStatus =
    targetStatus ??
    (existing.status === "completed" ? "pending" : "completed");

  existing.status = next;
  existing.completedAt = next === "completed" ? new Date() : null;
  await existing.save();
  return existing.toDTO();
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw httpError(400, "Invalid task id");
  const doc = await Task.findOneAndDelete({
    _id: id,
    userId: new Types.ObjectId(userId),
  });
  if (!doc) throw httpError(404, "Task not found");
}
