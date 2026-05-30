# Frontend Core — 프론트엔드 모듈

> 상세 내용은 `nextjs/AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## 디자인 시스템

- **shadcn/ui** `base-nova` 스타일. 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`
- **CSS 변수 text 색상**: `text-foreground`는 light(검정)/dark(white) 자동 적응. `text-accent`는 양쪽 모두 어두운 색상(0.45)이므로 text에 부적합, 배경(`bg-accent/10`, `bg-accent/20`)으로만 사용.
- **선택 상태 스타일 계층**: unselected(`text-muted-foreground`) → hover(`text-foreground`) → selected(`text-foreground font-semibold`). 배경은 `bg-accent/10` → `bg-accent/20`.

## 테스트

- **Vitest** + **React Testing Library** + **jsdom**
- **TDD 적용**: 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트 먼저 작성
- `vitest` 바이너리 직접 실행 금지 — `--no-bin-links`로 `node_modules/.bin/vitest` 미생성. `npm test` 사용.
- `vitest run` 전체 실행 타임아웃 — Docker 내 hang 가능. 개별 파일별 실행.

## 알려진 이슈

- CSS 트랜지션 사이드바: `h-0 overflow-hidden` + `whitespace-nowrap overflow-hidden` 패턴 사용
- shadcn Sheet: `showCloseButton={false}` 커스텀 닫기 버튼 사용 시 필수
- 폼 버튼 순서: Input → 초기화(X) → 검색(Search)
- `router.replace` + `<Link>` 동일 URL 충돌 — `window.history.replaceState()` 사용
