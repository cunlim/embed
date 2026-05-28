/**
 * SSR/CSR 공용 URL 파라미터 추출 유틸리티.
 * Server Component의 searchParams와 Client Component의 useSearchParams() 모두
 * { get(key) => string | null } 인터페이스로 추상화하여 동일 로직을 공유한다.
 */

export interface EmbedParamsReader {
  get(key: string): string | null;
}

export interface EmbedParams {
  mode: "hierarchy" | "search";
  /** hierarchy 키워드 ("A>B>C") 또는 검색 키워드 (q) */
  keyword: string | null;
  /** 전체/내카테고리 필터 */
  filter: string | undefined;
  /** 유사도 검색어 */
  searchText: string | null;
  /** 유사도 검색 언어 (기본 ko) */
  searchLang: string;
  /** URL에서 파싱된 계층 경로 배열 */
  catPath: string[];
}

export function parseEmbedParams(params: EmbedParamsReader): EmbedParams {
  const modeParam = params.get("mode");
  const mode = modeParam === "hierarchy" || modeParam === "search" ? modeParam : "hierarchy";

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

  let keyword: string | null = null;
  if (catPath.length > 0) {
    keyword = catPath.join(">");
  } else {
    keyword = params.get("q") || null;
  }

  const filterParam = params.get("filter");
  const filter = filterParam === "my" ? "my" : undefined;

  const searchText = params.get("stext") || null;
  const slang = params.get("slang");
  const searchLang = slang === "en" || slang === "zh" ? slang : "ko";

  return { mode, keyword, filter, searchText, searchLang, catPath };
}

/**
 * @deprecated parseEmbedParams().keyword를 대신 사용하세요.
 */
export function parseEmbedKeyword(params: EmbedParamsReader): string | null {
  return parseEmbedParams(params).keyword;
}
