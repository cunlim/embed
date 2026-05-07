# 아키텍처

## 디렉토리 구조

```
cl_embed/                          # 루트: Next.js + Laravel 모노레포
├── nextjs/                   # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript + shadcn/ui
│   ├── app/                  # Next.js App Router (페이지 + API 라우트)
│   ├── components/           # UI 컴포넌트
│   └── ...
├── laravel/                  # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
│   ├── app/
│   │   ├── Http/Controllers/ # API 컨트롤러
│   │   ├── Jobs/            # 비동기 Job (번역, 임베딩)
│   │   ├── Events/          # 실시간 이벤트 (Progress Update)
│   │   └── Models/          # Eloquent 모델 (Category, TranslationCache, CategoryEmbedding, SearchLog, User)
│   ├── database/migrations/  # 마이그레이션
│   └── ...
├── docker/                   # Docker Compose + Dockerfiles
│   ├── docker-compose.yml   # 4개 서비스 (cl_embed_nextjs, cl_embed_laravel, cl_embed_pgvector, cl_embed_redis)
│   ├── laravel/
│   └── nextjs/
└── docs/                    # 문서 (ADR, ARCHITECTURE, PRD, UI_GUIDE)
```

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16.2.4, React 19, Tailwind v4, shadcn/ui |
| 백엔드 | Laravel 13.5.0, PHP 8.5 |
| 데이터베이스 | PostgreSQL 15+ with pgvector extension |
| 캐시/큐/세션 | Redis |
| 실시간 통신 | Laravel Reverb (WebSocket, Port 8080) |
| AI 모델 (로컬) | Ollama — translategemma:4b (번역), nomic-embed-text (임베딩, 768차원) |
| 인프라 | Docker & Docker Compose, Nginx (리버스 프록시), WSL2, cloudflared tunnel |

## 인프라 / 네트워크

```
Client → cloudflared tunnel → Nginx (Reverse Proxy, WSL Docker 컨테이너)
                                    │
                    ┌───────────────┼────────────────┐
                    ↓               ↓                ↓
          Next.js (3000)     Laravel FPM (8000)   Reverb WS (8080)
          cl_embed_nextjs     cl_embed_laravel    cl_embed_laravel
                                    │                   │
                              PostgreSQL (5432)    Redis (6379)
                              cl_embed_pgvector    cl_embed_redis
```

- **도메인**: `https://embed.cunlim.dev` — cloudflared tunnel → Nginx → 컨테이너
- **Nginx 라우팅 규칙**
  - `/` → Next.js (UI)
  - `/api/` → Laravel FPM (REST API)
  - `/app/` → Laravel Reverb (WebSocket, Upgrade 헤더 적용)

## 패턴

- **서버 우선 (Server Components)**: 데이터 fetching은 서버 사이드에서 처리
- **인터랙션 필요한 곳만 Client Component**: 버튼, 폼, Select Box, 모달 등
- **비동기 큐 기반 파이프라인**: 번역 → 임베딩 생성 → DB 저장 파이프라인은 `queue:work`로 분리 실행
- **Job Chaining**: 개별 카테고리(Row) 단위로 `Bus::chain()` 또는 `Bus::batch()` 활용
- **실시간 Progress**: `queue:work` → Redis Pub/Sub → Reverb Server → Client (프로그레스 바)

## 상태 관리

| 데이터 종류 | 관리 방식 |
|------------|----------|
| 서버 상태 (카테고리, 임베딩) | Server Components + API 호출 |
| 검색 결과 | Client Component local state (useState) |
| 세션/인증 | Laravel Session + Redis |
| 비회원 설정값 (추천 개수 등) | LocalStorage |
| 진행률 (배치 작업) | Reverb WebSocket 채널 구독 |

## 데이터 관리 이원화

| 사용자 유형 | 임베딩 캐시 (`search_logs`) | 개인 설정 |
|---|---|---|
| 비회원 (게스트) | `session_id` (LocalStorage UUID) — DB 저장, 인덱스 UNIQUE 아님 (중복 검색 허용) | 브라우저 `LocalStorage` |
| 회원 | `user_id` 에 종속, DB 저장 | DB 저장 및 동기화 |

**권한 제어**: 로그인 여부와 관계없이 검색/추천 기능 접근 가능. 카테고리 추가/수정/삭제는 관리자 전용.

**OAuth 인증**: Laravel Socialite — Google, GitHub, Naver (추가 정보 입력 생략)

## CI/CD