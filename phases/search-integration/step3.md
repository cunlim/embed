# Step 3: swagger-docs

## 읽어야 할 파일

먼저 아래 파일들을 읽고 전체 API 구조를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "API 문서 라우팅")
- `/docs/PRD.md` (전체)
- `/docs/ADR.md` (전체)
- `/laravel/CLAUDE.md`
- `/laravel/routes/api.php` (모든 라우트)
- `/laravel/routes/web.php` (OAuth 라우트)
- `/laravel/app/Http/Controllers/Api/CategoryController.php` (기존 어노테이션 확인)
- `/laravel/app/Http/Controllers/Api/RecommendController.php` (기존 어노테이션 확인)
- `/laravel/app/Http/Controllers/Api/AuthController.php` (이전 task에서 생성됨)
- `/laravel/app/Http/Controllers/Api/OAuthController.php` (이전 task에서 생성됨)
- `/laravel/app/Http/Requests/` (모든 Form Request)
- `/laravel/app/Http/Resources/` (모든 Resource)
- `/laravel/config/l5-swagger.php` (이전 task에서 생성됨)

이전 step에서 만들어진 모든 코드를 꼼꼼히 읽고, 전체 API 구조를 이해한 뒤 작업하라.

## 작업

모든 개발이 완료된 시점에서 Swagger API 문서를 최종 완성하라. `api-layer/step2`에서 설치된 L5-Swagger에 누락된 API 어노테이션을 추가하고, 전체 문서를 검증한다.

### 누락된 API 어노테이션 추가

아래 Controller에 Swagger OA 어노테이션을 추가하라:

**AuthController** (auth-system에서 생성됨):
- `POST /api/auth/register` — 회원가입
- `POST /api/auth/login` — 로그인
- `POST /api/auth/logout` — 로그아웃 (인증 필요)
- `GET /api/auth/user` — 현재 사용자 정보 (인증 필요)

**OAuthController** (auth-system에서 생성됨):
- `GET /api/auth/{provider}/redirect` — OAuth 리다이렉트
- `GET /api/auth/{provider}/callback` — OAuth 콜백

### 기존 어노테이션 검증 및 보강

- `api-layer/step2`에서 작성된 CategoryController와 RecommendController의 어노테이션이 최종 구현과 일치하는지 확인한다.
- 특히 `POST /api/recommend`는 `search-integration`에서 캐싱 로직이 추가되었으므로, 응답 스키마에 변경이 없는지 확인한다.
- 모든 Form Request의 validation rule이 Swagger에 반영되었는지 확인한다.

### Swagger 설정 최종화

`config/l5-swagger.php`:
- `title` ⇒ `CL Embed API`
- `description` ⇒ 최종 설명으로 업데이트
- `termsOfService` ⇒ 프로젝트 URL
- `contact` ⇒ 작성자 정보

### Swagger JSON 생성 및 검증

```bash
php artisan l5-swagger:generate
```

생성된 JSON이 유효한 OpenAPI 3.0 스펙을 따르는지 확인한다.

## 생성할 파일

- `laravel/app/Http/Controllers/Api/AuthController.php` (수정 — 어노테이션 추가)
- `laravel/app/Http/Controllers/Api/OAuthController.php` (수정 — 어노테이션 추가)
- `laravel/app/Http/Controllers/Api/CategoryController.php` (수정 — 어노테이션 보강)
- `laravel/app/Http/Controllers/Api/RecommendController.php` (수정 — 어노테이션 보강)
- `laravel/config/l5-swagger.php` (수정 — 최종 설정)

## Acceptance Criteria

```bash
# Swagger JSON 생성 (에러 없이 완료되어야 함)
docker exec cl_embed_laravel php artisan l5-swagger:generate

# 모든 API 라우트 확인
docker exec cl_embed_laravel php artisan route:list

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact

# Swagger UI 접근 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $routes = app("router")->getRoutes();
  $hasSwagger = false;
  foreach ($routes as $route) {
    if (str_contains($route->uri(), "documentation")) { $hasSwagger = true; break; }
  }
  echo $hasSwagger ? "Swagger route found" : "Swagger route MISSING";
'
```

## 검증 절차

1. 위 AC 커맨드를 모두 실행한다.
2. `l5-swagger:generate`가 에러 없이 완료되는지 확인한다.
3. Swagger UI(`/swagger`)가 모든 API 엔드포인트를 표시하는지 확인한다.
4. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md `/swagger/` Swagger UI 요구사항이 완전히 충족되었는가?
   - 모든 API 엔드포인트가 문서화되었는가?
5. 결과에 따라 `phases/search-integration/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "전체 API Swagger 문서화 완료"`
   - 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `l5-swagger:generate`가 실패하는 상태로 두지 마라. 모든 어노테이션 문법은 유효해야 한다.
- OAuth 라우트(`routes/web.php`)를 Swagger 문서에서 누락하지 마라. `/swagger`에 포함되도록 적절히 설정하라.
- 기존 테스트를 깨뜨리지 마라
