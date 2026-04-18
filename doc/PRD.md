## AI 기반 다국어 카테고리 추천 시스템 PRD

### 1. 프로젝트 개요
* **목적:** 전통적인 RDBMS의 LIKE 검색과 AI 모델의 Vector Embedding 검색 결과를 실시간으로 비교하고 병렬 처리하는 기술 시연용 포트폴리오 프로젝트.
* **주요 특징:** 백엔드 큐(Queue)와 WebSocket을 활용한 대량 데이터 실시간 임베딩 파이프라인 구축 및 계층형 동적 UI 제공.

### 2. 기술 스택 및 인프라
* **Frontend:** Next.js (node_01 v22.14.0), shadcn/ui
* **Backend:** Laravel (php_01 docker container, FROM php:8.5.3-fpm-bookworm), Laravel Reverb (WebSocket)
* **Database:** PostgreSQL 15 + `pgvector` 확장
* **Infrastructure:** Docker Compose(/var/app/docker/docker-compose.yml), Nginx, WSL Ubuntu
* **CI/CD & Code Quality:** Git, GitHub, GitLab (gitlab.cunlim.dev), SonarQube (sonarqube.cunlim.dev)
* **API Documentation:** Swagger UI 또는 Postman Collection 배포

### 3. 데이터베이스 스키마 및 환경 설정

#### 3.1. PostgreSQL pgvector 설치 가이드
Docker 컨테이너 초기화 시 `pgvector` 확장을 활성화해야 합니다. `init.sql` 스크립트에 다음 명령어를 포함하거나 DB 접속 후 직접 실행합니다.
> `CREATE EXTENSION IF NOT EXISTS vector;`

#### 3.2. 주요 테이블 정의
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
    * `user_id` (FK)
    * `search_keyword` (VARCHAR)
    * `created_at` (TIMESTAMP)

### 4. 핵심 기능 요구사항

#### 4.1. 검색 및 추천 엔진
* **텍스트 입력 및 버튼:** 상품 묘사 텍스트 입력 후 '추천' 버튼 클릭.
* **LIKE 검색 영역:** DB에서 `category_name LIKE '%키워드%'` 쿼리 실행. 결과 리스트에 입력된 키워드는 **Bold** 처리하여 표시.
* **AI 추천 영역:** 입력 텍스트를 선택된 임베딩 모델로 벡터화한 후, 코사인 유사도를 계산하여 적합한 카테고리 나열. 각 결과에 유사도 수치 표시.
* **임베딩 모델 선택:** UI 상단의 Select Box를 통해 소스코드나 DB에 미리 등록된 모델(Ollama 로컬 모델 또는 외부 API) 선택 가능. (유저 임의 모델 추가 불가)

#### 4.2. 실시간 일괄 임베딩 및 WebSocket
* **중복 검증:** 추천 버튼 클릭 시, 현재 선택된 플랫폼 테이블 내에 '현재 선택된 모델'로 임베딩되지 않은 행이 있는지 검사.
* **실시간 처리:** 누락된 행이 있다면 즉시 백엔드에서 일괄 임베딩 작업(Batch) 시작.
* **진행률 표시:** Laravel Reverb를 통해 WebSocket 채널로 진행률(%)을 브로드캐스팅하고 프론트엔드에서 실시간 표시.
* **저장 규칙:** 결과는 `category_embeddings` 테이블에 저장하며 중복 처리를 엄격히 방지.

#### 4.3. 추천 결과 UI 컴포넌트 (버튼 A & B)
* **설정값:** 각 테이블당 출력할 추천 카테고리 개수는 유저별로 설정 가능 (기본값: 10개).
* **버튼 A (벡터 계산 과정 모달):** * 두 데이터 간의 $cosine\_similarity = \frac{A \cdot B}{||A|| ||B||}$ 계산 과정의 원시 벡터 배열의 앞뒤 일부만 표시하고 중간은 줄임표(...)로 생략하여 모달에 출력.
    * 최종 유사도 수치 표시.
* **버튼 B (동적 계층형 Select Box 모달):** * `"A>B>C"` 형태의 문자열을 SQL의 `SPLIT_PART()` 함수 등을 이용해 동적으로 파싱.
    * 해당 카테고리가 대/중/소 단계별로 이미 선택된 상태의 Select Box 렌더링.
    * 상위 카테고리 변경 시 하위 Select Box 실시간 업데이트.
    * "카테고리를 선택해주세요" 클릭 시 하위 Select Box 즉시 숨김 처리.
    * 최하위 분류 도달 시 해당 카테고리 코드와 임베딩 값을 표시하고, '완료' 버튼을 통해 리스트 적용.

#### 4.4. 카테고리 추가 및 이력 관리
* **신규 카테고리 추가:** 리스트 최하단의 "(카테고리 추가)" 항목에서 버튼 B 클릭 시, Select Box가 아닌 Text Input을 제공하여 신규 카테고리명 입력.
* **코드 및 임베딩 자동화:** 추가 완료 시 랜덤한 영문/숫자 조합의 카테고리 코드를 자동 생성하고, 즉시 임베딩을 계산하여 DB에 삽입.
* **히스토리:** 사용자가 검색했던 내역, 클릭 결과, 임베딩 처리 결과를 기록으로 남겨 빠른 재검색 및 삭제 기능 제공.

### 5. 로그인 및 사용자 관리
* **페이지 접근 제어:** 랜딩 페이지 및 로그인 페이지만 비로그인 접근 허용. 그 외 모든 기능은 로그인 필수.
* **인증 방식:** 이메일/비밀번호, Google, GitHub, Naver OAuth 연동. 추가적인 개인정보 입력 단계 생략.
* **계정별 데이터 격리:** 검색 로그, 추천 개수 설정값, 사용자가 직접 추가한 카테고리 등은 각 계정(User ID)에 종속되어 저장 및 관리. (Admin 권한 특수성은 추후 정의)

### 6. 테스트 및 배포 (CI/CD)
* **테스트 코드:** 백엔드 주요 로직(임베딩 파이프라인, 동적 파싱, API 응답)에 대한 테스트 코드 의무 작성.
* **자동화 파이프라인:** GitLab CI/CD를 구성하여 코드 푸시 시 SonarQube 정적 분석 수행 후 타겟 서버(WSL Ubuntu)에 Docker Compose 형태로 자동 배포.



1. postgres_02 컨테이너에 이상의 환경에 사용될수 있게 pgvector 확장 설치 등 추가적인 작업을 어떻게 해야 할지 알려주세요. 현재 postgres_02 에는 sonarqube 용 테이블만 존재할거고 보존하면서 작업할수 있을지도 알려주세요

2. /var/app/www/cl_embed 에는 next.js, laravel 등 모든 소스코드들이 들어있을 폴더입니다. VOL_DIR_WWW_HOST 등 값들을 확인하기 위해 @/var/app/docker/.env 파일도 살펴봐주세요

3. Next.js, laravel 은 /var/app/www/cl_embed 빈 폴더에 0부터 생성하여 작업해야 합니다.

4. MySQL 컨테이너는 사용하지 않고 postgres_02 컨테이너만 연결하여 작업하면 됩니다.

5. OAuth 설정값은 /var/app/www/cl_embed/laravel/.env.01 파일에 저장되어있고 필요한 위치에 이동하고 편집이 필요하면 편집하여 사용하면 됩니다.
