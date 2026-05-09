# Step 0: sanctum-setup

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
