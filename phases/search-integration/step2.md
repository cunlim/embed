# Step 2: e2e-integration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 전체 시스템을 파악하라:

- `/docs/ARCHITECTURE.md` (전체)
- `/docs/PRD.md` (전체 — 특히 §1.3 성공 지표)
- `/docs/ADR.md` (전체)
- `/laravel/CLAUDE.md`
- `/laravel/app/Http/Controllers/Api/RecommendController.php`
- `/laravel/app/Http/Controllers/Api/CategoryController.php`
- `/laravel/app/Jobs/BatchTranslatePipeline.php`
- `/laravel/app/Jobs/TranslateAndEmbedJob.php`
- `/laravel/app/Services/OllamaClient.php`
- `/laravel/app/Services/OllamaTranslator.php`
- `/laravel/app/Services/EmbeddingGenerator.php`
- `/laravel/app/Services/EmbeddingCacheService.php`
- `/laravel/routes/api.php`
- `/laravel/tests/` (모든 기존 테스트)
- `/nextjs/CLAUDE.md`
- `/nextjs/app/` (모든 페이지)

이전 step에서 만들어진 모든 코드를 꼼꼼히 읽고, 전체 시스템을 이해한 뒤 작업하라.

## 작업

E2E 통합 테스트를 작성하고, 전체 파이프라인이 PRD 성능 목표를 충족하도록 최종 검증하라.

### Feature Tests (Laravel Pest)

`tests/Feature/RecommendationTest.php`:
```php
// 추천 API E2E 테스트
test('POST /api/recommend — 유효한 검색어로 추천 결과 반환');
test('POST /api/recommend — 빈 검색어 422 에러');
test('POST /api/recommend — 지원하지 않는 언어 422 에러');
```

`tests/Feature/CategoryApiTest.php`:
```php
// 카테고리 API 테스트
test('GET /api/categories — 카테고리 목록 반환');
test('POST /api/categories — 인증 없이 401');
test('POST /api/categories/batch-translate — 인증 없이 401');
```

`tests/Feature/BatchTranslateTest.php`:
```php
// 일괄 번역 파이프라인 테스트 (언어별 직렬)
test('BatchTranslatePipeline — 단일 언어 Job dispatch 성공');
test('중복 BatchTranslatePipeline — 동일 언어 Lock으로 차단');
```

`tests/Feature/TranslationTest.php`:
```php
// 번역 서비스 통합 테스트
test('OllamaTranslator — 캐시 히트');
test('TextSplitter — > 구분자 분할 및 재조립');
test('TextSplitter — 단일 텍스트 분할 없음');
```

### 아키텍처 테스트

`tests/Feature/ArchitectureTest.php`:
```php
test('모든 Job은 ShouldQueue 구현');
test('모든 Event는 ShouldBroadcast 구현');
test('모든 Controller 메서드는 FormRequest 사용');
```

### 통합 검증

1. 전체 테스트 스위트 통과 확인
2. 모든 API 라우트가 정상 등록되었는지 확인
3. Reverb 설정이 올바른지 확인
4. 마이그레이션 fresh + seed 정상 동작 확인

### 버그 수정

이전 step들에서 발견된 문제가 있으면 수정하라. 특히:
- DI 바인딩 누락
- 라우트 등록 누락
- 인터페이스 불일치

## 생성할 파일

- `laravel/tests/Feature/RecommendationTest.php`
- `laravel/tests/Feature/CategoryApiTest.php`
- `laravel/tests/Feature/BatchTranslateTest.php`
- `laravel/tests/Feature/TranslationTest.php`
- `laravel/tests/Feature/ArchitectureTest.php`

## Acceptance Criteria

```bash
# 전체 테스트 스위트
docker exec cl_embed_laravel php artisan test --compact

# 라우트 확인 (모든 API 라우트 등록 확인)
docker exec cl_embed_laravel php artisan route:list

# 마이그레이션 테스트
docker exec cl_embed_laravel php artisan migrate:fresh --seed

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# Next.js 빌드 (프론트엔드 통합 확인)
docker exec cl_embed_nextjs npm run build
```

## 검증 절차

1. 위 AC 커맨드를 모두 실행한다.
2. 모든 테스트가 통과하는지 확인한다.
3. 빌드가 성공하는지 확인한다.
4. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
5. 결과에 따라 `phases/search-integration/index.json`의 해당 step을 업데이트한다.
   - 모든 테스트 통과 → `"status": "completed"`, `"summary": "E2E 통합 완료, 전체 API 파이프라인 검증"`
   - 실패한 테스트가 있으면 이전 step들도 확인하여 수정

## 금지사항

- E2E 테스트에서 실제 Ollama 호출을 수행하지 마라. `OllamaClient`를 mock하라. 이유: CI 환경에서 Ollama가 실행되지 않을 수 있다.
- `RefreshDatabase` 트레이트를 사용하는 테스트에서 `DatabaseMigrations`와 혼용하지 마라.
- 기존 테스트를 깨뜨리지 마라
