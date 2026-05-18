import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryExecution } from "@/hooks/useCategoryExecution";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCategoryExecution", () => {
  it("getState는 신규 카테고리에 초기 상태를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.pendingSteps).toEqual([]);
    expect(state.completedSteps.size).toBe(0);
    expect(state.failedSteps.size).toBe(0);
    expect(state.stepResults.size).toBe(0);
    expect(state.copyableSteps.size).toBe(0);
    expect(state.embeddingFullData.size).toBe(0);
    expect(state.abortRef.current).toBe(false);
    expect(state.actionError).toBeNull();
  });

  it("getState는 같은 카테고리에 동일한 상태 참조를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state1 = result.current.getState(1);
    const state2 = result.current.getState(1);
    expect(state1).toBe(state2);
  });

  it("getState는 다른 카테고리에 다른 상태를 반환한다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));
    const state1 = result.current.getState(1);
    const state2 = result.current.getState(2);
    expect(state1).not.toBe(state2);
  });

  it("handleSingleAction으로 step 완료 시 completedSteps에 추가된다", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: "completed", result: "번역 결과" }),
    });

    const { result } = renderHook(() => useCategoryExecution("token"));

    await act(async () => {
      await result.current.handleSingleAction(1, "translation.en");
    });

    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.completedSteps.has("translation.en")).toBe(true);
    expect(state.stepResults.get("translation.en")).toBe("번역 결과");
  });

  it("handleSingleAction 실패 시 failedSteps에 추가된다", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCategoryExecution("token"));

    await act(async () => {
      await result.current.handleSingleAction(1, "translation.zh");
    });

    const state = result.current.getState(1);
    expect(state.runningSteps.size).toBe(0);
    expect(state.failedSteps.has("translation.zh")).toBe(true);
  });

  it("handleCancelPending으로 abortRef가 설정된다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));

    act(() => {
      result.current.handleCancelPending(1);
    });

    expect(result.current.getState(1).abortRef.current).toBe(true);
  });

  it("clearStep으로 completedSteps/stepResults/copyableSteps에서 step이 제거된다", async () => {
    const { result } = renderHook(() => useCategoryExecution("token"));

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ status: "completed", result: "some result" }),
    });

    await act(async () => {
      await result.current.handleSingleAction(1, "translation.en");
    });

    let state = result.current.getState(1);
    expect(state.completedSteps.has("translation.en")).toBe(true);
    expect(state.stepResults.size).toBe(1);

    act(() => {
      result.current.clearStep(1, "translation.en");
    });

    state = result.current.getState(1);
    expect(state.completedSteps.has("translation.en")).toBe(false);
    expect(state.stepResults.has("translation.en")).toBe(false);
    expect(state.copyableSteps.has("translation.en")).toBe(false);
  });
});
