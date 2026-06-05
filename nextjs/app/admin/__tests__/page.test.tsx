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

vi.mock("@/components/admin/settings-panel", () => ({
  SettingsPanel: ({ token }: { token: string }) => (
    <div data-testid="settings-panel">SettingsPanel: {token}</div>
  ),
}));

import { useAuth } from "@/hooks/useAuth";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

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
});

describe("AdminPageContent", () => {
  it("시스템 설정이 표시된다", () => {
    render(<AdminPageContent serverUser={serverUser} />);
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
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
