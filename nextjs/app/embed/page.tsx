import { Suspense } from "react";
import { cookies } from "next/headers";
import { fetchCategoryLevels, getCategories } from "@/lib/api";
import { parseEmbedKeyword, type EmbedParamsReader } from "@/lib/embed-params";
import { EmbedPageInner } from "./embed-page-inner";
import type { Category, PaginationMeta } from "@/lib/api";

/** Server Component의 searchParams를 { get(key) => string | null }로 감싼다 */
function serverParamsReader(
  sp: Awaited<EmbedPageParams["searchParams"]>
): EmbedParamsReader {
  return {
    get(key: string): string | null {
      const v = sp[key];
      return typeof v === "string" ? v : null;
    },
  };
}

type EmbedPageParams = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function EmbedPage({ searchParams }: EmbedPageParams) {
  const sp = await searchParams;
  const reader = serverParamsReader(sp);

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;

  const cat1 = reader.get("cat1");
  const cat2 = reader.get("cat2");
  const cat3 = reader.get("cat3");

  // 대 옵션 항상 prefetch
  let 대Options: string[] = [];
  let 중Options: string[] = [];
  let 소Options: string[] = [];
  let 세Options: { 세: string; categoryId: number; categoryCode: string }[] = [];

  try {
    const 대Res = await fetchCategoryLevels(undefined, token);
    대Options = 대Res.data.대 ?? [];

    if (cat1) {
      const 중Res = await fetchCategoryLevels({ 대: cat1 }, token);
      중Options = 중Res.data.중 ?? [];
    }
    if (cat1 && cat2) {
      const 소Res = await fetchCategoryLevels({ 대: cat1, 중: cat2 }, token);
      소Options = 소Res.data.소 ?? [];
    }
    if (cat1 && cat2 && cat3) {
      const 세Res = await fetchCategoryLevels({ 대: cat1, 중: cat2, 소: cat3 }, token);
      세Options = 세Res.data.세 ?? [];
    }
  } catch {
    // prefetch 실패 시 클라이언트에서 빈 배열로 시작
  }

  // 카테고리 목록 prefetch
  let serverCategories: Category[] = [];
  let serverMeta: PaginationMeta | null = null;
  try {
    const keyword = parseEmbedKeyword(reader) ?? undefined;
    const categoriesRes = await getCategories(token, 1, 20, undefined, keyword);
    serverCategories = categoriesRes.data;
    serverMeta = categoriesRes.meta;
  } catch {
    // prefetch 실패 시 빈 배열로 시작
  }

  return (
    <Suspense>
      <EmbedPageInner
        server대Options={대Options}
        server중Options={중Options}
        server소Options={소Options}
        server세Options={세Options}
        serverCategories={serverCategories}
        serverMeta={serverMeta}
      />
    </Suspense>
  );
}
