# CL Embed

AI 기반 다국어 카테고리 추천 시스템입니다. 상품명이나 설명을 입력하면 벡터 임베딩과 코사인 유사도를 활용하여 가장 적합한 카테고리를 추천합니다. 한국어(ko), 영어(en), 중국어(zh) 3개 언어를 지원합니다.

## 주요 기능

- **카테고리 추천** — 텍스트 입력 시 pgvector 기반 코사인 유사도 검색으로 최적 카테고리 매칭
- **다국어 번역·임베딩 파이프라인** — 5단계 순차 처리(en 번역 → en 임베딩 → zh 번역 → zh 임베딩 → ko 임베딩), 단계별 진행률 표시
- **카테고리 CRUD** — 계층형 폴더 구조, 대량 업로드(Excel), 폴더 이동
- **외부 REST API** — `POST /api/v1/search` 엔드포인트, API 키 인증·rate limit·quota 관리
- **OAuth 로그인** — Google, GitHub, Naver + 이메일/비밀번호 인증
- **관리자 패널** — 시스템 설정, 사용자 관리 (superadmin 전용)
- **마이페이지** — API 키 관리, 사용량 대시보드

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| 백엔드 | Laravel 13 (PHP 8.5), Sanctum, Socialite |
| 데이터베이스 | PostgreSQL 15 + pgvector, Redis |
| AI/ML | Ollama (기본: bge-m3, translategemma:4b), OpenAI 호환 API |
| 인프라 | Docker Compose, Nginx, GitHub Actions CI/CD |

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (reverse proxy)             │
├──────────┬──────────┬──────────┬────────────────────┤
│  / → :3000│ /api/    │/swagger/ │ /app/ (WebSocket)  │
│  Next.js  │ Laravel  │ Swagger  │ Reverb             │
│           │ PHP-FPM  │ UI       │                    │
└──────────┴────┬─────┴──────────┴────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
PostgreSQL  Redis     Ollama/AI
+pgvector   (cache,   Provider
            queue)
```

### AI 프로바이더 추상화

인터페이스 기반 설계로 Ollama(로컬)와 OpenAI 호환 API 간 코드 변경 없이 전환 가능합니다.

- `EmbeddingProviderInterface` — 텍스트 → 벡터 변환
- `TranslationProviderInterface` — 다국어 번역

관리자 설정 패널에서 프로바이더를 변경할 수 있습니다.

## 시작하기

### 사전 요구사항

- Docker, Docker Compose
- PostgreSQL 15 + pgvector 확장
- Redis
- Ollama (로컬 AI 기능 사용 시)

### 환경 설정

```bash
# 1. 환경 변수 파일 복사 및 수정
cp laravel/.env.example laravel/.env    # DB, OAuth, Ollama 호스트 설정
cp nextjs/.env.example nextjs/.env.local  # API URL 설정

# 2. Docker 컨테이너 빌드 및 실행
cd docker
docker compose build
docker compose up -d

# 3. PHP 의존성 설치
docker exec cl_embed_laravel composer install

# 4. 데이터베이스 마이그레이션
docker exec cl_embed_laravel php artisan migrate

# 5. Swagger 문서 생성
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

### 접속

| 경로 | 설명 |
|------|------|
| `/` | 프론트엔드 (Next.js) |
| `/api/` | 백엔드 API (Laravel) |
| `/swagger/` | API 문서 (Swagger UI) |

### 로컬 개발 (Docker 미사용)

```bash
# Laravel
cd laravel
composer dev

# Next.js
cd nextjs
npm run dev
```

## 테스트

```bash
# Laravel (Pest)
docker exec cl_embed_laravel php artisan test

# Next.js (Vitest)
cd nextjs && npm test

# Next.js (Playwright E2E)
cd nextjs && npx playwright test

# 전체 검증 (tsc, lint, test, pint)
.claude/hooks/run-all-checks.sh --terminal
```

## 역할 기반 접근 제어

| 역할 | 카테고리 조회 | CRUD | 번역·임베딩 | 폴더 관리 | 관리자 |
|------|:---:|:---:|:---:|:---:|:---:|
| 비로그인 | 공개만 | ✗ | ✗ | ✗ | ✗ |
| Member | 본인+공개 | 본인 | 본인 | 본인 | ✗ |
| Admin | 전체 | 전체 | 전체 | 전체 | ✗ |
| Superadmin | 전체 | 전체 | 전체 | 전체 | ✓ |

## 라이선스

Portfolio / Demo 프로젝트입니다.
