import { Schema, model, type Document, type Types } from "mongoose";

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

export interface TaskDocument extends Document {
  userId: Types.ObjectId;
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
  toDTO(): TaskDTO;
}

const taskSchema = new Schema<TaskDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    scheduledAt: { type: Date, default: null },
    deadline: { type: Date, default: null },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: "medium",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
    },
    category: { type: String, default: "general", trim: true, maxlength: 60 },
    tags: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Compound indexes supporting the common list queries (user scope + filters). */
taskSchema.index({ userId: 1, status: 1, deadline: 1 });
taskSchema.index({ userId: 1, category: 1 });

/** Serializes to a client-safe DTO (userId as string). */
taskSchema.methods.toDTO = function (this: TaskDocument): TaskDTO {
  return {
    _id: (this._id as Types.ObjectId).toString(),
    userId: this.userId.toString(),
    title: this.title,
    description: this.description,
    scheduledAt: this.scheduledAt,
    deadline: this.deadline,
    priority: this.priority,
    status: this.status,
    category: this.category,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    completedAt: this.completedAt,
  };
};

export const Task = model<TaskDocument>("Task", taskSchema);
