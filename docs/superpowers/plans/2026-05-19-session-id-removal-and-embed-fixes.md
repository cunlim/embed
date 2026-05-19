# session_id 제거 및 embed 페이지 버그 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** search_logs에서 session_id를 제거하고, "전체/내 카테고리" 토글을 수정하며, 검색 캐시 중복 INSERT 버그를 수정한다.

**Architecture:** session_id 컬럼을 제거하는 마이그레이션 작성 → 모델/레포지토리/서비스/컨트롤러에서 session_id 제거 → CategoryController index 필터 로직 수정 → embed 페이지 비회원 접근 허용 및 버튼 동작 수정. 모든 변경은 TDD로 진행한다.

**Tech Stack:** Laravel 13, Pest 4, Next.js 16, React 19, TypeScript, Vitest

---

### Task 1: session_id 컬럼 제거 마이그레이션 작성

**Files:**
- Create: `laravel/database/migrations/2026_05_19_000001_drop_session_id_from_search_logs.php`
- Modify: `laravel/database/migrations/2026_05_07_000003_create_search_logs_table.php` (참고만, 수정하지 않음)

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
docker exec cl_embed_laravel php artisan make:migration drop_session_id_from_search_logs
```

bind mount 이슈로 빈 파일이 생성될 수 있으므로, 호스트에서 직접 작성하고 동기화한다.

- [ ] **Step 2: 호스트에 마이그레이션 작성**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            $table->dropIndex(['session_id']);
            $table->dropColumn('session_id');
        });
    }

    public function down(): void
    {
        Schema::table('search_logs', function (Blueprint $table) {
            $table->uuid('session_id')->after('user_id');
            $table->index('session_id');
        });
    }
};
```

- [ ] **Step 3: 컨테이너에 동기화**

```bash
cat laravel/database/migrations/2026_05_19_000001_drop_session_id_from_search_logs.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/database/migrations/2026_05_19_000001_drop_session_id_from_search_logs.php"
```

- [ ] **Step 4: 마이그레이션 실행 및 확인**

```bash
docker exec cl_embed_laravel php artisan migrate --force
docker exec cl_embed_laravel php artisan tinker --execute 'Schema::hasColumn("search_logs", "session_id") ? "EXISTS" : "GONE"'
```

Expected: `GONE`

---

### Task 2: SearchLog 모델에서 session_id 제거

**Files:**
- Modify: `laravel/app/Models/SearchLog.php:14,41-43`

- [ ] **Step 1: SearchLog 모델 수정**

`Fillable`에서 `session_id` 제거, `booted()`에서 session_id 자동 생성 로직 제거:

```php
// 변경 전 line 14
#[Fillable(['user_id', 'session_id', 'search_keyword', 'embed_model_name', 'embedding', 'normalized_keyword'])]

// 변경 후
#[Fillable(['user_id', 'search_keyword', 'embed_model_name', 'embedding', 'normalized_keyword'])]
```

```php
// 변경 전 lines 38-44 — booted() 전체 제거
protected static function booted(): void
{
    static::creating(function (self $model) {
        if (empty($model->session_id)) {
            $model->session_id = (string) Str::uuid();
        }
    });
}

// 변경 후 — booted() 메서드 전체 삭제 (Str import도 제거)
```

- [ ] **Step 2: 컨테이너 동기화**

```bash
cat laravel/app/Models/SearchLog.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Models/SearchLog.php"
```

- [ ] **Step 3: 린트 실행**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

---

### Task 3: SearchLogRepository 수정

**Files:**
- Modify: `laravel/app/Repositories/SearchLogRepository.php`

- [ ] **Step 1: findByNormalizedKeyword 시그니처 단순화**

```php
// 변경 전
public function findByNormalizedKeyword(string $normalizedKeyword, ?int $userId, string $sessionId): ?SearchLog
{
    return SearchLog::query()
        ->where('normalized_keyword', $normalizedKeyword)
        ->when(
            $userId !== null,
            fn (Builder $q) => $q->where('user_id', $userId),
            fn (Builder $q) => $q->where('session_id', $sessionId),
        )
        ->latest()
        ->first();
}

// 변경 후 — Builder import도 제거
public function findByNormalizedKeyword(string $normalizedKeyword): ?SearchLog
{
    return SearchLog::query()
        ->where('normalized_keyword', $normalizedKeyword)
        ->latest()
        ->first();
}
```

`use Illuminate\Database\Eloquent\Builder;` import 제거.

- [ ] **Step 2: 컨테이너 동기화 및 린트**

```bash
cat laravel/app/Repositories/SearchLogRepository.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Repositories/SearchLogRepository.php"
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

---

### Task 4: EmbeddingCacheService 수정

**Files:**
- Modify: `laravel/app/Services/EmbeddingCacheService.php`

- [ ] **Step 1: getOrCreateEmbedding에서 $sessionId 제거**

```php
// 변경 전
public function getOrCreateEmbedding(string $keyword, string $modelName, ?int $userId, string $sessionId): SearchLog
{
    $normalized = $this->normalizer->normalize($keyword);
    $start = microtime(true);
    $existing = $this->repository->findByNormalizedKeyword($normalized, $userId, $sessionId);
    // ...
    $searchLog = $this->repository->createSearchLog([
        'user_id' => $userId,
        'session_id' => $sessionId,
        'search_keyword' => $keyword,
        'normalized_keyword' => $normalized,
        'embed_model_name' => $modelName,
        'embedding' => $embedding,
    ]);
    // ...
}

// 변경 후
public function getOrCreateEmbedding(string $keyword, string $modelName, ?int $userId = null): SearchLog
{
    $normalized = $this->normalizer->normalize($keyword);
    $start = microtime(true);
    $existing = $this->repository->findByNormalizedKeyword($normalized);
    // ... (cache hit 로직 동일)
    $searchLog = $this->repository->createSearchLog([
        'user_id' => $userId,
        'search_keyword' => $keyword,
        'normalized_keyword' => $normalized,
        'embed_model_name' => $modelName,
        'embedding' => $embedding,
    ]);
    // ...
}
```

- [ ] **Step 2: 컨테이너 동기화 및 린트**

```bash
cat laravel/app/Services/EmbeddingCacheService.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Services/EmbeddingCacheService.php"
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

---

### Task 5: RecommendController 수정

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php`

- [ ] **Step 1: sessionId 생성 로직 제거, getOrCreateEmbedding 호출 갱신**

```php
// 변경 전 (lines 77-85)
$sessionId = $request->hasSession()
    ? $request->session()->getId()
    : (string) Str::uuid();
$userId = auth()->id();
$modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

$searchLog = $this->embeddingCache->getOrCreateEmbedding(
    $text, $modelName, $userId, $sessionId
);

// 변경 후
$userId = auth('sanctum')->id();
$modelName = config('services.ollama.embedding_model', 'bge-m3:latest');

$searchLog = $this->embeddingCache->getOrCreateEmbedding(
    $text, $modelName, $userId
);
```

`use Illuminate\Support\Str;` import 제거.

- [ ] **Step 2: 컨테이너 동기화 및 린트**

```bash
cat laravel/app/Http/Controllers/Api/RecommendController.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Http/Controllers/Api/RecommendController.php"
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

---

### Task 6: SearchLogFactory에서 session_id 제거

**Files:**
- Modify: `laravel/database/factories/SearchLogFactory.php:24`

- [ ] **Step 1: session_id 라인 제거**

```php
// 변경 전
return [
    'user_id' => null,
    'session_id' => (string) Str::uuid(),
    'search_keyword' => $keyword,
    // ...
];

// 변경 후
return [
    'user_id' => null,
    'search_keyword' => $keyword,
    // ...
];
```

`use Illuminate\Support\Str;` import 제거 (더 이상 사용하지 않으면).

- [ ] **Step 2: 컨테이너 동기화**

```bash
cat laravel/database/factories/SearchLogFactory.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/database/factories/SearchLogFactory.php"
```

---

### Task 7: 테스트 파일 수정

**Files:**
- Modify: `laravel/tests/Unit/SearchLogRepositoryTest.php`
- Modify: `laravel/tests/Unit/Services/EmbeddingCacheServiceTest.php`
- Modify: `laravel/tests/Unit/Services/RecommendationServiceTest.php`
- Modify: `laravel/tests/Feature/Api/RecommendControllerTest.php`
- Modify: `laravel/tests/Feature/RecommendationTest.php`

- [ ] **Step 1: SearchLogRepositoryTest 수정**

session_id 참조를 모두 제거하고, `findByNormalizedKeyword` 호출 시그니처를 단일 인자로 변경:

```php
<?php

use App\Models\SearchLog;
use App\Models\User;
use App\Repositories\SearchLogRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('findByNormalizedKeyword — 정규화 키워드로 조회', function () {
    $repo = app(SearchLogRepository::class);

    $user = User::factory()->create();

    $repo->createSearchLog([
        'user_id' => $user->id,
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('청바지');

    expect($found)->not->toBeNull();
    expect($found->search_keyword)->toBe('청바지');
});

test('findByNormalizedKeyword — 정규화 키워드로 비회원 검색 로그도 조회된다', function () {
    $repo = app(SearchLogRepository::class);

    $repo->createSearchLog([
        'search_keyword' => 'NIKE SHOES',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('nike shoes');

    expect($found)->not->toBeNull();
    expect($found->normalized_keyword)->toBe('nike shoes');
});

test('findByNormalizedKeyword — 일치하는 결과가 없으면 null 반환', function () {
    $repo = app(SearchLogRepository::class);

    $found = $repo->findByNormalizedKeyword('없는키워드');

    expect($found)->toBeNull();
});

test('createSearchLog — 검색 로그를 생성하고 SearchLog 인스턴스를 반환', function () {
    $repo = app(SearchLogRepository::class);

    $log = $repo->createSearchLog([
        'search_keyword' => '원피스',
        'normalized_keyword' => '원피스',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    expect($log)->toBeInstanceOf(SearchLog::class);
    expect($log->search_keyword)->toBe('원피스');
    expect($log->normalized_keyword)->toBe('원피스');
});
```

`use Illuminate\Support\Str;` import 제거.

- [ ] **Step 2: EmbeddingCacheServiceTest 수정**

session_id를 제거하고, `getOrCreateEmbedding` 호출에서 `$sessionId` 인자 제거, "같은 키워드라도 userId가 다르면 다른 캐시로 취급한다" 테스트를 "같은 키워드는 캐시를 공유한다"로 변경:

```php
<?php

use App\Models\SearchLog;
use App\Models\User;
use App\Services\EmbeddingCacheService;
use App\Services\EmbeddingGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('getOrCreateEmbedding — 캐시 히트 시 임베딩을 재생성하지 않는다', function () {
    $embedding = array_fill(0, 1024, 0.1);

    $user = User::factory()->create([
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);

    SearchLog::create([
        'user_id' => $user->id,
        'search_keyword' => 'NIKE Shoes',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('  NIKE   SHOES  ', 'bge-m3:latest', $user->id);

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe('NIKE Shoes');
    expect($result->normalized_keyword)->toBe('nike shoes');
});

test('getOrCreateEmbedding — 캐시 미스 시 새 임베딩을 생성하고 저장한다', function () {
    $embedding = array_fill(0, 1024, 0.05);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')
        ->with('청바지')
        ->once()
        ->andReturn($embedding);

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('청바지', 'bge-m3:latest');

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe('청바지');
    expect($result->normalized_keyword)->toBe('청바지');
    expect($result->embed_model_name)->toBe('bge-m3:latest');

    $saved = SearchLog::query()
        ->where('normalized_keyword', '청바지')
        ->first();

    expect($saved)->not->toBeNull();
});

test('getOrCreateEmbedding — 정규화를 통해 공백/대소문자 차이가 있는 키워드가 캐시 히트된다', function () {
    $embedding = array_fill(0, 1024, 0.2);

    SearchLog::create([
        'search_keyword' => '  NIKE   Air   Max  ',
        'normalized_keyword' => 'nike air max',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('NIKE air max', 'bge-m3:latest');

    expect($result->search_keyword)->toBe('  NIKE   Air   Max  ');
    expect($result->normalized_keyword)->toBe('nike air max');
});

test('getOrCreateEmbedding — 같은 키워드는 모든 사용자가 캐시를 공유한다', function () {
    $sharedEmbedding = array_fill(0, 1024, 0.1);

    $user1 = User::factory()->create([
        'name' => 'User 1',
        'email' => 'user1@example.com',
    ]);

    SearchLog::create([
        'user_id' => $user1->id,
        'search_keyword' => '운동화',
        'normalized_keyword' => '운동화',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $sharedEmbedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('운동화', 'bge-m3:latest', null);

    expect($result->user_id)->toBe($user1->id);
    expect($result->embedding)->toBeInstanceOf(Vector::class);
});
```

`use Illuminate\Support\Str;` import 제거.

- [ ] **Step 3: RecommendationServiceTest 수정**

session_id 참조 제거:

```php
// test('recommend — 유사도 점수는 1.0 - distance로 계산된다') — 변경 전 lines 48-53
$searchLog = new SearchLog([
    'search_keyword' => '청바지',
    'normalized_keyword' => '청바지',
    'embed_model_name' => 'bge-m3:latest',
    'session_id' => 'test-session',
]);

// 변경 후
$searchLog = new SearchLog([
    'search_keyword' => '청바지',
    'normalized_keyword' => '청바지',
    'embed_model_name' => 'bge-m3:latest',
]);
```

```php
// test('recommendPaginated — 페이지네이션 결과를 반환한다') — 변경 전 lines 83-88
$searchLog = new SearchLog([
    'search_keyword' => '청바지',
    'normalized_keyword' => '청바지',
    'embed_model_name' => 'bge-m3:latest',
    'session_id' => 'test-session',
]);

// 변경 후
$searchLog = new SearchLog([
    'search_keyword' => '청바지',
    'normalized_keyword' => '청바지',
    'embed_model_name' => 'bge-m3:latest',
]);
```

- [ ] **Step 4: RecommendControllerTest 수정**

```php
// test('POST /api/recommend — 유효성 검증 통과 후...') lines 62-67
$searchLog = new SearchLog([
    'search_keyword' => '검색어',
    'normalized_keyword' => '검색어',
    'embed_model_name' => 'bge-m3:latest',
]);
```

- [ ] **Step 5: RecommendationTest 수정**

session_id 참조 제거, `getOrCreateEmbedding` mock의 인자 수정:

```php
// test('POST /api/recommend — 유효한 검색어는...') — 변경 전 lines 14-26
$searchLog = new SearchLog([
    'search_keyword' => '청바지',
    'normalized_keyword' => '청바지',
    'embed_model_name' => 'bge-m3:latest',
]);
// ...
$mockCache->shouldReceive('getOrCreateEmbedding')
    ->once()
    ->with('청바지', 'bge-m3:latest', null)
    ->andReturn($searchLog);
```

세션 없이 `auth('sanctum')->id()`는 null이므로, `with()`의 세 번째 인자를 `null`로 변경.

- [ ] **Step 6: 모든 테스트 파일 컨테이너 동기화**

```bash
for f in \
  tests/Unit/SearchLogRepositoryTest.php \
  tests/Unit/Services/EmbeddingCacheServiceTest.php \
  tests/Unit/Services/RecommendationServiceTest.php \
  tests/Feature/Api/RecommendControllerTest.php \
  tests/Feature/RecommendationTest.php; do
  cat laravel/$f | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/$f"
done
```

- [ ] **Step 7: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact
```

Expected: 0 failures

---

### Task 8: CategoryController index() 필터 로직 수정

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:64-80`

- [ ] **Step 1: index() 메서드 수정**

```php
// 변경 후
public function index(Request $request): CategoryCollection
{
    $perPage = min((int) $request->input('per_page', 20), 100);

    $query = Category::query()->with('embeddings');
    $user = auth('sanctum')->user();

    if ($request->input('filter') === 'my') {
        if ($user) {
            $query->where('user_id', $user->id);
        } else {
            $query->whereRaw('1 = 0');
        }
    } else {
        if ($user) {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('user_id', 1);
            });
        } else {
            $query->where('user_id', 1);
        }
    }

    return new CategoryCollection(
        $query->orderBy('id', 'desc')->paginate($perPage)
    );
}
```

- [ ] **Step 2: 컨테이너 동기화 및 린트**

```bash
cat laravel/app/Http/Controllers/Api/CategoryController.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/app/Http/Controllers/Api/CategoryController.php"
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 3: CategoryControllerTest에 필터 테스트 추가**

`laravel/tests/Feature/Api/CategoryControllerTest.php`에 추가:

```php
test('GET /api/categories?filter=my — 인증된 사용자는 본인 소유 카테고리만 조회', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '내 카테고리']);
    Category::factory()->create(['user_id' => $otherUser->id, 'category_name_ko' => '타인 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/categories?filter=my');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->toContain('내 카테고리');
    expect($names)->not->toContain('타인 카테고리');
    expect($names)->not->toContain('관리자 카테고리');
});

test('GET /api/categories — 인증된 사용자는 본인 + user_id=1 소유 카테고리 조회', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '내 카테고리']);
    Category::factory()->create(['user_id' => $otherUser->id, 'category_name_ko' => '타인 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/categories');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->toContain('내 카테고리');
    expect($names)->not->toContain('타인 카테고리');
    expect($names)->toContain('관리자 카테고리');
});

test('GET /api/categories — 비회원은 user_id=1 소유 카테고리만 조회', function () {
    $user = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '회원 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $response = $this->getJson('/api/categories');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->not->toContain('회원 카테고리');
    expect($names)->toContain('관리자 카테고리');
});

test('GET /api/categories?filter=my — 비회원은 빈 결과', function () {
    $user = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '회원 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $response = $this->getJson('/api/categories?filter=my');

    $response->assertOk();
    expect($response->json('data'))->toBeEmpty();
});
```

CartControllerTest에 `use App\Models\User;` import 추가.

- [ ] **Step 4: 컨테이너 동기화 및 테스트 실행**

```bash
cat laravel/tests/Feature/Api/CategoryControllerTest.php | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/tests/Feature/Api/CategoryControllerTest.php"
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact
```

---

### Task 9: embed 프론트엔드 — 비회원 접근 허용 및 토글 수정

**Files:**
- Modify: `nextjs/app/embed/page.tsx`
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`

- [ ] **Step 1: embed/page.tsx 수정**

변경사항:
1. `/login` 리다이렉트 제거 (비회원 접근 허용)
2. "카테고리 추가" — 클릭 시 비회원이면 alert 표시
3. "일괄 번역" — 이미 관리자만 보이게 되어 있을 가능성 있음, 확인
4. "전체/내 카테고리" — 비회원이 "내 카테고리" 클릭 시 `setFilter` 호출하지 않고 alert 표시

```tsx
// embed/page.tsx changes:

// 1. useEffect의 리다이렉트 제거 (lines 102-108)
// 변경 전
useEffect(() => {
    if (!mounted || authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/embed");
    }
}, [mounted, authLoading, user, router]);

// 변경 후 — useEffect 자체를 삭제

// 2. "내 카테고리" 버튼 클릭 핸들러 (line 349-353)
// 변경 전
<Button
  variant={filter === "my" ? "secondary" : "ghost"}
  size="sm"
  onClick={() => setFilter("my")}
>

// 변경 후
<Button
  variant={filter === "my" ? "secondary" : "ghost"}
  size="sm"
  onClick={() => {
    if (!user) {
      alert("로그인이 필요합니다");
      return;
    }
    setFilter("my");
  }}
>

// 3. "카테고리 추가" 버튼 핸들러 (line 159)
// handleAddCategory는 그대로 두고, 버튼 onClick을 수정
// 변경 전
<Button
  onClick={handleAddCategory}
  disabled={!newCategoryName.trim()}
  className="w-full"
>

// 변경 후
<Button
  onClick={() => {
    if (!user) { alert("로그인이 필요합니다"); return; }
    handleAddCategory();
  }}
  disabled={!newCategoryName.trim()}
  className="w-full"
>
```

- [ ] **Step 2: 컨테이너 동기화 및 타입 체크**

```bash
cat nextjs/app/embed/page.tsx | base64 | docker exec -i cl_embed_nextjs bash -c "base64 -d > /app/app/embed/page.tsx"
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: embed page test 수정 (선택적 — 기존 테스트 확인 후)**

`nextjs/app/embed/__tests__/page.test.tsx`를 확인하여 auth guard 관련 테스트가 있으면 업데이트.

---

### Task 10: 문서 업데이트

**Files:**
- Modify: `docs/PRD.md`
- Modify: `nextjs/CLAUDE.md`
- Modify: `nextjs/app/embed/page.tsx`의 `/login` 리다이렉트 관련 로직 (Task 9에서 처리)

- [ ] **Step 1: docs/PRD.md 수정**

51번 라인 부근 `session_id` 언급 제거:
```
-  * **비회원:** 추천 세팅값은 브라우저 `LocalStorage`에 보관하며, 캐시 데이터는 `session_id` 기준으로 적재됩니다.
+  * **비회원:** 추천 세팅값은 브라우저 `LocalStorage`에 보관하며, 캐시 데이터는 정규화된 검색어 기준으로 모든 사용자가 공유합니다.
```

- [ ] **Step 2: nextjs/CLAUDE.md 수정**

81번 라인 부근 비회원 상태 관리 설명 수정:
```
- **비회원**: `LocalStorage` + `session_id` 기반
+ **비회원**: `LocalStorage` 기반 (검색 캐시는 모든 사용자가 공유)
```

---

### Task 11: 전체 검증

- [ ] **Step 1: Laravel 테스트 전체 실행**

```bash
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact
```

Expected: All tests pass, 0 failures.

- [ ] **Step 2: Next.js 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: All tests pass.

- [ ] **Step 3: run-all-checks.sh 실행**

```bash
.claude/hooks/run-all-checks.sh
```

Expected: lint → tsc → vitest → pint → pest 모두 통과.

---

### Task 12: Playwright 검증

- [ ] **Step 1: 비회원 embed 페이지 접근**

Playwright로 `https://embed.cunlim.dev/embed` 접근 → 로그인 리다이렉트 없이 페이지 로드 확인, 카테고리 목록(user_id=1) 표시 확인.

- [ ] **Step 2: 비회원 "내 카테고리" 클릭**

"내 카테고리" 버튼 클릭 → 필터 변경되지 않고 로그인 alert 표시 확인.

- [ ] **Step 3: 회원 "내 카테고리" 동작**

로그인 후 embed 페이지 접근 → "내 카테고리" 클릭 → 본인 소유 카테고리만 표시 확인.

- [ ] **Step 4: 검색 캐시 중복 확인**

동일 검색어 2회 검색 후 DB 확인 → search_logs에 1건만 존재.

```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo SearchLog::where("normalized_keyword", "검색어")->count();'
```
