# Step 1: support-models

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/laravel/CLAUDE.md`
- `/laravel/database/migrations/2026_05_07_000002_create_translation_cache_table.php`
- `/laravel/database/migrations/2026_05_07_000003_create_search_logs_table.php`
- `/laravel/app/Models/Category.php` (이전 step에서 생성됨 — 패턴 참고)
- `/laravel/app/Models/CategoryEmbedding.php` (이전 step에서 생성됨 — 패턴 참고)
- `/laravel/app/Models/User.php` (user_id FK 관계 파악)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`TranslationCache`와 `SearchLog` 모델을 생성하라. 이미 마이그레이션과 테이블이 존재하므로 모델만 생성하면 된다.

### TranslationCache 모델 (`app/Models/TranslationCache.php`)

- `HasFactory` 트레이트 사용
- `source_text` + `target_lang` 조합이 unique (복합 unique 키)
- PHP 8 Attribute 사용 (`#[Fillable(...)]`)
- **중요**: 테이블명이 `translation_cache` (복수형 아님)이므로 모델에 `protected $table = 'translation_cache';`를 명시해야 한다. 지정하지 않으면 Laravel은 기본적으로 `translation_caches`를 찾는다.

### SearchLog 모델 (`app/Models/SearchLog.php`)

- `HasFactory` 트레이트 사용
- `user()` — `belongsTo(User::class)` nullable 관계 정의
- `embedding` 컬럼은 vector(1024) 타입. `Vector` cast 정의 (`backend-models/step0`의 CategoryEmbedding과 동일한 패턴)
- `session_id`는 UUID 자동 생성 로직을 `boot()` 또는 `creating` 이벤트에 포함

### Factory

두 모델 모두 Factory를 생성하라.

### Seeder

두 모델의 Seeder를 생성하고 `DatabaseSeeder`에 등록하라.

## 생성할 파일

- `laravel/app/Models/TranslationCache.php`
- `laravel/app/Models/SearchLog.php`
- `laravel/database/factories/TranslationCacheFactory.php`
- `laravel/database/factories/SearchLogFactory.php`
- `laravel/database/seeders/TranslationCacheSeeder.php`
- `laravel/database/seeders/SearchLogSeeder.php`
- `laravel/database/seeders/DatabaseSeeder.php` (수정)

## Acceptance Criteria

```bash
# 마이그레이션 프레시 후 시딩
docker exec cl_embed_laravel php artisan migrate:fresh --seed

# 모델 작동 확인
docker exec cl_embed_laravel php artisan tinker --execute 'echo App\Models\SearchLog::with("user")->first()?->toJson() ?? "no data";'
docker exec cl_embed_laravel php artisan tinker --execute 'echo App\Models\TranslationCache::first()?->toJson() ?? "no data";'

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
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 마이그레이션 파일을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라
