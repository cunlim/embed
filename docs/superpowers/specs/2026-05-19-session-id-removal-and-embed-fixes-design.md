# session_id 제거 및 embed 페이지 버그 수정 설계

## 개요

embed 페이지에서 session_id 관련 불필요한 로직을 프로젝트 전체에서 제거하고, "전체/내 카테고리" 토글 버그와 검색 캐시 중복 INSERT 버그를 수정한다.

## 배경

- session_id는 비회원의 검색 캐시 재사용을 위해 도입되었으나, 임베딩 벡터는 개인정보와 무관하므로 모든 사용자가 공유해도 문제없다.
- API 라우트에 세션 미들웨어가 없어 session_id는 매 요청마다 새 UUID가 생성되어 캐시 역할을 전혀 수행하지 못하고 있었다.
- `GET /api/categories`에 auth 미들웨어가 없어 `auth('sanctum')->id()`가 항상 null — "내 카테고리" 필터가 동작하지 않았다.
- `orWhere('user_id', 1)`로 하드코딩된 보완 로직이 있었으나 부정확했다.

## 변경 범위

### 1. session_id 제거

**데이터베이스:**
- 새 마이그레이션: `search_logs.session_id` 컬럼 제거 (`$table->dropColumn('session_id')`)

**Laravel 코드:**
- `app/Models/SearchLog.php`: `#[Fillable]`에서 `session_id` 제거, `booted()`의 UUID 자동 생성 제거
- `app/Repositories/SearchLogRepository.php`: `findByNormalizedKeyword()` 시그니처를 `(string $normalizedKeyword)`로 단순화, `user_id`/`session_id` 분기 제거
- `app/Services/EmbeddingCacheService.php`: `getOrCreateEmbedding()`에서 `$sessionId` 파라미터 제거
- `app/Http/Controllers/Api/RecommendController.php`: sessionId 생성 로직 제거, `getOrCreateEmbedding()` 호출 갱신

**테스트/Factory:**
- `database/factories/SearchLogFactory.php`: `session_id` 제거
- session_id를 검증하는 모든 테스트 수정

**문서:**
- `docs/PRD.md`, `nextjs/CLAUDE.md`에서 session_id 언급 제거
- `phases/` 내 session_id 참조 정리

### 2. 카테고리 목록: "전체/내 카테고리" 토글

**백엔드 (`CategoryController::index()`):**

```php
$user = auth('sanctum')->user();

if ($request->input('filter') === 'my') {
    if ($user) {
        $query->where('user_id', $user->id);
    } else {
        $query->whereRaw('1 = 0');
    }
} else {
    if ($user) {
        $query->where(function ($q) use ($user) {
            $q->where('user_id', $user->id)
              ->orWhere('user_id', 1);
        });
    } else {
        $query->where('user_id', 1);
    }
}
```

- `GET /api/categories`는 public 유지
- `orWhere('user_id', 1)` 하드코딩 제거, user_id=1은 "전체" 모드의 admin 소유로만 포함
- 비회원은 user_id=1 카테고리만 조회 가능
- 회원 "전체": 본인 + admin 소유
- 회원 "내 카테고리": 본인 소유만

**프론트엔드 (`embed/page.tsx`):**
- `/login` 리다이렉트 제거 → 비회원도 embed 페이지 접근 가능
- "전체/내 카테고리" 토글: 모든 사용자에게 표시
- 비회원이 "내 카테고리" 클릭 시: 필터 전환 없이 로그인 알림(alert 또는 toast) 표시
- "카테고리 추가", "일괄 번역": 비회원 클릭 시 동일하게 로그인 알림

### 3. 검색 캐시 중복 제거

**`SearchLogRepository::findByNormalizedKeyword()` 단순화:**

```php
public function findByNormalizedKeyword(string $normalizedKeyword): ?SearchLog
{
    return SearchLog::query()
        ->where('normalized_keyword', $normalizedKeyword)
        ->latest()
        ->first();
}
```

- `user_id`/`session_id` 분기 제거, 정규화된 키워드만으로 조회
- 모든 사용자(비회원 포함)가 동일 검색어의 임베딩을 공유 → Ollama API 호출 감소

### 4. 프론트엔드: 비회원 접근

| UI 요소 | 비회원 | 회원 |
|---------|--------|------|
| 카테고리 목록 | 전체(user_id=1) | 전체(본인+admin) 또는 본인만 |
| 카테고리 검색 | 가능 | 가능 |
| 카테고리 상세 보기 | readOnly | 소유 시 수정 가능 |
| "전체/내 카테고리" 토글 | 표시됨, "내 카테고리" 클릭 시 로그인 알림 | 정상 동작 |
| 카테고리 추가 | 표시됨, 클릭 시 로그인 알림 | 정상 동작 |
| 일괄 번역 | 표시됨, 클릭 시 로그인 알림 | 정상 동작 |
| 삭제 버튼 | 감춰짐 (`canModify`) | 소유 시 표시 |

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `laravel/app/Models/SearchLog.php` | session_id fillable·booted 제거 |
| `laravel/app/Repositories/SearchLogRepository.php` | findByNormalizedKeyword 단순화 |
| `laravel/app/Services/EmbeddingCacheService.php` | $sessionId 파라미터 제거 |
| `laravel/app/Http/Controllers/Api/RecommendController.php` | sessionId 생성 로직 제거 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | index() 필터 로직 수정 |
| 새 마이그레이션 | search_logs.session_id 컬럼 제거 |
| `laravel/database/factories/SearchLogFactory.php` | session_id 제거 |
| `laravel/tests/Feature/Api/RecommendControllerTest.php` | session_id 참조 제거 |
| `laravel/tests/Feature/RecommendationTest.php` | session_id 참조 제거 |
| `laravel/tests/Unit/Services/EmbeddingCacheServiceTest.php` | session_id 기반 검증 수정 |
| `laravel/tests/Unit/Services/RecommendationServiceTest.php` | session_id 참조 제거 |
| `laravel/tests/Unit/SearchLogRepositoryTest.php` | session_id 기반 검증 수정 |
| `nextjs/app/embed/page.tsx` | 비회원 리다이렉트 제거, 로그인 알림 추가 |
| `docs/PRD.md` | session_id 언급 제거 |
| `nextjs/CLAUDE.md` | session_id 언급 제거 |

## 검증

1. `docker exec cl_embed_laravel php artisan test --compact` — 모든 Laravel 테스트 통과
2. `docker exec cl_embed_nextjs npm test` — 모든 Vitest 테스트 통과
3. Playwright: 비회원으로 embed 페이지 접근 → user_id=1 카테고리 목록 표시, "내 카테고리" 클릭 시 로그인 알림
4. Playwright: 회원 로그인 후 "내 카테고리" 선택 → 본인 소유 카테고리만 표시
5. Playwright: 동일 검색어 2회 검색 → search_logs에 1건만 존재 (중복 INSERT 없음)
6. `.claude/hooks/run-all-checks.sh` 전체 통과
