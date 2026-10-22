import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onUnauthorized } from "../services/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    onUnauthorized.handler = () => setUser(null);
    api("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (login, password) => setUser(await api("/auth/login", { method: "POST", body: { login, password } })), []);
  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);
  const can = useCallback((perm) => Boolean(user?.permissions.includes(perm)), [user]);

  const value = useMemo(() => ({ user, checking, login, logout, can }), [user, checking, login, logout, can]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
