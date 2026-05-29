# UI 수정 디자인: 유사도 모달 포맷 & admin 메뉴 스타일

## 개요

두 가지 UI 이슈를 수정합니다:
1. 유사도 모달의 계산 과정에서 norm 값의 불필요한 0 제거
2. admin 페이지 메뉴의 selected 스타일을 light/dark 모드 모두에서 개선

## 이슈 1: 유사도 모달 norm 포맷

### 문제
- `cosine-detail-dialog.tsx:268`에서 `normA.toFixed(4)` 사용
- L2 정규화된 임베딩의 norm이 정확히 1.0일 때 "1.0000"으로 표시
- 사용자에게 불필요한 소수점 0이 노출됨

### 해결 방안
- `trimZeros()` 헬퍼 함수 추가
- 정수면 정수로, 소수면 유효숫자만 표시

### 변경 파일
- `nextjs/components/admin/cosine-detail-dialog.tsx`

### 적용 결과
| Before | After |
|--------|-------|
| 1.0000 | 1 |
| 0.9876 | 0.9876 |
| 1.5000 | 1.5 |

## 이슈 2: admin 메뉴 selected 스타일

### 문제
- admin 페이지의 selected 메뉴 스타일(`bg-accent text-foreground`)이 docs 페이지(`bg-accent/10 text-accent font-medium`)와 다름
- 두 페이지 간 사이드바 메뉴 스타일 불일치

### 해결 방안
- docs 페이지의 사이드바 메뉴 스타일과 통일
- `bg-accent/10 text-accent font-medium` 적용
- light/dark 모드 모두에서 docs와 일관된 스타일

### 변경 파일
- `nextjs/app/admin/page.tsx`

### Before/After
```tsx
// Before
isActive ? "bg-accent text-foreground"

// After
isActive ? "bg-accent/10 text-accent font-medium"
```

## 테스트 계획
1. Playwright로 유사도 모달 열어 norm 값 확인
2. admin 페이지에서 light/dark 모드 전환하며 메뉴 스타일 확인
3. `.claude/hooks/run-all-checks.sh` 실행하여 tsc, lint, test, pint 확인
