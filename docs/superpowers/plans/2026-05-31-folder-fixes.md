# 폴더 기능 이슈 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `folders` 테이블 신설 및 폴더 기능 10개 이슈 일괄 수정

**Architecture:** 기존 `__folder_placeholder__` 더미 카테고리 방식 → 독립 `folders` 테이블(`user_id`, `name` unique) 기반으로 전환. 프론트엔드 `SelectValue` render prop 도입으로 "all"/ID 표시 이슈 해결, Input 통합, reset 이벤트, optgroup 컨텍스트 로직 보강.

**Tech Stack:** Laravel 11 (PHP 8.4, PostgreSQL), Next.js 16 (React 19, TypeScript 5, @base-ui/react, Tailwind CSS v4)

---

## 파일 구조

| 파일 | 작업 | 책임 |
|------|------|------|
| `laravel/database/migrations/2026_05_31_000001_create_folders_table.php` | Create | folders 테이블 생성 + 기존 데이터 마이그레이션 |
| `laravel/app/Models/Folder.php` | Create | Folder Eloquent 모델 |
| `laravel/app/Http/Controllers/Api/FolderController.php` | Modify | folders 테이블 기반 CRUD, placeholder 제거 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | Modify | `__folder_placeholder__` 필터 제거 |
| `laravel/app/Models/Category.php` | Modify | placeholder 제외 (필요 시) |
| `nextjs/components/ui/select.tsx` | Modify | SelectValue render prop 지원 |
| `nextjs/components/admin/folder-section.tsx` | Modify | SelectValue render, Input 통합, reset 이벤트, 이동 select optgroup |
| `nextjs/components/admin/folder-delete-modal.tsx` | Modify | 빈 폴더 조건부 표시 |
| `nextjs/app/embed/embed-page-inner.tsx` | Modify | onFolderChange 필터 초기화 범위 수정 |
| `nextjs/lib/api.ts` | Modify | `checkFolderHasCategories` 인자 수정 (모델 변경 대응) |

---

### Task 1: Playwright로 기존 이슈 사전 재현

**Files:** 없음 (테스트 전용)

- [ ] **Step 1: superadmin 토큰 발급**

```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::where("role","superadmin")->first()->createToken("debug")->plainTextToken;'
```

- [ ] **Step 2: Playwright로 embed 페이지 접속 및 쿠키 설정**

```ts
// playwright 스크립트에서
await page.goto('https://embed.cunlim.dev/embed');
await context.addCookies([{
  name: 'auth_token',
  value: '<TOKEN>',
  domain: 'embed.cunlim.dev',
  path: '/',
}]);
await page.goto('https://embed.cunlim.dev/embed');
```

- [ ] **Step 3: 이슈 #1, #10 재현 — Select "all"/ID 표시 확인**

회원 select와 폴더 select에서 "전체" 선택 후 닫힌 상태에서 "all"로 표시되는지 확인. 회원 select에서 특정 회원 선택 후 ID 숫자가 표시되는지 확인.

- [ ] **Step 4: 이슈 #2 재현 — 폴더 추가 시 NOT NULL 에러 확인**

폴더 추가 input에 새 폴더명 입력 후 추가 버튼 클릭. Network 탭 또는 콘솔에서 500 에러 응답 확인.

- [ ] **Step 5: 이슈 #5 재현 — 회원 "전체" optgroup 미작동 확인**

회원 select를 "전체"로 설정하고 폴더 select 펼쳐서 optgroup 표시 여부 확인.

- [ ] **Step 6: 이슈 #8 재현 — "기능시연" 클릭 후 폴더 section 초기화 안 됨 확인**

header의 "기능시연" 클릭 후 폴더 select 값이 초기화되지 않는지 확인.

- [ ] **Step 7: 이슈 #9 재현 — 폴더 변경 시 유사도 검색 초기화 확인**

유사도 검색 실행 → 폴더 변경 → 검색 결과가 사라지는지 확인.

---

### Task 2: folders 테이블 마이그레이션 생성

**Files:**
- Create: `laravel/database/migrations/2026_05_31_000001_create_folders_table.php`

- [ ] **Step 1: 마이그레이션 파일 작성**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. folders 테이블 생성
        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });

        // 2. 기존 categories에서 폴더 데이터 마이그레이션
        $folders = DB::table('categories')
            ->whereNotNull('folder')
            ->where('category_name_ko', '!=', '__folder_placeholder__')
            ->select('user_id', 'folder')
            ->distinct()
            ->get();

        foreach ($folders as $f) {
            DB::table('folders')->insertOrIgnore([
                'user_id' => $f->user_id,
                'name' => $f->folder,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. placeholder 더미 카테고리 삭제
        DB::table('categories')
            ->where('category_name_ko', '__folder_placeholder__')
            ->delete();
    }

    public function down(): void
    {
        // placeholder 복원 (폴더별 1개씩)
        $folders = DB::table('folders')->get();
        foreach ($folders as $f) {
            DB::table('categories')->insert([
                'user_id' => $f->user_id,
                'category_name_ko' => '__folder_placeholder__',
                'folder' => $f->name,
                'created_at' => $f->created_at,
                'updated_at' => $f->updated_at,
            ]);
        }

        Schema::dropIfExists('folders');
    }
};
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
docker exec cl_embed_laravel php artisan migrate
```

Expected: 마이그레이션 성공, `folders` 테이블 생성, placeholder 행 삭제.

- [ ] **Step 3: DB 상태 확인**

```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo "folders: " . \App\Models\Folder::count() . ", placeholders: " . \App\Models\Category::where("category_name_ko", "__folder_placeholder__")->count();'
```

Expected: `folders: <N>, placeholders: 0`

- [ ] **Step 4: 기존 테스트 실행确认**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=Folder
docker exec cl_embed_laravel php artisan test --compact
```

---

### Task 3: Folder 모델 생성

**Files:**
- Create: `laravel/app/Models/Folder.php`

- [ ] **Step 1: Folder 모델 작성**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'name'])]
class Folder extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
        ];
    }
}
```

- [ ] **Step 2: tinker로 모델 동작 확인**

```bash
docker exec cl_embed_laravel php artisan tinker --execute '$f = \App\Models\Folder::first(); echo $f ? "OK: {$f->name}" : "no folders yet";'
```

---

### Task 4: FolderController 리팩토링

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/FolderController.php`

- [ ] **Step 1: index() — folders 테이블 기반 조회로 변경**

```php
public function index(Request $request): JsonResponse
{
    /** @var User|null $user */
    $user = $request->user('sanctum');

    if (! $user) {
        return response()->json(['message' => '인증이 필요합니다.'], 401);
    }

    $userId = $request->input('user_id');

    $query = Folder::query()->select('name')->orderBy('name');

    $grouped = null;

    if ($user->isAdmin()) {
        if ($userId) {
            $query->where('user_id', (int) $userId);
        } else {
            // 전체 회원: grouped 데이터 함께 반환
            $grouped = Folder::query()
                ->join('users', 'folders.user_id', '=', 'users.id')
                ->select('folders.name', 'folders.user_id', 'users.name as user_name')
                ->orderBy('folders.user_id')
                ->orderBy('folders.name')
                ->get()
                ->groupBy('user_id')
                ->map(fn ($items, $uid) => [
                    'user_id' => (int) $uid,
                    'user_name' => $items->first()->user_name ?? '알 수 없음',
                    'folders' => $items->pluck('name')->toArray(),
                ])
                ->values()
                ->toArray();
        }
    } else {
        $query->where('user_id', $user->id);
    }

    $folders = $query->pluck('name');

    $result = ['data' => $folders];
    if ($grouped !== null) {
        $result['grouped'] = $grouped;
    }

    return response()->json($result);
}
```

- [ ] **Step 2: store() — Folder::create()로 변경**

```php
public function store(Request $request): JsonResponse
{
    /** @var User|null $user */
    $user = $request->user('sanctum');

    if (! $user) {
        return response()->json(['message' => '인증이 필요합니다.'], 401);
    }

    $folderName = trim($request->input('folder_name', ''));
    if ($folderName === '') {
        return response()->json(['message' => '폴더명을 입력해주세요.'], 422);
    }

    $reserved = ['기본폴더', '전체'];
    if (in_array($folderName, $reserved, true)) {
        return response()->json(['message' => "'{$folderName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
    }

    $userId = $user->isAdmin() ? (int) $request->input('user_id', $user->id) : $user->id;

    $exists = Folder::where('user_id', $userId)->where('name', $folderName)->exists();
    if ($exists) {
        return response()->json(['message' => '이미 존재하는 폴더명입니다.'], 422);
    }

    Folder::create([
        'user_id' => $userId,
        'name' => $folderName,
    ]);

    return response()->json(['message' => "폴더 '{$folderName}'이(가) 생성되었습니다."], 201);
}
```

- [ ] **Step 3: update() — Folder 모델 사용**

```php
public function update(Request $request, string $folderName): JsonResponse
{
    /** @var User $user */
    $user = $request->user('sanctum');

    $newName = trim($request->input('new_name', ''));
    if ($newName === '') {
        return response()->json(['message' => '새 폴더명을 입력해주세요.'], 422);
    }

    $reserved = ['기본폴더', '전체'];
    if (in_array($newName, $reserved, true)) {
        return response()->json(['message' => "'{$newName}'은(는) 사용할 수 없는 폴더명입니다."], 422);
    }

    $userId = (int) $request->input('user_id', $user->id);

    $folder = Folder::where('user_id', $userId)->where('name', $folderName)->first();
    if (! $folder) {
        return response()->json(['message' => '해당 폴더를 찾을 수 없습니다.'], 404);
    }

    // 중복명 확인
    $dupExists = Folder::where('user_id', $userId)->where('name', $newName)
        ->where('id', '!=', $folder->id)->exists();
    if ($dupExists) {
        return response()->json(['message' => '이미 존재하는 폴더명입니다.'], 422);
    }

    $folder->update(['name' => $newName]);

    // categories.folder도 함께 업데이트
    Category::where('folder', $folderName)->where('user_id', $userId)
        ->update(['folder' => $newName]);

    return response()->json([
        'message' => "폴더명이 '{$folderName}'에서 '{$newName}'(으)로 변경되었습니다.",
    ]);
}
```

- [ ] **Step 4: destroy() — Folder 모델 사용**

```php
public function destroy(FolderDeleteRequest $request, string $folderName): JsonResponse
{
    /** @var User $user */
    $user = $request->user('sanctum');
    $userId = (int) $request->input('user_id', $user->id);
    $moveToDefault = $request->boolean('move_to_default', true);

    if (! $user->isAdmin() && $userId !== $user->id) {
        return response()->json(['message' => '이 회원의 폴더를 삭제할 권한이 없습니다.'], 403);
    }

    // Folder 존재 확인
    $folder = Folder::where('user_id', $userId)->where('name', $folderName)->first();
    if (! $folder) {
        return response()->json(['message' => '해당 폴더를 찾을 수 없습니다.'], 404);
    }

    $catQuery = Category::where('folder', $folderName)->where('user_id', $userId);
    $count = $catQuery->count();

    if ($moveToDefault) {
        // 기본폴더로 이동 (folder = null)
        $catQuery->update(['folder' => null]);
    } else {
        // 카테고리도 함께 삭제
        $catIds = $catQuery->pluck('id');
        Category::whereIn('id', $catIds)->delete();
    }

    // Folder 레코드 삭제
    $folder->delete();

    return response()->json([
        'message' => "폴더 '{$folderName}'이(가) 삭제되었습니다." .
            ($count > 0 ? " {$count}개 카테고리 " . ($moveToDefault ? "기본폴더로 이동" : "삭제") : ""),
    ]);
}
```

- [ ] **Step 5: hasCategories() — Folder 모델 사용, 실제 카테고리 count 조회**

```php
public function hasCategories(Request $request, string $folderName): JsonResponse
{
    /** @var User|null $user */
    $user = $request->user('sanctum');

    if (! $user) {
        return response()->json(['message' => '인증이 필요합니다.'], 401);
    }

    $userId = (int) $request->input('user_id', $user->id);

    $count = Category::where('folder', $folderName)
        ->where('user_id', $userId)
        ->count();

    return response()->json([
        'data' => [
            'has_categories' => $count > 0,
            'count' => $count,
        ],
    ]);
}
```

- [ ] **Step 6: add use statement for Folder model**

Controller 상단에 `use App\Models\Folder;` 추가.

---

### Task 5: CategoryController에서 `__folder_placeholder__` 필터 제거

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`

- [ ] **Step 1: 필터 제거**

기존 `where('category_name_ko', '!=', '__folder_placeholder__')` 조건을 삭제.

73행:
```php
// Before
$query = Category::query()->with('embeddings')->where('category_name_ko', '!=', '__folder_placeholder__');
// After
$query = Category::query()->with('embeddings');
```

149행:
```php
// Before
$scopeQuery = Category::query()->where('category_name_ko', '!=', '__folder_placeholder__');
// After
$scopeQuery = Category::query();
```

---

### Task 6: SelectValue render prop 지원

**Files:**
- Modify: `nextjs/components/ui/select.tsx`

- [ ] **Step 1: SelectValue 컴포넌트에 render prop 추가**

`SelectValue` 함수를 다음과 같이 수정:

```tsx
function SelectValue({
  className,
  render,
  children,
  ...props
}: SelectPrimitive.Value.Props & {
  render?: (value: string) => React.ReactNode;
}) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      render={render}
      {...props}
    >
      {children}
    </SelectPrimitive.Value>
  );
}
```

> **참고**: `render` prop은 `SelectPrimitive.Value.Props`에 이미 `render`가 포함되어 있을 수 있음. type 충돌 시 `Omit<SelectPrimitive.Value.Props, 'render'>` 사용.

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

---

### Task 7: folder-section.tsx — SelectValue render + Input 통합 + reset 이벤트 + 이동 select optgroup

**Files:**
- Modify: `nextjs/components/admin/folder-section.tsx`

- [ ] **Step 1: 회원 select SelectValue에 render prop 적용**

회원 select (208-227행 영역):
```tsx
<Select
  value={selectedUserId ? String(selectedUserId) : "all"}
  onValueChange={handleUserChange}
>
  <SelectTrigger className="w-full">
    <SelectValue
      render={(value) => {
        if (!value || value === "all") return <span>전체</span>;
        const u = users.find(u => String(u.id) === value);
        if (u) return <span>{u.name} ({u.email})</span>;
        return <span>{value}</span>;
      }}
    />
  </SelectTrigger>
  ...
```

- [ ] **Step 2: 폴더 select SelectValue에 render prop 적용**

폴더 select (234-276행 영역):
```tsx
<Select
  value={selectedFolder ?? ALL_FOLDERS_VALUE}
  onValueChange={(value) =>
    onFolderChange(value === ALL_FOLDERS_VALUE ? null : value)
  }
>
  <SelectTrigger className="w-full">
    <SelectValue
      render={(value) => {
        if (!value || value === ALL_FOLDERS_VALUE) return <span className="italic text-muted-foreground">전체</span>;
        if (value === DEFAULT_FOLDER_LABEL) return <span className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</span>;
        return <span>{value}</span>;
      }}
    />
  </SelectTrigger>
  ...
```

- [ ] **Step 3: 폴더 추가/수정 Input 통합**

기존 2개의 Input + Button 구조를 1개의 Input + 2개의 Button으로 통합:

```tsx
{/* 폴더 추가 + 수정 */}
<div className="flex gap-2">
  <Input
    placeholder="새 폴더명"
    value={newFolderName}
    onChange={(e) => {
      setNewFolderName(e.target.value);
      setError(null);
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        if (renameTarget) {
          handleRenameFolder();
        } else {
          handleAddFolder();
        }
      }
    }}
    className="h-8 text-sm"
  />
  <Button
    size="sm"
    onClick={handleAddFolder}
    disabled={!newFolderName.trim()}
    className="h-8 shrink-0"
  >
    <FolderPlus className="h-3.5 w-3.5" />
  </Button>
  {selectedFolder &&
    selectedFolder !== ALL_FOLDERS_VALUE &&
    selectedFolder !== DEFAULT_FOLDER_LABEL && (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setRenameTarget(selectedFolder);
          setRenameName(selectedFolder); // 기존 폴더명 pre-fill
          setNewFolderName(selectedFolder); // input에도 표시
        }}
        className="h-8 shrink-0"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
  )}
</div>
```

`handleRenameFolder`가 `newFolderName`을 사용하도록 수정하고, `renameName` state 제거:

```tsx
const handleRenameFolder = useCallback(async () => {
  if (!token || !renameTarget || !newFolderName.trim()) return;
  // ... rename 로직 (newFolderName 사용)
  try {
    await renameFolder(renameTarget, newFolderName.trim(), token, selectedUserId);
    setRenameTarget("");
    setNewFolderName(""); // input 초기화
    setError(null);
    await loadFolders();
    if (selectedFolder === renameTarget) {
      onFolderChange(newFolderName.trim());
    }
    onFolderActionComplete();
  } catch (err) {
    setError(err instanceof Error ? err.message : "폴더명 수정 실패");
  }
}, [token, renameTarget, newFolderName, selectedUserId, loadFolders, selectedFolder, onFolderChange, onFolderActionComplete]);
```

- [ ] **Step 4: "기능시연" reset 이벤트 리스너 추가**

```tsx
// resetEmbedPage 커스텀 이벤트 수신
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

- [ ] **Step 5: "이동할 폴더 선택" select optgroup 컨텍스트 적용**

이동 select (337-351행) 수정:

```tsx
<SelectContent>
  {isViewerAdmin && !selectedUserId ? (
    // 관리자 + 회원 "전체" → optgroup 표시
    <>
      <SelectItem value={DEFAULT_FOLDER_LABEL}>
        {DEFAULT_FOLDER_LABEL}
      </SelectItem>
      {folderGroups.map((group) => (
        <optgroup key={group.user_id} label={group.user_name}>
          <SelectItem value={DEFAULT_FOLDER_LABEL}>
            {DEFAULT_FOLDER_LABEL}
          </SelectItem>
          {group.folders.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </optgroup>
      ))}
    </>
  ) : (
    // 특정 회원 or 일반 회원 → flat list
    <>
      <SelectItem value={DEFAULT_FOLDER_LABEL}>
        {DEFAULT_FOLDER_LABEL}
      </SelectItem>
      {folders.map((f) => (
        <SelectItem key={f} value={f}>
          {f}
        </SelectItem>
      ))}
    </>
  )}
</SelectContent>
```

- [ ] **Step 6: 사용하지 않는 state 정리**

`renameName` state 제거, `renameTarget`만 유지.

- [ ] **Step 7: tsc + lint 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
docker exec cl_embed_nextjs npx eslint components/admin/folder-section.tsx --max-warnings=0
```

---

### Task 8: folder-delete-modal.tsx — 빈 폴더 조건부 표시

**Files:**
- Modify: `nextjs/components/admin/folder-delete-modal.tsx`

- [ ] **Step 1: 빈 폴더일 때 두 선택항 숨김**

`hasCategories === false` 분기에 두 radio-style 버튼을 숨기고 메시지만 표시:

```tsx
{hasCategories === null ? (
  <p className="text-sm text-muted-foreground">확인 중...</p>
) : hasCategories ? (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">
      이 폴더에는 {categoryCount}개의 카테고리가 있습니다.
    </p>
    {/* 기존 두 선택항 유지 */}
    <button type="button" onClick={() => setMoveToDefault(true)} ...>
      기본폴더로 이동
    </button>
    <button type="button" onClick={() => setMoveToDefault(false)} ...>
      카테고리도 함께 삭제
    </button>
  </div>
) : (
  <p className="text-sm text-muted-foreground">
    이 폴더는 비어 있습니다. 확인 클릭 시 폴더가 삭제됩니다.
  </p>
)}
```

`onConfirm` 호출 시 빈 폴더인 경우 `moveToDefault` 관계없이 true 전달 (FolderController에서 Folder 레코드만 삭제).

- [ ] **Step 2: tsc + lint 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
docker exec cl_embed_nextjs npx eslint components/admin/folder-delete-modal.tsx --max-warnings=0
```

---

### Task 9: embed-page-inner.tsx — onFolderChange 필터 초기화 범위 수정

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: onFolderChange 콜백 수정**

554-571행의 `onFolderChange` 콜백에서 `setFilterSelection(null)`, `setSearchResults(null)`, `setSearchText("")` 제거. 유사도 검색과 전체/내카테고리는 보존:

```tsx
onFolderChange={(folder) => {
  setSelectedFolder(folder);
  // 계층 필터만 초기화 (유사도 검색, 전체/내카테고리, 검색어는 유지)
  setKeywordSearchActive(false);
  setHierarchyKeyword("");
  keywordRef.current = "";
  setHierarchyResetKey(prev => prev + 1);
  // page=1, per_page 유지
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (perPage !== 20) params.set("per_page", String(perPage));
  router.replace(`/embed${params.toString() ? "?" + params.toString() : ""}`, { scroll: false });
  // 폴더 범위로 카테고리 재로드 (기존 필터 유지)
  loadCategories(1, perPage, effectiveFilter, keywordRef.current, folder ?? undefined);
  // 시맨틱 검색 활성 상태면 재검색
  if (searchResultsRef.current !== null) {
    handleSearchRef.current(1);
  }
}}
```

- [ ] **Step 2: tsc + lint 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
docker exec cl_embed_nextjs npx eslint app/embed/embed-page-inner.tsx --max-warnings=0
```

---

### Task 10: api.ts — checkFolderHasCategories 인자 정리

**Files:**
- Modify: `nextjs/lib/api.ts`

`checkFolderHasCategories` 함수 내 `userId`가 `undefined`일 때 `user_id` 파라미터를 전송하지 않도록 (기존과 동일하게 유지, 모델 변경과 무관). 변경 없을 가능성 높음 — 확인 후 필요 시만 수정.

---

### Task 11: Laravel 테스트 확인 및 수정

**Files:**
- `laravel/tests/Feature/CategoryControllerTest.php` 또는 유관 테스트

- [ ] **Step 1: 기존 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

- [ ] **Step 2: FolderController 관련 테스트 실행 (있는 경우)**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=Folder
```

- [ ] **Step 3: 실패 테스트 수정**

`__folder_placeholder__` 관련 assertion이 있는 테스트를 새로운 `folders` 테이블 기반으로 업데이트.

---

### Task 12: 전체 검증

- [ ] **Step 1: run-all-checks.sh 실행**

```bash
bash /var/app/www/cl_embed/.claude/hooks/run-all-checks.sh
```

- [ ] **Step 2: 결과 확인**

```bash
cat /var/app/www/cl_embed/.claude/hooks/test-results/*.txt
```

Expected: tsc, lint, test, pint 모두 EXIT=0.

- [ ] **Step 3: Playwright로 수정 확인**

수정된 모든 이슈가 해결되었는지 Playwright로 확인:
1. Select "전체" → 표시 텍스트 확인
2. 회원 select → 회원명 표시 확인
3. 폴더 추가 → 성공 확인 (500 에러 없음)
4. 회원 "전체" → 폴더 optgroup 표시 확인
5. 폴더 "전체"/"기본폴더" → 이동 select optgroup 확인
6. 폴더 변경 → 유사도 검색 유지 확인
7. "기능시연" → 폴더 section 초기화 확인

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: 폴더 기능 10개 이슈 수정 및 folders 테이블 신설

- folders 테이블 신설 (user_id + name unique)로 빈 폴더 유지 가능
- SelectValue render prop으로 'all'/ID 표시 이슈 해결
- 폴더 추가/수정 Input 통합
- 기능시연 클릭 시 폴더 section 초기화
- 폴더 변경 시 유사도 검색·전체/내카테고리 보존
- 폴더 삭제 모달 빈 폴더 조건부 표시
- 이동할 폴더 select optgroup 컨텍스트 적용

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
