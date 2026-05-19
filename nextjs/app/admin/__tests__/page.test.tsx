import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminPage from "../page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
}));

import { useAuth } from "@/hooks/useAuth";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: "Admin", email: "admin@test.com" },
    isLoading: false,
  });
});

describe("AdminPage", () => {
  it("기능 이전 안내 메시지가 표시된다", () => {
    render(<AdminPage />);
    expect(screen.getByText("기능이 이전되었습니다")).toBeInTheDocument();
    expect(
      screen.getByText("카테고리 추천 기능이 임베드 페이지로 통합되었습니다.")
    ).toBeInTheDocument();
  });

  it("임베드 페이지로 이동 버튼이 표시된다", () => {
    render(<AdminPage />);
    const links = screen.getAllByRole("link", { name: "임베드 페이지로 이동" });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
