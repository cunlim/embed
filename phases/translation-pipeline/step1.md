# Step 1: batch-pipeline

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" 섹션 — 비동기 파이프라인)
- `/docs/ADR.md` (ADR-002: Queue + Reverb)
- `/laravel/CLAUDE.md`
- `/laravel/app/Jobs/TranslateAndEmbedJob.php` (이전 step에서 생성됨)
- `/laravel/app/Models/Category.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

전체 카테고리를 일괄 처리하는 Batch Pipeline을 생성하라.

### BatchTranslatePipeline (`app/Jobs/BatchTranslatePipeline.php`)

ADR-002에 따라 `Bus::batch()`를 사용하여 모든 카테고리에 대한 번역/임베딩 Job을 일괄 dispatch한다. **번역은 언어별로 직렬 실행**되므로, 하나의 Pipeline은 하나의 언어만 처리한다. 여러 언어를 처리하려면 언어별로 Batch를 각각 dispatch해야 한다.

시그니처:
```php
namespace App\Jobs;

class BatchTranslatePipeline implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private string $targetLanguage, // 'ko' | 'zh' | 'en' — 단일 언어
        private ?array $categoryIds = null, // null이면 전체 카테고리
    ) {}

    public function handle(): void;
}
```

핵심 규칙:
1. `$categoryIds`가 null이면 모든 Category를 대상으로 한다.
2. 각 Category에 대해 `TranslateAndEmbedJob`을 생성하여 `Bus::batch()`로 묶는다.
3. **대량 데이터 주의**: 카테고리가 100건을 초과하면 `array_chunk($categories, 100)`으로 분할하여 여러 Batch로 나누어 dispatch하라. 이유: PRD §1.3의 1만 건 이상 처리 시 OOM 방지.
4. Batch에 `then()` 콜백: 완료 시 `BatchCompleted` 이벤트 dispatch
5. Batch에 `catch()` 콜백: 실패 시 `BatchFailed` 이벤트 dispatch
6. Batch에 `allowFailures()` 설정 — 개별 Job 실패가 전체 Batch에 영향을 주지 않도록 (ADR-003: failed_jobs로 이관)
7. Batch name 설정 → `"translate-embed-{언어}"`

## 생성할 파일

- `laravel/app/Jobs/BatchTranslatePipeline.php`

## Acceptance Criteria

```bash
# Batch Job 생성 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(new App\Jobs\BatchTranslatePipeline("zh"));
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/translation-pipeline/index.json`의 해당 step을 업데이트한다.

## 금지사항

- `Bus::batch()` 대신 개별 dispatch를 루프로 돌리지 마라. 이유: ADR-002가 명시적으로 batch 사용을 결정했다.
- batch name에 한글을 사용하지 마라. 식별자는 영어로.
- 기존 테스트를 깨뜨리지 마라
