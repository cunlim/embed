# Admin 모달 텍스트 편집 기능 설계

## 개요

Admin 카테고리 상세 모달에서 텍스트를 `<input>`으로 표시하고, blur 시 DB 저장 + 임베딩 초기화하는 기능.

## 변경 사항

### 1. 백엔드 — `PUT /api/categories/{category}/update-text`

**Controller**: `CategoryController::updateText` 추가 (`routes/api.php`)

**요청 본문:**
```json
{
  "field": "category_name_en",
  "value": "Furniture/Interior>Bedroom furniture>Drawer"
}
```

**`field` 유효값**: `category_name_ko`, `category_name_en`, `category_name_zh`

**동작:**
1. `CategoryUpdateTextRequest` (FormRequest)로 검증: `field`는 `in:category_name_ko,category_name_en,category_name_zh`, `value`는 `nullable|string|max:255`
2. `$category->update([$field => $value])`
3. 해당 언어의 `CategoryEmbedding` 레코드 삭제 (예: `field=category_name_en` → `lang=en`인 embedding 삭제)
4. `200 { "data": { "updated": true, "id": 1 } }` 응답

**인증**: Sanctum 필수 (admin 전용)

### 2. 프론트엔드 — API 함수

**`lib/api.ts`**:
```typescript
export function updateCategoryText(
  categoryId: number,
  field: "category_name_ko" | "category_name_en" | "category_name_zh",
  value: string | null,
  token?: string | null
): Promise<{ data: { updated: boolean; id: number } }> {
  return request(`/categories/${categoryId}/update-text`, {
    method: "PUT",
    body: { field, value },
    token,
  });
}
```

### 3. 프론트엔드 — 모달 컴포넌트 변경

**`category-modal.tsx`**:

**텍스트 ↔ Input 조건:**
- `hasValue === true`이고 row가 **번역 텍스트 또는 한국어 원본** → `<input>` 렌더링
- `hasValue === true`이고 row가 **임베딩** → 기존 `<span>` 유지
- `hasValue === false` → 기존 상태 표시 유지 (처리전 / 실패 등)

**readOnly 조건**: `runningSteps.size > 0 || pendingSteps.length > 0` (실행 중)

**blur 저장 로직:**
```typescript
const handleBlur = async (langKey: "ko" | "en" | "zh", newValue: string) => {
  if (!data || newValue === originalValue) return;
  const fieldMap = { ko: "category_name_ko", en: "category_name_en", zh: "category_name_zh" };
  try {
    await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    onReload?.();
    onListRefresh?.();
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

**각 언어의 `field` 매핑:**
- 한국어(원본): `category_name_ko`
- 영어(번역): `category_name_en`
- 중국어(번역): `category_name_zh`

### 4. 번역 재실행 흐름 (자연스럽게 동작)

1. input 텍스트를 모두 지우고 blur → DB에 `null` 저장
2. `translation_text`가 `null` → `translationDone = false`
3. Copy 버튼이 Play 버튼으로 변경됨
4. 사용자가 Play 클릭 → 기존 `runStep` API로 재번역 실행

### 5. 데이터 흐름

```
input onChange → 로컬 상태 업데이트
     ↓
input onBlur → 값 변경 감지 → PUT API 호출
     ↓
성공 → onReload() → translations 재조회 → embedding "처리전" UI 반영
     ↓
실패 → toast 에러
```

### 6. 영향받지 않는 사항

- 한국어 원본 수정 시 다른 언어 번역/임베딩 무관
- `category_code`는 수정 불가 (코드 자동 생성)
- 실행 버튼 disabled 조건 변화 없음
