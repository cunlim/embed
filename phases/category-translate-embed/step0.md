# Step 0: 개별 카테고리 번역·임베딩 API 엔드포인트

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "개별 카테고리 처리 (Per-Category)" 데이터 흐름 절
- `/laravel/routes/api.php` — 기존 라우트 구조
- `/laravel/app/Http/Controllers/Api/CategoryController.php` — 기존 컨트롤러 메서드 (`store`, `batchTranslate`)
- `/laravel/app/Http/Requests/BatchTranslateRequest.php` — 기존 Form Request 패턴 참고
- `/laravel/app/Http/Resources/CategoryResource.php` — 응답 형식 참고

## 작업

`POST /api/categories/{category}/translate-embed` 엔드포인트를 생성한다. 특정 카테고리 하나에 대해 번역→임베딩 파이프라인을 트리거하는 API다.

### 1. 라우트 추가 (`laravel/routes/api.php`)

`sanctum` 미들웨어 그룹 내에 다음 라우트를 추가한다:

```php
Route::post('/categories/{category}/translate-embed', [CategoryController::class, 'translateEmbed']);
```

implicit route model binding을 사용하므로 `{category}` 파라미터는 자동으로 `Category` 모델로 주입된다.

### 2. 컨트롤러 메서드 추가 (`laravel/app/Http/Controllers/Api/CategoryController.php`)

```php
public function translateEmbed(Category $category): JsonResponse
```

**동작:**
- 해당 카테고리에 대해 번역(zh, en) → 임베딩(ko, zh, en) 5단계 파이프라인을 queue에 dispatch 한다.
- 큐에 적재 후 즉시 `202 Accepted` + `{ "message": "...", "category_id": N }` 응답을 반환한다.

**핵심 규칙:**
- 실제 Job 클래스는 Step 1에서 생성하므로, 이 step에서는 **컨트롤러 메서드만** 작성하고 Job dispatch 부분은 Step 1에서 생성될 Job 클래스명을 참조하는 인터ーフェ이스 수준으로만 작성하거나, `// TODO: Step 1에서 Job dispatch 구현` 주석을 남긴다.
- 기존 `store()` 메서드가 `TranslateAndEmbedJob::dispatch()`를 두 번 호출하는 패턴을 참고하라. 단, 개별 카테고리는 batch가 아닌 sequential chain으로 실행되어야 한다.
- 컨트롤러 메서드 시그니처: `public function translateEmbed(Category $category): JsonResponse`
- 응답 코드: `202`

### 3. Swagger OA 어노테이션

컨트롤러 메서드에 `#[OA\Post(...)]` 어노테이션을 추가한다. `CategoryController`의 기존 `store`, `batchTranslate` 메서드의 어노테이션 패턴을 참고하라.

- `OA\JsonContent`는 `type: 'object'`를 명시할 것
- description은 구현 디테일(Job, pipeline 등)을 배제하고 API 소비자 관점의 기능 동작만 기술할 것

### 4. Form Request (선택)

이 엔드포인트는 경로 파라미터로 `category`만 받고 추가 요청 body가 필요 없으므로, 별도 Form Request는 불필요하다. implicit route model binding이 존재하지 않는 카테고리 ID에 대해 자동으로 404를 반환한다.

## Acceptance Criteria

```bash
# 라우트 등록 확인
docker exec cl_embed_laravel php artisan route:list | grep translate-embed

# Laravel 백엔드 테스트 (Pest)
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryController

# PHP 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `routes/api.php`에 새 라우트가 `sanctum` 미들웨어 그룹 내에 있는가?
   - 응답 형식이 기존 CategoryController와 일관된가 (JsonResponse)?
   - ADR-004 (Sanctum API Token 인증)을 준수하는가?
3. 결과에 따라 `phases/category-translate-embed/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- Step 1의 Job 클래스를 이 step에서 미리 생성하지 마라. 레이어 간 침범이다.
- `StoreCategoryRequest.php` 등 기존 Form Request를 불필요하게 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라
