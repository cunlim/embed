# Step 0: sanctum-setup

## Phase 4 사전 작업 내역 (2026-05-12)

Phase 4 (api-layer) 리뷰 대응 과정에서 아래 항목이 이미 완료되었다. 이 step에서는 해당 항목을 **건너뛰거나** 상태만 확인하고 넘어간다.

| 항목 | 상태 | 비고 |
|------|------|------|
| `laravel/sanctum` composer 패키지 설치 | ✅ 완료 | v4.3.2 |
| `config/sanctum.php` generate | ✅ 완료 | `vendor:publish --tag=sanctum-config` |
| `User` 모델 `HasApiTokens` trait 추가 | ✅ 완료 | `laravel/app/Models/User.php` |
| `CategoryController::store()` `auth:sanctum` 미들웨어 | ✅ 완료 | `routes/api.php` |
| `CategoryController::batchTranslate()` `auth:sanctum` 미들웨어 | ✅ 완료 | `routes/api.php` |
| `BatchTranslateRequest::authorize()` | ✅ 완료 | 명시적 `return true` (권한 정책은 추후 정의) |
| `CategoryStoreRequest::authorize()` | ✅ 완료 | 명시적 `return true` (권한 정책은 추후 정의) |

### Phase 5 영향

- **Sanctum config 생성 시**: 이미 존재하는 `config/sanctum.php`를 덮어쓰지 않도록 `--force`를 사용하지 않는다. `vendor:publish`는 config가 존재하면 skip한다.
- **User 모델 수정 시**: `HasApiTokens`가 이미 추가되어 있으므로 중복 추가하지 않는다.
- **CategoryController 라우트**: 이미 `auth:sanctum` 미들웨어가 적용되어 있으므로 추가하지 않는다. `index()`, `show()`는 공개 상태 그대로 유지.
- **RecommendController**: Phase 4 step 1에서 생성된 `POST /api/recommend`는 공개 엔드포인트이므로 미들웨어를 추가하지 않는다 (PRD §4: 추천은 비로그인 사용자도 사용 가능).
- **`.env`의 `SANCTUM_STATEFUL_DOMAINS`** 및 **`AUTH_GUARD`** 설정은 이 step에서 정상 진행한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-004: Sanctum + Socialite)
- `/docs/PRD.md` (특히 §3.4, §4)
- `/laravel/CLAUDE.md`
- `/laravel/config/sanctum.php` (없으면 Laravel 13 기본값)
- `/laravel/app/Models/User.php`
- `/laravel/routes/api.php` (이전 task에서 생성됨)
- `/laravel/bootstrap/app.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Laravel Sanctum을 구성하고 API Token 인증을 설정하라. ADR-004에 따라 Stateless Token 방식을 사용한다.

### Sanctum 설정

1. Sanctum 패키지가 설치되어 있는지 확인 (Laravel 13 기본 포함).
2. `config/sanctum.php`가 없으면 `php artisan vendor:publish --tag=sanctum-config`으로 생성.
3. `.env`에 `SANCTUM_STATEFUL_DOMAINS` 설정 — Next.js 도메인 `embed.cunlim.dev` 추가.

### User 모델 수정

`HasApiTokens` 트레이트 추가.

### API 인증 라우트 추가 (`routes/api.php`)

```php
Route::post('auth/register', [AuthController::class, 'register']);
Route::post('auth/login', [AuthController::class, 'login']);
Route::post('auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('auth/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
```

### AuthController (`app/Http/Controllers/Api/AuthController.php`)

시그니처:
```php
namespace App\Http\Controllers\Api;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse;
    public function login(LoginRequest $request): JsonResponse;
    public function logout(Request $request): JsonResponse;
    public function user(Request $request): JsonResponse;
}
```

핵심 규칙:
- `register()` — User 생성, token 발급, 201 응답
- `login()` — email/password 검증, token 발급
- `logout()` — 현재 token 삭제
- `user()` — 현재 인증된 사용자 정보 반환

### 미들웨어 적용

CategoryController의 `store()`와 `batchTranslate()`에 `auth:sanctum` 미들웨어 적용. `index()`와 `show()`는 공개.

## 생성할 파일

- `laravel/config/sanctum.php` (publish)
- `laravel/app/Http/Controllers/Api/AuthController.php`
- `laravel/app/Http/Requests/RegisterRequest.php`
- `laravel/app/Http/Requests/LoginRequest.php`
- `laravel/app/Models/User.php` (수정 — HasApiTokens 추가)
- `laravel/routes/api.php` (수정 — auth 라우트 추가)
- `laravel/.env` (수정 — SANCTUM_STATEFUL_DOMAINS 추가)

## Acceptance Criteria

```bash
# Sanctum 패키지 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo class_exists("Laravel\Sanctum\HasApiTokens") ? "Sanctum OK" : "Sanctum MISSING";
'

# 라우트 등록 확인
docker exec cl_embed_laravel php artisan route:list --path=api

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/auth-system/index.json`의 해당 step을 업데이트한다.

## 금지사항

- SPA 인증(stateful)을 사용하지 마라. ADR-004에 따라 API Token(stateless) 방식을 사용한다.
- `auth:sanctum` 미들웨어가 필요한 라우트에서 빠뜨리지 마라. PRD §3.4: 카테고리 추가는 인증 필요.
- 기존 테스트를 깨뜨리지 마라
