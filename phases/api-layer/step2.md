# Step 2: swagger-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "API 문서 라우팅" — `/docs/` → Swagger UI)
- `/docs/ADR.md`
- `/laravel/CLAUDE.md`
- `/laravel/routes/api.php` (이전 step들에서 생성됨)
- `/laravel/app/Http/Controllers/Api/CategoryController.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Controllers/Api/RecommendController.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Requests/CategoryStoreRequest.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Requests/BatchTranslateRequest.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Requests/RecommendRequest.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Resources/CategoryResource.php` (이전 step에서 생성됨)
- `/laravel/app/Http/Resources/RecommendResource.php` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 현재까지 구현된 API의 구조를 파악한 뒤 작업하라.

## 작업

Laravel L5-Swagger 패키지를 설치하고, 현재까지 구현된 API에 대한 Swagger 문서를 생성하라. 이 step은 첫 API 개발 완료 시점의 문서화다. 전체 API 문서 완성은 `search-integration/step3`에서 수행한다.

> **현재 상태**: L5-Swagger 패키지 설치 및 Swagger UI 컨테이너(`cl_embed_swagger`) 초기화가 완료되어 있다. 이 step에서는 API 어노테이션 작성과 JSON 생성에 집중하라.

### L5-Swagger 설치 및 설정

```bash
composer require darkaonline/l5-swagger
php artisan vendor:publish --provider "L5Swagger\L5SwaggerServiceProvider"
```

`config/l5-swagger.php` 설정:
- `default` ⇒ `api`
- `title` ⇒ `CL Embed API`
- `version` ⇒ `1.0.0`
- `description` ⇒ `AI 기반 다국어 카테고리 추천 시스템 API`
- `api-docs` 경로 ⇒ `api/documentation` (L5-Swagger 기본값 사용. `/api/documentation`에서 OpenAPI JSON 제공)

### Swagger UI (독립 Docker 컨테이너)

Swagger UI는 `swaggerapi/swagger-ui` 이미지로 독립 실행된다 (`cl_embed_swagger` 컨테이너, docker-compose.yml 참조). L5-Swagger는 OpenAPI JSON만 생성하고, 시각화는 별도 컨테이너가 담당한다.

- **Swagger UI 페이지**: `/swagger/` — Nginx가 `cl_embed_swagger` 컨테이너로 프록시. 초기화 완료. Laravel API + Next.js API 양쪽 스펙을 하나의 UI에서 확인 가능.
- **Laravel API JSON**: `/api/documentation` — L5-Swagger가 생성하는 JSON 엔드포인트.
- **Next.js API JSON**: `/docs/next-spec.json` — Next.js의 OpenAPI 스펙 파일.

`config/l5-swagger.php`에서 `generate_docs_path`를 확인하여 JSON이 `storage/api-docs/`에 생성되도록 설정하라.

### API 어노테이션 작성

아래 Controller 메서드에 Swagger OA 어노테이션을 추가하라:

**CategoryController**:
- `GET /api/categories` — 카테고리 목록 조회
- `POST /api/categories` — 카테고리 생성 (인증 필요)
- `GET /api/categories/{category}` — 카테고리 상세 조회
- `POST /api/categories/batch-translate` — 일괄 번역 트리거 (인증 필요)

**RecommendController**:
- `POST /api/recommend` — 카테고리 추천

각 어노테이션에 포함할 내용:
- `summary`, `description`
- `@OA\RequestBody` (POST 메서드)
- `@OA\Response` (성공 + 에러 케이스 최소 2개)
- `@OA\Parameter` (URL 파라미터가 있는 경우)
- `security` (인증이 필요한 경우 `{"sanctum": {}}`)

## 생성할 파일

- `laravel/config/l5-swagger.php` (publish 후 수정)
- `laravel/app/Http/Controllers/Api/CategoryController.php` (수정 — 어노테이션 추가)
- `laravel/app/Http/Controllers/Api/RecommendController.php` (수정 — 어노테이션 추가)

## Acceptance Criteria

```bash
# L5-Swagger 패키지 설치 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo class_exists("L5Swagger\L5SwaggerServiceProvider") ? "L5-Swagger OK" : "L5-Swagger MISSING";
'

# Swagger JSON 생성
docker exec cl_embed_laravel php artisan l5-swagger:generate

# 라우트 확인
docker exec cl_embed_laravel php artisan route:list --path=api

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `l5-swagger:generate`가 에러 없이 완료되는지 확인한다.
3. 아키텍처 체크리스트를 확인한다:
   - `storage/api-docs/openapi.json`이 생성되었는가? (Swagger UI 컨테이너가 이 파일을 읽음)
4. 결과에 따라 `phases/api-layer/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "L5-Swagger 설치 및 현재 API 어노테이션 완료"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 이 step에서는 현재 존재하는 API만 문서화하라. 아직 구현되지 않은 인증 API(auth-system)나 검색 최적화(search-integration)의 어노테이션을 미리 추가하지 마라. 이유: 다음 step에서 API가 변경될 수 있다.
- Swagger JSON 생성이 실패하는 어노테이션 문법 오류를 남기지 마라. `l5-swagger:generate`가 통과해야 한다.
- 기존 테스트를 깨뜨리지 마라
