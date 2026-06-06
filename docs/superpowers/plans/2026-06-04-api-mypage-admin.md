# API Key 관리 + 마이페이지 + 관리자 회원관리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 API 키 관리, 사용량 추적, 마이페이지, 관리자 회원관리 기능을 구현합니다.

**Architecture:** 독립 `/api/v1/search` 엔드포인트를 새로 만들고, API key 인증 + quota + rate limit을 미들웨어 체인으로 처리합니다. 기존 `RecommendationService`를 재사용하여 유사도 검색 로직을 공유합니다. 마이페이지는 독립 `/mypage` 경로로 구성합니다.

**Tech Stack:** Laravel 12 (Pest PHP), Next.js App Router, shadcn/ui, PostgreSQL + pgvector, Redis (rate limit)

---

## 파일 구조

### 백엔드 (Laravel)

| 파일 | 역할 |
|------|------|
| `laravel/database/migrations/2026_06_04_000001_create_api_keys_table.php` | API key 테이블 생성 |
| `laravel/database/migrations/2026_06_04_000002_create_api_usage_logs_table.php` | 사용량 로그 테이블 생성 |
| `laravel/database/migrations/2026_06_04_000003_add_api_quota_to_users_table.php` | users 테이블에 quota 컬럼 추가 |
| `laravel/database/seeders/ApiSettingsSeeder.php` | settings 테이블에 api 그룹 시드 |
| `laravel/app/Models/ApiKey.php` | API key 모델 |
| `laravel/app/Models/ApiUsageLog.php` | 사용량 로그 모델 |
| `laravel/app/Models/User.php` | 수정: quota 관련 메서드 추가 |
| `laravel/app/Services/ApiKeyService.php` | API key CRUD + 통계 |
| `laravel/app/Services/ApiUsageService.php` | 사용량 추적 + 통계 |
| `laravel/app/Http/Middleware/ApiKeyAuth.php` | API key 인증 + quota 체크 |
| `laravel/app/Http/Middleware/ApiRateLimit.php` | 분당 rate limit |
| `laravel/app/Http/Requests/ApiSearchRequest.php` | 외부 API 검증 |
| `laravel/app/Http/Requests/ApiKeyStoreRequest.php` | API key 생성 검증 |
| `laravel/app/Http/Requests/ApiKeyUpdateRequest.php` | API key 수정 검증 |
| `laravel/app/Http/Requests/QuotaAdjustRequest.php` | 관리자 회수 조절 검증 |
| `laravel/app/Http/Controllers/Api/ApiController.php` | 외부 API (POST /api/v1/search) |
| `laravel/app/Http/Controllers/Api/MyPageController.php` | 마이페이지 API |
| `laravel/app/Http/Controllers/Api/AdminSettingsController.php` | 수정: 회원 관리 API 추가 |
| `laravel/app/Http/Resources/ApiSearchResource.php` | 외부 API 응답 리소스 |
| `laravel/routes/api.php` | 수정: 새 라우트 추가 |
| `laravel/tests/Feature/ApiSearchTest.php` | 외부 API 테스트 |
| `laravel/tests/Feature/MyPageApiTest.php` | 마이페이지 API 테스트 |
| `laravel/tests/Feature/AdminUserApiTest.php` | 관리자 회원 관리 테스트 |
| `laravel/tests/Unit/ApiKeyModelTest.php` | API key 모델 테스트 |
| `laravel/tests/Unit/ApiUsageLogTest.php` | 사용량 로그 테스트 |

### 프론트엔드 (Next.js)

| 파일 | 역할 |
|------|------|
| `nextjs/lib/api.ts` | 수정: 마이페이지/관리자 API 함수 추가 |
| `nextjs/hooks/useApiKeys.ts` | API key CRUD 훅 |
| `nextjs/hooks/useUsageStats.ts` | 사용량 통계 훅 |
| `nextjs/app/mypage/page.tsx` | 마이페이지 서버 컴포넌트 |
| `nextjs/app/mypage/layout.tsx` | 마이페이지 레이아웃 |
| `nextjs/app/mypage/page-content.tsx` | 마이페이지 클라이언트 컴포넌트 |
| `nextjs/components/mypage/api-key-section.tsx` | API key 관리 섹션 |
| `nextjs/components/mypage/api-key-card.tsx` | 개별 API key 카드 |
| `nextjs/components/mypage/api-key-create-dialog.tsx` | API key 생성 다이얼로그 |
| `nextjs/components/mypage/usage-dashboard.tsx` | 사용량 대시보드 |
| `nextjs/components/mypage/usage-chart.tsx` | 기간별 추이 차트 |
| `nextjs/components/mypage/usage-history.tsx` | 최근 호출 이력 테이블 |
| `nextjs/components/admin/user-management.tsx` | 회원 관리 패널 |
| `nextjs/components/admin/user-detail-modal.tsx` | 회원 상세 모달 |
| `nextjs/components/admin/quota-adjust-dialog.tsx` | 회수 조절 다이얼로그 |
| `nextjs/components/auth-buttons.tsx` | 수정: 마이페이지 링크 추가 |
| `nextjs/app/admin/layout.tsx` | 수정: 회원 관리 메뉴 추가 |
| `nextjs/app/admin/page-content.tsx` | 수정: 회원 관리 패널 렌더링 |
| `docs/api-v1.md` | API 문서 |

---

## Phase 1: 데이터베이스 & 모델

### Task 1: api_keys 테이블 마이그레이션 + 모델

**Files:**
- Create: `laravel/database/migrations/2026_06_04_000001_create_api_keys_table.php`
- Create: `laravel/app/Models/ApiKey.php`
- Create: `laravel/database/factories/ApiKeyFactory.php`

- [ ] **Step 1: 마이그레이션 파일 생성**

```php
<?php
// laravel/database/migrations/2026_06_04_000001_create_api_keys_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->string('key', 64)->unique();
            $table->enum('status', ['active', 'paused'])->default('active');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
    }
};
```

- [ ] **Step 2: 모델 파일 생성**

```php
<?php
// laravel/app/Models/ApiKey.php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['user_id', 'name', 'key', 'status'])]
#[Hidden(['key'])]
class ApiKey extends Model
{
    /** @use HasFactory<ApiKeyFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<ApiUsageLog>
     */
    public function usageLogs(): HasMany
    {
        return $this->hasMany(ApiUsageLog::class);
    }

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isPaused(): bool
    {
        return $this->status === 'paused';
    }

    /**
     * cl_ 접두사 + 랜덤 문자열로 API key 생성
     */
    public static function generateKey(): string
    {
        return 'cl_' . Str::random(40);
    }
}
```

- [ ] **Step 3: 팩토리 파일 생성**

```php
<?php
// laravel/database/factories/ApiKeyFactory.php

namespace Database\Factories;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApiKey>
 */
class ApiKeyFactory extends Factory
{
    protected $model = ApiKey::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->word() . ' key',
            'key' => ApiKey::generateKey(),
            'status' => 'active',
        ];
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => 'paused',
        ]);
    }
}
```

- [ ] **Step 4: 마이그레이션 실행**

```bash
docker exec cl_embed_laravel php artisan migrate
```

Expected: `Migration table created successfully.` + 3 migrations run (api_keys, api_usage_logs, add_api_quota)

- [ ] **Step 5: 커밋**

```bash
git add laravel/database/migrations/2026_06_04_000001_create_api_keys_table.php \
        laravel/app/Models/ApiKey.php \
        laravel/database/factories/ApiKeyFactory.php
git commit -m "feat: api_keys 테이블 마이그레이션 + ApiKey 모델 생성"
```

---

### Task 2: api_usage_logs 테이블 마이그레이션 + 모델

**Files:**
- Create: `laravel/database/migrations/2026_06_04_000002_create_api_usage_logs_table.php`
- Create: `laravel/app/Models/ApiUsageLog.php`
- Create: `laravel/database/factories/ApiUsageLogFactory.php`

- [ ] **Step 1: 마이그레이션 파일 생성**

```php
<?php
// laravel/database/migrations/2026_06_04_000002_create_api_usage_logs_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('api_key_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('endpoint', 100);
            $table->json('parameters')->nullable();
            $table->smallInteger('response_status');
            $table->integer('processing_time_ms');
            $table->timestamps();

            $table->index('user_id');
            $table->index('api_key_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_usage_logs');
    }
};
```

- [ ] **Step 2: 모델 파일 생성**

```php
<?php
// laravel/app/Models/ApiUsageLog.php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['api_key_id', 'user_id', 'endpoint', 'parameters', 'response_status', 'processing_time_ms'])]
class ApiUsageLog extends Model
{
    /** @use HasFactory<ApiUsageLogFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<ApiKey, $this>
     */
    public function apiKey(): BelongsTo
    {
        return $this->belongsTo(ApiKey::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'parameters' => 'array',
            'response_status' => 'integer',
            'processing_time_ms' => 'integer',
        ];
    }
}
```

- [ ] **Step 3: 팩토리 파일 생성**

```php
<?php
// laravel/database/factories/ApiUsageLogFactory.php

namespace Database\Factories;

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApiUsageLog>
 */
class ApiUsageLogFactory extends Factory
{
    protected $model = ApiUsageLog::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'api_key_id' => ApiKey::factory(),
            'user_id' => User::factory(),
            'endpoint' => '/api/v1/search',
            'parameters' => ['text' => '청바지', 'target_language' => 'ko'],
            'response_status' => 200,
            'processing_time_ms' => fake()->numberBetween(50, 500),
        ];
    }
}
```

- [ ] **Step 4: 커밋**

```bash
git add laravel/database/migrations/2026_06_04_000002_create_api_usage_logs_table.php \
        laravel/app/Models/ApiUsageLog.php \
        laravel/database/factories/ApiUsageLogFactory.php
git commit -m "feat: api_usage_logs 테이블 마이그레이션 + ApiUsageLog 모델 생성"
```

---

### Task 3: users 테이블에 quota 컬럼 추가

**Files:**
- Create: `laravel/database/migrations/2026_06_04_000003_add_api_quota_to_users_table.php`
- Modify: `laravel/app/Models/User.php`

- [ ] **Step 1: 마이그레이션 파일 생성**

```php
<?php
// laravel/database/migrations/2026_06_04_000003_add_api_quota_to_users_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('api_quota_remaining')->default(100)->after('role');
            $table->integer('api_quota_limit')->default(100)->after('api_quota_remaining');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['api_quota_remaining', 'api_quota_limit']);
        });
    }
};
```

- [ ] **Step 2: User 모델 수정**

`laravel/app/Models/User.php`에서:
- `#[Fillable]`에 `api_quota_remaining`, `api_quota_limit` 추가
- `apiKeys()` 관계 메서드 추가
- `apiUsageLogs()` 관계 메서드 추가
- `hasQuota()` 메서드 추가
- `decrementQuota()` 메서드 추가

```php
<?php
// laravel/app/Models/User.php (수정된 전체 파일)

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'provider', 'provider_id', 'avatar', 'role', 'api_quota_remaining', 'api_quota_limit'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'api_quota_remaining' => 'integer',
            'api_quota_limit' => 'integer',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'superadmin';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === 'superadmin';
    }

    /**
     * @return HasMany<ApiKey>
     */
    public function apiKeys(): HasMany
    {
        return $this->hasMany(ApiKey::class);
    }

    /**
     * @return HasMany<ApiUsageLog>
     */
    public function apiUsageLogs(): HasMany
    {
        return $this->hasMany(ApiUsageLog::class);
    }

    public function hasQuota(): bool
    {
        return $this->api_quota_remaining > 0;
    }

    public function decrementQuota(int $amount = 1): bool
    {
        if ($this->api_quota_remaining < $amount) {
            return false;
        }
        $this->decrement('api_quota_remaining', $amount);
        return true;
    }
}
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
docker exec cl_embed_laravel php artisan migrate
```

Expected: `Migration complete.` + 1 migration run (add_api_quota_to_users)

- [ ] **Step 4: 커밋**

```bash
git add laravel/database/migrations/2026_06_04_000003_add_api_quota_to_users_table.php \
        laravel/app/Models/User.php
git commit -m "feat: users 테이블에 api_quota_remaining, api_quota_limit 컬럼 추가"
```

---

### Task 4: settings 테이블에 api 그룹 시드

**Files:**
- Create: `laravel/database/seeders/ApiSettingsSeeder.php`
- Modify: `laravel/database/seeders/DatabaseSeeder.php`

- [ ] **Step 1: 시더 파일 생성**

```php
<?php
// laravel/database/seeders/ApiSettingsSeeder.php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class ApiSettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['group' => 'api', 'key' => 'free_quota'],
            ['value' => '100', 'type' => 'integer', 'description' => '신규 가입 시 무료 호출 회수']
        );

        Setting::updateOrCreate(
            ['group' => 'api', 'key' => 'rate_limit_per_minute'],
            ['value' => '60', 'type' => 'integer', 'description' => '분당 최대 호출 수']
        );
    }
}
```

- [ ] **Step 2: DatabaseSeeder에 등록**

`laravel/database/seeders/DatabaseSeeder.php`의 `run()` 메서드에 추가:

```php
$this->call([
    ApiSettingsSeeder::class,
]);
```

- [ ] **Step 3: 시드 실행**

```bash
docker exec cl_embed_laravel php artisan db:seed --class=ApiSettingsSeeder
```

Expected: 시드 완료 메시지

- [ ] **Step 4: 커밋**

```bash
git add laravel/database/seeders/ApiSettingsSeeder.php \
        laravel/database/seeders/DatabaseSeeder.php
git commit -m "feat: settings 테이블에 api 그룹 시드 (free_quota, rate_limit_per_minute)"
```

---

## Phase 2: 백엔드 서비스

### Task 5: ApiKeyService 생성

**Files:**
- Create: `laravel/app/Services/ApiKeyService.php`
- Create: `laravel/tests/Unit/ApiKeyServiceTest.php`

- [ ] **Step 1: 테스트 파일 생성**

```php
<?php
// laravel/tests/Unit/ApiKeyServiceTest.php

use App\Models\ApiKey;
use App\Models\User;
use App\Services\ApiKeyService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class);

test('generateKey는 cl_ 접두사와 40자 랜덤 문자열을 반환한다', function () {
    $key = ApiKey::generateKey();
    expect($key)->toStartWith('cl_')
        ->and(strlen($key))->toBe(43); // cl_ (3) + 40
});

test('create는 사용자의 새 API key를 생성한다', function () {
    $user = User::factory()->create();
    $service = new ApiKeyService;

    $apiKey = $service->create($user->id, 'My API Key');

    expect($apiKey->user_id)->toBe($user->id)
        ->and($apiKey->name)->toBe('My API Key')
        ->and($apiKey->status)->toBe('active')
        ->and($apiKey->key)->toStartWith('cl_');
});

test('listByUser는 사용자의 모든 API key를 반환한다', function () {
    $user = User::factory()->create();
    ApiKey::factory()->count(3)->create(['user_id' => $user->id]);
    $service = new ApiKeyService;

    $keys = $service->listByUser($user->id);

    expect($keys)->toHaveCount(3);
});

test('findByKey는 key 문자열로 API key를 조회한다', function () {
    $apiKey = ApiKey::factory()->create();
    $service = new ApiKeyService;

    $found = $service->findByKey($apiKey->key);

    expect($found->id)->toBe($apiKey->id);
});

test('updateStatus는 API key 상태를 변경한다', function () {
    $apiKey = ApiKey::factory()->create(['status' => 'active']);
    $service = new ApiKeyService;

    $updated = $service->updateStatus($apiKey->id, 'paused');

    expect($updated->status)->toBe('paused');
});

test('delete는 API key를 삭제한다', function () {
    $apiKey = ApiKey::factory()->create();
    $service = new ApiKeyService;

    $result = $service->delete($apiKey->id);

    expect($result)->toBeTrue()
        ->and(ApiKey::find($apiKey->id))->toBeNull();
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiKeyServiceTest
```

Expected: FAIL — `ApiKeyService` 클래스가 존재하지 않음

- [ ] **Step 3: 서비스 파일 생성**

```php
<?php
// laravel/app/Services/ApiKeyService.php

namespace App\Services;

use App\Models\ApiKey;
use Illuminate\Support\Collection;

class ApiKeyService
{
    public function create(int $userId, string $name): ApiKey
    {
        return ApiKey::create([
            'user_id' => $userId,
            'name' => $name,
            'key' => ApiKey::generateKey(),
            'status' => 'active',
        ]);
    }

    public function listByUser(int $userId): Collection
    {
        return ApiKey::where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get();
    }

    public function findByKey(string $key): ?ApiKey
    {
        return ApiKey::where('key', $key)->first();
    }

    public function findById(int $id): ?ApiKey
    {
        return ApiKey::find($id);
    }

    public function updateStatus(int $id, string $status): ?ApiKey
    {
        $apiKey = ApiKey::find($id);
        if (! $apiKey) {
            return null;
        }
        $apiKey->update(['status' => $status]);
        return $apiKey->refresh();
    }

    public function updateName(int $id, string $name): ?ApiKey
    {
        $apiKey = ApiKey::find($id);
        if (! $apiKey) {
            return null;
        }
        $apiKey->update(['name' => $name]);
        return $apiKey->refresh();
    }

    public function delete(int $id): bool
    {
        $apiKey = ApiKey::find($id);
        if (! $apiKey) {
            return false;
        }
        return $apiKey->delete();
    }

    public function touchLastUsed(int $id): void
    {
        ApiKey::where('id', $id)->update(['last_used_at' => now()]);
    }
}
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiKeyServiceTest
```

Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add laravel/app/Services/ApiKeyService.php \
        laravel/tests/Unit/ApiKeyServiceTest.php
git commit -m "feat: ApiKeyService 생성 — API key CRUD + 통계"
```

---

### Task 6: ApiUsageService 생성

**Files:**
- Create: `laravel/app/Services/ApiUsageService.php`
- Create: `laravel/tests/Unit/ApiUsageServiceTest.php`

- [ ] **Step 1: 테스트 파일 생성**

```php
<?php
// laravel/tests/Unit/ApiUsageServiceTest.php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use App\Services\ApiUsageService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class);

test('log는 사용량 로그를 생성한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    $service = new ApiUsageService;

    $log = $service->log(
        apiKeyId: $apiKey->id,
        userId: $user->id,
        endpoint: '/api/v1/search',
        parameters: ['text' => '청바지'],
        responseStatus: 200,
        processingTimeMs: 150
    );

    expect($log->api_key_id)->toBe($apiKey->id)
        ->and($log->user_id)->toBe($user->id)
        ->and($log->endpoint)->toBe('/api/v1/search')
        ->and($log->response_status)->toBe(200);
});

test('getTotalCalls는 사용자의 총 호출 횟수를 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(5)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);
    $service = new ApiUsageService;

    $total = $service->getTotalCalls($user->id);

    expect($total)->toBe(5);
});

test('getTodayCalls는 오늘 호출 횟수를 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(3)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);
    $service = new ApiUsageService;

    $today = $service->getTodayCalls($user->id);

    expect($today)->toBe(3);
});

test('getCallsByKey는 key별 호출 횟수를 반환한다', function () {
    $user = User::factory()->create();
    $key1 = ApiKey::factory()->create(['user_id' => $user->id]);
    $key2 = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(3)->create(['user_id' => $user->id, 'api_key_id' => $key1->id]);
    ApiUsageLog::factory()->count(2)->create(['user_id' => $user->id, 'api_key_id' => $key2->id]);
    $service = new ApiUsageService;

    $callsByKey = $service->getCallsByKey($user->id);

    expect($callsByKey->firstWhere('api_key_id', $key1->id)->total)->toBe(3)
        ->and($callsByKey->firstWhere('api_key_id', $key2->id)->total)->toBe(2);
});

test('getRecentHistory는 최근 호출 이력을 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(15)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);
    $service = new ApiUsageService;

    $history = $service->getRecentHistory($user->id, 10);

    expect($history)->toHaveCount(10);
});

test('getDailyChart는 일별 호출 추이를 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(5)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);
    $service = new ApiUsageService;

    $chart = $service->getDailyChart($user->id, 7);

    expect($chart)->toBeArray();
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiUsageServiceTest
```

Expected: FAIL — `ApiUsageService` 클래스가 존재하지 않음

- [ ] **Step 3: 서비스 파일 생성**

```php
<?php
// laravel/app/Services/ApiUsageService.php

namespace App\Services;

use App\Models\ApiUsageLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ApiUsageService
{
    public function log(
        int $apiKeyId,
        int $userId,
        string $endpoint,
        ?array $parameters,
        int $responseStatus,
        int $processingTimeMs,
    ): ApiUsageLog {
        return ApiUsageLog::create([
            'api_key_id' => $apiKeyId,
            'user_id' => $userId,
            'endpoint' => $endpoint,
            'parameters' => $parameters,
            'response_status' => $responseStatus,
            'processing_time_ms' => $processingTimeMs,
        ]);
    }

    public function getTotalCalls(int $userId): int
    {
        return ApiUsageLog::where('user_id', $userId)->count();
    }

    public function getTodayCalls(int $userId): int
    {
        return ApiUsageLog::where('user_id', $userId)
            ->whereDate('created_at', Carbon::today())
            ->count();
    }

    public function getActiveKeyCount(int $userId): int
    {
        return DB::table('api_keys')
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->count();
    }

    public function getCallsByKey(int $userId): Collection
    {
        return ApiUsageLog::where('user_id', $userId)
            ->select('api_key_id', DB::raw('COUNT(*) as total'))
            ->groupBy('api_key_id')
            ->get();
    }

    public function getRecentHistory(int $userId, int $limit = 20): Collection
    {
        return ApiUsageLog::where('user_id', $userId)
            ->with('apiKey:id,name,key')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    public function getDailyChart(int $userId, int $days = 30): array
    {
        $startDate = Carbon::today()->subDays($days - 1);

        $results = ApiUsageLog::where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->select(DB::raw("DATE(created_at) as date"), DB::raw('COUNT(*) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $chart = [];
        for ($i = 0; $i < $days; $i++) {
            $date = Carbon::today()->subDays($days - 1 - $i)->format('Y-m-d');
            $chart[] = [
                'date' => $date,
                'total' => (int) ($results[$date]->total ?? 0),
            ];
        }

        return $chart;
    }
}
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiUsageServiceTest
```

Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add laravel/app/Services/ApiUsageService.php \
        laravel/tests/Unit/ApiUsageServiceTest.php
git commit -m "feat: ApiUsageService 생성 — 사용량 추적 + 통계"
```

---

### Task 7: ApiKeyAuth 미들웨어 생성

**Files:**
- Create: `laravel/app/Http/Middleware/ApiKeyAuth.php`
- Create: `laravel/tests/Feature/ApiKeyAuthMiddlewareTest.php`

- [ ] **Step 1: 테스트 파일 생성**

```php
<?php
// laravel/tests/Feature/ApiKeyAuthMiddlewareTest.php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class);

test('API key 없이 요청하면 401을 반환한다', function () {
    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
        'target_language' => 'ko',
    ]);

    $response->assertStatus(401)
        ->assertJson(['code' => 'unauthorized']);
});

test('유효하지 않은 API key로 요청하면 401을 반환한다', function () {
    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
        'target_language' => 'ko',
    ], ['Authorization' => 'Bearer cl_invalid_key_here']);

    $response->assertStatus(401)
        ->assertJson(['code' => 'unauthorized']);
});

test('일시정지된 API key로 요청하면 403을 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->paused()->create(['user_id' => $user->id]);

    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
        'target_language' => 'ko',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $response->assertStatus(403)
        ->assertJson(['code' => 'key_paused']);
});

test('quota가 0이면 429를 반환한다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 0]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
        'target_language' => 'ko',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $response->assertStatus(429)
        ->assertJson(['code' => 'quota_exceeded']);
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiKeyAuthMiddlewareTest
```

Expected: FAIL — 미들웨어가 존재하지 않거나 라우트가 등록되지 않음

- [ ] **Step 3: 미들웨어 파일 생성**

```php
<?php
// laravel/app/Http/Middleware/ApiKeyAuth.php

namespace App\Http\Middleware;

use App\Services\ApiKeyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiKeyAuth
{
    public function __construct(
        private ApiKeyService $apiKeyService,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json([
                'code' => 'unauthorized',
                'message' => 'API key가 필요합니다.',
            ], 401);
        }

        $apiKey = $this->apiKeyService->findByKey($token);

        if (! $apiKey) {
            return response()->json([
                'code' => 'unauthorized',
                'message' => '유효하지 않은 API key입니다.',
            ], 401);
        }

        if ($apiKey->isPaused()) {
            return response()->json([
                'code' => 'key_paused',
                'message' => '일시정지된 API key입니다.',
            ], 403);
        }

        $user = $apiKey->user;

        if (! $user->hasQuota()) {
            return response()->json([
                'code' => 'quota_exceeded',
                'message' => '무료 호출 회수를 초과했습니다.',
            ], 429);
        }

        // 요청에 API key 정보 주입
        $request->merge([
            '_api_key_id' => $apiKey->id,
            '_api_user_id' => $apiKey->user_id,
        ]);

        return $next($request);
    }
}
```

- [ ] **Step 4: bootstrap/app.php에 미들웨어 등록**

`laravel/bootstrap/app.php`의 `withMiddleware` 블록에 추가:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'api.key_auth' => \App\Http\Middleware\ApiKeyAuth::class,
    ]);
})
```

- [ ] **Step 5: 커밋**

```bash
git add laravel/app/Http/Middleware/ApiKeyAuth.php \
        laravel/bootstrap/app.php \
        laravel/tests/Feature/ApiKeyAuthMiddlewareTest.php
git commit -m "feat: ApiKeyAuth 미들웨어 — API key 인증 + quota 체크"
```

---

### Task 8: ApiRateLimit 미들웨어 생성

**Files:**
- Create: `laravel/app/Http/Middleware/ApiRateLimit.php`

- [ ] **Step 1: 미들웨어 파일 생성**

```php
<?php
// laravel/app/Http/Middleware/ApiRateLimit.php

namespace App\Http\Middleware;

use App\Services\SettingsService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class ApiRateLimit
{
    public function __construct(
        private SettingsService $settings,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->bearerToken();

        if (! $apiKey) {
            return $next($request);
        }

        $maxPerMinute = (int) $this->settings->get('api', 'rate_limit_per_minute', 60);
        $limiterKey = 'api_rate_limit:' . md5($apiKey);

        if (RateLimiter::tooManyAttempts($limiterKey, $maxPerMinute)) {
            $retryAfter = RateLimiter::availableIn($limiterKey);

            return response()->json([
                'code' => 'rate_limit_exceeded',
                'message' => "분당 {$maxPerMinute}회 호출 제한을 초과했습니다. {$retryAfter}초 후 다시 시도해주세요.",
                'retry_after' => $retryAfter,
            ], 429)->withHeaders([
                'Retry-After' => $retryAfter,
                'X-RateLimit-Limit' => $maxPerMinute,
                'X-RateLimit-Remaining' => 0,
            ]);
        }

        RateLimiter::hit($limiterKey, 60);

        $response = $next($request);

        return $response->withHeaders([
            'X-RateLimit-Limit' => $maxPerMinute,
            'X-RateLimit-Remaining' => RateLimiter::remaining($limiterKey, $maxPerMinute),
        ]);
    }
}
```

- [ ] **Step 2: bootstrap/app.php에 미들웨어 등록**

`laravel/bootstrap/app.php`의 `withMiddleware` 블록에 추가:

```php
$middleware->alias([
    'api.key_auth' => \App\Http\Middleware\ApiKeyAuth::class,
    'api.rate_limit' => \App\Http\Middleware\ApiRateLimit::class,
]);
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Http/Middleware/ApiRateLimit.php \
        laravel/bootstrap/app.php
git commit -m "feat: ApiRateLimit 미들웨어 — 분당 rate limit (Redis 기반)"
```

---

## Phase 3: API 컨트롤러 & 요청 검증

### Task 9: ApiSearchRequest 생성

**Files:**
- Create: `laravel/app/Http/Requests/ApiSearchRequest.php`
- Create: `laravel/app/Http/Resources/ApiSearchResource.php`

- [ ] **Step 1: 요청 검증 파일 생성**

```php
<?php
// laravel/app/Http/Requests/ApiSearchRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApiSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:500'],
            'target_language' => ['nullable', 'string', 'in:ko,zh,en'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'folder' => ['nullable', 'string', 'max:100'],
            'lang' => ['nullable', 'string', 'in:ko,zh,en'],
            'mode' => ['nullable', 'string', 'in:hierarchy,search'],
            'slang' => ['nullable', 'string', 'in:ko,zh,en'],
        ];
    }
}
```

- [ ] **Step 2: 리소스 파일 생성**

```php
<?php
// laravel/app/Http/Resources/ApiSearchResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApiSearchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $targetLanguage = $request->input('target_language', 'ko');
        $nameField = 'category_name_' . $targetLanguage;

        return [
            'category_code' => $this->category_code,
            'category_name' => $this->{$nameField},
            'similarity_score' => round($this->similarity_score, 4),
        ];
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Http/Requests/ApiSearchRequest.php \
        laravel/app/Http/Resources/ApiSearchResource.php
git commit -m "feat: ApiSearchRequest + ApiSearchResource — 외부 API 검증/응답"
```

---

### Task 9-2: RecommendationService에 searchLang 파라미터 추가

**Files:**
- Modify: `laravel/app/Services/RecommendationService.php`

- [ ] **Step 1: recommendPaginated 메서드에 searchLang 파라미터 추가**

`laravel/app/Services/RecommendationService.php`의 `recommendPaginated` 메서드 시그니처를 수정하고, keyword 필터 로직을 확장합니다:

```php
// 메서드 시그니처 변경 (기존)
public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1, int|array|null $userId = null, ?string $keyword = null, ?string $folder = null): LengthAwarePaginator

// 메서드 시그니처 변경 (새로운)
public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1, int|array|null $userId = null, ?string $keyword = null, ?string $folder = null, ?string $searchLang = null): LengthAwarePaginator
```

keyword 필터 로직 변경 (기존 라인 115-117):

```php
// 기존
if ($keyword) {
    $query->where('categories.category_name_ko', 'like', $keyword.'%');
}

// 변경
if ($keyword) {
    if ($searchLang) {
        // searchLang이 지정되면 해당 언어 컬럼에서만 접두사 검색
        $nameField = 'category_name_' . $searchLang;
        $query->where("categories.{$nameField}", 'like', $keyword.'%');
    } else {
        // searchLang이 없으면 모든 언어에서 부분 검색
        $query->where(function ($q) use ($keyword) {
            $q->where('categories.category_name_ko', 'like', '%'.$keyword.'%')
              ->orWhere('categories.category_name_en', 'like', '%'.$keyword.'%')
              ->orWhere('categories.category_name_zh', 'like', '%'.$keyword.'%')
              ->orWhere('categories.category_code', 'like', '%'.$keyword.'%');
        });
    }
}
```

- [ ] **Step 2: 기존 RecommendController 호출부 확인**

`RecommendController::recommend()`에서 `recommendPaginated`를 호출할 때 `searchLang` 파라미터를 전달하지 않으므로, 기본값 `null`로 동작 — 기존 동작 유지.

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Services/RecommendationService.php
git commit -m "feat: RecommendationService에 searchLang 파라미터 추가"
```

---

### Task 10: ApiController 생성 (POST /api/v1/search)

**Files:**
- Create: `laravel/app/Http/Controllers/Api/ApiController.php`
- Modify: `laravel/routes/api.php`
- Create: `laravel/tests/Feature/ApiSearchTest.php`

- [ ] **Step 1: 테스트 파일 생성**

```php
<?php
// laravel/tests/Feature/ApiSearchTest.php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\Category;
use App\Models\SearchLog;
use App\Models\User;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Pagination\LengthAwarePaginator;

uses(TestCase::class, RefreshDatabase::class);

test('POST /api/v1/search — 유효한 요청은 유사도 검색 결과를 반환한다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 100]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $category = new Category([
        'category_code' => 'TEST001',
        'category_name_ko' => '테스트 카테고리',
    ]);
    $category->id = 1;
    $category->similarity_score = 0.95;

    $paginator = new LengthAwarePaginator(
        items: collect([$category]),
        total: 1,
        perPage: 20,
        currentPage: 1,
    );

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
        'target_language' => 'ko',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [['category_code', 'category_name', 'similarity_score']],
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
        ])
        ->assertJsonPath('data.0.category_code', 'TEST001');
});

test('POST /api/v1/search — 호출 후 사용량이 기록된다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 100]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn(
        new SearchLog(['search_keyword' => '청바지', 'normalized_keyword' => '청바지', 'embed_model_name' => 'bge-m3:latest'])
    );
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $paginator = new LengthAwarePaginator(items: collect(), total: 0, perPage: 20, currentPage: 1);
    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $this->postJson('/api/v1/search', [
        'text' => '청바지',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    expect(ApiUsageLog::where('api_key_id', $apiKey->id)->count())->toBe(1);
});

test('POST /api/v1/search — 호출 후 quota가 감소한다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 50]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn(
        new SearchLog(['search_keyword' => '청바지', 'normalized_keyword' => '청바지', 'embed_model_name' => 'bge-m3:latest'])
    );
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $paginator = new LengthAwarePaginator(items: collect(), total: 0, perPage: 20, currentPage: 1);
    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $this->postJson('/api/v1/search', [
        'text' => '청바지',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $user->refresh();
    expect($user->api_quota_remaining)->toBe(49);
});

test('POST /api/v1/search — 기본값 target_language는 ko이다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 100]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn(
        new SearchLog(['search_keyword' => '청바지', 'normalized_keyword' => '청바지', 'embed_model_name' => 'bge-m3:latest'])
    );
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn(
        new LengthAwarePaginator(items: collect(), total: 0, perPage: 20, currentPage: 1)
    );
    app()->instance(RecommendationService::class, $mockRecommend);

    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $response->assertOk();
});

test('POST /api/v1/search — mode=hierarchy 시 search_lang이 전달된다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 100]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn(
        new SearchLog(['search_keyword' => '바지', 'normalized_keyword' => '바지', 'embed_model_name' => 'bge-m3:latest'])
    );
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn(
        new LengthAwarePaginator(items: collect(), total: 0, perPage: 20, currentPage: 1)
    );
    app()->instance(RecommendationService::class, $mockRecommend);

    $response = $this->postJson('/api/v1/search', [
        'text' => '바지',
        'mode' => 'hierarchy',
        'lang' => 'ko',
    ], ['Authorization' => 'Bearer ' . $apiKey->key]);

    $response->assertOk();
});
```

- [ ] **Step 2: 컨트롤러 파일 생성**

```php
<?php
// laravel/app/Http/Controllers/Api/ApiController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApiSearchRequest;
use App\Http\Resources\ApiSearchResource;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use App\Services\ApiUsageService;
use App\Services\ApiKeyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ApiController extends Controller
{
    public function __construct(
        private EmbeddingCacheService $embeddingCache,
        private RecommendationService $recommendation,
        private ApiUsageService $usageService,
        private ApiKeyService $apiKeyService,
    ) {}

    public function search(ApiSearchRequest $request): JsonResponse
    {
        $startTime = microtime(true);

        $text = $request->validated('text');
        $targetLanguage = $request->validated('target_language', 'ko');
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 20);
        $keyword = $request->input('keyword');
        $folder = $request->input('folder');
        $mode = $request->input('mode', 'search');
        $lang = $request->input('lang', $targetLanguage);
        $slang = $request->input('slang');

        $apiKeyId = $request->input('_api_key_id');
        $userId = $request->input('_api_user_id');

        // search_lang 매핑: hierarchy 모드에서만 전달
        $searchLang = ($mode === 'hierarchy') ? $lang : null;

        // slang 처리: 유사도 검색 언어
        $recommendTargetLanguage = $slang ?? $targetLanguage;

        // 검색 로그 생성 (임베딩 생성용)
        $searchLog = $this->embeddingCache->getOrCreateEmbedding($text);

        // 유사도 검색 (filter='my' 고정, userId 스코핑)
        $results = $this->recommendation->recommendPaginated(
            searchLog: $searchLog,
            targetLanguage: $recommendTargetLanguage,
            perPage: $perPage,
            page: $page,
            userId: $userId,
            keyword: $keyword,
            folder: $folder,
            searchLang: $searchLang,
        );

        // 사용량 기록
        $processingTimeMs = (int) ((microtime(true) - $startTime) * 1000);
        $this->usageService->log(
            apiKeyId: $apiKeyId,
            userId: $userId,
            endpoint: '/api/v1/search',
            parameters: $request->only(['text', 'target_language', 'keyword', 'folder', 'mode', 'lang', 'slang']),
            responseStatus: 200,
            processingTimeMs: $processingTimeMs,
        );

        // quota 감소
        DB::table('users')->where('id', $userId)->decrement('api_quota_remaining', 1);

        // API key last_used_at 갱신
        $this->apiKeyService->touchLastUsed($apiKeyId);

        return ApiSearchResource::collection($results)
            ->response()
            ->withHeaders([
                'X-Processing-Time-Ms' => $processingTimeMs,
            ]);
    }
}
```

- [ ] **Step 3: 라우트 등록**

`laravel/routes/api.php`에 추가:

```php
// 외부 API (API key 인증)
Route::prefix('v1')->middleware(['api.rate_limit', 'api.key_auth'])->group(function () {
    Route::post('search', [\App\Http\Controllers\Api\ApiController::class, 'search']);
});
```

- [ ] **Step 4: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --filter=ApiSearchTest
```

Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/ApiController.php \
        laravel/routes/api.php \
        laravel/tests/Feature/ApiSearchTest.php
git commit -m "feat: ApiController — POST /api/v1/search 엔드포인트 구현"
```

---

### Task 11: MyPageController 생성

**Files:**
- Create: `laravel/app/Http/Controllers/Api/MyPageController.php`
- Create: `laravel/app/Http/Requests/ApiKeyStoreRequest.php`
- Create: `laravel/app/Http/Requests/ApiKeyUpdateRequest.php`
- Modify: `laravel/routes/api.php`
- Create: `laravel/tests/Feature/MyPageApiTest.php`

- [ ] **Step 1: 요청 검증 파일 생성**

```php
<?php
// laravel/app/Http/Requests/ApiKeyStoreRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApiKeyStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
        ];
    }
}
```

```php
<?php
// laravel/app/Http/Requests/ApiKeyUpdateRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApiKeyUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', 'string', 'in:active,paused'],
        ];
    }
}
```

- [ ] **Step 2: 테스트 파일 생성**

```php
<?php
// laravel/tests/Feature/MyPageApiTest.php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class);

test('GET /api/mypage/api-keys — 인증된 사용자의 API key 목록을 반환한다', function () {
    $user = User::factory()->create();
    ApiKey::factory()->count(3)->create(['user_id' => $user->id]);

    $response = $this->getJson('/api/mypage/api-keys', [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('POST /api/mypage/api-keys — 새 API key를 생성한다', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/mypage/api-keys', [
        'name' => 'My App',
    ], [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.name', 'My App')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.key', fn ($key) => str_starts_with($key, 'cl_'));
});

test('PATCH /api/mypage/api-keys/{id} — API key 상태를 변경한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'status' => 'active']);

    $response = $this->patchJson("/api/mypage/api-keys/{$apiKey->id}", [
        'status' => 'paused',
    ], [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'paused');
});

test('DELETE /api/mypage/api-keys/{id} — API key를 삭제한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $response = $this->deleteJson("/api/mypage/api-keys/{$apiKey->id}", [], [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertNoContent();
    expect(ApiKey::find($apiKey->id))->toBeNull();
});

test('GET /api/mypage/usage — 사용량 통계를 반환한다', function () {
    $user = User::factory()->create(['api_quota_remaining' => 50]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(10)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);

    $response = $this->getJson('/api/mypage/usage', [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonPath('total_calls', 10)
        ->assertJsonPath('quota_remaining', 50);
});

test('GET /api/mypage/usage/history — 최근 호출 이력을 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(5)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);

    $response = $this->getJson('/api/mypage/usage/history', [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonCount(5, 'data');
});

test('GET /api/mypage/usage/chart — 기간별 추이 데이터를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->getJson('/api/mypage/usage/chart?days=7', [
        'Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonCount(7, 'data');
});
```

- [ ] **Step 3: 컨트롤러 파일 생성**

```php
<?php
// laravel/app/Http/Controllers/Api/MyPageController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApiKeyStoreRequest;
use App\Http\Requests\ApiKeyUpdateRequest;
use App\Models\ApiKey;
use App\Services\ApiKeyService;
use App\Services\ApiUsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyPageController extends Controller
{
    public function __construct(
        private ApiKeyService $apiKeyService,
        private ApiUsageService $usageService,
    ) {}

    /**
     * API key 목록 조회
     */
    public function apiKeys(Request $request): JsonResponse
    {
        $keys = $this->apiKeyService->listByUser($request->user()->id);

        return response()->json(['data' => $keys]);
    }

    /**
     * API key 생성
     */
    public function storeApiKey(ApiKeyStoreRequest $request): JsonResponse
    {
        $apiKey = $this->apiKeyService->create(
            $request->user()->id,
            $request->validated('name'),
        );

        return response()->json(['data' => $apiKey], 201);
    }

    /**
     * API key 수정 (이름/상태)
     */
    public function updateApiKey(ApiKeyUpdateRequest $request, int $id): JsonResponse
    {
        $apiKey = $this->apiKeyService->findById($id);

        if (! $apiKey || $apiKey->user_id !== $request->user()->id) {
            return response()->json(['message' => 'API key를 찾을 수 없습니다.'], 404);
        }

        if ($request->has('name')) {
            $apiKey = $this->apiKeyService->updateName($id, $request->validated('name'));
        }

        if ($request->has('status')) {
            $apiKey = $this->apiKeyService->updateStatus($id, $request->validated('status'));
        }

        return response()->json(['data' => $apiKey->refresh()]);
    }

    /**
     * API key 삭제
     */
    public function destroyApiKey(Request $request, int $id): JsonResponse
    {
        $apiKey = $this->apiKeyService->findById($id);

        if (! $apiKey || $apiKey->user_id !== $request->user()->id) {
            return response()->json(['message' => 'API key를 찾을 수 없습니다.'], 404);
        }

        $this->apiKeyService->delete($id);

        return response()->json(null, 204);
    }

    /**
     * 사용량 통계 조회
     */
    public function usage(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json([
            'total_calls' => $this->usageService->getTotalCalls($userId),
            'today_calls' => $this->usageService->getTodayCalls($userId),
            'active_keys' => $this->usageService->getActiveKeyCount($userId),
            'quota_remaining' => $request->user()->api_quota_remaining,
            'quota_limit' => $request->user()->api_quota_limit,
        ]);
    }

    /**
     * 최근 호출 이력
     */
    public function usageHistory(Request $request): JsonResponse
    {
        $history = $this->usageService->getRecentHistory(
            $request->user()->id,
            (int) $request->input('limit', 20),
        );

        return response()->json(['data' => $history]);
    }

    /**
     * 기간별 추이 데이터
     */
    public function usageChart(Request $request): JsonResponse
    {
        $chart = $this->usageService->getDailyChart(
            $request->user()->id,
            (int) $request->input('days', 30),
        );

        return response()->json(['data' => $chart]);
    }
}
```

- [ ] **Step 4: 라우트 등록**

`laravel/routes/api.php`에 추가:

```php
// 마이페이지 API
Route::middleware('auth:sanctum')->prefix('mypage')->group(function () {
    Route::get('api-keys', [MyPageController::class, 'apiKeys']);
    Route::post('api-keys', [MyPageController::class, 'storeApiKey']);
    Route::patch('api-keys/{id}', [MyPageController::class, 'updateApiKey']);
    Route::delete('api-keys/{id}', [MyPageController::class, 'destroyApiKey']);
    Route::get('usage', [MyPageController::class, 'usage']);
    Route::get('usage/history', [MyPageController::class, 'usageHistory']);
    Route::get('usage/chart', [MyPageController::class, 'usageChart']);
});
```

- [ ] **Step 5: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --filter=MyPageApiTest
```

Expected: PASS — 모든 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/MyPageController.php \
        laravel/app/Http/Requests/ApiKeyStoreRequest.php \
        laravel/app/Http/Requests/ApiKeyUpdateRequest.php \
        laravel/routes/api.php \
        laravel/tests/Feature/MyPageApiTest.php
git commit -m "feat: MyPageController — API key CRUD + 사용량 통계 API"
```

---

### Task 12: 관리자 회원 관리 API 확장

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/AdminSettingsController.php`
- Create: `laravel/app/Http/Requests/QuotaAdjustRequest.php`
- Modify: `laravel/routes/api.php`
- Create: `laravel/tests/Feature/AdminUserApiTest.php`

- [ ] **Step 1: 요청 검증 파일 생성**

```php
<?php
// laravel/app/Http/Requests/QuotaAdjustRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class QuotaAdjustRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isSuperAdmin();
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', 'in:absolute,increment'],
            'value' => ['required', 'integer', 'min:0'],
        ];
    }
}
```

- [ ] **Step 2: 테스트 파일 생성**

```php
<?php
// laravel/tests/Feature/AdminUserApiTest.php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class);

test('GET /api/admin/users/{id} — 회원 상세 정보와 API 사용량을 반환한다', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create(['api_quota_remaining' => 50]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(5)->create([
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
    ]);

    $response = $this->getJson("/api/admin/users/{$user->id}", [
        'Authorization' => 'Bearer ' . $admin->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.name', $user->name)
        ->assertJsonPath('data.api_quota_remaining', 50)
        ->assertJsonPath('data.total_calls', 5);
});

test('PATCH /api/admin/users/{id}/quota — 절대값으로 회수를 설정한다', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create(['api_quota_remaining' => 50, 'api_quota_limit' => 100]);

    $response = $this->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
        'value' => 200,
    ], [
        'Authorization' => 'Bearer ' . $admin->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.api_quota_remaining', 200)
        ->assertJsonPath('data.api_quota_limit', 200);
});

test('PATCH /api/admin/users/{id}/quota — 증감으로 회수를 조절한다', function () {
    $admin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create(['api_quota_remaining' => 50, 'api_quota_limit' => 100]);

    $response = $this->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'increment',
        'value' => 30,
    ], [
        'Authorization' => 'Bearer ' . $admin->createToken('test')->plainTextToken,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.api_quota_remaining', 80);
});

test('PATCH /api/admin/users/{id}/quota — superadmin이 아니면 403을 반환한다', function () {
    $member = User::factory()->create(['role' => 'member']);
    $user = User::factory()->create();

    $response = $this->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
        'value' => 200,
    ], [
        'Authorization' => 'Bearer ' . $member->createToken('test')->plainTextToken,
    ]);

    $response->assertForbidden();
});
```

- [ ] **Step 3: AdminSettingsController 수정**

`laravel/app/Http/Controllers/Api/AdminSettingsController.php`에서:

**3a. `users()` 메서드에서 `role`, `created_at` 필드 추가:**

```php
// 기존
$users = User::select('id', 'name', 'email')->orderBy('name')->get();

// 변경
$users = User::select('id', 'name', 'email', 'role', 'created_at')->orderBy('name')->get();
```

**3b. 다음 메서드 추가:**

```php
/**
 * 회원 상세 정보 + API 사용량
 */
public function userDetail(int $id): JsonResponse
{
    $user = User::findOrFail($id);
    $apiKeyIds = $user->apiKeys()->pluck('id');

    $totalCalls = ApiUsageLog::where('user_id', $id)->count();
    $todayCalls = ApiUsageLog::where('user_id', $id)
        ->whereDate('created_at', now()->toDateString())
        ->count();
    $activeKeys = $user->apiKeys()->where('status', 'active')->count();

    $callsByKey = ApiUsageLog::where('user_id', $id)
        ->select('api_key_id', DB::raw('COUNT(*) as total'))
        ->groupBy('api_key_id')
        ->with('apiKey:id,name,key')
        ->get();

    return response()->json([
        'data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'created_at' => $user->created_at,
            'api_quota_remaining' => $user->api_quota_remaining,
            'api_quota_limit' => $user->api_quota_limit,
            'total_calls' => $totalCalls,
            'today_calls' => $todayCalls,
            'active_keys' => $activeKeys,
            'calls_by_key' => $callsByKey,
        ],
    ]);
}

/**
 * 회원 회수 조절
 */
public function adjustQuota(QuotaAdjustRequest $request, int $id): JsonResponse
{
    $user = User::findOrFail($id);
    $type = $request->validated('type');
    $value = $request->validated('value');

    if ($type === 'absolute') {
        $user->update([
            'api_quota_remaining' => $value,
            'api_quota_limit' => $value,
        ]);
    } else {
        $user->increment('api_quota_remaining', $value);
        $user->increment('api_quota_limit', $value);
    }

    return response()->json([
        'data' => $user->fresh(['apiKeys']),
    ]);
}
```

- [ ] **Step 4: 라우트 등록**

`laravel/routes/api.php`의 admin 그룹에 추가:

```php
Route::middleware('auth:sanctum')->prefix('admin')->group(function () {
    // 기존 라우트...
    Route::get('users/{id}', [AdminSettingsController::class, 'userDetail']);
    Route::patch('users/{id}/quota', [AdminSettingsController::class, 'adjustQuota']);
});
```

- [ ] **Step 5: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --filter=AdminUserApiTest
```

Expected: PASS — 모든 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/AdminSettingsController.php \
        laravel/app/Http/Requests/QuotaAdjustRequest.php \
        laravel/routes/api.php \
        laravel/tests/Feature/AdminUserApiTest.php
git commit -m "feat: 관리자 회원 관리 API — 상세 조회 + 회수 조절"
```

---

### Task 13: AuthController 수정 — 가입 시 quota 할당

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/AuthController.php`
- Modify: `laravel/tests/Feature/AuthTest.php` (또는 관련 테스트)

- [ ] **Step 1: AuthController 수정**

`laravel/app/Http/Controllers/Api/AuthController.php`의 `register` 메서드에서 사용자 생성 시 `api_quota_remaining`과 `api_quota_limit`을 settings 값으로 설정:

```php
// register 메서드 내 사용자 생성 부분
$freeQuota = app(SettingsService::class)->get('api', 'free_quota', 100);

$user = User::create([
    'name' => $validated['name'],
    'email' => $validated['email'],
    'password' => Hash::make($validated['password']),
    'api_quota_remaining' => $freeQuota,
    'api_quota_limit' => $freeQuota,
]);
```

- [ ] **Step 2: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --filter=Auth
```

Expected: PASS — 기존 인증 테스트 모두 통과

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/AuthController.php
git commit -m "feat: 회원가입 시 settings 기반 무료 quota 자동 할당"
```

---

## Phase 4: 프론트엔드 API & 훅

### Task 14: api.ts에 마이페이지/관리자 API 함수 추가

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: 타입 정의 추가**

`nextjs/lib/api.ts` 파일 끝에 다음 타입과 함수 추가:

```typescript
// === 마이페이지 API ===

export interface ApiKeyItem {
  id: number;
  name: string;
  key: string;
  status: "active" | "paused";
  last_used_at: string | null;
  created_at: string;
}

export interface UsageStats {
  total_calls: number;
  today_calls: number;
  active_keys: number;
  quota_remaining: number;
  quota_limit: number;
}

export interface UsageHistoryItem {
  id: number;
  api_key_id: number;
  endpoint: string;
  response_status: number;
  processing_time_ms: number;
  created_at: string;
  api_key?: {
    id: number;
    name: string;
    key: string;
  };
}

export interface ChartDataPoint {
  date: string;
  total: number;
}

export function getApiKeys(token: string): Promise<{ data: ApiKeyItem[] }> {
  return request("/mypage/api-keys", { token });
}

export function createApiKey(token: string, name: string): Promise<{ data: ApiKeyItem }> {
  return request("/mypage/api-keys", { method: "POST", body: { name }, token });
}

export function updateApiKey(
  token: string,
  id: number,
  data: { name?: string; status?: string },
): Promise<{ data: ApiKeyItem }> {
  return request(`/mypage/api-keys/${id}`, { method: "PATCH", body: data, token });
}

export function deleteApiKey(token: string, id: number): Promise<void> {
  return request(`/mypage/api-keys/${id}`, { method: "DELETE", token });
}

export function getUsageStats(token: string): Promise<UsageStats> {
  return request("/mypage/usage", { token });
}

export function getUsageHistory(
  token: string,
  limit?: number,
): Promise<{ data: UsageHistoryItem[] }> {
  const query = limit ? `?limit=${limit}` : "";
  return request(`/mypage/usage/history${query}`, { token });
}

export function getUsageChart(
  token: string,
  days?: number,
): Promise<{ data: ChartDataPoint[] }> {
  const query = days ? `?days=${days}` : "";
  return request(`/mypage/usage/chart${query}`, { token });
}

// === 관리자 회원 관리 API ===

export interface AdminUserListItem {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export function fetchAdminUsers(token: string): Promise<{ data: AdminUserListItem[] }> {
  return request("/admin/users", { token });
}

export interface AdminUserDetail {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  api_quota_remaining: number;
  api_quota_limit: number;
  total_calls: number;
  today_calls: number;
  active_keys: number;
  calls_by_key: {
    api_key_id: number;
    total: number;
    api_key?: { id: number; name: string; key: string };
  }[];
}

export function getAdminUserDetail(
  token: string,
  userId: number,
): Promise<{ data: AdminUserDetail }> {
  return request(`/admin/users/${userId}`, { token });
}

export function adjustUserQuota(
  token: string,
  userId: number,
  type: "absolute" | "increment",
  value: number,
): Promise<{ data: AdminUserDetail }> {
  return request(`/admin/users/${userId}/quota`, {
    method: "PATCH",
    body: { type, value },
    token,
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: api.ts에 마이페이지/관리자 API 함수 추가"
```

---

### Task 15: useApiKeys 훅 생성

**Files:**
- Create: `nextjs/hooks/useApiKeys.ts`

- [ ] **Step 1: 훅 파일 생성**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  type ApiKeyItem,
} from "@/lib/api";

interface UseApiKeysReturn {
  apiKeys: ApiKeyItem[];
  isLoading: boolean;
  error: string | null;
  loadApiKeys: () => Promise<void>;
  addApiKey: (name: string) => Promise<ApiKeyItem>;
  toggleStatus: (id: number, currentStatus: string) => Promise<void>;
  removeApiKey: (id: number) => Promise<void>;
  renameApiKey: (id: number, name: string) => Promise<void>;
}

export function useApiKeys(token?: string | null): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getApiKeys(token);
      setApiKeys(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API key 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const addApiKey = useCallback(
    async (name: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const response = await createApiKey(token, name);
      setApiKeys((prev) => [response.data, ...prev]);
      return response.data;
    },
    [token],
  );

  const toggleStatus = useCallback(
    async (id: number, currentStatus: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const response = await updateApiKey(token, id, { status: newStatus });
      setApiKeys((prev) => prev.map((k) => (k.id === id ? response.data : k)));
    },
    [token],
  );

  const removeApiKey = useCallback(
    async (id: number) => {
      if (!token) throw new Error("인증이 필요합니다.");
      await deleteApiKey(token, id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    },
    [token],
  );

  const renameApiKey = useCallback(
    async (id: number, name: string) => {
      if (!token) throw new Error("인증이 필요합니다.");
      const response = await updateApiKey(token, id, { name });
      setApiKeys((prev) => prev.map((k) => (k.id === id ? response.data : k)));
    },
    [token],
  );

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  return {
    apiKeys,
    isLoading,
    error,
    loadApiKeys,
    addApiKey,
    toggleStatus,
    removeApiKey,
    renameApiKey,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/hooks/useApiKeys.ts
git commit -m "feat: useApiKeys 훅 — API key CRUD 관리"
```

---

### Task 16: useUsageStats 훅 생성

**Files:**
- Create: `nextjs/hooks/useUsageStats.ts`

- [ ] **Step 1: 훅 파일 생성**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getUsageStats,
  getUsageHistory,
  getUsageChart,
  type UsageStats,
  type UsageHistoryItem,
  type ChartDataPoint,
} from "@/lib/api";

interface UseUsageStatsReturn {
  stats: UsageStats | null;
  history: UsageHistoryItem[];
  chart: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  loadHistory: (limit?: number) => Promise<void>;
  loadChart: (days?: number) => Promise<void>;
}

export function useUsageStats(token?: string | null): UseUsageStatsReturn {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [history, setHistory] = useState<UsageHistoryItem[]>([]);
  const [chart, setChart] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUsageStats(token);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용량 통계를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const loadHistory = useCallback(
    async (limit?: number) => {
      if (!token) return;
      try {
        const response = await getUsageHistory(token, limit);
        setHistory(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "호출 이력을 불러오지 못했습니다.");
      }
    },
    [token],
  );

  const loadChart = useCallback(
    async (days?: number) => {
      if (!token) return;
      try {
        const response = await getUsageChart(token, days);
        setChart(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "차트 데이터를 불러오지 못했습니다.");
      }
    },
    [token],
  );

  useEffect(() => {
    loadStats();
    loadHistory();
    loadChart();
  }, [loadStats, loadHistory, loadChart]);

  return {
    stats,
    history,
    chart,
    isLoading,
    error,
    loadStats,
    loadHistory,
    loadChart,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/hooks/useUsageStats.ts
git commit -m "feat: useUsageStats 훅 — 사용량 통계 관리"
```

---

## Phase 5: 프론트엔드 페이지 & 컴포넌트

### Task 17: 마이페이지 생성

**Files:**
- Create: `nextjs/app/mypage/page.tsx`
- Create: `nextjs/app/mypage/layout.tsx`
- Create: `nextjs/app/mypage/page-content.tsx`

- [ ] **Step 1: 서버 컴포넌트 생성**

```typescript
// nextjs/app/mypage/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { MyPageContent } from "./page-content";

export default async function MyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login?redirect=/mypage");
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    redirect("/login?redirect=/mypage");
  }

  return <MyPageContent serverUser={user} />;
}
```

- [ ] **Step 2: 레이아웃 생성**

```typescript
// nextjs/app/mypage/layout.tsx
"use client";

import { AppHeader } from "@/components/app-header";

export default function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12 sm:px-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 클라이언트 컴포넌트 생성**

```typescript
// nextjs/app/mypage/page-content.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { ApiKeySection } from "@/components/mypage/api-key-section";
import { UsageDashboard } from "@/components/mypage/usage-dashboard";
import { UsageChart } from "@/components/mypage/usage-chart";
import { UsageHistory } from "@/components/mypage/usage-history";

export function MyPageContent({ serverUser }: { serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/mypage");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const token = getToken();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-muted-foreground">
          API key를 관리하고 사용량을 확인할 수 있습니다.
        </p>
      </div>

      <ApiKeySection token={token} />
      <UsageDashboard token={token} />
      <UsageChart token={token} />
      <UsageHistory token={token} />
    </div>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add nextjs/app/mypage/
git commit -m "feat: 마이페이지 — 페이지 구조 생성"
```

---

### Task 18: API key 관리 컴포넌트 생성

**Files:**
- Create: `nextjs/components/mypage/api-key-section.tsx`
- Create: `nextjs/components/mypage/api-key-card.tsx`
- Create: `nextjs/components/mypage/api-key-create-dialog.tsx`

- [ ] **Step 1: api-key-create-dialog 생성**

```typescript
// nextjs/components/mypage/api-key-create-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKeyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}

export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  onSubmit,
}: ApiKeyCreateDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
      setName("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 API key 생성</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">이름</Label>
              <Input
                id="key-name"
                placeholder="예: My App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: api-key-card 생성**

```typescript
// nextjs/components/mypage/api-key-card.tsx
"use client";

import { useState } from "react";
import { Copy, Pause, Play, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ApiKeyItem } from "@/lib/api";

interface ApiKeyCardProps {
  apiKey: ApiKeyItem;
  onToggleStatus: (id: number, currentStatus: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
}

export function ApiKeyCard({
  apiKey,
  onToggleStatus,
  onDelete,
  onRename,
}: ApiKeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(apiKey.name);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey.key);
    toast.success("API key가 클립보드에 복사되었습니다.");
  };

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggleStatus(apiKey.id, apiKey.status);
      toast.success(
        apiKey.status === "active" ? "일시정지되었습니다." : "활성화되었습니다.",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("이 API key를 삭제하시겠습니까?")) return;
    setIsDeleting(true);
    try {
      await onDelete(apiKey.id);
      toast.success("API key가 삭제되었습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === apiKey.name) {
      setIsEditing(false);
      return;
    }
    await onRename(apiKey.id, editName.trim());
    setIsEditing(false);
    toast.success("이름이 변경되었습니다.");
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 w-40"
                maxLength={100}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRename}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="font-medium">{apiKey.name}</span>
          )}
          <Badge variant={apiKey.status === "active" ? "default" : "secondary"}>
            {apiKey.status === "active" ? "활성" : "일시정지"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {apiKey.key.slice(0, 10)}...
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={copyKey}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {apiKey.last_used_at && (
            <span>
              마지막 사용: {new Date(apiKey.last_used_at).toLocaleDateString("ko-KR")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsEditing(true)}
          disabled={isEditing}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleToggle}
          disabled={isToggling}
        >
          {apiKey.status === "active" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: api-key-section 생성**

```typescript
// nextjs/components/mypage/api-key-section.tsx
"use client";

import { useState } from "react";
import { Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiKeys } from "@/hooks/useApiKeys";
import { ApiKeyCard } from "./api-key-card";
import { ApiKeyCreateDialog } from "./api-key-create-dialog";

interface ApiKeySectionProps {
  token: string | null;
}

export function ApiKeySection({ token }: ApiKeySectionProps) {
  const { apiKeys, isLoading, addApiKey, toggleStatus, removeApiKey, renameApiKey } =
    useApiKeys(token);
  const [showCreate, setShowCreate] = useState(false);

  if (!token) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key 관리
        </CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          새 API key
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 생성된 API key가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <ApiKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                onToggleStatus={toggleStatus}
                onDelete={removeApiKey}
                onRename={renameApiKey}
              />
            ))}
          </div>
        )}
      </CardContent>

      <ApiKeyCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={addApiKey}
      />
    </Card>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add nextjs/components/mypage/api-key-section.tsx \
        nextjs/components/mypage/api-key-card.tsx \
        nextjs/components/mypage/api-key-create-dialog.tsx
git commit -m "feat: API key 관리 컴포넌트 — 목록, 카드, 생성 다이얼로그"
```

---

### Task 19: 사용량 대시보드 컴포넌트 생성

**Files:**
- Create: `nextjs/components/mypage/usage-dashboard.tsx`

- [ ] **Step 1: 컴포넌트 생성**

```typescript
// nextjs/components/mypage/usage-dashboard.tsx
"use client";

import { Activity, BarChart3, CalendarDays, Key } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageDashboardProps {
  token: string | null;
}

export function UsageDashboard({ token }: UsageDashboardProps) {
  const { stats, isLoading } = useUsageStats(token);

  if (!token) return null;

  const items = [
    {
      label: "총 호출",
      value: stats?.total_calls ?? 0,
      icon: Activity,
    },
    {
      label: "오늘 호출",
      value: stats?.today_calls ?? 0,
      icon: CalendarDays,
    },
    {
      label: "남은 회수",
      value: stats?.quota_remaining ?? 0,
      icon: BarChart3,
    },
    {
      label: "활성 key",
      value: stats?.active_keys ?? 0,
      icon: Key,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용량 대시보드</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/components/mypage/usage-dashboard.tsx
git commit -m "feat: 사용량 대시보드 컴포넌트"
```

---

### Task 20: 사용량 차트 컴포넌트 생성

**Files:**
- Create: `nextjs/components/mypage/usage-chart.tsx`

- [ ] **Step 1: 컴포넌트 생성**

```typescript
// nextjs/components/mypage/usage-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageChartProps {
  token: string | null;
}

export function UsageChart({ token }: UsageChartProps) {
  const { chart, isLoading } = useUsageStats(token);

  if (!token) return null;

  const maxTotal = Math.max(...chart.map((d) => d.total), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>기간별 추이</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : chart.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 200 }}>
            {chart.map((point) => (
              <div
                key={point.date}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t bg-primary transition-all"
                  style={{
                    height: `${(point.total / maxTotal) * 160}px`,
                    minHeight: point.total > 0 ? 4 : 0,
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {point.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/components/mypage/usage-chart.tsx
git commit -m "feat: 사용량 차트 컴포넌트 (일별 추이)"
```

---

### Task 21: 사용량 이력 컴포넌트 생성

**Files:**
- Create: `nextjs/components/mypage/usage-history.tsx`

- [ ] **Step 1: 컴포넌트 생성**

```typescript
// nextjs/components/mypage/usage-history.tsx
"use client";

import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageHistoryProps {
  token: string | null;
}

export function UsageHistory({ token }: UsageHistoryProps) {
  const { history, isLoading } = useUsageStats(token);

  if (!token) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          최근 호출 이력
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">호출 이력이 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>API key</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">처리시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.api_key?.name ?? `key #${item.api_key_id}`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.response_status >= 200 && item.response_status < 300
                          ? "default"
                          : "destructive"
                      }
                    >
                      {item.response_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {item.processing_time_ms}ms
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/components/mypage/usage-history.tsx
git commit -m "feat: 사용량 이력 컴포넌트 (호출 이력 테이블)"
```

---

### Task 22: 헤더에 마이페이지 링크 추가

**Files:**
- Modify: `nextjs/components/auth-buttons.tsx`

- [ ] **Step 1: auth-buttons.tsx 수정**

`nextjs/components/auth-buttons.tsx`에서 로그인 상태일 때 사용자 이름에 `/mypage` 링크를 추가합니다. 기존 코드를 확인하고, 사용자 이름이 표시되는 부분에 `<Link href="/mypage">`로 감쌉니다.

```typescript
// auth-buttons.tsx 내 로그인 상태 부분 (기존 코드에 맞게 수정)
// 사용자 이름이 표시되는 부분을 찾아서 Link로 감싸기
<Link href="/mypage" className="hover:underline">
  {user.name}
</Link>
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/components/auth-buttons.tsx
git commit -m "feat: 헤더 닉네임에 /mypage 링크 추가"
```

---

### Task 23: 관리자 사이드바에 회원 관리 메뉴 추가

**Files:**
- Modify: `nextjs/app/admin/layout.tsx`
- Modify: `nextjs/app/admin/page-content.tsx`

- [ ] **Step 1: layout.tsx 수정**

`nextjs/app/admin/layout.tsx`에서:
1. `MenuItem` 타입에 `"users"` 추가
2. `MENU` 배열에 회원 관리 항목 추가 (Users 아이콘 import)

```typescript
import { Settings, Inbox, Users } from "lucide-react";

type MenuItem = "settings" | "info" | "users";

const MENU: { id: MenuItem; label: string; icon: typeof Settings }[] = [
  { id: "settings", label: "시스템 설정", icon: Settings },
  { id: "users", label: "회원 관리", icon: Users },
  { id: "info", label: "안내", icon: Inbox },
];
```

- [ ] **Step 2: page-content.tsx 수정**

`nextjs/app/admin/page-content.tsx`에서:
1. `UserManagement` 컴포넌트 import
2. `active === "users"` 조건부 렌더링 추가

```typescript
import { UserManagement } from "@/components/admin/user-management";

// return 문 내부에 추가
{active === "users" && <UserManagement token={token} />}
```

- [ ] **Step 3: 커밋**

```bash
git add nextjs/app/admin/layout.tsx \
        nextjs/app/admin/page-content.tsx
git commit -m "feat: 관리자 사이드바에 회원 관리 메뉴 추가"
```

---

### Task 24: 회원 관리 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/user-management.tsx`
- Create: `nextjs/components/admin/user-detail-modal.tsx`
- Create: `nextjs/components/admin/quota-adjust-dialog.tsx`

- [ ] **Step 1: quota-adjust-dialog 생성**

```typescript
// nextjs/components/admin/quota-adjust-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface QuotaAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRemaining: number;
  onSubmit: (type: "absolute" | "increment", value: number) => Promise<void>;
}

export function QuotaAdjustDialog({
  open,
  onOpenChange,
  currentRemaining,
  onSubmit,
}: QuotaAdjustDialogProps) {
  const [type, setType] = useState<"absolute" | "increment">("absolute");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(type, numValue);
      setValue("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>호출 회수 조절</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              현재 남은 회수: <strong>{currentRemaining.toLocaleString()}</strong>
            </p>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "absolute" | "increment")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="absolute" id="absolute" />
                <Label htmlFor="absolute">절대값 설정</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="increment" id="increment" />
                <Label htmlFor="increment">증감 (+/-)</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="quota-value">
                {type === "absolute" ? "설정할 회수" : "증감할 회수"}
              </Label>
              <Input
                id="quota-value"
                type="number"
                min={0}
                placeholder={type === "absolute" ? "200" : "50"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={!value || isSubmitting}>
              {isSubmitting ? "적용 중..." : "적용"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: user-detail-modal 생성**

```typescript
// nextjs/components/admin/user-detail-modal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUserDetail, adjustUserQuota, type AdminUserDetail } from "@/lib/api";
import { QuotaAdjustDialog } from "./quota-adjust-dialog";
import { toast } from "sonner";

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number | null;
  token: string;
}

export function UserDetailModal({
  open,
  onOpenChange,
  userId,
  token,
}: UserDetailModalProps) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuota, setShowQuota] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setIsLoading(true);
    getAdminUserDetail(token, userId)
      .then((res) => setUser(res.data))
      .finally(() => setIsLoading(false));
  }, [open, userId, token]);

  const handleQuotaAdjust = async (
    type: "absolute" | "increment",
    value: number,
  ) => {
    if (!userId) return;
    const res = await adjustUserQuota(token, userId, type, value);
    setUser(res.data);
    toast.success("회수가 조절되었습니다.");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>회원 상세</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          ) : !user ? (
            <p className="text-sm text-muted-foreground">
              회원 정보를 불러올 수 없습니다.
            </p>
          ) : (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">이름</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이메일</p>
                  <p className="font-medium">{user.email ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">역할</p>
                  <Badge>{user.role}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">가입일</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>

              <Separator />

              {/* API 사용량 */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">API 사용량</h3>
                  <Button size="sm" variant="outline" onClick={() => setShowQuota(true)}>
                    회수 조절
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">총 호출</p>
                    <p className="text-xl font-bold">{user.total_calls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">오늘 호출</p>
                    <p className="text-xl font-bold">{user.today_calls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">남은 회수</p>
                    <p className="text-xl font-bold">
                      {user.api_quota_remaining.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">활성 key</p>
                    <p className="text-xl font-bold">{user.active_keys}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Key별 사용량 */}
              {user.calls_by_key.length > 0 && (
                <div>
                  <h3 className="mb-3 font-semibold">Key별 사용량</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key 이름</TableHead>
                        <TableHead className="text-right">호출 횟수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.calls_by_key.map((item) => (
                        <TableRow key={item.api_key_id}>
                          <TableCell>
                            {item.api_key?.name ?? `key #${item.api_key_id}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.total.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {user && (
        <QuotaAdjustDialog
          open={showQuota}
          onOpenChange={setShowQuota}
          currentRemaining={user.api_quota_remaining}
          onSubmit={handleQuotaAdjust}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: user-management 생성**

```typescript
// nextjs/components/admin/user-management.tsx
"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAdminUsers, type AdminUserListItem } from "@/lib/api";
import { UserDetailModal } from "./user-detail-modal";

interface UserManagementProps {
  token: string | null;
}

export function UserManagement({ token }: UserManagementProps) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(!!token);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetchAdminUsers(token)
      .then((res) => setUsers(res.data))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (!token) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            회원 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">회원이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "superadmin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at!).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        관리
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDetailModal
        open={selectedUserId !== null}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
        userId={selectedUserId}
        token={token}
      />
    </>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add nextjs/components/admin/user-management.tsx \
        nextjs/components/admin/user-detail-modal.tsx \
        nextjs/components/admin/quota-adjust-dialog.tsx
git commit -m "feat: 관리자 회원 관리 컴포넌트 — 목록, 상세 모달, 회수 조절"
```

---

## Phase 6: API 문서

### Task 25: API 문서 작성

**Files:**
- Create: `docs/api-v1.md`

- [ ] **Step 1: API 문서 파일 생성**

```markdown
# CL Embed API v1 문서

## 개요

CL Embed API는 카테고리 유사도 검색 기능을 외부에서 호출할 수 있는 REST API입니다.

**Base URL:** `https://embed.cunlim.dev/api/v1`

## 인증

모든 API 요청에는 API key가 필요합니다. API key는 마이페이지(`/mypage`)에서 생성할 수 있습니다.

```
Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx
```

## 엔드포인트

### POST /api/v1/search

카테고리 유사도 검색을 수행합니다.

**요청 파라미터:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `text` | string | 예 | - | 유사도 검색어 (최대 500자) |
| `target_language` | string | 아니오 | `ko` | 대상 언어 (`ko`, `zh`, `en`) |
| `page` | integer | 아니오 | `1` | 페이지 번호 |
| `per_page` | integer | 아니오 | `20` | 페이지당 결과 수 (최대 50) |
| `keyword` | string | 아니오 | null | 키워드 필터 |
| `folder` | string | 아니오 | null | 폴더 필터 |
| `lang` | string | 아니오 | `target_language` | 분류선택 계층 언어 |
| `mode` | string | 아니오 | `search` | 검색 모드 (`hierarchy`=접두사, `search`=부분검색) |
| `slang` | string | 아니오 | null | 유사도 검색 언어 (지정 시 해당 언어로만 검색) |

**요청 예시:**

```bash
curl -X POST https://embed.cunlim.dev/api/v1/search \
  -H "Authorization: Bearer cl_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"text": "청바지", "target_language": "ko"}'
```

**응답:**

```json
{
  "data": [
    {
      "category_code": "50000000",
      "category_name": "바지",
      "similarity_score": 0.9876
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 20,
    "total": 1
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

## Rate Limit

- 분당 최대 60회 호출
- 응답 헤더에 `X-RateLimit-Limit`, `X-RateLimit-Remaining` 포함
- 초과 시 `Retry-After` 헤더와 함께 429 반환

## 무료 회수

- 회원가입 시 500회 무료 제공
- 관리자가 회수를 조절할 수 있음
- 남은 회수는 마이페이지에서 확인 가능
```

- [ ] **Step 2: 커밋**

```bash
git add docs/api-v1.md
git commit -m "docs: API v1 문서 작성"
```

---

## Phase 7: 최종 검증

### Task 26: 전체 테스트 실행 및 검증

- [ ] **Step 1: 백엔드 전체 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test
```

Expected: 모든 테스트 PASS

- [ ] **Step 2: 프론트엔드 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 타입 에러 없음

- [ ] **Step 3: 프론트엔드 린트**

```bash
docker exec cl_embed_nextjs npx eslint .
```

Expected: 린트 에러 없음

- [ ] **Step 4: Playwright E2E 테스트**

- 마이페이지 접근 확인
- API key 생성/삭제 동작 확인
- 관리자 회원 관리 모달 확인

- [ ] **Step 5: run-all-checks.sh 실행**

```bash
.claude/hooks/run-all-checks.sh
```

Expected: 모든 체크 EXIT=0

- [ ] **Step 6: 최종 커밋**

```bash
git add -A
git commit -m "feat: API key 관리 + 마이페이지 + 관리자 회원관리 구현 완료"
```
