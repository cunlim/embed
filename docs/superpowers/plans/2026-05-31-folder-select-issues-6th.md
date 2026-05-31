# 폴더 Select 6차 이슈 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴더/회원 select의 optgroup value 충돌, 스타일 구분, 텍스트 overflow, stale folders, 폴더명 수정 불가 등 5가지 이슈 해결

**Architecture:** `folder-section.tsx`에서 optgroup 항목에 composite value(`all:user_id`, `기본폴더:user_id`)를 도입하여 그룹 간 value 충돌 해결. `select.tsx`에서 SelectLabel/SelectTrigger 스타일 보강. 수정 모드와 추가 모드를 UI로 분기.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Base UI React Select, Tailwind CSS v4

---

## File Structure

| 파일 | 책임 |
|------|------|
| `nextjs/components/ui/select.tsx` | SelectLabel 스타일 강화, SelectTrigger min-w-0 추가 |
| `nextjs/components/admin/folder-section.tsx` | composite value, truncation, stale folders, rename UX |

---

### Task 1: SelectLabel 스타일 강화

**Files:**
- Modify: `nextjs/components/ui/select.tsx:112-123`

- [ ] **Step 1: SelectLabel에 bg-muted/50 font-medium 추가**

`nextjs/components/ui/select.tsx`의 SelectLabel 함수에서 className 변경:

```tsx
function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground bg-muted/50 font-medium", className)}
      {...props}
    />
  )
}
```

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/ui/select.tsx
git commit -m "style: SelectLabel에 bg-muted/50, font-medium 추가로 그룹 구분 강화

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: SelectTrigger에 min-w-0 추가로 flex 자식 축소 허용

**Files:**
- Modify: `nextjs/components/ui/select.tsx:45-71`

- [ ] **Step 1: SelectTrigger className에 min-w-0 추가**

`nextjs/components/ui/select.tsx`의 SelectTrigger에서 `flex w-fit` 뒤에 `min-w-0` 추가:

```tsx
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground shrink-0" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}
```

핵심 변경: `flex w-fit` → `flex w-fit min-w-0`, ChevronDownIcon에 `shrink-0` 추가.

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/ui/select.tsx
git commit -m "fix: SelectTrigger에 min-w-0 추가 및 아이콘 shrink-0로 overflow 방지

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 폴더 select composite value 적용 + SelectGroup border-t + 텍스트 truncate

**Files:**
- Modify: `nextjs/components/admin/folder-section.tsx`

이 Task는 folder-section.tsx의 세 가지 변경을 한 번에 적용한다: composite value (이슈 2), SelectGroup border-t (이슈 1 잔여), 텍스트 truncate (이슈 3).

- [ ] **Step 1: folder-section.tsx 전체 변경**

`nextjs/components/admin/folder-section.tsx`의 다음 영역들을 변경:

**A. `onFolderChange` 핸들러를 composite value 파싱 가능하도록 변경 (line 262-264)**

기존:
```tsx
onValueChange={(value) =>
  onFolderChange(value === ALL_FOLDERS_VALUE ? null : value)
}
```

변경:
```tsx
onValueChange={(value) => {
  // composite value 파싱: "all:user_id" 또는 "기본폴더:user_id"
  if (value && value.includes(":")) {
    const [prefix, userIdStr] = value.split(":");
    const uid = Number(userIdStr);
    selectedUserIdRef.current = uid;
    setSelectedUserId(uid);
    if (prefix === "all") {
      onFolderChange(null);
    } else {
      onFolderChange("기본폴더");
    }
    return;
  }
  onFolderChange(value === ALL_FOLDERS_VALUE ? null : value);
}}
```

**B. SelectValue render에 truncate + composite value 파싱 추가 (line 267-273)**

기존:
```tsx
<SelectValue
  render={(value) => {
    if (!value || value === ALL_FOLDERS_VALUE) return <span className="italic text-muted-foreground">전체</span>;
    if (value === DEFAULT_FOLDER_LABEL) return <span className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</span>;
    return <span>{String(value)}</span>;
  }}
/>
```

변경:
```tsx
<SelectValue
  render={(value) => {
    const v = String(value ?? "");
    if (!v || v === ALL_FOLDERS_VALUE) return <span className="italic text-muted-foreground truncate">전체</span>;
    if (v === DEFAULT_FOLDER_LABEL) return <span className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</span>;
    // composite value: 접두사 제거 후 표시
    if (v.includes(":")) {
      const [prefix] = v.split(":");
      if (prefix === "all") return <span className="italic text-muted-foreground truncate">전체</span>;
      return <span className="truncate">{DEFAULT_FOLDER_LABEL}</span>;
    }
    return <span className="truncate">{v}</span>;
  }}
/>
```

**C. SelectContent 내 optgroup 항목 composite value + SelectGroup border-t (line 275-296)**

기존:
```tsx
<SelectContent>
  <SelectItem value={ALL_FOLDERS_VALUE} className="italic text-muted-foreground">전체</SelectItem>
  <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</SelectItem>
  {isViewerAdmin && !selectedUserId && folderGroups.length > 0
    ? folderGroups.map((group) => (
        <SelectGroup key={group.user_id}>
          <SelectLabel>{group.user_name}</SelectLabel>
          <SelectItem value="all" className="italic text-muted-foreground">전체</SelectItem>
          <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</SelectItem>
          {group.folders.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectGroup>
      ))
    : folders.map((f) => (
        <SelectItem key={f} value={f}>
          {f}
        </SelectItem>
      ))}
</SelectContent>
```

변경:
```tsx
<SelectContent>
  <SelectItem value={ALL_FOLDERS_VALUE} className="italic text-muted-foreground truncate">전체</SelectItem>
  <SelectItem value={DEFAULT_FOLDER_LABEL} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
  {isViewerAdmin && !selectedUserId && folderGroups.length > 0
    ? folderGroups.map((group, idx) => (
        <SelectGroup key={group.user_id} className={idx > 0 ? "mt-1 pt-1 border-t border-border" : ""}>
          <SelectLabel>{group.user_name}</SelectLabel>
          <SelectItem value={`all:${group.user_id}`} className="italic text-muted-foreground truncate">전체</SelectItem>
          <SelectItem value={`${DEFAULT_FOLDER_LABEL}:${group.user_id}`} className="italic text-muted-foreground truncate">{DEFAULT_FOLDER_LABEL}</SelectItem>
          {group.folders.map((f) => (
            <SelectItem key={f} value={f} className="truncate">
              {f}
            </SelectItem>
          ))}
        </SelectGroup>
      ))
    : folders.map((f) => (
        <SelectItem key={f} value={f} className="truncate">
          {f}
        </SelectItem>
      ))}
</SelectContent>
```

**D. 회원 select SelectValue render에도 truncate 추가 (line 236-243)**

기존:
```tsx
<SelectValue
  render={(value) => {
    if (!value || value === "all") return <span className="italic text-muted-foreground">전체</span>;
    const u = users.find(u => String(u.id) === value);
    if (u) return <span>{u.name} ({u.email})</span>;
    return <span>{String(value)}</span>;
  }}
/>
```

변경:
```tsx
<SelectValue
  render={(value) => {
    if (!value || value === "all") return <span className="italic text-muted-foreground truncate">전체</span>;
    const u = users.find(u => String(u.id) === value);
    if (u) return <span className="truncate">{u.name} ({u.email})</span>;
    return <span className="truncate">{String(value)}</span>;
  }}
/>
```

**E. 회원 select SelectItem에도 truncate 추가 (line 246-251)**

기존:
```tsx
<SelectItem value="all" className="italic text-muted-foreground">전체</SelectItem>
{users.map((u) => (
  <SelectItem key={u.id} value={String(u.id)}>
    {u.name} ({u.email})
  </SelectItem>
))}
```

변경:
```tsx
<SelectItem value="all" className="italic text-muted-foreground truncate">전체</SelectItem>
{users.map((u) => (
  <SelectItem key={u.id} value={String(u.id)} className="truncate">
    {u.name} ({u.email})
  </SelectItem>
))}
```

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: npm test 체크**

```bash
docker exec cl_embed_nextjs npm test
```

- [ ] **Step 4: Playwright로 이슈 2 검증**

페이지 접속 → 폴더 select 열기 → 각 그룹의 "전체"가 개별 선택되는지 확인 (더 이상 모든 "전체"가 동시 selected 되지 않음)

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/admin/folder-section.tsx
git commit -m "fix: 폴더 select composite value 도입으로 optgroup value 충돌 해결 및 truncate 적용

- optgroup 내 '전체'/'기본폴더'에 user_id 포함 composite value 적용
- onValueChange에서 composite value 파싱하여 selectedUserId 설정
- SelectValue render에 composite value 파싱 및 truncate 추가
- SelectGroup 조건부 border-t로 그룹 간 경계 강화
- 회원/폴더 select 모든 SelectItem에 truncate 적용

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 회원 전환 시 folders 즉시 초기화로 stale folders 방지

**Files:**
- Modify: `nextjs/components/admin/folder-section.tsx`

- [ ] **Step 1: handleUserChange에서 setFolders([]) 추가 (line 205-215)**

기존:
```tsx
const handleUserChange = useCallback(
  (value: string | null) => {
    const newUserId = !value || value === "all" ? null : Number(value);
    selectedUserIdRef.current = newUserId;
    setSelectedUserId(newUserId);
    onFolderChange(null);
    // 폴더 목록 재로드 (ref로 최신 userId 사용)
    loadFolders();
  },
  [onFolderChange, loadFolders],
);
```

변경:
```tsx
const handleUserChange = useCallback(
  (value: string | null) => {
    const newUserId = !value || value === "all" ? null : Number(value);
    selectedUserIdRef.current = newUserId;
    setSelectedUserId(newUserId);
    onFolderChange(null);
    // 이전 사용자의 folders로 인한 중복 체크 오탐 방지
    setFolders([]);
    // 폴더 목록 재로드 (ref로 최신 userId 사용)
    loadFolders();
  },
  [onFolderChange, loadFolders],
);
```

핵심 변경: `onFolderChange(null)` 직후 `setFolders([])` 추가.

- [ ] **Step 2: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/folder-section.tsx
git commit -m "fix: 회원 전환 시 folders 즉시 초기화로 stale 중복 체크 방지

handleUserChange에서 setFolders([])를 호출하여 이전 사용자 폴더 목록으로 인한
'이미 존재하는 폴더명' 오탐을 방지합니다.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 폴더명 수정 UX 개선 (add/rename 모드 분기)

**Files:**
- Modify: `nextjs/components/admin/folder-section.tsx`

- [ ] **Step 1: 폴더 추가/수정 영역을 renameTarget 유무에 따라 분기 (line 300-343)**

기존 전체 영역 (line 300-343):
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
          setNewFolderName(selectedFolder);
        }}
        className="h-8 shrink-0"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
  )}
</div>
```

변경:
```tsx
{/* 폴더 추가 + 수정 */}
<div className="flex gap-2">
  <Input
    placeholder={renameTarget ? "폴더명 수정..." : "새 폴더명"}
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
  {renameTarget ? (
    <>
      <Button
        size="sm"
        onClick={handleRenameFolder}
        disabled={!newFolderName.trim()}
        className="h-8 shrink-0"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setRenameTarget("");
          setNewFolderName("");
          setError(null);
        }}
        className="h-8 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </>
  ) : (
    <>
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
              setNewFolderName(selectedFolder);
            }}
            className="h-8 shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
      )}
    </>
  )}
</div>
```

- [ ] **Step 2: import에 Check, X 아이콘 추가 (line 17)**

기존:
```tsx
import { FolderPlus, FolderMinus, ArrowRightLeft, Pencil } from "lucide-react";
```

변경:
```tsx
import { FolderPlus, FolderMinus, ArrowRightLeft, Pencil, Check, X } from "lucide-react";
```

- [ ] **Step 3: tsc 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 4: npm test 체크**

```bash
docker exec cl_embed_nextjs npm test
```

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/admin/folder-section.tsx
git commit -m "fix: 폴더명 수정 모드 UI 분기로 rename/add 혼동 방지

- renameTarget 설정 시 확인(Check)/취소(X) 버튼 표시
- Input placeholder '폴더명 수정...'으로 변경
- 추가 모드와 수정 모드를 시각적으로 분리

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Playwright 이슈 재현 검증 및 run-all-checks

**Files:**
- None (검증 only)

- [ ] **Step 1: Playwright로 5가지 이슈 수정 확인**

1. 폴더 select 열기 → 각 그룹 "전체" 선택 시 해당 그룹만 선택됨 (이슈 2 해결)
2. SelectLabel 스타일이 bg-muted/50 + font-medium으로 구분 강화됨 (이슈 1 해결)
3. 긴 폴더명 선택 시 select box 내에서 truncate 처리됨 (이슈 3 해결)
4. 회원 "Brett Weissnat" → "전체" 전환 후 "폴더01_brett" 추가 시 정상 생성됨 (이슈 4 해결)
5. 폴더명 수정 시 Check 버튼으로 확인, X 버튼으로 취소 가능 (이슈 5 해결)

- [ ] **Step 2: run-all-checks 실행**

```bash
.claude/hooks/run-all-checks.sh
```

```bash
cat .claude/hooks/test-results/*.txt
```

tsc, lint, test, pint 모두 EXIT=0 확인.

- [ ] **Step 3: 최종 Commit (필요 시)**

```bash
git add -A
git commit -m "chore: 6차 폴더 select 이슈 수정 최종 검증 완료

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
