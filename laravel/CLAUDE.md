## 프로젝트 관련 (cl_embed)

Laravel Boost MCP 도구 사용 가능: `database-query`(읽기 전용 SQL), `database-schema`(테이블 구조), `search-docs`(버전별 문서 검색). 코드 변경 전 `search-docs`를 항상 먼저 실행합니다.

### 자주 사용하는 명령어

모든 명령어는 `cl_embed_laravel` 컨테이너 대상으로 `docker exec`를 통해 실행합니다.

```bash
# 테스트
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# Swagger 문서 생성
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

기타 Artisan 명령어는 `php artisan list` 및 `php artisan [command] --help`로 확인합니다.

### Laravel 코드 컨벤션

- **PHP 8 속성(Attribute) 사용**: `$fillable`/`$hidden` 프로퍼티 대신 `#[Fillable([...])]`와 `#[Hidden([...])]` 사용
- **생성자 프로퍼티 프로모션**: `public function __construct(public Type $var) {}`
- **타입 힌트**: 모든 메서드에 명시적 반환 타입과 파라미터 타입 선언
- **제어 구조**: 단일 라인이라도 항상 중괄호 사용
- **URL 생성**: `route()` 헬퍼 함수와 명명된 라우트 사용
- **API 리소스**: 버저닝과 함께 Eloquent API Resources 사용.
  - 단독 응답: `(new SomeResource($model))->response()` → `{data: {...}}` 래퍼 자동 적용, 반환 타입 `JsonResponse`와 호환
  - 복합 응답: `(new SomeResource($model))->resolve()`로 배열 추출 후 다른 키와 함께 `response()->json()`에 임베딩 (예: `'user' => (new UserResource($user))->resolve()`)
  - 컬렉션: `SomeResource::collection($items)->response()` → `{data: [...]}`
  - **Resource collection에 전달되는 각 항목은 객체여야 한다** — `JsonResource::toArray()`에서 `$this->property`로 접근하므로, Service가 반환하는 각 item은 `(object) [...]` 또는 Eloquent Model이어야 한다. 연관 배열을 전달하면 `Attempt to read property on array` 에러가 발생한다.
- **Pest 테스트**: `php artisan make:test --pest`로 생성, 기존 테스트 컨벤션 따름
- **PHP 변경 완료 전** 반드시 `vendor/bin/pint --format agent` 실행 (컨테이너 내부 기준)

### L5-Swagger OA 어노테이션 컨벤션

- **`OA\JsonContent`는 `type: 'object'`를 명시** — `properties`가 있는 모든 `JsonContent`는 `type: 'object'`를 명시해야 Swagger UI가 올바르게 렌더링한다.
- **description은 "무엇"을 기술** — API 소비자용 인터페이스 명세이므로 구현 디테일(Job dispatch, pipeline 등)을 배제하고 기능 동작만 기술한다.
- **enum 값은 FormRequest와 일치** — OA `enum`과 FormRequest validation rule(`in:`)이 불일치하면 문서가 거짓 정보를 제공한다.
- **숫자 필드는 `example` 추가** — Swagger UI Try-It-Out에서 응답 해석을 돕기 위해 `similarity_score` 등 `number` 타입에 예시값을 제공한다.
- **`#[OA\Info]`가 OpenAPI info 객체를 제어** — `l5-swagger.php` config의 `documentations.api.api` 섹션(description, termsOfService, contact 등)은 l5-swagger 생성기가 사용하지 않는다. 실제 `info` 객체는 `#[OA\Info]` 어노테이션(현재 `TestController.php`에 위치)이 제어하므로, description·termsOfService·contact 변경은 config가 아닌 어노테이션에 해야 한다.
- **OA 변경 후 `l5-swagger:generate`로 검증** — 어노테이션 구문 오류는 generate 시점에 발견된다.

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

### Bus::fake / Event::fake 사용 시 주의사항

- **`Bus::fake()` + `assertBatched()` 콜백 타입**: `Bus::fake()` 사용 시 `assertBatched(callback)`의 콜백 파라미터는 `Illuminate\Bus\Batch`가 아닌 `Illuminate\Support\Testing\Fakes\PendingBatchFake` 이다. `$batch->name`, `count($batch->jobs)` 등으로 검증한다. `$batch->totalJobs` 속성은 존재하지 않는다.
- **`Bus::fake()`는 batch 콜백을 실행하지 않는다**: `progress`, `then`, `catch` 콜백은 `Bus::fake()` 환경에서 호출되지 않는다. 이벤트 dispatch 검증이 필요하면 `Event::fake([...])`만 사용하고 실제 batch를 실행하거나, 별도 통합 테스트를 작성한다.
- **`Event::fake()`는 Eloquent 라이프사이클 이벤트까지 캡처한다**: `Event::fake()` (인자 없는 호출) 시 `eloquent.booting`, `eloquent.booted` 등 Model 생성 시 발생하는 프레임워크 내부 이벤트까지 캡처된다. `Event::assertNothingDispatched()`를 쓰려면 `Event::fake([SpecificEvent::class])`로 감시 대상을 한정해야 한다.
- **`Bus::batch` `catch` 콜백은 `allowFailures()`와 함께 사용 시 주의**: `allowFailures()` 설정 시 개별 job 실패는 batch 실패로 간주되지 않아 `catch` 콜백이 호출되지 않는다. `catch`는 job을 큐에 넣지 못하는 infrastructure-level 오류에서만 실행된다. 개별 job 실패 정보는 `then` 콜백에서 `$batch->failedJobs`로 확인한다.

### Cache::lock 사용 시 주의사항

- **모든 early return 경로에서 `$lock->release()` 확인**: `Cache::lock()` 획득 후 `return`하는 모든 분기에서 lock을 해제했는지 확인한다. `then`/`catch` 콜백만 믿고 early return에서 누락하지 않도록 주의.
- **TTL은 crash 복구용 안전장치로만 의존**: lock TTL에만 의존해 해제를 기대하지 말고, 정상 종료 경로에서는 명시적 `release()`를 호출한다.

### 테스트 환경 (PostgreSQL + pgvector)

테스트 DB는 실제 PostgreSQL(`cl_embed_test` 데이터베이스, `pgvector_03` 컨테이너)을 사용한다. 모든 Feature/Unit 테스트는 `RefreshDatabase` trait으로 마이그레이션된 DB를 트랜잭션으로 감싸 실행한다.

- **`RefreshDatabase` 사용** — 모든 Feature 테스트는 `Pest.php`에 의해 자동으로 `RefreshDatabase`가 적용된다. Unit 테스트 중 DB 접근이 필요한 경우 `uses(RefreshDatabase::class)`를 명시적으로 추가한다.
- **PostgreSQL 트랜잭션 abort 주의** — PostgreSQL에서는 쿼리 오류(제약조건 위반 등)가 발생하면 트랜잭션이 aborted 상태가 되어 후속 쿼리가 모두 실패한다. `create()` + catch 패턴 대신 `firstOrCreate()`를 사용해야 한다.
- **pgvector raw SQL 바인딩은 `::vector` 명시적 캐스트 필수** — `DB::select()`에서 `<=>` 연산자에 bound parameter를 사용할 때 PDO는 text로 바인딩한다. `:query_vector::vector`와 같이 명시적 타입 캐스트를 추가해야 한다.
- **pgvector 쿼리를 호출하는 컨트롤러는 Service mock으로 격리** — 컨트롤러가 직접 `CategoryEmbedding::similarTo()` 등 pgvector 스코프를 호출하면 테스트 복잡도가 증가한다. `RecommendationService`처럼 Service로 추출하고, Feature 테스트에서는 `Mockery::mock(Service::class)` + `app()->instance()`로 교체하여 HTTP 레이어(요청/응답/JSON 구조)만 검증한다.

### 서비스 클래스 테스트 최소 요건

**CRITICAL** — 서비스 클래스 생성 시 의존성을 mock 하여 위임 동작을 검증하는 테스트를 반드시 함께 작성한다.

- **의존성 mock**: `$this->mock(Dependency::class)`로 의존성을 대체하고, 올바른 파라미터로 호출되는지 `shouldReceive()->with(...)`로 검증한다.
- **실제 외부 호출 금지 ≠ 테스트 생략**: "실제 Ollama 호출 테스트를 작성하지 마라" 같은 지시는 HTTP 호출을 하지 말라는 의미이지, mock 기반 단위 테스트조차 생략하라는 의미가 아니다. `Http::fake()`나 `$this->mock()`으로 외부 의존성을 대체하면 실제 호출 없이도 위임 동작을 검증할 수 있다.
- **얇은 래퍼도 예외 없음**: `EmbeddingGenerator`처럼 한 줄짜리 위임 클래스라도 config 값 읽기 → 의존성 호출까지의 위임이 올바른지 검증한다. 래퍼가 얇을수록 테스트 작성 비용도 낮다.
- **실패 경로(failure path)도 필수 검증**: 행복 경로(happy path)뿐 아니라, 의존성이 실패/거부/초과 상황을 반환할 때 서비스가 적절한 예외를 발생시키는지도 테스트해야 한다. 예: rate limit 초과 시 `RuntimeException` 발생, HTTP 오류 시 예외 전파.
- **테스트 헬퍼가 한계를 우회하면 별도 검증**: `makeClient()` 같은 테스트 헬퍼로 제한을 느슨하게 설정해 일반 테스트를 통과시키는 경우, 별도 테스트에서 실제 제한이 동작하는지 검증해야 한다. 예: `OllamaRateLimiter(1000, 1)`로 대부분 테스트를 통과시키면서, `OllamaRateLimiter(1, 60)`으로 rate limit 초과 시나리오를 별도 검증.
- **Unit 테스트에서 `$this->mock()` 필요 시 `uses(TestCase::class)` 선언**: `tests/Unit/` 디렉토리의 테스트는 기본적으로 Laravel `TestCase`를 상속하지 않으므로 `$this->mock()`이나 `$this->app`에 접근할 수 없다. 컨테이너 접근이 필요하면 파일 상단에 `use Tests\TestCase;` + `uses(TestCase::class);`를 추가할 것. (`tests/Unit/CategoryEmbeddingTest.php`의 패턴 참고)
- 기존 Feature 테스트(`OllamaTranslatorTest`, `EmbeddingGeneratorTest`)의 mock 패턴을 참고할 것.

### ShouldBroadcast 이벤트 테스트 최소 요건

**CRITICAL** — ShouldBroadcast를 구현하는 모든 이벤트는 다음을 검증하는 Pest 테스트를 함께 작성한다:

- `broadcastOn()` 반환 채널 (Channel name 검증)
- `broadcastAs()` 이벤트명
- 모든 public 프로퍼티 값 (생성자 주입값이 올바르게 설정되는지)
- 기본값이 있는 프로퍼티는 기본값 검증도 포함

기존 `tests/Feature/Events/BatchCompletedTest.php`, `TranslationProgressTest.php` 패턴을 참고한다.

### OllamaTranslator 세그먼트 캐싱 검증

- **캐시 재사용은 mock의 호출 횟수로 검증**: `OllamaClient::chat()`을 mock 하고 `->times(N)`으로 Ollama API 호출 횟수를 정량 단언한다. `"A>B>C>D1"` 번역 후 `"A>B>C>D2"` 번역 시 공통 prefix 세그먼트(A,B,C)는 캐시 히트되어 `->once()`만 호출된다.
- **`andReturnValues([])`로 순차 응답**: 여러 세그먼트의 번역 결과를 순서대로 반환할 때 사용.

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

### 운영 설정 패턴 (Config + Settings Table)

**CRITICAL** — 운영 중 변경 가능성이 있는 설정값은 하드코딩하지 말고 아래 패턴을 따른다.

설정값(API 엔드포인트, 모델명, rate limit 임계값, timeout 등)은 3계층으로 관리한다:

1. **`config/services.php`** — 기본값 정의 (코드에 내장된 폴백)
2. **`settings` DB 테이블** — 런타임 오버라이드 (`SettingsSeeder`로 초기값 시딩)
3. **`AppServiceProvider::boot()`** — DB 값을 config에 동기화

```php
// config/services.php — 기본값
'ollama' => [
    'host' => 'http://host.docker.internal:11434',
    'rate_limit_max_attempts' => 60,
],

// SettingsSeeder — DB 초기값
Setting::firstOrCreate(
    ['group' => 'ollama', 'key' => 'rate_limit_max_attempts'],
    ['value' => '60', 'type' => 'integer', 'description' => '...'],
);

// AppServiceProvider::boot() — DB → config 동기화
config([
    'services.ollama.rate_limit_max_attempts' =>
        $settings->get('ollama', 'rate_limit_max_attempts', config('services.ollama.rate_limit_max_attempts', 60)),
]);
```

- **새 설정 추가 시 3곳 모두 업데이트**: `config/services.php`, `SettingsSeeder`, `AppServiceProvider::boot()`
- **생성자에서 config로 주입**: 서비스 클래스는 config 값을 생성자 파라미터로 받고, `AppServiceProvider::register()`에서 주입한다.
- **이유**: 설정 테이블을 통해 런타임에 값을 변경할 수 있고, DB에 값이 없어도 config 기본값으로 정상 동작한다. 기존 `ollama.host`, `ollama.translation_model`, `ollama.embedding_model`이 이 패턴을 따른다.

### OAuth (Socialite) 패턴

- **Sanctum 마이그레이션 publish 필수** — Sanctum 4.x 설치 후 `php artisan vendor:publish --tag=sanctum-migrations`를 실행해야 `personal_access_tokens` 테이블이 생성된다. 마이그레이션 publish 전에는 모든 `createToken()` 호출이 실패한다.
- **크로스-제공자 이메일 연결** — 동일 이메일로 다른 제공자(Google→GitHub) 로그인 시 `updateOrCreate`가 email unique 제약조건 위반을 일으킨다. provider+provider_id로 먼저 찾고, 없으면 email로 찾아 provider 정보를 갱신하는 3단계 로직을 사용할 것 (`OAuthController::callback()` 참고).
- **Naver driver는 `socialiteproviders/naver` 패키지 설치 필요** — `composer require socialiteproviders/naver` 설치 후, `EventServiceProvider`에 `SocialiteWasCalled` 이벤트 리스너로 `NaverExtendSocialite::class`를 등록해야 한다. EventServiceProvider는 `bootstrap/providers.php`에 수동 추가.
- **OAuth 라우트는 `routes/web.php`에 정의** — Socialite는 세션 기반 state 검증이 필요하므로 `api.php`가 아닌 `web.php`를 사용한다.
- **callback은 `RedirectResponse` 반환** — 브라우저가 callback URL에 직접 도착하므로 JSON 응답은 사용자에게 노출된다. Sanctum 토큰 발급 후 `redirect("/login?token={$token}")`으로 프론트엔드에 전달한다.
- **웹/앱 리다이렉트 분기**: `redirect()`에서 `?client=web|app` 쿼리 파라미터를 세션에 저장하고, `callback()`에서 `session()->pull('oauth_client')`로 읽어 리다이렉트 URL을 결정한다 (`config('services.frontend.login_url')` vs `config('services.frontend.app_callback_url')`).
- **provider_token은 DB 저장 금지** — OAuth access token은 로그인 시점에만 필요하고 이후 인증은 Sanctum token으로 수행하므로 불필요하다. 추후 provider API 호출이 필요해지면 encrypted cast로 추가한다.
- **마이그레이션 필수 사항**: `email` nullable (provider가 이메일 미제공 가능), `password` nullable (OAuth 전용 유저), `provider` + `provider_id` 복합 unique 인덱스.
- **Auth 응답은 UserResource로 통일** — `AuthController`와 `OAuthController` 모두 user 데이터 표현에 동일한 Resource를 사용한다.
- **OAuth 콜백에도 rate limiting** — `->middleware('throttle:5,1')` — 토큰 생성 + DB 쓰기가 수반되므로 다른 auth 라우트와 동일 수준의 보호가 필요하다.
- **OAuth 디버깅 — tinker로 config 확인**: `config:clear` 후 `php artisan tinker --execute 'echo config("services.google.client_id");'` 로 컨테이너가 실제 읽는 값 검증. 비어 있으면 `.env` 바인드 마운트 불일치 의심.
- **OAuth 디버깅 — 리다이렉트 URL 검증**: `curl -sI "https://embed.cunlim.dev/api/auth/{provider}/redirect"` 로 302 Location 헤더의 `client_id`와 `redirect_uri` 파라미터 검증.
