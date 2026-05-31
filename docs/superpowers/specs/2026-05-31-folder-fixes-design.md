# 폴더 기능 이슈 수정 설계 문서

## 개요

1·2차 폴더 기능 구현(`f6bb642~0da5cbf`) 후 발견된 10개 이슈를 수정합니다.

## 핵심 아키텍처 변경: `folders` 테이블 신설

### 현행 방식의 문제

- `category_name_ko = '__folder_placeholder__'` 더미 카테고리로 폴더 존재 표시
- `category_code` NOT NULL 컬럼에 값 미제공 → 폴더 생성 시 SQL 에러
- 폴더 내 마지막 카테고리 삭제 시 폴더도 소멸 (빈 폴더 유지 불가)

### 변경: 독립 `folders` 테이블

```sql
CREATE TABLE folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX folders_user_id_name_unique ON folders (user_id, name);
```

- 서로 다른 회원은 같은 폴더명 사용 가능 (unique on `user_id, name`)
- `categories.folder` 컬럼은 유지 — 폴더명 문자열을 참조키로 사용
- Eloquent Model: `Folder` (`App\Models\Folder`)

### 데이터 마이그레이션

기존 `categories` 테이블에서 `DISTINCT folder WHERE folder IS NOT NULL` + `user_id` 조합을 추출하여 `folders` 테이블로 이관. `__folder_placeholder__` 카테고리는 삭제.

---

## 이슈별 수정 계획

### 1. Select "all"/ID 표시 이슈 (회원 select, 폴더 select)

**원인**: `@base-ui/react` `Select.Value`가 optgroup 내 `SelectItem` 또는 `<span>` 감싼 `SelectItem`의 텍스트 콘텐츠를 제대로 추출하지 못해 value 문자열("all") 또는 회원 ID 숫자를 그대로 표시.

**수정**: `SelectValue`에 `render` prop을 사용하여 현재 선택값에 해당하는 표시 레이블을 매핑.

```tsx
// 회원 select
<SelectValue
  render={(value) => {
    if (!value || value === "all") return "전체";
    const u = users.find(u => String(u.id) === value);
    return u ? `${u.name} (${u.email})` : value;
  }}
/>

// 폴더 select
<SelectValue
  render={(value) => {
    if (!value || value === "all") return "전체";
    if (value === "기본폴더") return value;
    return value; // 폴더명 그대로
  }}
/>
```

`SelectValue` 컴포넌트 자체를 `render` prop을 받을 수 있도록 수정하거나, inline으로 처리.

### 2. 폴더 추가 시 NOT NULL 에러

`folders` 테이블 신설로 근본적 해결. `FolderController::store()`가 `Folder::create()` 사용.

### 3. 폴더 전용 테이블

위 "핵심 아키텍처 변경" 참조.

영향받는 파일:
- 신규: `laravel/app/Models/Folder.php`
- 신규: `laravel/database/migrations/2026_05_31_000000_create_folders_table.php`
- 수정: `laravel/app/Http/Controllers/Api/FolderController.php` — 모든 CRUD가 `Folder` 모델 사용
- 수정: `laravel/app/Http/Controllers/Api/CategoryController.php` — `getCategories`에서 `__folder_placeholder__` 필터 제거
- 수정: `laravel/app/Services/RecommendationService.php` — 동일
- 수정: `laravel/app/Models/Category.php` — auto-code 생성 로직에서 `__folder_placeholder__` 제외

### 4. 폴더 삭제 모달 — 빈 폴더 조건부 표시

`FolderDeleteModal`에서 `hasCategories === false`일 때:
- "기본폴더로 이동" / "카테고리도 함께 삭제" 두 선택항 숨김
- "이 폴더는 비어 있습니다. 폴더만 삭제됩니다." 메시지만 표시
- `onConfirm(true)` 호출 (moveToDefault 무의미)

### 5. 회원 "전체" optgroup

현재 `folder-section.tsx` 252-268행에 부분 구현됨. 조건: `isViewerAdmin && !selectedUserId && folderGroups.length > 0`

검증 포인트:
- "전체" + "기본폴더" 항목이 optgroup 밖과 각 optgroup 안에 모두 표시되는지
- `fetchFolders(token)` (userId 없이) 호출 시 `grouped` 응답 확인

### 6. "이동할 폴더 선택" optgroup 컨텍스트

```tsx
// 이동할 폴더 select 표시 로직
{isViewerAdmin && !selectedUserId ? (
  // 관리자가 회원 "전체" 선택 → optgroup으로 표시
  <>
    <SelectItem value="기본폴더">기본폴더</SelectItem>
    {folderGroups.map(group => (
      <optgroup key={group.user_id} label={group.user_name}>
        <SelectItem value="기본폴더">기본폴더</SelectItem>
        {group.folders.map(f => (
          <SelectItem key={f} value={f}>{f}</SelectItem>
        ))}
      </optgroup>
    ))}
  </>
) : (
  // 특정 회원 폴더 선택 시 → flat list
  <>
    <SelectItem value="기본폴더">기본폴더</SelectItem>
    {folders.map(f => (
      <SelectItem key={f} value={f}>{f}</SelectItem>
    ))}
  </>
)}
```

### 7. 폴더명 수정 input 통합

- Input 1개만 유지 (placeholder: "새 폴더명")
- "추가" 버튼(`FolderPlus`) + "수정" 버튼(`Pencil`) 나란히 배치
- 수정 버튼은 선택된 폴더가 "전체"나 "기본폴더"가 아닐 때만 활성화
- 수정 버튼 클릭 시: Input 값 → 기존 폴더명으로 pre-fill (사용자 편의), 확인 시 `renameFolder` 호출

### 8. "기능시연" 클릭 시 폴더 section 초기화

`FolderSection`에 `useEffect`로 `resetEmbedPage` 커스텀 이벤트 리스너 추가:

```tsx
useEffect(() => {
  const handleReset = () => {
    setSelectedUserId(null);
    onFolderChange(null);
    setNewFolderName("");
    setRenameTarget("");
    setRenameName("");
    setMoveTargetFolder("");
    setError(null);
  };
  window.addEventListener("resetEmbedPage", handleReset);
  return () => window.removeEventListener("resetEmbedPage", handleReset);
}, [onFolderChange]);
```

### 9. 폴더 select 변경 시 필터 초기화

현재 `onFolderChange` 콜백(`embed-page-inner.tsx` 554-571행)에서:
- ✅ `filterSelection = null` → 계층 필터 초기화
- ✅ `searchResults = null` → 검색 결과 초기화
- ❌ 유사도 검색 `searchText`도 초기화 중 → 유지해야 함
- ❌ "전체/내카테고리" 버튼 상태 초기화 → 유지해야 함

수정:
```tsx
onFolderChange={(folder) => {
  setSelectedFolder(folder);
  // 계층 필터만 초기화 (유사도 검색, 전체/내카테고리는 유지)
  setKeywordSearchActive(false);
  setHierarchyKeyword("");
  setHierarchyResetKey(prev => prev + 1);
  // page=1
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (perPage !== 20) params.set("per_page", String(perPage));
  router.replace(`/embed${params.toString() ? "?" + params.toString() : ""}`, { scroll: false });
  loadCategories(1, perPage, effectiveFilter, keywordRef.current, folder ?? undefined);
}}
```

`setFilterSelection(null)`, `setSearchResults(null)`, `setSearchText("")` 제거.

### 10. 회원 select ID 표시

이슈 #1과 동일한 원인. `SelectValue` `render` prop으로 해결.

---

## 영향받는 파일

| 파일 | 변경 |
|------|------|
| `laravel/database/migrations/2026_05_31_000000_create_folders_table.php` | 신규 |
| `laravel/app/Models/Folder.php` | 신규 |
| `laravel/app/Http/Controllers/Api/FolderController.php` | Folder 모델 사용, placeholder 제거 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | `__folder_placeholder__` 필터 제거 |
| `laravel/app/Services/RecommendationService.php` | `__folder_placeholder__` 필터 제거 |
| `laravel/app/Models/Category.php` | `__folder_placeholder__` 제외 |
| `laravel/routes/api.php` | 변경 없음 (컨트롤러 내부만 변경) |
| `nextjs/components/admin/folder-section.tsx` | SelectValue render, input 통합, reset 이벤트, 이동 select optgroup |
| `nextjs/components/admin/folder-delete-modal.tsx` | 빈 폴더 조건부 표시 |
| `nextjs/components/ui/select.tsx` | SelectValue render prop 지원 |
| `nextjs/app/embed/embed-page-inner.tsx` | onFolderChange 콜백 수정 |
| `nextjs/lib/api.ts` | Folder 모델 기반 API 업데이트 |
