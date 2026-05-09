# Step 1: socialite-oauth

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-004: Socialite OAuth)
- `/docs/PRD.md` (특히 §4)
- `/laravel/CLAUDE.md`
- `/laravel/app/Models/User.php`
- `/laravel/app/Http/Controllers/Api/AuthController.php` (이전 step에서 생성됨)
- `/laravel/routes/api.php`
- `/laravel/database/migrations/0001_01_01_000000_create_users_table.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Laravel Socialite를 설치하고 Google, GitHub, Naver OAuth 로그인을 구성하라.

### Socialite 설치

```bash
composer require laravel/socialite
```

### OAuth 설정

`config/services.php`에 세 가지 OAuth 제공자 설정 추가:
```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI'),
],
'github' => ...,
'naver' => ...,
```

`.env`에 각 제공자의 `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` 환경변수 추가 (기본값은 빈 문자열로).

### Users 테이블 마이그레이션

users 테이블에 OAuth 컬럼을 추가하는 새 마이그레이션 생성:
- `provider` (string, nullable) — 'google', 'github', 'naver'
- `provider_id` (string, nullable)
- `provider_token` (text, nullable)
- `avatar` (string, nullable)
- `provider` + `provider_id` 복합 unique 인덱스
- `password` 컬럼을 nullable로 변경 (OAuth 사용자는 비밀번호 불필요)

### OAuthController (`app/Http/Controllers/Api/OAuthController.php`)

시그니처:
```php
namespace App\Http\Controllers\Api;

class OAuthController extends Controller
{
    public function redirect(string $provider): RedirectResponse;
    public function callback(string $provider): JsonResponse;
}
```

핵심 규칙:
- `redirect()` — Socialite driver로 리다이렉트 URL 생성 반환
- `callback()` — OAuth 제공자에서 사용자 정보 획득, `updateOrCreate()`로 User 생성/업데이트, Sanctum token 발급, JSON 응답
- `provider` 파라미터는 `google`, `github`, `naver` 중 하나

### OAuth 라우트 추가 (`routes/web.php`)

OAuth 라우트는 **반드시 `routes/web.php`에 등록**해야 한다. 이유: Laravel Socialite는 OAuth state 파라미터를 Session에 저장하여 CSRF를 방지한다. `routes/api.php`는 stateless 미들웨어를 사용하므로 Session이 없어 Socialite가 정상 동작하지 않는다.

`routes/web.php`에 정의하지만 경로는 `/api/auth/...`로 시작하도록 한다. Nginx가 이미 `/api/` 경로를 Laravel로 프록시하므로 추가 설정 없이 동작하며, API URL 체계와의 일관성도 유지된다.

```php
// routes/web.php 에 추가
Route::get('/api/auth/{provider}/redirect', [OAuthController::class, 'redirect']);
Route::get('/api/auth/{provider}/callback', [OAuthController::class, 'callback']);
```

## 생성할 파일

- `laravel/app/Http/Controllers/Api/OAuthController.php`
- `laravel/database/migrations/xxxx_xx_xx_add_oauth_columns_to_users_table.php`
- `laravel/.env` (수정 — OAuth 환경변수 추가)
- `laravel/config/services.php` (수정 — OAuth 설정 추가)
- `laravel/routes/web.php` (수정 — OAuth 라우트 추가)

## Acceptance Criteria

```bash
# Socialite 설치 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo class_exists("Laravel\Socialite\SocialiteServiceProvider") ? "Socialite OK" : "Socialite MISSING";
'

# OAuth 컨트롤러 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Http\Controllers\Api\OAuthController::class));
'

# 마이그레이션 확인
docker exec cl_embed_laravel php artisan migrate:status

# 라우트 확인 (OAuth 라우트는 web.php에 등록되므로 전체 라우트 확인)
docker exec cl_embed_laravel php artisan route:list

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

- 실제 OAuth 콜백 테스트를 하지 마라. OAuth Client ID/Secret은 사용자가 직접 발급해야 하므로, 이 step에서는 코드 구현만 완료하고 `"blocked"` 상태로 표시하라 (사유: OAuth 키 발급 필요).
- `password` 컬럼 nullable 변경 시 기존 데이터와 충돌하지 않도록 `change()` 메서드를 사용하라.
- 기존 테스트를 깨뜨리지 마라
