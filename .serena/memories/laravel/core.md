# Laravel Core — 백엔드 모듈

> 상세 내용은 `laravel/AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## 주요 패턴

- **동기 HTTP 처리**: 번역/임베딩은 비동기 Job이 아닌 동기 HTTP 컨트롤러에서 step 단위 처리
- **OllamaClient `retryCall()`**: HTTP 429/5xx·연결 타임아웃 시 지수 백오프(1s→2s→4s)+지터로 최대 `http_max_attempts`(기본 3)회 재시도. 4xx 클라이언트 에러는 재시도 제외. `chat()`·`embed()` 모두 적용.
- **OllamaTranslator 환각 재시도**: `translateSingle()`에서 최대 `translation_max_attempts`(기본 3)회, 각 시도 간 500ms `usleep` 지연.
- **`PUT /api/categories/{id}/update-text`**: 텍스트 업데이트 후 해당 언어의 CategoryEmbedding 삭제
- **`category_code`**: `(category_code, user_id, folder)` 복합 unique. `filled()`로 체크 (`??`는 빈 문자열 통과). `CategoryStoreRequest`·`CategoryUpdateTextRequest` 모두 folder scope 포함 필수.
- **admin 대리 생성**: `CategoryController::store()`에서 `isAdmin() && filled('user_id')`일 때 요청 body의 `user_id`를 소유자로 사용. `CategoryStoreRequest` unique 검증도 `targetUserId` 기준. 프론트에서 `selectedUserId` → API body `user_id` 전파 필요.
- **`RecommendRequest` filter**: `in:my,all` — `"all"`도 허용 (프론트에서 "전체" 선택 + 유사도검색 시 `filter=all` 전송)
- **API 인증**: 세션 미들웨어 없음, `$request->user('sanctum')` 또는 `auth('sanctum')->user()` 사용
- **외부 API key 인증**: `ApiKeyAuth` 미들웨어 — Bearer `cl_xxx` → `ApiKeyService::findByKey()` → status/pause/quota 체크 → request merge. `ApiRateLimit` — `RateLimiter::for()` 분당 제한(Redis). 미들웨어 체인: `api.rate_limit` → `api.key_auth`.
- **`POST /api/v1/search`**: 외부 유사도 검색. `filter` 내부 `'my'` 고정. quota 감소 `DB::table()->decrement()`. `ApiKeyService::touchLastUsed()`. `RecommendService::recommendPaginated()`의 `searchLang` 파라미터로 언어별 접두사/부분 검색 분기.
- **`POST /api/recommend` quota**: 로그인 사용자 + `text` 있을 때 `api_quota_remaining` 1 차감. 관리자 우회, 비로그인 체크 없음. quota 0 → 429. `text` 없이 목록 조회만 할 때는 차감 없음.
- **관리자 설정 `api` 그룹**: `AdminSettingsController::GROUPS`에 `'api'` 포함. `api.free_quota`(기본 500, 영구 총량 — 일일 리셋 없음), `api.rate_limit_per_minute`(기본 60)을 admin 페이지에서 수정 가능.
- **마이페이지 API**: `/api/mypage/` prefix, `auth:sanctum`. API key CRUD + 사용량 통계(총/오늘 호출, key별, 일별 차트). **API key 이름 중복 금지**: `Rule::unique('api_keys', 'name')->where('user_id', $userId)` (store), `->ignore($this->route('id'))` (update). DB `(user_id, name)` unique index로 방어.
- **관리자 회원 관리**: `GET /api/admin/users/{id}`(상세+사용량), `PATCH /api/admin/users/{id}/quota`(absolute/increment). `QuotaAdjustRequest`에서 `isSuperAdmin()` 검증. **`value` 유효성**: `absolute`→`min:0`, `increment`→음수 허용. 커스텀 클로저로 조건부 검증. `adjustQuota()`에서 `max(0, newValue)` 보장. **⚠️ 응답 구조**: 평탄 구조(`{ data: { id, name, ..., total_calls, ... } }`), 중첩 아님.
- **OAuth**: 라우트는 `routes/web.php`, callback은 `RedirectResponse`, provider_token DB 저장 금지
- **PHP 8 속성(Attribute)**: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`, `#[Hidden([...])]`
- **`#[Hidden]` 필드 + accessor 패턴**: 보안 필드(키, 비밀번호 등)를 `#[Hidden]`로 제외하되, `$appends` + `Attribute` accessor로 표시용 미리보기 제공. 예: `ApiKey`의 `#[Hidden(['key'])]` + `key_preview` accessor. **생성 시점에만 평문 노출**: 컨트롤러 store 메서드에서 `$model->makeVisible('key')` 호출.
- **API 리소스**: `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}` 래퍼 자동 적용. Resource collection 항목은 객체여야 함.
- **`boolean` 유효성 검증**: `"true"`/`"false"` 문자열 불허 (true, false, 1, 0, "1", "0"만 허용). 쿼리 파라미터로 전달 시 `"1"`/`"0"` 사용.
- **폴더는 `folders` 테이블로 독립 관리** — `user_id` + `name` unique. `categories.folder`는 문자열 참조로 유지. FolderController는 `Folder` 모델 사용.
- **폴더 이동 중복 처리**: `moveFolder()`는 타겟 폴더의 **모든** `(category_code, user_id)`를 사전 조회(`whereNotIn` 사용 금지 — 이미 타겟에 있는 레코드 누락 시 unique constraint 위반). `$conflictKeys` 맵을 배치 처리 중에도 갱신하여 같은 `(category_code, user_id)`가 배치에 여러 개 있어도 첫 번째만 이동하고 나머지 스킵. 응답은 `{ moved, failed, message }` 통계 형식. **소유권 변경**: 관리자가 `target_user_id` 지정 시 `folder` + `user_id` 동시 업데이트. 중복 체크도 새 `user_id` 기준.
- **폴더 삭제 중복 체크**: `destroy()`에서 `move_to_default=true`일 때 기본폴더(`folder IS NULL`)에 동일 `(category_code, user_id)`가 있는지 사전 확인. 중복 발견 시 409 + `{duplicate_count, duplicate_codes}` 반환으로 폴더 삭제 거부. `hasCategories()` API도 `duplicate_count`/`duplicate_codes` 필드를 반환하도록 확장되어 프론트 모달에서 선제 차단.
- **`기본폴더` → NULL defense in depth**: `store()`·`moveFolder()`에서 `$request->input('folder') === '기본폴더'` → `null` 변환. 프론트엔드 누락 시에도 DB 일관성 보장.
- **`CategoryController::index()` `steps` 필터**: `steps[]=embedding.ko` 쿼리 파라미터 지원. `batchStatus`의 `determineMissingSteps`와 동일 로직을 `whereDoesntHave` + OR 조건으로 SQL WHERE에 적용. `steps` 미전달 시 기존 동작. 프론트 `TaskExecution` 체크박스 토글 → `onStepsChange` → `loadCategories`로 호출.
- **`search` 파라미터 다국어 검색**: `GET /api/categories?search=...`는 `category_name_ko`·`category_name_en`·`category_name_zh`·`category_code` 네 필드를 LIKE 검색. 분류선택에서 영어/중국어 카테고리명 선택 시에도 매칭. `batchStatus()`도 동일 로직.

## 테스트 환경

- 실제 PostgreSQL (`cl_embed_test`, `pgvector_03` 컨테이너). `RefreshDatabase` 자동 적용.
- `.env.testing` — gitignore, `DB_DATABASE=cl_embed_test`. 별도 사용자 `dbeaver_lim_test`.
- **`bootstrap/cache/config.php` 오염**: `php artisan test` 전 `php artisan config:clear` 필수

## PostgreSQL·pgvector

- **pgvector raw SQL**: `::vector` 명시적 캐스트 필수 (PDO는 text로 바인딩). `array_fill` 금지 (collinear 벡터).
- **RANK() + LEFT JOIN 함정**: LEFT JOIN 결과가 NULL이어도 RANK()는 전체 결과셋에서 순위 반환. Service에서 `distance` null이면 `rank`도 null로 명시적 처리.
- **임베딩 존재 여부 조회 시 벡터 데이터 제외** — `CategoryEmbedding` 조회 시 `->select('category_id', 'language')`로 필요한 컬럼만 가져오고 `embedding`(vector) 컬럼은 제외. 5k+ 카테고리 기준 `->with('embeddings')` 이저 로딩은 208MB 메모리 사용하나, 경량 쿼리는 수 MB 이내. `whereNotNull('embedding')`으로 null 체크는 유지.
- **FK cascade → set null 전환**: `api_usage_logs.api_key_id`는 `onDelete('cascade')`가 기본값이었으나 키 삭제 시 사용 로그 보존을 위해 `onDelete('set null')`로 변경됨. `dropForeign` → `nullable()->change()` → `constrained()->onDelete('set null')` 패턴 사용.
