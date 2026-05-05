# AI 기반 다국어 카테고리 추천 시스템 PRD

## 1. 프로젝트 개요
* **목적:** 본 프로젝트는 사용자의 검색어나 텍스트를 분석하여 가장 적합한 카테고리를 추천해 주는 서비스입니다. 단일 카테고리 체계(네이버 기준)를 바탕으로 한국어, 중국어, 영어 다국어를 지원하며, 텍스트 데이터를 벡터화(Embedding)하여 저장하고 PostgreSQL의 `pgvector`를 활용한 코사인 유사도 검색을 통해 압도적인 검색 성능과 정확도를 제공하는 것을 목표로 하는 기술 시연용 포트폴리오 프로젝트입니다.
* **주요 특징:** 백엔드 큐(Queue)와 WebSocket을 활용한 대량 데이터 실시간 번역 및 임베딩 파이프라인 구축, 계층형 동적 UI 제공 및 언어별 맞춤형 추천.

## 2. 현재 진행 상황 (Current Status: 인프라 구축 완료)
가장 난이도가 높은 멀티 컨테이너 환경의 인프라 세팅 및 네트워크 라우팅이 성공적으로 완료되었습니다.
* **도메인 연결:** `https://embed.cunlim.dev` 호스트 연결 완료
* **프론트엔드:** Next.js 기반 컨테이너(`cl_embed_nextjs`, Port 3000) 정상 구동 (`WATCHPACK_POLLING` 적용 완료)
* **백엔드:** Laravel 기반 컨테이너(`cl_embed_laravel`) 정상 구동 (DB 마이그레이션 완료)
* **비동기/실시간 환경:** * Redis 연동 및 `queue:work` 데몬 구동 확인
  * Laravel Reverb (`reverb:start`, Port 8080) 웹소켓 서버 구동 및 101 핸드셰이크 응답 확인
* **리버스 프록시 (Nginx):**
  * `/` ➔ Next.js 로 라우팅
  * `/api/` ➔ Laravel FPM 으로 라우팅
  * `/app/` ➔ Laravel Reverb 웹소켓으로 라우팅 (Upgrade 헤더 적용 완료)

## 3. 기술 스택 및 인프라
* **Frontend:** Next.js (Node v24.15.0, Next.js 16.2.4), shadcn/ui
* **Backend:** Laravel 13.5.0 (php:8.5.5-fpm-trixie)
* **Database:** PostgreSQL 15+ (with `pgvector` extension)
* **In-Memory Store:** Redis (Session, Cache, Queue, Broadcasting)
* **AI Models (Local Ollama):** `translategemma:4b` (번역용), 임베딩용 모델
* **Infrastructure:** Docker & Docker Compose(`./docker/docker-compose.yml`), Nginx (Reverse Proxy), WSL Ubuntu
* **API Documentation:** Swagger UI 또는 Postman Collection 배포
* **Docker Container:** `cl_embed_nextjs`, `cl_embed_laravel`, `cl_embed_pgvector`, `cl_embed_redis`

## 4. 데이터베이스 주요 테이블 정의
* **categories:** (네이버 카테고리 기준 단일 테이블 생성 완료)
  * `id` (bigserial, PK): 고유 식별자
  * `category_code` (varchar(50), UNIQUE, NOT NULL): 플랫폼 영문/숫자 코드
  * `category_name_ko` (varchar(255), NOT NULL): 한국어 카테고리명 (B-tree 인덱스 적용)
  * `category_name_zh` (varchar(255), NULL): 중국어 번역본 (B-tree 인덱스 적용, 초기값 비움)
  * `category_name_en` (varchar(255), NULL): 영어 번역본 (B-tree 인덱스 적용, 초기값 비움)
  * `created_at` (timestamp(0), DEFAULT CURRENT_TIMESTAMP): 생성 일시
  * `updated_at` (timestamp(0), DEFAULT CURRENT_TIMESTAMP): 수정 일시
* **translation_cache:** (번역 비용 및 시간 절감을 위한 중복 방지 테이블)
  * `id` (PK)
  * `source_text` (VARCHAR, 분할된 한국어 원문 텍스트. 예: "가구/인테리어")
  * `target_lang` (VARCHAR, 'zh' 또는 'en')
  * `translated_text` (VARCHAR, 번역된 텍스트)
  * Unique Index (`source_text`, `target_lang`)
* **category_embeddings:** (모델별/언어별 다중 임베딩 지원을 위한 1:N 테이블)
  * `id` (PK)
  * `category_id` (FK)
  * `language` (VARCHAR, 'ko', 'zh', 'en')
  * `embed_model_name` (VARCHAR, 예: 'llama3', 'nomic-embed-text')
  * `embedding` (VECTOR, 다중 모델 지원을 위해 차원 수를 특정하지 않은 가변 타입으로 선언하거나, 성능 최적화가 필수적인 경우 모델별로 파티셔닝된 테이블 구성 고려)
* **search_logs:**
  * `id` (PK)
  * `user_id` (FK, **Nullable** - 비회원은 NULL 처리 또는 LocalStorage 의존)
  * `search_keyword` (VARCHAR)
  * `embed_model_name` (VARCHAR, 예: 'llama3', 'nomic-embed-text')
  * `embedding` (VECTOR, 다중 모델 지원을 위해 차원 수를 특정하지 않은 가변 타입으로 선언하거나, 성능 최적화가 필수적인 경우 모델별로 파티셔닝된 테이블 구성 고려)
  * `created_at` (TIMESTAMP)
  * Unique Index (`search_keyword`)

## 5. 시스템 아키텍처 (System Architecture)
도메인에 접근하면 cloudflared tunnel 을 통해 wsl Nginx docker 컨테이너가 앞단에서 트래픽을 분류하여 각 컨테이너로 전달하며, 백엔드는 메인 API 처리, 백그라운드 번역/임베딩 큐 처리, 실시간 웹소켓 서버로 역할을 완벽히 분리하여 병목을 방지합니다.

* **웹 요청:** Client ➔ cloudflared tunnel ➔ Nginx ➔ Next.js (UI) OR Laravel FPM (API)
* **비동기 처리:** Laravel ➔ Redis (Job 적재) ➔ `queue:work` (백그라운드 번역 및 임베딩 생성) ➔ PostgreSQL (저장)
* **실시간 통신:** `queue:work` ➔ Redis (Pub/Sub) ➔ Reverb Server ➔ Nginx (`/app`) ➔ Client (진행률 UI 업데이트)

## 6. 핵심 기능 요구사항

### 6.1. 일괄 번역 및 임베딩 파이프라인 (Batch Translation & Embedding)
* **설명:** DB에 적재된 한국어 카테고리를 분할 번역한 후, 각 언어별로 텍스트를 벡터 데이터로 변환하여 저장합니다.
* **비동기 파이프라인 (Job Chaining):** 번역과 임베딩은 분리된 작업이 아니라, 개별 카테고리(Row) 단위로 `Bus::chain()` 또는 `Bus::batch()`를 활용하여 **[텍스트 분할 → 캐시 확인/번역 → 재조립 → 언어별 임베딩]** 과정을 하나의 독립된 파이프라인으로 묶어 연속 실행되게 하며, 실패 시 해당 Row만 재시도(Retry)할 수 있도록 구성합니다.
* **번역 로직 세부사항:**
  * 실시간 일괄 처리 파이프라인 내에서 Ollama `translategemma:4b` 모델을 통한 번역 로직을 우선 실행합니다.
  * 텍스트 분할: "가구/인테리어>DIY자재/용품>목재" 문자열을 `>`를 기준으로 나눕니다.
  * 캐싱 및 번역: 나누어진 단일 텍스트("가구/인테리어", "목재" 등)가 `translation_cache` 테이블에 존재하는지 확인하고, 없다면 `translategemma:4b`로 번역 후 캐시에 저장합니다.
  * 재조립: 번역된 단어들을 다시 `>`로 재조립하여 `categories` 테이블의 `category_name_zh`, `category_name_en` 필드에 저장합니다.
* **AI 예외 및 환각(Hallucination) 처리:** Ollama API의 응답 지연이나 환각 현상(예: 번역 결과가 없거나 정해진 포맷을 벗어나는 경우)에 대비하여, 정규식 검증 로직과 최대 3회의 자동 재시도(Retry) 로직을 포함합니다. 최종 실패한 데이터는 `failed_jobs` 테이블에 기록하여 수동 처리가 가능하게 합니다.
* **임베딩 파이프라인:**
  * 번역이 완료된 후 `category_code`가 아닌 **언어별 `category_name`마다** 별도로 임베딩 데이터를 생성합니다. (하나의 카테고리당 언어별 3개의 벡터 생성)
  * **Rate Limit 대응:** 외부/로컬 API의 분당 요청 제한(429 에러)을 우회하기 위해 `Redis::throttle()`을 적용하거나 Job 사이에 의도적인 딜레이(Sleep)를 부여하는 방어 로직을 포함해야 합니다.
  * API 서버는 즉시 응답(202 Accepted)하고, 실제 작업은 백그라운드 워커가 처리합니다.

### 6.2. 검색 및 추천 엔진
* **텍스트 입력 및 버튼:** 상품 묘사 텍스트 입력 후 타겟 언어(한국어/중국어/영어) 선택, '추천' 버튼 클릭.
* **LIKE 검색 영역:** 선택한 언어 필드에서 `LIKE '%키워드%'` 쿼리 실행. 결과 리스트에 입력된 키워드는 **Bold** 처리하여 표시.
* **AI 추천 영역 (언어별 추천):** * 입력 텍스트를 일단 search_logs 에서 검색, 없으면 선택된 임베딩 모델로 벡터화. 벡터 결과는 search_logs 에 저장하여 추후 검색 시 벡터화 과정 없이 조회한 후 코사인 유사도 계산.
  * 타겟 언어로 필터링된 `category_embeddings` 데이터들과 코사인 유사도를 계산. **언어별 카테고리 추천 리스트**를 나열하고 각 결과에 유사도 수치 표시.
* **임베딩 모델 선택:** UI 상단의 Select Box를 통해 소스코드나 DB에 미리 등록된 모델(Ollama 로컬 모델 또는 외부 API) 선택 가능. (유저 임의 모델 추가 불가)

### 6.3. 실시간 처리 및 WebSocket 제어
* **중복 검증 및 동시성 제어 (Locking):** '일괄 처리' 실행 시 현재 선택된 언어와 모델 조합에 대해 작업이 진행 중인지 Redis 락(`Cache::lock()`) 또는 DB 플래그로 검증합니다. 진행 중이라면 중복해서 Queue에 적재하지 않고 진행률 채널만 구독합니다.
* **실시간 처리:** 누락된 행이 있고 락이 걸려있지 않다면 즉시 백엔드에서 일괄 임베딩 작업(Batch) 시작.
* **진행률 표시:** Laravel Event & Broadcasting을 사용하여 파이프라인 진행 상태(번역 완료 건수, 임베딩 완료 건수)를 주기적으로 Reverb로 전송. 프론트엔드에서 프로그레스 바 렌더링.
* **저장 규칙:** 결과는 `category_embeddings` 테이블에 저장하며 중복 처리를 엄격히 방지.

### 6.4. 추천 결과 UI 컴포넌트 (버튼 A & B)
* **설정값:** 출력할 추천 카테고리 개수 설정 가능 (기본값: 10개).
* **버튼 A (벡터 계산 과정 모달):** * 두 데이터 간의 $cosine\_similarity = \frac{A \cdot B}{||A|| ||B||}$ 계산 과정에서 원시 벡터 배열의 앞뒤 일부만 표시하고 중간은 줄임표(...)로 생략 출력. 최종 유사도 표시.
* **버튼 B (동적 계층형 Select Box 모달):** * DB에 저장된 `"A>B>C"` 형태의 원시 문자열을 프론트엔드/백엔드 레벨에서 동적으로 파싱하여 계층 구조 생성.
  * 해당 카테고리가 대/중/소 단계별로 이미 선택된 상태의 Select Box 렌더링.
  * 상위 카테고리 변경 시 하위 Select Box 실시간 업데이트.
  * "카테고리를 선택해주세요" 클릭 시 하위 Select Box 즉시 숨김 처리.
  * 최하위 분류 도달 시 해당 카테고리 코드와 임베딩 값을 표시하고, '완료' 버튼을 통해 리스트 적용.

### 6.5. 개별 카테고리 추가 및 이력 관리
* **권한 제어:** DB 데이터 무결성을 위해 **신규 카테고리 추가 기능은 로그인한 사용자(또는 관리자)에게만 노출 및 허용**됩니다.
* **신규 카테고리 추가 흐름:** * Text Input을 통해 **한국어 카테고리명만 단일 입력**합니다.
  * 추가 완료 시 임의의 영문/숫자 `category_code`를 자동 생성합니다.
  * 이후 일괄 처리와 **동일한 Queue Job 클래스**에 해당 카테고리 ID를 단일 배열로 넘겨 코드 재사용성을 극대화합니다. 동일한 번역 로직 및 언어별 임베딩 로직이 백그라운드에서 즉시 실행되어 DB에 채워집니다.
* **히스토리:** 검색 내역, 클릭 결과를 기록하여 재검색 제공.

## 7. 로그인 및 사용자 데이터 관리 격리
* **접근 제어:** 로그인 여부와 상관없이 메인 페이지 및 검색/추천 기능 접근 가능. 최고관리자 페이지가 존재하여 검색/추천 기능에 접근할수 있는지 여부를 컨트롤 할수 있게 해야 함.
* **인증 방식:** 이메일/비밀번호, Google, GitHub, Naver OAuth 연동. 아이디 등 추가 정보 입력 생략.
* **데이터 관리 이원화:**
  * **비회원 (게스트):** 검색 로그, 추천 개수 설정값 등은 브라우저의 `LocalStorage`에 저장하여 DB 부하 및 찌꺼기 데이터 생성을 방지합니다.
  * **회원:** OAuth (Google, GitHub, Naver) 로그인 지원, 사용자 활동 데이터들은 각 계정(`User ID`)에 종속되어 DB에 저장 및 동기화됩니다.

## 8. 다음 개발 마일스톤 (Next Milestones)
* **Phase 1: Laravel 비동기 텍스트 파이프라인 구현 (Back-end)**
  * 다국어 `categories`, `translation_cache` 모델 및 마이그레이션 구성 (가변 VECTOR 컬럼 적용).
  * `translategemma:4b` 연동 로직, 텍스트 Split/Join 유틸리티 클래스 작성 및 환각/재시도 방어 로직 구현.
  * Job Chaining 구성, 중복 락(Lock) 처리, Progress Update Event 클래스 작성.
  * API 라우트 및 컨트롤러 연결.
* **Phase 2: Next.js 실시간 UI 연동 (Front-end)**
  * `laravel-echo` 및 `pusher-js` 패키지 설치.
  * Reverb 서버 연결 및 이벤트 리스너(구독) 로직 작성.
  * 언어 선택 UI 및 프로그레스 바 컴포넌트 개발.
* **Phase 3: 언어별 검색 로직 및 최종 연동 (Integration)**
  * `pgvector` 언어별 필터링 검색 쿼리 작성 (Laravel DB Raw Query 활용).
  * 최종 UI 연동 및 엔드투엔드 테스트 수행.

## 9. 테스트 및 배포 (CI/CD)
* **테스트 코드:** 백엔드 주요 로직(번역 텍스트 분할/재조립, AI 응답 예외 처리, Job Chaining, 중복 방지, Rate Limit 대응, API 응답)에 대한 테스트 코드 의무 작성.
* **자동화 파이프라인:** github CI/CD를 구성하여 코드 푸시 시 `테스트 실행`, `SonarQube 정적 분석 수행` 필요.
* **실행 환경:** 현재 WSL2 에서 직접 개발, 저장 즉시 배포(WATCHPACK_POLLING, volume). 내부 Self-Hosted Runner를 통해 컨테이너 재시작 및 백그라운드 데몬(`queue`, `reverb`, `serve`) 실행 자동화.
