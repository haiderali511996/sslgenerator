"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, User } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string, wallet?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login({ email, password });
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  }

  async function signup(email: string, password: string, fullName?: string, wallet?: string) {
    const res = await api.signup({ email, password, full_name: fullName, unc_wallet_address: wallet });
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  }

  function logout() {
    setToken(null);
    setUser(null);
    router.push("/login");
  }

  async function refreshUser() {
    const fresh = await api.me();
    setUser(fresh);
  }

  return <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
