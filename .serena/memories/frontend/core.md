# Frontend Core — 프론트엔드 모듈

## 디렉토리 구조

```
nextjs/
├── app/
│   ├── page.tsx         — 메인 페이지
│   ├── layout.tsx       — 레이아웃
│   ├── globals.css      — 글로벌 스타일
│   ├── admin/           — 관리자 페이지
│   ├── docs/            — 문서 페이지
│   ├── login/           — 로그인 페이지
│   └── embed/           — 임베드 페이지
├── components/          — 공통 컴포넌트
├── hooks/               — 커스텀 훅
├── lib/
│   ├── api.ts           — API 클라이언트
│   ├── category.ts      — 카테고리 관련 유틸
│   ├── embed-params.ts  — 임베드 파라미터
│   └── utils.ts         — 유틸리티
├── lib/__tests__/       — 유틸/API 테스트
└── e2e/                 — Playwright E2E 테스트
```

## 디자인 시스템

- **shadcn/ui** `base-nova` 스타일
- 디자인 가이드: `docs/UI_GUIDE.md`
- 컴포넌트 추가: `docker exec cl_embed_nextjs npx shadcn@latest add <component>`

## 테스트

- **Vitest** + **React Testing Library** + **jsdom**
- `lib/__tests__/*.test.ts` — 순수 함수, API 클라이언트
- `hooks/__tests__/*.test.ts` — 커스텀 훅 (`renderHook` 사용)
- **TDD 적용**: 새 훅, 유틸리티 함수, API 클라이언트 추가 시 테스트 먼저 작성

## 알려진 이슈

자세한 내용은 `nextjs/AGENTS.md`의 "알려진 이슈" 섹션 참조.
