# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## plugin, skills, mcp 사용
* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원, pgvector 코사인 유사도 검색 사용.

**현재 상태**: 인프라(Docker 컨테이너 5개, 도메인, CI/CD) 구축 완료. `/` 랜딩 페이지 구현 완료 (shadcn/ui, 화이트/다크 모드, 반응형). Swagger UI (`/swagger/`) 초기화 완료. 진행 중: Phase 1 (Laravel 비동기 백엔드 파이프라인).

## 레포지토리 구조

```
cl_embed/
├── nextjs/          # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
├── laravel/         # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
├── docker/          # Docker Compose + Dockerfiles
│   ├── docker-compose.yml  # 5개 서비스 (nextjs, laravel, pgvector, redis, swagger)
│   ├── laravel/dockerfile
│   └── nextjs/dockerfile
├── docs/            # 설계 문서
│   ├── PRD.md           # 제품 요구사항
│   ├── ARCHITECTURE.md  # 인프라, DB 스키마, 데이터 흐름
│   ├── ADR.md           # 아키텍처 결정 기록
│   ├── UI_GUIDE.md      # 프론트엔드 디자인 제약 (필독)
│   └── solutions/       # 과거 문제 해결 문서 (YAML frontmatter로 분류, category/module/tags 검색 가능)
├── phases/          # Phase별 작업 산출물
├── scripts/         # Claude Code Harness 스크립트
└── .github/workflows/deploy.yml  # CI/CD
```

## 브랜치 전략 (develop + main)

- **`develop`**: 일상 개발 브랜치. feature/* 브랜치에서 작업 후 PR로 머지.
- **`main`**: 안정 릴리스 브랜치. CI/CD가 main 푸시를 감지해 자동 배포.
- **`feature/*`**: 개별 기능 개발. develop에서 분기, 완료 후 PR → develop.
- **`develop → main 릴리스**: `scripts/git_release.sh` 실행 (develop을 main에 머지 후 푸시, 완료 후 develop으로 복귀)

## 개발 프로세스

- **CRITICAL: TDD** — 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것
  - Laravel: Pest 4 (`php artisan test --compact`)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- PHP 변경 완료 전 `vendor/bin/pint --format agent` 실행 (컨테이너 내부)
- **DB 테이블명**은 Laravel 기본 복수형 컨벤션을 따른다 (예: `categories`, `translation_caches`). 명시적 `protected $table` 지정은 불필요.

## 기술 스택

| 영역 | 스택 | 상세 |
|------|------|------|
| 백엔드 | Laravel 13 + PHP 8.5 | `laravel/CLAUDE.md` 참조 |
| 프론트엔드 | Next.js 16 + React 19 | `nextjs/CLAUDE.md` 참조 |
| DB | PostgreSQL 15 + pgvector | `docs/ADR.md` ADR-001 |
| 비동기 | Laravel Queue + Redis + Reverb | `docs/ADR.md` ADR-002 |
| AI | Ollama 로컬 모델 | `docs/ADR.md` ADR-003 (translategemma:4b, bge-m3:latest) |
| 인증 | Laravel Sanctum + Socialite | `docs/ADR.md` ADR-004 |
| 인프라 | Docker 5컨테이너, cloudflared, Nginx | `docs/ARCHITECTURE.md` |
| 데이터 흐름 | 비동기 파이프라인 + WebSocket | `docs/ARCHITECTURE.md` |

## 컨테이너 접속

Next.js 관련 작업은 호스트에서 직접 실행하지 말고 반드시 `cl_embed_nextjs` 컨테이너 내부에서 실행해야 합니다. (node_modules 권한 문제 방지)

```bash
# Next.js 컨테이너 접속
docker exec -it cl_embed_nextjs /bin/sh

# Laravel 컨테이너 접속
docker exec -it cl_embed_laravel /bin/bash
```

컨테이너 내부에서 npm 명령어 실행 시 `--no-bin-links` 플래그가 필요할 수 있습니다.

### 컨테이너별 작업 디렉터리

```bash
# Laravel 앱 디렉터리 (php artisan, composer 등 실행 위치)
docker exec cl_embed_laravel bash -c "cd /var/www/html && php artisan ..."

# Next.js 앱 디렉터리
docker exec cl_embed_nextjs sh -c "cd /app && npm ..."
```

- Laravel 컨테이너 작업 디렉터리는 `/var/www/html`입니다. 홈 디렉터리(`/home/appuser`)와 혼동하지 마세요.

## 알려진 이슈

- **tinker 쓰기 권한 오류** — `useradd -m`으로 홈 디렉토리(`/home/appuser`)를 생성하므로 해결됨. 단, `/home/appuser/.config/psysh`는 Dockerfile에서 chown 필요 (RUN은 root로 실행되므로).
- **Next.js HMR 에러 로그** — `embed_nextjs_error.log`의 "Connection refused"는 dev 서버 재시작 시 정상 발생. 무시.
- **인라인 PHP 경로** — Laravel 작업 디렉터리는 `/var/www/html`. `/var/www/vendor/...`는 존재하지 않음.
- **`RefreshDatabase` 사용 불가** — 테스트 DB가 SQLite 인메모리인데 pgvector 마이그레이션(`CREATE EXTENSION IF NOT EXISTS vector`)이 SQLite와 호환되지 않음. `tests/Pest.php`에서 주석 처리되어 있으며, 대신 `Schema::create()`로 필요한 테이블만 수동 생성한다. 상세: `docs/solutions/test-failures/sqlite-pgvector-refresh-database-incompatibility-2026-05-10.md`

## 인프라 환경 (WSL2)

- **WSL2 `networkingMode=mirrored`**: Windows 호스트와 WSL2가 동일한 네트워크를 공유. Docker 컨테이너 내부에서 `host.docker.internal`로 Windows 호스트의 Ollama(port 11434)에 접근 가능.
- **Ollama**: Windows 호스트에서 실행 중인 Ollama(`host.docker.internal:11434`)를 Laravel 컨테이너가 호출한다.

## Docker Compose

```bash
# 모든 서비스 시작
cd docker && docker compose up -d

# 모든 서비스 중지
cd docker && docker compose down

# 단일 서비스 재시작
docker compose restart cl_embed_laravel
docker compose restart cl_embed_nextjs

# 로그 확인
docker compose logs -f cl_embed_laravel
docker compose logs -f cl_embed_nextjs
```

## 로깅

### Nginx 로그 (`docker/nginx/volume/log/`)

Nginx 리버스 프록시가 경로별로 별도 로그 파일에 기록합니다.

| 로그 파일 | 내용 |
|-----------|------|
| `embed_error.log` / `embed_access.log` | Nginx 전체 요청/오류 |
| `embed_api_error.log` / `embed_api_access.log` | `/api/` 라우팅 (Laravel API) |
| `embed_app_error.log` / `embed_app_access.log` | `/app/` 라우팅 (Laravel Reverb WebSocket) |
| `embed_nextjs_error.log` / `embed_nextjs_access.log` | `/` 라우팅 (Next.js 프론트엔드) |

### Laravel 프로세스 로그 (`laravel/logs/`)

Laravel 컨테이너(`cl_embed_laravel`) 내부에서 실행되는 3개의 프로세스가 각각 별도 파일에 기록합니다. Docker Compose volume `./laravel/volume/log:/var/log/php`로 호스트에 마운트됩니다.

| 로그 파일 | 프로세스 | 포트 | 목적 |
|-----------|----------|------|------|
| `serve.log` | `php artisan serve` | 8000 | Laravel HTTP 요청 처리 |
| `queue.log` | `php artisan queue:work` | — | 큐 Job (번역/임베딩) 처리 |
| `reverb.log` | `php artisan reverb:start` | 8080 | WebSocket 실시간 브로드캐스트 |

### Laravel 애플리케이션 로그 (`laravel/storage/logs/laravel.log`)

Laravel 프레임워크가 자체적으로 기록하는 애플리케이션 로그 파일입니다. HTTP 요청 처리 중 발생한 에러, 디버그 메시지, 예외 trace 등이 기록됩니다. 프로세스별 로그(`serve.log`, `queue.log`, `reverb.log`)와 달리 실제 Laravel 애플리케이션 코드 실행 중 발생하는 이벤트가 기록됩니다.

## CI/CD (셀프호스티드 WSL GitHub Actions 러너)

`main` 브랜치 푸시 시 컨테이너 재시작 및 데몬 재실행.

## 관련 문서

- [`laravel/CLAUDE.md`](laravel/CLAUDE.md) — 백엔드 명령어, 데몬 실행, 코드 컨벤션, 패키지
- [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) — 프론트엔드 명령어, 패키지
- [`nextjs/AGENTS.md`](nextjs/AGENTS.md) — Next.js 16 브레이킹 체인지 (필독)
- [`docs/PRD.md`](docs/PRD.md) — 제품 요구사항, Phase 정의, 성능 목표
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 인프라, DB 스키마, 데이터 흐름
- [`docs/ADR.md`](docs/ADR.md) — 아키텍처 결정 기록 (pgvector, Reverb, Ollama, Sanctum)
- [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) — 프론트엔드 디자인 제약 (AI 슬롭 안티패턴, 색상, 컴포넌트)
