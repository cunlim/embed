"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { logout as apiLogout, getUser, type User } from "@/lib/api";

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  loginWithOAuth: (provider: "google" | "github" | "naver", redirect?: string) => void;
}

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

function setToken(token: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 30 * 864e5).toUTCString();
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

function removeToken() {
  if (typeof document === "undefined") return;
  document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
}

export function useAuth(initialUser?: User | null): UseAuthReturn {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const token = getToken();
  // 초기값을 false로 고정 — 서버/클라이언트 불일치로 hydration mismatch 방지
  // (서버에서는 getToken()이 null, 클라이언트에서는 쿠키 존재 → isLoading 차이)
  const [isLoading, setIsLoading] = useState(false);
  // SSR에서 이미 사용자 정보를 가져온 경우 최초 getUser 호출 건너뜀
  const skipInitialFetch = useRef(!!initialUser);

  useEffect(() => {
    if (!token) return;
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    setIsLoading(true);
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
    (provider: "google" | "github" | "naver", redirect?: string) => {
      if (redirect) {
        let finalRedirect = redirect;
        if (globalThis.window !== undefined && globalThis.location.hash && !finalRedirect.includes("#")) {
          finalRedirect += globalThis.location.hash;
        }
        document.cookie = `oauth_redirect=${encodeURIComponent(finalRedirect)}; path=/; max-age=600; SameSite=Lax`;
      }
      globalThis.location.href = `/api/auth/${provider}/redirect`;
    },
    []
  );

  return { user, isLoading, logout, loginWithOAuth };
}

export { getToken, setToken, removeToken };
