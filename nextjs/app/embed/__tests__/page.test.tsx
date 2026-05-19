import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EmbedPage from "../page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
}));

afterEach(cleanup);

describe("EmbedPage", () => {
  it("기능 이전 안내 메시지가 표시된다", () => {
    render(<EmbedPage />);
    expect(screen.getByText("기능이 이전되었습니다")).toBeInTheDocument();
    expect(
      screen.getByText("카테고리 추천 기능이 관리자 페이지로 통합되었습니다.")
    ).toBeInTheDocument();
  });

  it("관리자 페이지로 이동 버튼이 표시된다", () => {
    render(<EmbedPage />);
    expect(
      screen.getByRole("link", { name: "관리자 페이지로 이동" })
    ).toBeInTheDocument();
  });
});
