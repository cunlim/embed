import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  cleanup();
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: "Superadmin", email: "superadmin@test.com", role: "superadmin" },
    isLoading: false,
  });
});

describe("AdminPage", () => {
  it("기본으로 시스템 설정이 표시된다", () => {
    render(<AdminPage />);
    expect(screen.getByText("시스템 설정")).toBeInTheDocument();
    expect(screen.getByText("안내")).toBeInTheDocument();
  });

  it("안내 메뉴 클릭 시 기능 이전 안내가 표시된다", async () => {
    render(<AdminPage />);
    await userEvent.click(screen.getByText("안내"));
    expect(screen.getByText("기능이 이전되었습니다")).toBeInTheDocument();
    expect(
      screen.getByText("카테고리 추천 기능이 임베드 페이지로 통합되었습니다.")
    ).toBeInTheDocument();
  });

  it("안내 메뉴 클릭 시 임베드 페이지로 이동 버튼이 표시된다", async () => {
    render(<AdminPage />);
    await userEvent.click(screen.getByText("안내"));
    const links = screen.getAllByRole("link", { name: "임베드 페이지로 이동" });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("비superadmin 사용자는 admin 페이지 내용이 렌더링되지 않는다", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "Admin", email: "admin@test.com", role: "admin" },
      isLoading: false,
    });
    const { container } = render(<AdminPage />);
    expect(screen.queryByText("기능이 이전되었습니다")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  it("비로그인 사용자는 admin 페이지 내용이 렌더링되지 않는다", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });
    const { container } = render(<AdminPage />);
    expect(screen.queryByText("기능이 이전되었습니다")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });
});
