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

### TDD 적용 범위

다음 항목은 예외 없이 테스트를 작성한다. 상세 요건은 아래 해당 섹션 참조.

| 대상 | 테스트 유형 | 상세 섹션 |
|------|------------|-----------|
| Controller | Feature (HTTP 응답, mock, DB 단언) | — |
| Form Request | Feature (유효성 검증, 실패 시나리오) | — |
| Eloquent Resource | Feature (응답 형식 검증) | — |
| Model | Unit (Factory, 관계, 캐스팅) | [모델 테스트 최소 요건](#모델-테스트-최소-요건) |
| Service | Unit/Feature (의존성 mock + 위임 검증) | [서비스 클래스 테스트 최소 요건](#서비스-클래스-테스트-최소-요건) |
| Command/Scheduled Task | Feature (실행 결과 검증) | — |

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
  - **`RecommendResource`도 `CategoryResource`와 동일하게 `translationStatus()` 유지** — `toArray()`에서 `$this->translation_status`가 아닌 `$this->translationStatus()` 호출. CategoryResource의 private 메서드를 복사하여 일관성 유지.
- **Pest 테스트**: `php artisan make:test --pest`로 생성, 기존 테스트 컨벤션 따름
- **PHP 변경 완료 전** 반드시 `vendor/bin/pint --format agent` 실행 (컨테이너 내부 기준)

### L5-Swagger OA 어노테이션 컨벤션

- **`OA\JsonContent`는 `type: 'object'`를 명시** — `properties`가 있는 모든 `JsonContent`는 `type: 'object'`를 명시해야 Swagger UI가 올바르게 렌더링한다.
- **description은 "무엇"을 기술** — API 소비자용 인터페이스 명세이므로 구현 디테일(Job dispatch, pipeline 등)을 배제하고 기능 동작만 기술한다.
- **enum 값은 FormRequest와 일치** — OA `enum`과 FormRequest validation rule(`in:`)이 불일치하면 문서가 거짓 정보를 제공한다.
- **숫자 필드는 `example` 추가** — Swagger UI Try-It-Out에서 응답 해석을 돕기 위해 `similarity_score` 등 `number` 타입에 예시값을 제공한다.
- **`#[OA\Info]`가 OpenAPI info 객체를 제어** — `l5-swagger.php` config의 `documentations.api.api` 섹션(description, termsOfService, contact 등)은 l5-swagger 생성기가 사용하지 않는다. 실제 `info` 객체는 `#[OA\Info]` 어노테이션(현재 `TestController.php`에 위치)이 제어하므로, description·termsOfService·contact 변경은 config가 아닌 어노테이션에 해야 한다.
- **OA 변경 후 `l5-swagger:generate`로 검증** — 어노테이션 구문 오류는 generate 시점에 발견된다.

### 모델 / Factory

- 새 모델 생성 시 기존 모델(`Category`, `CategoryEmbedding`)의 `#[Hidden]`, `#[Fillable]`, `casts()`, 관계 PHPDoc 패턴을 따를 것.
- **pgvector Vector 컬럼**: Box-Muller + 정규화로 구면 균등 분포 벡터 생성. `CategoryEmbeddingSeeder::randomUnitVector()` 재사용. `randomFloat()` 균등분포 금지.

### Event::fake 사용 시 주의사항

- **`Event::fake()`는 Eloquent 라이프사이클 이벤트까지 캡처한다**: `Event::fake()` (인자 없는 호출) 시 `eloquent.booting`, `eloquent.booted` 등 Model 생성 시 발생하는 프레임워크 내부 이벤트까지 캡처된다. `Event::assertNothingDispatched()`를 쓰려면 `Event::fake([SpecificEvent::class])`로 감시 대상을 한정해야 한다.

### Cache::lock 사용 시 주의사항

- **모든 early return 경로에서 `$lock->release()` 확인**: `Cache::lock()` 획득 후 `return`하는 모든 분기에서 lock을 해제했는지 확인한다. `then`/`catch` 콜백만 믿고 early return에서 누락하지 않도록 주의.
- **TTL은 crash 복구용 안전장치로만 의존**: lock TTL에만 의존해 해제를 기대하지 말고, 정상 종료 경로에서는 명시적 `release()`를 호출한다.

### 테스트 환경 (PostgreSQL + pgvector)

테스트 DB는 실제 PostgreSQL(`cl_embed_test` 데이터베이스, `pgvector_03` 컨테이너)을 사용한다. 모든 Feature/Unit 테스트는 `RefreshDatabase` trait으로 마이그레이션된 DB를 트랜잭션으로 감싸 실행한다.

- **`RefreshDatabase` 사용** — 모든 Feature 테스트는 `Pest.php`에 의해 자동으로 `RefreshDatabase`가 적용된다. Unit 테스트 중 DB 접근이 필요한 경우 `uses(RefreshDatabase::class)`를 명시적으로 추가한다.
- **PostgreSQL 트랜잭션 abort 주의** — PostgreSQL에서는 쿼리 오류(제약조건 위반 등)가 발생하면 트랜잭션이 aborted 상태가 되어 후속 쿼리가 모두 실패한다. `create()` + catch 패턴 대신 `firstOrCreate()`를 사용해야 한다.
- **pgvector raw SQL 바인딩은 `::vector` 명시적 캐스트 필수** — `DB::select()`에서 `<=>` 연산자에 bound parameter를 사용할 때 PDO는 text로 바인딩한다. `:query_vector::vector`와 같이 명시적 타입 캐스트를 추가해야 한다.
- **pgvector 테스트에서 `array_fill` 금지** — 모든 요소가 같은 벡터는 동일 방향(collinear)이므로 cosine distance가 전부 0이 되어 rank/similarity 검증이 무효화된다. 서로 다른 방향의 벡터를 사용할 것.
- **pgvector 쿼리를 호출하는 컨트롤러는 Service mock으로 격리** — 컨트롤러가 직접 `CategoryEmbedding::similarTo()` 등 pgvector 스코프를 호출하면 테스트 복잡도가 증가한다. `RecommendationService`처럼 Service로 추출하고, Feature 테스트에서는 `Mockery::mock(Service::class)` + `app()->instance()`로 교체하여 HTTP 레이어(요청/응답/JSON 구조)만 검증한다.
- **`.env.testing` 파일** — gitignore 대상, CI "Restore Environment Files" 스텝에서 `$LIVE_ROOT/laravel/.env.testing` → 워크스페이스로 복사. `DB_DATABASE=cl_embed_test`, `DB_USERNAME=dbeaver_lim_test`, `APP_KEY` 포함. `.env.testing.example`을 템플릿으로 커밋.
- **별도 테스트 DB 사용자 + `RefreshDatabase` schema ownership** — `dbeaver_lim_test`가 기존 테이블의 소유자가 아니면 `migrate:fresh`의 DROP TABLE이 `must be owner` 오류로 실패한다. `dbeaver_lim`으로 `DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS vector;` 실행 후 테스트를 구동하면 `dbeaver_lim_test`가 모든 테이블을 소유하게 된다.

### 서비스 클래스 테스트 최소 요건

**CRITICAL** — 서비스 클래스 생성 시 의존성을 mock 하여 위임 동작을 검증하는 테스트를 반드시 함께 작성한다.

- **의존성 mock**: `$this->mock(Dependency::class)`로 의존성을 대체하고, 올바른 파라미터로 호출되는지 `shouldReceive()->with(...)`로 검증한다.
- **실제 외부 호출 금지 ≠ 테스트 생략**: "실제 Ollama 호출 테스트를 작성하지 마라" 같은 지시는 HTTP 호출을 하지 말라는 의미이지, mock 기반 단위 테스트조차 생략하라는 의미가 아니다. `Http::fake()`나 `$this->mock()`으로 외부 의존성을 대체하면 실제 호출 없이도 위임 동작을 검증할 수 있다.
- **얇은 래퍼도 예외 없음**: `EmbeddingGenerator`처럼 한 줄짜리 위임 클래스라도 config 값 읽기 → 의존성 호출까지의 위임이 올바른지 검증한다. 래퍼가 얇을수록 테스트 작성 비용도 낮다.
- **실패 경로(failure path)도 필수 검증**: 행복 경로(happy path)뿐 아니라, 의존성이 실패/거부/초과 상황을 반환할 때 서비스가 적절한 예외를 발생시키는지도 테스트해야 한다. 예: rate limit 초과 시 `RuntimeException` 발생, HTTP 오류 시 예외 전파.
- **테스트 헬퍼가 한계를 우회하면 별도 검증**: `makeClient()` 같은 테스트 헬퍼로 제한을 느슨하게 설정해 일반 테스트를 통과시키는 경우, 별도 테스트에서 실제 제한이 동작하는지 검증해야 한다. 예: `OllamaRateLimiter(1000, 1)`로 대부분 테스트를 통과시키면서, `OllamaRateLimiter(1, 60)`으로 rate limit 초과 시나리오를 별도 검증.
- **Unit 테스트에서 `$this->mock()` 필요 시 `uses(TestCase::class)` 선언**: `tests/Unit/` 디렉토리의 테스트는 기본적으로 Laravel `TestCase`를 상속하지 않으므로 `$this->mock()`이나 `$this->app`에 접근할 수 없다. 컨테이너 접근이 필요하면 파일 상단에 `use Tests\TestCase;` + `uses(TestCase::class);`를 추가할 것. (`tests/Unit/CategoryEmbeddingTest.php`의 패턴 참고)
- 기존 Feature 테스트(`OllamaTranslatorTest`, `EmbeddingGeneratorTest`)의 mock 패턴을 참고할 것.

### OllamaTranslator 캐싱 검증

`OllamaTranslatorTest`의 mock 호출 횟수(`->times(N)`) 검증 패턴 참고.

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

### 번역·임베딩 실행 패턴 (동기 HTTP)

- **번역과 임베딩은 비동기 Job이 아닌 동기 HTTP 컨트롤러 메서드에서 실행**한다. step 단위(`translation.zh`, `translation.en`, `embedding.ko/.zh/.en`)로 동기 처리 후 응답에 `translations` 필드를 포함해 프론트엔드 추가 API 호출 없이 UI 갱신.
- `PUT /api/categories/{id}/update-text`는 텍스트 업데이트 후 해당 언어의 CategoryEmbedding을 **삭제**한다.
- `category_code`: optional unique, `$request->filled('category_code')`로 체크 (빈 문자열 `""`와 `null` 구분 필요 — `??` 연산자는 `""`를 통과시키므로 `filled()` 사용).
- `recommend()`에서 text가 nullable: 빈 문자열이면 일반 카테고리 페이지네이션, text 있으면 pgvector JOIN 검색.

### 운영 설정 (Config + Settings Table)

운영 중 변경 가능한 설정값은 3계층 패턴 사용: `config/services.php`(기본값) → `SettingsSeeder`(DB 초기값) → `AppServiceProvider::boot()`(DB→config 동기화). 새 설정 추가 시 3곳 모두 업데이트. 기존 `ollama.host`, `ollama.translation_model` 참고.

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

### API 및 인증 주의사항

- **API 라우트에는 세션 미들웨어 없음** — `routes/api.php`는 `StartSession` 미들웨어 미포함. `$request->user()`는 web guard(세션) 사용 → API 컨트롤러에서 항상 null. `$request->user('sanctum')` 또는 `auth('sanctum')->user()` 사용.
- **RecommendResource에 user_id 필수** — `canModify` 판별용. 누락 시 유사도 검색 결과 모든 행이 보기 전용 처리됨.

### 테스트 및 배포 주의사항

- **Playwright 인증 테스트 토큰** — `docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::first()->createToken("debug")->plainTextToken;'`
- **`deploy.yml` `migrate:rollback --step=1` 위험** — 모든 migration이 batch 1일 때 전체 rollback 유발. migration 전 batch 번호 기록, `--batch=N`으로 특정 batch만 롤백.
- **`bootstrap/cache/config.php` 운영DB 오염** — `php artisan config:cache` 후 `php artisan test` 실행 시 캐시된 설정이 `.env.testing`을 무시하고 운영DB에 `migrate:fresh` 실행. **반드시 `php artisan config:clear` 선행** (Stop 훅에서 자동 실행).
- **Swagger 문서 stale** — CI/CD 배포 후 `storage/api-docs/api-docs.json` 미갱신. `docker exec cl_embed_laravel php artisan l5-swagger:generate`로 재생성.

