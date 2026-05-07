# PRD: AI 기반 다국어 카테고리 추천 시스템

## 1. 프로젝트 개요

- **목적:** 사용자 검색어/텍스트를 분석하여 가장 적합한 카테고리를 추천하는 서비스. 네이버 카테고리 체계 기준, 한국어/중국어/영어 다국어 지원. 텍스트를 벡터화(Embedding)하여 PostgreSQL `pgvector` 코사인 유사도 검색으로 정확한 추천 제공.
- **주요 특징:** 백엔드 큐(Queue)와 WebSocket을 활용한 대량 데이터 실시간 번역 및 임베딩 파이프라인, 계층형 동적 UI, 언어별 맞춤형 추천. 기술 시연용 포트폴리오 프로젝트.
- **작동하는 최소 구현 우선:** MVP 속도를 최우선으로 하되, 실제 운영 환경과 동일한 구조로 구축.
- **외부 유료 API 최소화:** 번역/임베딩은 로컬 Ollama 사용, 비용为零.

---

## 2. 현재 진행 상황 (인프라 구축 완료)

멀티 컨테이너 환경의 인프라 세팅 및 네트워크 라우팅 완료.

| 구성 요소 | 상태 | 상세 |
|---|---|---|
| 도메인 | 완료 | `https://embed.cunlim.dev` cloudflared tunnel → Nginx → 컨테이너 |
| 프론트엔드 | 완료 | Next.js 컨테이너(`cl_embed_nextjs`, Port 3000), `WATCHPACK_POLLING` 적용 |
| 백엔드 | 완료 | Laravel 컨테이너(`cl_embed_laravel`), DB 마이그레이션 완료 |
| Redis | 완료 | Session, Cache, Queue, Broadcasting |
| Laravel Reverb | 완료 | `reverb:start` Port 8080, 101 핸드셰이크 응답 확인 |
| Nginx 라우팅 | 완료 | `/`→Next.js, `/api/`→Laravel FPM, `/app/`→Reverb WebSocket |

---

## 3. 기술 스택 및 인프라

| 역할 | 기술 |
|---|---|
| 프론트엔드 | Next.js (Node v24.15.0, Next.js 16.2.4), React 19, Tailwind v4, shadcn/ui, TypeScript |
| 백엔드 | Laravel 13.5.0 (php:8.5.5-fpm-trixie), PHP 8.5 |
| 데이터베이스 | PostgreSQL 15+ with pgvector extension |
| 캐시/큐/세션 | Redis (Session, Cache, Queue, Broadcasting) |
| AI 모델 (로컬) | Ollama — `translategemma:4b` (번역), `nomic-embed-text` (임베딩, 768차원) |
| 인프라 | Docker & Docker Compose, Nginx (Reverse Proxy), WSL Ubuntu, cloudflared tunnel |
| Docker 서비스 | `cl_embed_nextjs`, `cl_embed_laravel`, `cl_embed_pgvector`, `cl_embed_redis` |

### API 문서화

Swagger UI 또는 Postman Collection 배포 예정.

---

## 4. 데이터베이스 주요 테이블 정의

### `categories` (네이버 카테고리 기준)

| 컬럼 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | bigserial | PK | 고유 식별자 |
| `category_code` | varchar(50) | UNIQUE, NOT NULL | 플랫폼 영문/숫자 코드 |
| `category_name_ko` | varchar(255) | NOT NULL | 한국어 카테고리명 (B-tree 인덱스) |
| `category_name_zh` | varchar(255) | **Nullable** | 중국어 번역본, 번역 전까지 NULL (B-tree 인덱스) |
| `category_name_en` | varchar(255) | **Nullable** | 영어 번역본, 번역 전까지 NULL (B-tree 인덱스) |
| `created_at` | timestamp(0) | DEFAULT CURRENT_TIMESTAMP | 생성 일시 |
| `updated_at` | timestamp(0) | DEFAULT CURRENT_TIMESTAMP | 수정 일시 |

### `translation_cache` (번역 중복 방지)

| 컬럼 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | serial | PK | 고유 식별자 |
| `source_text` | varchar | NOT NULL | 분할된 한국어 원문 (예: "가구/인테리어") |
| `target_lang` | varchar | NOT NULL | 타겟 언어 ('zh' 또는 'en') |
| `translated_text` | varchar | NOT NULL | 번역된 텍스트 |
| — | — | UNIQUE | (`source_text`, `target_lang`) 복합 유니크 인덱스 |

### `category_embeddings` (모델별/언어별 다중 임베딩, 1:N)

| 컬럼 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | serial | PK | 고유 식별자 |
| `category_id` | bigint | FK → categories.id | 카테고리 참조 |
| `language` | varchar | NOT NULL | 언어 ('ko', 'zh', 'en') |
| `embed_model_name` | varchar | NOT NULL | 임베딩 모델명 (예: 'nomic-embed-text') |
| `embedding` | VECTOR(768) | NOT NULL | pgvector 768차원 벡터 |

> **주의:** VECTOR 차원은 모델에 종속됨 — 모델 변경 시 마이그레이션 필요.

### `search_logs` (검색어 임베딩 캐시 + 검색 이력)

| 컬럼 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | serial | PK | 고유 식별자 |
| `user_id` | bigint | FK → users.id, **Nullable** | 비회원은 NULL |
| `session_id` | varchar | **Nullable** | 비회원 식별용 (LocalStorage UUID) |
| `search_keyword` | varchar | 인덱스 (UNIQUE 아님) | 검색어 |
| `embed_model_name` | varchar | NOT NULL | 사용된 임베딩 모델명 |
| `embedding` | VECTOR(768) | NOT NULL | 검색어 벡터 |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP | 검색 일시 |

---

## 5. 시스템 아키텍처

```
Client → cloudflared tunnel → Nginx (Reverse Proxy)
                                    │
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
              Next.js          Laravel FPM        Reverb WS
            (Port 3000)        (Port 8000)      (Port 8080)
                  /              /api/             /app/
```

**역할 분리:**
- **웹 요청:** Client → Nginx → Next.js (UI) 또는 Laravel FPM (API)
- **비동기 처리:** Laravel → Redis (Job 적재) → `queue:work` (번역/임베딩) → PostgreSQL
- **실시간 통신:** `queue:work` → Redis Pub/Sub → Reverb → Nginx(`/app/`) → Client (Progress)

**Nginx 라우팅 규칙:**
- `/` → Next.js (UI)
- `/api/` → Laravel FPM (REST API)
- `/app/` → Laravel Reverb (WebSocket, Upgrade 헤더 적용)

---

## 6. 핵심 기능 요구사항

### 6.1. 일괄 번역 및 임베딩 파이프라인

**개요:** DB에 적재된 한국어 카테고리를 분할 번역한 후, 각 언어별로 벡터화하여 저장.

**비동기 파이프라인 (Job Chaining):**
번역과 임베딩은 `[텍스트 분할 → 캐시 확인/번역 → 재조립 → 언어별 임베딩]` 과정을 하나의 독립된 파이프라인으로 묶어 `Bus::chain()` 또는 `Bus::batch()`로 연속 실행. 실패 시 해당 Row만 재시도.

**번역 로직 세부사항:**
1. 텍스트 분할: `"가구/인테리어>DIY자재/용품>목재"` → `">"` 기준 분할
2. 캐시 확인/번역: 분할된 단위마다 `translation_cache` 조회 → 없으면 `translategemma:4b` 번역 → 캐시 저장
3. 재조립: 번역된 단어들을 `">"`로 재조립 → `categories.category_name_zh`, `category_name_en` 저장

**AI 예외 처리:**
- 정규식 검증 + 최대 3회 자동 재시도
- 최종 실패 시 `failed_jobs` 테이블 기록

**임베딩 파이프라인:**
- 번역 완료 후 **언어별 `category_name`마다** 별도 임베딩 생성 (하나의 카테고리당 최대 3개 벡터)
- Rate Limit(429) 우회: `Redis::throttle()` 또는 Job 딜레이(Sleep)

### 6.2. 검색 및 추천 엔진

**입력:** 상품 묘사 텍스트 → 타겟 언어 선택 (한국어/중국어/영어) → '추천' 클릭

**LIKE 검색 영역:**
- 선택한 언어 필드에서 `LIKE '%키워드%'` 쿼리 실행
- 결과 리스트의 키워드 **Bold** 처리

**AI 추천 영역:**
1. `search_logs` 테이블에서 정확히 일치하는 `search_keyword` 조회 (캐시 히트 시 임베딩 재사용)
2. 캐시 미스 시 선택된 임베딩 모델로 벡터화 → `search_logs` 저장 후 사용
3. 타겟 언어로 필터링된 `category_embeddings`와 코사인 유사도 계산
4. **언어별 카테고리 추천 리스트** 반환 (유사도 수치 표시)

**임베딩 모델 선택:** UI 상단 Select Box로 사전 등록된 Ollama 모델 선택 (유저 임의 추가 불가)

### 6.3. 실시간 처리 및 WebSocket 제어

**중복 검증 (Locking):**
- '일괄 처리' 실행 시 현재 선택된 언어+모델 조합에 대해 Redis 락(`Cache::lock()`) 또는 DB 플래그로 검증
- 진행 중이라면 중복 적재 방지, 진행률 채널만 구독

**실시간 진행률:**
- Laravel Event & Broadcasting → 파이프라인 상태(번역/임베딩 완료 건수) → Reverb 전송 → 클라이언트 프로그레스 바 렌더링

**저장 규칙:** 결과는 `category_embeddings` 테이블에 저장, 중복 처리 엄격 방지

### 6.4. 추천 결과 UI — 버튼 A & B

**설정값:** 출력할 추천 카테고리 개수 설정 가능 (기본값: 10개)

**버튼 A — 벡터 계산 과정 모달:**
- 제목: "벡터 유사도 계산"
- 원시 벡터 앞 3개 + `"..."` + 뒤 3개 표시
- 벡터 값: `font-mono`, 작게(12px), 회색
- cosine similarity 공식: $cosine\_similarity = \frac{A \cdot B}{||A|| \times ||B||}$
- 최종 유사도: 큰 글씨(2xl), orange-500
- 닫기 버튼

**버튼 B — 동적 계층형 Select Box 모달:**
- `"A>B>C"` 형태의 원시 문자열을 동적으로 파싱하여 계층 구조 생성
- 3단계 Select Box (대분류 / 중분류 / 소분류) 실시간 연동
- 상위 카테고리 변경 시 하위 Select Box 즉시 숨김 + 업데이트
- 최하위 분류 도달 시: 카테고리 코드 + 임베딩 값 표시
- '완료' 버튼으로 리스트 적용

### 6.5. 개별 카테고리 추가 및 이력 관리

**권한:** 카테고리 추가 기능은 **로그인한 사용자 또는 관리자**에게만 노출

**추가 흐름:**
1. 한국어 카테고리명 단일 입력 (Text Input)
2. `category_code` 자동 생성 (영문/숫자 랜덤)
3. 기존 일괄 처리 **동일 Job 클래스**에 카테고리 ID 배열로 전달 → 코드 재사용성 극대화

**히스토리:** 검색 내역, 클릭 결과 기록 → 재검색 제공

---

## 7. 로그인 및 사용자 데이터 관리 격리

### 접근 제어
- 로그인 여부와 관계없이 **메인 페이지 및 검색/추천 기능 접근 가능**
- 카테고리 추가/수정/삭제 등 **데이터 쓰기 작업**은 관리자 전용

### 인증 방식
- 이메일/비밀번호
- OAuth: Google, GitHub, Naver (Socialite)
- 추가 정보 입력 생략

### 데이터 관리 이원화

| 사용자 유형 | 임베딩 캐시 (`search_logs`) | 개인 설정 |
|---|---|---|
| 비회원 (게스트) | `session_id` (LocalStorage UUID) 로 저장 | 브라우저 `LocalStorage` |
| 회원 | `user_id` 에 종속, DB 저장 | DB 저장 및 동기화 |

---

## 8. 다음 개발 마일스톤

### Phase 1: Laravel 비동기 텍스트 파이프라인 (Back-end)
- [ ] 다국어 `categories`, `translation_cache` 모델 + 마이그레이션 (VECTOR(768) 컬럼)
- [ ] `translategemma:4b` 연동, 텍스트 Split/Join 유틸리티, 환각/재시도 방어 로직
- [ ] Job Chaining 구성, 중복 락(Lock), Progress Update Event 클래스
- [ ] API 라우트 및 컨트롤러 연결

### Phase 2: Next.js 실시간 UI 연동 (Front-end)
- [ ] `laravel-echo` + `pusher-js` 패키지 설치
- [ ] Reverb 서버 연결, 이벤트 리스너(구독) 로직
- [ ] 언어 선택 UI, Select Box, 프로그레스 바 컴포넌트

### Phase 3: 언어별 검색 로직 및 최종 연동 (Integration)
- [ ] `pgvector` 언어별 필터링 검색 쿼리 (Laravel DB Raw Query)
- [ ] 버튼 A (벡터 계산 모달) 및 버튼 B (계층형 Select Box 모달) 구현
- [ ] 엔드투엔드 테스트 및 UI 최종 조정

---

## 9. 테스트 및 배포 (CI/CD)

### 테스트 코드 (의무 작성)
- 번역 텍스트 분할/재조림 유틸리티
- AI 응답 예외 처리 및 재시도 로직
- Job Chaining, 중복 방지, Rate Limit 대응
- API 응답 포맷

### 자동화 파이프라인
- GitHub Actions (셀프호스티드 WSL 러너)
- `main` 브랜치 푸시 시: Docker Compose 서비스 재시작 + 데몬 재실행 (`serve`, `reverb`, `queue:work`)
- SonarQube 정적 분석 (`sonar-project.properties`, 키: `cl_embed`)

### 실행 환경
- WSL2에서 직접 개발, 파일 변경 시 즉시 반영 (`WATCHPACK_POLLING`, volume mount)
- Self-Hosted Runner: 컨테이너 재시작 + 백그라운드 데몬 실행 자동화

---

## MVP 제외 사항

- 비회원→회원 마이그레이션 (데이터 이동 로직)
- 카테고리 수정/삭제 UI (관리는 DB 직접)
- 카테고리 계층형 대시보드 UI
- 다중 임베딩 모델 비교 기능 (UI)
- 외부 벡터 DB (Pinecone, Qdrant) 연동
- AI 응답 품질 자동 평가/모니터링
