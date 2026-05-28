import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryDelete from "@/components/admin/category-delete";
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
  {
    id: 2,
    user_id: 1,
    category_code: "50000001",
    category_name_ko: "테스트>카테고리2",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending",
  },
];

function renderCategoryDelete(props: Partial<{
  token: string | null;
  selectedIds: Set<number>;
  categories: Category[];
  filter: string | undefined;
  keyword: string | undefined;
}> = {}) {
  return render(
    <CategoryDelete
      token={props.token ?? "test-token"}
      selectedIds={props.selectedIds ?? new Set()}
      categories={props.categories ?? mockCategories}
      filter={props.filter}
      keyword={props.keyword}
      canModify={() => true}
      onComplete={vi.fn()}
      onCategoryComplete={vi.fn()}
    />
  );
}

describe("CategoryDelete", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("선택삭제와 전체삭제 버튼을 렌더링한다", () => {
    renderCategoryDelete();
    expect(screen.getByText("선택삭제")).toBeInTheDocument();
    expect(screen.getByText("전체삭제")).toBeInTheDocument();
  });

  it("선택된 ID가 없으면 선택삭제 버튼이 disabled 된다", () => {
    renderCategoryDelete({ selectedIds: new Set() });
    expect(screen.getByText("선택삭제")).toBeDisabled();
  });

  it("선택삭제 클릭 시 확인 알림이 표시된다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCategoryDelete({ selectedIds: new Set([1]) });

    fireEvent.click(screen.getByText("선택삭제"));

    expect(confirmSpy).toHaveBeenCalledWith("선택한 1개 카테고리를 삭제하시겠습니까?");
  });

  it("전체삭제 클릭 시 확인 알림이 표시된다", async () => {
    const { getCategories } = await import("@/lib/api");
    vi.mocked(getCategories).mockResolvedValue({
      data: mockCategories,
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 2, from: 1, to: 2 },
      links: { first: null, last: null, prev: null, next: null },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCategoryDelete();

    fireEvent.click(screen.getByText("전체삭제"));

    await vi.waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
  });
});
