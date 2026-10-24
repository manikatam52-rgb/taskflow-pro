import type { Task } from '../types';

/** Auth stack (shown when signed out). */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

/** App stack (shown when signed in). */
export type AppStackParamList = {
  Dashboard: undefined;
  /** taskId empty object means "create" mode. */
  TaskForm: { taskId?: string } | undefined;
  TaskDetails: { taskId: string };
};
