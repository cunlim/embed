## 프로젝트 관련 (cl_embed)

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

### TDD 적용 범위

| 대상 | 테스트 유형 |
|------|------------|
| Controller | Feature (HTTP 응답, mock, DB 단언) |
| Form Request | Feature (유효성 검증, 실패 시나리오) |
| Eloquent Resource | Feature (응답 형식 검증) |
| Model | Unit (Factory, 관계, 캐스팅) |
| Service | Unit/Feature (의존성 mock + 위임 검증) |
| Command/Scheduled Task | Feature (실행 결과 검증) |

### Laravel 코드 컨벤션

- **PHP 8 속성(Attribute) 사용**: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`, `#[Hidden([...])]`
- **API 리소스**: `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}` 래퍼 자동 적용
- **Resource collection에 전달되는 각 항목은 객체여야 한다** — 연관 배열 전달 시 `Attempt to read property on array` 에러 발생
- **PHP 변경 완료 전** 반드시 `vendor/bin/pint --format agent` 실행

### Form Request boolean 유효성 검증

- **`boolean` rule은 `"true"`/`"false"` 문자열 불허** — `true`, `false`, `1`, `0`, `"1"`, `"0"`만 허용. 프론트엔드에서 `String(moveToDefault)`로 `"true"`/`"false"` 전송 시 유효성 실패. **해결**: `params.set(key, bool ? "1" : "0")` 사용.
- **`$request->boolean()`은 `"true"`/`"false"`도 허용** — `filter_var($val, FILTER_VALIDATE_BOOL)` 사용. FormRequest 검증을 통과한 후의 값 변환만 담당하므로, 유효성 실패 자체를 막을 수는 없음.

### L5-Swagger OA 어노테이션

- `OA\JsonContent`에 `type: 'object'` 명시 필수
- OA 변경 후 `l5-swagger:generate`로 검증

### 테스트 환경 (PostgreSQL + pgvector)

테스트 DB는 실제 PostgreSQL(`cl_embed_test`, `pgvector_03` 컨테이너) 사용.

- **`RefreshDatabase` 사용** — Pest.php에 의해 자동 적용. Unit 테스트 중 DB 접근 필요 시 명시적 추가.
- **PostgreSQL 트랜잭션 abort** — 쿼리 오류 발생 시 트랜잭션 abort. `create()` + catch 대신 `firstOrCreate()` 사용.
- **pgvector raw SQL** — `::vector` 명시적 캐스트 필수. PDO는 text로 바인딩.
- **pgvector 테스트** — `array_fill` 금지 (collinear 벡터). 서로 다른 방향 사용.
- **`.env.testing` 파일** — gitignore 대상, `DB_DATABASE=cl_embed_test`
- **별도 테스트 DB 사용자** — `dbeaver_lim_test`가 테이블 소유자가 아니면 `migrate:fresh` 실패. `dbeaver_lim`으로 schema 재생성 후 테스트.

### PostgreSQL 쿼리 주의사항

- **DB 포맷은 실제 데이터로 확인** — LIKE 쿼리 전 `psql`로 프로덕션 DB 조회. `category_name_ko` 구분자는 `>` (공백 없음).
- **RANK() + LEFT JOIN 함정** — RANK()는 LEFT JOIN 결과가 NULL이어도 전체 결과셋에서 순위 반환. Service에서 `distance`가 null이면 `rank`도 null로 명시적 처리 필요.

### 번역·임베딩 실행 패턴

- 번역/임베딩은 비동기 Job이 아닌 **동기 HTTP 컨트롤러**에서 실행. step 단위 처리 후 `translations` 필드 포함 응답.
- `PUT /api/categories/{id}/update-text`는 텍스트 업데이트 후 해당 언어의 CategoryEmbedding을 **삭제**.
- `category_code`: `(category_code, user_id, folder)` 복합 unique. `CategoryStoreRequest`·`CategoryUpdateTextRequest` 모두 folder scope 포함 필수. `filled()`로 체크 (`??`는 빈 문자열 통과)
- `RecommendRequest` filter: `in:my,all` — `"all"`도 허용 (프론트 "전체" 선택 + 유사도검색 시 `filter=all` 전송)

### 카테고리 검색 API

- `GET /api/categories?search=...` 파라미터는 `category_name_ko` OR `category_code` 두 필드를 LIKE 검색
- 엑셀 다운로드 포맷: `category_code | category_ko | category_en | category_zh` (업로드 양식과 일치)

### 프레임워크 주의사항

- **Event::fake()는 Eloquent 라이프사이클 이벤트까지 캡처** — `Event::fake()` (인자 없는 호출) 시 `eloquent.booting` 등 Model 생성 시 프레임워크 내부 이벤트까지 캡처. `Event::fake([SpecificEvent::class])`로 감시 대상 한정 필요.
- **Cache::lock — 모든 early return에서 `$lock->release()` 확인** — lock 획득 후 `return`하는 모든 분기에서 해제 확인. TTL은 crash 복구용 안전장치.

### 운영 설정 (Config + Settings Table)

운영 중 변경 가능한 설정값은 3계층 패턴: `config/services.php`(기본값) → `SettingsSeeder`(DB 초기값) → `AppServiceProvider::boot()`(DB→config 동기화). 새 설정 추가 시 3곳 모두 업데이트.

### 서비스 클래스

- **CRITICAL**: 의존성 mock하여 위임 동작 검증하는 테스트 필수. `$this->mock(Dependency::class)` + `shouldReceive()->with(...)`
- **실패 경로도 필수 검증**: 의존성 실패/거부/초과 시 적절한 예외 발생 테스트
- **테스트 헬퍼 한계 우회 검증**: `makeClient()` 등으로 제한을 느슨하게 설정한 경우, 실제 제한 동작 별도 검증
- **Unit 테스트에서 `$this->mock()` 필요 시** `uses(TestCase::class)` 선언 필수

### 캐싱 패턴

- **그룹 조회 최적화**: 개별 `Cache::remember()` 호출 금지. 그룹 전체를 하나의 캐시 키로 묶어 저장 (DB 쿼리 1회 + 캐시 호출 1회)
- **캐시 키 설계**: `get()`은 개별 키, `all()`은 그룹 캐시로 분리

### 의존성 주입 주의사항

- **Eloquent 모델을 쿼리 빌더 용도로 생성자 주입 금지** — `Model::query()->where(...)` 사용
- **Unique 제약조건 테이블에 `create()` 사용 시** — 동시 요청 고려, `firstOrCreate()` 또는 try-catch 사용

### 마이그레이션 수정 패턴

- **이미 실행된 마이그레이션 수정 시** — 원본 마이그레이션과 새 마이그레이션 모두 실행 환경을 고려해야 함. 새 마이그레이션에서 제약조건 존재 여부 확인:
  ```php
  $exists = DB::selectOne("SELECT 1 FROM pg_indexes WHERE indexname = '...'");
  if ($exists) { /* drop/modify */ }
  ```
- **`RefreshDatabase` 사용 테스트 환경** — 원본 마이그레이션 변경 시 새 마이그레이션에서 중복 실행 방지 필요
- **NULL 포함 복합 unique 인덱스** — PostgreSQL에서 NULL은 unique 제약에서 서로 다르게 취급됨. `COALESCE(column, '')` 기반 partial unique index 사용:
  ```php
  DB::statement('CREATE UNIQUE INDEX idx_name ON table (col1, col2, COALESCE(nullable_col, \'\'))');
  ```

### API 인증

- API 라우트에는 세션 미들웨어 없음. `$request->user('sanctum')` 또는 `auth('sanctum')->user()` 사용.
- `RecommendResource`에 `user_id` 필수 — `canModify` 판별용.
- **관리자 전용 엔드포인트** — `routes/api.php`의 `auth:sanctum` 미들웨어 그룹에 추가. 컨트롤러에서 `$user->isAdmin()`으로 추가 권한 검증.

### OAuth (Socialite)

- **라우트는 `routes/web.php`** — Socialite는 세션 기반 state 검증 필요
- **callback은 `RedirectResponse` 반환** — Sanctum 토큰 발급 후 `redirect("/login?token={$token}")`
- **provider_token DB 저장 금지** — 이후 인증은 Sanctum token으로 수행
- **OAuth 디버깅**: `config:clear` 후 `php artisan tinker --execute 'echo config("services.google.client_id");'`로 컨테이너 config 확인
- **리다이렉트 URL 검증**: `curl -sI "https://embed.cunlim.dev/api/auth/{provider}/redirect"`로 302 Location 헤더 확인

### 테스트 및 배포 주의사항

- **Playwright 인증** — 쿠키 기반(`auth_token`). superadmin 사용자로 토큰 발급:
  ```bash
  # superadmin 사용자 확인
  docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::where("role","superadmin")->first()?->id ?? "없음";'
  # superadmin이 없으면 기존 사용자 역할 변경 (테스트 후 원복 필수, ID==1은 원래 superadmin이므로 변경 금지)
  docker exec cl_embed_laravel php artisan tinker --execute '\App\Models\User::find(<ID>)->update(["role" => "superadmin"]); echo "done";'
  # 토큰 발급
  docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::find(<ID>)->createToken("debug")->plainTextToken;'
  # 테스트 완료 후 역할 원복
  docker exec cl_embed_laravel php artisan tinker --execute '\App\Models\User::find(<ID>)->update(["role" => "member"]); echo "원복완료";'
  ```
  Playwright에서 쿠키 설정: `document.cookie = "auth_token=<TOKEN>; path=/; expires=...; SameSite=Lax"`
- **`deploy.yml` `migrate:rollback --step=1` 위험** — batch 1에서 전체 rollback 유발
- **`bootstrap/cache/config.php` 오염** — `php artisan test` 전 `php artisan config:clear` 필수
- **Swagger 문서 stale** — 배포 후 `php artisan l5-swagger:generate`로 재생성
