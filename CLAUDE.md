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
└── doc/PRD.md              # 제품 요구사항 문서
```

### 인프라 (상세: `doc/PRD.md` 3, 5절)

- **도메인**: https://embed.cunlim.dev (cloudflared tunnel → Nginx → 컨테이너)
- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel FPM, `/app/` → Laravel Reverb WebSocket

### Laravel 데몬 (`cl_embed_laravel` 컨테이너 내부 실행)

```bash
php artisan serve --host=0.0.0.0 --port=8000     # API 서버
php artisan reverb:start --host=0.0.0.0 --port=8080 # WebSocket
php artisan queue:work                               # 비동기 잡 워커
```

### 주요 Laravel 패키지

- `laravel/reverb` — WebSocket 브로드캐스팅
- `laravel/boost` — Laravel MCP 서버 (도구: `database-query`, `database-schema`, `search-docs`)
- `pestphp/pest` — 테스트 프레임워크
- `laravel/pint` — 코드 포맷터
- `laravel/pail` — 로그 뷰어

### 주요 Next.js 패키지

- Next.js 16.2.4 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **중요**: Next.js 16은 v15 대비 브레이킹 체인지가 있습니다. 코드 작성 전 `node_modules/next/dist/docs/`를 확인하세요.

## 자주 사용하는 명령어

### Docker

```bash
# 모든 서비스 시작
cd docker && docker compose up -d

# 단일 서비스 재시작
docker compose restart cl_embed_laravel

# 컨테이너 재시작 후 Laravel 데몬 실행
docker exec -d cl_embed_laravel bash -c "
  nohup php artisan serve --host=0.0.0.0 --port=8000 > logs/serve.log 2>&1 &
  nohup php artisan reverb:start --host=0.0.0.0 --port=8080 > logs/reverb.log 2>&1 &
  nohup php artisan queue:work > logs/queue.log 2>&1 &
"

# WebSocket 핸드셰이크 확인
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/app/{app_id}

# 컨테이너 내부에서 명령어 실행
docker exec cl_embed_laravel php artisan route:list
```

### Laravel

```bash
# 테스트 실행 (컨테이너 내/외부 모두 가능)
php artisan test --compact
php artisan test --compact --filter=testName

# PHP 코드 포맷팅
vendor/bin/pint --format agent

# 파일 생성
php artisan make:model ModelName --migration --factory --seed --test
php artisan make:test --pest TestName
php artisan make:controller Api/ControllerName

# 설정 확인
php artisan config:show app.name
```

### Next.js

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```

## Laravel 코드 컨벤션

- **PHP 8 속성(Attribute) 사용**: `$fillable`/`$hidden` 프로퍼티 대신 `#[Fillable([...])]`와 `#[Hidden([...])]` 사용
- **생성자 프로퍼티 프로모션**: `public function __construct(public Type $var) {}`
- **타입 힌트**: 모든 메서드에 명시적 반환 타입과 파라미터 타입 선언
- **제어 구조**: 단일 라인이라도 항상 중괄호 사용
- **URL 생성**: `route()` 헬퍼 함수와 명명된 라우트 사용
- **API 리소스**: 버저닝과 함께 Eloquent API Resources 사용
- **Pest 테스트**: `php artisan make:test --pest`로 생성, 기존 테스트 컨벤션 따름
- **PHP 변경 완료 전** 반드시 `vendor/bin/pint --format agent` 실행

## CI/CD

WSL 상의 셀프호스티드 GitHub Actions 러너 사용. `main` 브랜치 푸시 시:
1. `docker compose restart cl_embed_nextjs`
2. `docker compose restart cl_embed_laravel`
3. 데몬 재시작 (serve, reverb, queue:work)

SonarQube 설정 완료 (`sonar-project.properties`, 키: `cl_embed`), 외부에서 분석 실행.

## 데이터베이스

- PostgreSQL 15+ with pgvector 확장
- 테이블: `categories`, `translation_cache`, `category_embeddings`, `search_logs`, 기본 Laravel 테이블
- tinker에서 직접 SQL 대신 Boost의 `database-query` 도구를 읽기 전용 쿼리에 사용
- 마이그레이션이나 모델 작성 전 `database-schema` Boost 도구로 테이블 구조 먼저 확인

## 현재 진행 상황

인프라 구축 완료 (`doc/PRD.md` 2절 참조). 이후 마일스톤은 PRD 8절에 정의된 Phase 1→3 순서로 진행.
