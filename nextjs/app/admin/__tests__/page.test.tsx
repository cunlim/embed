import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminPage from "../page";

// 모킹
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
    user: { id: 1, name: "Admin", email: "admin@test.com" },
    isLoading: false,
  });
  mockUseCategories.mockReturnValue({
    categories: [
      {
        id: 1,
        category_code: "A01",
        category_name_ko: "의류",
        category_name_zh: "服装",
        category_name_en: "Clothing",
        translation_status: "completed",
      },
      {
        id: 2,
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
  });
  mockUseCategoryDetail.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    reload: vi.fn(),
  });
});

describe("AdminPage 재설계", () => {
  it("카테고리 목록에 한국어 카테고리명이 표시된다", () => {
    render(<AdminPage />);
    // 데스크톱 테이블 + 모바일 카드 모두 렌더링되므로 2개씩 표시됨
    const items = screen.getAllByText("의류");
    expect(items.length).toBe(2);
  });

  it("각 카테고리 행에 상세 보기 버튼이 렌더링된다", () => {
    render(<AdminPage />);
    const buttons = screen.getAllByRole("button", { name: "상세 보기" });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("상세 보기 버튼 클릭 시 모달이 열린다", () => {
    render(<AdminPage />);
    const buttons = screen.getAllByRole("button", { name: "상세 보기" });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("카테고리 상세")).toBeInTheDocument();
  });

  it("처리완료 상태가 표시된다", () => {
    render(<AdminPage />);
    const items = screen.getAllByText("처리완료");
    expect(items.length).toBeGreaterThan(0);
  });

  it("카테고리 코드 input이 렌더링된다", () => {
    render(<AdminPage />);
    expect(screen.getByLabelText("카테고리 코드")).toBeInTheDocument();
  });

  it("처리안됨 상태가 표시된다", () => {
    render(<AdminPage />);
    const items = screen.getAllByText("처리안됨");
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

    render(<AdminPage />);
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

    render(<AdminPage />);
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

    render(<AdminPage />);
    // catError는 카테고리 추가 카드 + 카테고리 목록 양쪽에 표시됨
    const errorMessages = screen.getAllByText("서버 오류");
    expect(errorMessages.length).toBe(2);
    expect(screen.getByText("재시도")).toBeInTheDocument();
  });
});
