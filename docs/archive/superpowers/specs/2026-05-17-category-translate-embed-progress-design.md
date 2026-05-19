# 카테고리별 번역→임베딩 WebSocket 프로그레스 표시

## 개요

Admin 페이지에서 카테고리별 "번역 실행" 버튼 클릭 시, 5단계 번역→임베딩 파이프라인이 실행되고 그 진행 상황을 WebSocket으로 실시간 표시하는 기능.

## 파이프라인 5단계

| 순서 | 단계 | 언어 | 설명 |
|------|------|------|------|
| 1 | translation.zh | zh | 한국어 원문을 중국어로 번역 |
| 2 | translation.en | en | 한국어 원문을 영어로 번역 |
| 3 | embedding.ko | ko | 한국어 원문을 벡터화 |
| 4 | embedding.zh | zh | 1단계 번역 결과를 벡터화 |
| 5 | embedding.en | en | 2단계 번역 결과를 벡터화 |

## 요구사항

### 동작 규칙

- **실패 시 중단**: 한 단계 실패 시 이후 단계는 실행하지 않음
- **스마트 재개**: 실패 단계에서부터 이어서 실행. DB 상태로 기완료 단계 판단
  - 번역 완료 여부: `categories.category_name_zh`, `categories.category_name_en` 컬럼
  - 임베딩 완료 여부: `category_embeddings` 테이블의 해당 locale row
- **단일 실행**: 전체 카테고리 중 한 번에 하나의 파이프라인만 실행 가능 (추후 일괄/선택 실행 대비)
- **중단 가능**: 모달을 닫으면 파이프라인 중단. 백엔드에 `POST /api/categories/{category}/translate-embed/cancel` 호출로 Redis cancel flag 설정. Job은 각 단계 시작 전 cancel flag를 확인하고 설정되어 있으면 중단.

### 프론트엔드 UI

- 카테고리 테이블 "작업" 컬럼에 `Play` 아이콘 버튼 (variant="ghost" size="icon")
- 버튼 클릭 시 모달 오픈 + 파이프라인 시작
- 실행 중인 카테고리가 있으면 다른 버튼은 disabled
- 모달: 5단계 체크리스트 형태
  - `pending` → 회색 `Circle`
  - `running` → `Loader2` + `animate-spin`
  - `completed` → 초록색 `CheckCircle2`
  - `failed` → 빨간색 `XCircle` + 에러 메시지 + "재시도" 버튼
- 완료 후 자동 닫힘 없음. 사용자가 직접 닫기
- 모달 닫기 = 파이프라인 중단
- 모바일 카드 레이아웃에도 동일 적용

## 아키텍처

### 백엔드 (Laravel)

**API 엔드포인트**: `POST /api/categories/{category}/translate-embed`
- Sanctum 인증
- implicit route model binding
- 응답: `202 Accepted` + `{ message, category_id }`

**Job**: `CategoryTranslateEmbedPipeline` (ShouldQueue)
- Redis lock(`category-translate:{categoryId}`, 600s TTL) 으로 중복 실행 방지
- Redis cancel flag(`category-translate-cancel:{categoryId}`) — 각 단계 시작 전 확인, 설정 시 중단
- 5단계 순차 실행, 각 단계 전 DB 상태 확인하여 기완료 건너뛰기
- 단계 시작 전: `CategoryProgress(status: "running")` broadcast
- 단계 완료 후: `CategoryProgress(status: "completed")` broadcast
- 단계 실패 시: `CategoryProgress(status: "failed", error)`) broadcast → 중단
- 전체 완료 시: `CategoryPipelineCompleted` broadcast → lock release

**Cancel 엔드포인트**: `POST /api/categories/{category}/translate-embed/cancel`
- Redis cancel flag 설정. Job이 다음 단계 시작 전 감지하고 중단.
- 이미 완료된 단계는 유지, 실행 중인 단계는 완료 후 중단 (중간 종료 불가)

**WebSocket 이벤트** (Reverb, ShouldBroadcast):

| 이벤트 | 채널 | broadcastAs |
|--------|------|-------------|
| CategoryProgress | `category.{categoryId}` | `category.progress` |
| CategoryPipelineCompleted | `category.{categoryId}` | `category.completed` |

**CategoryProgress 프로퍼티**: `categoryId`, `step`(1~5), `stepName`, `status`, `error?`

**CategoryPipelineCompleted 프로퍼티**: `categoryId`, `allSuccess`, `failedStep`

### 프론트엔드 (Next.js)

**API 클라이언트**: `translateEmbedCategory(categoryId, token?)` in `lib/api.ts`

**훅**: `useCategoryProgress` in `hooks/useCategoryProgress.ts`
- `progress: CategoryProgress | null`
- `isRunning: boolean`
- `startTranslation(categoryId, token?)`: API 호출 + Echo 채널 구독
- `cancel()`: 채널 leave + 상태 초기화

**Admin 페이지**: `app/admin/page.tsx`
- 페이지 레벨에서 `useCategoryProgress` 관리 (단일 실행 강제)
- 테이블 "작업" 컬럼, 모바일 카드에 버튼 추가
- 모달 컴포넌트: 5단계 체크리스트 표시

## 접근 방식

**Laravel Job Chain + Reverb WebSocket** (채택)

기존 `BatchTranslatePipeline` + `useBatchProgress` 패턴을 카테고리 단위로 적용. 이미 구축된 Reverb + Echo 인프라를 재사용하여 프로젝트 일관성을 유지.

## 테스트

### Laravel (Pest)
- `CategoryProgress` 이벤트: 채널, 이벤트명, 프로퍼티 검증
- `CategoryPipelineCompleted` 이벤트: 채널, 이벤트명, 프로퍼티 검증
- `CategoryTranslateEmbedPipeline` Job: lock 동작, 5단계 순서, smart resume, 실패 중단

### Next.js (Vitest)
- `useCategoryProgress` 훅: `renderHook` + `act`, API mock, Echo mock
- Admin 페이지: 버튼 렌더링, 클릭 시 모달/파이프라인 시작, 아이콘 상태 전환

## 에러 처리

- WebSocket 연결 실패 → `console.warn`, API 호출은 정상 진행
- API 호출 실패 → 모달에 에러 표시, 버튼 복구
- Job 단계 실패 → 모달에 빨간 X + 에러 메시지 + 재시도 버튼

## 디자인 제약

- 색상: CSS 변수(oklch)만 사용, raw hex 금지
- 아이콘: lucide-react만 사용, 이모지 금지
- 애니메이션: transform/opacity, `motion-reduce:` 대응
- 버튼 호버: `hover:bg-muted hover:text-foreground transition-all duration-200`
- 다크 모드: light/dark 모두 지원
