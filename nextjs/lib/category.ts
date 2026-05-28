import type { Category } from "@/lib/api";

/**
 * 카테고리 경로를 '>' 기준으로 분리하여 배열로 반환한다.
 * 예: "A>B>C" → ["A", "B", "C"]
 */
export function parseCategoryPath(categoryNameKo: string): string[] {
  return categoryNameKo.split(">").map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * 카테고리 배열에서 각 카테고리의 깊이 경로를 파싱한다.
 */
export function parseHierarchy(categories: Category[]): { path: string[]; categoryId: number; categoryCode: string }[] {
  return categories
    .map((cat) => {
      const path = parseCategoryPath(cat.category_name_ko);
      if (path.length >= 1) {
        return {
          path,
          categoryId: cat.id,
          categoryCode: cat.category_code,
        };
      }
      return null;
    })
    .filter((h): h is { path: string[]; categoryId: number; categoryCode: string } => h !== null);
}
