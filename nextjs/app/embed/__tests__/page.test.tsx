import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmbedPageInner } from "../embed-page-inner";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/useCategoryDetail", () => ({
  useCategoryDetail: vi.fn(),
}));

vi.mock("@/hooks/useCategoryExecution", () => ({
  useCategoryExecution: vi.fn(() => ({
    getState: vi.fn(() => null),
    handleSingleAction: vi.fn(),
    handleRunAll: vi.fn(),
    handleCancelPending: vi.fn(),
    clearStep: vi.fn(),
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUseCategoryDetail = useCategoryDetail as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 2, name: "User", email: "user@test.com", role: "member" },
    isLoading: false,
  });
  mockUseCategories.mockReturnValue({
    categories: [
      {
        id: 1,
        user_id: 1,  // 다른 사용자 소유 → member는 보기만 가능
        category_code: "A01",
        category_name_ko: "의류",
        category_name_zh: "服装",
        category_name_en: "Clothing",
        translation_status: "completed",
      },
      {
        id: 2,
        user_id: 2,  // 본인 소유 → 수정 가능
        category_code: "A02",
        category_name_ko: "식품",
        category_name_zh: null,
        category_name_en: null,
        translation_status: "pending",
      },
    ],
    isLoading: false,
    isLoaded: true,
    error: null,
    loadCategories: vi.fn(),
    addCategory: vi.fn(),
    updateCategoryStatus: vi.fn(),
    deleteCategory: vi.fn(),
  });
  mockUseCategoryDetail.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    reload: vi.fn(),
  });
});

describe("EmbedPage", () => {
  it("카테고리 목록에 한국어 카테고리명이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const items = screen.getAllByText("의류");
    expect(items.length).toBe(2);
  });

  it("각 카테고리 행에 작업 버튼이 렌더링된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const editButtons = screen.getAllByRole("button", { name: "수정" });
    const viewButtons = screen.getAllByRole("button", { name: "보기" });
    expect(editButtons.length + viewButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("작업 버튼 클릭 시 모달이 열린다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const buttons = screen.getAllByRole("button", { name: /수정|보기/ });
    fireEvent.click(buttons[0]);

    // id=1은 타인 소유이므로 readOnly 모달 → "카테고리 보기" 타이틀
    expect(screen.getByText("카테고리 보기")).toBeInTheDocument();
  });

  it("처리완료 상태가 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const items = screen.getAllByLabelText("처리완료");
    expect(items.length).toBeGreaterThan(0);
  });

  it("카테고리 코드 input이 렌더링된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    expect(screen.getByLabelText("카테고리 코드")).toBeInTheDocument();
  });

  it("처리안됨 상태가 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const items = screen.getAllByLabelText("처리안됨");
    expect(items.length).toBeGreaterThan(0);
  });

  it("카테고리가 없을 때 빈 상태를 표시한다", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      isLoaded: true,
      error: null,
      loadCategories: vi.fn(),
      addCategory: vi.fn(),
    });

    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    expect(screen.getByText("등록된 카테고리가 없습니다")).toBeInTheDocument();
  });

  it("로딩 중 스켈레톤을 표시한다", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: true,
      isLoaded: false,
      error: null,
      loadCategories: vi.fn(),
      addCategory: vi.fn(),
    });

    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("에러 발생 시 재시도 버튼을 표시한다", () => {
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      isLoaded: true,
      error: "서버 오류",
      loadCategories: vi.fn(),
      addCategory: vi.fn(),
    });

    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const errorMessages = screen.getAllByText("서버 오류");
    expect(errorMessages.length).toBe(2);
    expect(screen.getByText("재시도")).toBeInTheDocument();
  });

  it("관리자가 아닌 일반 사용자도 접근 가능하다", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "User", email: "user@test.com", role: "member" },
      isLoading: false,
    });

    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const headings = screen.getAllByText("카테고리 추천");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("일반회원은 자신의 카테고리에 수정 버튼이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const editButtons = screen.getAllByRole("button", { name: "수정" });
    expect(editButtons.length).toBeGreaterThan(0); // id=2 (user_id=2, 본인 소유)
  });

  it("일반회원은 타인 카테고리에 보기 버튼이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const viewButtons = screen.getAllByRole("button", { name: "보기" });
    expect(viewButtons.length).toBeGreaterThan(0); // id=1 (user_id=1, 타인 소유)
  });

  it("일반회원은 자신의 카테고리에 삭제 버튼이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    expect(deleteButtons.length).toBeGreaterThan(0); // id=2 (자신의 카테고리)
  });

  it("컬럼 헤더에 작업이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    expect(screen.getAllByText("작업").length).toBeGreaterThanOrEqual(1);
  });

  it("유사도 검색 섹션 타이틀이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const titles = screen.getAllByText("유사도 검색");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("필터 섹션 타이틀이 표시된다", () => {
    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={false} serverFilter={null} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);
    const titles = screen.getAllByText("필터");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("서버 기본 필터가 my이면 초기 목록 로딩도 my로 호출된다", async () => {
    const loadCategories = vi.fn();
    mockUseCategories.mockReturnValue({
      categories: [],
      isLoading: false,
      isLoaded: true,
      error: null,
      loadCategories,
      addCategory: vi.fn(),
      updateCategoryStatus: vi.fn(),
      deleteCategory: vi.fn(),
    });

    render(<EmbedPageInner server대Options={[]} server중Options={[]} server소Options={[]} server세Options={[]} serverCategories={[]} serverMeta={null} serverHadToken={true} serverFilter={"my"} serverSearchResults={null} serverSearchMeta={null} serverSearchText={null} serverSearchLang="ko" />);

    await waitFor(() => {
      expect(loadCategories).toHaveBeenCalledWith(1, 20, "my", undefined);
    });
  });
});
