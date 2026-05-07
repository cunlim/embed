# 아키텍처

## 디렉토리 구조 및 인프라 (멀티 컨테이너)
```
./docker/docker-compose.yml (WSL Ubuntu 기반)
├── cl_embed_nextjs/    # Port 3000, Next.js 16.2.4 (Node v24.15.0), WATCHPACK_POLLING 적용
├── cl_embed_laravel/   # Laravel 13.5.0 (php:8.5.5-fpm-trixie) API & Queue 데몬
├── cl_embed_pgvector/  # PostgreSQL 15+ (pgvector extension)
└── cl_embed_redis/     # Redis (Session, Cache, Queue, Broadcasting)
```
* 도메인: `https://embed.cunlim.dev` 호스트 연결 (cloudflared tunnel 사용)

## 패턴
* **리버스 프록시 트래픽 라우팅 (Nginx)**:
  - `/` ➔ Next.js (프론트엔드 라우팅)
  - `/api/` ➔ Laravel FPM (메인 API 데이터 제공)
  - `/app/` ➔ Laravel Reverb (WebSocket 전용, Upgrade 헤더 적용 완료)
* **Server Components 기본**: Next.js App Router 환경에서 실시간 인터랙션(웹소켓 프로그레스 바, 모달)이 필요한 구간만 Client Component 채택.
* **API 문서 라우팅**:
  - `/docs/` ➔ Swagger UI 컨테이너 또는 Laravel L5-Swagger 뷰 연결 (API 명세서 제공)

## 데이터베이스 주요 테이블 정의
* **categories**: 단일 카테고리 체계 (네이버 기준)
  - `id` (bigserial, PK), `category_code` (UNIQUE, 플랫폼 코드)
  - `category_name_ko`, `category_name_zh` (Nullable), `category_name_en` (Nullable) — B-tree 인덱스
* **translation_cache**: 중복 방지 캐시 테이블
  - `source_text`(분할 텍스트), `target_lang`, `translated_text` / Unique Index(`source_text`, `target_lang`)
* **category_embeddings**: 다중 언어/모델 지원 (1:N)
  - `category_id` (FK), `language` (ko, zh, en), `embed_model_name` (예: nomic-embed-text, llama3)
  - `embedding` (VECTOR(768) - pgvector 고정 차원 필수)
* **search_logs**: 검색어 임베딩 캐시 겸 이력 테이블
  - `user_id` (FK, Nullable), `session_id` (비회원 식별 UUID), `search_keyword` (동일 키워드 캐시, UNIQUE 아님)
  - `embed_model_name`, `embedding` (VECTOR(768))
* **users**: OAuth 및 이메일 회원 관리
  - `id` (bigserial, PK), `name`, `email` (UNIQUE), `password` (Nullable)
  - `provider` (VARCHAR, Nullable - google, github, naver), `provider_id` (VARCHAR, Nullable)
* **failed_jobs**: 비동기 큐 처리 실패 이력 관리 (Ollama 환각/타임아웃 등)
  - `id` (bigserial, PK), `uuid`, `connection`, `queue`, `payload`, `exception`, `failed_at`

## 데이터 흐름 (비동기 및 웹소켓 파이프라인)
```
1. 클라이언트 트리거 (일괄 처리 시작) → Nginx → `/api/` (Laravel)
2. 백엔드는 중복 실행 방지(Redis Cache::lock) 검증 후 즉시 202 Accepted 응답.
3. Queue Job 적재 → `queue:work` 데몬 실행
   - [텍스트 분할(> 기준) → 캐시 확인/번역(translategemma:4b) → 재조립 → 언어별 임베딩 생성(언어별 3개)]
4. Rate Limit 방어: 외부 API 연동 시 `Redis::throttle()` 또는 의도적 Sleep 부여.
5. 큐 처리 중 이벤트 발생 → Redis Pub/Sub → Laravel Reverb (Port 8080)
6. Nginx `/app/` 라우팅 → 클라이언트 (프로그레스 바 렌더링)
```

## 상태 관리
* **서버 상태**: DB에 적재된 다국어 임베딩 벡터 데이터, pgvector 코사인 유사도 연산.
* **사용자 상태**: 비회원은 브라우저 `LocalStorage` 및 `session_id`로 개인 설정 분리. 회원은 `User ID`에 종속되어 DB 동기화.
* **동시성 상태**: Redis `Cache::lock()`을 사용하여 동일 언어/모델의 일괄 처리가 진행 중일 경우 Job 적재 생략 및 웹소켓만 구독.