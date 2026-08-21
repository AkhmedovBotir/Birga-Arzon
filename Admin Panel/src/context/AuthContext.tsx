import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { tStatic } from '@/src/i18n';
import type { AuthUser } from '@/src/lib/authApi';
import { ApiError, apiRequest, getStoredToken, setStoredToken } from '@/src/lib/api';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  signInWithSMS: (phone: string, code: string, firstName?: string, lastName?: string) => Promise<void>;
  signInTelegram: (payload: { phone: string; telegramId?: number; firstName?: string; lastName?: string }) => Promise<void>;
  signInWithPassword: (opts: { phone?: string; username?: string; password: string; role?: string }) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Record<string, unknown>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setReady(true);
      return;
    }
    setToken(stored);
    apiRequest<AuthUser>('/api/auth/me', { token: stored })
      .then(setUser)
      .catch(() => {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const signInWithSMS = useCallback(async (phone: string, code: string, firstName?: string, lastName?: string) => {
    const { token: t, user: u } = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/sms/verify', {
      method: 'POST',
      body: { phone, code, firstName, lastName },
    });
    setStoredToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signInTelegram = useCallback(async (payload: { phone: string; telegramId?: number; firstName?: string; lastName?: string }) => {
    const { token: t, user: u } = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/telegram', {
      method: 'POST',
      body: payload,
    });
    setStoredToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signInWithPassword = useCallback(async (opts: { phone?: string; username?: string; password: string; role?: string }) => {
    const { token: t, user: u } = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { phone: opts.phone, username: opts.username, password: opts.password, role: opts.role },
      success: tStatic('common_welcome'),
    });
    setStoredToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    setUser(await apiRequest<AuthUser>('/api/auth/me', { token }));
  }, [token]);

  const updateProfile = useCallback(async (patch: Record<string, unknown>) => {
    if (!token) throw new Error(tStatic('common_noToken'));
    const u = await apiRequest<AuthUser>('/api/auth/me', { method: 'PATCH', token, body: patch, success: tStatic('onb_saved') });
    setUser(u);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, ready, signInWithSMS, signInTelegram, signInWithPassword, signOut, refreshUser, updateProfile }),
    [user, token, ready, signInWithSMS, signInTelegram, signInWithPassword, signOut, refreshUser, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida bo‘lishi kerak');
  return ctx;
}

export function formatAuthError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return tStatic('common_unknownError');
}
