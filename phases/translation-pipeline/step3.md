# Step 3: concurrency-lock

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "동시성 상태" 섹션)
- `/docs/PRD.md` (특히 §3.3: 중복 검증)
- `/docs/ADR.md` (ADR-002)
- `/laravel/CLAUDE.md`
- `/laravel/config/cache.php` (Redis 캐시 설정 확인)
- `/laravel/app/Jobs/BatchTranslatePipeline.php` (이전 step들에서 생성 및 수정됨 — 특히 step2에서 추가한 이벤트 broadcast 콜백이 이미 포함되어 있다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

> **주의**: `BatchTranslatePipeline`은 step1에서 생성되고 step2에서 이벤트 broadcast 콜백이 추가되었다. 이 step3에서는 step2가 추가한 `progress()`, `then()`, `catch()` 콜백 내의 이벤트 broadcast 로직을 보존한 채, `handle()` 메서드 시작 부분에 Lock 로직만 추가해야 한다. step2의 콜백을 덮어쓰지 마라.

> **step2에서 추가한 코드 (반드시 보존할 것)**:
> ```php
> // BatchTranslatePipeline::handle() 내 Bus::batch() 구성 시 등록된 콜백:
> Bus::batch($jobs)
>     ->name("translate-embed-{$this->targetLanguage}")
>     ->allowFailures()
>     ->progress(function (Batch $batch) {
>         // 개별 Job 완료 시마다 broadcast
>         broadcast(new TranslationProgress(
>             batchId: $batch->id,
>             totalJobs: $batch->totalJobs,
>             completedJobs: $batch->processedJobs(),
>             failedJobs: $batch->failedJobs,
>             status: 'processing',
>         ));
>     })
>     ->then(function (Batch $batch) {
>         broadcast(new BatchCompleted(batchId: $batch->id));
>     })
>     ->catch(function (Batch $batch, Throwable $e) {
>         broadcast(new BatchFailed(batchId: $batch->id, errorMessage: $e->getMessage()));
>     })
>     ->dispatch();
> ```
>
> 위 콜백 코드를 수정하거나 삭제하지 마라. Lock 로직은 `handle()` 메서드 **시작 부분**에만 추가한다.

## 작업

동일 언어의 중복 실행을 방지하는 Redis Lock 로직을 `BatchTranslatePipeline`에 추가하라.

### BatchTranslatePipeline 수정

`handle()` 메서드 시작 부분에 중복 실행 검증 로직을 추가:

```php
// Lock 키 포맷: "translate-batch:{언어코드}"
// 예: "translate-batch:zh", "translate-batch:en"
// Pipeline이 단일 언어만 처리하므로, lock 하나만 획득/실패 여부가 전체 Pipeline 실행 여부를 결정한다
```

핵심 규칙:
1. `Cache::lock("translate-batch:{$targetLanguage}", 600)` — 10분 타임아웃, 단일 lock.
2. Lock 획득 실패 시 Job을 즉시 종료하고, `AlreadyRunning` 이벤트를 broadcast.
3. Lock은 batch 완료/실패 콜백에서 자동 해제 (`owner` 기반).
4. `block()`을 호출하지 마라. 논블로킹으로 즉시 성공/실패를 반환해야 한다.

### AlreadyRunning 이벤트 (`app/Events/AlreadyRunning.php`)

중복 실행 감지 시 broadcast하는 이벤트.

시그니처:
```php
namespace App\Events;

class AlreadyRunning implements ShouldBroadcast
{
    public function __construct(
        public string $language,
    ) {}

    public function broadcastOn(): Channel;
    public function broadcastAs(): string;
}
```

## 생성할 파일

- `laravel/app/Events/AlreadyRunning.php`
- `laravel/app/Jobs/BatchTranslatePipeline.php` (수정 — Lock 로직 추가)

## Acceptance Criteria

```bash
# Lock 로직 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  $lock = Cache::lock("test-lock", 10);
  echo $lock->get() ? "lock 획득 성공" : "lock 획득 실패";
  $lock->release();
'

# 이벤트 클래스 확인
docker exec cl_embed_laravel php artisan tinker --execute '
  echo get_class(new App\Events\AlreadyRunning("zh"));
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

- `Cache::lock()->block()`을 호출하지 마라. 이유: PRD §3.3에 따라 이미 실행 중이면 즉시 거절해야 한다.
- 기존 테스트를 깨뜨리지 마라
