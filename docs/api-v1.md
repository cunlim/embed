# CL Embed API v1

> **📘 최신 API 문서**: docs 페이지의 **[API 연동 가이드](/docs?doc=API_V1)** 에서 더 상세한 파라미터 설명, 내부 API 엔드포인트, Swagger/OpenAPI 사용법을 확인할 수 있습니다. 본 문서는 외부 API v1 사양의 참조용 스펙입니다.

카테고리 유사도 검색 기능을 외부에서 호출할 수 있는 REST API입니다.

## 개요

CL Embed API는 카테고리 데이터에 대한 유사도 검색을 제공합니다. 외부 애플리케이션에서 API Key를 활용하여 카테고리 검색 결과를 JSON 형식으로 받아볼 수 있습니다.

## Base URL

```
https://embed.cunlim.dev/api/v1
```

## 인증

모든 API 요청은 API Key 인증이 필요합니다. 마이페이지(`/mypage`)에서 API Key를 생성할 수 있습니다.

요청 시 `Authorization` 헤더에 Bearer 토큰을 포함합니다:

```
Authorization: Bearer YOUR_API_KEY
```

## 엔드포인트

### POST /api/v1/search

카테고리 유사도 검색을 수행합니다.

#### 요청 파라미터

| 파라미터 | 필수 | 타입 | 기본값 | 설명 |
|---|---|---|---|---|
| `text` | 예 | string | - | 유사도 검색어 (최대 500자) |
| `target_language` | 아니오 | string | `ko` | 검색 결과 언어 (`ko` / `zh` / `en`) |
| `page` | 아니오 | integer | `1` | 페이지 번호 |
| `per_page` | 아니오 | integer | `20` | 페이지당 결과 수 (최대 50) |
| `keyword` | 아니오 | string | - | 키워드 필터 |
| `folder` | 아니오 | string | - | 폴더 필터 |
| `lang` | 아니오 | string | - | 분류선택 계층 언어 (`ko` / `en` / `zh`) |
| `mode` | 아니오 | string | `search` | 검색 모드: `hierarchy`(접두사 검색), `search`(부분 검색) |
| `slang` | 아니오 | string | - | 유사도 검색 언어 (`ko` / `en` / `zh`) |

#### 요청 예시

```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "환경 보호",
    "target_language": "ko",
    "page": 1,
    "per_page": 20,
    "mode": "search"
  }'
```

#### 응답 예시

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

#### 에러 응답

| 상태 코드 | 코드 | 설명 |
|---|---|---|
| 401 | `unauthorized` | API Key가 없거나 유효하지 않습니다 |
| 403 | `key_paused` | API Key가 일시 중지되었습니다 |
| 422 | `validation_error` | 요청 파라미터 검증 실패 |
| 429 | `quota_exceeded` | 무료 사용 회수를 초과했습니다 |
| 429 | `rate_limit_exceeded` | 분당 요청 한도를 초과했습니다 |

에러 응답 예시:

```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "API Key가 유효하지 않습니다."
  }
}
```

## Rate Limit

- **분당 60회** 요청이 제한됩니다.
- 응답 헤더에 현재 상태가 포함됩니다:

| 헤더 | 설명 |
|---|---|
| `X-RateLimit-Limit` | 분당 최대 요청 수 (60) |
| `X-RateLimit-Remaining` | 남은 요청 수 |
| `Retry-After` | 재시도까지 대기할 시간 (초) |

한도 초과 시 `429` 상태 코드와 함께 `Retry-After` 헤더가 반환됩니다. 해당 시간 경과 후 재시도하세요.

## 무료 사용 회수

- 가입 시 **100회** 무료 사용이 제공됩니다.
- 관리자가 회수를 조절할 수 있습니다.
- 마이페이지(`/mypage`)에서 잔여 회수를 확인할 수 있습니다.
