# WebSocket 제거 및 HTTP API 전환 설계

## 개요

현재 WebSocket(Reverb) 기반으로 동작하는 6개 이벤트와 Job 구조를 단순 HTTP 동기 API로 전환한다.
Ollama GPU 병목으로 인해 Queue/Batch/WebSocket의 실시간 병렬 처리 이점이 없으므로, 구조를 단순화한다.

## 변경 이유

- Ollama(GPU)가 단일 요청에서 이미 100% 리소스 사용 → 병렬 처리 의미 없음
- Queue + Batch + Reverb + Echo = 과잉 설계
- DB에 진행 상태를 저장하지 않아도 됨 (페이지 새로고침 시丢失)
- WebSocket 유지보수 비용 대비 실질적 이점 없음

## API 변경

### 신규: `POST /api/categories/{category}/run-step`

단일 step을 동기 처리하고 결과를 바로 반환한다. Timeout 300초.

| 항목 | 내용 |
|------|------|
| Method | POST |
| Path | `/api/categories/{category}/run-step` |
| Auth | `auth:sanctum` |
| Body | `{ "step": "translation.zh" }` (step name 문자열) |
| Response 200 | `{ "step": "translation.zh", "status": "completed", "result": "번역문자열" }` |
| Response 422 | 유효하지 않은 step name |
| Timeout | 300초 (PHP-FPM + Ollama 응답 대기) |

지원 step 목록: `translation.zh`, `translation.en`, `embedding.ko`, `embedding.zh`, `embedding.en`

Controller 로직:
- Translation step: `OllamaTranslator::translate()` → Category 모델 업데이트 → 번역 텍스트 반환
- Embedding step: 해당 언어 텍스트 읽기 → `EmbeddingGenerator::generate()` → `CategoryEmbedding::updateOrCreate()` → preview 반환

### 제거되는 API

| 엔드포인트 | 사유 |
|-----------|------|
| `POST /api/categories/{category}/translate-embed` | Job dispatch 불필요 |
| `POST /api/categories/{category}/translate-embed/cancel` | 동기 처리이므로 취소 개념 불필요 |
| `POST /api/categories/batch-translate` | 프론트 루프로 대체 |

## 프론트엔드 변경

### Admin 모달 (`category-modal.tsx`)

변경 전: `useCategoryProgress`(WebSocket)로 실시간 진행률 수신
변경 후: 직접 fetch + Promise.allSettled

```typescript
const results = await Promise.allSettled(
  neededSteps.map(step =>
    fetch(`/api/categories/${id}/run-step`, {
      method: 'POST',
      body: JSON.stringify({ step }),
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json())
  )
);
```

- 각 step 완료 시 `setCompleted(step, result)`로 상태 업데이트
- 실패 시 `setFailed(step)` + 에러 메시지 표시
- 각 step 버튼(단일 실행)은 단일 fetch로 즉시 처리

### Embed 페이지 (`embed/page.tsx`)

변경 전: `useBatchProgress`(WebSocket)로 배치 진행률 수신
변경 후: for 루프 직렬 처리 + useState로 직접 진행률 관리

```typescript
const totalJobs = categories.length;
setProgress({ status: 'processing', completedJobs: 0, failedJobs: 0, totalJobs });

for (const cat of categories) {
  try {
    await Promise.all(steps.map(step =>
      fetch(`/api/categories/${cat.id}/run-step`, {
        method: 'POST',
        body: JSON.stringify({ step }),
        headers: { Authorization: `Bearer ${token}` },
      })
    ));
    setProgress(p => ({ ...p, completedJobs: p.completedJobs + 1 }));
  } catch {
    setProgress(p => ({ ...p, failedJobs: p.failedJobs + 1 }));
  }
}
```

### 제거되는 파일

**Backend (Laravel):**
- `app/Events/AlreadyRunning.php`
- `app/Events/BatchCompleted.php`
- `app/Events/BatchFailed.php`
- `app/Events/CategoryPipelineCompleted.php`
- `app/Events/CategoryProgress.php`
- `app/Events/TranslationProgress.php`
- `app/Jobs/CategoryTranslateEmbedPipeline.php`
- `app/Jobs/BatchTranslatePipeline.php`
- `app/Jobs/TranslateAndEmbedJob.php`
- `config/reverb.php`
- `routes/channels.php` (또는 Laravel 기본만 유지)

**Backend (설정):**
- `config/broadcasting.php` — reverb connections 제거
- `composer.json` — `laravel/reverb` 제거

**Frontend (Next.js):**
- `hooks/useEcho.ts`
- `hooks/useCategoryProgress.ts`
- `hooks/useBatchProgress.ts`
- `lib/echo.ts`
- `global.d.ts`
- `package.json` — `laravel-echo`, `pusher-js`, `@types/pusher-js` 제거

## 데이터 정리 (Migration)

기존 번역/임베딩 데이터는 stale 상태이므로 초기화:

```php
// 새 migration: 2026_05_18_000000_clear_translation_embedding_data.php
Schema::table('categories', function (Blueprint $table) {
    DB::table('categories')->update([
        'category_name_zh' => null,
        'category_name_en' => null,
    ]);
});
DB::table('category_embeddings')->truncate();
DB::table('translation_caches')->truncate();
```

## 병렬 처리 성능

| 시나리오 | 호출 방식 | 예상 시간 |
|---------|----------|----------|
| Admin 모달 전체 실행 (5 step) | Promise.all (5 parallel) | ~max(step) ≈ 5초 |
| Admin 단일 step 실행 | 단일 fetch | ~3초 (step당) |
| Embed 일괄 번역 N개 카테고리 | 직렬 루프 × Promise.all 내부 | N × max(step) |

Promise.all은 Ollama GPU 병목으로 순차 대비 전체 시간이 줄지 않으나, 가장 먼저 완료된 step부터 부분 결과가 도착하여 UI에 반영 가능하다.

## 테스트 계획

### Laravel (Pest)
- `runStep` 정상 처리 (step별 결과 반환)
- 존재하지 않는 step → 422
- 인증 없음 → 401

### Next.js (Vitest)
- Admin 모달 handleRunAll: Promise.allSettled로 다중 step 처리, 성공/실패 상태 전이
- Embed 페이지 batchTranslate: 직렬 루프, 진행률 상태 변화

### Playwright (E2E, WSL2)
- Admin 모달: "전체 실행" → step별 완료 표시 확인
- Embed 페이지: "전체 번역 실행" → Progress 바 증가 확인

## 작업 순서 (Phase)

### Step 1: run-step 컨트롤러 메서드 생성
- CategoryController에 `runStep(Request, Category)` 메서드 추가
- 기존 Job(CategoryTranslateEmbedPipeline)의 handle 로직을 컨트롤러로 이동
- route 등록
- 기존 translateEmbed, cancelTranslateEmbed, batchTranslate 메서드 제거
- FormRequest (선택), Pest 테스트

### Step 2: Laravel 불필요 파일 정리
- Events 6개, Jobs 3개 삭제
- reverb config, channels.php 정리
- broadcasting.php 정리
- composer.json laravel/reverb 제거
- 데이터 정리 migration 추가
- 컴포저 업데이트 (컨테이너 재빌드)
- Pint 포맷팅

### Step 3: Admin 모달 HTTP 전환
- category-modal.tsx: useCategoryProgress 제거, 직접 fetch + Promise.allSettled 구현
- useEcho, useCategoryProgress, useBatchProgress, echo.ts, global.d.ts 삭제
- laravel-echo, pusher-js 패키지 제거
- 프론트 테스트 갱신 (useCategoryProgress 테스트 제거, 모달 테스트 갱신)

### Step 4: Embed 페이지 HTTP 전환
- embed/page.tsx: useBatchProgress 제거, for 루프 + useState로 대체
- 관련 테스트 갱신

### Step 5: Playwright E2E 테스트
- 관리자 모달 전체 실행 시나리오
- Embed 페이지 일괄 번역 시나리오
- 페이지 새로고침 후 상태 확인

### Step 6: 마무리
- Swagger 문서 갱신 (`php artisan l5-swagger:generate`)
- Pint 포맷팅
- 전체 테스트 스위트 실행
