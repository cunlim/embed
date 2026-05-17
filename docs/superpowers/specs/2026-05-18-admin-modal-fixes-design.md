# Admin 모달 수정 설계

2026-05-18

## 개요

Admin 페이지의 카테고리 수정 모달에서 발견된 3가지 이슈를 수정한다.

- **이슈 1**: 번역 미완료 언어의 임베딩 버튼이 활성화됨 → disabled 처리
- **이슈 3**: 카테고리 목록의 정렬·페이지네이션 부재 → 서버사이드 페이지네이션 + URL 파라미터 연동
- **이슈 4**: 전체실행 시 모든 step이 동시에 spinner → WebSocket 이벤트로 순차 애니메이션

이슈 2(개별실행 속도)는 코드상 문제가 없어 수정 대상에서 제외한다.

---

## 이슈 1: 임베딩 버튼 disabled

### 현재 동작

`renderRow()`(line 237-243)의 Play 버튼은 `disabled={isRunning}` 조건만 확인한다. 번역이 완료되지 않은 언어(`en`, `zh`)의 임베딩 실행 버튼도 활성화되어 있다.

### 수정

`renderRow()`의 Play 버튼 disabled 조건에 번역 완료 여부를 추가한다.

- `ko`: 번역 불필요 → 임베딩 버튼 항상 활성화 (기존과 동일)
- `en`, `zh`: `translation_text`가 없으면 임베딩 실행 버튼 **disabled**

`LanguageConfig`에 번역 필요 여부와 번역 상태를 임베딩 버튼 disabled 판단에 전달할 수 있도록 `renderRow`에 `translationDone` 파라미터를 추가한다.

### 영향 범위

- `nextjs/components/admin/category-modal.tsx` — `renderRow` 시그니처와 disabled 조건만 변경
- 기존 테스트 `category-modal.test.tsx`에 disabled 상태 검증 케이스 추가

---

## 이슈 3: 목록 정렬 + 페이지네이션

### 백엔드 (Laravel)

**`CategoryController::index()`**:
- `->orderBy('id')` 추가
- `->paginate(20)` 적용 → `per_page` 쿼리 파라미터로 조절 가능

응답 형식 (Laravel `LengthAwarePaginator`):
```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 20,
    "total": 55,
    "from": 1,
    "to": 20
  },
  "links": {
    "first": "...?page=1",
    "last": "...?page=3",
    "prev": null,
    "next": "...?page=2"
  }
}
```

### 프론트엔드 (Next.js)

**`useCategories` 훅**:
- `page` 파라미터 추가, `GET /api/categories?page={page}&per_page=20` 호출
- 응답에서 `data`(카테고리 배열)와 `meta`(페이지네이션 정보) 분리 반환

**`app/admin/page.tsx`**:
- `useSearchParams()`로 URL `?page=` 파라미터 읽기 → 초기 페이지 결정
- 페이지 변경 시 `router.push()`로 URL 업데이트
- shadcn Pagination 컴포넌트로 페이지 전환 UI 추가
- `isLoaded` → 페이지 변경 시 자동 재요청

**`CategoryCollection` Resource**:
- `CategoryResource`와 동일한 필드 유지, `Paginator`가 자동으로 envelope 처리

### URL 연동

- `/admin` → page=1 기본값
- `/admin?page=3` → 3페이지 로드
- 새로고침 시 URL의 `page` 파라미터로 해당 페이지 복원
- 페이지 변경 시 `router.push("/admin?page=N")` 호출

---

## 이슈 4: 전체실행 순차 애니메이션

### 현재 동작

`handleRunAll()`(line 151)이 `setRunningSteps(new Set(steps))`로 모든 미완료 step을 동시에 running 상태로 설정한다. 모든 버튼이 동시에 `animate-spin` 된다.

### 의도한 동작

1. 전체실행 클릭 → 첫 번째 미완료 step만 spinner
2. WebSocket `running` 이벤트 → 해당 step spinner
3. WebSocket `completed` 이벤트 → 결과 표시, 다음 step spinner
4. 반복 → 마지막 step 완료 시 전체 종료

### 수정

핵심 아이디어: `runningSteps`를 WebSocket 이벤트가 아닌, `completed` 이벤트 수신 시 `pendingSteps`에서 순차적으로 이동시키는 방식.

**신규 state**:
```ts
const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
```

**`handleRunAll`**:
```ts
// 기존: setRunningSteps(new Set(steps));  ← 모든 step 동시 running
// 변경: 첫 step만 running, 나머지는 pending
const firstStep = steps[0];
const rest = steps.slice(1);
setRunningSteps(new Set(firstStep ? [firstStep] : []));
setPendingSteps(rest);
```

**`handleProgressUpdate`** (completed 케이스):
- 기존대로 runningSteps에서 제거, completedSteps에 추가
- 추가: `pendingSteps`가 비어있지 않으면 첫 항목을 runningSteps로 이동

```ts
// completed 케이스 마지막에 추가
setPendingSteps((prev) => {
  if (prev.length === 0) return prev;
  const [nextStep, ...rest] = prev;
  setRunningSteps((running) => new Set(running).add(nextStep));
  return rest;
});
```

**실패 시**: `pendingSteps` 초기화, 진행 중단.

**`useCategoryProgress` 훅은 변경하지 않는다** — `running` 이벤트 콜백 없이 `completed` 이벤트만으로 순차 전환을 구현한다.

### 데이터 흐름

```
[전체실행 클릭]
  → runningSteps = {"embedding.ko"}, pendingSteps = ["translation.en", "translation.zh", ...]
  → POST /api/categories/{id}/translate-embed {steps: [...]}

[Backend 순차 처리]
  → CategoryProgress {embedding.ko, running}
  → CategoryProgress {embedding.ko, completed, result:"[...]"}
  → CategoryProgress {translation.en, running}
  → ...

[WebSocket completed → handleProgressUpdate]
  embedding.ko completed  → runningSteps={}, pendingSteps에서 "translation.en" 추출 → runningSteps={"translation.en"}
  translation.en completed → runningSteps={}, pendingSteps에서 다음 추출 → runningSteps={"translation.zh"}
  ...
```

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `nextjs/components/admin/category-modal.tsx` | 이슈1: renderRow disabled 조건 / 이슈4: handleRunAll, handleProgressUpdate, pendingSteps state |
| `nextjs/hooks/useCategories.ts` | 이슈3: page 파라미터, 페이지네이션 응답 처리 |
| `nextjs/app/admin/page.tsx` | 이슈3: URL page 파라미터, Pagination UI |
| `nextjs/lib/api.ts` | 이슈3: getCategories에 page 파라미터 추가 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | 이슈3: orderBy('id'), paginate(20) |
| `laravel/app/Http/Resources/CategoryCollection.php` | 이슈3: 불필요 시 변경 없음 (Paginator 기본 envelope) |

## 테스트

- **이슈 1**: `category-modal.test.tsx` — 번역 미완료 시 임베딩 버튼 disabled 검증
- **이슈 3**: `CategoryController` Feature test — `orderBy('id')`, `paginate()` 응답 형식 검증 / `useCategories` hook test — page 파라미터
- **이슈 4**: `useCategoryProgress` test — `running` 이벤트 콜백 호출 검증 / `category-modal.test.tsx` — 전체실행 시 첫 step만 running 상태 검증
