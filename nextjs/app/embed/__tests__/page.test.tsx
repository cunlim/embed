import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmbedPage from "../page";

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
    user: { id: 2, name: "User", email: "user@test.com" },
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

describe("EmbedPage", () => {
  it("카테고리 목록에 한국어 카테고리명이 표시된다", () => {
    render(<EmbedPage />);
    const items = screen.getAllByText("의류");
    expect(items.length).toBe(2);
  });

  it("각 카테고리 행에 상세 보기 버튼이 렌더링된다", () => {
    render(<EmbedPage />);
    const buttons = screen.getAllByRole("button", { name: "수정" });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("상세 보기 버튼 클릭 시 모달이 열린다", () => {
    render(<EmbedPage />);
    const buttons = screen.getAllByRole("button", { name: "수정" });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("카테고리 상세")).toBeInTheDocument();
  });

  it("처리완료 상태가 표시된다", () => {
    render(<EmbedPage />);
    const items = screen.getAllByLabelText("처리완료");
    expect(items.length).toBeGreaterThan(0);
  });

  it("카테고리 코드 input이 렌더링된다", () => {
    render(<EmbedPage />);
    expect(screen.getByLabelText("카테고리 코드")).toBeInTheDocument();
  });

  it("처리안됨 상태가 표시된다", () => {
    render(<EmbedPage />);
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

    render(<EmbedPage />);
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

    render(<EmbedPage />);
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

    render(<EmbedPage />);
    const errorMessages = screen.getAllByText("서버 오류");
    expect(errorMessages.length).toBe(2);
    expect(screen.getByText("재시도")).toBeInTheDocument();
  });

  it("관리자가 아닌 일반 사용자도 접근 가능하다", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "User", email: "user@test.com" },
      isLoading: false,
    });

    render(<EmbedPage />);
    const headings = screen.getAllByText("카테고리 추천");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
