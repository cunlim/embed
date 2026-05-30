import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminPageContent } from "../page-content";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
}));

vi.mock("../layout", () => ({
  useAdminMenu: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { useAdminMenu } from "../layout";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseAdminMenu = useAdminMenu as ReturnType<typeof vi.fn>;

const serverUser = {
  id: 1,
  name: "Superadmin",
  email: "superadmin@test.com",
  role: "superadmin",
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: serverUser,
    isLoading: false,
  });
  mockUseAdminMenu.mockReturnValue({
    active: "settings",
    setActive: vi.fn(),
  });
});

describe("AdminPageContent", () => {
  it("기본으로 시스템 설정이 표시된다", () => {
    render(<AdminPageContent serverUser={serverUser} />);
    // settings가 활성화되면 SettingsPanel이 렌더링됨
    expect(screen.queryByText("기능이 이전되었습니다")).not.toBeInTheDocument();
  });

  it("안내 메뉴 클릭 시 기능 이전 안내가 표시된다", () => {
    mockUseAdminMenu.mockReturnValue({
      active: "info",
      setActive: vi.fn(),
    });
    render(<AdminPageContent serverUser={serverUser} />);
    expect(screen.getByText("기능이 이전되었습니다")).toBeInTheDocument();
    expect(
      screen.getByText("카테고리 추천 기능이 임베드 페이지로 통합되었습니다.")
    ).toBeInTheDocument();
  });

  it("안내 메뉴 클릭 시 임베드 페이지로 이동 버튼이 표시된다", () => {
    mockUseAdminMenu.mockReturnValue({
      active: "info",
      setActive: vi.fn(),
    });
    render(<AdminPageContent serverUser={serverUser} />);
    const links = screen.getAllByRole("link", { name: "임베드 페이지로 이동" });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("authLoading 중에는 아무것도 렌더링되지 않는다", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    });
    const { container } = render(<AdminPageContent serverUser={serverUser} />);
    expect(container.innerHTML).toBe("");
  });

  it("user가 null이면 아무것도 렌더링되지 않는다", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });
    const { container } = render(<AdminPageContent serverUser={serverUser} />);
    expect(container.innerHTML).toBe("");
  });
});
