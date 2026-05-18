# 카테고리 텍스트/임베딩 수정 모달 버그 픽스

## 문제

### Issue 1: 한국어 카테고리 텍스트 삭제 시 500 에러
- `category_name_ko` 컬럼이 DB에서 `NOT NULL`이지만 프론트엔드가 빈 문자열을 `null`로 변환해 전송
- `UPDATE categories SET category_name_ko = NULL` → PostgreSQL NOT NULL constraint violation → HTTP 500
- 영어(`category_name_en`)와 중국어(`category_name_zh`)는 `nullable()`이라 정상 동작

### Issue 2: 텍스트 수정 후 임베딩 버튼 상태 불일치
- `handleBlur` → API `updateText` → 백엔드는 해당 언어 임베딩 삭제
- `onUpdateData`로 새 데이터(mount 시 초기화된 `execState`) 전달됨
- 하지만 동일 세션에서 임베딩 실행 후 텍스트 수정 시, `useCategoryExecution`의 `execState`(`completedSteps`/`stepResults`/`copyableSteps`)는 갱신되지 않음
- 결과: `renderRow`에서 `isCompleted = hasValue || completedSteps.has(stepName)` → true → **disabled 체크 버튼** 표시 (play 버튼이 와야 함)

## 요구사항

1. 한국어 카테고리 텍스트를 비울 수 있어야 함
2. 한국어 카테고리가 비었을 때:
   - 번역 실행 버튼 (en, zh) disabled
   - 임베딩 실행 버튼 (ko, en, zh) disabled
   - "전체 실행" 버튼 비활성화
3. 텍스트 수정 시 해당 언어의 임베딩 step이 execState에서 정리되어 UI가 올바르게 갱신됨

## 수정 사항

### 1. DB: `category_name_ko` nullable 전환

**신규 파일**: `laravel/database/migrations/2026_05_18_000001_alter_categories_make_name_ko_nullable.php`

```php
Schema::table('categories', function (Blueprint $table) {
    $table->string('category_name_ko', 255)->nullable()->change();
});
```

`CategoryUpdateTextRequest` validation은 이미 `nullable`을 허용하므로 변경 불필요.
`CategoryController::updateText`도 null 처리를 이미 지원함.

### 2. 프론트엔드: 빈 한국어 시 액션 버튼 disabled

**변경 파일**: `nextjs/components/admin/category-modal.tsx`

- `isKoEmpty = data && !data.category_name_ko` 도입
- `LANGUAGES.map` 루프 내에서 `translationDone` 계산 시 한국어 빈값 고려
  - `noSourceText = isKoEmpty && lang.hasTranslation` (en/zh 번역)
  - `noSourceTextForEmbedding = isKoEmpty` (모든 언어 임베딩)
- 전달:
  - 번역 play 버튼: `disabled={isExecuting || translationDone === false || noSourceText}`
  - 임베딩 play 버튼: `disabled={isExecuting || translationDone === false || noSourceTextForEmbedding}`
  - "전체 실행" 버튼: `disabled={isExecuting || allCompleted || isKoEmpty}`

### 3. `useCategoryExecution`에 `clearStep` 메서드 추가

**변경 파일**: `nextjs/hooks/useCategoryExecution.ts`

```typescript
export interface UseCategoryExecutionReturn {
  getState: (catId: number) => CatExecState;
  clearStep: (catId: number, stepName: StepName) => void;
  // ... 기존 메서드
}
```

구현:
```typescript
const clearStep = useCallback((catId: number, stepName: StepName) => {
    const state = getState(catId);
    const nextCompleted = new Set(state.completedSteps);
    nextCompleted.delete(stepName);
    state.completedSteps = nextCompleted;

    const nextResults = new Map(state.stepResults);
    nextResults.delete(stepName);
    state.stepResults = nextResults;

    const nextCopyable = new Set(state.copyableSteps);
    nextCopyable.delete(stepName);
    state.copyableSteps = nextCopyable;

    forceUpdate();
}, [getState]);
```

### 4. `CategoryModal`에 `onClearStep` prop 연결

**변경 파일**: `nextjs/components/admin/category-modal.tsx`

- Props 인터페이스에 `onClearStep?: (catId: number, stepName: StepName) => void` 추가
- `handleBlur` 성공 시 호출:
  ```typescript
  const embedStep = `embedding.${langKey}` as StepName;
  onClearStep?.(data.id, embedStep);
  ```

**변경 파일**: `nextjs/app/admin/page.tsx`

- `useCategoryExecution`에서 `clearStep` 구조분해
- `onClearStep` prop으로 전달

## 영향 범위

| 파일 | 변경 유형 |
|------|----------|
| `laravel/database/migrations/*_alter_categories_make_name_ko_nullable.php` | 신규 |
| `nextjs/hooks/useCategoryExecution.ts` | 수정 (clearStep 추가) |
| `nextjs/components/admin/category-modal.tsx` | 수정 (빈값 체크, onClearStep) |
| `nextjs/app/admin/page.tsx` | 수정 (prop 전달) |

## 테스트 계획

1. **Issue 1 검증**: 한국어 입력창 비우고 blur → "저장되었습니다" 토스트, 에러 없음
2. **빈 한국어 상태 검증**: 한국어 비었을 때 en/zh 번역 버튼 disabled, 임베딩 버튼 disabled, "전체 실행" disabled
3. **Issue 2 검증**: 텍스트 수정 후 임베딩 버튼이 play 버튼(복사 버튼 아님)으로 표시
