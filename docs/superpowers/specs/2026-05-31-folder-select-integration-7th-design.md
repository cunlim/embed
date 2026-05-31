# 폴더 Select 통합 7차 설계

## 배경

1~6차 작업(f6bb642~42fcdf7)에 이은 7차 폴더 기능 개선. 현재 embed 페이지에는 **회원 Select**와 **폴더 Select**가 분리되어 있다. 이를 하나의 Select로 통합하고, 사용자 역할에 따라 optgroup 표시 여부를 달리한다.

## 요구사항

1. **회원 Select 제거** — 폴더 Select에 통합
2. **관리자/최고관리자** — 폴더 Select + 이동할 폴더 Select 모두 optgroup 방식 (이름 (이메일) 레이블)
3. **일반 회원** — optgroup 없이 자신의 폴더만 flat list
4. **URL 파라미터** — `?folder=프로젝트A&user_id=5` 형식으로 회원 구분 데이터 포함
5. **선택 표시** — 관리자: `"cunlim / 기본폴더"`, 일반회원: `"기본폴더"`
6. **가상 폴더 스타일** — "전체", "기본폴더" italic
7. **label "폴더" 제거**

## 이슈 1: 회원 Select 제거 및 폴더 Select 통합

**현재**: `folder-section.tsx`에 회원 Select(admin 전용)와 폴더 Select가 별도로 존재. 회원 Select로 `selectedUserId`를 변경하면 폴더 목록이 해당 회원의 폴더로 필터링됨.

**변경**:
1. 회원 Select UI 제거
2. 폴더 Select가 관리자에게는 모든 회원의 폴더를 optgroup으로 표시
3. `selectedUserId` 상태는 폴더 Select의 composite value 파싱을 통해 결정

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 2: 관리자/최고관리자 optgroup 표시

**현재**: 회원 Select에서 "전체" 선택 시에만 optgroup 표시. 특정 회원 선택 시 flat list.

**변경**:
- admin/superadmin: 항상 optgroup 표시. `SelectGroup` + `SelectLabel` 사용.
- `SelectLabel`은 `"이름 (이메일)"` 형식 (예: `"cunlim (cunlim@cunlim.dev)"`)
- 각 그룹 내 폴더 아이템은 composite value 유지: `all:user_id`, `기본폴더:user_id`, `폴더명:user_id`
- 일반 회원: `SelectGroup` 없이 flat list

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 3: 일반 회원 flat list

**현재**: 일반 회원은 회원 Select가 보이지 않으며, 자신의 폴더만 표시.

**변경**:
- 일반 회원은 별도 API 호출로 자신의 폴더만 조회 (기존 `fetchFolders(token)` 호출 유지)
- optgroup 없이 `SelectItem`만 렌더링
- "전체", "기본폴더"는 italic 스타일

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 4: URL에 user_id 파라미터 추가

**현재**: URL은 `?folder=프로젝트A` — 폴더명만으로는 어떤 회원의 폴더인지 구분 불가.

**변경**:
1. `embed-params.ts`의 `EmbedParams`에 `userId: string | null` 필드 추가
2. URL 파싱: `?folder=프로젝트A&user_id=5`
3. `updateURL()`에서 `user_id` 설정/삭제 로직 추가
4. SSR `embed/page.tsx`에서 `user_id`를 읽어 `serverUserId`로 클라이언트에 전달 (초기 선택값 결정용)
5. SSR 폴더 prefetch는 관리자일 때 `fetchFolders(token)` (전체, userId 없이) — optgroup 표시를 위해 모든 회원 폴더 필요
6. `embed-page-inner.tsx`에서 `selectedUserId` 상태를 `serverUserId`로 초기화

**파일**:
- `nextjs/lib/embed-params.ts`
- `nextjs/app/embed/page.tsx`
- `nextjs/app/embed/embed-page-inner.tsx`

## 이슈 5: Select 선택 표시 텍스트

**현재**: `SelectValue.render`에서 폴더명만 표시.

**변경**:
- 관리자: `"회원명 / 폴더명"` 형식 (예: `"cunlim / 기본폴더"`)
  - composite value에서 user_id 파싱 → users 배열에서 이름 조회 → `"이름 / 폴더명"`
- 일반 회원: 폴더명만 표시 (기존과 동일)
- "전체" 선택 시: 관리자는 `"cunlim / 전체"`, 일반 회원은 `"전체"`

**파일**: `nextjs/components/admin/folder-section.tsx` — `SelectValue.render`

## 이슈 6: 가상 폴더 italic 스타일

**현재**: "전체", "기본폴더" 항목에 italic 스타일 없음.

**변경**:
- `SelectItem` 내 텍스트에 `italic` 클래스 조건부 적용
- 해당하는 항목: `"전체"`, `"기본폴더"` (실제 DB에 존재하지 않는 가상 폴더)

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 7: label "폴더" 제거

**현재**: 폴더 Select 위에 `<label>폴더</label>` 렌더링.

**변경**: 제거. Select 자체만으로 용도가 명확함.

**파일**: `nextjs/components/admin/folder-section.tsx`

## 이슈 8: 이동할 폴더 Select 동일 규칙 적용

**현재**: 이동할 폴더 Select는 폴더 Select와 독립적으로 동작.

**변경**:
- 관리자/최고관리자: optgroup 방식 (폴더 Select와 동일)
- 일반 회원: flat list (폴더 Select와 동일)
- 차이점: "전체" 옵션 없음 ("전체"로 이동은 의미 없음)
- 선택 표시: 관리자는 `"회원명 / 폴더명"`, 일반 회원은 `"폴더명"`
- placeholder: "이동할 폴더 선택" 유지

**파일**: `nextjs/components/admin/folder-section.tsx`

## 영향을 받는 파일

| 파일 | 변경 내용 |
|------|-----------|
| `nextjs/components/admin/folder-section.tsx` | 회원 Select 제거, 폴더/이동폴더 Select 통합, italic, label 제거 |
| `nextjs/lib/embed-params.ts` | `userId` 필드 추가, URL 파싱/직렬화 |
| `nextjs/app/embed/page.tsx` | SSR에서 `user_id` 파라미터 처리, fetchFolders에 userId 전달 |
| `nextjs/app/embed/embed-page-inner.tsx` | selectedUserId를 URL user_id와 동기화, FolderSection props 조정 |
| `nextjs/app/embed/__tests__/page.test.tsx` | 변경된 인터페이스에 맞게 테스트 업데이트 |

## API 변경

- 없음. 기존 `GET /api/folders?user_id=` 엔드포인트를 그대로 사용.
- SSR: 관리자는 `fetchFolders(token)` (userId 없이, 전체 그룹 데이터). 일반회원은 `fetchFolders(token)` (API가 자동 scope).
- `user_id` URL 파라미터는 초기 선택값 결정용이며 폴더 prefetch에는 사용하지 않음.

## 보안

- 일반 회원이 URL에 `user_id=다른회원`을 넣어도 API 서버(`FolderController::index`)에서 `$request->user()` 기준으로 권한 검사 → 자신의 폴더만 반환.
- `fetchFolders`에 전달된 `userId`는 admin/superadmin인 경우에만 다른 회원의 폴더 조회 가능 (Laravel `FolderController::index`에서 권한 확인).
