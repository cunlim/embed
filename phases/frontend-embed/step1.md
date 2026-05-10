# Step 1: embed-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 디자인 시스템과 기존 페이지를 파악하라:

- `/docs/UI_GUIDE.md` (전체 — 특히 §3 컴포넌트, §4 레이아웃, §5 애니메이션, §6.3)
- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름", "/embed" 라우트)
- `/nextjs/CLAUDE.md`
- `/nextjs/AGENTS.md`
- `/nextjs/app/layout.tsx`
- `/nextjs/app/globals.css`
- `/nextjs/app/page.tsx` (기존 랜딩 페이지 — 디자인 패턴 참고)
- `/nextjs/components/theme-toggle.tsx`
- `/nextjs/components/theme-provider.tsx`
- `/nextjs/components/ui/` (사용 가능한 shadcn/ui 컴포넌트 목록)
- `/nextjs/hooks/useBatchProgress.ts` (이전 step에서 생성됨)
- `/nextjs/lib/echo.ts` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 디자인 시스템을 완전히 이해한 뒤 작업하라.

## 작업

**시작하기 전에 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하라.** 이는 CLAUDE.md와 UI_GUIDE.md에 명시된 필수 요구사항이다. 모든 UI 구현은 이 plugin의 가이드라인을 따라야 한다.

`/embed` 기술 시연 페이지를 생성하라 (UI_GUIDE.md §6.3 참조).

### 페이지 구성

1. **네비게이션 바** — 로고 + 테마 토글 (랜딩 페이지와 동일 패턴)
2. **검색 입력 영역**:
   - 큰 라운드 입력창 (`rounded-full`, `h-12` 이상)
   - 언어 선택 (ko/zh/en) — 탭 또는 라디오 버튼
   - "분석" CTA 버튼
3. **추천 결과 영역**:
   - 결과 카드 리스트 (각 카드: 카테고리 코드, 카테고리명, 유사도 점수)
   - 유사도 점수는 `text-accent font-mono text-lg`로 하이라이트
   - 각 결과 카드에서 **코사인 유사도 상세** 정보 표시 (ARCHITECTURE.md: "코사인 유사도 상세" 요구사항)
   - 키워드 매칭 부분 `font-semibold text-accent` 처리
4. **계층형 Select Box** (ARCHITECTURE.md: "계층형 Select Box"):
   - 네이버 카테고리 "대>중>소" 계층을 순서대로 선택할 수 있는 Select Box
   - 첫 번째 Select Box에서 "대" 카테고리 선택 → 두 번째 Select Box에 해당 "중" 카테고리 목록 표시 → 세 번째에 "소" 카테고리 표시
   - DB의 `category_name_ko` 컬럼값을 `>` 구분자로 분할하여 계층 구조 구성
5. **벡터 과정 모달** (ARCHITECTURE.md, PRD §3.2):
   - shadcn Dialog 컴포넌트 사용
   - 검색어 → 정규화 → 임베딩 생성 → pgvector 유사도 검색 → 결과 매핑의 각 단계를 시각적으로 표시
   - 결과 카드 클릭 또는 "상세 보기" 버튼으로 열기
6. **상태 처리**:
   - **로딩**: skeleton 또는 pulse 애니메이션
   - **빈 상태**: `flex flex-col items-center gap-2 py-12` + 아이콘 + 메시지
   - **에러**: 빨간색 경고 + 재시도 버튼
   - **결과 없음**: 아이콘 + "일치하는 카테고리가 없습니다" + 설명
7. **일괄 번역 진행률**:
   - `useBatchProgress` 훅 사용
   - 진행률 바 (shadcn Progress 컴포넌트)
   - 완료/실패 카운트 표시
   - 여러 언어를 처리하려면 언어별로 각각 `POST /api/categories/batch-translate`를 호출한다. 하나의 호출은 하나의 언어만 처리.

### API 연동

```typescript
// POST /api/recommend
// Request: { text: string, target_language: string }
// Response: { recommendations: Array<{ category_code, category_name, similarity_score }> }

// POST /api/categories/batch-translate
// 언어별 직렬 처리. 여러 언어 필요 시 언어별로 각각 호출
// Request: { target_language: string }  (단일 언어: "zh" | "en")
// Response: { batch_id: string }
```

`nextjs/lib/api.ts`에서 API 클라이언트 함수를 정의하라. base URL은 환경변수 `NEXT_PUBLIC_API_URL`로 관리.

### useRecommend 훅 (`nextjs/hooks/useRecommend.ts`)

추천 API를 호출하고 상태를 관리하는 커스텀 훅:
```typescript
interface UseRecommendReturn {
  recommend: (text: string, targetLanguage: string) => Promise<void>;
  results: Recommendation[];
  isLoading: boolean;
  error: string | null;
}
```

## 생성할 파일

- `nextjs/app/embed/page.tsx`
- `nextjs/lib/api.ts`
- `nextjs/hooks/useRecommend.ts`
- `nextjs/.env.local` (수정 — API URL 추가)

## Acceptance Criteria

```bash
# 타입 검사
docker exec cl_embed_nextjs npx tsc --noEmit

# 빌드
docker exec cl_embed_nextjs npm run build

# eslint
docker exec cl_embed_nextjs npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. UI_GUIDE.md의 §8 구현 체크리스트를 모두 확인한다.
3. Playwright로 `/embed` 페이지를 브라우저에서 확인한다.
4. 라이트/다크 모드 모두 테스트한다.
5. 375px + 1280px 반응형을 확인한다.
6. 결과에 따라 `phases/frontend-embed/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 색상을 raw hex로 직접 사용하지 마라. CSS 변수만 사용하라.
- 이모지를 사용하지 마라. lucide-react 아이콘만 사용하라.
- `"use client"` 지시문을 잊지 마라. 이 페이지는 인터랙티브 요소가 많다.
- API base URL을 하드코딩하지 마라. 환경변수 `NEXT_PUBLIC_API_URL`을 사용하라.
- 기존 랜딩 페이지 스타일과 일관성을 유지하라. 다른 디자인 언어를 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라
