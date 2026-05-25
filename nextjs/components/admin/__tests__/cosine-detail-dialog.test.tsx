import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
import type { Recommendation } from "@/lib/api";
import {
  formatEmbeddingPreview,
  dotProductExpression,
  firstDotTerm,
} from "@/components/admin/cosine-detail-dialog";

describe("formatEmbeddingPreview", () => {
  it("returns em-dash for null", () => {
    expect(formatEmbeddingPreview(null)).toBe("—");
  });

  it("returns em-dash for empty array", () => {
    expect(formatEmbeddingPreview([])).toBe("—");
  });

  it("shows full array when length <= 6", () => {
    const result = formatEmbeddingPreview([0.1, -0.2, 0.3]);
    expect(result).toBe("[0.100, -0.200, 0.300] (3차원)");
  });

  it("shows first 6 values with dimensions when length > 6", () => {
    const emb = [0.1, -0.2, 0.3, -0.4, 0.5, -0.6, 0.7, 0.8, 0.9, 1.0];
    const result = formatEmbeddingPreview(emb);
    expect(result).toMatch(/^\[0\.100, -0\.200, 0\.300, -0\.400, 0\.500, -0\.600, \.\.\. 10차원\]$/);
  });

  it("formats values to 3 decimal places", () => {
    const result = formatEmbeddingPreview([0.12345, -0.98765]);
    expect(result).toContain("0.123");
    expect(result).toContain("-0.988");
  });

  it("handles exactly 6 values", () => {
    const emb = [1, 2, 3, 4, 5, 6];
    const result = formatEmbeddingPreview(emb);
    expect(result).toBe("[1.000, 2.000, 3.000, 4.000, 5.000, 6.000] (6차원)");
  });

  it("handles single value", () => {
    expect(formatEmbeddingPreview([0.5])).toBe("[0.500] (1차원)");
  });
});

describe("dotProductExpression", () => {
  it("returns empty string for empty arrays", () => {
    expect(dotProductExpression([], [])).toBe("");
  });

  it("builds calculator-compatible expression with *", () => {
    const a = [0.1, -0.2, 0.3];
    const b = [-0.05, 0.15, -0.25];
    const result = dotProductExpression(a, b);
    expect(result).toBe("(0.1*-0.05)+(-0.2*0.15)+(0.3*-0.25)");
  });

  it("uses Math.min length when arrays differ", () => {
    const a = [1, 2, 3, 4];
    const b = [5, 6];
    const result = dotProductExpression(a, b);
    expect(result).toBe("(1*5)+(2*6)");
  });

  it("handles single-element arrays", () => {
    expect(dotProductExpression([0.5], [0.8])).toBe("(0.5*0.8)");
  });
});

describe("firstDotTerm", () => {
  it("returns em-dash when a is empty", () => {
    expect(firstDotTerm([], [1, 2, 3])).toBe("—");
  });

  it("returns em-dash when b is empty", () => {
    expect(firstDotTerm([1, 2, 3], [])).toBe("—");
  });

  it("formats first term with × symbol", () => {
    expect(firstDotTerm([0.023], [0.018])).toBe("(0.023×0.018)");
  });

  it("uses only first elements", () => {
    expect(firstDotTerm([0.123, 0.456], [0.789, 0.012])).toBe("(0.123×0.789)");
  });

  it("rounds to 3 decimal places", () => {
    expect(firstDotTerm([0.123456], [-0.987654])).toBe("(0.123×-0.988)");
  });
});

const mockResult: Recommendation = {
  id: 1,
  category_code: "TEST",
  category_name_ko: "테스트",
  category_name_zh: "测试",
  category_name_en: "Test",
  category_name: "테스트",
  translation_status: "completed",
  similarity_score: 0.873,
  query_embedding: [0.1, -0.2, 0.3],
  category_embedding: [0.15, -0.18, 0.28],
  per_language_scores: {
    ko: { similarity_score: 0.873, rank: 3 },
    en: { similarity_score: 0.821, rank: 5 },
    zh: { similarity_score: 0.795, rank: 8 },
  },
};

describe("CosineDetailDialog rendering", () => {
  it("renders 3 language columns", () => {
    render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        searchKeyword="search term"
        targetLanguage="ko"
      />
    );
    expect(screen.getByText("한국어")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("中文")).toBeTruthy();
    expect(screen.getByText("87.3%")).toBeTruthy();
    expect(screen.getByText("82.1%")).toBeTruthy();
    expect(screen.getByText("79.5%")).toBeTruthy();
    expect(screen.getByText("3위")).toBeTruthy();
    expect(screen.getByText("5위")).toBeTruthy();
    expect(screen.getByText("8위")).toBeTruthy();
  });

  it("highlights current language with ring", () => {
    const { container } = render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={mockResult}
        targetLanguage="ko"
      />
    );
    const ringElements = container.querySelectorAll(".ring-2");
    expect(ringElements.length).toBe(1);
  });

  it("hides language section when per_language_scores is null", () => {
    const resultWithoutScores = {
      ...mockResult,
      per_language_scores: null,
    };
    render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={resultWithoutScores}
      />
    );
    expect(screen.queryByText("언어별 유사도")).toBeNull();
  });

  it("renders nothing when result is null", () => {
    const { container } = render(
      <CosineDetailDialog
        open={true}
        onOpenChange={() => {}}
        result={null}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});
