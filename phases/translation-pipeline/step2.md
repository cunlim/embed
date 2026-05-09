# Step 2: websocket-events

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" 5~6단계: Reverb WebSocket)
- `/docs/ADR.md` (ADR-002: Reverb)
- `/laravel/CLAUDE.md`
- `/laravel/config/reverb.php` (Reverb 설정)
- `/laravel/config/broadcasting.php` (브로드캐스팅 드라이버 설정)
- `/laravel/app/Jobs/BatchTranslatePipeline.php` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

번역 진행률을 프론트엔드에 실시간 전달하기 위한 WebSocket 이벤트를 구성하라.

### TranslationProgress 이벤트 (`app/Events/TranslationProgress.php`)

시그니처:
```php
namespace App\Events;

class TranslationProgress implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $batchId,
        public int $totalJobs,
        public int $completedJobs,
        public int $failedJobs,
        public string $status, // 'processing' | 'completed' | 'failed'
    ) {}

    public function broadcastOn(): Channel;
    public function broadcastAs(): string;
}
```

핵심 규칙:
- `broadcastOn()` — `new Channel('translation.{batchId}')` 반환
- `broadcastAs()` — `'translation.progress'` 반환
- `ShouldBroadcast` 인터페이스 구현

### 이벤트 발행 위치 수정

`BatchTranslatePipeline`의 `handle()` 메서드에서 batch 진행 상황을 추적하고, 주기적으로 `TranslationProgress` 이벤트를 broadcast하도록 수정하라.

### BatchCompleted / BatchFailed 이벤트 (`app/Events/BatchCompleted.php`, `app/Events/BatchFailed.php`)

Batch 완료/실패 시 broadcast하는 이벤트. 위와 동일한 패턴으로 생성하라.

## 생성할 파일

- `laravel/app/Events/TranslationProgress.php`
- `laravel/app/Events/BatchCompleted.php`
- `laravel/app/Events/BatchFailed.php`
- `laravel/app/Jobs/BatchTranslatePipeline.php` (수정 — 이벤트 dispatch 추가)

## Acceptance Criteria

```bash
# 이벤트 클래스 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(new App\Events\TranslationProgress("batch-1", 10, 0, 0, "processing"));
  echo "\n";
  echo get_class(new App\Events\BatchCompleted("batch-1"));
  echo "\n";
  echo get_class(new App\Events\BatchFailed("batch-1", "test error"));
'

# Reverb 설정 확인
docker exec cl_embed_laravel php artisan reverb:start --help

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

- Private Channel을 사용하지 마라. 인증이 아직 구현되지 않았다. Public Channel을 사용하라.
- `broadcastOn()`에서 Channel name에 하이픈 대신 닷(.)을 구분자로 사용하라. 이유: Laravel Echo와의 호환성.
- 기존 테스트를 깨뜨리지 마라
