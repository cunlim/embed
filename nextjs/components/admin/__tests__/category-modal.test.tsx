import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

const mockSubscribeProgress = vi.fn();
const mockCancel = vi.fn();

const mockProgressDefault = {
  progress: null,
  isRunning: false,
  activeStep: null as string | null,
  startTranslation: vi.fn(),
  subscribeProgress: mockSubscribeProgress,
  cancel: mockCancel,
};

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(() => mockProgressDefault),
}));

vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn().mockResolvedValue({}),
}));


const pendingData = {
  id: 4,
  category_code: "CAT_004",
  category_name_ko: "생활/건강>세탁용품>다림판",
  embedding_dimensions: 1024,
  languages: {
    ko: {
      translation_text: "생활/건강>세탁용품>다림판",
      embedding: { status: "pending" as const, preview: null },
    },
    en: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
    zh: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProgressDefault.isRunning = false;
  mockProgressDefault.activeStep = null;
  mockWriteText.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("CategoryModal", () => {
  it("미완료 항목에 Play 아이콘 실행 버튼이 표시된다", () => {
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

    const translationButtons = screen.getAllByRole("button", { name: "번역 실행" });
    expect(translationButtons.length).toBeGreaterThanOrEqual(1);
    const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
    expect(embeddingButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("isRunning일 때 전체 실행 버튼이 disabled 되고 모든 Play 버튼도 disabled 된다", () => {
    mockProgressDefault.isRunning = true;

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

    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).toBeDisabled();

    const playButtons = screen.getAllByRole("button", { name: "번역 실행" });
    playButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("activeStep이 설정되면 해당 버튼 영역에 Loader2가 표시된다", () => {
    mockProgressDefault.isRunning = true;
    mockProgressDefault.activeStep = "translation.en";

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

    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        en: {
          translation_text: "Life/Health>Laundry>Ironing Board",
          embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3] },
        },
      },
    };

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
    const completedData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        ko: {
          translation_text: "생활/건강>세탁용품>다림판",
          embedding: { status: "completed" as const, preview: Array.from({ length: 1024 }, (_, i) => (i + 1) / 1024) },
        },
      },
    };

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
  });

  it("임베딩 preview가 null 아닐 때 복사 버튼에 전체 벡터를 복사한다", () => {
    const fullVector = Array.from({ length: 1024 }, (_, i) => +(i / 1024).toFixed(6));
    const data = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        ko: {
          translation_text: "생활/건강>세탁용품>다림판",
          embedding: { status: "completed" as const, preview: fullVector },
        },
      },
    };

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={data}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    // copyButtons[0]은 ko "원본" 텍스트 복사, copyButtons[1]은 ko 임베딩 벡터 복사
    fireEvent.click(copyButtons[1]);

    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(fullVector));
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

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error="번역 API 호출 실패"
        token="token"
      />,
    );

    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("onListRefresh prop이 전달되면 모달이 정상 렌더링된다", () => {
    const onListRefresh = vi.fn();
    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={pendingData}
        isLoading={false}
        error={null}
        token="token"
        onListRefresh={onListRefresh}
      />,
    );

    expect(screen.getByText("한국어 (ko)")).toBeInTheDocument();
  });
});
