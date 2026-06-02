import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TaskExecution from "@/components/admin/task-execution";
import type { Category } from "@/lib/api";

vi.mock("@/lib/api");

const mockCategories: Category[] = [
  {
    id: 1,
    user_id: 1,
    category_code: "50000000",
    category_name_ko: "테스트>카테고리",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending",
  },
];

function renderTaskExecution(props: Partial<{
  token: string | null;
  selectedIds: Set<number>;
  categories: Category[];
  keyword?: string;
}> = {}) {
  return render(
    <TaskExecution
      token={props.token ?? "test-token"}
      selectedIds={props.selectedIds ?? new Set()}
      categories={props.categories ?? mockCategories}
      filter={undefined}
      keyword={props.keyword}
      canModify={() => true}
      onComplete={vi.fn()}
      onCategoryComplete={vi.fn()}
    />
  );
}

describe("TaskExecution", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5개 체크박스를 렌더링하고 기본적으로 모두 해제되어 있다", () => {
    renderTaskExecution();

    const koEmb = screen.getByRole("checkbox", { name: "한국어 임베딩" });
    const enTrans = screen.getByRole("checkbox", { name: "영어 번역" });
    const enEmb = screen.getByRole("checkbox", { name: "영어 임베딩" });
    const zhTrans = screen.getByRole("checkbox", { name: "중국어 번역" });
    const zhEmb = screen.getByRole("checkbox", { name: "중국어 임베딩" });

    expect(koEmb.getAttribute("aria-checked")).toBe("false");
    expect(enTrans.getAttribute("aria-checked")).toBe("false");
    expect(enEmb.getAttribute("aria-checked")).toBe("false");
    expect(zhTrans.getAttribute("aria-checked")).toBe("false");
    expect(zhEmb.getAttribute("aria-checked")).toBe("false");
  });

  it("체크박스가 모두 해제되어 있으면 선택 처리·전체 처리 버튼이 disabled 된다", () => {
    renderTaskExecution();

    const selectBtn = screen.getByText("선택 처리");
    const fullBtn = screen.getByText("전체 처리");

    expect(selectBtn).toBeDisabled();
    expect(fullBtn).toBeDisabled();
  });

  it("하나라도 체크되어 있으면 선택 처리·전체 처리 버튼이 활성화된다", () => {
    renderTaskExecution({ selectedIds: new Set([1]) });

    // 체크박스를 하나 체크해야 버튼이 활성화됨
    const koEmb = screen.getByRole("checkbox", { name: "한국어 임베딩" });
    fireEvent.click(koEmb);

    const selectBtn = screen.getByText("선택 처리");
    const fullBtn = screen.getByText("전체 처리");
    expect(selectBtn).toBeEnabled();
    expect(fullBtn).toBeEnabled();
  });

  it("선택 처리 클릭 시 확인 알림이 표시된다", async () => {
    const { fetchBatchStatus } = await import("@/lib/api");
    vi.mocked(fetchBatchStatus).mockResolvedValue({
      data: {
        total_selected: 1,
        needs_processing: 1,
        total_steps: 2,
        categories: [{ id: 1, category_name_ko: "테스트>카테고리", missing_steps: ["embedding.ko", "translation.en"] }],
      },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskExecution({ selectedIds: new Set([1]) });

    // 한국어 임베딩 체크
    fireEvent.click(screen.getByRole("checkbox", { name: "한국어 임베딩" }));
    fireEvent.click(screen.getByText("선택 처리"));

    await vi.waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(confirmSpy).toHaveBeenCalledWith("선택한 1개 카테고리 중 1개에서 2개 step이 필요합니다. 처리하시겠습니까?");
  });

  it("전체 처리 클릭 시 확인 알림이 표시된다", async () => {
    const { fetchBatchStatus } = await import("@/lib/api");
    vi.mocked(fetchBatchStatus).mockResolvedValue({
      data: {
        total_selected: 1,
        needs_processing: 1,
        total_steps: 1,
        categories: [{ id: 1, category_name_ko: "테스트>카테고리", missing_steps: ["embedding.ko"] }],
      },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskExecution();

    // 한국어 임베딩 체크
    fireEvent.click(screen.getByRole("checkbox", { name: "한국어 임베딩" }));
    fireEvent.click(screen.getByText("전체 처리"));

    await vi.waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(confirmSpy).toHaveBeenCalledWith("현재 필터에 해당하는 1개 카테고리 중 1개에서 1개 step이 필요합니다. 처리하시겠습니까?");
  });
});
