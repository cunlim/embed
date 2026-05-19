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
| `/login` | 로그인 페이지 [계획] | 이메일/비밀번호 로그인, OAuth (Google, GitHub, Naver) 소셜 로그인, 회원가입 | 불필요 |
| `/embed` | Embed 기술 시연 페이지 | 검색어 입력, 언어별 카테고리 추천, 코사인 유사도 상세 다이얼로그, 카테고리 CRUD, 계층 탐색, 일괄 번역, 개별 번역/임베딩 실행 (5단계 HTTP API), 페이지네이션 | **필수** (로그인 필수, 비로그인 시 `/login` 리다이렉트) |
| `/docs` | 프로젝트 문서 페이지 [계획] | `docs/` 디렉토리의 마크다운 문서를 웹으로 렌더링 | 불필요 |
| `/admin` | 관리자 전용 페이지 | `/embed`로 기능 이전 완료. 로그인 + 관리자 확인 후 `/embed` 이동 안내 카드 표시 | **필수** (로그인 + 관리자 ID 확인, 비관리자는 이전 페이지로 리다이렉트) |

프론트엔드 디렉토리 구조 및 패키지 상세는 [`nextjs/CLAUDE.md`](../nextjs/CLAUDE.md) 참조.

## 주요 API 엔드포인트

전체 목록은 `/swagger/` 참조. 아래는 아키텍처상 주요 엔드포인트:

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/api/recommend` | 텍스트 기반 카테고리 추천 (페이지네이션: `page`, `per_page`) |
| GET | `/api/categories` | 카테고리 목록 (페이지네이션: `page`, `per_page`, 검색: `search`) |
| POST | `/api/categories` | 카테고리 추가 (`category_name_ko`, `category_code` optional) |
| GET | `/api/categories/{id}/translations` | 카테고리별 번역/임베딩 상태 조회 |
| POST | `/api/categories/{id}/translate-embed` | 카테고리별 번역→임베딩 5단계 파이프라인 실행 |
| POST | `/api/categories/{id}/cancel-translate-embed` | 실행 중인 카테고리 파이프라인 취소 |
| GET | `/api/auth/user` | 현재 로그인 사용자 정보 |
| POST | `/api/auth/login` / `/api/auth/register` | 이메일 인증 |

## 데이터베이스

테이블/컬럼 상세는 `laravel/database/migrations/` 참조. 주요 테이블: `categories`, `category_embeddings` (VECTOR(1024)), `translation_caches`, `search_logs`, `users`.

## 데이터 흐름

### 개별 카테고리 처리 (Per-Category)
```
1. 클라이언트가 카테고리 행의 "실행" 버튼 클릭 → POST /api/categories/{id}/translate-embed → Laravel
2. 백엔드는 카테고리 ID 수신 → 202 Accepted + {batch_id: "uuid"} 즉시 응답.
3. 단일 카테고리에 대해 5단계 직렬 HTTP 실행 (중복 방지 lock 키: "category-translate:{categoryId}"):
   단계1: zh 번역 → 단계2: en 번역 → 단계3: ko 임베딩 → 단계4: zh 임베딩 → 단계5: en 임베딩
4. 각 단계 완료 후 runStep API 호출하여 단계별 상태 갱신.
5. 클라이언트는 폴링 또는 단계별 HTTP 응답으로 진행 상태를 확인.
```
### 일괄 처리 (Batch)
```
1. 클라이언트 트리거 → POST /api/categories/batch-translate → Laravel
2. 백엔드는 중복 실행 방지(Redis Cache::lock) 검증 후 HTTP 루프로 순차 처리.
3. 각 카테고리별 5단계 파이프라인을 HTTP API로 실행.
```

## 캐시 및 동시성 제어

- **중복 실행 방지**: Redis `Cache::lock()`을 사용하여 동일 언어/모델 조합의 처리가 진행 중일 경우 중복 실행 방지.
  - 개별 카테고리 Lock 키: `"category-translate:{categoryId}"`