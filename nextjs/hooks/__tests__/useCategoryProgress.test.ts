import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn(),
  cancelTranslateEmbed: vi.fn().mockResolvedValue({ message: "취소됨", category_id: 1 }),
}));

const mockListen = vi.fn();
const mockLeaveChannel = vi.fn();
const mockChannel = vi.fn(() => ({
  listen: mockListen,
  stopListening: vi.fn(),
}));

const mockEcho = {
  channel: mockChannel,
  leaveChannel: mockLeaveChannel,
};

vi.mock("@/hooks/useEcho", () => ({
  useEcho: vi.fn(() => mockEcho),
}));

import { useEcho } from "@/hooks/useEcho";
import { translateEmbedCategory } from "@/lib/api";

const mockedTranslateEmbed = translateEmbedCategory as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedTranslateEmbed.mockResolvedValue({
    message: "시작됨",
    category_id: 1,
  });
});

describe("useCategoryProgress", () => {
  it("초기 상태는 progress null, isRunning false, activeStep null", () => {
    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
  });

  it("subscribeProgress 호출 시 isRunning true, Echo 채널을 구독한다", () => {
    const { result } = renderHook(() => useCategoryProgress());

    act(() => {
      result.current.subscribeProgress(1);
    });

    expect(mockChannel).toHaveBeenCalledWith("category.1");
    expect(mockListen).toHaveBeenCalledTimes(2);
    expect(result.current.isRunning).toBe(true);
  });

  it("progress 이벤트 수신 시 progress + activeStep 상태를 업데이트한다", () => {
    const { result } = renderHook(() => useCategoryProgress());

    act(() => {
      result.current.subscribeProgress(1);
    });

    const progressCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.progress",
    )?.[1];

    act(() => {
      progressCallback({
        categoryId: 1,
        step: 1,
        stepName: "translation.zh",
        status: "running",
      });
    });

    expect(result.current.progress).toEqual({
      categoryId: 1,
      step: 1,
      stepName: "translation.zh",
      status: "running",
    });
    expect(result.current.activeStep).toBe("translation.zh");
  });

  it("completed 이벤트 수신 시 isRunning false, activeStep null, onUpdate 호출", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    const completedCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.completed",
    )?.[1];

    act(() => {
      completedCallback({
        categoryId: 1,
        allSuccess: true,
        failedStep: 0,
      });
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("cancel 호출 시 채널 leave + 상태 초기화", async () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockLeaveChannel).toHaveBeenCalledWith("category.1");
    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.activeStep).toBeNull();
  });

  it("echo가 null이어도 subscribeProgress 호출 시 isRunning이 true가 된다", () => {
    vi.mocked(useEcho).mockReturnValue(null as any);

    try {
      const { result } = renderHook(() => useCategoryProgress());

      act(() => {
        result.current.subscribeProgress(1);
      });

      expect(result.current.isRunning).toBe(true);
    } finally {
      vi.mocked(useEcho).mockReturnValue(mockEcho as any);
    }
  });

  it("category.progress completed 이벤트 수신 시 onUpdate 콜백이 progress 데이터와 함께 호출된다", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    const progressCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.progress",
    )?.[1];

    act(() => {
      progressCallback({
        categoryId: 1,
        step: 1,
        stepName: "translation.zh",
        status: "completed",
      });
    });

    expect(onUpdate).toHaveBeenCalledWith({
      categoryId: 1,
      step: 1,
      stepName: "translation.zh",
      status: "completed",
    });
  });

  it("category.progress failed 이벤트 수신 시 onUpdate 콜백이 progress 데이터와 함께 호출된다", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    const progressCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.progress",
    )?.[1];

    act(() => {
      progressCallback({
        categoryId: 1,
        step: 2,
        stepName: "embedding.ko",
        status: "failed",
        error: "Ollama timeout",
      });
    });

    expect(onUpdate).toHaveBeenCalledWith({
      categoryId: 1,
      step: 2,
      stepName: "embedding.ko",
      status: "failed",
      error: "Ollama timeout",
    });
  });

  it("category.completed 이벤트 수신 시 onUpdate가 인자 없이 호출된다", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useCategoryProgress(onUpdate));

    act(() => {
      result.current.subscribeProgress(1);
    });

    const completedCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.completed",
    )?.[1];

    act(() => {
      completedCallback({ categoryId: 1, allSuccess: true, failedStep: 0 });
    });

    expect(onUpdate).toHaveBeenCalledWith(); // 인자 없음 = 전체 완료
  });
});
