import { Suspense } from "react";
import { cookies } from "next/headers";
import { fetchCategoryLevels, getCategories, recommend, getUser } from "@/lib/api";
import { parseEmbedParams, type EmbedParamsReader } from "@/lib/embed-params";
import { EmbedPageInner } from "./embed-page-inner";
import type { Category, PaginationMeta, Recommendation, User } from "@/lib/api";

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
  const { keyword, searchText, searchLang, filter: urlFilter } = parseEmbedParams(reader);

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;

  // CSR hydration 전 깜빡임 방지: SSR에서 사용자 정보 prefetch
  let serverUser: User | null = null;
  if (token) {
    try {
      serverUser = await getUser(token);
    } catch {}
  }

  let serverDefaultFilter: string | null = urlFilter ?? null;

  // URL에 filter 파라미터가 없으면 기본값으로 "my" 설정 (사용자 소유 카테고리가 있는 경우)
  if (!serverDefaultFilter && token) {
    try {
      const ownCategoriesRes = await getCategories(token, 1, 1, "my");
      if (ownCategoriesRes.data.length > 0) {
        serverDefaultFilter = "my";
      }
    } catch {}
  }

  const urlPage = parseInt(reader.get("page") ?? "1", 10);
  const page = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
  const urlPerPage = parseInt(reader.get("per_page") ?? "20", 10);
  const perPage = [10, 20, 50].includes(urlPerPage) ? urlPerPage : 20;

  // 계층별 옵션 prefetch (동적 깊이)
  const levelOptions: string[][] = [];
  let maxDepth = 1;

  try {
    // 최상위 옵션 조회
    const topRes = await fetchCategoryLevels(undefined, token);
    levelOptions.push(topRes.data.options as string[]);
    maxDepth = topRes.data.maxDepth;

    // URL cat 파라미터가 있으면 각 depth에 대해 다음 옵션 조회
    const catPath: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const val = reader.get(`cat${i}`);
      if (val) {
        catPath.push(val);
      } else {
        break;
      }
    }

    for (let i = 0; i < catPath.length && i < maxDepth - 1; i++) {
      const catParams: Record<string, string> = {};
      for (let j = 0; j <= i; j++) {
        catParams[`cat${j + 1}`] = catPath[j];
      }
      const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token);
      levelOptions.push(res.data.options as string[]);
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
        serverLevelOptions={levelOptions}
        serverMaxDepth={maxDepth}
        serverCategories={serverCategories}
        serverMeta={serverMeta}
        serverHadToken={!!token}
        serverFilter={serverDefaultFilter}
        serverUser={serverUser}
        serverSearchResults={serverSearchResults}
        serverSearchMeta={serverSearchMeta}
        serverSearchText={searchText}
        serverSearchLang={searchLang}
      />
    </Suspense>
  );
}
