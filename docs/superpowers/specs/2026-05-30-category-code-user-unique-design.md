# 카테고리 코드 + 사용자 ID 복합 유니크 인덱스 설계

## 개요

현재 `categories` 테이블의 `category_code` 컬럼에 전역 고유 인덱스가 존재하여, 전체 시스템에서 동일한 카테고리 코드를 사용할 수 없습니다. 이를 `(category_code, user_id)` 복합 고유 인덱스로 변경하여, **같은 코드를 다른 사용자가各自 사용할 수 있도록** 합니다.

## 현재 상태

- `category_code` 컬럼에 전역 UNIQUE 인덱스 존재
- `user_id` 컬럼은 이후 추가됨 (마이그레이션: `2026_05_19_102354`)
- `(category_code, user_id)` 복합 인덱스 없음
- `Category::generateCode()`가 전역 유일성 검증 수행
- `CategoryStoreRequest`가 전역 unique 검증 수행

## 변경 사항

### 1. DB 레벨

**파일:** `laravel/database/migrations/2026_05_07_000000_create_categories_table.php`

```php
// 변경 전
$table->string('category_code', 50)->unique();

// 변경 후
$table->string('category_code', 50);
$table->unique(['category_code', 'user_id']);
```

### 2. Category 모델

**파일:** `laravel/app/Models/Category.php`

`generateCode()` 메서드에 `$userId` 파라미터 추가, 유일성 검증을 사용자 스코프로 변경:

```php
// 변경 전
public static function generateCode(): string
{
    for ($i = 0; $i < 10; $i++) {
        $code = 'CAT_' . Str::lower(Str::random(8));
        if (! static::where('category_code', $code)->exists()) {
            return $code;
        }
    }
    throw new \RuntimeException('고유한 카테고리 코드 생성에 실패했습니다.');
}

// 변경 후
public static function generateCode(int $userId): string
{
    for ($i = 0; $i < 10; $i++) {
        $code = 'CAT_' . Str::lower(Str::random(8));
        if (! static::where('category_code', $code)->where('user_id', $userId)->exists()) {
            return $code;
        }
    }
    throw new \RuntimeException('고유한 카테고리 코드 생성에 실패했습니다.');
}
```

### 3. CategoryStoreRequest

**파일:** `laravel/app/Http/Requests/CategoryStoreRequest.php`

```php
// 변경 전
'category_code' => ['nullable', 'string', 'max:255', 'unique:categories,category_code'],

// 변경 후
'category_code' => [
    'nullable',
    'string',
    'max:255',
    Rule::unique('categories', 'category_code')->where('user_id', $this->user()?->id ?? 1),
],
```

### 4. CategoryUpdateTextRequest

**파일:** `laravel/app/Http/Requests/CategoryUpdateTextRequest.php`

`field`가 `category_code`일 때 동적으로 unique 규칙 추가:

```php
public function rules(): array
{
    $rules = [
        'field' => ['required', 'string', 'in:category_name_ko,category_name_en,category_name_zh,category_code'],
        'value' => ['nullable', 'string', 'max:255'],
    ];

    if ($this->input('field') === 'category_code') {
        $rules['value'][] = Rule::unique('categories', 'category_code')
            ->where('user_id', $this->user()?->id ?? 1)
            ->ignore($this->route('category')?->id);
    }

    return $rules;
}
```

### 5. CategoryController

**파일:** `laravel/app/Http/Controllers/Api/CategoryController.php`

`store()` 메서드에서 `generateCode()` 호출 시 `auth()->id()` 전달:

```php
// 변경 전
'category_code' => $request->filled('category_code')
    ? $request->category_code
    : Category::generateCode(),

// 변경 후
'category_code' => $request->filled('category_code')
    ? $request->category_code
    : Category::generateCode(auth()->id() ?? 1),
```

### 6. 테스트

**파일:** `laravel/tests/Feature/CategoryApiTest.php`

- 같은 사용자가 중복 category_code 생성 시 422 반환 검증
- 다른 사용자가 같은 category_code 생성 시 성공 검증

## 영향 분석

### 변경되는 파일
1. `laravel/database/migrations/2026_05_07_000000_create_categories_table.php` - 마이그레이션
2. `laravel/app/Models/Category.php` - 모델
3. `laravel/app/Http/Requests/CategoryStoreRequest.php` - 요청 검증
4. `laravel/app/Http/Requests/CategoryUpdateTextRequest.php` - 요청 검증
5. `laravel/app/Http/Controllers/Api/CategoryController.php` - 컨트롤러
6. `laravel/tests/Feature/CategoryApiTest.php` - 테스트

### 변경되지 않는 파일
- 프론트엔드 코드 (API 계약 변경 없음)
- Resources (출력만 담당)
- Services (category_code로 조회하지 않음)
- Recommendations (category_id로 조인)

## 검증 방법

1. `php artisan migrate:fresh --seed` 실행
2. 같은 사용자가 중복 category_code 생성 시 422 확인
3. 다른 사용자가 같은 category_code 생성 시 성공 확인
4. `category_code` 업데이트 시 유일성 검증 확인
5. 전체 테스트 실행 (`php artisan test`)
