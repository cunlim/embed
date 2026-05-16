# Step 3: admin 페이지 카테고리별 "번역 실행" 버튼 + 프로그레스 패널

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — **6.4절 (admin 페이지)와 6.4.1절 (카테고리별 개별 번역·임베딩 실행) 전체를 반드시 정독하라**
- `/docs/ARCHITECTURE.md` — "개별 카테고리 처리 (Per-Category)" 데이터 흐름
- `/nextjs/CLAUDE.md` — 프론트엔드 코드 컨벤션, shadcn/ui, 디자인 시스템
- `/nextjs/AGENTS.md` — Next.js 16 브레이킹 체인지
- `/nextjs/app/admin/page.tsx` — 현재 admin 페이지 전체
- `/nextjs/hooks/useCategories.ts` — 기존 카테고리 훅
- `/nextjs/hooks/useCategoryProgress.ts` — Step 2에서 생성된 훅
- `/nextjs/hooks/useAuth.ts` — 인증 훅

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`nextjs/app/admin/page.tsx`를 수정하여 카테고리 테이블 행마다 "번역 실행" 버튼과 인라인 프로그레스 패널을 추가한다.

### 1. 테이블 컬럼 확장

기존 4개 컬럼(코드, 한국어, 중국어, 영어)에 **5번째 "작업" 컬럼**을 추가한다. 이 컬럼에는 "번역 실행" 버튼이 위치한다.

### 2. "번역 실행" 버튼

UI_GUIDE.md 6.4.1절 명세를 따라 구현:

```
variant="ghost", size="icon"
```

**버튼 상태 (UI_GUIDE.md 명세 준수):**

| 상태 | 조건 | 아이콘 | 동작 |
|------|------|--------|------|
| 진행 가능 | `useCategoryProgress`의 해당 카테고리 `isRunning`이 false | `Play` (lucide-react) | 클릭 시 `startTranslation(category.id, token)` 호출 |
| 진행 중 | `useCategoryProgress`의 해당 카테고리 `isRunning`이 true | `Loader2` + `animate-spin` | disabled |

툴팁: `title` 속성으로 "번역 실행" / "번역 재실행" 표시 (Shadcn Tooltip 사용 시 `@/components/ui/tooltip`).

### 3. 인라인 프로그레스 패널

버튼 클릭 후 해당 카테고리 행이 확장되어 **5단계 진행 상황**을 인라인으로 표시한다.

테이블 행 아래에 삽입되는 패널 구조:
- 각 단계를 한 줄로 표시: `[아이콘] 단계명 — 상태`
- UI_GUIDE.md 명세에 따른 아이콘:
  - `pending` → 회색 `Circle` (lucide-react)
  - `running` → `Loader2` + `animate-spin`
  - `completed` → 초록색 `CheckCircle2`
  - `failed` → 빨간색 `XCircle` + 에러 메시지 + "재시도" 버튼
- 5단계 모두 `completed` → 2초 후 자동으로 패널이 닫힌다 (또는 "닫기" 버튼)

**구현 방식 제안:**
- 각 카테고리마다 `useCategoryProgress` 훅 인스턴스가 필요하다. 여러 카테고리의 진행 상태를 관리하기 위해 `useCategoryProgress`를 확장하거나, 상위에서 `Map<number, CategoryProgress>`로 관리한다.
- `useCategoryProgress` 훅이 단일 카테고리만 관리한다면, 각 행의 버튼/패널을 별도 클라이언트 컴포넌트로 분리하여 훅을 인스턴스화하라.

### 4. 상태 관리 설계

`page.tsx` 상단에 `"use client"`가 이미 있다. 행별 프로그레스 상태를 관리하는 방법:

**권장 방식 — 행 컴포넌트 분리:**
```tsx
// page.tsx 내부 또는 별도 파일
function CategoryRow({ category, token }: { category: Category; token: string | null }) {
  const { progress, isRunning, startTranslation, reset } = useCategoryProgress();
  // 버튼 + 패널 렌더링
}
```

테이블 body에서 `categories.map(cat => <CategoryRow key={cat.id} category={cat} token={token} />)` 로 사용.

### 5. 모바일 카드 레이아웃

데스크톱 테이블뿐 아니라 **모바일 카드 레이아웃**에도 동일한 버튼과 프로그레스 패널을 적용한다. 기존 `block md:hidden` 카드에 "작업" 영역을 추가한다.

### 6. 디자인 시스템 준수

- **색상**: CSS 변수만 사용 (oklch), raw hex 금지
- **아이콘**: lucide-react만 사용, 이모지 금지
- **호버 효과**: `duration-200`
- **다크 모드**: light/dark 모두 확인 (컴포넌트 구조가 동일하면 CSS 변수로 자동 대응)
- **버튼 호버**: `hover:bg-muted hover:text-foreground transition-all duration-200` 사용. `hover:bg-accent/5`는 사용 금지 (light 모드에서 텍스트 invisible)
- **애니메이션**: transform/opacity만 사용. `prefers-reduced-motion` 대응은 Tailwind `motion-reduce:` 유틸리티 사용

### 7. 기존 기능 보존

- "일괄 번역" 버튼과 진행률 바는 그대로 유지
- 인증 가드 (`useAuth` + `isAdmin`)는 그대로 유지
- `useCategories` 연동은 그대로 유지
- 관리자 ID 확인은 `isAdmin(userId)` (`@/lib/utils`) 사용

### 8. 테스트 작성

`nextjs/app/admin/__tests__/page.test.tsx` (또는 기존 admin 테스트가 있으면 수정):
- 카테고리 행에 "번역 실행" 버튼 렌더링 검증
- 버튼 클릭 시 `startTranslation` 호출 검증
- 로딩 중 버튼 disabled 검증
- 프로그레스 패널 표시 검증

## Acceptance Criteria

```bash
# 프론트엔드 빌드 (타입 체크 포함)
docker exec cl_embed_nextjs npm run build

# 프론트엔드 테스트
docker exec cl_embed_nextjs npm test

# ESLint
docker exec cl_embed_nextjs npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. **build 성공**, **test 0 failure**, **lint 0 error**여야 한다.
2. UI_GUIDE.md 6.4.1절 체크리스트:
   - [ ] 카테고리 행에 Play 아이콘 버튼이 있는가?
   - [ ] 진행 중일 때 `animate-spin` Loader2 아이콘으로 교체되는가?
   - [ ] 5단계 각각의 상태가 아이콘으로 표시되는가? (체크/스피너/회색점/X)
   - [ ] 완료 시 2초 후 자동으로 닫히는가? (또는 닫기 버튼이 있는가?)
   - [ ] 실패 단계에 빨간색 X + 재시도 버튼이 있는가?
   - [ ] 모바일 카드 레이아웃에도 동일하게 적용되는가?
3. Playwright로 시각적 검증이 필요하면 `mcp__plugin_playwright_playwright__browser_navigate`로 `https://embed.cunlim.dev/admin` 접속하여 확인한다. (Sanctum 토큰 주입 필요 — CLAUDE.md "Playwright 인증 페이지 테스트" 참고)
4. 결과에 따라 `phases/category-translate-embed/index.json`의 step 3을 업데이트한다.

## 금지사항

- raw hex 색상 코드를 사용하지 마라. CSS 변수만 사용.
- 이모지를 아이콘으로 사용하지 마라. lucide-react만 사용.
- `hover:bg-accent/5`를 사용하지 마라 (light 모드 텍스트 invisible 이슈).
- 기존 일괄 번역 기능을 제거하거나 훼손하지 마라.
- 기존 테스트를 깨뜨리지 마라
- `useEffect` 내 동기적 `setState` 호출 금지. `react-hooks/set-state-in-effect` 위반이다.
