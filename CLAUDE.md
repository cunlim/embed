# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원, pgvector 코사인 유사도 검색 사용.

**현재 상태**: 인프라(Docker 컨테이너 4개, 도메인, CI/CD) 구축 완료. 애플리케이션 코드는 아직 작성되지 않음. Phase 1 (Laravel 비동기 백엔드 파이프라인)부터 구현 시작 예정.

## 레포지토리 구조

```
cl_embed/
├── nextjs/          # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
├── laravel/         # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
├── docker/          # Docker Compose + Dockerfiles
│   ├── docker-compose.yml  # 4개 서비스 (nextjs, laravel, pgvector, redis)
│   ├── laravel/dockerfile
│   └── nextjs/dockerfile
├── docs/            # 설계 문서
│   ├── PRD.md           # 제품 요구사항
│   ├── ARCHITECTURE.md  # 인프라, DB 스키마, 데이터 흐름
│   ├── ADR.md           # 아키텍처 결정 기록
│   └── UI_GUIDE.md      # 프론트엔드 디자인 제약 (필독)
├── phases/          # Phase별 작업 산출물
├── scripts/         # Claude Code Harness 스크립트
└── .github/workflows/deploy.yml  # CI/CD
```

## 브랜치 전략 (develop + main)

- **`develop`**: 일상 개발 브랜치. feature/* 브랜치에서 작업 후 PR로 머지.
- **`main`**: 안정 릴리스 브랜치. CI/CD가 main 푸시를 감지해 자동 배포.
- **`feature/*`**: 개별 기능 개발. develop에서 분기, 완료 후 PR → develop.

## 개발 프로세스

- **TDD** — 새 기능 구현 시 테스트를 먼저 작성하고 통과시키는 구현을 작성 (Laravel: Pest 4)
- 커밋 메시지는 conventional commits 형식 (feat:, fix:, docs:, refactor:)
- PHP 변경 후 `vendor/bin/pint --format agent` 실행 (컨테이너 내부)

## 기술 스택

| 영역 | 스택 | 상세 |
|------|------|------|
| 백엔드 | Laravel 13 + PHP 8.5 | `laravel/CLAUDE.md` 참조 |
| 프론트엔드 | Next.js 16 + React 19 | `nextjs/CLAUDE.md` 참조 |
| DB | PostgreSQL 15 + pgvector | `docs/ADR.md` ADR-001 |
| 비동기 | Laravel Queue + Redis + Reverb | `docs/ADR.md` ADR-002 |
| AI | Ollama 로컬 모델 | `docs/ADR.md` ADR-003 (translategemma:4b, nomic-embed-text) |
| 인증 | Laravel Sanctum + Socialite | `docs/ADR.md` ADR-004 |
| 인프라 | Docker 4컨테이너, cloudflared, Nginx | `docs/ARCHITECTURE.md` |
| 데이터 흐름 | 비동기 파이프라인 + WebSocket | `docs/ARCHITECTURE.md` |

## Docker Compose

```bash
# 모든 서비스 시작
cd docker && docker compose up -d

# 단일 서비스 재시작
docker compose restart cl_embed_laravel
docker compose restart cl_embed_nextjs

# 로그 확인
docker compose logs -f cl_embed_laravel
docker compose logs -f cl_embed_nextjs
```

## CI/CD (셀프호스티드 WSL GitHub Actions 러너)

`main` 브랜치 푸시 시 컨테이너 재시작 및 데몬 재실행. SonarQube (`sonar-project.properties`, 키: `cl_embed`)는 외부에서 분석 실행.

## 관련 문서

- [`laravel/CLAUDE.md`](laravel/CLAUDE.md) — 백엔드 명령어, 데몬 실행, 코드 컨벤션, 패키지
- [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) — 프론트엔드 명령어, 패키지
- [`nextjs/AGENTS.md`](nextjs/AGENTS.md) — Next.js 16 브레이킹 체인지 (필독)
- [`docs/PRD.md`](docs/PRD.md) — 제품 요구사항, Phase 정의, 성능 목표
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 인프라, DB 스키마, 데이터 흐름
- [`docs/ADR.md`](docs/ADR.md) — 아키텍처 결정 기록 (pgvector, Reverb, Ollama, Sanctum)
- [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) — 프론트엔드 디자인 제약 (AI 슬롭 안티패턴, 색상, 컴포넌트)
