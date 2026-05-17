# Admin 페이지 실시간 WebSocket + 임베딩 전체 벡터 전달 설계

## 개요

Admin 카테고리 상세 모달의 번역/임베딩 실행을 WebSocket 기반 실시간 진행 표시로 개선하고, 임베딩 벡터를 전체 1024차원으로 전달한다.

## 현재 문제

1. Echo/Reverb WebSocket 연결이 초기화되지 않아 개별 실행 버튼의 로딩 효과 미표시
2. 실행 완료 후 모달이 강제 리프레시되고 메인 리스트가 갱신되지 않음
3. 임베딩 벡터가 5차원만 프론트엔드에 전달됨

## 변경 사항

### 1. 인프라: Echo/Reverb WebSocket 연결 디버깅

- `createEcho()`의 동적 import 성공 여부, nginx `proxy_read_timeout` 영향, Cloudflare WebSocket 통과 여부 진단
- `.env.local`의 `NEXT_PUBLIC_REVERB_*` 변수와 Laravel `.env`의 `REVERB_*` 변수 일치 확인
- docker network 내 nginx → cl_embed_laravel:8080 연결 확인
- 검증: `window.Echo`가 생성되고 `echo.channel('category.X')` 구독 성공

### 2. 백엔드: 임베딩 전체 벡터 반환

**파일**: `laravel/app/Http/Resources/CategoryTranslationsResource.php`

```php
// embeddingData() 메서드 (line 50-53)
'preview' => $vector !== [] ? array_map(fn($v) => (float) $v, $vector) : null,
// array_slice($vector, 0, 5) → 전체 1024차원 반환
```

### 3. 프론트엔드: Optimistic UI + 실시간 진행

#### 3.1 useCategoryProgress 훅 개선

- `subscribeProgress`에서 echo가 null이어도 `setIsRunning(true)` 보장 (API 호출만으로 실행되는 상황 대응)
- 각 `category.progress` 이벤트에서 `status === "completed"` 시 `onUpdate` 콜백 호출 (메인 리스트 중간 갱신)

#### 3.2 category-modal.tsx - UI 상태 관리

로컬 state 3종 추가:
- `runningSteps: Set<StepName>` — 현재 실행 중인 step
- `completedSteps: Set<StepName>` — 성공한 step
- `failedSteps: Set<StepName>` — 실패한 step

**버튼 상태 규칙**:
| 상태 | 아이콘 | disabled |
|------|--------|----------|
| 대기 (처리전) | `Play` | `isRunning`이면 disabled |
| 실행 중 | `Loader2` animate-spin | disabled (모든 버튼) |
| 성공 | `Copy` | 정상 |
| 실패 | `AlertCircle` text-destructive | 정상 |

**클릭 동작**:
- `handleSingleAction`: 클릭 즉시 `runningSteps`에 추가 → 아이콘 Loader2로 전환. try-catch 실패 시 `failedSteps`에 추가
- `handleRunAll`: 실행 대상 step 모두 `runningSteps`에 추가
- WebSocket `category.progress(status:"completed")` 수신 → 해당 step `runningSteps` 제거, `completedSteps` 추가
- WebSocket `category.progress(status:"failed")` 수신 → `failedSteps` 추가
- WebSocket `category.completed` 수신 → 모든 step 초기화, `onReload` 호출

#### 3.3 admin/page.tsx - 메인 리스트 실시간 갱신

- `useCategories`의 `loadCategories`를 `onUpdate` 콜백으로 전달
- `category.progress(status:"completed")` 및 `category.completed` 수신 시 `loadCategories()` 호출
- 각 step 완료 시마다 메인 리스트 상태 뱃지가 `처리안됨 → 일부처리 → 처리완료`로 단계적 변화

### 4. 프론트엔드: 임베딩 표시

- `category-modal.tsx`의 preview 표시: `preview.slice(0, 5)` → 전체 벡터 요약 표시 (최대 10개 + "…1024차원")
- 복사 버튼: `JSON.stringify(fullVector)`로 전체 벡터 복사

## 데이터 흐름

```
개별 실행 클릭
  → runningSteps 즉시 추가 (optimistic UI)
  → translateEmbedCategory API 호출
  → WebSocket: category.progress { stepName, status: "running" }
      → activeStep 갱신, runningSteps 정리
  → WebSocket: category.progress { stepName, status: "completed" }
      → 모달: 값 표시 + Copy 아이콘
      → 메인 리스트: loadCategories() → 상태 뱃지 갱신
  → WebSocket: category.completed
      → 모달: 모든 버튼 disabled 해제, onReload로 데이터 최종 갱신
```

## 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `laravel/.../CategoryTranslationsResource.php` | `array_slice(0,5)` → `array_map` 전체 벡터 |
| `nextjs/lib/api.ts` | 타입 변경 없음 (실제 데이터는 전체 벡터) |
| `nextjs/hooks/useCategoryProgress.ts` | echo null 허용 로직 추가, 중간 onUpdate 호출 |
| `nextjs/components/admin/category-modal.tsx` | 로컬 state 3종, 버튼 렌더링 로직 변경, 임베딩 표시 |
| `nextjs/app/admin/page.tsx` | 실시간 리스트 갱신 |
