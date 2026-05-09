# Step 0: category-models

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/laravel/CLAUDE.md`
- `/laravel/database/migrations/2026_05_07_000000_create_categories_table.php`
- `/laravel/database/migrations/2026_05_07_000001_create_category_embeddings_table.php`
- `/laravel/app/Models/User.php` (기존 모델의 PHP 8 Attribute 패턴 확인)

## 작업

`Category`와 `CategoryEmbedding` 모델을 생성하라. 이미 마이그레이션과 테이블이 존재하므로 모델만 생성하면 된다.

### pgvector 패키지 설치

```bash
composer require laravel-pgvector
```

이 패키지는 `Vector` cast 클래스를 제공하여 pgvector 컬럼을 PHP 배열과 자동으로 변환해준다.

### Category 모델 (`app/Models/Category.php`)

- `HasFactory` 트레이트 사용
- `$fillable` / `$hidden` 대신 PHP 8 Attribute (`#[Fillable(...)]`, `#[Hidden(...)]`) 사용
- `category_embeddings`와의 `hasMany` 관계 정의
- `casts()` 메서드로 적절한 타입 캐스팅
- `public static function generateCode(): string` 정적 메서드 추가 — `CAT_` + 8자리 무작위 영숫자(소문자 a-z + 숫자 0-9) 생성, unique 제약조건 충돌 시 최대 3회 재시도. Controller 등에서 재사용할 수 있도록 static으로 정의한다.

### CategoryEmbedding 모델 (`app/Models/CategoryEmbedding.php`)

- `HasFactory` 트레이트 사용
- `category()` — `belongsTo` 관계 정의
- `embedding` 컬럼은 vector(1024) 타입. `laravel-pgvector` 패키지의 `Vector` cast를 사용하라. `casts()` 메서드에 `'embedding' => Vector::class`로 정의.

### Factory

두 모델 모두 Factory를 생성하라. `CategoryFactory`는 `category_code`를 자동 생성하는 로직을 포함해야 한다.

**`category_code` 생성 규칙**:
- 형식: `CAT_` + 8자리 무작위 영숫자 문자열 (소문자 a-z + 숫자 0-9)
- 예: `CAT_a3f8c9d1`, `CAT_x7k2m9p4`
- `Category::generateCode()` 정적 메서드로 구현하여 Controller 등에서도 재사용 가능하게 한다.
- `Str::random(8)` 또는 `bin2hex(random_bytes(4))`로 생성
- DB unique 제약조건 위반 시 재시도 로직 포함 (최대 3회)
- 카테고리명과 무관하게 순수 랜덤 생성 (카테고리명 변경 시 코드 불변 보장)

### Seeder

`DatabaseSeeder`에 두 모델의 시드를 추가하라. 네이버 카테고리 체계를 반영한 대표 카테고리 5개 이상을 포함할 것.

## 생성할 파일

- `laravel/app/Models/Category.php`
- `laravel/app/Models/CategoryEmbedding.php`
- `laravel/database/factories/CategoryFactory.php`
- `laravel/database/factories/CategoryEmbeddingFactory.php`
- `laravel/database/seeders/CategorySeeder.php`
- `laravel/database/seeders/CategoryEmbeddingSeeder.php`
- `laravel/database/seeders/DatabaseSeeder.php` (수정)

## Acceptance Criteria

```bash
# 마이그레이션 프레시 후 시딩 (팩토리+시더 검증)
docker exec cl_embed_laravel php artisan migrate:fresh --seed

# 모델이 정상적으로 작동하는지 tinker에서 확인
docker exec cl_embed_laravel php artisan tinker --execute 'echo App\Models\Category::with("categoryEmbeddings")->first()?->toJson() ?? "no data";'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (모든 문서·주석은 한국어, 코드 식별자는 영어)
3. 결과에 따라 `phases/backend-models/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 마이그레이션 파일을 수정하지 마라. 이미 존재하며 정상 동작한다.
- vector 컬럼을 PHP 배열로 변환할 때 `casts()`에 `Vector::class`를 사용하라. JSON array cast를 사용하지 마라. 이유: pgvector `<=>` 연산자와의 호환성을 위해 `laravel-pgvector`의 전용 cast를 사용해야 한다.
- 기존 테스트를 깨뜨리지 마라
