import api, { saveToken, clearToken, loadToken, extractErrorMessage } from './api';
import type { AuthResult, User } from '../types';

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string;
}

export async function register(data: RegisterData): Promise<AuthResult> {
  const res = await api.post<{ success: boolean; data: AuthResult }>(
    '/auth/register',
    data,
  );
  return res.data.data;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await api.post<{ success: boolean; data: AuthResult }>('/auth/login', {
    email,
    password,
  });
  return res.data.data;
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const res = await api.get<{ success: boolean; data: { user: User } }>(
    '/auth/me',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.data.user;
}

export { saveToken, clearToken, loadToken, extractErrorMessage };
