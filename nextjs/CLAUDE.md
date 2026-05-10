# nextjs/CLAUDE.md

## AGENTS.md (필독)

이 프로젝트의 [`AGENTS.md`](./AGENTS.md)는 Next.js 16의 브레이킹 체인지에 대해 설명합니다.
코드 작성 전 반드시 `node_modules/next/dist/docs/`의 관련 가이드를 확인하세요.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템의 프론트엔드입니다.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui 기반.

## 컨테이너 정보

- **컨테이너명:** `cl_embed_nextjs`
- **내부 포트:** 3000
- WATCHPACK_POLLING 적용 (Docker 볼륨 핫리로드)

## 주요 패키지

- Next.js 16.2.4 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui

## 명령어

모든 명령어는 `cl_embed_nextjs` 컨테이너 대상으로 `docker exec`를 통해 실행합니다.

```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 프로덕션 빌드
docker exec cl_embed_nextjs npm run build

# ESLint
docker exec cl_embed_nextjs npm run lint
```

## 관련 문서

- 전체 아키텍처: [`/CLAUDE.md`](../CLAUDE.md)
- 제품 요구사항: [`docs/PRD.md`](../docs/PRD.md)
- 백엔드 가이드라인: [`laravel/CLAUDE.md`](../laravel/CLAUDE.md)
