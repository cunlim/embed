# Laravel Core — 백엔드 모듈

> 상세 내용은 `laravel/AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## 주요 패턴

- **동기 HTTP 처리**: 번역/임베딩은 비동기 Job이 아닌 동기 HTTP 컨트롤러에서 step 단위 처리
- **`PUT /api/categories/{id}/update-text`**: 텍스트 업데이트 후 해당 언어의 CategoryEmbedding 삭제
- **`category_code`**: `(category_code, user_id)` 복합 unique. `filled()`로 체크 (`??`는 빈 문자열 통과)
- **API 인증**: 세션 미들웨어 없음, `$request->user('sanctum')` 또는 `auth('sanctum')->user()` 사용
- **OAuth**: 라우트는 `routes/web.php`, callback은 `RedirectResponse`, provider_token DB 저장 금지
- **PHP 8 속성(Attribute)**: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`, `#[Hidden([...])]`
- **API 리소스**: `Resource::collection()`은 `{data: [...]}`, 단일은 `{data: {...}}` 래퍼 자동 적용. Resource collection 항목은 객체여야 함 (연관 배열 전달 시 에러).

## 테스트 환경

- 실제 PostgreSQL (`cl_embed_test`, `pgvector_03` 컨테이너). `RefreshDatabase` 자동 적용.
- `.env.testing` — gitignore, `DB_DATABASE=cl_embed_test`. 별도 사용자 `dbeaver_lim_test`.
- **`bootstrap/cache/config.php` 오염**: `php artisan test` 전 `php artisan config:clear` 필수

## PostgreSQL·pgvector

- **pgvector raw SQL**: `::vector` 명시적 캐스트 필수 (PDO는 text로 바인딩). `array_fill` 금지 (collinear 벡터).
- **RANK() + LEFT JOIN 함정**: LEFT JOIN 결과가 NULL이어도 RANK()는 전체 결과셋에서 순위 반환. Service에서 `distance` null이면 `rank`도 null로 명시적 처리.
- **DB 포맷은 실제 데이터로 확인**: LIKE 쿼리 전 `psql`로 프로덕션 DB 조회. `category_name_ko` 구분자는 `>` (공백 없음).
