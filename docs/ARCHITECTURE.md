# 아키텍처

## 인프라 (멀티 컨테이너)

`docker-compose.yml` 기준 5개 컨테이너: Next.js, Laravel, Swagger UI, PostgreSQL 15+ (pgvector), Redis. 컨테이너명/포트는 `docker/docker-compose.yml` 참조.

- 도메인: `https://embed.cunlim.dev` (cloudflared tunnel)
- **Nginx 로그**: `docker/nginx/volume/log/` — 경로별 분리
- **Laravel 로그**: `laravel/logs/` — `serve.log`, `queue.log`

## 패턴
* **리버스 프록시 트래픽 라우팅 (Nginx)**:
  - `/` ➔ Next.js (프론트엔드 라우팅)
  - `/api/` ➔ Laravel FPM (메인 API 데이터 제공)
* **Server Components 기본**: Next.js App Router 환경에서 실시간 인터랙션(모달, 폼)이 필요한 구간만 Client Component 채택.
* **API 문서 라우팅**:
  - `/docs/` ➔ Next.js 프론트엔드에서 제공하는 프로젝트 개발 문서 페이지. `docs/` 디렉토리의 마크다운 문서를 웹으로 렌더링한다. Swagger UI와는 무관. MVP에서는 간단한 임시 구현으로 제공한다.
  - `/swagger/` ➔ Swagger UI 페이지 (독립 Docker 컨테이너 `cl_embed_swagger`, `swaggerapi/swagger-ui`). Nginx가 `/swagger/`를 Swagger UI 컨테이너로 프록시. 초기화 완료. Laravel API의 OpenAPI 스펙을 확인할 수 있다.
  - `/api/documentation` ➔ L5-Swagger가 생성하는 Laravel API의 OpenAPI JSON 엔드포인트. Swagger UI 컨테이너가 이 URL에서 JSON을 가져온다.

## 페이지 구성 (Next.js 5개 페이지)

페이지별 인증 요건과 상세는 `CLAUDE.md` "기술 스택" 및 `nextjs/CLAUDE.md` 참조.

## API 엔드포인트

전체 목록은 `/swagger/` 참조. 쓰기 작업(run-step, update-text, store, destroy)은 `auth:sanctum` 보호.

## 데이터베이스

테이블/컬럼 상세는 `laravel/database/migrations/` 참조.

## 데이터 흐름

번역/임베딩 파이프라인의 상세는 `PRD.md` §2 참조.

## 동시성 제어

Redis `Cache::lock()`으로 동일 카테고리 중복 실행 방지. Lock 키: `"category-translate:{categoryId}"`.