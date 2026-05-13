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
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

function removeToken() {
  localStorage.removeItem("auth_token");
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    getUser(token)
      .then(setUser)
      .catch(() => {
        removeToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

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
