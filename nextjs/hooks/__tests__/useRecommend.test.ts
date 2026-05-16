import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecommend } from "@/hooks/useRecommend";

// api 모듈 모킹
vi.mock("@/lib/api", () => ({
  recommend: vi.fn(),
}));

const { recommend: mockRecommend } = await import("@/lib/api");
const mockRecommendFn = mockRecommend as ReturnType<typeof vi.fn>;

describe("useRecommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("초기 상태는 빈 결과, 로딩 false, 에러 null", () => {
    const { result } = renderHook(() => useRecommend());

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("추천 요청 중에는 isLoading이 true가 된다", async () => {
    // 영원히 resolve하지 않는 promise
    mockRecommendFn.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRecommend());

    act(() => {
      result.current.recommend("테스트", "ko");
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("추천 성공 시 results가 채워진다", async () => {
    const mockResults = {
      data: [
        {
          category_code: "50000001",
          category_name: "패션의류",
          similarity_score: 0.95,
        },
      ],
    };
    mockRecommendFn.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useRecommend());

    await act(async () => {
      await result.current.recommend("원피스", "ko");
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.results).toEqual(mockResults.data);
  });

  it("추천 실패 시 error 메시지가 설정된다", async () => {
    mockRecommendFn.mockRejectedValue(new Error("네트워크 오류"));

    const { result } = renderHook(() => useRecommend());

    await act(async () => {
      await result.current.recommend("테스트", "ko");
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("네트워크 오류");
    expect(result.current.results).toEqual([]);
  });

  it("Error가 아닌 예외도 문자열로 처리한다", async () => {
    mockRecommendFn.mockRejectedValue("알 수 없는 오류");

    const { result } = renderHook(() => useRecommend());

    await act(async () => {
      await result.current.recommend("테스트", "ko");
    });

    expect(result.current.error).toBe("추천 요청에 실패했습니다");
  });
});
