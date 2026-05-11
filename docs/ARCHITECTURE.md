# 아키텍처

## 디렉토리 구조 및 인프라 (멀티 컨테이너)
```
./docker/docker-compose.yml (WSL Ubuntu 기반) — 5개 컨테이너
├── cl_embed_nextjs/    # Next.js (상세 버전/포트/명령어: [`nextjs/CLAUDE.md`](../nextjs/CLAUDE.md))
├── cl_embed_laravel/   # Laravel API & Queue 데몬 (상세 버전/명령어: [`laravel/CLAUDE.md`](../laravel/CLAUDE.md))
├── cl_embed_swagger/   # Swagger UI (swaggerapi/swagger-ui 이미지, `/swagger/` 라우팅)
├── pgvector_03/        # PostgreSQL 15+ (pgvector extension)
└── redis_04/           # Redis (Session, Cache, Queue, Broadcasting)
```
* 도메인: `https://embed.cunlim.dev` 호스트 연결 (cloudflared tunnel 사용)
* **Nginx 로그**: `docker/nginx/volume/log/` — 경로별 분리 기록 (`/api/`, `/app/`, `/`)
* **Laravel 프로세스 로그**: `laravel/logs/` — `serve.log`, `queue.log`, `reverb.log` (Docker volume `./laravel/volume/log:/home/appuser/log/php`)

## 패턴
* **리버스 프록시 트래픽 라우팅 (Nginx)**:
  - `/` ➔ Next.js (프론트엔드 라우팅)
  - `/api/` ➔ Laravel FPM (메인 API 데이터 제공)
  - `/app/` ➔ Laravel Reverb (WebSocket 전용, Upgrade 헤더 적용 완료)
* **Server Components 기본**: Next.js App Router 환경에서 실시간 인터랙션(웹소켓 프로그레스 바, 모달)이 필요한 구간만 Client Component 채택.
* **API 문서 라우팅**:
  - `/docs/` ➔ Next.js 프론트엔드에서 제공하는 프로젝트 개발 문서 페이지. `docs/` 디렉토리의 마크다운 문서를 웹으로 렌더링한다. Swagger UI와는 무관. MVP에서는 간단한 임시 구현으로 제공한다.
  - `/swagger/` ➔ Swagger UI 페이지 (독립 Docker 컨테이너 `cl_embed_swagger`, `swaggerapi/swagger-ui`). Nginx가 `/swagger/`를 Swagger UI 컨테이너로 프록시. 초기화 완료. Laravel API의 OpenAPI 스펙을 확인할 수 있다.
  - `/api/documentation` ➔ L5-Swagger가 생성하는 Laravel API의 OpenAPI JSON 엔드포인트. Swagger UI 컨테이너가 이 URL에서 JSON을 가져온다.

## 페이지 구성 (Next.js 5개 페이지)

| 라우트 | 페이지 | 목적 | 인증 |
|--------|--------|------|------|
| `/` | 랜딩 페이지 | 프로젝트 소개, 검색어 입력 및 타겟 언어 선택, 추천 결과 기본 확인 | 불필요 |
| `/login` | 로그인 페이지 | 이메일/비밀번호 로그인, OAuth (Google, GitHub, Naver) 소셜 로그인, 회원가입 | 불필요 |
| `/embed` | Embed 기술 시연 페이지 | 검색어 입력, 타겟 언어 선택, 추천 결과 출력, 코사인 유사도 상세, 계층형 Select Box (네이버 카테고리 "대>중>소" 계층을 순서대로 선택), 벡터 과정 모달 등 모든 기능을 하나의 위젯 형태로 기술 시연 | 불필요 |
| `/docs` | 프로젝트 문서 페이지 | `docs/` 디렉토리의 마크다운 문서를 웹으로 렌더링. MVP에서는 간단한 임시 구현 | 불필요 |
| `/admin` | 관리자 전용 페이지 | 카테고리 CRUD, 일괄 번역 트리거, 시스템 관리 | **필수** (로그인 필수, 비로그인 시 `/login` 리다이렉트. "관리자"란 `/admin` 접근 권한이 있는 로그인 사용자를 의미하며 별도 역할(Role) 구분은 없음) |

## Next.js 프론트엔드 구조

```
nextjs/
├── app/                    # App Router 페이지
│   ├── layout.tsx          # 루트 레이아웃 (폰트, next-themes Provider)
│   ├── page.tsx            # / 랜딩 페이지
│   └── globals.css         # Tailwind v4 + base-nova CSS 변수
├── components/
│   ├── ui/                 # shadcn/ui 컴포넌트 (자동 생성)
│   ├── theme-provider.tsx  # next-themes Provider
│   └── theme-toggle.tsx    # 화이트/다크 모드 토글
├── hooks/                  # 커스텀 훅
├── lib/
│   └── utils.ts            # cn() 헬퍼 (clsx + tailwind-merge)
├── components.json         # shadcn/ui 설정 (base-nova, rsc, tsx)
├── next.config.ts          # Next.js 16 설정
└── tsconfig.json           # TypeScript strict, bundler resolution, @/* alias
```

### 주요 프론트엔드 패키지

| 패키지 | 용도 |
|--------|------|
| next 16.2.4 | App Router |
| react 19.2.4 | RSC + Client Components |
| tailwindcss v4 | CSS 프레임워크 |
| shadcn v4.7 | UI 컴포넌트 (base-nova 스타일) |
| next-themes | 화이트/다크 모드 |
| lucide-react | 아이콘 |
| tailwind-merge | 클래스 충돌 방지 |

## 데이터베이스 주요 테이블

컬럼 상세는 `laravel/database/migrations/`의 각 마이그레이션 파일 참조.

| 테이블 | 목적 | 비고 |
|--------|------|------|
| `categories` | 단일 카테고리 체계 (네이버 기준) | |
| `category_embeddings` | 다중 언어/모델 임베딩 (1:N) | VECTOR(1024) pgvector |
| `translation_caches` | 번역 결과 캐시 (중복 방지) | |
| `search_logs` | 검색어 임베딩 캐시 겸 이력 | 비회원은 `session_id` 식별, `normalized_keyword`로 캐시 매칭 |
| `users` | OAuth 및 이메일 회원 관리 | 추후 `provider`/`provider_id` 컬럼 추가 예정 (OAuth 연동 시) |

## 데이터 흐름 (비동기 및 웹소켓 파이프라인)
```
1. 클라이언트 트리거 (일괄 처리 시작) → Nginx → `/api/` (Laravel)
2. 백엔드는 중복 실행 방지(Redis Cache::lock) 검증 후 즉시 202 Accepted 응답.
3. Queue Job 적재 → `queue:work` 데몬 실행
   - [ko: 원문 임베딩 / zh,en: 텍스트 분할(> 기준) → 캐시 확인/번역(translategemma:4b) → 재조립 → 언어별 임베딩 생성(bge-m3:latest, 1024차원)]
4. Rate Limit 방어: 외부 API 연동 시 `Redis::throttle()` 또는 의도적 Sleep 부여.
5. 큐 처리 중 이벤트 발생 → Redis Pub/Sub → Laravel Reverb (Port 8080)
6. Nginx `/app/` 라우팅 → 클라이언트 (프로그레스 바 렌더링)
```

## 상태 관리
* **서버 상태**: DB에 적재된 다국어 임베딩 벡터 데이터, pgvector 코사인 유사도 연산.
* **사용자 상태**: 비회원은 브라우저 `LocalStorage` 및 `session_id`로 개인 설정 분리. 회원은 `User ID`에 종속되어 DB 동기화.
* **동시성 상태**: Redis `Cache::lock()`을 사용하여 동일 언어/모델 조합의 일괄 처리가 진행 중일 경우 Job 적재 생략 및 웹소켓만 구독. Lock 키 형식: `"translate-batch:{언어코드}:{모델명}"`