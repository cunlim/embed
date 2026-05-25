# Embed 페이지 Toggle 버튼 & Dark 모드 컴포넌트 리뉴얼

## 1. Toggle 버튼 재설계

**대상**: 언어 선택(한국어/중국어/영어), 필터 모드(분류선택/검색), 카테고리 필터(전체/내 카테고리)

**변경**:
- `variant={active ? "secondary" : "ghost"}` → `variant={active ? "default" : "ghost"}`
- ghost hover: `hover:bg-accent` → `hover:bg-primary/15` (선택 상태와 작은 차이)

## 2. Dark 모드 컴포넌트 리뉴얼

**CSS 변수 조정** (`.dark`):
- `--card`: `oklch(0.205)` → `oklch(0.22)` (배경 대비 강화)
- `--popover`: 동일하게 조정
- `--border`: `oklch(0.269)` → `oklch(0.32)` (구분선 가시성)
- `--muted`: `oklch(0.269)` → `oklch(0.25)` (hover 배경)

**Card 그림자 추가**: dark 모드 Card에 `shadow-md shadow-black/20` 적용

**Table**: dark 모드에서 row hover를 `hover:bg-muted/40`로 subtle하게
