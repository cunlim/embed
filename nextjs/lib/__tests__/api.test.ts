import { describe, it, expect, vi, beforeEach } from "vitest";

// fetch 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 환경 변수 설정
process.env.NEXT_PUBLIC_API_URL = "https://embed.cunlim.dev/api";

// 동적 import로 모킹된 fetch 사용
const api = await import("@/lib/api");

function mockResponse(body: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

describe("API 클라이언트", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("recommend", () => {
    it("추천 API를 POST로 호출한다", async () => {
      mockResponse({ data: [] });

      await api.recommend("테스트", "ko");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/recommend",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ text: "테스트", target_language: "ko" }),
        })
      );
    });

    it("추천 결과를 반환한다", async () => {
      const expected = {
        data: [
          {
            category_code: "50000001",
            category_name: "패션의류 > 여성의류 > 원피스",
            similarity_score: 0.95,
          },
        ],
      };
      mockResponse(expected);

      const result = await api.recommend("원피스", "ko");

      expect(result).toEqual(expected);
    });

    it("인증 토큰을 전달한다", async () => {
      mockResponse({ data: [] });

      await api.recommend("테스트", "ko", "test-token");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("API 오류 시 예외를 throw한다", async () => {
      mockResponse({ message: "서버 오류" }, false, 500);

      await expect(api.recommend("테스트", "ko")).rejects.toThrow(
        "서버 오류"
      );
    });
  });

  describe("getCategories", () => {
    it("카테고리 목록을 GET으로 조회한다", async () => {
      mockResponse({ data: [] });

      await api.getCategories();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/categories?per_page=20",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("runStep", () => {
    it("개별 단계 실행을 POST로 요청한다", async () => {
      mockResponse({ step: "translation.zh", status: "completed" });

      const result = await api.runStep(1, "translation.zh");

      expect(result).toEqual({ step: "translation.zh", status: "completed" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/categories/1/run-step",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ step: "translation.zh" }),
        })
      );
    });
  });

  describe("login", () => {
    it("로그인 성공 시 user와 token을 반환한다", async () => {
      mockResponse({
        data: {
          user: { id: 1, name: "Test", email: "test@example.com", created_at: "2025-01-01T00:00:00Z" },
          token: "auth-token",
          token_type: "Bearer",
        },
      });

      const result = await api.login("test@example.com", "password");

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toBe("auth-token");
    });

    it("로그인 실패 시 예외를 throw한다", async () => {
      mockResponse({ message: "인증 실패" }, false, 401);

      await expect(api.login("wrong@example.com", "wrong")).rejects.toThrow(
        "인증 실패"
      );
    });
  });

  describe("register", () => {
    it("회원가입 성공 시 user와 token을 반환한다", async () => {
      mockResponse({
        data: {
          user: { id: 2, name: "New", email: "new@example.com", created_at: "2025-01-01T00:00:00Z" },
          token: "new-token",
          token_type: "Bearer",
        },
      });

      const result = await api.register(
        "New",
        "new@example.com",
        "password",
        "password"
      );

      expect(result.user.name).toBe("New");
      expect(result.token).toBe("new-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "New",
            email: "new@example.com",
            password: "password",
            password_confirmation: "password",
          }),
        })
      );
    });

    it("회원가입 실패 시 예외를 throw한다", async () => {
      mockResponse(
        { message: "이미 사용 중인 이메일입니다" },
        false,
        422
      );

      await expect(
        api.register("Test", "dup@example.com", "password", "password")
      ).rejects.toThrow("이미 사용 중인 이메일입니다");
    });
  });

  describe("logout", () => {
    it("로그아웃 요청을 POST로 보낸다", async () => {
      mockResponse(null);

      await api.logout("test-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });
  });

  describe("getUser", () => {
    it("사용자 정보를 반환한다", async () => {
      const user = { id: 1, name: "Test", email: "test@example.com" };
      mockResponse({ data: user });

      const result = await api.getUser("test-token");

      expect(result).toEqual(user);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/auth/user",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });
  });

  describe("deleteCategory", () => {
    it("카테고리 삭제를 DELETE로 요청한다", async () => {
      mockResponse(null);

      await api.deleteCategory(1, "test-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/categories/1",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("API 오류 시 예외를 throw한다", async () => {
      mockResponse({ message: "권한 없음" }, false, 403);

      await expect(api.deleteCategory(1, "test-token")).rejects.toThrow(
        "권한 없음"
      );
    });
  });

  describe("fetchCategoryLevels", () => {
    it("파라미터 없이 호출하면 최상위 목록 GET 요청을 보낸다", async () => {
      const mockData = { data: { options: ["패션의류", "식품"], maxDepth: 1, isLeaf: false, leafCategoryId: null } };
      mockResponse(mockData);

      const result = await api.fetchCategoryLevels();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/categories/levels"),
        expect.any(Object)
      );
      expect(result.data.options).toEqual(["패션의류", "식품"]);
    });

    it("cat1 파라미터를 전달하면 쿼리스트링에 포함된다", async () => {
      const mockData = { data: { options: ["여성의류", "남성의류"], maxDepth: 2, isLeaf: false, leafCategoryId: null } };
      mockResponse(mockData);

      const result = await api.fetchCategoryLevels({ cat1: "패션의류" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("cat1=" + encodeURIComponent("패션의류")),
        expect.any(Object)
      );
      expect(result.data.options).toEqual(["여성의류", "남성의류"]);
    });
  });

  describe("updateCategoryText", () => {
    it("올바른 URL과 body로 PUT 요청을 보낸다", async () => {
      const testResp = {
        data: {
          updated: true,
          id: 1,
          translations: {
            id: 1,
            category_code: "TEST001",
            category_name_ko: "New Name",
            embedding_dimensions: null,
            languages: {
              ko: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
              en: { translation_text: "New Name", embedding: { status: "pending" as const, preview: null } },
              zh: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
            },
          },
          listRow: {
            id: 1,
            category_code: "TEST001",
            category_name_ko: "New Name",
            category_name_zh: null,
            category_name_en: "New Name",
            translation_status: "partial",
          },
        },
      };
      mockResponse(testResp);

      const result = await api.updateCategoryText(1, "category_name_en", "New Name", "token");

      expect(result).toEqual(testResp);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/categories/1/update-text",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ field: "category_name_en", value: "New Name" }),
          headers: expect.objectContaining({ Authorization: "Bearer token" }),
        })
      );
    });

    it("null value를 전달할 수 있다", async () => {
      mockResponse({ data: { updated: true, id: 1 } });

      await api.updateCategoryText(1, "category_name_ko", null, "token");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ field: "category_name_ko", value: null }),
        })
      );
    });
  });
});
