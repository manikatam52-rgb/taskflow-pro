import api from './api';
import type {Task, TaskInput} from '../types';

export interface TaskQueryParams {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  sortBy?: string;
}

export async function fetchTasks(params?: TaskQueryParams): Promise<Task[]> {
  const res = await api.get<{success: boolean; data: {tasks: Task[]}}>('/tasks', {
    params,
  });
  return res.data.data.tasks;
}

export async function getTask(id: string): Promise<Task> {
  const res = await api.get<{ success: boolean; data: { task: Task } }>(`/tasks/${id}`);
  return res.data.data.task;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await api.post<{success: boolean; data: {task: Task}}>('/tasks', input);
  return res.data.data.task;
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const res = await api.patch<{success: boolean; data: {task: Task}}>(`/tasks/${id}`, input);
  return res.data.data.task;
}

/** Backend toggles completion; body.status forces a specific target status. */
export async function setTaskStatus(id: string, status: 'pending' | 'completed'): Promise<Task> {
  const res = await api.patch<{success: boolean; data: {task: Task}}>(
    `/tasks/${id}/complete`,
    {status},
  );
  return res.data.data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
