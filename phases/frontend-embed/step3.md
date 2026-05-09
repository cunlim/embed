# Step 3: admin-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 디자인 시스템과 기존 페이지를 파악하라:

- `/docs/UI_GUIDE.md` (전체 — 특히 §3 컴포넌트, §4 레이아웃, §6.4 공통 패턴)
- `/docs/ARCHITECTURE.md` (특히 "/admin" 라우트, "데이터베이스 주요 테이블")
- `/docs/PRD.md` (특히 §3.4: 개별 카테고리 추가)
- `/nextjs/CLAUDE.md`
- `/nextjs/AGENTS.md`
- `/nextjs/app/layout.tsx`
- `/nextjs/app/globals.css`
- `/nextjs/app/page.tsx` (디자인 패턴 참고)
- `/nextjs/components/` (기존 컴포넌트)
- `/nextjs/lib/api.ts` (이전 step에서 생성됨)
- `/nextjs/hooks/useAuth.ts` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 디자인 시스템을 완전히 이해한 뒤 작업하라.

## 작업

**시작하기 전에 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하라.** 이는 CLAUDE.md와 UI_GUIDE.md에 명시된 필수 요구사항이다. 모든 UI 구현은 이 plugin의 가이드라인을 따라야 한다.

`/admin` 관리자 페이지를 생성하라. 이 페이지는 로그인한 사용자만 접근할 수 있다.

### 페이지 구성

1. **네비게이션 바** — 로고 + 테마 토글 + 로그아웃 버튼 (랜딩 페이지와 동일 패턴)
2. **카테고리 목록 테이블**:
   - shadcn Table 컴포넌트 사용
   - 컬럼: category_code, category_name_ko, category_name_zh, category_name_en, 작업
   - 각 행에 "임베딩 재생성" 액션 버튼
   - 빈 상태: "등록된 카테고리가 없습니다"
3. **카테고리 추가 폼**:
   - 단일 텍스트 입력 (한국어 카테고리명)
   - "추가" 버튼 (Primary variant)
   - 성공 시 목록 새로고침
   - category_code 자동 생성 안내 텍스트 (예: "카테고리 코드는 자동 생성됩니다")
4. **일괄 번역 트리거**:
   - "전체 번역 실행" 버튼
   - 언어 선택 (중국어/영어) — 라디오 버튼 또는 단일 선택. 번역은 언어별로 직렬 실행되므로 한 번에 하나의 언어만 처리한다. 두 언어 모두 실행하려면 각각 개별 호출.
   - batch_id 표시 및 진행률 바 (useBatchProgress 훅 사용)
5. **상태 처리**:
   - **로딩**: 테이블 skeleton
   - **에러**: inline error + retry button
   - **빈 상태**: 아이콘 + 설명 + CTA

### 인증 가드

`useAuth()` 훅으로 인증 상태 확인. 비로그인 시 `/login`으로 리다이렉트.

### API 연동

```typescript
// GET /api/categories
// Response: { data: Category[] }

// POST /api/categories
// Request: { category_name_ko: string }
// Response: { data: Category }, 401 if not authed

// POST /api/categories/batch-translate
// Request: { target_language: string }  (단일 언어)
// Response: { batch_id: string }, 401 if not authed
```

## 생성할 파일

- `nextjs/app/admin/page.tsx`
- `nextjs/hooks/useCategories.ts`
- `nextjs/lib/api.ts` (수정 — 카테고리 API 함수 추가)

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
2. UI_GUIDE.md의 §8 구현 체크리스트를 확인한다.
3. Playwright로 `/admin` 페이지를 브라우저에서 확인한다.
4. 비로그인 상태에서 `/login`으로 리다이렉트되는지 확인한다.
5. 결과에 따라 `phases/frontend-embed/index.json`의 해당 step을 업데이트한다.

## 금지사항

- `/admin` 페이지에서 권한 체크를 skip하지 마라. `useAuth`로 반드시 인증 상태를 확인하라.
- 375px 모바일에서 테이블이 넘치지 않도록 반응형 처리를 하라. (모바일에서는 카드 레이아웃으로 전환)
- 기존 테스트를 깨뜨리지 마라
