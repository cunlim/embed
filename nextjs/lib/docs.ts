export interface DocEntry {
  slug: string;
  title: string;
  description: string;
}

export const docList: DocEntry[] = [
  { slug: "USER_GUIDE", title: "사용자 가이드", description: "시스템 사용 방법 및 웹 인터페이스" },
  { slug: "API_V1", title: "API 연동 가이드", description: "REST API 호출 방법 및 파라미터 상세" },
  { slug: "SIMILARITY_SEARCH", title: "유사도 검색 원리", description: "AI 임베딩 및 코사인 유사도 검색" },
  { slug: "RESUME", title: "이력서", description: "포트폴리오 및 경력 사항" },
];
