import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import type {User} from '../types';
import {
  clearToken,
  extractErrorMessage,
  fetchCurrentUser,
  loadToken,
  login as apiLogin,
  register as apiRegister,
  saveToken,
} from '../services/authService';
import {setUnauthorizedHandler} from '../services/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** True while the stored session is being restored on app launch. */
  restoring: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the stored session on app launch and validate it against /auth/me.
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadToken();
        if (stored) {
          const me = await fetchCurrentUser(stored);
          setUser(me);
          setToken(stored);
        }
      } catch {
        // Invalid/expired stored token — start signed out.
        await clearToken();
      } finally {
        setRestoring(false);
      }
    })();

    // Expired session mid-use: clear state so the app returns to the login screen.
    setUnauthorizedHandler(() => {
      setUser(null);
      setToken(null);
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiLogin(email, password);
      await saveToken(result.token);
      setToken(result.token);
      setUser(result.user);
      return true;
    } catch (e) {
      setError(extractErrorMessage(e));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRegister({email, password, confirmPassword: password, name});
      await saveToken(result.token);
      setToken(result.token);
      setUser(result.user);
      return true;
    } catch (e) {
      setError(extractErrorMessage(e));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({user, token, restoring, loading, error, login, register, logout}),
    [user, token, restoring, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
