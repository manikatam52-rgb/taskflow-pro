export type Priority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "completed";

export const PRIORITIES: Priority[] = ["low", "medium", "high"];
export const STATUSES: TaskStatus[] = ["pending", "completed"];

/** Shape returned by the API and consumed by the mobile app. */
export interface TaskDTO {
  _id: string;
  userId: string;
  title: string;
  description: string;
  scheduledAt: Date | null;
  deadline: Date | null;
  priority: Priority;
  status: TaskStatus;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/** Row shape as stored in PostgreSQL. */
export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_at: Date | null;
  deadline: Date | null;
  priority: Priority;
  status: TaskStatus;
  category: string;
  tags: string[] | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

/** Serializes a DB row to a client-safe DTO. */
export function taskRowToDTO(row: TaskRow): TaskDTO {
  return {
    _id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? "",
    scheduledAt: row.scheduled_at ?? null,
    deadline: row.deadline ?? null,
    priority: row.priority,
    status: row.status,
    category: row.category ?? "general",
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
  };
}
