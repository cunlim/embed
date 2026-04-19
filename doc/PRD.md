# AI 기반 다국어 카테고리 추천 시스템 PRD

## 1. 프로젝트 개요
* **목적:** 본 프로젝트는 사용자의 검색어나 텍스트를 분석하여 가장 적합한 카테고리를 추천해 주는 서비스입니다. 텍스트 데이터를 벡터화(Embedding)하여 저장하고, PostgreSQL의 `pgvector`를 활용한 코사인 유사도 검색을 통해 압도적인 검색 성능과 정확도를 제공하는 것을 목표로 하는 기술 시연용 포트폴리오 프로젝트.
* **주요 특징:** 백엔드 큐(Queue)와 WebSocket을 활용한 대량 데이터 실시간 임베딩 파이프라인 구축 및 계층형 동적 UI 제공.

## 2. 현재 진행 상황 (Current Status: 인프라 구축 완료)
가장 난이도가 높은 멀티 컨테이너 환경의 인프라 세팅 및 네트워크 라우팅이 성공적으로 완료되었습니다.
* **도메인 연결:** `https://embed.cunlim.dev` 호스트 연결 완료
* **프론트엔드:** Next.js 기반 컨테이너(`nextjs_01`, Port 3000) 정상 구동 (`WATCHPACK_POLLING` 적용 완료)
* **백엔드:** Laravel 기반 컨테이너(`php_01`, Port 9000/FPM) 정상 구동 (DB 마이그레이션 완료)
* **비동기/실시간 환경:** * Redis 연동 및 `queue:work` 데몬 구동 확인
    * Laravel Reverb (`reverb:start`, Port 8080) 웹소켓 서버 구동 및 101 핸드셰이크 응답 확인
* **리버스 프록시 (Nginx):**
    * `/` ➔ Next.js 로 라우팅
    * `/api/` ➔ Laravel FPM 으로 라우팅
    * `/app/` ➔ Laravel Reverb 웹소켓으로 라우팅 (Upgrade 헤더 적용 완료)

## 3. 기술 스택 및 인프라
* **Frontend:** Next.js (node v24.15.0, next.js 16.2.4), shadcn/ui
* **Backend:** Laravel 13.5.0 (php:8.5.3-fpm-bookworm)
* **Database:** PostgreSQL 15+ (with `pgvector` extension)
* **In-Memory Store:** Redis (Session, Cache, Queue, Broadcasting)
* **Infrastructure:** Docker & Docker Compose(/var/app/docker/docker-compose.yml, ./docker/docker-compose.yml), Nginx (Reverse Proxy), WSL Ubuntu
* **API Documentation:** Swagger UI 또는 Postman Collection 배포
* **docker container:** nextjs_01, php_01, pgvector_03, redis_04

## 4. 데이터베이스 주요 테이블 정의
* **categories_coupang / categories_naver / categories_taobao:**
    * `id` (PK)
    * `category_code` (VARCHAR, 플랫폼별 영문/숫자 코드)
    * `category_name` (VARCHAR, 예: "패션의류>여성의류>레깅스")
* **category_embeddings:** (모델별 다중 임베딩 지원을 위한 1:N 테이블)
    * `id` (PK)
    * `platform_type` (VARCHAR, 'coupang', 'naver', 'taobao')
    * `category_id` (FK)
    * `embed_model_name` (VARCHAR, 예: 'llama3', 'nomic-embed-text')
    * `embedding` (VECTOR, AI 모델이 반환한 벡터 데이터)
* **search_logs:**
    * `id` (PK)
    * `user_id` (FK, **Nullable** - 비회원은 NULL 처리 또는 LocalStorage 의존)
    * `search_keyword` (VARCHAR)
    * `created_at` (TIMESTAMP)

## 5. 시스템 아키텍처 (System Architecture)
Nginx가 앞단에서 트래픽을 분류하여 각 컨테이너로 전달하며, 백엔드는 메인 API 처리와 백그라운드 큐 처리, 실시간 웹소켓 서버로 역할을 완벽히 분리하여 병목을 방지합니다.

* **웹 요청:** Client ➔ Nginx ➔ Next.js (UI) OR Laravel FPM (API)
* **비동기 처리:** Laravel ➔ Redis (Job 적재) ➔ `queue:work` (백그라운드 임베딩 생성) ➔ PostgreSQL (저장)
* **실시간 통신:** `queue:work` ➔ Redis (Pub/Sub) ➔ Reverb Server ➔ Nginx (`/app`) ➔ Client (진행률 UI 업데이트)

## 6. 핵심 기능 요구사항

### 6.1. 대량 카테고리 임베딩 파이프라인 (Batch Embedding)
* **설명:** 수천/수만 건의 카테고리 텍스트를 LLM(OpenAI 등) API를 통해 벡터 데이터로 변환하여 DB에 저장합니다.
* **요구사항:**
    * API 요청 시 전체 작업을 청크(Chunk) 단위로 분할하여 Redis Queue에 적재해야 합니다.
    * **Rate Limit 대응:** 외부 API의 분당 요청 제한(429 에러)을 우회하기 위해 `Redis::throttle()`을 적용하거나 Job 사이에 의도적인 딜레이(Sleep)를 부여하는 방어 로직을 포함해야 합니다.
    * API 서버는 즉시 응답(202 Accepted)하고, 실제 작업은 백그라운드 워커가 처리합니다.

### 6.2. 검색 및 추천 엔진
* **텍스트 입력 및 버튼:** 상품 묘사 텍스트 입력 후 '추천' 버튼 클릭.
* **LIKE 검색 영역:** DB에서 `category_name LIKE '%키워드%'` 쿼리 실행. 결과 리스트에 입력된 키워드는 **Bold** 처리하여 표시.
* **AI 추천 영역:** 입력 텍스트를 선택된 임베딩 모델로 벡터화한 후, 코사인 유사도를 계산하여 적합한 카테고리 나열. 각 결과에 유사도 수치 표시.
* **임베딩 모델 선택:** UI 상단의 Select Box를 통해 소스코드나 DB에 미리 등록된 모델(Ollama 로컬 모델 또는 외부 API) 선택 가능. (유저 임의 모델 추가 불가)

### 6.3. 실시간 일괄 임베딩 및 WebSocket
* **중복 검증 및 동시성 제어 (Locking):** 추천 버튼 클릭 시, 현재 선택된 플랫폼과 모델 조합에 대해 이미 백그라운드 임베딩 작업이 진행 중인지 Redis 락(`Cache::lock()`) 또는 DB 플래그로 검증합니다. 진행 중이라면 중복해서 Queue에 적재하지 않고 진행률 채널만 구독합니다.
* **실시간 처리:** 누락된 행이 있고 락이 걸려있지 않다면 즉시 백엔드에서 일괄 임베딩 작업(Batch) 시작.
* **진행률 표시:** Laravel Event & Broadcasting을 사용하여 작업 완료 시마다 진행률을 Reverb로 전송하고, 프론트엔드는 Laravel Echo로 채널을 구독하여 프로그레스 바(Progress Bar)를 렌더링합니다.
* **저장 규칙:** 결과는 `category_embeddings` 테이블에 저장하며 중복 처리를 엄격히 방지.

### 6.4. 추천 결과 UI 컴포넌트 (버튼 A & B)
* **설정값:** 각 테이블당 출력할 추천 카테고리 개수 설정 가능 (기본값: 10개).
* **버튼 A (벡터 계산 과정 모달):** * 두 데이터 간의 $cosine\_similarity = \frac{A \cdot B}{||A|| ||B||}$ 계산 과정의 원시 벡터 배열의 앞뒤 일부만 표시하고 중간은 줄임표(...)로 생략하여 모달에 출력.
    * 최종 유사도 수치 표시.
* **버튼 B (동적 계층형 Select Box 모달):** * DB에 저장된 `"A>B>C"` 형태의 원시 문자열을 프론트엔드/백엔드 레벨에서 동적으로 파싱하여 계층 구조 생성.
    * 해당 카테고리가 대/중/소 단계별로 이미 선택된 상태의 Select Box 렌더링.
    * 상위 카테고리 변경 시 하위 Select Box 실시간 업데이트.
    * "카테고리를 선택해주세요" 클릭 시 하위 Select Box 즉시 숨김 처리.
    * 최하위 분류 도달 시 해당 카테고리 코드와 임베딩 값을 표시하고, '완료' 버튼을 통해 리스트 적용.

### 6.5. 카테고리 추가 및 이력 관리
* **권한 제어:** DB 데이터 무결성을 위해 **신규 카테고리 추가 기능은 로그인한 사용자(또는 관리자)에게만 노출 및 허용**됩니다.
* **신규 카테고리 추가:** 리스트 최하단의 "(카테고리 추가)" 항목에서 버튼 B 클릭 시, Select Box가 아닌 Text Input을 제공하여 신규 카테고리명 입력.
* **코드 및 임베딩 자동화:** 추가 완료 시 랜덤한 영문/숫자 조합의 카테고리 코드를 자동 생성하고, 즉시 임베딩을 계산하여 DB에 삽입.
* **히스토리:** 검색 내역, 클릭 결과 등을 기록으로 남겨 재검색 기능을 제공합니다.

## 7. 로그인 및 사용자 데이터 관리 격리
* **접근 제어:** 로그인 여부와 상관없이 메인 페이지 및 검색/추천 기능 접근 가능.
* **인증 방식:** 이메일/비밀번호, Google, GitHub, Naver OAuth 연동. 추가 정보 입력 생략.
* **데이터 관리 이원화:**
    * **비회원 (게스트):** 검색 로그, 추천 개수 설정값 등은 브라우저의 `LocalStorage`에 저장하여 DB 부하 및 찌꺼기 데이터 생성을 방지합니다.
    * **회원 (로그인 유저):** 해당 데이터들은 각 계정(`User ID`)에 종속되어 DB에 저장 및 동기화됩니다.

## 8. 다음 개발 마일스톤 (Next Milestones)
* **Phase 1: Laravel 비동기 로직 구현 (Back-end)**
    * 임베딩할 카테고리 테이블(Model) 생성.
    * 중복 락(Lock) 처리, 임베딩 Job 클래스 및 Progress Update Event 클래스 작성.
    * API 라우트 및 컨트롤러 연결.
* **Phase 2: Next.js 실시간 UI 연동 (Front-end)**
    * `laravel-echo` 및 `pusher-js` 패키지 설치.
    * Reverb 서버 연결 및 이벤트 리스너(구독) 로직 작성.
    * 프로그레스 바 컴포넌트 개발.
* **Phase 3: 검색 로직 및 최종 연동 (Integration)**
    * `pgvector` 검색 쿼리 작성 (Laravel DB Raw Query 활용).
    * 검색 UI 연동 및 엔드투엔드 테스트.

## 9. 테스트 및 배포 (CI/CD)
* **테스트 코드:** 백엔드 주요 로직(임베딩 파이프라인 중복 방지, Rate Limit 대응, API 응답)에 대한 테스트 코드 의무 작성.
* **자동화 파이프라인:** GitLab CI/CD를 구성하여 코드 푸시 시 SonarQube 정적 분석 수행 후 타겟 서버(WSL Ubuntu)에 Docker Compose 형태로 자동 배포.
