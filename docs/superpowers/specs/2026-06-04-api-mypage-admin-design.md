# API Key 관리 + 마이페이지 + 관리자 회원관리 설계

**작성일:** 2026-06-04
**상태:** 승인됨

## 1. 개요

### 1.1 목적
- 마이페이지에서 API key 관리 및 사용량 통계 확인
- 외부 API 제공 (`POST /api/v1/search`) — 카테고리 유사도 검색 전용
- 관리자 페이지에서 회원 관리 및 API 사용량 모니터링

### 1.2 범위
- API key 생성/삭제/일시정지 (개별 key 단위)
- 무료 호출 회수 100회 (가입 시 자동 할당, settings 테이블에서 관리)
- 분당 rate limit + 호출 회수 quota 이중 제한
- 관리자: 회원별 사용량 통계, 회수 조절 (절대값/증감)
- API 문서 작성 (`docs/`)

## 2. 데이터베이스 스키마

### 2.1 `api_keys` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | 자동 증가 |
| `user_id` | bigint (FK → users, cascade) | 소유자 |
| `name` | string(100) | 키 이름 (사용자 지정) |
| `key` | string(64) | `cl_` + 랜덤 문자열 (고유) |
| `status` | enum('active','paused') | 상태 (기본: 'active') |
| `last_used_at` | timestamp (nullable) | 마지막 사용 시간 |
| `created_at` | timestamp | 생성 시간 |
| `updated_at` | timestamp | 수정 시간 |

**인덱스:** `key` (unique), `user_id`, `status`

### 2.2 `api_usage_logs` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint (PK) | 자동 증가 |
| `api_key_id` | bigint (FK → api_keys, cascade) | 사용된 API key |
| `user_id` | bigint (FK → users, cascade) | 소유자 (조회 편의) |
| `endpoint` | string(100) | 호출된 엔드포인트 |
| `parameters` | json (nullable) | 요청 파라미터 요약 |
| `response_status` | smallint | HTTP 상태 코드 |
| `processing_time_ms` | integer | 처리 시간 (ms) |
| `created_at` | timestamp | 호출 시간 |

**인덱스:** `user_id`, `api_key_id`, `created_at`

### 2.3 `users` 테이블 확장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `api_quota_remaining` | integer (default: 100) | 남은 무료 호출 회수 |
| `api_quota_limit` | integer (default: 100) | 총 할당 회수 (관리자 조절용) |

### 2.4 `settings` 테이블 신규 항목

| group | key | value | type | description |
|-------|-----|-------|------|-------------|
| `api` | `free_quota` | `100` | `integer` | 신규 가입 시 무료 호출 회수 |
| `api` | `rate_limit_per_minute` | `60` | `integer` | 분당 최대 호출 수 |

## 3. API 설계

### 3.1 외부 API (`POST /api/v1/search`)

**인증:** API key를 헤더에 전달
```
Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx
```

**요청 파라미터:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `text` | string (max:500) | 예 | - | 유사도 검색어 |
| `target_language` | string (in:ko,zh,en) | 아니오 | `ko` | 대상 언어 |
| `page` | integer (min:1) | 아니오 | 1 | 페이지 번호 |
| `per_page` | integer (min:1, max:50) | 아니오 | 20 | 페이지당 결과 수 |
| `keyword` | string (max:500) | 아니오 | null | 키워드 필터 |
| `folder` | string (max:100) | 아니오 | null | 폴더 필터 |
| `lang` | string (in:ko,zh,en) | 아니오 | `target_language` | 분류선택 계층 언어 |
| `mode` | string (in:hierarchy,search) | 아니오 | `search` | 검색 모드 (hierarchy=접두사, search=부분검색) |
| `slang` | string (in:ko,zh,en) | 아니오 | null | 유사도 검색 언어 (지정 시 해당 언어로만 검색) |

**내부 동작 (외부 노출 안 함):**
- `filter`는 항상 `"my"`로 고정 (사용자 본인 카테고리만 반환)
- API key 소유자의 `user_id`를 자동으로 스코핑

**응답 형식:**
```json
{
  "data": [
    {
      "category_code": "ABC123",
      "category_name": "카테고리명",
      "similarity_score": 0.9876
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 20,
    "total": 100
  }
}
```

**에러 응답:**

| 상태 | 코드 | 설명 |
|------|------|------|
| 401 | `unauthorized` | API key 누락 또는 유효하지 않음 |
| 403 | `key_paused` | API key가 일시정지 상태 |
| 429 | `quota_exceeded` | 무료 호출 회수 초과 |
| 429 | `rate_limit_exceeded` | 분당 호출 제한 초과 |
| 422 | `validation_error` | 파라미터 유효성 검증 실패 |

### 3.2 마이페이지 API (내부)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/mypage/api-keys` | API key 목록 조회 |
| `POST` | `/api/mypage/api-keys` | API key 생성 |
| `PATCH` | `/api/mypage/api-keys/{id}` | API key 이름 변경/상태 변경 |
| `DELETE` | `/api/mypage/api-keys/{id}` | API key 삭제 |
| `GET` | `/api/mypage/usage` | 사용량 통계 조회 |
| `GET` | `/api/mypage/usage/history` | 최근 호출 이력 |
| `GET` | `/api/mypage/usage/chart` | 기간별 추이 데이터 |

### 3.3 관리자 API (확장)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/admin/users` | 회원 목록 (기존 확장) |
| `GET` | `/api/admin/users/{id}` | 회원 상세 + API 사용량 |
| `PATCH` | `/api/admin/users/{id}/quota` | 회원 회수 조절 |

## 4. 백엔드 아키텍처

### 4.1 파일 구조

```
laravel/
  app/
    Http/
      Controllers/Api/
        ApiController.php          # 외부 API (POST /api/v1/search)
        MyPageController.php       # 마이페이지 API
      Middleware/
        ApiKeyAuth.php             # API key 인증 + quota 체크
        ApiRateLimit.php           # 분당 rate limit
      Requests/
        ApiSearchRequest.php       # 외부 API 검증
        ApiKeyStoreRequest.php     # API key 생성 검증
        QuotaAdjustRequest.php     # 관리자 회수 조절 검증
    Models/
      ApiKey.php                   # API key 모델
      ApiUsageLog.php              # 사용량 로그 모델
    Services/
      ApiKeyService.php            # API key CRUD + 통계
      ApiUsageService.php          # 사용량 추적 + 통계
    Policies/
      ApiKeyPolicy.php             # API key 소유권 검증
  database/
    migrations/
      create_api_keys_table.php
      create_api_usage_logs_table.php
      add_api_quota_to_users_table.php
```

### 4.2 요청 흐름

```
POST /api/v1/search
  ↓
ApiRateLimit 미들웨어 (분당 제한 체크)
  ↓
ApiKeyAuth 미들웨어 (key 검증 + status 체크 + quota 체크)
  ↓
ApiController@search
  ↓
RecommendationService::recommendPaginated() (기존 서비스 재사용)
  ↓
ApiUsageService::log() (사용량 기록)
  ↓
응답 반환
```

### 4.3 미들웨어 체이닝

```php
// routes/api.php
Route::prefix('v1')->group(function () {
    Route::middleware(['api.rate_limit', 'api.key_auth'])->group(function () {
        Route::post('/search', [ApiController::class, 'search']);
    });
});
```

## 5. 프론트엔드 설계

### 5.1 파일 구조

```
nextjs/
  app/
    mypage/
      page.tsx                 # 마이페이지 (서버 컴포넌트)
      layout.tsx               # 마이페이지 레이아웃
      page-content.tsx         # 클라이언트 컴포넌트
    admin/
      page-content.tsx         # 수정: 사이드바에 '회원 관리' 추가
      layout.tsx               # 수정: 메뉴 항목 추가
  components/
    mypage/
      api-key-section.tsx      # API key 관리 섹션
      api-key-card.tsx         # 개별 API key 카드
      api-key-create-dialog.tsx # API key 생성 다이얼로그
      usage-dashboard.tsx      # 사용량 대시보드
      usage-chart.tsx          # 기간별 추이 차트
      usage-history.tsx        # 최근 호출 이력 테이블
    admin/
      user-management.tsx      # 회원 관리 패널
      user-detail-modal.tsx    # 회원 상세 모달
      quota-adjust-dialog.tsx  # 회수 조절 다이얼로그
  hooks/
    useMyPage.ts               # 마이페이지 데이터 훅
    useApiKeys.ts              # API key CRUD 훅
    useUsageStats.ts           # 사용량 통계 훅
  lib/
    api.ts                     # 수정: 마이페이지/관리자 API 함수 추가
```

### 5.2 마이페이지 레이아웃

```
┌─────────────────────────────────────────────┐
│  헤더 (닉네임 → /mypage 링크)                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  API Key 관리                        │    │
│  │  [+ 새 API key 생성]                 │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │ cl_xxxx...  [활성] [수정] [삭제]│    │    │
│  │  │ last used: 2026-06-04 14:30  │    │    │
│  │  └─────────────────────────────┘    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  사용량 대시보드                      │    │
│  │  [총 호출: 1,234] [남은 회수: 50]    │    │
│  │  [오늘 호출: 12] [활성 key: 3개]     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  기간별 추이 차트                     │    │
│  │  (일별/주별 호출 추이)                │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  최근 호출 이력                       │    │
│  │  [날짜] [엔드포인트] [상태] [처리시간] │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.3 관리자 회원 관리 모달

```
┌─────────────────────────────────────────────┐
│  회원 상세 - 홍길동 (hong@example.com)       │
├─────────────────────────────────────────────┤
│                                             │
│  기본 정보                                  │
│  [이름] [이메일] [역할] [가입일]             │
│                                             │
│  API 사용량 통계                            │
│  [총 호출: 5,678] [남은 회수: 150]          │
│  [오늘 호출: 23] [활성 key: 2개]            │
│                                             │
│  회수 조절                                  │
│  [절대값: ___] [증감: +/- ___] [적용]       │
│                                             │
│  기간별 추이 차트                            │
│  (일별/주별 호출 추이)                       │
│                                             │
│  Key별 사용량                               │
│  [cl_xxxx: 1,234회] [cl_yyyy: 456회]        │
│                                             │
│  최근 호출 이력                              │
│  [날짜] [key] [엔드포인트] [상태]            │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.4 헤더 수정

기존 헤더의 닉네임 부분에 `/mypage` 링크 추가.

## 6. 테스트 전략

### 6.1 백엔드 테스트

| 테스트 | 설명 |
|--------|------|
| `ApiKeyModelTest` | API key 생성, 상태 변경, 삭제 |
| `ApiSearchTest` | 엔드포인트 전체 시나리오 (정상, 인증 실패, quota 초과, rate limit) |
| `MyPageApiTest` | 마이페이지 API CRUD + 통계 |
| `AdminUserApiTest` | 관리자 회원 관리 + 회수 조절 |
| `ApiUsageLogTest` | 사용량 기록 정확성 |

### 6.2 프론트엔드 테스트

| 테스트 | 설명 |
|--------|------|
| `MyPage 렌더링` | 마이페이지 정상 렌더링 |
| `API key 생성/삭제` | CRUD 동작 확인 |
| `관리자 모달` | 회원 상세 모달 열기/닫기/회수 조절 |

## 7. API 문서

별도 파일 `docs/api-v1.md`로 작성. 외부 개발자를 위한 가이드 포함.
