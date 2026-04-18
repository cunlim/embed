# AI 기반 다국어 카테고리 추천 시스템 PRD

## 1. 프로젝트 개요
본 프로젝트는 사용자의 검색어나 텍스트를 분석하여 가장 적합한 카테고리를 추천해 주는 서비스입니다. 텍스트 데이터를 벡터화(Embedding)하여 저장하고, PostgreSQL의 `pgvector`를 활용한 코사인 유사도 검색을 통해 압도적인 검색 성능과 정확도를 제공하는 것을 목표로 합니다. 대량의 데이터 처리 상태를 사용자에게 실시간으로 보여주는 비동기 파이프라인이 핵심 기술 포인트입니다.

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

## 3. 기술 스택 (Tech Stack)
* **Frontend:** Next.js (Node.js 22, React)
* **Backend:** Laravel 11+ (PHP 8.x FPM)
* **Database:** PostgreSQL 15+ (with `pgvector` extension)
* **In-Memory Store:** Redis (Session, Cache, Queue, Broadcasting)
* **Infrastructure:** Docker & Docker Compose, Nginx (Reverse Proxy)

## 4. 시스템 아키텍처 (System Architecture)
Nginx가 앞단에서 트래픽을 분류하여 각 컨테이너로 전달하며, 백엔드는 메인 API 처리와 백그라운드 큐 처리, 실시간 웹소켓 서버로 역할을 완벽히 분리하여 병목을 방지합니다.

* **웹 요청:** Client ➔ Nginx ➔ Next.js (UI) OR Laravel FPM (API)
* **비동기 처리:** Laravel ➔ Redis (Job 적재) ➔ `queue:work` (백그라운드 임베딩 생성) ➔ PostgreSQL (저장)
* **실시간 통신:** `queue:work` ➔ Redis (Pub/Sub) ➔ Reverb Server ➔ Nginx (`/app`) ➔ Client (진행률 UI 업데이트)

## 5. 핵심 기능 요구사항

### 5.1. 대량 카테고리 임베딩 파이프라인 (Batch Embedding)
* **설명:** 수천/수만 건의 카테고리 텍스트를 LLM(OpenAI 등) API를 통해 벡터 데이터로 변환하여 DB에 저장합니다.
* **요구사항:**
    * API 요청 시 전체 작업을 청크(Chunk) 단위로 분할하여 Redis Queue에 적재해야 합니다.
    * API 서버는 즉시 응답(202 Accepted)하고, 실제 작업은 백그라운드 워커가 처리해야 합니다.

### 5.2. 실시간 진행 상태 브로드캐스팅 (Real-time Progress)
* **설명:** 백그라운드에서 진행 중인 임베딩 작업의 퍼센티지(%)를 프론트엔드에 실시간으로 전달합니다.
* **요구사항:**
    * Laravel의 Event & Broadcasting 시스템을 사용하여 작업 완료 시마다 진행률을 계산하여 Reverb로 전송합니다.
    * 프론트엔드는 Laravel Echo를 사용하여 채널을 구독하고 프로그레스 바(Progress Bar)를 렌더링해야 합니다.

### 5.3. 벡터 기반 추천 검색 (Vector Similarity Search)
* **설명:** 사용자가 텍스트를 입력하면 가장 유사한 카테고리를 즉시 찾아냅니다.
* **요구사항:**
    * 입력된 텍스트를 즉시 임베딩 벡터로 변환합니다.
    * `pgvector`의 `<->` (L2 distance) 또는 `<#>` (Inner product) 연산자를 활용하여 상위 N개의 결과를 반환합니다.

### 5.4. 프론트엔드 대시보드 (Admin / User UI)
* **설명:** 관리자용 데이터 적재 화면과 사용자용 검색 화면을 제공합니다.
* **요구사항:**
    * 데이터 적재 트리거 버튼 및 실시간 진행률 표시 UI.
    * 검색어 입력 폼 및 결과 리스트 출력 UI.

## 6. 다음 개발 마일스톤 (Next Milestones)
* **Phase 1: Laravel 비동기 로직 구현 (Back-end)**
    * 임베딩할 카테고리 테이블(Model) 생성.
    * 임베딩 Job 클래스 및 Progress Update Event 클래스 작성.
    * API 라우트 및 컨트롤러 연결.
* **Phase 2: Next.js 실시간 UI 연동 (Front-end)**
    * `laravel-echo` 및 `pusher-js` 패키지 설치.
    * Reverb 서버 연결 및 이벤트 리스너(구독) 로직 작성.
    * 프로그레스 바 컴포넌트 개발.
* **Phase 3: 검색 로직 및 최종 연동 (Integration)**
    * `pgvector` 검색 쿼리 작성 (Laravel DB Raw Query 활용).
    * 검색 UI 연동 및 엔드투엔드 테스트.
