import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AuthService, type LoginInput } from '@/service/auth';
import { setUnauthorizedHandler } from '@/service/http';
import type { CurrentUser } from '@/service/user';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  syncUser: (user: CurrentUser) => void;
  invalidate: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);

  const becomeAnonymous = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  const applyUser = useCallback((currentUser: CurrentUser) => {
    setUser(currentUser);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(becomeAnonymous);
    return () => setUnauthorizedHandler(null);
  }, [becomeAnonymous]);

  useEffect(() => {
    const controller = new AbortController();

    void AuthService.queryCurrentUser(controller.signal)
      .then(applyUser)
      .catch(() => {
        if (!controller.signal.aborted) {
          becomeAnonymous();
        }
      });

    return () => controller.abort();
  }, [applyUser, becomeAnonymous]);

  const login = useCallback(
    async (input: LoginInput) => {
      applyUser(await AuthService.login(input));
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    await AuthService.logout();
    becomeAnonymous();
  }, [becomeAnonymous]);

  const refresh = useCallback(async () => {
    applyUser(await AuthService.queryCurrentUser());
  }, [applyUser]);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      logout,
      refresh,
      syncUser: applyUser,
      invalidate: becomeAnonymous,
    }),
    [status, user, login, logout, refresh, applyUser, becomeAnonymous],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return value;
}
