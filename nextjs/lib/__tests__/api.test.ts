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
      mockResponse({ recommendations: [] });

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
        recommendations: [
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
      mockResponse({ recommendations: [] });

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
        "https://embed.cunlim.dev/api/categories",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("batchTranslate", () => {
    it("일괄 번역을 POST로 요청한다", async () => {
      mockResponse({ batch_id: "batch-123" });

      const result = await api.batchTranslate("zh");

      expect(result).toEqual({ batch_id: "batch-123" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://embed.cunlim.dev/api/categories/batch-translate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ target_language: "zh" }),
        })
      );
    });
  });

  describe("login", () => {
    it("로그인 성공 시 user와 token을 반환한다", async () => {
      mockResponse({
        user: { id: 1, name: "Test", email: "test@example.com" },
        token: "auth-token",
      });

      const result = await api.login("test@example.com", "password");

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toBe("auth-token");
    });
  });
});
