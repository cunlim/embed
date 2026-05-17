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

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn() })),
}));

import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUseCategoryProgress = useCategoryProgress as ReturnType<typeof vi.fn>;

const mockStartTranslation = vi.fn();

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
      },
      {
        id: 2,
        category_code: "A02",
        category_name_ko: "식품",
        category_name_zh: null,
        category_name_en: null,
      },
    ],
    isLoading: false,
    isLoaded: true,
    error: null,
    loadCategories: vi.fn(),
    addCategory: vi.fn(),
  });
  mockUseCategoryProgress.mockReturnValue({
    progress: null,
    isRunning: false,
    startTranslation: mockStartTranslation,
    cancel: vi.fn(),
  });
});

describe("AdminPage 카테고리별 번역 실행", () => {
  it("각 카테고리 행에 번역 실행 버튼이 렌더링된다", () => {
    render(<AdminPage />);
    const buttons = screen.getAllByRole("button", { name: /번역 실행/ });
    // 데스크톱 테이블 2개 + 모바일 카드 2개 = 4개 (한쪽은 CSS로 숨김)
    expect(buttons).toHaveLength(4);
  });

  it("실행 중이 아닐 때 버튼이 활성화된다", () => {
    render(<AdminPage />);
    const button = screen.getAllByRole("button", { name: /번역 실행/ })[0];
    expect(button).not.toBeDisabled();
  });

  it("번역 실행 버튼 클릭 시 startTranslation을 호출하고 모달이 열린다", () => {
    render(<AdminPage />);
    const button = screen.getAllByRole("button", { name: /번역 실행/ })[0];
    fireEvent.click(button);

    expect(mockStartTranslation).toHaveBeenCalledWith(1, "test-token");
    expect(screen.getByText("번역·임베딩 진행 상황")).toBeInTheDocument();
  });

  it("isRunning 상태일 때 번역 실행 버튼이 존재한다", () => {
    mockUseCategoryProgress.mockReturnValue({
      progress: { categoryId: 1, step: 2, stepName: "translation.en", status: "running" },
      isRunning: true,
      startTranslation: vi.fn(),
      cancel: vi.fn(),
    });

    render(<AdminPage />);
    // isRunning=true 이면 모든 버튼이 "번역 실행" label + disabled 상태로 존재
    const buttons = screen.getAllByRole("button", { name: /번역 실행/ });
    expect(buttons.length).toBeGreaterThan(0);
  });
});
