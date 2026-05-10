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
- `api-docs` 경로 ⇒ `swagger` (기본값 `api/documentation` 대신 `/swagger` 사용)

### Swagger UI 라우트 설정

L5-Swagger는 `/api/documentation` 경로를 자동 등록한다. 프로젝트에서는 Swagger UI를 `/swagger/` 경로에서 제공한다. `config/l5-swagger.php`에서 `path` 설정을 `swagger`로 변경하거나, Nginx 설정에서 `/swagger/`를 `/api/documentation`로 리다이렉트하도록 구성한다. 이 step에서는 `/swagger` URL이 정상 동작하는 것을 확인한다.

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
   - ARCHITECTURE.md `/docs/` Swagger UI 라우트 요구사항을 충족하는가?
4. 결과에 따라 `phases/api-layer/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "L5-Swagger 설치 및 현재 API 어노테이션 완료"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 이 step에서는 현재 존재하는 API만 문서화하라. 아직 구현되지 않은 인증 API(auth-system)나 검색 최적화(search-integration)의 어노테이션을 미리 추가하지 마라. 이유: 다음 step에서 API가 변경될 수 있다.
- Swagger JSON 생성이 실패하는 어노테이션 문법 오류를 남기지 마라. `l5-swagger:generate`가 통과해야 한다.
- 기존 테스트를 깨뜨리지 마라
