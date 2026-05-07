# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원, pgvector 코사인 유사도 검색 사용.

**현재 상태**: 인프라(Docker 컨테이너 4개, 도메인, CI/CD) 구축 완료. 애플리케이션 코드는 아직 작성되지 않음 (Laravel 기본 스캐폴드, Next.js 기본 템플릿). Phase 1 (Laravel 비동기 백엔드 파이프라인)부터 구현 시작 예정.

## 아키텍처 (모노레포)

```
cl_embed/
├── nextjs/          # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
├── laravel/         # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
├── docker/          # Docker Compose + Dockerfiles
│   ├── docker-compose.yml  # 4개 서비스 (nextjs, laravel, pgvector, redis)
│   ├── laravel/dockerfile  # php:8.5.5-fpm-trixie
│   └── nextjs/dockerfile
├── docs/            # 설계 문서
│   ├── PRD.md           # 제품 요구사항 (Phase 정의, 성능 목표)
│   ├── ARCHITECTURE.md  # 인프라, DB 스키마, 데이터 흐름
│   ├── ADR.md           # 4개 ADR (pgvector, Reverb, Ollama, Sanctum)
│   └── UI_GUIDE.md      # 프론트엔드 디자인 제약 (필독)
├── phases/          # (빈 디렉토리 - Phase별 작업 산출물 예정)
├── scripts/         # Claude Code Harness 스크립트
└── .github/workflows/deploy.yml  # CI/CD (셀프호스티드 WSL 러너)
```

### 인프라 (상세: `docs/ARCHITECTURE.md`)

- **도메인**: https://embed.cunlim.dev (cloudflared tunnel → Nginx → 컨테이너)
- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel FPM, `/app/` → Laravel Reverb WebSocket
- **4개 Docker 컨테이너**: nextjs, laravel, pgvector, redis

### 핵심 아키텍처 결정 (ADR — 상세: `docs/ADR.md`)

| 결정 | 선택 | 이유 |
|------|------|------|
| ADR-001 | PostgreSQL 15 + pgvector | 단일 DB로 트랜잭션+벡터 검색 통합 |
| ADR-002 | Laravel Queue + Redis + Reverb | 대량 번역 파이프라인 + 실시간 진행률 WebSocket |
| ADR-003 | Ollama 로컬 모델 (`translategemma:4b`) | API 비용 제거, Rate Limit 회피 |
| ADR-004 | Laravel Sanctum + Socialite | Stateless 토큰 인증, OAuth (Google/GitHub/Naver) |

### AI 모델 스택

- **번역**: `translategemma:4b` (Ollama 로컬) — 환각 대응 정규식 검증 + 최대 3회 재시도
- **임베딩**: `nomic-embed-text` (Ollama 로컬, 768차원) — 언어별(ko/zh/en) 임베딩 생성

### 데이터 흐름 (비동기 파이프라인)

```
클라이언트 → Nginx → Laravel API (202 Accepted)
  → Redis Lock (중복 방지)
    → Queue Job (텍스트 분할 → 번역 → 재조립 → 임베딩)
      → Redis Pub/Sub → Reverb WebSocket → 클라이언트 (진행률)
```

## 개발 프로세스

- **CRITICAL: TDD** — 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것
  - Laravel: Pest 4 (`php artisan test --compact`)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- PHP 변경 완료 전 `vendor/bin/pint --format agent` 실행 (컨테이너 내부)

## 자주 사용하는 명령어

### Docker Compose

```bash
# 모든 서비스 시작
cd docker && docker compose up -d

# 단일 서비스 재시작
docker compose restart cl_embed_laravel
docker compose restart cl_embed_nextjs

# 로그 확인
docker compose logs -f cl_embed_laravel
docker compose logs -f cl_embed_nextjs

# 컨테이너 내부 셸 접속
docker exec -it cl_embed_laravel bash
docker exec -it cl_embed_nextjs sh
```

### Laravel (컨테이너 내부, `docker exec` 필요)

```bash
# Laravel 데몬 일괄 실행 (docker exec -d)
docker exec -d cl_embed_laravel bash -c "
  nohup php artisan serve --host=0.0.0.0 --port=8000 > logs/serve.log 2>&1 &
  nohup php artisan reverb:start --host=0.0.0.0 --port=8080 > logs/reverb.log 2>&1 &
  nohup php artisan queue:work > logs/queue.log 2>&1 &
"

# 테스트
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 파일 생성 (모델, 마이그레이션, 컨트롤러, 테스트)
docker exec cl_embed_laravel php artisan make:model ModelName --migration --factory --seed --test
docker exec cl_embed_laravel php artisan make:test --pest TestName
docker exec cl_embed_laravel php artisan make:controller Api/ControllerName

# DB 마이그레이션
docker exec cl_embed_laravel php artisan migrate
docker exec cl_embed_laravel php artisan migrate:fresh --seed

# 라우트 확인
docker exec cl_embed_laravel php artisan route:list

# 설정 확인
docker exec cl_embed_laravel php artisan config:show app.name
```

### Next.js (컨테이너 내부, `docker exec` 필요)

```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 프로덕션 빌드
docker exec cl_embed_nextjs npm run build

# ESLint
docker exec cl_embed_nextjs npm run lint
```

### WebSocket 핸드셰이크 확인

```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/app/{app_id}
```

## 데이터베이스 (상세: `docs/ARCHITECTURE.md`)

- PostgreSQL 15+ with pgvector
- 주요 테이블: `categories`, `translation_cache`, `category_embeddings`, `search_logs`, `users`, `failed_jobs`
- `category_embeddings.embedding`: VECTOR(768) 고정 차원

## CI/CD (셀프호스티드 WSL GitHub Actions 러너)

`main` 브랜치 푸시 시:
1. `docker compose restart cl_embed_nextjs`
2. `docker compose restart cl_embed_laravel`
3. 데몬 재시작 (serve, reverb, queue:work)

SonarQube 설정 완료 (`sonar-project.properties`, 키: `cl_embed`), 외부에서 분석 실행.

## 프론트엔드 개발 시 주의사항

- **필독: `nextjs/AGENTS.md`** — Next.js 16은 브레이킹 체인지가 포함됨. 코드 작성 전 `node_modules/next/dist/docs/` 가이드 확인 필수.
- **필독: `docs/UI_GUIDE.md`** — AI 슬롭 안티패턴 목록(glass morphism, gradient text, 보라색 브랜딩 등) 엄격 금지. 다크 테마(#0a0a0a 배경) 고정. 디자인 원칙 준수.
- Server Components 기본. WebSocket 연동(Progress Bar, Modal)이 필요한 부분만 Client Component.

## Phase 로드맵 (상세: `docs/PRD.md`)

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | 인프라 구축 (Docker, 도메인, CI/CD) | ✅ 완료 |
| 1 | Laravel 비동기 백엔드 파이프라인 (모델/마이그레이션, 번역, 임베딩, Queue) | ⏳ 예정 |
| 2 | Next.js 실시간 UI 연동 (Reverb 구독, Progress Bar) | ⏳ 예정 |
| 3 | pgvector 검색 로직 및 End-to-End 통합 | ⏳ 예정 |

## 서브 프로젝트 문서

- [`laravel/CLAUDE.md`](laravel/CLAUDE.md) — 백엔드 가이드라인, 데몬 실행, 패키지, 코드 컨벤션 (PHP 8 Attributes, Pest, Pint)
- [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) — 프론트엔드 가이드라인, 명령어, 패키지
