# Step 2: embedding-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 ADR-003: bge-m3:567m)
- `/laravel/CLAUDE.md`
- `/laravel/app/Services/OllamaClient.php` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

텍스트 임베딩 생성 서비스를 생성하라.

### EmbeddingGenerator (`app/Services/EmbeddingGenerator.php`)

OllamaClient의 `/api/embed` 엔드포인트를 사용하여 텍스트를 1024차원 벡터로 변환하는 서비스.

시그니처:
```php
namespace App\Services;

class EmbeddingGenerator
{
    public function __construct(private OllamaClient $ollama) {}

    public function generate(string $text): array; // float[] 길이 1024
}
```

핵심 규칙:
- `embed` 메서드는 `bge-m3:567m` 모델을 사용한다 (ADR-003).
- 반환 타입은 `float[]` — 1024차원 벡터 배열.
- OllamaClient가 throw하는 모든 예외를 그대로 전파한다 (catch하지 않는다).

## 생성할 파일

- `laravel/app/Services/EmbeddingGenerator.php`

## Acceptance Criteria

```bash
# 서비스 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(app(App\Services\EmbeddingGenerator::class));
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

- 실제 Ollama 호출 테스트를 작성하지 마라. 서비스 클래스 구조만 구현한다.
- EmbeddingGenerator에서 번역 관련 로직을 수행하지 마라. 단일 책임이다.
- 기존 테스트를 깨뜨리지 마라
