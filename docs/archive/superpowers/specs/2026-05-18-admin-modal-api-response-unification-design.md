# Admin 모달 API 응답 통합 및 렌더링 개선 설계

## 개요

Admin 카테고리 상세 모달의 두 가지 이슈를 수정하고, API 응답 구조를 통일하여 모달 깜빡임을 제거한다.

1. **Issue 1:** 번역 텍스트가 `null`이면 `<input>` 대신 "처리전" 텍스트 출력
2. **Issue 2:** blur 저장 시 `onReload()`로 전체 데이터 재조회 → 모달 깜빡임

## 해결 방안

`updateText`와 `runStep` API 응답에 전체 `translations` 데이터를 포함시켜, 프론트가 API 응답 데이터로 직접 모달을 갱신한다. (re-fetch 없음, 깜빡임 없음)

---

## 변경 사항

### 1. 백엔드 — `CategoryController::updateText` 응답 변경

**현재 응답:**
```json
{ "data": { "updated": true, "id": 1 } }
```

**변경 후 응답:**
```json
{
  "data": {
    "updated": true,
    "id": 1,
    "translations": {
      "id": 1,
      "category_code": "50004590",
      "category_name_ko": "가구/인테리어>침실가구>서랍장",
      "embedding_dimensions": 1024,
      "languages": {
        "ko": {
          "translation_text": "가구/인테리어>침실가구>서랍장",
          "embedding": { "status": "completed", "preview": [...] }
        },
        "en": {
          "translation_text": null,
          "embedding": { "status": "pending", "preview": null }
        },
        "zh": {
          "translation_text": "数字/家电>手机配件>手机壳>皮革外壳",
          "embedding": { "status": "completed", "preview": [...] }
        }
      }
    },
    "listRow": {
      "id": 1,
      "translation_status": "일부처리"
    }
  }
}
```

**구현:**
```php
$category->fresh(); // embedding 삭제 반영
$resource = (new CategoryTranslationsResource($category))->resolve();

return response()->json([
    'data' => [
        'updated' => true,
        'id' => $category->id,
        'translations' => $resource,
        'listRow' => [
            'id' => $category->id,
            'translation_status' => $category->translationStatus(),
        ],
    ],
]);
```

### 2. 백엔드 — `CategoryController::runStep` 응답 변경

**현재 응답:**
```json
{ "status": "completed", "result": "번역된 텍스트" }
```

**변경 후 응답:**
```json
{
  "status": "completed",
  "result": "번역된 텍스트",
  "translations": {
    "id": 1,
    "category_code": "50004590",
    "languages": { ... }
  }
}
```

번역/임베딩 실행 완료 후 `$category->fresh()`로 변경사항을 반영한 `CategoryTranslationsResource`를 함께 반환한다.

### 3. 프론트엔드 — `useCategoryDetail`에 `setData` 노출

```typescript
export function useCategoryDetail(categoryId: number | null, token?: string | null) {
  const [data, setData] = useState<CategoryTranslations | null>(null);
  // ...
  return { data, isLoading, error, reload: load, setData };
}
```

### 4. 프론트엔드 — `category-modal.tsx` Issue 1 수정

**변경 전 (`hasValue` 조건으로 input/span 분기):**
```tsx
{langKey && hasValue ? (
  <input ... />
) : (
  <span>처리전</span>
)}
```

**변경 후 (`langKey` 조건으로 항상 input):**
```tsx
{langKey ? (
  <input
    type="text"
    className="text-sm truncate font-mono w-full bg-transparent border-b border-border px-1 py-0.5 focus:outline-none focus:border-accent read-only:opacity-60 read-only:cursor-default"
    value={editValues[langKey] ?? displayValue ?? ""}
    onChange={(e) => setEditValues((prev) => ({ ...prev, [langKey]: e.target.value }))}
    onBlur={() => handleBlur(langKey)}
    readOnly={runningSteps.size > 0 || pendingSteps.length > 0}
  />
) : (
  <span className="text-sm truncate font-mono">
    {hasValue ? displayValue : "처리전"}
  </span>
)}
```

- 번역/원본 row: 항상 `<input>` (값이 `null`이면 빈 input)
- 임베딩 row: 기존대로 `<span>` 유지

### 5. 프론트엔드 — `handleBlur` (onReload → 응답 데이터 갱신)

**변경 전:**
```typescript
const handleBlur = async (langKey) => {
  try {
    await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    setEditValues({});
    onReload?.();      // 전체 데이터 재조회 → 깜빡임
    onListRefresh?.(); // 리스트 전체 재조회
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

**변경 후:**
```typescript
const handleBlur = async (langKey) => {
  try {
    const res = await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    // re-fetch 없이 응답 데이터로 직접 갱신
    onUpdateData?.(res.data.translations);
    onUpdateListRow?.(res.data.listRow);
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

- `editValues` 리셋 제거 (input 값 유지)
- `onReload`/`onListRefresh` 대신 응답 데이터로 직접 갱신
- toast로 저장 성공/실패 피드백

### 6. 프론트엔드 — `useCategoryExecution::handleSingleAction` (응답 데이터 갱신)

**변경 전:**
```typescript
const result = await res.json();
if (result.status === "completed") {
  state.completedSteps = new Set(state.completedSteps).add(stepName);
  state.stepResults = new Map(state.stepResults).set(stepName, result.result);

  // embedding 실행 후 추가 API 호출
  if (stepName.startsWith("embedding")) {
    const res2 = await fetchCategoryTranslations(catId, token);
    // ... embedding 데이터 추출
  }

  onListRefresh?.();
}
```

**변경 후:**
```typescript
const result = await res.json();
if (result.status === "completed") {
  state.completedSteps = new Set(state.completedSteps).add(stepName);
  state.stepResults = new Map(state.stepResults).set(stepName, result.result);

  // 응답 translations로 모달 데이터 직접 갱신 (추가 API 호출 제거)
  onUpdateData?.(result.translations);

  onListRefresh?.();
}
```

- `handleRunAll`도 동일하게 적용
- embedding 실행 후 `fetchCategoryTranslations` 재호출 제거 (AP 1회 감소)

### 7. 프론트엔드 — `admin/page.tsx` props 변경

**추가:**
```typescript
const { data: detailData, isLoading: detailLoading, error: detailError, reload, setData } =
  useCategoryDetail(modalCategoryId, token);

const updateListRow = useCallback(
  (row: { id: number; translation_status: string }) => {
    setCategories(prev => prev.map(cat =>
      cat.id === row.id ? { ...cat, translation_status: row.translation_status } : cat
    ));
  },
  [],
);
```

**모달 props:**
```typescript
<CategoryModal
  ...
  onUpdateData={setData}
  onUpdateListRow={updateListRow}
  onReload={reload}          // 유지 (수동 새로고침용)
  onListRefresh={() => loadCategories(page)}  // 유지 (수동 새로고침용)
/>
```

---

## 데이터 흐름

```
[blur 저장]
input onBlur → PUT /categories/{id}/update-text
  → 응답 { translations, listRow }
  → onUpdateData(translations) → 모달 데이터 갱신 (깜빡임 없음)
  → onUpdateListRow(listRow)   → 리스트 해당 row status 갱신
  → toast("저장되었습니다")

[번역 실행]
Play 클릭 → POST /categories/{id}/run-step
  → 응답 { status, result, translations }
  → onUpdateData(translations) → input 유지, embedding "처리전"
  → stepResults 저장 → copy 버튼용
  → onListRefresh() → 리스트 갱신

[임베딩 실행]
Play 클릭 → POST /categories/{id}/run-step
  → 응답 { status, result, translations }
  → onUpdateData(translations) → embedding preview 표시
  → 추가 fetchCategoryTranslations 호출 제거
```

---

## 변경되는 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `laravel/app/Http/Controllers/Api/CategoryController.php` | `updateText` 응답에 translations+listRow 추가, `runStep` 응답에 translations 추가 |
| `nextjs/lib/api.ts` | `updateCategoryText` 반환 타입 변경 (`UpdateTextResponse`) + `RunStepResponse` 타입 변경 |
| `nextjs/hooks/useCategoryDetail.ts` | `setData` 반환 추가 |
| `nextjs/hooks/useCategoryExecution.ts` | `handleSingleAction`/`handleRunAll`에 `onUpdateData` 콜백 추가, embedding 후 추가 fetch 제거 |
| `nextjs/components/admin/category-modal.tsx` | `onUpdateData`/`onUpdateListRow` props 추가, `handleBlur` 수정, renderRow input 조건 변경 |
| `nextjs/app/admin/page.tsx` | `setData`로 modal data 갱신, `updateListRow`로 리스트 갱신 |

---

## 영향받지 않는 사항

- 한국어 원본 텍스트 수정 시 다른 언어 번역/임베딩 무관
- `category_code`는 수정 불가 (코드 자동 생성)
- 실행 버튼/번역 버튼 disabled 조건 변화 없음
- 모달 내 실행 상태(CatExecState) 관리 방식 변화 없음
- `onReload`/`onListRefresh` props는 수동 새로고침 용도로 유지
