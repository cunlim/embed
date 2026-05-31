# 폴더 Select 6차 이슈 수정 설계

## 배경

1~5차 작업(f6bb642~c9e9c3b)에 이은 6차 폴더 select 이슈 수정. 5가지 이슈를 해결한다.

## 이슈 1: optgroup 시각적 구분 강화

**현재**: `SelectLabel`이 `text-xs text-muted-foreground px-1.5 py-1`, 폴더 item은 일반 스타일. 구분이 존재하나 옅음.

**변경**: `SelectLabel`에 `bg-muted/50 font-medium` 추가. 그룹 간 경계 인식을 위해 `folder-section.tsx`에서 `SelectGroup` 렌더링 시 첫 번째 그룹이 아닌 경우 `className="mt-1 pt-1 border-t border-border"` 적용.

**파일**:
- `nextjs/components/ui/select.tsx` — `SelectLabel` 컴포넌트 스타일
- `nextjs/components/admin/folder-section.tsx` — `SelectGroup` 조건부 className

## 이슈 2: optgroup 내 "전체"/"기본폴더" value 충돌

**원인**: 모든 그룹이 `value="all"`, `value="기본폴더"`를 공유. Base UI Select는 value 기준으로 선택 상태를 관리하므로 모든 그룹의 동일 value 아이템이 함께 선택됨.

**변경**:
1. 각 그룹의 "전체" → `value={`all:${group.user_id}`}`, "기본폴더" → `value={`기본폴더:${group.user_id}`}`
2. `onValueChange` 핸들러에서 `:` 파싱: `all:user_id` → `selectedFolder`를 `null`로, `기본폴더:user_id` → `selectedFolder`를 `"기본폴더"`로 설정. 이때 `selectedUserId`를 해당 user_id로 설정.
3. `SelectValue` render에서도 composite value를 파싱하여 적절히 표시 (예: "전체 (cunlim)").
4. top-level "전체"/"기본폴더"는 composite prefix 없이 그대로 유지 — 이들은 `selectedUserId=null` 상태에서만 표시.

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 3: 긴 텍스트 overflow

**원인**: `SelectTrigger`에 `whitespace-nowrap`은 있으나 overflow hidden 처리가 부족. `SelectValue` render prop의 `<span>`이 부모 너비를 초과.

**변경**:
1. `SelectValue` render prop 내 모든 반환 요소에 `className="truncate"` 적용
2. `SelectTrigger`에서 `min-w-0` 추가하여 flex 자식이 축소되도록
3. 삭제 버튼 영역이 폴더명 텍스트에 덮이지 않도록 flex shrink-0 보장

**파일**:
- `nextjs/components/admin/folder-section.tsx` — SelectValue render prop
- `nextjs/components/ui/select.tsx` — SelectTrigger 스타일

## 이슈 4: 회원 전환 후 stale folders로 인한 "이미 존재" 오류

**원인**: `handleUserChange("all")` → `loadFolders()` 비동기 호출 중 `handleAddFolder`의 `folders.includes(name)`이 이전 사용자의 stale `folders`로 체크.

**변경**:
1. `handleUserChange`에서 `setFolders([])`로 즉시 초기화 — 중복 체크가 빈 배열로 false 반환
2. `loadFolders()` 완료 후 실제 폴더 목록으로 업데이트
3. `selectedUserId`가 null("전체")일 때 `createFolder` API 호출 시 `userId`를 전달하지 않아 현재 로그인 관리자 소유로 생성됨 (기존 API 동작)

**파일**: `nextjs/components/admin/folder-section.tsx` — `handleUserChange`

## 이슈 5: 폴더명 수정 불가

**원인**:
- Pencil 버튼 클릭 시 Input에 기존 폴더명 pre-fill
- 동일한 FolderPlus 버튼이 항상 `handleAddFolder`를 호출 — 수정 모드에서도 "추가"로 동작
- 수정 모드임을 시각적으로 구분할 수 없음
- 사용자가 버튼 클릭 시 "이미 존재" 오류 발생 또는 의도치 않은 새 폴더 생성

**변경**:
1. `renameTarget`이 설정되었을 때 UI 전환:
   - Input placeholder → `"폴더명 수정..."`
   - FolderPlus 버튼 → Check 아이콘으로 변경, onClick → `handleRenameFolder`
   - 취소(X) 버튼 추가 → `setRenameTarget("")`, `setNewFolderName("")`
2. `handleRenameFolder`의 `folders` 의존성 제거 (수정 시 중복 체크 불필요 — 이름이 동일하면 API에서 처리)
3. Enter 키 핸들러는 수정 모드에서 `handleRenameFolder` 호출 (기존 유지)

**파일**: `nextjs/components/admin/folder-section.tsx`

## 검증 계획

1. Playwright로 각 이슈 재현 → 수정 후 재확인
2. `docker exec cl_embed_nextjs npx tsc --noEmit` 통과
3. `docker exec cl_embed_nextjs npm test` 통과
4. `.claude/hooks/run-all-checks.sh` 전체 통과
