# Step 3: concurrency-lock

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "동시성 상태" 섹션)
- `/docs/PRD.md` (특히 §3.3: 중복 검증)
- `/docs/ADR.md` (ADR-002)
- `/laravel/CLAUDE.md`
- `/laravel/config/cache.php` (Redis 캐시 설정 확인)
- `/laravel/app/Jobs/BatchTranslatePipeline.php` (이전 step에서 생성됨)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

동일 언어/모델의 중복 실행을 방지하는 Redis Lock 로직을 `BatchTranslatePipeline`에 추가하라.

### BatchTranslatePipeline 수정

`handle()` 메서드 시작 부분에 중복 실행 검증 로직을 추가:

```php
// Lock 키 포맷: "translate-batch:{언어코드}"
// 예: "translate-batch:zh", "translate-batch:en"
```

핵심 규칙:
1. `Cache::lock("translate-batch:{$lang}", 600)` — 10분 타임아웃.
2. Lock 획득 실패 시 Job을 즉시 종료하고, 이미 실행 중임을 알리는 이벤트를 broadcast.
3. Lock은 batch 완료/실패 콜백에서 자동 해제 (`owner` 기반).
4. 언어별로 별도 lock을 획득하므로 `zh`가 실행 중이어도 `en`은 별도로 실행 가능.
5. `block()`을 호출하지 마라. 논블로킹으로 즉시 성공/실패를 반환해야 한다.

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
- 한 번에 하나의 글로벌 lock만 사용하지 마라. 언어별로 독립적인 lock을 사용해야 zh/en 동시 실행이 가능하다.
- 기존 테스트를 깨뜨리지 마라
