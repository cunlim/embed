# Step 0: api-routes

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "페이지 구성" 및 Nginx 라우팅)
- `/docs/PRD.md` (특히 §3.2, §3.3, §3.4)
- `/docs/ADR.md` (ADR-004: 인증 아키텍처)
- `/laravel/CLAUDE.md`
- `/laravel/routes/web.php` (기존 라우트)
- `/laravel/app/Http/Controllers/Controller.php` (기존 컨트롤러)
- `/laravel/app/Jobs/BatchTranslatePipeline.php` (이전 task에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

API 라우트와 CategoryController를 생성하라.

### API 라우트 파일 생성 (`routes/api.php`)

`bootstrap/app.php`에서 이미 `/api` prefix가 적용되므로, `routes/api.php` 내부에서는 prefix 없이 라우트를 정의한다.

```php
// 카테고리
Route::get('categories', [CategoryController::class, 'index']);
Route::post('categories', [CategoryController::class, 'store']);
Route::get('categories/{category}', [CategoryController::class, 'show']);

// 일괄 번역/임베딩
Route::post('categories/batch-translate', [CategoryController::class, 'batchTranslate']);
```

> **참고**: `POST /api/recommend` 라우트는 `RecommendController`가 생성되는 다음 step(step1)에서 등록한다.

### `bootstrap/app.php` 수정

`routes/api.php`를 로드하도록 등록하라. Laravel 13에서는 `bootstrap/app.php`에서 `withRouting`을 사용한다.

### CategoryController (`app/Http/Controllers/Api/CategoryController.php`)

시그니처:
```php
namespace App\Http\Controllers\Api;

class CategoryController extends Controller
{
    public function index(): CategoryCollection;
    public function store(CategoryStoreRequest $request): CategoryResource;
    public function show(Category $category): CategoryResource;
    public function batchTranslate(BatchTranslateRequest $request): JsonResponse;
}
```

핵심 규칙:
- `index()` — 모든 Category를 `CategoryResource` 컬렉션으로 반환
- `store()` — 단일 카테고리 생성. 인증 필요 (Sanctum middleware, 다음 task에서 적용).
  - `category_code` 자동 생성: `Category::generateCode()` 정적 메서드를 호출한다 (`backend-models/step0`에서 정의됨). 중복 구현하지 말고 기존 메서드를 재사용하라.
  - 생성된 Category에 대해 `TranslateAndEmbedJob` dispatch
- `show()` — 단일 Category 상세
- `batchTranslate()` — `BatchTranslatePipeline` Job dispatch 후 `202 Accepted` + `batch_id` JSON 응답
  - 요청 본문: `{ "target_language": "zh" }` — 단일 언어 문자열. 여러 언어 처리는 언어별로 각각 API를 호출한다.

### Form Requests

- `CategoryStoreRequest` — `category_name_ko` 필수, string, max:255
- `BatchTranslateRequest` — `target_language` 필수, string, in:ko,zh,en

### Eloquent Resources

- `CategoryResource` — `id`, `category_code`, `category_name_ko`, `category_name_zh`, `category_name_en`
- `CategoryCollection` — `CategoryResource`의 컬렉션

## 생성할 파일

- `laravel/routes/api.php`
- `laravel/bootstrap/app.php` (수정 — api 라우트 등록)
- `laravel/app/Http/Controllers/Api/CategoryController.php`
- `laravel/app/Http/Requests/CategoryStoreRequest.php`
- `laravel/app/Http/Requests/BatchTranslateRequest.php`
- `laravel/app/Http/Resources/CategoryResource.php`
- `laravel/app/Http/Resources/CategoryCollection.php`

## Acceptance Criteria

```bash
# 라우트가 등록되었는지 확인
docker exec cl_embed_laravel php artisan route:list --path=api

# 컨트롤러 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Http\Controllers\Api\CategoryController::class));
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/api-layer/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 이 step에서 인증 미들웨어를 적용하지 마라. auth는 다음 task(auth-system)에서 처리한다.
- `routes/api.php` 내부에서 `Route::prefix('api')`를 다시 감싸지 마라. 이유: `bootstrap/app.php`에서 이미 `/api` prefix가 적용되므로 `/api/api/categories` 같은 이중 prefix가 발생한다.
- api.php 라우트를 web.php에 섞어 정의하지 마라. 별도 파일로 분리한다.
- `batchTranslate()`에서 실제 Job을 dispatch만 하고 응답은 즉시 반환하라. 동기 처리하지 마라.
- 기존 테스트를 깨뜨리지 마라
