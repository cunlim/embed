# Header: 문서·GitHub 버튼 왼쪽 메뉴 배치

## 개요

헤더 오른쪽에 있던 "문서"와 "GitHub" 버튼을 로고 오른쪽 인라인 메뉴로 이동.

## 방식

**B — 헤더 왼쪽 인라인 메뉴**

```
[CL Embed] │ [📄 문서] [🐙 GitHub]       [⚙️ 관리자] [사용자명] [로그아웃] [🌓]
           ← leftChildren →                                ← children →
```

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/site-header.tsx` | `leftChildren?: React.ReactNode` prop 추가, 로고 오른쪽에 렌더링 |
| `components/app-header.tsx` | 문서·GitHub 버튼을 `leftChildren`으로 SiteHeader에 전달 |
| `components/auth-buttons.tsx` | 문서·GitHub 버튼 제거 (왼쪽 메뉴로 이동) |

## 디자인

- 로고와 버튼 사이에 `border-l` 구분선
- 버튼은 `variant="ghost" size="sm" rounded-full` 유지 (기존 디자인 토큰)
- 아이콘 + 라벨 표시, 모바일에서는 라벨 숨김 (`hidden sm:inline`)
- 반응형: 모바일에서 아이콘만 표시되어 공간 확보

## 영향 범위

- 헤더 UI만 변경, 기능/라우팅 변경 없음
- 기존 테스트에 영향 없음 (UI 레이아웃 변경)
