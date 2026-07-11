import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

// api 모듈 모킹
vi.mock("@/lib/api", () => ({
  logout: vi.fn(),
  getUser: vi.fn(),
}));

const api = await import("@/lib/api");
const mockLogout = api.logout as ReturnType<typeof vi.fn>;
const mockGetUser = api.getUser as ReturnType<typeof vi.fn>;

const mockToken = "auth-token-123";
const mockUser = { id: 1, name: "관리자", email: "admin@example.com" };

function setAuthCookie(token: string) {
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/`;
}

function clearAuthCookie() {
  document.cookie = "auth_token=; path=/; max-age=0";
}

function getAuthCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthCookie();
    document.cookie = "oauth_redirect=; path=/; max-age=0";
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  describe("사용자 로드", () => {
    it("토큰이 있으면 getUser를 호출하여 사용자 정보를 가져온다", async () => {
      mockGetUser.mockResolvedValue(mockUser);
      setAuthCookie(mockToken);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockGetUser).toHaveBeenCalledWith(mockToken);
    });

    it("토큰이 없으면 user는 null로 유지된다", async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("getUser 실패 시 토큰을 제거하고 user는 null로 유지된다", async () => {
      mockGetUser.mockRejectedValue(new Error("인증 실패"));
      setAuthCookie(mockToken);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(getAuthCookie()).toBeNull();
    });
  });

  describe("logout", () => {
    it("API 호출 후 user를 null로, token을 제거한다", async () => {
      mockGetUser.mockResolvedValue(mockUser);
      mockLogout.mockResolvedValue(undefined);
      setAuthCookie(mockToken);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(getAuthCookie()).toBeNull();
      expect(mockLogout).toHaveBeenCalledWith(mockToken);
    });

    it("API 실패 시에도 클라이언트 토큰을 제거한다", async () => {
      mockGetUser.mockResolvedValue(mockUser);
      mockLogout.mockRejectedValue(new Error("서버 오류"));
      setAuthCookie(mockToken);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(getAuthCookie()).toBeNull();
    });
  });

  describe("loginWithOAuth", () => {
    it("OAuth 제공자 URL로 리다이렉트한다", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.loginWithOAuth("google");
      });

      expect(window.location.href).toBe("/api/auth/google/redirect");
    });

    it("redirect 파라미터를 포함하여 리다이렉트한다", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.loginWithOAuth("google", "/admin/member?mode=hierarchy");
      });

      expect(globalThis.location.href).toBe("/api/auth/google/redirect");

      const match = /(?:^|;\s*)oauth_redirect=([^;]*)/.exec(document.cookie);
      const oauthRedirect = match ? decodeURIComponent(match[1]) : null;
      expect(oauthRedirect).toBe("/admin/member?mode=hierarchy");
    });

    it("redirect 파라미터와 window.location.hash를 결합하여 리다이렉트한다", async () => {
      mockGetUser.mockResolvedValue(null);
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      Object.defineProperty(globalThis, "location", {
        value: { href: "", hash: "#abc" },
        writable: true,
      });

      act(() => {
        result.current.loginWithOAuth("google", "/admin/member?mode=hierarchy");
      });

      const match = /(?:^|;\s*)oauth_redirect=([^;]*)/.exec(document.cookie);
      const oauthRedirect = match ? decodeURIComponent(match[1]) : null;
      expect(oauthRedirect).toBe("/admin/member?mode=hierarchy#abc");
    });
  });
});
