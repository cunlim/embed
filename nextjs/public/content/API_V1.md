# API 연동 가이드

CL Embed는 REST API를 통해 카테고리 유사도 검색 및 데이터 관리를 수행할 수 있습니다.

## 인증 방식

### API Key

시스템 연동용 API Key입니다. [마이페이지](/mypage)에서 생성할 수 있습니다.

```
Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx
```

- `cl_` 접두사로 시작하는 64자 문자열
- 개별 key 단위로 활성/일시정지 관리 가능
- 무료 호출 회수(기본 500회) 및 분당 Rate Limit 적용

---

## API v1

### POST /api/v1/search

카테고리 유사도 검색을 수행합니다. API Key 인증이 필요합니다.

**Base URL:** `https://embed.cunlim.dev/api/v1`

#### 요청 파라미터 상세

| 파라미터 | 필수 | 타입 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `text` | **예** | string (max:500) | - | 유사도 검색어. 입력 텍스트를 임베딩 벡터로 변환하여 가장 유사한 카테고리를 검색합니다. |
| `target_language` | 아니오 | string | `ko` | 검색 결과로 반환할 카테고리명의 언어. `ko`(한국어), `en`(영어), `zh`(중국어) 중 선택. |
| `page` | 아니오 | integer (min:1) | `1` | 페이지 번호. 1부터 시작합니다. |
| `per_page` | 아니오 | integer (min:1, max:50) | `20` | 페이지당 결과 수. 최대 50개까지 요청 가능합니다. |
| `keyword` | 아니오 | string (max:500) | `null` | 키워드 필터. 지정 시 카테고리명/코드에 해당 키워드가 포함된 결과만 반환합니다. |
| `folder` | 아니오 | string (max:100) | `null` | 폴더 필터. 지정된 폴더에 속한 카테고리로 검색 범위를 제한합니다. |
| `mode` | 아니오 | string | `search` | 검색 모드. `search`(부분 검색 — 카테고리명에 키워드 포함), `hierarchy`(접두사 검색 — 카테고리명이 키워드로 시작). |
| `lang` | 아니오 | string | - | 분류선택 계층 언어. `mode=hierarchy`일 때만 유효. `ko`, `en`, `zh` 중 선택. 계층 드롭다운 표시 언어를 결정합니다. |
| `slang` | 아니오 | string | - | 유사도 검색 언어. 지정 시(`ko`, `en`, `zh`) 해당 언어로만 유사도 검색을 수행합니다. 미지정 시 모든 언어를 대상으로 검색합니다. |

#### mode 파라미터 상세 설명

`mode` 파라미터는 검색 동작 방식을 결정합니다:

| mode 값 | 동작 | keyword 검색 방식 | 용도 |
|---------|------|-------------------|------|
| `search` (기본) | 부분 검색 | `%keyword%` — 카테고리명 어디에나 포함 | 일반 검색 |
| `hierarchy` | 접두사 검색 | `keyword%` — 카테고리명이 키워드로 시작 | 분류선택 계층 탐색 |

`mode=hierarchy` 사용 시 `lang` 파라미터로 계층 표시 언어를 지정할 수 있습니다 (예: `lang=ko` → 한국어 카테고리명 기준).

#### 응답 형식

```json
{
  "success": true,
  "data": [
    {
      "category_code": "ENV001",
      "category_name": "환경 보호 정책",
      "similarity_score": 0.95
    },
    {
      "category_code": "ENV002",
      "category_name": "자연환경 보존",
      "similarity_score": 0.87
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 45,
    "last_page": 3
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 요청 성공 여부 |
| `data[].category_code` | string | 카테고리 코드 |
| `data[].category_name` | string | 카테고리명 (target_language 기준) |
| `data[].similarity_score` | float | 유사도 점수 (0~1, 높을수록 유사) |
| `meta.current_page` | integer | 현재 페이지 번호 |
| `meta.per_page` | integer | 페이지당 결과 수 |
| `meta.total` | integer | 전체 결과 수 |
| `meta.last_page` | integer | 마지막 페이지 번호 |

#### 요청 예시

**기본 검색:**
```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "환경 보호",
    "target_language": "ko"
  }'
```

**키워드 + 폴더 필터:**
```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "의류",
    "target_language": "ko",
    "keyword": "여름",
    "folder": "시즌상품",
    "page": 1,
    "per_page": 10
  }'
```

**계층 탐색 모드 (접두사 검색):**
```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "의류",
    "target_language": "ko",
    "mode": "hierarchy",
    "lang": "ko",
    "keyword": "여성"
  }'
```

**특정 언어로만 유사도 검색:**
```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "电子设备",
    "target_language": "zh",
    "slang": "zh"
  }'
```

#### 에러 응답

| HTTP 상태 | 코드 | 설명 | 대응 방법 |
|-----------|------|------|-----------|
| 401 | `unauthorized` | API Key가 없거나 유효하지 않음 | 올바른 API Key인지 확인하세요. |
| 403 | `key_paused` | API Key가 일시정지 상태 | 마이페이지에서 Key를 활성화하세요. |
| 422 | `validation_error` | 요청 파라미터 검증 실패 | 응답 메시지에서 누락/잘못된 파라미터를 확인하세요. |
| 429 | `quota_exceeded` | 무료 호출 회수 초과 | 관리자에게 회수 증량을 문의하세요. |
| 429 | `rate_limit_exceeded` | 분당 호출 제한 초과 | `Retry-After` 헤더에 명시된 시간(초) 후 재시도하세요. |

에러 응답 예시:
```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "text 필드는 필수입니다."
  }
}
```

#### Rate Limit

- **분당 60회** 요청 제한 (API Key별 개별 적용)
- 응답 헤더로 현재 상태를 확인할 수 있습니다:

| 헤더 | 설명 |
|------|------|
| `X-RateLimit-Limit` | 분당 최대 요청 수 |
| `X-RateLimit-Remaining` | 현재 윈도우 내 남은 요청 수 |
| `Retry-After` | 제한 초과 시 재시도까지 대기 시간 (초) |

#### 무료 호출 회수

- 회원가입 시 **500회** 무료 호출이 제공됩니다.
- 회수는 총 사용량 기준이며, 마이페이지에서 잔여 회수를 확인할 수 있습니다.
- 관리자가 회원별로 회수를 조절할 수 있습니다.

---

## Swagger (OpenAPI)

CL Embed는 OpenAPI 3.0 스펙 문서를 제공합니다. Swagger Editor 등 OpenAPI 도구에서 API를 탐색하고 테스트할 수 있습니다.

### OpenAPI JSON 스펙

**URL:** [https://embed.cunlim.dev/api/documentation](https://embed.cunlim.dev/api/documentation)

위 URL에서 OpenAPI 3.0 JSON 스펙을 직접 확인할 수 있습니다.

### Swagger Editor에서 열기

1. [Swagger Editor](https://editor.swagger.io)에 접속합니다.
2. 상단 메뉴 **File → Import URL** 을 선택합니다.
3. `https://embed.cunlim.dev/api/documentation` 을 입력하고 확인합니다.
4. 좌측에서 API 스펙을, 우측에서 Swagger UI를 확인할 수 있습니다.

### curl로 API 호출하기

Swagger UI 대신 `curl` 명령어로 직접 API를 호출할 수 있습니다. 예시:

```bash
# 로그인
curl -X POST https://embed.cunlim.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 토큰으로 카테고리 조회
curl https://embed.cunlim.dev/api/categories \
  -H "Authorization: Bearer {token}"
  
# 카테고리 추천
curl -X POST https://embed.cunlim.dev/api/recommend \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"text": "여름 원피스", "target_language": "ko"}'
```

### Swagger 제공 엔드포인트

현재 Swagger에 문서화된 엔드포인트:

| 태그 | 엔드포인트 | 설명 |
|------|-----------|------|
| Auth | `POST /api/auth/register` | 회원가입 |
| Auth | `POST /api/auth/login` | 로그인 |
| Auth | `POST /api/auth/logout` | 로그아웃 |
| Auth | `GET /api/auth/user` | 현재 사용자 정보 |
| Auth | `GET /api/auth/{provider}/redirect` | OAuth 리다이렉트 |
| Auth | `GET /api/auth/{provider}/callback` | OAuth 콜백 |
| Categories | `GET /api/categories` | 카테고리 목록 |
| Categories | `POST /api/categories` | 카테고리 생성 |
| Categories | `GET /api/categories/{id}` | 카테고리 상세 |
| Categories | `GET /api/categories/{id}/translations` | 번역 상태 |
| Categories | `POST /api/categories/{id}/run-step` | 처리 단계 실행 |
| Categories | `PUT /api/categories/{id}/update-text` | 텍스트 수정 |
| Categories | `DELETE /api/categories/{id}` | 카테고리 삭제 |
| Recommend | `POST /api/recommend` | 카테고리 추천 |
| System | `GET /api/health` | 서버 상태 확인 |

> **참고:** 폴더 관리, 마이페이지, 관리자 API, API v1 엔드포인트는 현재 Swagger 문서에 포함되어 있지 않습니다. 이 엔드포인트들은 본 문서의 파라미터 표를 참조해 주세요.

---

## 언어 코드

모든 API에서 언어 지정 시 다음 코드를 사용합니다:

| 코드 | 언어 |
|------|------|
| `ko` | 한국어 |
| `en` | 영어 |
| `zh` | 중국어 |

---

## 무료 호출 회수

- 회원가입 시 **500회** 무료 호출이 제공됩니다.
- [마이페이지](/mypage)에서 잔여 회수를 확인하고 API Key를 관리할 수 있습니다.
- 회수 소진 시 관리자에게 문의하여 증량 요청이 가능합니다.
