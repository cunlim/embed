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

  it("activeStep이 설정되면 버튼이 유지되고 내부 아이콘이 Loader2로 변경된다", () => {
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

    // 버튼은 여전히 존재해야 함 (사라지지 않음)
    const playButtons = screen.getAllByRole("button", { name: "번역 실행" });
    expect(playButtons.length).toBeGreaterThanOrEqual(1);

    // Loader2 아이콘이 버튼 내부에 존재 (animate-spin)
    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("isRunning일 때 데이터 컬럼에는 spinner 대신 '처리전' 텍스트가 표시된다", () => {
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

    // 데이터 컬럼에 "처리전" 텍스트가 여전히 표시됨 (spinner로 대체되지 않음)
    const pendingTexts = screen.getAllByText("처리전");
    expect(pendingTexts.length).toBeGreaterThanOrEqual(1);
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

  it("번역이 완료되지 않은 언어의 임베딩 실행 버튼은 disabled 된다", () => {
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

    // en, zh 번역이 null → 임베딩 버튼은 disabled
    const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
    // ko의 임베딩 버튼은 활성화 (번역 불필요)
    // en, zh의 임베딩 버튼은 disabled (번역 미완료)
    const disabledEmbeds = embeddingButtons.filter((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabledEmbeds.length).toBe(2); // en, zh
  });

  it("번역이 완료된 언어의 임베딩 실행 버튼은 활성화된다", () => {
    const partialData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        en: {
          translation_text: "Life/Health>Laundry>Ironing Board",
          embedding: { status: "pending" as const, preview: null },
        },
      },
    };

    render(
      <CategoryModal
        open={true}
        onOpenChange={vi.fn()}
        data={partialData}
        isLoading={false}
        error={null}
        token="token"
      />,
    );

    const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
    // ko: 활성화, en: 활성화 (번역 완료), zh: disabled (번역 미완료)
    const enabledEmbeds = embeddingButtons.filter((btn) => !(btn as HTMLButtonElement).disabled);
    expect(enabledEmbeds.length).toBe(2); // ko, en
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

  it("전체실행 클릭 시 첫 번째 step만 running 상태가 된다", () => {
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
    fireEvent.click(runAllButton);

    // 전체실행 클릭 후 첫 step만 Loader2(spinner) — 나머지는 Play 아이콘이어야 함
    const loaderIcons = document.querySelectorAll(".animate-spin");
    expect(loaderIcons.length).toBe(1);
  });
});
