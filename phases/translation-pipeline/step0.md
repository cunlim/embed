# Step 0: translate-embed-job

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" 섹션)
- `/docs/ADR.md` (ADR-002: Queue + Redis, ADR-003: 번역/임베딩)
- `/laravel/CLAUDE.md`
- `/laravel/app/Services/OllamaTranslator.php` (이전 task에서 생성됨)
- `/laravel/app/Services/EmbeddingGenerator.php` (이전 task에서 생성됨)
- `/laravel/app/Models/Category.php`
- `/laravel/app/Models/CategoryEmbedding.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

단일 카테고리에 대해 번역 및 임베딩을 수행하는 Queue Job을 생성하라.

### TranslateAndEmbedJob (`app/Jobs/TranslateAndEmbedJob.php`)

단일 카테고리 ID를 받아 지정된 언어로 번역하고 임베딩을 생성하여 저장한다.

시그니처:
```php
namespace App\Jobs;

class TranslateAndEmbedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private int $categoryId,
        private array $targetLanguages, // ['zh', 'en']
    ) {}

    public function handle(
        OllamaTranslator $translator,
        EmbeddingGenerator $embedder
    ): void;
}
```

핵심 규칙:
1. `handle()` 메서드에서 Category 모델을 조회한다.
2. `category_name_ko`를 `$targetLanguages` 각각에 대해 `translator->translate()` 호출.
3. 번역 결과를 Category 모델의 `category_name_zh` / `category_name_en`에 저장.
4. 각 언어별로 `embedder->generate()` 호출하여 768차원 벡터 생성.
5. 생성된 임베딩을 `CategoryEmbedding` 모델에 `language` + `embed_model_name`(`nomic-embed-text`)과 함께 저장.
6. 동일 `(category_id, language, embed_model_name)` 조합이 이미 존재하면 업데이트 (`updateOrCreate`).
7. 실패 시 `$this->fail($exception)` 호출 — Laravel Queue가 자동으로 `failed_jobs`에 기록.

## 생성할 파일

- `laravel/app/Jobs/TranslateAndEmbedJob.php`

## Acceptance Criteria

```bash
# Job 생성 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(new App\Jobs\TranslateAndEmbedJob(1, ["zh", "en"]));
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

- Job에서 HTTP 호출을 직접 하지 마라. OllamaTranslator와 EmbeddingGenerator를 DI로 주입받아 사용하라.
- `$timeout`과 `$tries` 프로퍼티를 설정하지 않은 채로 두지 마라. 이유: Ollama는 응답이 느릴 수 있으므로 timeout=300, tries=3으로 설정하라.
- 기존 테스트를 깨뜨리지 마라
