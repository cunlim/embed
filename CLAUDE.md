# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원, pgvector 코사인 유사도 검색 사용.

## 아키텍처 (모노레포)

```
cl_embed/
├── nextjs/          # 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
├── laravel/         # 백엔드: Laravel 13 + PHP 8.5 + Pest 4
├── docker/          # Docker Compose + Dockerfiles
│   ├── docker-compose.yml  # 4개 서비스 (nextjs, laravel, pgvector, redis)
│   ├── laravel/dockerfile
│   └── nextjs/dockerfile
├── .github/workflows/      # CI/CD (셀프호스티드 WSL 러너)
└── doc/PRD.md              # 제품 요구사항 문서 (상세 설계 참조)
```

### 인프라 (상세: `doc/PRD.md` 3, 5절)

- **도메인**: https://embed.cunlim.dev (cloudflared tunnel → Nginx → 컨테이너)
- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel FPM, `/app/` → Laravel Reverb WebSocket

## 자주 사용하는 명령어

### Docker Compose

```bash
# 모든 서비스 시작
cd docker && docker compose up -d

# 단일 서비스 재시작
docker compose restart cl_embed_laravel
docker compose restart cl_embed_nextjs

# 컨테이너 내부에서 Laravel 데몬 일괄 실행
docker exec -d cl_embed_laravel bash -c "
  nohup php artisan serve --host=0.0.0.0 --port=8000 > logs/serve.log 2>&1 &
  nohup php artisan reverb:start --host=0.0.0.0 --port=8080 > logs/reverb.log 2>&1 &
  nohup php artisan queue:work > logs/queue.log 2>&1 &
"

# WebSocket 핸드셰이크 확인
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/app/{app_id}
```

### Laravel (상세: `laravel/CLAUDE.md` 참조)

```bash
# 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 라우트 확인
docker exec cl_embed_laravel php artisan route:list

# 설정 확인
docker exec cl_embed_laravel php artisan config:show app.name
```

### Next.js (상세: `nextjs/CLAUDE.md` 참조)

```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 프로덕션 빌드
docker exec cl_embed_nextjs npm run build

# ESLint
docker exec cl_embed_nextjs npm run lint
```

## CI/CD

WSL 상의 셀프호스티드 GitHub Actions 러너 사용. `main` 브랜치 푸시 시:
1. `docker compose restart cl_embed_nextjs`
2. `docker compose restart cl_embed_laravel`
3. 데몬 재시작 (serve, reverb, queue:work)

SonarQube 설정 완료 (`sonar-project.properties`, 키: `cl_embed`), 외부에서 분석 실행.

## 데이터베이스 (상세: `doc/PRD.md` 4절 참조)

- PostgreSQL 15+ with pgvector 확장
- 주요 테이블: `categories`, `translation_cache`, `category_embeddings`, `search_logs`

## 서브 프로젝트 문서

- [`laravel/CLAUDE.md`](laravel/CLAUDE.md) — 백엔드 가이드라인, 데몬 실행, 패키지, 코드 컨벤션
- [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) — 프론트엔드 가이드라인, 명령어, 패키지

## 현재 진행 상황

인프라 구축 완료 (`doc/PRD.md` 2절 참조). 이후 마일스톤은 PRD 8절에 정의된 Phase 1→3 순서로 진행.
