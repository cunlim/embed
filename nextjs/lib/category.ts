import type { Category } from "@/lib/api";

export interface HierarchyLevel {
  대: string;
  중: string;
  소: string;
  categoryId: number;
  categoryCode: string;
}

export function parseHierarchy(categories: Category[]): HierarchyLevel[] {
  return categories
    .map((cat) => {
      const parts = cat.category_name_ko.split(">");
      if (parts.length >= 3) {
        return {
          대: parts[0].trim(),
          중: parts[1].trim(),
          소: parts[2].trim(),
          categoryId: cat.id,
          categoryCode: cat.category_code,
        };
      }
      return null;
    })
    .filter((h): h is HierarchyLevel => h !== null);
}
