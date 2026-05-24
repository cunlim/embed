"use client";

import { useState, useCallback, useEffect } from "react";
import { logout as apiLogout, getUser, type User } from "@/lib/api";

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  loginWithOAuth: (provider: "google" | "github" | "naver") => void;
}

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  const legacyToken = localStorage.getItem("auth_token");
  if (legacyToken) {
    // localStorage → cookie 자동 마이그레이션
    setToken(legacyToken);
    return legacyToken;
  }
  return null;
}

function setToken(token: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 30 * 864e5).toUTCString();
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
  try { localStorage.removeItem("auth_token"); } catch {}
}

function removeToken() {
  if (typeof document === "undefined") return;
  document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
  try { localStorage.removeItem("auth_token"); } catch {}
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const token = getToken();
  const [isLoading, setIsLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    getUser(token)
      .then(setUser)
      .catch(() => {
        removeToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const logout = useCallback(async () => {
    const token = getToken();
    try {
      await apiLogout(token);
    } catch {
      // 로그아웃 API 실패 시에도 클라이언트 측 토큰은 제거
    }
    removeToken();
    setUser(null);
  }, []);

  const loginWithOAuth = useCallback(
    (provider: "google" | "github" | "naver") => {
      window.location.href = `/api/auth/${provider}/redirect`;
    },
    []
  );

  return { user, isLoading, logout, loginWithOAuth };
}

export { getToken, setToken, removeToken };
