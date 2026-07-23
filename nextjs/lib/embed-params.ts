/**
 * SSR/CSR 공용 URL 파라미터 추출 유틸리티.
 * Server Component의 searchParams와 Client Component의 useSearchParams() 모두
 * { get(key) => string | null } 인터페이스로 추상화하여 동일 로직을 공유한다.
 */

export interface EmbedParamsReader {
  get(key: string): string | null;
}

export interface EmbedParams {
  searchMode: "hierarchy" | "search";
  /** hierarchy 키워드 ("A>B>C") 또는 검색 키워드 (like_query) */
  likeQuery: string | null;
  /** 전체/내카테고리 필터 */
  ownerScope: string | undefined;
  /** 유사도 검색어 */
  similarityQuery: string | null;
  /** 유사도 검색 언어 (기본 ko) */
  translationLang: string;
  /** 분류선택 계층 언어 (기본 ko) */
  hierarchyLang: string;
  /** URL에서 파싱된 계층 경로 배열 */
  catPath: string[];
  /** 폴더 필터 */
  folder: string | null;
  /** URL에서 전달된 사용자 ID (폴더 소유자 지정) */
  userId: string | null;
}

export function parseEmbedParams(params: EmbedParamsReader): EmbedParams {
  const modeParam = params.get("search_mode");
  const searchMode = modeParam === "hierarchy" || modeParam === "search" ? modeParam : "hierarchy";

  // catN 파라미터 동적 파싱
  const catPath: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const val = params.get(`cat${i}`);
    if (val) {
      catPath.push(val);
    } else {
      break;
    }
  }

  let likeQuery: string | null = null;
  if (catPath.length > 0) {
    likeQuery = catPath.join(">");
  } else {
    likeQuery = params.get("like_query") || null;
  }

  const scopeParam = params.get("owner_scope");
  const ownerScope = scopeParam === "my" || scopeParam === "all" ? scopeParam : undefined;

  const similarityQuery = params.get("similarity_query") || null;
  const translationLangParam = params.get("translation_lang");
  const translationLang = translationLangParam === "en" || translationLangParam === "zh" ? translationLangParam : "ko";

  const langParam = params.get("hierarchy_lang");
  const hierarchyLang = langParam === "en" || langParam === "zh" ? langParam : "ko";

  const folder = params.get("folder") || null;
  const userId = params.get("user_id") || null;

  return { searchMode, likeQuery, ownerScope, similarityQuery, translationLang, hierarchyLang, catPath, folder, userId };
}
