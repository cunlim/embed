import { Suspense } from "react";
import { cookies } from "next/headers";
import { fetchCategoryLevels, getCategories, recommend } from "@/lib/api";
import { parseEmbedParams, type EmbedParamsReader } from "@/lib/embed-params";
import { EmbedPageInner } from "./embed-page-inner";
import type { Category, PaginationMeta, Recommendation } from "@/lib/api";

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
  const { keyword, searchText, searchLang } = parseEmbedParams(reader);

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;
  let serverDefaultFilter: string | null = null;

  if (token) {
    try {
      const ownCategoriesRes = await getCategories(token, 1, 1, "my");
      if (ownCategoriesRes.data.length > 0) {
        serverDefaultFilter = "my";
      }
    } catch {}
  }

  const cat1 = reader.get("cat1");
  const cat2 = reader.get("cat2");
  const cat3 = reader.get("cat3");

  const urlPage = parseInt(reader.get("page") ?? "1", 10);
  const page = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
  const urlPerPage = parseInt(reader.get("per_page") ?? "20", 10);
  const perPage = [10, 20, 50].includes(urlPerPage) ? urlPerPage : 20;

  // 계층별 옵션 prefetch
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
  } catch {}

  // 카테고리 목록 prefetch
  let serverCategories: Category[] = [];
  let serverMeta: PaginationMeta | null = null;
  try {
    const categoriesRes = await getCategories(token, page, perPage, serverDefaultFilter ?? undefined, keyword ?? undefined);
    serverCategories = categoriesRes.data;
    serverMeta = categoriesRes.meta;
  } catch {}

  // 유사도 검색 prefetch
  let serverSearchResults: Recommendation[] | null = null;
  let serverSearchMeta: PaginationMeta | null = null;
  if (searchText) {
    try {
      const searchRes = await recommend(searchText, searchLang, token, page, perPage, serverDefaultFilter ?? undefined, keyword ?? undefined);
      serverSearchResults = searchRes.data;
      serverSearchMeta = searchRes.meta;
    } catch {}
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
        serverHadToken={!!token}
        serverFilter={serverDefaultFilter}
        serverSearchResults={serverSearchResults}
        serverSearchMeta={serverSearchMeta}
        serverSearchText={searchText}
        serverSearchLang={searchLang}
      />
    </Suspense>
  );
}
