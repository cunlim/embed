<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.5
- laravel/framework (LARAVEL) - v13
- laravel/prompts (PROMPTS) - v0
- laravel/reverb (REVERB) - v1
- laravel/boost (BOOST) - v2
- laravel/mcp (MCP) - v0
- laravel/pail (PAIL) - v1
- laravel/pint (PINT) - v1
- pestphp/pest (PEST) - v4
- phpunit/phpunit (PHPUNIT) - v12
- tailwindcss (TAILWINDCSS) - v4

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.
- To check environment variables, read the `.env` file directly.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

## Pest

- This project uses Pest for testing. Create tests: `php artisan make:test --pest {name}`.
- The `{name}` argument should not include the test suite directory. Use `php artisan make:test --pest SomeFeatureTest` instead of `php artisan make:test --pest Feature/SomeFeatureTest`.
- Run tests: `php artisan test --compact` or filter: `php artisan test --compact --filter=testName`.
- Do NOT delete tests without approval.

</laravel-boost-guidelines>

## 프로젝트 관련 (cl_embed)

### Laravel 데몬 실행

`cl_embed_laravel` 컨테이너 내부에서 실행해야 하는 데몬들입니다.
호스트에서 실행 시 반드시 `docker exec`를 사용하세요.

```bash
# 컨테이너 접속 후 직접 실행
php artisan serve --host=0.0.0.0 --port=8000
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan queue:work

# 호스트에서 docker exec 로 일괄 실행
docker exec -d cl_embed_laravel bash -c "
  nohup php artisan serve --host=0.0.0.0 --port=8000 > logs/serve.log 2>&1 &
  nohup php artisan reverb:start --host=0.0.0.0 --port=8080 > logs/reverb.log 2>&1 &
  nohup php artisan queue:work > logs/queue.log 2>&1 &
"
```

### 자주 사용하는 명령어

모든 명령어는 `cl_embed_laravel` 컨테이너 대상으로 `docker exec`를 통해 실행합니다.

```bash
# 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 파일 생성
docker exec cl_embed_laravel php artisan make:model ModelName --migration --factory --seed --test
docker exec cl_embed_laravel php artisan make:test --pest TestName
docker exec cl_embed_laravel php artisan make:controller Api/ControllerName

# 라우트 확인
docker exec cl_embed_laravel php artisan route:list

# 설정 확인
docker exec cl_embed_laravel php artisan config:show app.name
```

### 주요 패키지

- `laravel/reverb` — WebSocket 브로드캐스팅
- `laravel/boost` — Laravel MCP 서버 (도구: `database-query`, `database-schema`, `search-docs`)
- `pestphp/pest` — 테스트 프레임워크 (Pest 4)
- `laravel/pint` — 코드 포맷터 (Pint 1)
- `laravel/pail` — 로그 뷰어

### Laravel 코드 컨벤션

- **PHP 8 속성(Attribute) 사용**: `$fillable`/`$hidden` 프로퍼티 대신 `#[Fillable([...])]`와 `#[Hidden([...])]` 사용
- **생성자 프로퍼티 프로모션**: `public function __construct(public Type $var) {}`
- **타입 힌트**: 모든 메서드에 명시적 반환 타입과 파라미터 타입 선언
- **제어 구조**: 단일 라인이라도 항상 중괄호 사용
- **URL 생성**: `route()` 헬퍼 함수와 명명된 라우트 사용
- **API 리소스**: 버저닝과 함께 Eloquent API Resources 사용
- **Pest 테스트**: `php artisan make:test --pest`로 생성, 기존 테스트 컨벤션 따름
- **PHP 변경 완료 전** 반드시 `vendor/bin/pint --format agent` 실행 (컨테이너 내부 기준)

### 모델 생성 체크리스트

**CRITICAL** — 아래 규칙은 **모든 모델에 예외 없이 적용**한다. API에 노출되지 않는 내부/시스템 모델(예: `Setting`)도 동일한 규칙을 따른다. "내부용이니까 괜찮겠지"라는 판단은 금지한다.

새 Eloquent 모델 생성 시 다음 항목을 반드시 확인한다:

- **`HasFactory` trait**: 모든 모델은 `use HasFactory`를 포함하고 대응하는 Factory를 생성한다. Seeder에서 직접 `::create()`를 호출하는 경우에도 Factory는 반드시 존재해야 한다.
- **`#[Hidden]`**: `id`, `created_at`, `updated_at`, `embedding`(Vector) 등 API 응답에 불필요한 컬럼은 Attribute로 숨긴다. 기존 모델(`Category`, `CategoryEmbedding`)을 참고할 것.
- **`#[Fillable]`**: mass-assignment 허용 컬럼을 정확히 지정한다. `$guarded = []`는 사용하지 않는다.
- **`casts()`**: `embedding` → `Vector::class`, `id` → `integer` 등 모든 특수 타입 캐스팅을 정의한다.
- **관계 메서드**: `@return BelongsTo<User, $this>` 형식의 제네릭 PHPDoc을 작성한다.

### Factory 생성 체크리스트

- **pgvector Vector 컬럼**: Box-Muller 변환으로 Gaussian 분포에서 샘플링 후 정규화하여 구면 위 균등 분포 벡터를 생성한다. 단순 `randomFloat()` 균등분포는 사용하지 않는다. (`CategoryEmbeddingSeeder::randomUnitVector()` 구현을 그대로 재사용할 것)
  - 이유: 균등분포로 생성한 벡터는 구면 위에 균등하게 분포하지 않아 코사인 유사도 검색의 신뢰도가 떨어진다. 정규화된 단위 벡터가 pgvector 코사인 유사도 검색에 필요하다.

### 모델 테스트 최소 요건

**CRITICAL** — 모델 생성 시 다음을 검증하는 Pest 테스트를 함께 작성한다:

- Factory로 모델 생성 가능 여부 (`::factory()->create()`)
- 관계 메서드 반환 타입 (BelongsTo, HasMany 등)
- 특수 캐스팅 동작 (Vector 등)

TDD를 준수하여 테스트를 먼저 작성한 후 모델 코드를 구현한다.

### 테스트 환경 제약 (SQLite + pgvector)

**CRITICAL** — 이 프로젝트의 `phpunit.xml`은 `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`로 설정되어 있다. SQLite는 PostgreSQL 전용 확장(`CREATE EXTENSION IF NOT EXISTS vector`)을 지원하지 않으므로, 마이그레이션을 실행하는 `RefreshDatabase` trait을 사용할 수 없다.

- **`RefreshDatabase` 사용 금지** — pgvector 마이그레이션이 포함되어 있어 SQLite에서 구문 오류 발생
- **대체 패턴**: `beforeEach`에서 필요한 테이블만 `Schema::create()`로 생성하고 `afterEach`에서 `Schema::dropIfExists()`로 정리한다
- **DB 불필요한 테스트** (예: `TextSplitter` 같은 순수 유닛)는 테이블 생성 자체가 불필요하다
- **더 자세한 내용과 예제 코드**: `docs/solutions/test-failures/sqlite-pgvector-refresh-database-incompatibility-2026-05-10.md` 참조

### 서비스 클래스 테스트 최소 요건

**CRITICAL** — 서비스 클래스 생성 시 의존성을 mock 하여 위임 동작을 검증하는 테스트를 반드시 함께 작성한다.

- **의존성 mock**: `$this->mock(Dependency::class)`로 의존성을 대체하고, 올바른 파라미터로 호출되는지 `shouldReceive()->with(...)`로 검증한다.
- **실제 외부 호출 금지 ≠ 테스트 생략**: "실제 Ollama 호출 테스트를 작성하지 마라" 같은 지시는 HTTP 호출을 하지 말라는 의미이지, mock 기반 단위 테스트조차 생략하라는 의미가 아니다. `Http::fake()`나 `$this->mock()`으로 외부 의존성을 대체하면 실제 호출 없이도 위임 동작을 검증할 수 있다.
- **얇은 래퍼도 예외 없음**: `EmbeddingGenerator`처럼 한 줄짜리 위임 클래스라도 config 값 읽기 → 의존성 호출까지의 위임이 올바른지 검증한다. 래퍼가 얇을수록 테스트 작성 비용도 낮다.
- 기존 Feature 테스트(`OllamaTranslatorTest`, `EmbeddingGeneratorTest`)의 mock 패턴을 참고할 것.

### 서비스 클래스 캐싱 패턴

- **그룹 조회 최적화**: 여러 키를 그룹 단위로 조회하는 메서드(`all()` 등)에서는 개별 키마다 `Cache::remember()`를 호출하지 말고, 그룹 전체를 하나의 캐시 키로 묶어 저장한다. DB 쿼리 1회 + 캐시 호출 1회로 유지한다.
  - 잘못된 예: `foreach` 루프 안에서 `Cache::remember("settings:{$group}:{$key}", ...)` 개별 호출 → N+1 캐시 문제
  - 올바른 예: `Cache::remember("settings:{$group}", 3600, fn () => Setting::where('group', $group)->get()->mapWithKeys(...)->all())`
- **캐시 키 설계**: `get()`은 개별 키 캐시, `all()`은 그룹 캐시로 분리하여 단일 조회 시 불필요한 그룹 전체 로드를 방지한다.

### 서비스 클래스 의존성 주입

- **Eloquent 모델을 쿼리 빌더 용도로 생성자 주입하지 않는다.** `private TranslationCache $cache`처럼 모델 인스턴스를 주입받아 `$this->cache->where(...)`로 사용하는 방식은 정적 분석에서 경고를 발생시키고, 모델이 쿼리 빌더 프록시로 사용되는 의도를 불분명하게 만든다.
  - 잘못된 예: `public function __construct(private TranslationCache $cache) {}` → `$this->cache->where(...)->first()`
  - 올바른 예: `public function __construct(private OllamaClient $ollama) {}` → `TranslationCache::query()->where(...)->first()`
- **Unique 제약조건이 있는 테이블에 `create()` 사용 시 동시 실행을 고려한다.** 동시 요청이 동일 키로 `create()`를 호출하면 `UniqueConstraintViolationException`이 발생할 수 있다. 적절한 처리 방식:
  - (A) `firstOrCreate()` 사용
  - (B) `create()`를 try-catch로 감싸고 예외 발생 시 재조회
  - 판단 기준: `firstOrCreate()`는 추가 DB 쿼리가 발생하지만 코드가 단순하다. try-catch는 오버헤드가 적고 예외 상황에만 발동한다.
