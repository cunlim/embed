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

### 번역·임베딩 실행 패턴

- 번역/임베딩은 비동기 Job이 아닌 **동기 HTTP 컨트롤러**에서 실행. step 단위 처리 후 `translations` 필드 포함 응답.
- `PUT /api/categories/{id}/update-text`는 텍스트 업데이트 후 해당 언어의 CategoryEmbedding을 **삭제**.
- `category_code`: optional unique, `filled()`로 체크 (`??`는 빈 문자열 통과)

### 서비스 클래스

- **CRITICAL**: 의존성 mock하여 위임 동작 검증하는 테스트 필수. `$this->mock(Dependency::class)` + `shouldReceive()->with(...)`
- **캐싱 패턴**: 그룹 조회는 개별 `Cache::remember()` 호출 금지. 그룹 전체를 하나의 캐시 키로 묶어 저장.

### API 인증

- API 라우트에는 세션 미들웨어 없음. `$request->user('sanctum')` 또는 `auth('sanctum')->user()` 사용.
- `RecommendResource`에 `user_id` 필수 — `canModify` 판별용.

### OAuth (Socialite)

- **라우트는 `routes/web.php`** — Socialite는 세션 기반 state 검증 필요
- **callback은 `RedirectResponse` 반환** — Sanctum 토큰 발급 후 `redirect("/login?token={$token}")`
- **provider_token DB 저장 금지** — 이후 인증은 Sanctum token으로 수행

### 테스트 및 배포 주의사항

- **Playwright 인증** — 쿠키 기반(`auth_token`). superadmin 사용자로 토큰 발급:
  ```bash
  # superadmin 사용자 확인 (없으면 DB에서 직접 조회)
  docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::where("role","superadmin")->first()?->id ?? "없음";'
  # 토큰 발급 (superadmin 사용자 ID 지정)
  docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::find(<ID>)->createToken("debug")->plainTextToken;'
  ```
  Playwright에서 쿠키 설정: `document.cookie = "auth_token=<TOKEN>; path=/; expires=...; SameSite=Lax"`
- **`deploy.yml` `migrate:rollback --step=1` 위험** — batch 1에서 전체 rollback 유발
- **`bootstrap/cache/config.php` 오염** — `php artisan test` 전 `php artisan config:clear` 필수
- **Swagger 문서 stale** — 배포 후 `php artisan l5-swagger:generate`로 재생성
