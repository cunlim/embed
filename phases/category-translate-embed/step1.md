# Step 1: 5단계 Sequential Job Chain + WebSocket 이벤트

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "개별 카테고리 처리 (Per-Category)" 데이터 흐름 절
- `/docs/ADR.md` — ADR-002 (Queue + Reverb), ADR-003 (번역/임베딩 모델)
- `/laravel/app/Jobs/TranslateAndEmbedJob.php` — 기존 job 패턴 (번역+임베딩 결합 단위)
- `/laravel/app/Jobs/BatchTranslatePipeline.php` — 기존 batch pipeline 패턴 (lock, 이벤트 dispatch)
- `/laravel/app/Events/TranslationProgress.php` — 기존 이벤트 패턴 참고
- `/laravel/app/Events/BatchCompleted.php` — 기존 완료 이벤트 패턴 참고
- `/laravel/app/Http/Controllers/Api/CategoryController.php` — Step 0에서 생성된 `translateEmbed()` 메서드

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

### 1. `CategoryProgress` 이벤트 생성

`laravel/app/Events/CategoryProgress.php` — `ShouldBroadcast` 구현.

```php
// 채널: category.{categoryId}
// 이벤트명 (broadcastAs): "category.progress"
// public 프로퍼티:
//   string $categoryId
//   int $step          // 1~5
//   string $stepName   // "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en"
//   string $status     // "pending" | "running" | "completed" | "failed"
//   string|null $error // 실패 시 에러 메시지
```

### 2. `CategoryPipelineCompleted` 이벤트 생성

`laravel/app/Events/CategoryPipelineCompleted.php` — `ShouldBroadcast` 구현.

```php
// 채널: category.{categoryId}
// 이벤트명 (broadcastAs): "category.completed"
// public 프로퍼티:
//   string $categoryId
//   bool $allSuccess   // 5단계 모두 성공 여부
//   int $failedStep    // 실패한 단계 번호 (모두 성공 시 0)
```

### 3. `CategoryTranslateEmbedPipeline` Job 생성

`laravel/app/Jobs/CategoryTranslateEmbedPipeline.php` — `ShouldQueue` 구현.

```php
class CategoryTranslateEmbedPipeline implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $categoryId,
    ) {}
}
```

**`handle()` 메서드 동작:**

1. **중복 실행 방지**: Redis `Cache::lock("category-translate:{categoryId}", 10)` 획득 시도. 획득 실패 시 return (이미 실행 중).

2. **5단계 순차 실행** (순서를 지킬 것):
   | Step | stepName | 작업 |
   |------|----------|------|
   | 1 | `translation.zh` | 한국어 원문 → 중국어 번역 (Ollama `translategemma:4b`) 후 `category_name_zh` 저장 |
   | 2 | `translation.en` | 한국어 원문 → 영어 번역 (Ollama `translategemma:4b`) 후 `category_name_en` 저장 |
   | 3 | `embedding.ko` | 한국어 원문 벡터화 (`bge-m3:latest`, 1024차원) 후 `category_embeddings` 저장 |
   | 4 | `embedding.zh` | 1단계 번역 결과 벡터화 후 `category_embeddings` 저장 |
   | 5 | `embedding.en` | 2단계 번역 결과 벡터화 후 `category_embeddings` 저장 |

3. **각 단계 시작 전**: `CategoryProgress(status: "running", ...)` 이벤트 broadcast.

4. **각 단계 완료 후**: `CategoryProgress(status: "completed", ...)` 이벤트 broadcast.

5. **단계 실패 시**: `CategoryProgress(status: "failed", error: $e->getMessage(), ...)` 이벤트 broadcast → 이후 단계 건너뛰고 6번으로 이동.

6. **모든 단계 종료 후**: `CategoryPipelineCompleted` 이벤트 broadcast → `Cache::lock()` release.

**핵심 규칙:**
- **기존 `TranslateAndEmbedJob`을 재사용하라.** 개별 단계의 번역/임베딩 로직은 이미 `TranslateAndEmbedJob::handle()`에 구현되어 있다. `CategoryTranslateEmbedPipeline`은 `TranslateAndEmbedJob`을 `dispatch_sync()`로 호출하는 얇은 오케스트레이터여야 한다. 중복 구현 금지.
  - 단, `TranslateAndEmbedJob`에 `$tries` 등 재시도 설정이 있으므로 `dispatch_sync` 대신 `Bus::chain()`을 고려하라. 또는 실행 방식을 적절히 판단하라.
- **OllamaTranslator**, **EmbeddingGenerator** 서비스를 직접 호출하지 마라. `TranslateAndEmbedJob`만 사용하라.
- 번역 단계(1, 2)가 실패하면 이후 임베딩 단계도 건너뛴다. 예: zh 번역 실패 → zh 임베딩(단계4)도 "skipped" 처리.
- `Cache::lock()`은 단일 카테고리 동시 실행 방지용이다. TTL은 작업 예상 시간(최대 5분)을 감안해 600초로 설정하라.
- 예외 메시지에서 민감 정보(API 키 등)는 제외하라.

### 4. `CategoryController::translateEmbed()` 완성

Step 0에서 생성된 컨트롤러 메서드에서 `// TODO` 주석을 제거하고 실제 Job dispatch 코드를 작성한다.

```php
CategoryTranslateEmbedPipeline::dispatch($category->id);
```

`dispatch()`만 호출하고, 응답 본문에 `category_id`와 `message`를 포함한다.

### 5. 이벤트 테스트 작성

- `tests/Feature/Events/CategoryProgressTest.php`
- `tests/Feature/Events/CategoryPipelineCompletedTest.php`

기존 `tests/Feature/Events/TranslationProgressTest.php`, `tests/Feature/Events/BatchCompletedTest.php` 패턴을 참고하라.
ShouldBroadcast 이벤트 최소 검증 항목:
- `broadcastOn()` 반환 채널
- `broadcastAs()` 이벤트명
- 모든 public 프로퍼티 값

### 6. Job 테스트 작성

`tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php`

- **의존성 mock**: `Bus::fake()`, `Event::fake()` 사용
- `Cache::lock()` 획득/미획득 시나리오
- 5단계 순서 검증 (Bus chain 호출 검증)
- 실패 단계 이후 건너뛰기 검증

기존 `tests/Feature/Jobs/BatchTranslatePipelineTest.php` 패턴을 참고하라.

## Acceptance Criteria

```bash
# 전체 테스트 (Pest)
docker exec cl_embed_laravel php artisan test --compact

# PHP 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. **0 failure**여야 한다.
2. 아키텍처 체크리스트를 확인한다:
   - 5단계 순서가 ARCHITECTURE.md "개별 카테고리 처리" 명세와 일치하는가?
   - WebSocket 이벤트 채널명이 `category.{categoryId}` 인가?
   - 기존 `TranslateAndEmbedJob`을 재사용하고 중복 구현하지 않았는가?
   - ADR-003의 환각 검증 로직을 우회하지 않았는가?
3. 결과에 따라 `phases/category-translate-embed/index.json`의 step 1을 업데이트한다.

## 금지사항

- 기존 `TranslateAndEmbedJob`의 번역/임베딩 로직을 복제하지 마라. 무조건 기존 Job을 재사용하라.
- `OllamaTranslator`, `EmbeddingGenerator`, `OllamaClient`를 직접 호출하지 마라.
- 기존 `BatchTranslatePipeline`을 수정하지 마라.
- `Bus::chain()` 사용 시 `allowFailures()`를 사용하지 마라. 단계 간 의존성이 있으므로 실패 시 중단되어야 한다.
- 기존 테스트를 깨뜨리지 마라
