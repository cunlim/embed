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

  it("5개 체크박스를 렌더링하고 embedding.ko만 기본 체크된다", () => {
    renderTaskExecution();

    // shadcn base-ui Checkbox는 label이 붙은 visible span과 hidden input
    // 두 가지로 렌더링되므로 getByRole로 찾는다
    const koEmb = screen.getByRole("checkbox", { name: "한국어 임베딩" });
    const enTrans = screen.getByRole("checkbox", { name: "영어 번역" });
    const enEmb = screen.getByRole("checkbox", { name: "영어 임베딩" });
    const zhTrans = screen.getByRole("checkbox", { name: "중국어 번역" });
    const zhEmb = screen.getByRole("checkbox", { name: "중국어 임베딩" });

    // shadcn base-ui Checkbox uses aria-checked
    expect(koEmb.getAttribute("aria-checked")).toBe("true");
    expect(enTrans.getAttribute("aria-checked")).toBe("false");
    expect(enEmb.getAttribute("aria-checked")).toBe("false");
    expect(zhTrans.getAttribute("aria-checked")).toBe("false");
    expect(zhEmb.getAttribute("aria-checked")).toBe("false");
  });

  it("모든 체크박스 해제 시 선택 처리·전체 처리 버튼이 disabled 된다", () => {
    renderTaskExecution();

    // embedding.ko 체크 해제
    const koEmb = screen.getByRole("checkbox", { name: "한국어 임베딩" });
    fireEvent.click(koEmb);

    const selectBtn = screen.getByText("선택 처리");
    const fullBtn = screen.getByText("전체 처리");

    expect(selectBtn).toBeDisabled();
    expect(fullBtn).toBeDisabled();
  });

  it("하나라도 체크되어 있으면 선택 처리·전체 처리 버튼이 활성화된다", () => {
    renderTaskExecution({ selectedIds: new Set([1]) });

    const selectBtn = screen.getByText("선택 처리");
    const fullBtn = screen.getByText("전체 처리");
    expect(selectBtn).toBeEnabled();
    expect(fullBtn).toBeEnabled();
  });

  it("선택 처리 클릭 시 확인 알림이 표시된다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskExecution({ selectedIds: new Set([1]) });

    fireEvent.click(screen.getByText("선택 처리"));

    expect(confirmSpy).toHaveBeenCalledWith("선택한 1개 카테고리를 처리하시겠습니까?");
  });

  it("전체 처리 클릭 시 확인 알림이 표시된다", async () => {
    const { getCategories } = await import("@/lib/api");
    vi.mocked(getCategories).mockResolvedValue({
      data: mockCategories,
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTaskExecution();

    fireEvent.click(screen.getByText("전체 처리"));

    // getCategories 호출 후 confirm 표시
    await vi.waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(confirmSpy).toHaveBeenCalledWith("현재 필터에 해당하는 1개 카테고리를 처리하시겠습니까?");
  });
});
