# 시스템 설정 DB화 설계

## 목표

시스템 전체에 하드코딩된 디폴트값을 DB(Settings 테이블)에 저장하고, 관리자 페이지에서 수정 가능하게 한다. 동시에 superadmin/admin 역할 분리를 처음으로 도입한다.

## 범위

### 신규 설정 항목 (15개, 6개 그룹)

| 그룹 | 키 | 기본값 | 타입 |
|------|-----|--------|------|
| `ollama` | `timeout` | `300` | integer |
| `ollama` | `translation_max_attempts` | `3` | integer |
| `pagination` | `default_per_page` | `20` | integer |
| `pagination` | `max_per_page_guest` | `100` | integer |
| `recommend` | `default_limit` | `5` | integer |
| `recommend` | `max_per_page` | `100` | integer |
| `auth` | `token_expiry_days` | `30` | integer |
| `auth` | `session_lifetime` | `120` | integer |
| `category` | `code_prefix` | `CAT_` | string |
| `category` | `code_random_length` | `8` | integer |
| `category` | `code_max_attempts` | `3` | integer |
| `validation` | `text_max_length` | `500` | integer |
| `validation` | `name_max_length` | `255` | integer |
| `cache` | `settings_ttl` | `3600` | integer |
| `frontend` | `step_delay_ms` | `2000` | integer |

기존 ollama 그룹 5개 포함 총 20개 설정 항목이 DB에서 관리된다.

### Superadmin 가드 적용

- `/admin` 페이지 접근: `isAdmin()` → `isSuperAdmin()`
- 헤더 "관리자" 버튼 노출: `isAdmin()` → `isSuperAdmin()`
- `embed-page-inner.tsx` 카테고리 수정 권한: `isAdmin()` 유지 (admin도 자기 카테고리 수정 가능)

## 아키텍처

### 3계층 설정 패턴 (기존 ollama 패턴 준수)

```
config/services.php (코드 기본값)
       ↓
SettingsSeeder (DB 초기값)
       ↓
AppServiceProvider::boot() (DB → config 덮어쓰기)
       ↓
런타임 config('services.xxx.yyy') 호출
```

### 파일 구조

```
laravel/
├── config/services.php                              ← 신규 그룹 기본값 추가
├── app/Providers/AppServiceProvider.php              ← DB→config 동기화 확장
├── database/seeders/SettingsSeeder.php               ← 신규 항목 추가
├── routes/api.php                                    ← 라우트 추가
├── app/Http/Controllers/Api/AdminSettingsController.php ← 신규
│
nextjs/
├── lib/api.ts                                        ← 설정 API 함수 추가
├── app/admin/page.tsx                                ← 가드 변경 + 탭 추가
├── components/admin/settings-panel.tsx               ← 신규 컴포넌트
├── components/auth-buttons.tsx                        ← 가드 변경
├── app/embed/embed-page-inner.tsx                     ← 변경 없음 (isAdmin 유지)
```

### API

```
GET  /api/admin/settings  → 전체 그룹 설정 반환 (superadmin only)
PUT  /api/admin/settings  → { group, key, value }로 단일 설정 업데이트 (superadmin only)
```

인증은 Sanctum Bearer token 사용. superadmin role 검증은 컨트롤러에서 수행.

### AdminSettingsController

- `index()`: `SettingsService::all()` 확장 사용. 그룹 목록을 지정해 모든 설정 반환.
- `update()`: 요청에서 `group`, `key`, `value`를 받아 Setting upsert + 캐시 무효화. type에 따라 캐스팅.

### UI (settings-panel.tsx)

- `/admin` 페이지의 새 탭 "시스템 설정"으로 진입
- 그룹별 Card: 헤더에 그룹명, 본문에 설정 필드 목록
- 각 필드: label + Input (type에 따라 text/number)
- 그룹별 "저장" 버튼 → PUT /api/admin/settings 순차 호출
- 저장 성공 시 toast 또는 성공 표시

## 변경 영향도

### SettingsService 확장

- `all()` 메서드가 그룹 단위로 동작하므로 변경 없음
- `get()` 사용 시 기본값 인자로 config 값을 전달해야 함

### 기존 코드 변경

- `OllamaClient`: timeout을 config에서 읽도록 변경 (현재 AppServiceProvider에서 하드코딩)
- `OllamaTranslator`: `MAX_ATTEMPTS` 상수를 config에서 읽도록 변경
- `Category::generateCode()`: prefix, random length, max attempts를 config에서 읽도록 변경
- `SettingsService`: 캐시 TTL을 config에서 읽도록 변경
- `CategoryController`, `RecommendController`, `RecommendationService`: per_page 기본값을 config에서 읽도록 변경
- `RecommendRequest`: max per_page를 config에서 읽도록 변경 (또는 유지)
- `RecommendRequest`, `RegisterRequest`, `CategoryStoreRequest`, `CategoryUpdateTextRequest`: max length 등 검증 규칙은 FormRequest에 하드코딩 유지 (config에서 동적으로 바꾸면 불안정)

### Superadmin 가드

- `nextjs/app/admin/page.tsx`: `isAdmin(user)` → `isSuperAdmin(user)`
- `nextjs/components/auth-buttons.tsx`: `isAdmin(user)` → `isSuperAdmin(user)`
- `nextjs/app/embed/embed-page-inner.tsx`: 변경 없음 (`isAdmin` 유지)

## Validation 규칙 정적 유지

FormRequest의 `max:500`, `max:255`, `min:8` 등은 애플리케이션 계약이므로 DB 설정화하지 않는다. `validation.text_max_length`와 `validation.name_max_length`는 프론트엔드 입력 폼의 `maxLength` 속성과 API 문서 표시용으로만 사용하고, 실제 서버 측 검증은 기존 FormRequest 규칙을 따른다.

## 테스트

- `AdminSettingsControllerTest`: superadmin 접근 허용, admin/member 접근 거부, 설정 업데이트 검증
- `SettingsServiceTest`: 기존 + 신규 그룹 get/all 검증
- `AppServiceProviderTest`: DB→config 동기화 검증
- `nextjs`: admin page 가드 테스트, settings-panel 렌더링 테스트

## 주의사항

- `SettingsSeeder`는 `firstOrCreate` 사용 — 재실행 시 기존 값 덮어쓰지 않음
- `AppServiceProvider::boot()`는 settings 테이블 존재 여부 확인 후 동기화 (기존 패턴)
- `SettingsService::update()`는 DB 저장 후 `Cache::forget()`으로 해당 그룹 캐시 무효화
- `isSuperAdmin()` 함수는 양쪽(User.php, lib/utils.ts)에 이미 존재 — import만 변경
