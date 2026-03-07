import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

function getUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    return { id: Number(payload.sub), username: payload.username };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const user = useMemo(() => getUserFromToken(token), [token]);

  const login = useCallback((newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  const value = useMemo(() => ({ user, token, login, logout }), [user, token, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
