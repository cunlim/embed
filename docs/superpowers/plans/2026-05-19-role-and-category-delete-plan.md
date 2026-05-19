# Role 기반 권한 및 카테고리 삭제 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 role 컬럼(member/admin/superadmin) 추가, 카테고리에 user_id 소유자 연결, 카테고리 삭제 API/UI 구현

**Architecture:** users 테이블에 `role` 문자열 컬럼, categories 테이블에 `user_id` 컬럼(비FK) 추가. CategoryController에 destroy 엔드포인트 추가, 권한 체크는 `canModify()` private 메서드로 통합. 프론트엔드는 `isAdmin`→`isSuperAdmin` 변경, 삭제 버튼 추가, 일반회원 readonly 모달

**Tech Stack:** Laravel 13 (PHP 8.5, Pest 4), Next.js 16 (React 19, Vitest, React Testing Library)

---

### Task 1: DB 마이그레이션

**Files:**
- Create: `laravel/database/migrations/YYYY_MM_DD_HHIISS_add_role_to_users_table.php`
- Create: `laravel/database/migrations/YYYY_MM_DD_HHIISS_add_user_id_to_categories_table.php`

> 마이그레이션 파일명의 timestamp는 `docker exec cl_embed_laravel php artisan make:migration`으로 생성한다. 아래 코드는 내용만 참조.

- [ ] **Step 1: users 테이블에 role 컬럼 추가 마이그레이션 생성**

```bash
docker exec cl_embed_laravel php artisan make:migration add_role_to_users_table --table=users
```

- [ ] **Step 2: 마이그레이션 코드 작성**

호스트에서 `laravel/database/migrations/` 디렉토리에서 가장 최근 생성된 `_add_role_to_users_table.php` 파일을 읽어 아래 내용으로 수정:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('member')->after('email');
        });

        // 기존 id=1 사용자를 superadmin으로 설정
        DB::table('users')->where('id', 1)->update(['role' => 'superadmin']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
```

- [ ] **Step 3: categories 테이블에 user_id 컬럼 추가 마이그레이션 생성**

```bash
docker exec cl_embed_laravel php artisan make:migration add_user_id_to_categories_table --table=categories
```

- [ ] **Step 4: 마이그레이션 코드 작성**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
        });

        // 기존 모든 카테고리를 user_id=1로 백필
        DB::table('categories')->whereNull('user_id')->update(['user_id' => 1]);
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('user_id');
        });
    }
};
```

- [ ] **Step 5: 마이그레이션 실행**

```bash
docker exec cl_embed_laravel php artisan migrate
```

Expected: 두 마이그레이션이 순차 실행되고 `Migration table not found`가 아니면 정상.

- [ ] **Step 6: 커밋**

```bash
git add laravel/database/migrations/
git commit -m "feat: users에 role, categories에 user_id 컬럼 추가"
```

---

### Task 2: User 모델 업데이트 및 테스트

**Files:**
- Modify: `laravel/app/Models/User.php`
- Create: `laravel/tests/Unit/UserTest.php`

- [ ] **Step 1: UserTest 작성 (TDD — 실패 먼저 확인)**

```bash
docker exec cl_embed_laravel php artisan make:test --pest UserTest --unit
```

호스트에서 파일을 읽고 아래 내용으로 작성:

```php
<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('User factory는 기본 role이 member다', function () {
    $user = User::factory()->create();

    expect($user->role)->toBe('member');
});

test('isSuperAdmin은 role이 superadmin일 때만 true를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create(['role' => 'admin']);
    $member = User::factory()->create(['role' => 'member']);

    expect($superadmin->isSuperAdmin())->toBeTrue();
    expect($admin->isSuperAdmin())->toBeFalse();
    expect($member->isSuperAdmin())->toBeFalse();
});

test('isAdmin은 role이 admin 또는 superadmin일 때 true를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $admin = User::factory()->create(['role' => 'admin']);
    $member = User::factory()->create(['role' => 'member']);

    expect($superadmin->isAdmin())->toBeTrue();
    expect($admin->isAdmin())->toBeTrue();
    expect($member->isAdmin())->toBeFalse();
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=UserTest
```

Expected: FAIL — `role` 필드가 Fillable에 없고 `isSuperAdmin`/`isAdmin` 메서드가 없음.

- [ ] **Step 3: User 모델 구현**

`laravel/app/Models/User.php`:

```php
<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'provider', 'provider_id', 'avatar', 'role'])]
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
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=UserTest
```

Expected: PASS (3 tests).

- [ ] **Step 5: UserFactory에 role 기본값 확인**

UserFactory에서 `role`을 명시하지 않아도 DB default `member`가 적용되므로 변경 불필요. superadmin/admin을 위한 factory state는 현재 단계에서 필요 없음.

- [ ] **Step 6: 커밋**

```bash
git add laravel/app/Models/User.php laravel/tests/Unit/UserTest.php
git commit -m "feat: User 모델에 role 필드 및 isSuperAdmin/isAdmin 메서드 추가"
```

---

### Task 3: Category 모델 업데이트 및 테스트

**Files:**
- Modify: `laravel/app/Models/Category.php`
- Modify: `laravel/tests/Unit/CategoryTest.php`

- [ ] **Step 1: CategoryTest에 user 관계 테스트 추가**

`laravel/tests/Unit/CategoryTest.php`에 아래 테스트 추가:

```php
test('user 릴레이션은 BelongsTo 인스턴스를 반환한다', function () {
    $category = Category::factory()->create(['user_id' => 1]);

    expect($category->user())->toBeInstanceOf(\Illuminate\Database\Eloquent\Relations\BelongsTo::class);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTest
```

Expected: FAIL — `user()` 메서드가 없음.

- [ ] **Step 3: Category 모델 구현**

`laravel/app/Models/Category.php`:

```php
<?php

namespace App\Models;

use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['category_code', 'category_name_ko', 'category_name_zh', 'category_name_en', 'user_id'])]
#[Hidden(['id', 'created_at', 'updated_at'])]
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;

    /**
     * @return HasMany<CategoryEmbedding>
     */
    public function embeddings(): HasMany
    {
        return $this->hasMany(CategoryEmbedding::class);
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
            'id' => 'integer',
        ];
    }

    public static function generateCode(): string
    {
        $maxAttempts = 3;

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $code = 'CAT_'.Str::lower(Str::random(8));

            if (! static::where('category_code', $code)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('범주 코드 생성 실패: '.$maxAttempts.'회 시도 후에도 고유 코드를 생성할 수 없습니다.');
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTest
```

Expected: PASS (4 tests — 기존 3개 + 신규 1개).

- [ ] **Step 5: 커밋**

```bash
git add laravel/app/Models/Category.php laravel/tests/Unit/CategoryTest.php
git commit -m "feat: Category 모델에 user_id 및 user() 관계 추가"
```

---

### Task 4: Resource 업데이트

**Files:**
- Modify: `laravel/app/Http/Resources/UserResource.php`
- Modify: `laravel/app/Http/Resources/CategoryResource.php`

- [ ] **Step 1: UserResource에 role 추가**

`laravel/app/Http/Resources/UserResource.php`:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'created_at' => $this->created_at,
        ];
    }
}
```

- [ ] **Step 2: CategoryResource에 user_id 추가**

`laravel/app/Http/Resources/CategoryResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'category_name_zh' => $this->category_name_zh,
            'category_name_en' => $this->category_name_en,
            'translation_status' => $this->translationStatus(),
        ];
    }

    private function translationStatus(): string
    {
        $hasZh = $this->category_name_zh !== null;
        $hasEn = $this->category_name_en !== null;

        $embeddings = $this->relationLoaded('embeddings')
            ? $this->embeddings->pluck('language')->toArray()
            : CategoryEmbedding::query()->where('category_id', $this->id)->pluck('language')->toArray();

        $hasKoEmb = in_array('ko', $embeddings);
        $hasZhEmb = in_array('zh', $embeddings);
        $hasEnEmb = in_array('en', $embeddings);

        $allDone = $hasZh && $hasEn && $hasKoEmb && $hasZhEmb && $hasEnEmb;
        $noneDone = ! $hasZh && ! $hasEn && ! $hasKoEmb && ! $hasZhEmb && ! $hasEnEmb;

        if ($allDone) {
            return 'completed';
        }
        if ($noneDone) {
            return 'pending';
        }

        return 'partial';
    }
}
```

- [ ] **Step 3: 커밋**

```bash
git add laravel/app/Http/Resources/UserResource.php laravel/app/Http/Resources/CategoryResource.php
git commit -m "feat: UserResource에 role, CategoryResource에 user_id 추가"
```

---

### Task 5: CategoryController — destroy + 권한 체크 (TDD)

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/routes/api.php`
- Modify: `laravel/tests/Feature/Api/CategoryControllerTest.php` (or create)

- [ ] **Step 1: CategoryControllerTest 작성 (TDD)**

기존 `laravel/tests/Feature/Api/CategoryControllerTest.php`가 빈 파일이면, 아래 내용으로 전체 작성. 내용이 있으면 아래 테스트들을 추가.

> 주의: 파일이 비어있는 것으로 확인됨(Read 결과 1 line). 전체를 아래 내용으로 작성.

```php
<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function () {
    // 마이그레이션으로 role 컬럼이 추가되어 있어야 함
});

describe('store', function () {
    test('카테고리 생성 시 로그인 사용자의 user_id가 자동 설정된다', function () {
        $user = User::factory()->create(['role' => 'member']);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/categories', [
            'category_name_ko' => '테스트 카테고리',
        ]);

        $response->assertStatus(201);
        expect($response->json('data.user_id'))->toBe($user->id);
    });
});

describe('destroy', function () {
    test('본인 소유 카테고리는 삭제할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $user->id]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('admin은 타인 카테고리를 삭제할 수 있다', function () {
        $admin = User::factory()->create(['role' => 'admin']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('superadmin은 타인 카테고리를 삭제할 수 있다', function () {
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($superadmin);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('일반회원은 타인 카테고리를 삭제할 수 없다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    });

    test('카테고리 삭제 시 관련 embedding도 함께 삭제된다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $user->id]);
        CategoryEmbedding::factory()->create([
            'category_id' => $category->id,
            'language' => 'ko',
        ]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('category_embeddings', ['category_id' => $category->id]);
    });

    test('비인증 사용자는 카테고리를 삭제할 수 없다', function () {
        $category = Category::factory()->create(['user_id' => 1]);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(401);
    });
});

describe('updateText', function () {
    test('일반회원은 타인 카테고리 텍스트를 수정할 수 없다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create([
            'user_id' => $otherUser->id,
            'category_name_ko' => '원본',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_ko',
            'value' => '수정된 텍스트',
        ]);

        $response->assertStatus(403);
    });

    test('본인 소유 카테고리는 수정할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create([
            'user_id' => $user->id,
            'category_name_ko' => '원본',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_ko',
            'value' => '수정된 텍스트',
        ]);

        $response->assertStatus(200);
    });
});
```

- [ ] **Step 2: 라우트 추가**

`laravel/routes/api.php`에 추가 (기존 categories 그룹 위치에):

```php
Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware('auth:sanctum');
```

`POST categories` 라우트 아래에 추가.

- [ ] **Step 3: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryControllerTest
```

Expected: FAIL — `destroy` 메서드가 없고, `store`에서 `user_id`를 설정하지 않음.

- [ ] **Step 4: CategoryController 구현**

`laravel/app/Http/Controllers/Api/CategoryController.php` — store 메서드 수정, destroy 추가, canModify 추가, updateText에 권한 체크 추가:

**store() 수정** (`$category = Category::create(...)` 부분):

```php
public function store(CategoryStoreRequest $request): CategoryResource
{
    $category = Category::create([
        'category_code' => $request->filled('category_code')
            ? $request->category_code
            : Category::generateCode(),
        'category_name_ko' => $request->category_name_ko,
        'user_id' => $request->user()->id,
    ]);

    return new CategoryResource($category);
}
```

**클래스 하단에 destroy()와 canModify() 추가** (마지막 `}` 앞):

```php
    #[OA\Delete(
        path: '/api/categories/{category}',
        summary: '카테고리 삭제',
        description: '카테고리와 관련 임베딩을 삭제합니다. 본인 소유이거나 admin/superadmin만 가능합니다.',
        tags: ['Categories'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer')
            ),
        ],
        responses: [
            new OA\Response(response: 204, description: '삭제 성공'),
            new OA\Response(response: 401, description: '인증 필요'),
            new OA\Response(response: 403, description: '권한 없음'),
            new OA\Response(response: 404, description: '카테고리를 찾을 수 없음'),
        ]
    )]
    public function destroy(Category $category): \Illuminate\Http\JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = request()->user();

        if (! $this->canModify($user, $category)) {
            return response()->json(['message' => '이 카테고리를 삭제할 권한이 없습니다.'], 403);
        }

        CategoryEmbedding::where('category_id', $category->id)->delete();
        $category->delete();

        return response()->json(null, 204);
    }

    private function canModify(\App\Models\User $user, Category $category): bool
    {
        return $user->isAdmin() || $category->user_id === $user->id;
    }
```

**updateText()에 권한 체크 추가** (메서드 시작 부분, `$field = ...` 직전):

```php
public function updateText(CategoryUpdateTextRequest $request, Category $category): JsonResponse
{
    /** @var \App\Models\User $user */
    $user = $request->user();

    if (! $this->canModify($user, $category)) {
        return response()->json(['message' => '이 카테고리를 수정할 권한이 없습니다.'], 403);
    }

    $field = $request->input('field');
    // ... 나머지 기존 코드
```

- [ ] **Step 5: CategoryFactory에 user_id 기본값 추가**

`laravel/database/factories/CategoryFactory.php`:

```php
public function definition(): array
{
    return [
        'category_code' => Category::generateCode(),
        'category_name_ko' => fake()->unique()->word(),
        'user_id' => 1,
    ];
}
```

- [ ] **Step 6: CategoryEmbeddingFactory 확인**

`laravel/database/factories/CategoryEmbeddingFactory.php`를 읽고 `category_id`가 올바르게 설정되는지 확인. Factory가 존재하지 않으면 생성 필요.

- [ ] **Step 7: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryControllerTest
```

Expected: PASS (all tests).

- [ ] **Step 8: pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 9: 전체 Laravel 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: 0 failures. 실패가 있으면 디버그하여 수정.

- [ ] **Step 10: 커밋**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php \
        laravel/app/Http/Resources/ \
        laravel/routes/api.php \
        laravel/tests/Feature/Api/CategoryControllerTest.php \
        laravel/database/factories/CategoryFactory.php
git commit -m "feat: 카테고리 삭제 API, 권한 체크(canModify), store user_id 자동 설정"
```

---

### Task 6: 프론트엔드 — lib/utils.ts 및 lib/api.ts

**Files:**
- Modify: `nextjs/lib/utils.ts`
- Modify: `nextjs/lib/api.ts`
- Modify: `nextjs/lib/__tests__/api.test.ts`

- [ ] **Step 1: lib/utils.ts 수정**

`nextjs/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSuperAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "superadmin";
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}
```

- [ ] **Step 2: lib/api.ts — User 타입에 role 추가**

`User` 인터페이스:

```ts
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}
```

`Category` 인터페이스에 `user_id` 추가:

```ts
export interface Category {
  id: number;
  user_id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_name?: string;
  translation_status: "completed" | "partial" | "pending";
  similarity_score?: number | null;
}
```

- [ ] **Step 3: lib/api.ts — deleteCategory 함수 추가**

`getAllCategories` 함수 아래에 추가:

```ts
export function deleteCategory(
  id: number,
  token?: string | null
): Promise<void> {
  return request<void>(`/categories/${id}`, {
    method: "DELETE",
    token,
  });
}
```

- [ ] **Step 4: api.test.ts에 deleteCategory 테스트 추가**

`nextjs/lib/__tests__/api.test.ts`에 describe 블록 추가:

```ts
describe("deleteCategory", () => {
  it("카테고리 삭제를 DELETE로 요청한다", async () => {
    mockResponse(null);

    await api.deleteCategory(1, "test-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://embed.cunlim.dev/api/categories/1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("API 오류 시 예외를 throw한다", async () => {
    mockResponse({ message: "권한 없음" }, false, 403);

    await expect(api.deleteCategory(1, "test-token")).rejects.toThrow(
      "권한 없음"
    );
  });
});
```

- [ ] **Step 5: 프론트엔드 테스트 실행 (변경된 파일만)**

```bash
docker exec cl_embed_nextjs npx vitest run lib/__tests__/api.test.ts
```

Expected: PASS (기존 테스트 + deleteCategory 2개).

- [ ] **Step 6: 커밋**

```bash
git add nextjs/lib/utils.ts nextjs/lib/api.ts nextjs/lib/__tests__/api.test.ts
git commit -m "feat: isSuperAdmin/isAdmin 유틸, Category.user_id, deleteCategory API 함수"
```

---

### Task 7: 프론트엔드 — useCategories 훅에 deleteCategory 추가

**Files:**
- Modify: `nextjs/hooks/useCategories.ts`
- Modify: `nextjs/hooks/__tests__/useCategories.test.ts`

- [ ] **Step 1: useCategories.test.ts에 deleteCategory 테스트 추가**

`nextjs/hooks/__tests__/useCategories.test.ts`:

```ts
// mock에 deleteCategory 추가
vi.mock("@/lib/api", () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const mockDeleteCategory = api.deleteCategory as ReturnType<typeof vi.fn>;

// describe("deleteCategory", ...) 블록을 기존 describe들 아래에 추가
describe("deleteCategory", () => {
  it("성공 시 API를 호출하고 목록에서 해당 카테고리를 제거한다", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);
    mockGetCategories.mockResolvedValue({
      data: [{ ...mockCategory, id: 1 }],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 2, from: 1, to: 2 },
    });

    const { result } = renderHook(() => useCategories("token"));
    // 수동으로 categories 설정 (loadCategories 없이)
    await act(async () => {
      await result.current.loadCategories();
    });
    // 이제 id=2를 삭제
    mockGetCategories.mockResolvedValue({
      data: [{ ...mockCategory, id: 1 }],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 1, from: 1, to: 1 },
    });

    await act(async () => {
      await result.current.deleteCategory(2);
    });

    expect(mockDeleteCategory).toHaveBeenCalledWith(2, "token");
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("실패 시 error가 설정된다", async () => {
    mockDeleteCategory.mockRejectedValue(new Error("권한 없음"));

    const { result } = renderHook(() => useCategories("token"));

    await act(async () => {
      await result.current.deleteCategory(1);
    });

    expect(result.current.error).toBe("권한 없음");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npx vitest run hooks/__tests__/useCategories.test.ts
```

Expected: FAIL — `deleteCategory`가 `UseCategoriesReturn`에 없음.

- [ ] **Step 3: useCategories.ts에 deleteCategory 구현**

`UseCategoriesReturn` 인터페이스에 추가:

```ts
deleteCategory: (id: number) => Promise<void>;
```

훅 내부에 `deleteCategory` 콜백 추가 (`updateCategoryStatus` 아래):

```ts
const deleteCategory = useCallback(
  async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteCategoryApi(id, token);
      const data = await getCategories(token, currentPage.current);
      setCategories(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 삭제에 실패했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  },
  [token]
);
```

return 객체에 `deleteCategory` 추가.

import에 `deleteCategory as deleteCategoryApi` 추가:

```ts
import {
  getCategories,
  createCategory,
  deleteCategory as deleteCategoryApi,
  type Category,
  type PaginationMeta,
} from "@/lib/api";
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npx vitest run hooks/__tests__/useCategories.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add nextjs/hooks/useCategories.ts nextjs/hooks/__tests__/useCategories.test.ts
git commit -m "feat: useCategories에 deleteCategory 메서드 추가"
```

---

### Task 8: 프론트엔드 — CategoryModal readonly 지원

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`

- [ ] **Step 1: CategoryModal에 readOnly prop 추가**

Props 인터페이스에 추가:

```ts
interface Props {
  // ... 기존 props
  readOnly?: boolean;
}
```

destructuring에 추가:

```ts
export default function CategoryModal({
  open, onOpenChange, data, isLoading, error, token,
  onUpdateData, onUpdateListRow,
  execState, onSingleAction, onRunAll, onCancelPending, onClearStep,
  readOnly = false,
}: Props) {
```

- [ ] **Step 2: readOnly 모드 동작 구현**

**input의 readOnly 속성** (line 97): `readOnly={runningSteps.size > 0 || pendingSteps.length > 0 || readOnly}`

**DialogTitle**: readOnly일 때 "카테고리 상세" → "카테고리 보기"

```tsx
<DialogTitle>{readOnly ? "카테고리 보기" : "카테고리 상세"}</DialogTitle>
```

**전체 실행 버튼 영역**: readOnly일 때 버튼 숨김. `{!readOnly && (` ... `)}`로 버튼 영역을 감싼다 (line 319-355).

**개별 실행 버튼**: renderRow에서 stepName이 있고 readOnly가 아니어야 실행 버튼을 표시. `!readOnly &&` 조건 추가.

**handleBlur**: readOnly일 때 저장하지 않도록 early return:

```ts
const handleBlur = async (langKey: "ko" | "en" | "zh") => {
    if (!data || readOnly) return;
    // ... 기존 코드
};
```

- [ ] **Step 3: 커밋**

```bash
git add nextjs/components/admin/category-modal.tsx
git commit -m "feat: CategoryModal에 readOnly prop 추가 (일반회원 보기 모드)"
```

---

### Task 9: 프론트엔드 — Embed 페이지 삭제 버튼 및 권한 UI

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: 아이콘 import 추가**

`Trash2`를 lucide-react import에 추가:

```ts
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Database,
  Pencil,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
```

- [ ] **Step 2: useCategories에서 deleteCategory 추출**

```ts
const {
  categories,
  meta,
  isLoading: catLoading,
  error: catError,
  loadCategories,
  addCategory,
  updateCategoryStatus,
  deleteCategory,
} = useCategories(token);
```

- [ ] **Step 3: canModify 함수 정의 (컴포넌트 내부)**

```ts
const canModify = useCallback((category: { user_id: number }) => {
  if (!user) return false;
  return isAdmin(user) || category.user_id === user.id;
}, [user]);
```

`isAdmin`을 `@/lib/utils`에서 import:

```ts
import { isAdmin } from "@/lib/utils";
```

- [ ] **Step 4: 삭제 핸들러 추가**

```ts
const handleDelete = useCallback(async (cat: Category) => {
  if (!window.confirm(`"${cat.category_name_ko}" 카테고리를 삭제하시겠습니까?`)) return;
  await deleteCategory(cat.id);
}, [deleteCategory]);
```

- [ ] **Step 5: 테이블 컬럼 헤더 변경 및 삭제 셀 추가**

**컬럼 헤더** (line 393): `"수정"` → `"작업"`
**w-[52px]** → **w-[92px]** (삭제+수정 2개 버튼 공간)

**데스크톱 테이블 셀** (line 427-437) 교체:

```tsx
<TableCell className="text-center">
  <div className="flex items-center justify-center gap-0.5">
    {canModify(cat) && (
      <Button
        variant="ghost"
        size="icon"
        title="삭제"
        onClick={() => handleDelete(cat)}
        aria-label="삭제"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      title={canModify(cat) ? "수정" : "보기"}
      onClick={() => setModalCategoryId(cat.id)}
      aria-label={canModify(cat) ? "수정" : "보기"}
    >
      {canModify(cat) ? (
        <Pencil className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  </div>
</TableCell>
```

**모바일 카드** (line 474-482)도 동일하게 교체:

```tsx
<div className="flex items-center gap-0.5">
  {canModify(cat) && (
    <Button
      variant="ghost"
      size="icon"
      title="삭제"
      onClick={() => handleDelete(cat)}
      aria-label="삭제"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )}
  <Button
    variant="ghost"
    size="icon"
    title={canModify(cat) ? "수정" : "보기"}
    onClick={() => setModalCategoryId(cat.id)}
    aria-label={canModify(cat) ? "수정" : "보기"}
  >
    {canModify(cat) ? (
      <Pencil className="h-4 w-4" />
    ) : (
      <Eye className="h-4 w-4" />
    )}
  </Button>
</div>
```

- [ ] **Step 6: CategoryModal에 readOnly prop 전달**

```tsx
<CategoryModal
  open={modalCategoryId !== null}
  onOpenChange={(open) => {
    if (!open) setModalCategoryId(null);
  }}
  data={detailData}
  isLoading={detailLoading}
  error={detailError}
  token={token}
  onUpdateData={setData}
  onUpdateListRow={(row) => updateCategoryStatus(row.id, { translation_status: row.translation_status as Category["translation_status"] })}
  execState={modalCategoryId ? getState(modalCategoryId) : null}
  onSingleAction={async (stepName) => {
    if (modalCategoryId !== null) {
      await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page), setData);
    }
  }}
  onRunAll={async () => {
    if (modalCategoryId !== null && detailData) {
      await handleRunAll(modalCategoryId, detailData, () => loadCategories(page), setData);
    }
  }}
  onCancelPending={() => {
    if (modalCategoryId !== null) {
      handleCancelPending(modalCategoryId);
    }
  }}
  onClearStep={(stepName) => {
    if (modalCategoryId !== null) {
      clearStep(modalCategoryId, stepName);
    }
  }}
  readOnly={modalCategoryId !== null ? !canModify({ user_id: detailData?.id ? categories.find(c => c.id === modalCategoryId)?.user_id ?? 0 : 0 }) : false}
/>
```

> **주의**: 위 readOnly 계산은 `modalCategoryId`로 현재 카테고리를 찾아 `canModify`를 호출. 더 깔끔하게는 `selectedCategory` state를 추가하거나 `displayCategories.find()`를 사용.

**간소화된 접근 — `selectedCategory` 변수 사용** (컴포넌트 상단에 추가):

```ts
const selectedCategory = modalCategoryId !== null
  ? displayCategories.find((c) => c.id === modalCategoryId) ?? null
  : null;
```

그리고 readOnly prop:

```tsx
readOnly={selectedCategory !== null ? !canModify(selectedCategory) : false}
```

- [ ] **Step 7: 커밋**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "feat: embed 페이지에 삭제 버튼, 권한별 수정/보기 분기, readOnly 모달 연동"
```

---

### Task 10: 프론트엔드 테스트 업데이트

**Files:**
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: page.test.tsx 업데이트**

기존 테스트 수정 사항:
- "수정" → "보기" (Eye 아이콘으로 변경됨 — 일반 사용자는 보기만 가능)
- user mock에 `role: "member"` 추가
- canModify 조건 변경으로 인해 aria-label 변경 반영

주요 수정:

```tsx
// user mock
mockUseAuth.mockReturnValue({
  user: { id: 2, name: "User", email: "user@test.com", role: "member" },
  isLoading: false,
});

// categories mock에 user_id 추가
mockUseCategories.mockReturnValue({
  categories: [
    {
      id: 1,
      user_id: 1, // 다른 사용자 소유 → member는 보기만 가능
      category_code: "A01",
      category_name_ko: "의류",
      category_name_zh: "服装",
      category_name_en: "Clothing",
      translation_status: "completed",
    },
    {
      id: 2,
      user_id: 2, // 본인 소유 → 수정 가능
      category_code: "A02",
      category_name_ko: "식품",
      category_name_zh: null,
      category_name_en: null,
      translation_status: "pending",
    },
  ],
  isLoading: false,
  isLoaded: true,
  error: null,
  loadCategories: vi.fn(),
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
});

// 테스트: 일반회원은 자신의 카테고리에 "수정" 버튼이 보인다
it("일반회원은 자신의 카테고리에 수정 버튼이 표시된다", () => {
  render(<EmbedPage />);
  const editButtons = screen.getAllByRole("button", { name: "수정" });
  expect(editButtons.length).toBe(1); // id=2 (user_id=2, 본인 소유)
});

// 테스트: 일반회원은 타인 카테고리에 "보기" 버튼이 표시된다
it("일반회원은 타인 카테고리에 보기 버튼이 표시된다", () => {
  render(<EmbedPage />);
  const viewButtons = screen.getAllByRole("button", { name: "보기" });
  expect(viewButtons.length).toBe(1); // id=1 (user_id=1, 타인 소유)
});

// 테스트: 일반회원은 타인 카테고리에 삭제 버튼이 표시되지 않는다
it("일반회원은 타인 카테고리에 삭제 버튼이 표시되지 않는다", () => {
  render(<EmbedPage />);
  const deleteButtons = screen.queryAllByRole("button", { name: "삭제" });
  expect(deleteButtons.length).toBe(1); // 자신의 카테고리(id=2)에만 삭제버튼
});

// 테스트: 컬럼 헤더가 "작업"으로 변경됨
it("테이블 컬럼 헤더에 작업이 표시된다", () => {
  render(<EmbedPage />);
  expect(screen.getByText("작업")).toBeInTheDocument();
});
```

- [ ] **Step 2: category-modal.test.tsx에 readOnly 테스트 추가**

`readOnly` prop과 관련된 테스트 추가 필요. readOnly 시:
- "카테고리 보기" 타이틀 표시
- "전체 실행" 버튼 미표시

```tsx
// readOnly prop 테스트
it("readOnly 모드에서는 보기 타이틀이 표시된다", () => {
  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={mockData}
      isLoading={false}
      error={null}
      readOnly={true}
      execState={createDefaultState()}
      onSingleAction={vi.fn()}
      onRunAll={vi.fn()}
      onCancelPending={vi.fn()}
    />
  );
  expect(screen.getByText("카테고리 보기")).toBeInTheDocument();
});

it("readOnly 모드에서는 전체 실행 버튼이 표시되지 않는다", () => {
  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={mockData}
      isLoading={false}
      error={null}
      readOnly={true}
      execState={createDefaultState()}
      onSingleAction={vi.fn()}
      onRunAll={vi.fn()}
      onCancelPending={vi.fn()}
    />
  );
  expect(screen.queryByText("전체 실행")).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 테스트 실행**

```bash
docker exec cl_embed_nextjs npx vitest run
```

Expected: 모든 테스트 PASS. 실패 시 디버그하여 수정.

- [ ] **Step 4: 커밋**

```bash
git add nextjs/app/embed/__tests__/page.test.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "test: embed 페이지 권한별 버튼/모달, CategoryModal readOnly 테스트 갱신"
```

---

### Task 11: 전체 검증

- [ ] **Step 1: run-all-checks.sh 실행**

```bash
bash .claude/hooks/run-all-checks.sh
```

- [ ] **Step 2: 실패 항목 디버그 및 수정**

결과 파일 확인:
```bash
cat .claude/hooks/test-results/*.txt
```

실패가 있으면 해당 항목을 디버그하여 수정.

- [ ] **Step 3: TypeScript 검증 (nextjs)**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: 최종 커밋 (수정사항이 있다면)**

```bash
git add -A
git diff --cached --stat  # 변경 파일 확인
git commit -m "chore: 전체 검증 통과 후 수정사항 반영"
```
