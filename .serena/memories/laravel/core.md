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
- **OAuth**: 라우트는 `routes/web.php`, callback은 `RedirectResponse`, provider_token DB 저장 금지
- **PHP 8 속성(Attribute)**: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`, `#[Hidden([...])]`
- **API 리소스**: `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}` 래퍼 자동 적용. Resource collection 항목은 객체여야 함.
- **`boolean` 유효성 검증**: `"true"`/`"false"` 문자열 불허 (true, false, 1, 0, "1", "0"만 허용). 쿼리 파라미터로 전달 시 `"1"`/`"0"` 사용.
- **폴더는 `folders` 테이블로 독립 관리** — `user_id` + `name` unique. `categories.folder`는 문자열 참조로 유지. FolderController는 `Folder` 모델 사용.
- **폴더 이동 중복 처리**: `moveFolder()`는 타겟 폴더의 **모든** `(category_code, user_id)`를 사전 조회(`whereNotIn` 사용 금지 — 이미 타겟에 있는 레코드 누락 시 unique constraint 위반). `$conflictKeys` 맵을 배치 처리 중에도 갱신하여 같은 `(category_code, user_id)`가 배치에 여러 개 있어도 첫 번째만 이동하고 나머지 스킵. 응답은 `{ moved, failed, message }` 통계 형식. **소유권 변경**: 관리자가 `target_user_id` 지정 시 `folder` + `user_id` 동시 업데이트. 중복 체크도 새 `user_id` 기준.
- **폴더 삭제 중복 체크**: `destroy()`에서 `move_to_default=true`일 때 기본폴더(`folder IS NULL`)에 동일 `(category_code, user_id)`가 있는지 사전 확인. 중복 발견 시 409 + `{duplicate_count, duplicate_codes}` 반환으로 폴더 삭제 거부. `hasCategories()` API도 `duplicate_count`/`duplicate_codes` 필드를 반환하도록 확장되어 프론트 모달에서 선제 차단.
- **`기본폴더` → NULL defense in depth**: `store()`·`moveFolder()`에서 `$request->input('folder') === '기본폴더'` → `null` 변환. 프론트엔드 누락 시에도 DB 일관성 보장.

## 테스트 환경

- 실제 PostgreSQL (`cl_embed_test`, `pgvector_03` 컨테이너). `RefreshDatabase` 자동 적용.
- `.env.testing` — gitignore, `DB_DATABASE=cl_embed_test`. 별도 사용자 `dbeaver_lim_test`.
- **`bootstrap/cache/config.php` 오염**: `php artisan test` 전 `php artisan config:clear` 필수

## PostgreSQL·pgvector

- **pgvector raw SQL**: `::vector` 명시적 캐스트 필수 (PDO는 text로 바인딩). `array_fill` 금지 (collinear 벡터).
- **RANK() + LEFT JOIN 함정**: LEFT JOIN 결과가 NULL이어도 RANK()는 전체 결과셋에서 순위 반환. Service에서 `distance` null이면 `rank`도 null로 명시적 처리.
- **임베딩 존재 여부 조회 시 벡터 데이터 제외** — `CategoryEmbedding` 조회 시 `->select('category_id', 'language')`로 필요한 컬럼만 가져오고 `embedding`(vector) 컬럼은 제외. 5k+ 카테고리 기준 `->with('embeddings')` 이저 로딩은 208MB 메모리 사용하나, 경량 쿼리는 수 MB 이내. `whereNotNull('embedding')`으로 null 체크는 유지.
