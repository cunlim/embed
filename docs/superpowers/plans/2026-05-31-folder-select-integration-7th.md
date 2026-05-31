# 폴더 Select 통합 7차 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지의 회원 Select를 제거하고 폴더 Select에 통합. 관리자는 optgroup, 일반회원은 flat list. URL에 `user_id` 파라미터 추가.

**Architecture:** folder-section.tsx에서 회원 Select UI 제거, 폴더/이동폴더 Select를 역할 기반으로 분기 렌더링. FolderController에 user_email 추가. URL 파라미터로 user_id 전파.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Base UI Select, Laravel 11, PostgreSQL

---

### Task 1: Backend — FolderController grouped 응답에 user_email 추가

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/FolderController.php:42-54`

- [ ] **Step 1: grouped 쿼리에 users.email 추가**

`FolderController::index()`의 grouped 쿼리에서 `users.email as user_email`을 select에 추가한다:

```php
// Before (line 43-44):
$grouped = Folder::query()
    ->join('users', 'folders.user_id', '=', 'users.id')
    ->select('folders.name', 'folders.user_id', 'users.name as user_name')

// After:
$grouped = Folder::query()
    ->join('users', 'folders.user_id', '=', 'users.id')
    ->select('folders.name', 'folders.user_id', 'users.name as user_name', 'users.email as user_email')
```

- [ ] **Step 2: Run Pint and tests**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
docker exec cl_embed_laravel php artisan test --compact --filter=Folder
```

Expected: 기존 테스트 통과 확인.

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Http/Controllers/Api/FolderController.php
git commit -m "feat: FolderController grouped 응답에 user_email 추가"
```

---

### Task 2: Frontend — FolderGroup 인터페이스에 user_email 추가

**Files:**
- Modify: `nextjs/lib/api.ts:412-416`

- [ ] **Step 1: FolderGroup 인터페이스 업데이트**

```ts
// Before:
export interface FolderGroup {
  user_id: number;
  user_name: string;
  folders: string[];
}

// After:
export interface FolderGroup {
  user_id: number;
  user_name: string;
  user_email: string;
  folders: string[];
}
```

- [ ] **Step 2: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: FolderGroup 인터페이스에 user_email 추가"
```

---

### Task 3: Frontend — EmbedParams에 userId 추가 및 URL 파라미터 처리

**Files:**
- Modify: `nextjs/lib/embed-params.ts`

- [ ] **Step 1: EmbedParams에 userId 필드 추가 및 파싱**

`parseEmbedParams()` 함수에 `user_id` URL 파라미터 파싱을 추가한다:

```ts
// EmbedParams 인터페이스에 추가:
export interface EmbedParams {
  // ... 기존 필드 ...
  folder: string | null;
  /** 폴더 소유 회원 ID (관리자가 다른 회원의 폴더 선택 시) */
  userId: string | null;
}

// parseEmbedParams() 반환값에 추가:
const userId = params.get("user_id") || null;

return { mode, keyword, filter, searchText, searchLang, catPath, folder, userId };
```

- [ ] **Step 2: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: `parseEmbedKeyword`에서 `userId` 누락 경고가 있을 수 있음. 해당 함수는 `@deprecated`이므로 무시하거나 spread에서 `userId`만 제외한 rest를 사용하도록 수정. 그 외 EXIT=0.

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/embed-params.ts
git commit -m "feat: EmbedParams에 userId 필드 추가 및 URL 파싱"
```

---

### Task 4: Frontend — SSR page.tsx 수정 (user_id, grouped 폴더, fetchUsers 확장)

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: URL에서 userId 파싱 및 serverUserId 전달**

```ts
// line 26: userId 추가
const { keyword, searchText, searchLang, filter: urlFilter, folder: urlFolder, userId: urlUserId } = parseEmbedParams(reader);

// line 107-114: SSR 폴더 prefetch — grouped 데이터도 추출
let serverFolders: string[] = [];
let serverFolderGroups: import("@/lib/api").FolderGroup[] = [];
if (token) {
  try {
    const foldersRes = await fetchFolders(token);
    serverFolders = foldersRes.data;
    serverFolderGroups = foldersRes.grouped ?? [];
  } catch {}
}

// line 116-123: fetchUsers를 admin으로 확장 (superadmin → admin)
let serverUsers: { id: number; name: string; email: string }[] = [];
if (token && serverUser && (serverUser.role === "superadmin" || serverUser.role === "admin")) {
  try {
    const usersRes = await fetchUsers(token);
    serverUsers = usersRes.data;
  } catch {}
}

// EmbedPageInner props에 추가:
serverUserId={urlUserId}
serverFolderGroups={serverFolderGroups}
```

- [ ] **Step 2: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EmbedPageInner props 타입 불일치. Task 5에서 수정 예정이므로 일단 확인만 하고 넘어감.

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "feat: SSR에서 userId 파싱, grouped 폴더, admin fetchUsers 확장"
```

---

### Task 5: Frontend — EmbedPageInner에 selectedUserId 상태 및 URL 동기화

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: Props 타입에 serverUserId, serverFolderGroups 추가**

```ts
// Props destructuring에 추가:
serverUserId,
serverFolderGroups,

// Props 타입에 추가:
serverUserId?: string | null;
serverFolderGroups?: import("@/lib/api").FolderGroup[];
```

- [ ] **Step 2: selectedUserId 상태 추가**

```ts
// line 167 근처 selectedFolder 상태 아래에 추가:
const [selectedUserId, setSelectedUserId] = useState<number | null>(
  serverUserId ? parseInt(serverUserId, 10) : null
);
const selectedUserIdRef = useRef(selectedUserId);
// eslint-disable-next-line react-hooks/refs
selectedUserIdRef.current = selectedUserId;
```

- [ ] **Step 3: updateURL에 user_id 처리 추가**

```ts
// updateURL overrides 타입에 추가:
userId?: number | null;

// updateURL 함수 본문에 추가 (folder 처리 근처):
if ("userId" in overrides) {
  if (overrides.userId) params.set("user_id", String(overrides.userId));
  else params.delete("user_id");
}
```

- [ ] **Step 4: onFolderChange 콜백 수정 — user_id URL 반영**

```ts
// line 557-571 onFolderChange 콜백 수정:
onFolderChange={(folder, userId) => {
  setSelectedFolder(folder);
  if (userId !== undefined) {
    setSelectedUserId(userId);
  }
  setKeywordSearchActive(false);
  setHierarchyKeyword("");
  keywordRef.current = "";
  setHierarchyResetKey(prev => prev + 1);
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (userId) params.set("user_id", String(userId));
  if (perPage !== 20) params.set("per_page", String(perPage));
  router.replace(`/embed${params.toString() ? "?" + params.toString() : ""}`, { scroll: false });
  loadCategories(1, perPage, effectiveFilter, keywordRef.current, folder ?? undefined);
}}
```

- [ ] **Step 5: FolderSection props에 serverFolderGroups, selectedUserId, onFolderChange 시그니처 반영**

```ts
<FolderSection
  token={token}
  user={effectiveUser ?? null}
  selectedFolder={selectedFolder}
  initialUserId={selectedUserId}
  selectedIds={selectedIds}
  serverFolders={serverFolders}
  serverFolderGroups={serverFolderGroups}
  serverUsers={serverUsers}
  onFolderChange={(folder, userId) => {
    // ... 위 Step 4의 콜백 내용 ...
  }}
  onFolderActionComplete={() => {
    setSelectedIds(new Set());
    loadCategories(page, perPage, effectiveFilter, keywordRef.current, selectedFolderRef.current ?? undefined);
  }}
/>
```

- [ ] **Step 6: 기존 onFolderChange 호출부 확인**

`embed-page-inner.tsx`에서 `onFolderChange(null)` 호출이 있다면 `onFolderChange(null, null)`로 업데이트.

- [ ] **Step 7: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: FolderSection props 타입 불일치 — Task 6에서 수정. 그 외 EXIT=0.

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: EmbedPageInner에 selectedUserId, user_id URL 동기화 추가"
```

---

### Task 6: Frontend — FolderSection 통합 (회원 Select 제거, 폴더/이동폴더 Select 통합)

**Files:**
- Modify: `nextjs/components/admin/folder-section.tsx`

이 Task가 가장 큰 변경이다. 순서대로 진행한다.

- [ ] **Step 1: Props 인터페이스 업데이트**

```ts
interface FolderSectionProps {
  token: string | null;
  user: import("@/lib/api").User | null;
  selectedFolder: string | null;
  initialUserId?: number | null;
  selectedIds: Set<number>;
  serverFolders?: string[];
  serverFolderGroups?: import("@/lib/api").FolderGroup[];
  serverUsers?: { id: number; name: string; email: string }[];
  onFolderChange: (folder: string | null, userId: number | null) => void;
  onFolderActionComplete: () => void;
}
```

Props destructuring에 `initialUserId`, `serverFolderGroups` 추가. `onFolderChange` 시그니처를 `(folder, userId) => void`로 변경.

```ts
export default function FolderSection({
  token,
  user,
  selectedFolder,
  initialUserId,
  selectedIds,
  serverFolders = [],
  serverFolderGroups = [],
  serverUsers = [],
  onFolderChange,
  onFolderActionComplete,
}: FolderSectionProps) {
```

- [ ] **Step 2: serverFolderGroups로 folderGroups 초기화**

기존 `useState<FolderGroup[]>([])` → `useState<FolderGroup[]>(serverFolderGroups ?? [])`:

```ts
const [folderGroups, setFolderGroups] = useState<FolderGroup[]>(serverFolderGroups ?? []);
```

- [ ] **Step 3: 회원 Select 제거**

`{isViewerAdmin && ( ... )}` 블록(현재 line 230-257) 전체 삭제.

- [ ] **Step 4: selectedUserId 상태를 props에서 초기화**

`selectedUserId`는 FolderSection 내부 상태로 유지 (폴더 CRUD API 호출에 필요). `initialUserId` prop으로 초기값만 받는다.

```ts
// Before:
const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

// After:
const [selectedUserId, setSelectedUserId] = useState<number | null>(initialUserId ?? null);
```

`handleUserChange` 함수 제거 (더 이상 사용되지 않음).

- [ ] **Step 5: 폴더 Select — showLabels 조건 제거, label "폴더" 제거**

```ts
// Before (line 220-221):
const showLabels = isViewerAdmin;

// After: showLabels 변수 삭제

// 폴더 Select wrapper (line 260-261):
// Before:
<div className="space-y-1">
  {showLabels && <Label className="text-xs">폴더</Label>}

// After:
<div className="space-y-1">
```

- [ ] **Step 6: 폴더 Select — SelectValue render 수정 (회원명/폴더명 표시)**

```tsx
<SelectValue
  render={(value) => {
    const v = String(value ?? "");
    // 선택 안 됨 → placeholder
    if (!v || v === ALL_FOLDERS_VALUE) {
      return <span className="italic text-muted-foreground truncate">전체</span>;
    }
    // composite value 파싱: "폴더명:user_id" 또는 "all:user_id" 또는 "기본폴더:user_id"
    if (v.includes(":")) {
      const [prefix, uidStr] = v.split(":");
      const uid = Number(uidStr);
      // folderGroups에서 user_name 조회
      const group = folderGroups.find(g => g.user_id === uid);
      const userName = group?.user_name ?? serverUsers?.find(u => u.id === uid)?.name ?? `회원#${uid}`;
      const folderDisplay = prefix === "all" ? "전체" : prefix === DEFAULT_FOLDER_LABEL ? DEFAULT_FOLDER_LABEL : prefix;
      if (isViewerAdmin) {
        return <span className="truncate">{userName} / {folderDisplay}</span>;
      }
      return <span className="italic text-muted-foreground truncate">{folderDisplay}</span>;
    }
    // 일반 폴더명
    if (v === DEFAULT_FOLDER_LABEL) {
      if (isViewerAdmin && selectedUserId) {
        const group = folderGroups.find(g => g.user_id === selectedUserId);
        const userName = group?.user_name ?? "";
        return <span className="italic text-muted-foreground truncate">{userName} / {v}</span>;
      }
      return <span className="italic text-muted-foreground truncate">{v}</span>;
    }
    // 관리자면 회원명/폴더명, 일반이면 폴더명만
    if (isViewerAdmin && selectedUserId) {
      const group = folderGroups.find(g => g.user_id === selectedUserId);
      const userName = group?.user_name ?? "";
      return <span className="truncate">{userName} / {v}</span>;
    }
    return <span className="truncate">{v}</span>;
  }}
/>
```

- [ ] **Step 7: 폴더 Select — onValueChange 수정 (user_id 콜백 전달)**

```ts
onValueChange={(value) => {
  if (value && value.includes(":")) {
    const [prefix, userIdStr] = value.split(":");
    const uid = Number(userIdStr);
    selectedUserIdRef.current = uid;
    setSelectedUserId(uid);
    if (prefix === "all") {
      onFolderChange(null, uid);
    } else {
      // "기본폴더:user_id" → folder="기본폴더", userId=uid
      onFolderChange(DEFAULT_FOLDER_LABEL, uid);
    }
    return;
  }
  // top-level "전체" 선택
  if (value === ALL_FOLDERS_VALUE) {
    setSelectedUserId(null);
    onFolderChange(null, null);
    return;
  }
  // top-level "기본폴더" 선택
  if (value === DEFAULT_FOLDER_LABEL) {
    onFolderChange(DEFAULT_FOLDER_LABEL, null);
    return;
  }
  // 일반 폴더 선택 (flat list에서)
  onFolderChange(value, selectedUserId);
}}
```

- [ ] **Step 8: 폴더 Select — SelectContent 수정 (항상 optgroup for admin)**

```tsx
<SelectContent>
  {isViewerAdmin ? (
    // 관리자: 항상 optgroup 표시 (전체 회원)
    folderGroups.length > 0 ? (
      folderGroups.map((group, idx) => (
        <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
          <SelectLabel>{group.user_name} ({group.user_email})</SelectLabel>
          <SelectItem value={`all:${group.user_id}`} className="italic text-muted-foreground truncate">전체</SelectItem>
          <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
          {group.folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
            <SelectItem key={f} value={`${f}:${group.user_id}`} className="truncate">
              {f}
            </SelectItem>
          ))}
        </SelectGroup>
      ))
    ) : (
      // folderGroups가 아직 로드되지 않은 경우 fallback
      <>
        <SelectItem value={ALL_FOLDERS_VALUE} className="italic text-muted-foreground truncate">전체</SelectItem>
        <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
        {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
          <SelectItem key={f} value={f} className="truncate">
            {f}
          </SelectItem>
        ))}
      </>
    )
  ) : (
    // 일반 회원: flat list
    <>
      <SelectItem value={ALL_FOLDERS_VALUE} className="italic text-muted-foreground truncate">전체</SelectItem>
      <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
      {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
        <SelectItem key={f} value={f} className="truncate">
          {f}
        </SelectItem>
      ))}
    </>
  )}
</SelectContent>
```

**중요**: 관리자의 optgroup 내 모든 폴더 항목에 composite value(`폴더명:user_id`)를 사용해야 value 충돌이 없다. "기본폴더"는 DB에 실제 존재하지 않으므로 `group.folders`에 포함되지 않을 수 있음 — `filter(f => f !== DEFAULT_FOLDER_LABEL)`로 안전하게 필터링.

- [ ] **Step 9: 폴더 Select — value prop 수정**

```ts
// Before:
value={selectedFolder ?? ALL_FOLDERS_VALUE}

// After: selectedUserId가 있으면 composite value 사용
value={
  selectedUserId !== null
    ? (selectedFolder ?? "all") + ":" + selectedUserId
    : (selectedFolder ?? ALL_FOLDERS_VALUE)
}
```

- [ ] **Step 10: 이동할 폴더 Select — 동일 규칙 적용**

현재 line 395-435의 이동할 폴더 Select도 동일하게 수정. 차이점:
- "전체" 옵션 없음
- placeholder "이동할 폴더 선택" 유지
- `DEFAULT_FOLDER_LABEL`은 composite value 사용

```tsx
<Select value={moveTargetFolder} onValueChange={(v) => setMoveTargetFolder(v ?? "")}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="이동할 폴더 선택" />
  </SelectTrigger>
  <SelectContent>
    {isViewerAdmin ? (
      folderGroups.length > 0 ? (
        folderGroups.map((group, idx) => (
          <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
            <SelectLabel>{group.user_name} ({group.user_email})</SelectLabel>
            <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic text-muted-foreground">
              {DEFAULT_FOLDER_LABEL}
            </SelectItem>
            {group.folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
              <SelectItem key={f} value={`${f}:${group.user_id}`}>
                {f}
              </SelectItem>
            ))}
          </SelectGroup>
        ))
      ) : (
        <>
          <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</SelectItem>
          {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
        </>
      )
    ) : (
      <>
        <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</SelectItem>
        {folders.filter(f => f !== DEFAULT_FOLDER_LABEL).map((f) => (
          <SelectItem key={f} value={f}>{f}</SelectItem>
        ))}
      </>
    )}
  </SelectContent>
</Select>
```

- [ ] **Step 11: handleMoveSelected, handleMoveAll — 이동할 폴더 composite value 파싱**

`moveTargetFolder`가 composite value(`폴더명:user_id`)일 수 있으므로 이동 시 파싱 필요:

```ts
const handleMoveSelected = useCallback(async () => {
  if (!token || selectedIds.size === 0) return;
  // composite value 파싱
  let targetFolder = moveTargetFolder;
  if (targetFolder && targetFolder.includes(":")) {
    const [name] = targetFolder.split(":");
    targetFolder = name === DEFAULT_FOLDER_LABEL ? null : name;
  }
  const target = targetFolder === DEFAULT_FOLDER_LABEL ? null : targetFolder || null;
  try {
    await moveCategoriesToFolder(Array.from(selectedIds), target, token);
    setMoveTargetFolder("");
    await loadFolders();
    onFolderActionComplete();
  } catch (err) {
    setError(err instanceof Error ? err.message : "폴더 이동 실패");
  }
}, [token, selectedIds, moveTargetFolder, loadFolders, onFolderActionComplete]);
```

`handleMoveAll`도 동일하게 수정.

- [ ] **Step 12: "기능시연" reset effect 업데이트**

```ts
useEffect(() => {
  const handleReset = () => {
    setSelectedUserId(null);
    onFolderChange(null, null);
    setNewFolderName("");
    setRenameTarget("");
    setMoveTargetFolder("");
    setError(null);
  };
  window.addEventListener("resetEmbedPage", handleReset);
  return () => window.removeEventListener("resetEmbedPage", handleReset);
}, [onFolderChange]);
```

- [ ] **Step 13: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 모든 타입 불일치 해결, EXIT=0.

- [ ] **Step 14: Commit**

```bash
git add nextjs/components/admin/folder-section.tsx
git commit -m "feat: 회원 Select 제거, 폴더/이동폴더 Select optgroup 통합"
```

---

### Task 7: Frontend — 테스트 업데이트

**Files:**
- Modify: `nextjs/app/embed/__tests__/page.test.tsx`

- [ ] **Step 1: 테스트 파일 확인 및 업데이트**

변경된 인터페이스에 맞게 테스트 업데이트:
- `FolderSection` props에 `selectedUserId`, `serverFolderGroups`, `onFolderChange` 시그니처 변경 반영
- `EmbedPageInner` props에 `serverUserId`, `serverFolderGroups` 추가
- `parseEmbedParams` 반환값에 `userId` 필드 추가

```bash
# 기존 테스트 확인
docker exec cl_embed_nextjs npm test -- --run nextjs/app/embed/__tests__/page.test.tsx
```

실패하는 테스트를 확인하고 수정.

- [ ] **Step 2: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run nextjs/app/embed/__tests__/page.test.tsx
```

Expected: 모든 테스트 통과.

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/embed/__tests__/page.test.tsx
git commit -m "test: 폴더 Select 통합에 맞게 테스트 업데이트"
```

---

### Task 8: Playwright로 이슈 사전 테스트 및 검증

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: Playwright로 현재 embed 페이지 접속하여 기존 UI 확인**

Playwright MCP로 `https://embed.cunlim.dev/embed` 접속, superadmin 인증 쿠키 설정 후:
1. 회원 Select와 폴더 Select가 분리되어 있는지 확인 (AS-IS 확인)
2. 스크린샷 캡처

- [ ] **Step 2: 변경 후 관리자 로그인 테스트**

1. superadmin으로 로그인 후 embed 페이지 접속
2. 회원 Select가 사라졌는지 확인
3. 폴더 Select에 optgroup이 표시되는지 확인
4. "cunlim (cunlim@cunlim.dev)" optgroup 레이블 확인
5. 폴더 선택 시 URL에 `?folder=XXX&user_id=N` 반영 확인
6. 이동할 폴더 Select도 optgroup으로 표시되는지 확인

- [ ] **Step 3: 변경 후 일반 회원 로그인 테스트**

1. 일반 회원으로 로그인 후 embed 페이지 접속
2. optgroup 없이 자신의 폴더만 flat list로 표시되는지 확인
3. "전체", "기본폴더" italic 스타일 확인
4. URL에 `user_id` 없이 폴더 선택 가능 확인

- [ ] **Step 4: lint + test + pint 최종 확인**

```bash
bash .claude/hooks/run-all-checks.sh
cat .claude/hooks/test-results/*.txt
```

Expected: tsc, lint, test, pint 모두 EXIT=0.

---

## 영향을 받는 파일 요약

| 파일 | 변경 |
|------|------|
| `laravel/app/Http/Controllers/Api/FolderController.php` | grouped 응답에 `user_email` 추가 |
| `nextjs/lib/api.ts` | `FolderGroup`에 `user_email` 필드 추가 |
| `nextjs/lib/embed-params.ts` | `EmbedParams`에 `userId` 필드 추가, URL 파싱 |
| `nextjs/app/embed/page.tsx` | `userId` 파싱, `serverFolderGroups` 전달, `fetchUsers` admin 확장 |
| `nextjs/app/embed/embed-page-inner.tsx` | `selectedUserId` 상태, `updateURL` user_id 처리, `onFolderChange` 시그니처 변경 |
| `nextjs/components/admin/folder-section.tsx` | 회원 Select 제거, 폴더/이동폴더 Select 통합, italic, label 제거 |
| `nextjs/app/embed/__tests__/page.test.tsx` | 변경된 인터페이스 반영 |
