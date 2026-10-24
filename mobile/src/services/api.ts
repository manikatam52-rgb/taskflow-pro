import axios from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';
import { API_BASE_URL } from '../config';

/**
 * Shared Axios instance.
 * - Attaches the stored JWT to every request.
 * - Token stored in EncryptedStorage (Android Keystore-backed), never AsyncStorage.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const TOKEN_KEY = 'taskflow_token';

export async function saveToken(token: string): Promise<void> {
  try {
    await EncryptedStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to save token:', e);
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export async function loadToken(): Promise<string | null> {
  try {
    const token = await EncryptedStorage.getItem(TOKEN_KEY);
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    return token;
  } catch (e) {
    console.warn('Failed to load token:', e);
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear token:', e);
  }
  delete api.defaults.headers.common.Authorization;
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (error.code === 'ECONNABORTED') return 'Request timed out. Is the backend running?';
    return 'Network error. Check your connection and that the backend is running.';
  }
  return 'Something went wrong. Please try again.';
}

/** Called by the AuthContext when the server responds 401 (expired/invalid token). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  response => response,
  async error => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      // Don't log the user out for failed login attempts (wrong credentials).
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        await clearToken();
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
