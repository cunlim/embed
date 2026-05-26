# 시스템 설정 DB화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시스템에 하드코딩된 15개 디폴트값을 Settings DB 테이블로 이관하고 superadmin 전용 관리자 UI에서 수정 가능하게 한다.

**Architecture:** 기존 ollama 그룹의 3계층 패턴(config → Seeder → AppServiceProvider)을 6개 신규 그룹으로 확장. AdminSettingsController로 GET/PUT API 제공, Next.js admin 페이지에 시스템 설정 탭 추가. superadmin 가드(`isSuperAdmin`)를 관리자 페이지와 헤더 버튼에 최초 적용.

**Tech Stack:** Laravel (PHP 8, Pest), Next.js 16 (React 19, TypeScript 5, Tailwind v4, shadcn/ui)

---

### Task 1: config/services.php에 신규 설정 그룹 기본값 추가

**Files:**
- Modify: `laravel/config/services.php`

- [ ] **Step 1: services.php 하단에 6개 그룹 기본값 추가**

`laravel/config/services.php` 최하단 `];` 바로 앞에 추가:

```php
    'pagination' => [
        'default_per_page' => 20,
        'max_per_page_guest' => 100,
    ],

    'recommend' => [
        'default_limit' => 5,
        'max_per_page' => 100,
    ],

    'auth' => [
        'token_expiry_days' => 30,
        'session_lifetime' => 120,
    ],

    'category' => [
        'code_prefix' => 'CAT_',
        'code_random_length' => 8,
        'code_max_attempts' => 3,
    ],

    'validation' => [
        'text_max_length' => 500,
        'name_max_length' => 255,
    ],

    'cache' => [
        'settings_ttl' => 3600,
    ],

    'frontend' => [
        'step_delay_ms' => 2000,
    ],

];
```

- [ ] **Step 2: 기존 ollama 그룹에 timeout, translation_max_attempts 추가**

`'ollama'` 배열 내 `'rate_limit_decay_seconds' => 60,` 다음 줄에 추가:

```php
        'timeout' => 300,
        'translation_max_attempts' => 3,
```

- [ ] **Step 3: AppServiceProvider에서 timeout이 config 참조하는지 확인**

`AppServiceProvider.php:29`에서 `timeout: 300`을 `timeout: (int) config('services.ollama.timeout', 300)`으로 변경해야 함. 이 변경은 Task 5에서 수행.

- [ ] **Step 4: Commit**

```bash
git add laravel/config/services.php
git commit -m "feat: config/services.php에 신규 설정 그룹 6개 추가"
```

---

### Task 2: SettingsSeeder에 신규 설정 항목 추가

**Files:**
- Modify: `laravel/database/seeders/SettingsSeeder.php`

- [ ] **Step 1: SettingsSeeder에 15개 항목 추가**

`SettingsSeeder::run()` 메서드 하단, 기존 5개 `firstOrCreate` 호출 뒤에 추가:

```php
        // ollama 추가
        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'timeout'],
            [
                'value' => '300',
                'type' => 'integer',
                'description' => 'Ollama API HTTP 요청 타임아웃(초)',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'ollama', 'key' => 'translation_max_attempts'],
            [
                'value' => '3',
                'type' => 'integer',
                'description' => '번역 환각 시 최대 재시도 횟수',
            ]
        );

        // pagination
        Setting::firstOrCreate(
            ['group' => 'pagination', 'key' => 'default_per_page'],
            [
                'value' => '20',
                'type' => 'integer',
                'description' => '기본 페이지당 항목 수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'pagination', 'key' => 'max_per_page_guest'],
            [
                'value' => '100',
                'type' => 'integer',
                'description' => '비로그인 사용자 최대 페이지당 항목 수',
            ]
        );

        // recommend
        Setting::firstOrCreate(
            ['group' => 'recommend', 'key' => 'default_limit'],
            [
                'value' => '5',
                'type' => 'integer',
                'description' => '추천 API 기본 결과 수',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'recommend', 'key' => 'max_per_page'],
            [
                'value' => '100',
                'type' => 'integer',
                'description' => '추천 API 최대 페이지당 항목 수',
            ]
        );

        // auth
        Setting::firstOrCreate(
            ['group' => 'auth', 'key' => 'token_expiry_days'],
            [
                'value' => '30',
                'type' => 'integer',
                'description' => 'Sanctum 토큰 쿠키 만료일',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'auth', 'key' => 'session_lifetime'],
            [
                'value' => '120',
                'type' => 'integer',
                'description' => '세션 수명(분)',
            ]
        );

        // category
        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_prefix'],
            [
                'value' => 'CAT_',
                'type' => 'string',
                'description' => '카테고리 코드 prefix',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_random_length'],
            [
                'value' => '8',
                'type' => 'integer',
                'description' => '카테고리 코드 랜덤 문자열 길이',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'category', 'key' => 'code_max_attempts'],
            [
                'value' => '3',
                'type' => 'integer',
                'description' => '카테고리 코드 생성 최대 시도 횟수',
            ]
        );

        // validation
        Setting::firstOrCreate(
            ['group' => 'validation', 'key' => 'text_max_length'],
            [
                'value' => '500',
                'type' => 'integer',
                'description' => '추천 텍스트/키워드 최대 길이 (UI·문서 표시용)',
            ]
        );

        Setting::firstOrCreate(
            ['group' => 'validation', 'key' => 'name_max_length'],
            [
                'value' => '255',
                'type' => 'integer',
                'description' => '카테고리명·사용자명 최대 길이 (UI·문서 표시용)',
            ]
        );

        // cache
        Setting::firstOrCreate(
            ['group' => 'cache', 'key' => 'settings_ttl'],
            [
                'value' => '3600',
                'type' => 'integer',
                'description' => 'Settings 캐시 수명(초)',
            ]
        );

        // frontend
        Setting::firstOrCreate(
            ['group' => 'frontend', 'key' => 'step_delay_ms'],
            [
                'value' => '2000',
                'type' => 'integer',
                'description' => '번역·임베딩 단계 실행 간 지연(ms)',
            ]
        );
```

- [ ] **Step 2: Commit**

```bash
git add laravel/database/seeders/SettingsSeeder.php
git commit -m "feat: SettingsSeeder에 신규 15개 설정 항목 추가"
```

---

### Task 3: AppServiceProvider DB→config 동기화 확장

**Files:**
- Modify: `laravel/app/Providers/AppServiceProvider.php`

- [ ] **Step 1: boot() 메서드에 신규 그룹 동기화 추가**

기존 `boot()`의 `$settings = app(SettingsService::class);` 아래 `config([...]);` 블록을 다음과 같이 확장:

```php
        $settings = app(SettingsService::class);
        config([
            // ollama (기존 + 신규)
            'services.ollama.host' => $settings->get('ollama', 'host', config('services.ollama.host')),
            'services.ollama.translation_model' => $settings->get('ollama', 'translation_model', config('services.ollama.translation_model')),
            'services.ollama.embedding_model' => $settings->get('ollama', 'embedding_model', config('services.ollama.embedding_model')),
            'services.ollama.rate_limit_max_attempts' => $settings->get('ollama', 'rate_limit_max_attempts', config('services.ollama.rate_limit_max_attempts', 60)),
            'services.ollama.rate_limit_decay_seconds' => $settings->get('ollama', 'rate_limit_decay_seconds', config('services.ollama.rate_limit_decay_seconds', 60)),
            'services.ollama.timeout' => $settings->get('ollama', 'timeout', config('services.ollama.timeout', 300)),
            'services.ollama.translation_max_attempts' => $settings->get('ollama', 'translation_max_attempts', config('services.ollama.translation_max_attempts', 3)),
            // pagination
            'services.pagination.default_per_page' => $settings->get('pagination', 'default_per_page', config('services.pagination.default_per_page', 20)),
            'services.pagination.max_per_page_guest' => $settings->get('pagination', 'max_per_page_guest', config('services.pagination.max_per_page_guest', 100)),
            // recommend
            'services.recommend.default_limit' => $settings->get('recommend', 'default_limit', config('services.recommend.default_limit', 5)),
            'services.recommend.max_per_page' => $settings->get('recommend', 'max_per_page', config('services.recommend.max_per_page', 100)),
            // auth
            'services.auth.token_expiry_days' => $settings->get('auth', 'token_expiry_days', config('services.auth.token_expiry_days', 30)),
            'services.auth.session_lifetime' => $settings->get('auth', 'session_lifetime', config('services.auth.session_lifetime', 120)),
            // category
            'services.category.code_prefix' => $settings->get('category', 'code_prefix', config('services.category.code_prefix', 'CAT_')),
            'services.category.code_random_length' => $settings->get('category', 'code_random_length', config('services.category.code_random_length', 8)),
            'services.category.code_max_attempts' => $settings->get('category', 'code_max_attempts', config('services.category.code_max_attempts', 3)),
            // validation
            'services.validation.text_max_length' => $settings->get('validation', 'text_max_length', config('services.validation.text_max_length', 500)),
            'services.validation.name_max_length' => $settings->get('validation', 'name_max_length', config('services.validation.name_max_length', 255)),
            // cache
            'services.cache.settings_ttl' => $settings->get('cache', 'settings_ttl', config('services.cache.settings_ttl', 3600)),
            // frontend
            'services.frontend.step_delay_ms' => $settings->get('frontend', 'step_delay_ms', config('services.frontend.step_delay_ms', 2000)),
        ]);
```

- [ ] **Step 2: register()에서 OllamaClient timeout을 config 참조로 변경**

`register()` 메서드의 `OllamaClient` 싱글톤 등록 부분에서:

```php
    $this->app->singleton(OllamaClient::class, function ($app) {
        return new OllamaClient(
            rateLimiter: $app->make(OllamaRateLimiter::class),
            baseUrl: config('services.ollama.host'),
            timeout: (int) config('services.ollama.timeout', 300),
        );
    });
```

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Providers/AppServiceProvider.php
git commit -m "feat: AppServiceProvider에 신규 6개 그룹 DB→config 동기화 추가"
```

---

### Task 4: SettingsService에 update() 메서드 추가 및 캐시 TTL config화

**Files:**
- Modify: `laravel/app/Services/SettingsService.php`

- [ ] **Step 1: update() 메서드 추가, get()/all()의 TTL을 config에서 읽도록 변경**

전체 파일을 다음과 같이 수정:

```php
<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    /**
     * 캐시 TTL(초). config('services.cache.settings_ttl') 우선, 기본 3600.
     */
    private function ttl(): int
    {
        return (int) config('services.cache.settings_ttl', 3600);
    }

    /**
     * 그룹과 키로 설정 값을 조회한다.
     * 캐시 우선 조회, 없으면 DB 조회 후 캐시 저장.
     */
    public function get(string $group, string $key, mixed $default = null): mixed
    {
        $cacheKey = "settings:{$group}:{$key}";

        return Cache::remember($cacheKey, $this->ttl(), function () use ($group, $key, $default) {
            $setting = Setting::where('group', $group)->where('key', $key)->first();

            if ($setting === null) {
                return $default;
            }

            return $this->castValue($setting->value, $setting->type);
        });
    }

    /**
     * 그룹의 모든 설정을 연관 배열로 반환한다.
     */
    public function all(string $group): array
    {
        return Cache::remember("settings:{$group}", $this->ttl(), function () use ($group) {
            return Setting::where('group', $group)
                ->get()
                ->mapWithKeys(fn (Setting $s) => [$s->key => $this->castValue($s->value, $s->type)])
                ->all();
        });
    }

    /**
     * 설정 값을 업데이트한다. DB upsert 후 관련 캐시를 무효화한다.
     */
    public function update(string $group, string $key, mixed $value): Setting
    {
        $type = $this->inferType($value);
        $strValue = (string) $value;

        $setting = Setting::updateOrCreate(
            ['group' => $group, 'key' => $key],
            ['value' => $strValue, 'type' => $type]
        );

        Cache::forget("settings:{$group}:{$key}");
        Cache::forget("settings:{$group}");

        return $setting;
    }

    /**
     * 값의 PHP 타입으로 type 문자열을 추론한다.
     */
    private function inferType(mixed $value): string
    {
        return is_int($value) ? 'integer' : 'string';
    }

    /**
     * type에 따라 value를 캐스팅한다.
     */
    private function castValue(string $value, string $type): mixed
    {
        if ($type === 'integer') {
            return (int) $value;
        }

        return $value;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add laravel/app/Services/SettingsService.php
git commit -m "feat: SettingsService에 update() 추가, 캐시 TTL config화"
```

---

### Task 5: OllamaClient/OllamaTranslator/Category에서 config 사용

**Files:**
- Modify: `laravel/app/Services/OllamaClient.php`
- Modify: `laravel/app/Services/OllamaTranslator.php`
- Modify: `laravel/app/Models/Category.php`

- [ ] **Step 1: OllamaClient — 이미 AppServiceProvider에서 timeout 주입받으므로 추가 변경 없음**

AppServiceProvider Task 3에서 이미 `timeout: (int) config('services.ollama.timeout', 300)`으로 변경했으므로 OllamaClient 자체는 수정할 필요 없음.

- [ ] **Step 2: OllamaTranslator — MAX_ATTEMPTS를 config에서 읽기**

`OllamaTranslator.php`의 `translateSingle()` 메서드에서 `self::MAX_ATTEMPTS`를 config 값으로 대체. `private const MAX_ATTEMPTS` 선언 제거.

`translateSingle()` 메서드의 do-while 조건부:

```php
        $maxAttempts = (int) config('services.ollama.translation_max_attempts', 3);
        $attempts = 0;

        do {
            $result = $this->ollama->chat($model, $this->buildPrompt($text, $targetLang));
            $result = trim($result);

            if ($this->isValidTranslation($result, $targetLang)) {
                $cached = TranslationCache::firstOrCreate(
                    ['source_text' => $text, 'target_lang' => $targetLang],
                    ['translated_text' => $result],
                );

                return $cached->translated_text;
            }

            $attempts++;
        } while ($attempts < $maxAttempts);

        throw new RuntimeException(
            "{$targetLang} 번역 환각 {$attempts}회 발생: 원문=\"{$text}\" 결과=\"{$result}\""
        );
```

파일 상단에서 `private const MAX_ATTEMPTS = 3;` 제거.

- [ ] **Step 3: Category::generateCode() — config에서 prefix, length, maxAttempts 읽기**

`Category.php`의 `generateCode()` 메서드 수정:

```php
    public static function generateCode(): string
    {
        $prefix = config('services.category.code_prefix', 'CAT_');
        $length = (int) config('services.category.code_random_length', 8);
        $maxAttempts = (int) config('services.category.code_max_attempts', 3);

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $code = $prefix.Str::lower(Str::random($length));

            if (! static::where('category_code', $code)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('범주 코드 생성 실패: '.$maxAttempts.'회 시도 후에도 고유 코드를 생성할 수 없습니다.');
    }
```

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Services/OllamaTranslator.php laravel/app/Models/Category.php
git commit -m "refactor: 하드코딩된 상수를 config 참조로 전환"
```

---

### Task 6: 컨트롤러에서 per_page, limit 기본값 config화

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php`
- Modify: `laravel/app/Services/RecommendationService.php`

- [ ] **Step 1: CategoryController::index() per_page 기본값**

`CategoryController.php:68`:

```php
        $perPage = min(
            (int) $request->input('per_page', config('services.pagination.default_per_page', 20)),
            $maxPerPage
        );
```

`CategoryController.php:67`의 `$maxPerPage`:

```php
        $maxPerPage = $user ? PHP_INT_MAX : (int) config('services.pagination.max_per_page_guest', 100);
```

- [ ] **Step 2: RecommendController::recommend() per_page 기본값**

`RecommendController.php:66`:

```php
        $perPage = (int) $request->input('per_page', config('services.pagination.default_per_page', 20));
```

- [ ] **Step 3: RecommendationService::recommend() limit 기본값**

`RecommendationService.php:18` (이미 기본값 5이므로 호출부에서 전달하지 않으면 그대로 적용됨). `recommendPaginated()`의 `$perPage` 기본값:

`RecommendationService.php:58`:

```php
    public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1, int|array|null $userId = null, ?string $keyword = null): LengthAwarePaginator
```

기본값 `= 20`을 제거하고 호출부에서 항상 명시적 전달하도록 변경하거나, 기본값을 config에서 읽도록 내부에서 처리. 호출부가 항상 값을 전달하므로 기본값 제거만으로 충분.

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/app/Http/Controllers/Api/RecommendController.php laravel/app/Services/RecommendationService.php
git commit -m "refactor: 페이지네이션 기본값 config 참조로 전환"
```

---

### Task 7: AdminSettingsController 생성 및 라우트 추가

**Files:**
- Create: `laravel/app/Http/Controllers/Api/AdminSettingsController.php`
- Modify: `laravel/routes/api.php`

- [ ] **Step 1: AdminSettingsController 생성**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
    public function __construct(
        private SettingsService $settings,
    ) {
        $this->middleware(function ($request, $next) {
            $user = $request->user('sanctum');
            if (! $user || ! $user->isSuperAdmin()) {
                return response()->json(['message' => '권한이 없습니다.'], 403);
            }
            return $next($request);
        });
    }

    private const GROUPS = [
        'ollama',
        'pagination',
        'recommend',
        'auth',
        'category',
        'validation',
        'cache',
        'frontend',
    ];

    /**
     * 모든 그룹의 설정을 반환한다.
     */
    public function index(): JsonResponse
    {
        $data = [];
        foreach (self::GROUPS as $group) {
            $data[$group] = $this->settings->all($group);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * 단일 설정 값을 업데이트한다.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'group' => ['required', 'string', 'max:50'],
            'key' => ['required', 'string', 'max:100'],
            'value' => ['required'],
        ]);

        $setting = $this->settings->update(
            $validated['group'],
            $validated['key'],
            $validated['value']
        );

        return response()->json([
            'data' => [
                'group' => $setting->group,
                'key' => $setting->key,
                'value' => $this->settings->get($setting->group, $setting->key),
            ],
        ]);
    }
}
```

- [ ] **Step 2: routes/api.php에 라우트 추가**

`routes/api.php` 하단, `Route::post('recommend', ...)` 다음에 추가:

```php
// 관리자 설정 (superadmin only)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('admin/settings', [AdminSettingsController::class, 'index']);
    Route::put('admin/settings', [AdminSettingsController::class, 'update']);
});
```

`use` 문 상단에 추가:

```php
use App\Http\Controllers\Api\AdminSettingsController;
```

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Http/Controllers/Api/AdminSettingsController.php laravel/routes/api.php
git commit -m "feat: AdminSettingsController 추가 — superadmin 설정 CRUD API"
```

---

### Task 8: Backend 테스트 작성

**Files:**
- Create: `laravel/tests/Feature/Api/AdminSettingsControllerTest.php`
- Modify: `laravel/tests/Unit/Services/SettingsServiceTest.php` (존재하면 수정, 없으면 생성)

- [ ] **Step 1: AdminSettingsControllerTest 작성**

```php
<?php

use App\Models\Setting;
use App\Models\User;
use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

beforeEach(function () {
    Setting::firstOrCreate(
        ['group' => 'pagination', 'key' => 'default_per_page'],
        ['value' => '20', 'type' => 'integer', 'description' => 'test']
    );
});

test('superadmin은 설정 목록을 조회할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    actingAs($superadmin, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertOk()
        ->assertJsonPath('data.pagination.default_per_page', 20);
});

test('admin은 설정 목록을 조회할 수 없다', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    actingAs($admin, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertStatus(403);
});

test('member는 설정 목록을 조회할 수 없다', function () {
    $member = User::factory()->create(['role' => 'member']);
    actingAs($member, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertStatus(403);
});

test('비로그인은 설정 목록을 조회할 수 없다', function () {
    $response = getJson('/api/admin/settings');

    $response->assertStatus(401);
});

test('superadmin은 설정 값을 업데이트할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    actingAs($superadmin, 'sanctum');

    $response = putJson('/api/admin/settings', [
        'group' => 'pagination',
        'key' => 'default_per_page',
        'value' => '30',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.value', 30);

    $setting = Setting::where('group', 'pagination')
        ->where('key', 'default_per_page')
        ->first();
    expect($setting->value)->toBe('30');
});

test('admin은 설정 값을 업데이트할 수 없다', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    actingAs($admin, 'sanctum');

    $response = putJson('/api/admin/settings', [
        'group' => 'pagination',
        'key' => 'default_per_page',
        'value' => '30',
    ]);

    $response->assertStatus(403);
});
```

- [ ] **Step 2: 테스트 실행 및 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=AdminSettingsControllerTest
```

예상: 6개 테스트 모두 PASS

- [ ] **Step 3: Commit**

```bash
git add laravel/tests/Feature/Api/AdminSettingsControllerTest.php
git commit -m "test: AdminSettingsController 권한 및 CRUD 테스트 추가"
```

---

### Task 9: Next.js lib/api.ts에 설정 API 함수 추가

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: types 및 API 함수 추가**

`api.ts` 파일 하단에 추가:

```typescript
// --- 관리자 설정 ---

export interface SettingsByGroup {
  [group: string]: Record<string, number | string>;
}

export interface SettingsResponse {
  data: SettingsByGroup;
}

export function fetchSettings(token?: string | null): Promise<SettingsResponse> {
  return request<SettingsResponse>("/admin/settings", {
    method: "GET",
    token,
  });
}

export interface UpdateSettingResponse {
  data: {
    group: string;
    key: string;
    value: number | string;
  };
}

export function updateSetting(
  group: string,
  key: string,
  value: string | number,
  token?: string | null,
): Promise<UpdateSettingResponse> {
  return request<UpdateSettingResponse>("/admin/settings", {
    method: "PUT",
    body: { group, key, value },
    token,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: 관리자 설정 API 함수 추가 (fetchSettings, updateSetting)"
```

---

### Task 10: Next.js settings-panel 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/settings-panel.tsx`

- [ ] **Step 1: settings-panel.tsx 작성**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchSettings, updateSetting, type SettingsByGroup } from "@/lib/api";

interface Props {
  token: string | null;
}

const GROUP_LABELS: Record<string, string> = {
  ollama: "Ollama",
  pagination: "페이지네이션",
  recommend: "추천",
  auth: "인증",
  category: "카테고리",
  validation: "검증",
  cache: "캐시",
  frontend: "프론트엔드",
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  ollama: {
    host: "API 서버 주소",
    translation_model: "번역 모델명",
    embedding_model: "임베딩 모델명",
    rate_limit_max_attempts: "Rate Limit 최대 시도",
    rate_limit_decay_seconds: "Rate Limit 시간 창(초)",
    timeout: "HTTP 타임아웃(초)",
    translation_max_attempts: "번역 재시도 횟수",
  },
  pagination: {
    default_per_page: "기본 페이지 크기",
    max_per_page_guest: "비로그인 최대 페이지 크기",
  },
  recommend: {
    default_limit: "기본 추천 결과 수",
    max_per_page: "최대 페이지 크기",
  },
  auth: {
    token_expiry_days: "토큰 만료일",
    session_lifetime: "세션 수명(분)",
  },
  category: {
    code_prefix: "코드 Prefix",
    code_random_length: "코드 랜덤 길이",
    code_max_attempts: "코드 생성 최대 시도",
  },
  validation: {
    text_max_length: "텍스트 최대 길이",
    name_max_length: "이름 최대 길이",
  },
  cache: {
    settings_ttl: "설정 캐시 TTL(초)",
  },
  frontend: {
    step_delay_ms: "단계 실행 간 지연(ms)",
  },
};

export function SettingsPanel({ token }: Props) {
  const [settings, setSettings] = useState<SettingsByGroup>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings(token).then((res) => {
      setSettings(res.data);
      const init: Record<string, string> = {};
      for (const [group, items] of Object.entries(res.data)) {
        for (const [key, val] of Object.entries(items)) {
          init[`${group}.${key}`] = String(val);
        }
      }
      setEditing(init);
    }).catch(() => {
      setMsg({ type: "error", text: "설정을 불러오지 못했습니다." });
    });
  }, [token]);

  const handleSave = useCallback(async (group: string, key: string) => {
    const fieldKey = `${group}.${key}`;
    setSaving((prev) => ({ ...prev, [fieldKey]: true }));
    setMsg(null);
    try {
      const res = await updateSetting(group, key, editing[fieldKey], token);
      setSettings((prev) => ({
        ...prev,
        [group]: { ...prev[group], [key]: res.data.value },
      }));
      setMsg({ type: "success", text: "저장되었습니다." });
    } catch {
      setMsg({ type: "error", text: `${group}.${key} 저장 실패` });
    } finally {
      setSaving((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }, [editing, token]);

  if (Object.keys(settings).length === 0) {
    return <p className="text-muted-foreground text-sm">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className={msg.type === "success" ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
          {msg.text}
        </p>
      )}
      {Object.entries(GROUP_LABELS).map(([group, label]) => {
        const items = settings[group];
        if (!items) return null;
        return (
          <Card key={group} className="p-4">
            <h3 className="font-semibold text-sm mb-3">{label}</h3>
            <div className="space-y-3">
              {Object.keys(items).map((key) => {
                const fieldKey = `${group}.${key}`;
                const isInteger = typeof items[key] === "number";
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Label className="w-48 shrink-0 text-xs text-muted-foreground">
                      {FIELD_LABELS[group]?.[key] ?? key}
                    </Label>
                    <Input
                      type={isInteger ? "number" : "text"}
                      value={editing[fieldKey] ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving[fieldKey]}
                      onClick={() => handleSave(group, key)}
                    >
                      {saving[fieldKey] ? "저장 중" : "저장"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/settings-panel.tsx
git commit -m "feat: 시스템 설정 패널 컴포넌트 추가"
```

---

### Task 11: Next.js admin 페이지에 탭 + superadmin 가드 적용

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: admin page를 superadmin 가드 + 탭 구조로 변경**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/utils";
import { SettingsPanel } from "@/components/admin/settings-panel";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (!isSuperAdmin(user)) {
      router.back();
    }
  }, [mounted, authLoading, user, router]);

  if (!mounted || !user || !isSuperAdmin(user)) return null;

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="info">안내</TabsTrigger>
            <TabsTrigger value="settings">시스템 설정</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="flex flex-1 items-center justify-center">
              <Card className="flex flex-col items-center gap-4 py-16 px-8 max-w-md text-center">
                <Inbox className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">기능이 이전되었습니다</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    카테고리 추천 기능이 임베드 페이지로 통합되었습니다.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/embed">
                    임베드 페이지로 이동
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel token={token} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: admin 페이지 superadmin 가드 + 시스템 설정 탭 추가"
```

---

### Task 12: Next.js auth-buttons superadmin 가드 적용

**Files:**
- Modify: `nextjs/components/auth-buttons.tsx`

- [ ] **Step 1: isAdmin → isSuperAdmin 변경**

`auth-buttons.tsx`에서:

```tsx
import { isSuperAdmin } from "@/lib/utils";
```

```tsx
  const admin = isSuperAdmin(user);
```

- [ ] **Step 2: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/auth-buttons.tsx
git commit -m "feat: 관리자 버튼 superadmin 전용으로 변경"
```

---

### Task 13: Seeder 실행 및 수동 검증

- [ ] **Step 1: SettingsSeeder 실행**

```bash
docker exec cl_embed_laravel php artisan db:seed --class=SettingsSeeder
```

- [ ] **Step 2: DB 확인**

```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo App\Models\Setting::count();'
```

예상: 20

- [ ] **Step 3: Playwright로 관리자 페이지 접근 테스트**

`https://embed.cunlim.dev/admin` 에서:
- superadmin 로그인 → 페이지 접근 가능, "시스템 설정" 탭 표시, 설정 값 수정 가능
- admin 로그인 → 헤더에 "관리자" 버튼 미표시, `/admin` 직접 접근 시 이전 페이지로 리다이렉트
- 비로그인 → `/admin` 접근 시 `/login?redirect=/admin`으로 리다이렉트

- [ ] **Step 4: Commit (변경 있으면)**

---

### Task 14: 최종 검증

- [ ] **Step 1: 전체 검증 스크립트 실행**

```bash
bash .claude/hooks/run-all-checks.sh && cat .claude/hooks/test-results/*.txt
```

모든 검증(tsc, lint, test, pint) EXIT=0 확인.

- [ ] **Step 2: 변경 사항 최종 확인**

```bash
git status && git log --oneline -15
```
