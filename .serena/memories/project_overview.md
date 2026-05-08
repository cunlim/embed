# 프로젝트 개요

## 프로젝트 목적
AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원.

## 현재 상태
인프라(Docker 컨테이너 4개, 도메인, CI/CD) 구축 완료. 애플리케이션 코드는 아직 작성되지 않음.

## 기술 스택
| 영역 | 스택 |
|------|------|
| 백엔드 | Laravel 13 + PHP 8.5 |
| 프론트엔드 | Next.js 16 + React 19 + Tailwind v4 + TypeScript |
| DB | PostgreSQL 15 + pgvector |
| 비동기 | Laravel Queue + Redis + Reverb |
| AI | Ollama 로컬 모델 (translategemma:4b, nomic-embed-text) |
| 인증 | Laravel Sanctum + Socialite |
| 인프라 | Docker 4컨테이너, cloudflared, Nginx |

## 레포지토리 구조
```
cl_embed/
├── nextjs/          # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
├── laravel/         # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
├── docker/          # Docker Compose + Dockerfiles (4개 서비스: nextjs, laravel, pgvector, redis)
├── docs/            # 설계 문서 (PRD.md, ARCHITECTURE.md, ADR.md, UI_GUIDE.md)
├── phases/          # Phase별 작업 산출물
├── scripts/         # Claude Code Harness 스크립트
└── .github/workflows/deploy.yml  # CI/CD
```

## 브랜치 전략
- **develop**: 일상 개발 브랜치
- **main**: 안정 릴리스 브랜치 (CI/CD 자동 배포)
- **feature/***: 개별 기능 개발 브랜치
- 릴리스: `scripts/git_release.sh` 실행

## Phase 계획
- Phase 1: Laravel 비동기 백엔드 파이프라인 (현재 진행 예정)
- Phase 2: Next.js 실시간 UI 연동
- Phase 3: 검색 로직 완성 및 Integration

## 핵심 기능
1. 일괄 번역 및 임베딩 파이프라인 (Queue + Ollama)
2. 검색 및 추천 엔진 (pgvector 코사인 유사도)
3. 실시간 처리 및 동시성 제어 (Redis Lock + WebSocket)
4. 개별 카테고리 추가 기능 (관리자 전용)
5. OAuth 로그인 (Google, GitHub, Naver)

## 핵심 성공 지표
- 캐시 히트 시: 100ms 이하 응답
- 신규 키워드: 1.5초 이하 응답
- AI 번역 실패 시 재시도 성공률 99% 이상
