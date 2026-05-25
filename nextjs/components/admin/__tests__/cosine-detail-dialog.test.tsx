import { describe, it, expect } from "vitest";
import {
  formatEmbeddingPreview,
  dotProductExpression,
  firstDotTerm,
  numpyExpression,
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

describe("numpyExpression", () => {
  it("generates valid numpy code with imports", () => {
    const result = numpyExpression([0.1, -0.2], [0.3, -0.4]);
    expect(result).toContain("import numpy as np");
    expect(result).toContain("A = np.array([0.1,-0.2])");
    expect(result).toContain("B = np.array([0.3,-0.4])");
    expect(result).toContain("print(np.dot(A, B) / (np.linalg.norm(A) * np.linalg.norm(B)))");
  });

  it("handles empty arrays", () => {
    const result = numpyExpression([], []);
    expect(result).toContain("A = np.array([])");
    expect(result).toContain("B = np.array([])");
  });

  it("handles single-element arrays", () => {
    const result = numpyExpression([0.5], [0.8]);
    expect(result).toContain("A = np.array([0.5])");
    expect(result).toContain("B = np.array([0.8])");
  });
});
