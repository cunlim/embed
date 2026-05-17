import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

// API mock
vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn(),
  cancelTranslateEmbed: vi.fn(),
}));

// Echo mock
const mockListen = vi.fn();
const mockStopListening = vi.fn();
const mockLeaveChannel = vi.fn();
const mockChannel = vi.fn(() => ({
  listen: mockListen,
  stopListening: mockStopListening,
}));

const mockEcho = {
  channel: mockChannel,
  leaveChannel: mockLeaveChannel,
};

// useEcho mock
vi.mock("@/hooks/useEcho", () => ({
  useEcho: vi.fn(() => mockEcho),
}));

import { translateEmbedCategory, cancelTranslateEmbed } from "@/lib/api";
import { useEcho } from "@/hooks/useEcho";

const mockedTranslateEmbed = translateEmbedCategory as ReturnType<typeof vi.fn>;
const mockedCancelTranslateEmbed = cancelTranslateEmbed as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedTranslateEmbed.mockResolvedValue({
    message: "시작됨",
    category_id: 1,
  });
  mockedCancelTranslateEmbed.mockResolvedValue({
    message: "취소됨",
    category_id: 1,
  });
});

describe("useCategoryProgress", () => {
  it("초기 상태는 progress null, isRunning false", () => {
    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it("startTranslation 호출 시 API를 호출하고 Echo 채널을 구독한다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1, "test-token");
    });

    expect(mockedTranslateEmbed).toHaveBeenCalledWith(1, "test-token");
    expect(mockChannel).toHaveBeenCalledWith("category.1");
    expect(mockListen).toHaveBeenCalledTimes(2); // .category.progress + .category.completed
    expect(result.current.isRunning).toBe(true);
  });

  it("progress 이벤트 수신 시 progress 상태를 업데이트한다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1);
    });

    // progress 리스너 추출해서 호출
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
  });

  it("completed 이벤트 수신 시 isRunning이 false가 된다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1);
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
  });

  it("cancel 호출 시 채널 leave + 상태 초기화, API cancel 호출", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1, "test-token");
    });

    await act(async () => {
      result.current.cancel();
    });

    expect(mockedCancelTranslateEmbed).toHaveBeenCalledWith(1, "test-token");
    expect(mockLeaveChannel).toHaveBeenCalledWith("category.1");
    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });
});
