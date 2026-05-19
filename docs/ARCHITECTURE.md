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

| 라우트 | 페이지 | 목적 | 인증 |
|--------|--------|------|------|
| `/` | 랜딩 페이지 | 프로젝트 소개, 검색어 입력 및 타겟 언어 선택, 추천 결과 기본 확인 | 불필요 |
| `/login` | 로그인 페이지 | 이메일/비밀번호 로그인 및 회원가입, OAuth (Google, GitHub, Naver) 소셜 로그인 | 불필요 |
| `/embed` | Embed 기술 시연 페이지 | 검색어 입력, 언어별 카테고리 추천, 코사인 유사도 상세 다이얼로그, 카테고리 CRUD, 계층 탐색, 일괄 번역, 개별 번역/임베딩 실행 (5단계 HTTP API), 페이지네이션 | **필수** (로그인 필수, 비로그인 시 `/login` 리다이렉트) |
| `/docs` | 프로젝트 문서 페이지 | `docs/` 디렉토리의 마크다운 문서를 웹으로 렌더링 | 불필요 |
| `/admin` | 관리자 전용 페이지 | `/embed`로 기능 이전 완료. 로그인 + role 확인 후 `/embed` 이동 안내 카드 표시 | **필수** (로그인 + role 확인, 비관리자는 이전 페이지로 리다이렉트) |

프론트엔드 디렉토리 구조 및 패키지 상세는 [`nextjs/CLAUDE.md`](../nextjs/CLAUDE.md) 참조.

## 주요 API 엔드포인트

전체 목록은 `/swagger/` 참조. 카테고리 CRUD(`GET/POST/DELETE /api/categories`), 번역/임베딩(`run-step`, `update-text`), 추천(`recommend`), 인증(`auth/*`).

## 데이터베이스

테이블/컬럼 상세는 `laravel/database/migrations/` 참조. 주요 테이블: `categories`, `category_embeddings` (VECTOR(1024)), `translation_caches`, `search_logs`, `users`.

## 데이터 흐름

### 개별 카테고리 처리 (Per-Category)
```
1. 클라이언트가 카테고리 행의 "실행" 버튼 클릭 → 프론트엔드에서 HTTP 루프 시작.
2. 5단계를 순차적으로 POST /api/categories/{id}/run-step 호출 (중복 방지 lock 키: "category-translate:{categoryId}"):
   단계1: zh 번역 → 단계2: en 번역 → 단계3: ko 임베딩 → 단계4: zh 임베딩 → 단계5: en 임베딩
3. 각 run-step 응답으로 단계별 상태(pending/running/completed/failed)를 즉시 수신.
4. 백엔드는 동기적으로 처리 후 결과 반환. 별도 큐/Job 사용하지 않음.
```
### 일괄 처리 (Batch)
```
1. 클라이언트에서 HTTP 루프로 카테고리 목록을 순회.
2. 각 카테고리별로 run-step을 5회 순차 호출하여 전체 파이프라인 실행.
3. 백엔드 Lock으로 동일 카테고리 중복 실행 방지.
```

## 동시성 제어

- **중복 실행 방지**: Redis `Cache::lock()`을 사용하여 동일 카테고리의 처리가 진행 중일 경우 중복 실행 방지.
  - Lock 키: `"category-translate:{categoryId}"`