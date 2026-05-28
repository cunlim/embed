import { describe, it, expect } from "vitest";
import { parseHierarchy } from "@/lib/category";
import type { Category } from "@/lib/api";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    user_id: 1,
    category_code: "50000001",
    category_name_ko: "대분류 > 중분류 > 소분류",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending" as const,
    ...overrides,
  };
}

describe("parseHierarchy", () => {
  it("3단계 카테고리명을 파싱한다", () => {
    const categories: Category[] = [
      makeCategory({
        id: 1,
        category_code: "50000001",
        category_name_ko: "패션의류 > 여성의류 > 원피스",
      }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: ["패션의류", "여성의류", "원피스"],
      categoryId: 1,
      categoryCode: "50000001",
    });
  });

  it("4단계 카테고리명을 파싱한다", () => {
    const categories: Category[] = [
      makeCategory({
        id: 1,
        category_code: "50000002",
        category_name_ko: "화장품/미용>헤어스타일링>파마약>웨이브",
      }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: ["화장품/미용", "헤어스타일링", "파마약", "웨이브"],
      categoryId: 1,
      categoryCode: "50000002",
    });
  });

  it("여러 카테고리를 모두 파싱한다", () => {
    const categories: Category[] = [
      makeCategory({ id: 1, category_code: "50000001", category_name_ko: "A > B > C" }),
      makeCategory({ id: 2, category_code: "50000002", category_name_ko: "D > E > F" }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(2);
  });

  it("1단계 카테고리명도 포함한다", () => {
    const categories: Category[] = [
      makeCategory({ id: 1, category_name_ko: "A > B" }),
      makeCategory({ id: 2, category_name_ko: "A" }),
    ];

    const result = parseHierarchy(categories);

    expect(result).toHaveLength(2);
  });

  it("공백이 포함된 카테고리명을 trim 처리한다", () => {
    const categories: Category[] = [
      makeCategory({ id: 1, category_name_ko: "  패션의류  >  여성의류  >  원피스  " }),
    ];

    const result = parseHierarchy(categories);

    expect(result[0]).toEqual({
      path: ["패션의류", "여성의류", "원피스"],
      categoryId: 1,
      categoryCode: "50000001",
    });
  });

  it("빈 배열은 빈 결과를 반환한다", () => {
    const result = parseHierarchy([]);
    expect(result).toHaveLength(0);
  });
});
