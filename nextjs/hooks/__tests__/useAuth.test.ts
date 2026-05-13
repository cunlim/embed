import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

// api 모듈 모킹
vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

const api = await import("@/lib/api");
const mockLogin = api.login as ReturnType<typeof vi.fn>;
const mockRegister = api.register as ReturnType<typeof vi.fn>;
const mockLogout = api.logout as ReturnType<typeof vi.fn>;

const mockUser = { id: 1, name: "Test", email: "test@example.com" };
const mockToken = "auth-token-123";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom 환경에서 window.location.href 모킹
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  describe("login", () => {
    it("성공 시 user와 token을 저장한다", async () => {
      mockLogin.mockResolvedValue({ user: mockUser, token: mockToken });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login("test@example.com", "password");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
      expect(localStorage.getItem("auth_token")).toBe(mockToken);
    });

    it("실패 시 예외를 throw하고 isLoading이 false가 된다", async () => {
      mockLogin.mockRejectedValue(new Error("인증 실패"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.login("test@example.com", "wrong");
        })
      ).rejects.toThrow("인증 실패");

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe("register", () => {
    it("성공 시 user와 token을 저장한다", async () => {
      mockRegister.mockResolvedValue({ user: mockUser, token: mockToken });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register("Test", "test@example.com", "password", "password");
      });

      expect(result.current.user).toEqual(mockUser);
      expect(localStorage.getItem("auth_token")).toBe(mockToken);
    });

    it("실패 시 예외를 throw한다", async () => {
      mockRegister.mockRejectedValue(new Error("이미 사용 중인 이메일"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.register("Test", "dup@example.com", "password", "password");
        })
      ).rejects.toThrow("이미 사용 중인 이메일");

      expect(result.current.user).toBeNull();
    });
  });

  describe("logout", () => {
    it("API 호출 후 user를 null로, token을 제거한다", async () => {
      mockLogin.mockResolvedValue({ user: mockUser, token: mockToken });
      mockLogout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      // 먼저 로그인
      await act(async () => {
        await result.current.login("test@example.com", "password");
      });
      expect(result.current.user).not.toBeNull();

      // 로그아웃
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(mockLogout).toHaveBeenCalledWith(mockToken);
    });

    it("API 실패 시에도 클라이언트 토큰을 제거한다", async () => {
      mockLogout.mockRejectedValue(new Error("서버 오류"));
      localStorage.setItem("auth_token", mockToken);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });
  });

  describe("loginWithOAuth", () => {
    it("OAuth 제공자 URL로 리다이렉트한다", () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.loginWithOAuth("google");
      });

      expect(window.location.href).toBe("/api/auth/google/redirect");
    });
  });
});
