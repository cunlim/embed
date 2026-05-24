/**
 * SSR/CSR 공용 URL 파라미터 추출 유틸리티.
 * Server Component의 searchParams와 Client Component의 useSearchParams() 모두
 * { get(key) => string | null } 인터페이스로 추상화하여 동일 로직을 공유한다.
 */

export interface EmbedParamsReader {
  get(key: string): string | null;
}

/**
 * URL 파라미터에서 필터 키워드를 추출.
 * hierarchy 모드: cat1~cat4를 ">"로 연결 (예: "의류>여성의류>원피스")
 * search 모드: q 값을 그대로 사용
 */
export function parseEmbedKeyword(params: EmbedParamsReader): string | null {
  const cat1 = params.get("cat1");
  if (cat1) {
    const parts = [cat1];
    const cat2 = params.get("cat2");
    if (cat2) parts.push(cat2);
    const cat3 = params.get("cat3");
    if (cat3) parts.push(cat3);
    const cat4 = params.get("cat4");
    if (cat4) parts.push(cat4);
    return parts.join(">");
  }
  const q = params.get("q");
  return q || null;
}
