# 반응형 Admin/Docs 사이드바 및 Header 개선 디자인

## 개요

admin과 docs 페이지의 반응형 사이드바를 구현하고, admin 페이지 헤더의 불필요한 "admin" 배지를 제거한다.

## 문제 정의

1. **Admin 페이지**: 사이드바가 `w-44` 고정 너비로 반응형 처리 없음. 좁은 화면에서 콘텐츠가 압축됨
2. **Docs 페이지**: 데스크톱에서는 항상 고정 사이드바, 모바일에서는 풀스크린 오버레이. 접기/펼치기 기능 없음
3. **Header**: admin 페이지 접근 시 "admin" 배지가 불필요하게 표시됨

## 요구사항

- admin, docs 페이지의 사이드바를 공통 컴포넌트로 구현
- 화면 너비가 줄면 자동으로 접히고, 넓어지면 자동으로 펼쳐짐
- 사용자가 수동으로도 토글 가능
- 접힌 상태에서도 토글 버튼이 왼쪽에 표시됨
- 모바일에서는 슬라이드-in 드로어 + backdrop
- 사이드바 접기/펼치기 상태를 localStorage로 영속화
- admin 페이지 헤더의 "admin" 배지 제거

## 아키텍처

### 공통 컴포넌트: CollapsibleSidebar

**위치**: `nextjs/components/collapsible-sidebar.tsx`

**Props**:
```typescript
interface CollapsibleSidebarProps {
  title: string           // 사이드바 상단 제목
  children: React.ReactNode  // 네비게이션 아이템
  storageKey: string      // localStorage 키
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl'  // 자동 접기 기준 (기본: 'lg')
}
```

**데스크톱 동작** (브레이크포인트 이상):
- 펼쳐진 상태: `w-56` 사이드바, 네비게이션 아이템 표시
- 접힌 상태: `w-12` (토글 버튼만 표시)
- CSS `transition-all duration-300`으로 부드러운 전환
- 토글 버튼: 접힌 상태 → `Menu` 아이콘, 펼쳐진 상태 → `ChevronLeft` 아이콘

**모바일 동작** (브레이크포인트 미만):
- shadcn/ui `Sheet` 컴포넌트 (왼쪽에서 슬라이드-in)
- backdrop 클릭으로 닫기
- 네비게이션 아이템 클릭 시 자동 닫기

**상태 관리**:
- `useMediaQuery` 커스텀 훅으로 화면 크기 감지
- `localStorage`로 접기/펼치기 상태 영속화
- 기본값: 펼쳐진 상태

### 레이아웃 구조

```
app/
├── admin/
│   ├── layout.tsx    ← 새로 생성 (CollapsibleSidebar 포함)
│   └── page.tsx      ← 사이드바 코드 제거, 콘텐츠만 렌더링
├── docs/
│   ├── layout.tsx    ← 새로 생성 (CollapsibleSidebar 포함)
│   └── page.tsx      ← 사이드바 코드 제거, 콘텐츠만 렌더링
components/
├── collapsible-sidebar.tsx  ← 새로 생성
├── use-media-query.ts       ← 새로 생성 (커스텀 훅)
└── app-header.tsx           ← admin 배지 제거
```

## 구현 상세

### 1. CollapsibleSidebar 컴포넌트

```
┌─────────────────────────────────────────────┐
│ 데스크톱 (펼쳐진 상태)                        │
│ ┌──────────┬────────────────────────────────┐│
│ │  제목     │                                ││
│ │          │                                ││
│ │  메뉴1   │        콘텐츠 영역              ││
│ │  메뉴2   │                                ││
│ │  메뉴3   │                                ││
│ │          │                                ││
│ │     [◀]  │                                ││
│ │ w-56     │                                ││
│ └──────────┴────────────────────────────────┘│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 데스크톱 (접힌 상태)                          │
│ ┌──┬───────────────────────────────────────┐│
│ │▶ │                                       ││
│ │  │                                       ││
│ │  │        콘텐츠 영역                     ││
│ │  │                                       ││
│ │  │                                       ││
│ │w-12                                      ││
│ └──┴───────────────────────────────────────┘│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 모바일 (Sheet 드로어)                         │
│ ┌──────────┬────────────────────────────────┐│
│ │  제목  ✕ │                                ││
│ │          │                                ││
│ │  메뉴1   │        콘텐츠 영역              ││
│ │  메뉴2   │                                ││
│ │  메뉴3   │                                ││
│ │          │                                ││
│ │ Sheet    │                                ││
│ └──────────┴────────────────────────────────┘│
│     ↑ backdrop 영역                          │
└─────────────────────────────────────────────┘
```

### 2. Admin 페이지 레이아웃

**`admin/layout.tsx`**:
- `CollapsibleSidebar`로 사이드바 렌더링
- 메뉴 항목: "시스템 설정" (Settings), "안내" (Inbox)
- `storageKey: "admin-sidebar"`

**`admin/page.tsx` 변경**:
- 인라인 `<nav>` 사이드바 코드 제거
- `flex` 레이아웃 제거
- 콘텐츠 영역만 렌더링

### 3. Docs 페이지 레이아웃

**`docs/layout.tsx`**:
- `CollapsibleSidebar`로 사이드바 렌더링
- 메뉴 항목: `docList`에서 동적 생성
- `storageKey: "docs-sidebar"`
- `onSelectDoc` 콜백으로 활성 문서 상태 관리

**`docs/page.tsx` 변경**:
- 데스크톱/모바일 이중 사이드바 코드 전부 제거
- `sidebarOpen` 상태 제거
- 콘텐츠 렌더링 로직만 유지

### 4. Header "admin" 배지 제거

**`app-header.tsx`**:
```tsx
// 변경 전
const badge = pathname === "/admin" ? "admin" : undefined;

// 변경 후
const badge = undefined;
```

`SiteHeader`의 `badge` prop은 유지. 향후 다른 페이지에서 활용 가능.

## 새 의존성

- `npx shadcn add sheet` — shadcn/ui Sheet 컴포넌트 추가

## 테스트 전략

- Playwright로 admin 페이지 접속 → 사이드바 표시 확인
- 뷰포트 크기 변경 → 자동 접기/펼치기 확인
- 토글 버튼 클릭 → 수동 접기/펼치기 확인
- 모바일 뷰포트 → Sheet 드로어 동작 확인
- localStorage 상태 유지 확인
- admin 페이지에서 "admin" 배지 미표시 확인

## 영향 범위

- `nextjs/app/admin/layout.tsx` (신규)
- `nextjs/app/admin/page.tsx` (수정)
- `nextjs/app/docs/layout.tsx` (신규)
- `nextjs/app/docs/page.tsx` (수정)
- `nextjs/components/collapsible-sidebar.tsx` (신규)
- `nextjs/components/use-media-query.ts` (신규)
- `nextjs/components/app-header.tsx` (수정)
- `nextjs/components/ui/sheet.tsx` (신규 - shadcn)
