import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EmbedPage from "../page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(() => ({
    categories: [],
    isLoaded: true,
    loadCategories: vi.fn(),
  })),
}));

vi.mock("@/hooks/useRecommend", () => ({
  useRecommend: vi.fn(() => ({
    recommend: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
}));

vi.mock("@/lib/api", () => ({
  getCategories: vi.fn().mockResolvedValue({ data: [] }),
  runStep: vi.fn(),
}));

afterEach(cleanup);

describe("EmbedPage", () => {
  it("기본 UI 요소가 표시된다", () => {
    render(<EmbedPage />);
    expect(screen.getByText("기술 시연")).toBeInTheDocument();
    expect(screen.getByText("일괄 번역")).toBeInTheDocument();
  });

  it("전체 번역 실행 버튼이 표시된다", () => {
    render(<EmbedPage />);
    expect(screen.getByRole("button", { name: "전체 번역 실행" })).toBeInTheDocument();
  });
});
