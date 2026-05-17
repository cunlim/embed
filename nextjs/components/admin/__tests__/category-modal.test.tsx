import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";

// sonner toast mock
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

// clipboard mock
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

import { toast } from "sonner";

const mockProgress = {
  progress: null,
  isRunning: false,
  activeStep: null as string | null,
  startTranslation: vi.fn(),
  subscribeProgress: vi.fn(),
  cancel: vi.fn(),
};

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(() => mockProgress),
}));

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn().mockResolvedValue({}),
}));


const completedData = {
  id: 1,
  category_code: "CAT_test",
  category_name_ko: "테스트>카테고리",
  embedding_dimensions: 1024,
  languages: {
    ko: {
      translation_text: "테스트>카테고리",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] },
    },
    en: {
      translation_text: "Test>Category",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5] },
    },
    zh: {
      translation_text: "测试>类别",
      embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3, 0.4, 0.5] },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProgress.isRunning = false;
  mockProgress.activeStep = null;
  mockWriteText.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("CategoryModal", () => {
  it("언어 섹션에 체크박스가 없다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const checkboxes = document.querySelectorAll('[role="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it("언어 헤더에 상태 뱃지가 없다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    expect(screen.queryByText("완료")).not.toBeInTheDocument();
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it("복사 버튼 클릭 시 clipboard에 쓰고 toast를 호출한다", async () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    fireEvent.click(copyButtons[0]);

    expect(mockWriteText).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(toast).toHaveBeenCalledWith("클립보드에 복사되었습니다");
    });
  });

  it("임베딩 미완료 항목에 실행 버튼이 표시된다", () => {
    const pendingData = {
      ...completedData,
      languages: {
        ...completedData.languages,
        en: {
          translation_text: null,
          embedding: { status: "pending" as const, preview: null },
        },
      },
    };

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    expect(screen.getByRole("button", { name: "번역 실행" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "임베딩 실행" })).toBeInTheDocument();
  });

  it("activeStep이 설정된 실행 버튼에 스피너가 표시된다", () => {
    mockProgress.isRunning = true;
    mockProgress.activeStep = "translation.en";

    const pendingData = {
      ...completedData,
      languages: {
        ...completedData.languages,
        en: {
          translation_text: null,
          embedding: { status: "pending" as const, preview: null },
        },
      },
    };

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    // 번역 실행 버튼 대신 Loader2가 표시되어야 함
    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBeGreaterThanOrEqual(2); // 값 영역 + 버튼 영역
  });

  it("전체 실행 버튼은 isRunning일 때 disabled만 적용된다 (스피너 없음)", () => {
    mockProgress.isRunning = true;
    mockProgress.activeStep = "translation.en";

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).toBeDisabled();
    // 스피너가 버튼 내에 없어야 함
    expect(runAllButton.querySelector(".animate-spin")).toBeNull();
  });

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={completedData}
        isLoading={false}
        error="번역 API 호출 실패"
        token="token"
      />,
    );

    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("로딩 중 스켈레톤이 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={null}
        isLoading={true}
        error={null}
        token="token"
      />,
    );

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("데이터 없고 로딩 아닐 때 아무것도 렌더링하지 않는다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={null}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    // queryAllByText로 중복 포털에서도 개수 검증
    const items = screen.queryAllByText("한국어 (ko)");
    expect(items.length).toBe(0);
  });
});
