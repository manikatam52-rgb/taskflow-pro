/** Types matching the backend API contracts (see docs/API.md). */

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed';

export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  userId: string;
  title: string;
  description: string;
  scheduledAt: string | null;
  deadline: string | null;
  priority: Priority;
  status: TaskStatus;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Fields the client may send when creating/updating a task. */
export interface TaskInput {
  title: string;
  description?: string;
  scheduledAt?: string | null;
  deadline?: string | null;
  priority?: Priority;
  category?: string;
  tags?: string[];
}

export interface AuthResult {
  token: string;
  user: User;
}
