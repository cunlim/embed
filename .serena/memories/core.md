# Core — 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. 벡터 검색(pgvector)으로 다국어 카테고리를 추천한다.

## 아키텍처

- **5개 Docker 컨테이너**: Next.js, Laravel FPM, Swagger UI, PostgreSQL 15+pgvector, Redis
- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel, `/swagger/` → Swagger UI
- **도메인**: `https://embed.cunlim.dev` (cloudflared tunnel)
- **인증**: Laravel Sanctum (API Token) + Socialite (OAuth: Google, GitHub, Naver)

## 소스 맵

| 모듈 | 경로 | 프레임워크 |
|------|------|-----------|
| 백엔드 | `laravel/` | Laravel 13, PHP 8.5 |
| 프론트엔드 | `nextjs/` | Next.js 16 (App Router), React 19, TypeScript 5 |
| Docker | `docker/` | docker-compose.yml |
| 문서 | `docs/` | PRD, ADR, UI_GUIDE |
| 스크립트 | `scripts/` | git_release.sh, cosine_similarity.py |

## 핵심 비즈니스 로직

- 카테고리 번역: 로컬 Ollama `translategemma:4b`
- 임베딩: 로컬 Ollama `bge-m3:latest` (1024차원 다국어)
- 동시성 제어: Redis `Cache::lock("category-translate:{categoryId}")`
- 캐싱: 그룹 전체를 하나의 캐시 키로 묶어 저장 (개별 `Cache::remember()` 금지)

## 관련 문서

- `mem:tech_stack` — 기술 스택 상세
- `mem:suggested_commands` — 실행 명령어
- `mem:conventions` — 코드 컨벤션
- `mem:task_completion` — 작업 완료 검증
- `mem:laravel/core` — 백엔드 모듈 상세
- `mem:frontend/core` — 프론트엔드 모듈 상세
