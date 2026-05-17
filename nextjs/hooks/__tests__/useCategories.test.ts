import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategories } from "@/hooks/useCategories";

vi.mock("@/lib/api", () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
}));

const api = await import("@/lib/api");
const mockGetCategories = api.getCategories as ReturnType<typeof vi.fn>;
const mockCreateCategory = api.createCategory as ReturnType<typeof vi.fn>;

const mockCategory = {
  id: 1,
  category_code: "50000001",
  category_name_ko: "의류>여성의류>원피스",
  category_name_zh: "服装>女装>连衣裙",
  category_name_en: "Clothing>Women>Dress",
  embedding_ko: null,
  embedding_zh: null,
  embedding_en: null,
};

const mockCategoryList = {
  data: [mockCategory],
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 1,
    from: 1,
    to: 1,
  },
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
};

describe("useCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("초기 상태", () => {
    it("token이 있으면 mount 시 isLoading이 true다 (자동 로드 준비 상태)", () => {
      const { result } = renderHook(() => useCategories("token"));

      expect(result.current.categories).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockGetCategories).not.toHaveBeenCalled();
    });

    it("token이 null이면 isLoading은 false다", () => {
      const { result } = renderHook(() => useCategories(null));

      expect(result.current.categories).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("loadCategories", () => {
    it("성공 시 categories를 갱신하고 isLoading이 false로 돌아온다", async () => {
      mockGetCategories.mockResolvedValue(mockCategoryList);

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.loadCategories();
      });

      expect(result.current.categories).toEqual([mockCategory]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetCategories).toHaveBeenCalledWith("token", 1);
    });

    it("성공 시 meta와 categories를 반환한다", async () => {
      mockGetCategories.mockResolvedValue(mockCategoryList);

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.loadCategories();
      });

      expect(result.current.categories).toEqual([mockCategory]);
      expect(result.current.meta).toEqual(mockCategoryList.meta);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockGetCategories).toHaveBeenCalledWith("token", 1);
    });

    it("실패 시 error 메시지가 설정되고 isLoading은 false다", async () => {
      mockGetCategories.mockRejectedValue(new Error("네트워크 오류"));

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.loadCategories();
      });

      expect(result.current.error).toBe("네트워크 오류");
      expect(result.current.isLoading).toBe(false);
    });

    it("Error 인스턴스가 아닌 예외는 기본 메시지를 사용한다", async () => {
      mockGetCategories.mockRejectedValue("raw error");

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.loadCategories();
      });

      expect(result.current.error).toBe("카테고리 목록을 불러오지 못했습니다");
    });
  });

  describe("addCategory", () => {
    it("성공 시 createCategory API를 호출하고 목록을 갱신한다", async () => {
      mockCreateCategory.mockResolvedValue({ data: mockCategory });
      mockGetCategories.mockResolvedValue(mockCategoryList);

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.addCategory("의류>여성의류>원피스");
      });

      expect(mockCreateCategory).toHaveBeenCalledWith("의류>여성의류>원피스", "token");
      expect(result.current.categories).toEqual([mockCategory]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("createCategory 실패 시 error가 설정되고 getCategories는 추가 호출되지 않는다", async () => {
      mockCreateCategory.mockRejectedValue(new Error("중복된 카테고리"));

      const { result } = renderHook(() => useCategories("token"));
      // auto-load 없음 — mount 시 getCategories 호출 안 함
      expect(mockGetCategories).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.addCategory("중복");
      });

      expect(result.current.error).toBe("중복된 카테고리");
      expect(result.current.isLoading).toBe(false);
      // addCategory 실패 시 getCategories 추가 호출 없음
      expect(mockGetCategories).not.toHaveBeenCalled();
    });

    it("createCategory 성공 후 getCategories 실패 시 error가 설정된다", async () => {
      mockCreateCategory.mockResolvedValue({ data: mockCategory });
      mockGetCategories.mockRejectedValue(new Error("목록 로드 실패"));

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.addCategory("의류>여성의류>원피스");
      });

      expect(result.current.error).toBe("목록 로드 실패");
      expect(result.current.isLoading).toBe(false);
    });

    it("완료 후 isLoading이 false다", async () => {
      mockCreateCategory.mockResolvedValue({ data: mockCategory });
      mockGetCategories.mockResolvedValue(mockCategoryList);

      const { result } = renderHook(() => useCategories("token"));

      await act(async () => {
        await result.current.addCategory("test");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
