# Step 4: docs-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 디자인 시스템과 기존 페이지를 파악하라:

- `/docs/UI_GUIDE.md` (전체 — 특히 §3 컴포넌트, §4 레이아웃, §6.5 공통 패턴)
- `/docs/ARCHITECTURE.md` (특히 "API 문서 라우팅" — `/docs/` 경로)
- `/nextjs/CLAUDE.md`
- `/nextjs/AGENTS.md`
- `/nextjs/app/layout.tsx`
- `/nextjs/app/globals.css`
- `/nextjs/app/page.tsx` (디자인 패턴 참고)
- `/nextjs/components/` (기존 컴포넌트)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 디자인 시스템을 완전히 이해한 뒤 작업하라.

## 작업

**시작하기 전에 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하라.** 이는 CLAUDE.md와 UI_GUIDE.md에 명시된 필수 요구사항이다. 모든 UI 구현은 이 plugin의 가이드라인을 따라야 한다.

`/docs` 프로젝트 문서 페이지를 생성하라. 이 페이지는 `docs/` 디렉토리의 마크다운 문서를 웹에서 읽을 수 있도록 렌더링한다. MVP에서는 간단한 임시 구현으로 제공한다.

### 페이지 구성

1. **네비게이션 바** — 로고 + 테마 토글 (랜딩 페이지와 동일 패턴)
2. **문서 목록 사이드바** (데스크톱) 또는 **상단 드롭다운** (모바일):
   - `docs/` 디렉토리의 `.md` 파일 목록을 자동으로 표시
   - 파일명을 읽기 쉬운 제목으로 변환 (예: `PRD.md` → "제품 요구사항 (PRD)", `ADR.md` → "아키텍처 결정 기록 (ADR)")
   - 현재 선택된 문서 하이라이트
3. **문서 본문 영역**:
   - 선택된 마크다운 파일의 내용을 HTML로 렌더링
   - `react-markdown` 또는 `marked` 라이브러리 사용
   - 코드 블록은 syntax highlighting 없이 기본 스타일로 표시 (MVP)
   - 제목, 목록, 표, 인라인 코드 등 기본 마크다운 요소 지원
4. **문서 로딩 방식**:
   - 각 `.md` 파일을 정적 import (`import()`) 또는 fetch로 가져와 렌더링
   - 문서 파일이 많은 경우를 대비한 동적 로딩

### 상태 처리

- **로딩**: 문서 로딩 중 skeleton 표시
- **빈 상태**: 문서가 없을 경우 "문서가 없습니다" 메시지
- **에러**: 마크다운 파싱 실패 시 에러 메시지 + 원본 텍스트 표시

> **MVP 범위**: 이 step에서는 간단한 임시 구현을 목표로 한다. 복잡한 검색, 목차(TOC), syntax highlighting, 다크 모드별 코드 블록 스타일링 등은 MVP 범위가 아니다.

## 생성할 파일

- `nextjs/app/docs/page.tsx`
- `nextjs/app/docs/layout.tsx` (선택사항 — docs 섹션 전용 레이아웃)

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
3. Playwright로 `/docs` 페이지를 브라우저에서 확인한다.
4. 각 마크다운 문서가 올바르게 렌더링되는지 확인한다.
5. 라이트/다크 모드 모두 테스트한다.
6. 375px + 1280px 반응형을 확인한다.
7. 결과에 따라 `phases/frontend-embed/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 이모지를 사용하지 마라. lucide-react 아이콘만 사용하라.
- MVP 범위를 벗어난 복잡한 기능을 추가하지 마라 (검색, TOC, syntax highlighting 등).
- 기존 테스트를 깨뜨리지 마라
