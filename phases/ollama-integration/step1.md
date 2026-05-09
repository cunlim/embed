# Step 1: translation-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" 섹션)
- `/docs/ADR.md` (특히 ADR-003: 분할 캐싱, 환각 방어)
- `/laravel/CLAUDE.md`
- `/laravel/app/Services/OllamaClient.php` (이전 step에서 생성됨)
- `/laravel/app/Models/TranslationCache.php` (이전 task에서 생성됨)
- `/laravel/database/migrations/2026_05_07_000002_create_translation_cache_table.php`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

텍스트 분할 및 번역 서비스를 생성하라.

### TextSplitter (`app/Services/TextSplitter.php`)

카테고리 계층 텍스트를 `>` 구분자로 분할하고 번역 후 재조립하는 유틸리티.

시그니처:
```php
namespace App\Services;

class TextSplitter
{
    public function split(string $text): array;           // "대>중>소" → ["대", "중", "소"]
    public function join(array $segments): string;        // ["大", "中", "小"] → "大>中>小"
    public function shouldSplit(string $text): bool;      // ">" 포함 시 true
}
```

### OllamaTranslator (`app/Services/OllamaTranslator.php`)

OllamaClient를 사용하여 텍스트를 번역하는 서비스. ADR-003의 환각 방어 전략을 구현한다.

시그니처:
```php
namespace App\Services;

class OllamaTranslator
{
    public function __construct(private OllamaClient $ollama, private TranslationCache $cache) {}

    public function translate(string $sourceText, string $targetLang): string;
}
```

핵심 규칙 (ADR-003 준수):
1. **캐시 우선**: `translation_cache` 테이블에서 `(source_text, target_lang)` 조회. 히트 시 즉시 반환.
2. **분할 번역**: `TextSplitter::shouldSplit()` → `>` 있으면 분할, 각 세그먼트별로 번역 후 `TextSplitter::join()`.
3. **환각 검증**: 번역 결과에 대해 정규식 검증을 수행하라:
   - 번역된 텍스트에 한자 외 비대상 문자가 포함되었는지 검사 (예: en 타겟에 한자가 포함되면 환각)
   - 입력 텍스트와 동일한 언어의 문자가 결과에 포함되면 환각으로 간주
4. **최대 3회 재시도**: 환각 발생 시 `attempts` 카운터를 증가시키며 재시도. 3회 실패 시 `RuntimeException` throw.
5. **캐시 저장**: 성공한 번역 결과를 `translation_cache`에 저장.

### 번역 프롬프트

Ollama에 보낼 프롬프트 형식:
```
Translate the following Korean text to {target_language}. Return ONLY the translated text, nothing else.

Text: {source_text}
```

target_language는 `zh`(중국어), `en`(영어) 중 하나.

## 생성할 파일

- `laravel/app/Services/TextSplitter.php`
- `laravel/app/Services/OllamaTranslator.php`

## Acceptance Criteria

```bash
# TextSplitter 유닛 테스트
docker exec cl_embed_laravel php artisan tinker --execute '
  $s = new App\Services\TextSplitter;
  echo json_encode($s->split("디지털/가전>노트북>게이밍")) . "\n";
  echo $s->join(["Digital/Electronics", "Laptop", "Gaming"]) . "\n";
  echo $s->shouldSplit("디지털/가전>노트북") ? "true" : "false";
'

# 클래스가 자동으로 resolve되는지 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Services\OllamaTranslator::class));
'

# PHP 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 전체 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
3. 결과에 따라 `phases/ollama-integration/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 환각 검증 정규식을 너무 느슨하게 하지 마라. ADR-003에 명시된 대로 "번역 결과가 원본 언어와 같은 문자체계를 포함하면 안 된다".
- 실제 Ollama 호출이 필요한 테스트를 작성하지 마라. 이 step에서는 클래스 구조와 로직만 구현한다.
- 기존 테스트를 깨뜨리지 마라
