import { Suspense } from "react";
import { cookies } from "next/headers";
import { fetchCategoryLevels, getCategories, getUser, fetchFolders, fetchUsers } from "@/lib/api";
import { parseEmbedParams, type EmbedParamsReader } from "@/lib/embed-params";
import { EmbedPageInner } from "./embed-page-inner";
import type { Category, PaginationMeta, User } from "@/lib/api";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "카테고리 관리",
};

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
  const { likeQuery, similarityQuery, translationLang, hierarchyLang, ownerScope: urlFilter, folder: urlFolder, userId: urlUserId } = parseEmbedParams(reader);

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

  const urlPage = Number.parseInt(reader.get("page_number") ?? "1", 10);
  const page = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
  const urlPerPage = Number.parseInt(reader.get("page_size") ?? "20", 10);
  const perPage = [10, 20, 50].includes(urlPerPage) ? urlPerPage : 20;

  // 계층별 옵션 prefetch (동적 깊이)
  const levelOptions: string[][] = [];
  let maxDepth = 1;
  const urlUserIdNum = urlUserId ? Number.parseInt(urlUserId, 10) : undefined;

  try {
    // 최상위 옵션 조회
    const topParams: Record<string, string> = {};
    if (hierarchyLang !== "ko") topParams["hierarchy_lang"] = hierarchyLang;
    if (urlFolder) topParams["folder"] = urlFolder;
    const topRes = await fetchCategoryLevels(Object.keys(topParams).length > 0 ? topParams : undefined, token, urlUserIdNum);
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
      if (hierarchyLang !== "ko") catParams["hierarchy_lang"] = hierarchyLang;
      for (let j = 0; j <= i; j++) {
        catParams[`cat${j + 1}`] = catPath[j];
      }
      if (urlFolder) catParams["folder"] = urlFolder;
      const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token, urlUserIdNum);
      levelOptions.push(res.data.options as string[]);
    }
  } catch {}

  // 카테고리 목록 prefetch
  let serverCategories: Category[] = [];
  let serverMeta: PaginationMeta | null = null;
  try {
    const categoriesRes = await getCategories(token, page, perPage, serverDefaultFilter ?? undefined, likeQuery ?? undefined, urlFolder ?? undefined, urlUserIdNum, undefined, hierarchyLang !== "ko" ? hierarchyLang : undefined);
    serverCategories = categoriesRes.data;
    serverMeta = categoriesRes.meta;
  } catch {}

  // 유사도 검색 prefetch (통합 API: getCategories에 similarity_query 파라미터 전달)
  let serverSearchResults: Category[] | null = null;
  let serverSearchMeta: PaginationMeta | null = null;
  let serverQueryEmbedding: number[] | null = null;
  if (similarityQuery) {
    try {
      const searchRes = await getCategories(token, page, perPage, serverDefaultFilter ?? undefined, likeQuery ?? undefined, urlFolder ?? undefined, urlUserIdNum, undefined, undefined, similarityQuery, translationLang);
      serverSearchResults = searchRes.data;
      serverSearchMeta = searchRes.meta;
      serverQueryEmbedding = searchRes.query_embedding ?? null;
    } catch {}
  }

  // 폴더 목록 prefetch (SSR)
  let serverFolders: string[] = [];
  let serverFolderGroups: import("@/lib/api").FolderGroup[] = [];
  if (token) {
    try {
      const foldersRes = await fetchFolders(token);
      serverFolders = foldersRes.data;
      serverFolderGroups = foldersRes.grouped ?? [];
    } catch {}
  }

  // 회원 목록 prefetch (관리자)
  let serverUsers: { id: number; name: string; email: string }[] = [];
  if (token && serverUser && (serverUser.role === "superadmin" || serverUser.role === "admin")) {
    try {
      const usersRes = await fetchUsers(token);
      serverUsers = usersRes.data;
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
        serverQueryEmbedding={serverQueryEmbedding}
        serverSearchText={similarityQuery}
        serverSearchLang={translationLang}
        serverHierarchyLang={hierarchyLang}
        serverFolder={urlFolder}
        serverFolders={serverFolders}
        serverFolderGroups={serverFolderGroups}
        serverUsers={serverUsers}
        serverUserId={urlUserId}
      />
    </Suspense>
  );
}
