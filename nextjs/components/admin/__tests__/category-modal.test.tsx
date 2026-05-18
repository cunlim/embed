import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";
import { updateCategoryText } from "@/lib/api";
import type { CatExecState } from "@/hooks/useCategoryExecution";

function createEmptyExecState(): CatExecState {
  return {
    runningSteps: new Set(),
    pendingSteps: [],
    completedSteps: new Set(),
    failedSteps: new Set(),
    stepResults: new Map(),
    copyableSteps: new Set(),
    embeddingFullData: new Map(),
    flashSteps: new Set(),
    abortRef: { current: false },
    actionError: null,
  };
}

const defaultHandlers = {
  onSingleAction: vi.fn().mockResolvedValue(undefined),
  onRunAll: vi.fn().mockResolvedValue(undefined),
  onCancelPending: vi.fn(),
};

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/lib/api", () => ({ updateCategoryText: vi.fn() }));

const mockWriteText = vi.fn();
Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

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
  mockWriteText.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("CategoryModal", () => {
  it("미완료 항목에 Play 아이콘 실행 버튼이 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const translationButtons = screen.getAllByRole("button", { name: "번역 실행" });
    expect(translationButtons.length).toBeGreaterThanOrEqual(1);
    const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
    expect(embeddingButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        en: {
          translation_text: "Life/Health",
          embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3] },
        },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const copyButtons = screen.getAllByRole("button", { name: "복사" });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it("로딩 중 스켈레톤이 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={null} isLoading={true} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error="번역 API 호출 실패" token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("전체실행 버튼이 표시되고 클릭 가능하다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).not.toBeDisabled();
  });

  it("초기 상태에서는 실행중지 버튼이 표시되지 않는다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    expect(screen.queryByRole("button", { name: "실행중지" })).not.toBeInTheDocument();
  });

  it("일부 항목이 완료되었지만 pending이 없으면 실행중지 버튼이 표시되지 않는다", () => {
    const partialData = {
      ...pendingData,
      languages: {
        ...pendingData.languages,
        en: {
          translation_text: "Life/Health",
          embedding: { status: "completed" as const, preview: [0.1, 0.2] },
        },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={partialData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    expect(screen.getByRole("button", { name: "전체 실행" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "실행중지" })).not.toBeInTheDocument();
  });

  it("모든 항목이 완료되면 전체실행 버튼이 disabled된다", () => {
    const allDoneData = {
      id: 4,
      category_code: "CAT_004",
      category_name_ko: "테스트",
      embedding_dimensions: 1024,
      languages: {
        ko: {
          translation_text: "테스트",
          embedding: { status: "completed" as const, preview: [0.1] },
        },
        en: {
          translation_text: "Test",
          embedding: { status: "completed" as const, preview: [0.2] },
        },
        zh: {
          translation_text: "测试",
          embedding: { status: "completed" as const, preview: [0.3] },
        },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={allDoneData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).toBeDisabled();
  });

  it("텍스트가 input으로 렌더링된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1] } },
        en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.2] } },
        zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.3] } },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(3); // ko, en, zh — NOT embeddings
  });

  it("실행 중 input이 readonly가 된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1] } },
        en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.2] } },
        zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.3] } },
      },
    };
    const execState = {
      ...createEmptyExecState(),
      runningSteps: new Set(["translation.en" as const]),
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={execState} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const inputs = screen.getAllByRole("textbox");
    inputs.forEach(input => {
      expect(input).toHaveAttribute("readonly");
    });
  });

  it("임베딩 행은 input이 아닌 text로 표시된다", () => {
    const completedData = {
      ...pendingData,
      languages: {
        ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1, 0.2] } },
        en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.3] } },
        zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.4] } },
      },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(3); // textbox는 3개 (ko, en, zh translations만) — embedding rows are NOT textboxes
  });
  it("blur 시 값이 변경되었으면 저장 API를 호출한다", async () => {
    vi.mocked(updateCategoryText).mockResolvedValue({ data: { updated: true, id: 1 } });

    const completedData = {
      ...pendingData,
      languages: {
        ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1] } },
        en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.2] } },
        zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.3] } },
      },
    };
    const onReload = vi.fn();
    const onListRefresh = vi.fn();
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} onReload={onReload} onListRefresh={onListRefresh} />);

    const inputs = screen.getAllByRole("textbox");
    // Change value of first input and blur
    fireEvent.change(inputs[0], { target: { value: "새로운값" } });
    fireEvent.blur(inputs[0]);

    await vi.waitFor(() => {
      expect(updateCategoryText).toHaveBeenCalled();
    });

    vi.clearAllMocks();
  });
});
