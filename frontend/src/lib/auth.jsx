import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "auth_token";

export function AuthProvider({ children }) {
  // null = checking; false = unauthenticated; object = authenticated user
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  // Wire axios with the current token + 401 interceptor
  useEffect(() => {
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete api.defaults.headers.common["Authorization"];

    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          const wasLoggedIn = !!localStorage.getItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(false);
          if (wasLoggedIn) {
            // Avisa o usuário que a sessão expirou
            import("sonner").then(({ toast }) => {
              toast.error("Sessão expirada. Faça login novamente.", { duration: 6000 });
            }).catch(() => {});
          }
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [token]);

  // On mount / token change, fetch /me
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!token) {
        setUser(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(false);
        }
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser({ email: data.email });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(false);
  }, []);

  const refreshMe = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
