# UI 디자인 가이드

## 디자인 원칙

1. **프론트엔드 디자인 스킬 사용** — `/example-skills:frontend-design` 스킬을 사용하여 AI 슬롭(slop) 미학을 피하고 독창적인 디자인을 만듭니다.
2. **shadcn/ui + Tailwind v4** — shadcn/ui 컴포넌트를 기반으로, Tailwind CSS v4의 `@theme inline` 변수 시스템을 사용합니다.
3. **화이트/다크 모드** — `next-themes`의 `ThemeProvider`로 class 기반 다크 모드를 지원합니다.
4. **반응형** — Tailwind의 `sm:`, `md:`, `lg:` 브레이크포인트를 사용해 모든 width에 대응합니다.
5. **깔끔함 70% + 개발자 감성 30%** — 전체적으로 정제된 미니멀리즘을 유지하되, 모노스페이스 폰트, 도트 그리드, 터미널 스타일 커서 등 개발자 친화적 요소를 포인트로 사용합니다.
6. **검증** — Playwright로 `https://embed.cunlim.dev`에서 브라우저 검증합니다. localhost는 사용하지 않습니다.

## 디자인 컨셉 — "Precision Engineering"

정밀 엔지니어링을 연상시키는 깔끔하고 전문적인 미학. AI/데이터 처리라는 도메인에 맞게 시각적으로 정제된 인터페이스.

- **분위기**: 전문적, 정제됨, 기술적
- **차별점**: 모노스페이스 액센트, 도트 그리드 배경, 깔끔한 카드 레이아웃, 절제된 블러 효과

## 색상 시스템

### 라이트 모드

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--background` | `#fafafa` | 페이지 배경 |
| `--foreground` | `#0a0a0f` | 본문 텍스트 |
| `--card` | `#ffffff` | 카드 배경 |
| `--primary` | `#4f5ef7` | 주요 액션, 강조 |
| `--secondary` | `#f4f4f6` | 부차적 배경 |
| `--muted` | `#f4f4f6` | 비활성 배경 |
| `--muted-foreground` | `#71717a` | 부차적 텍스트 |
| `--accent` | `#f59e0b` | 강조 포인트 (Amber) |
| `--border` | `#e4e4e7` | 테두리 |
| `--destructive` | `#ef4444` | 오류/삭제 |

### 다크 모드

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--background` | `#0a0a0f` | 페이지 배경 |
| `--foreground` | `#fafafa` | 본문 텍스트 |
| `--card` | `#131317` | 카드 배경 |
| `--primary` | `#6b7dff` | 주요 액션, 강조 (light보다 밝게) |
| `--secondary` | `#1c1c22` | 부차적 배경 |
| `--muted` | `#1c1c22` | 비활성 배경 |
| `--muted-foreground` | `#a1a1aa` | 부차적 텍스트 |
| `--accent` | `#f59e0b` | 강조 포인트 (동일) |
| `--border` | `#27272a` | 테두리 |
| `--destructive` | `#7f1d1d` | 오류/삭제 |

### 차트 컬러

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--chart-1` | `#4f5ef7` | Primary blue |
| `--chart-2` | `#06b6d4` | Cyan |
| `--chart-3` | `#f59e0b` | Amber |
| `--chart-4` | `#8b5cf6` | Purple |
| `--chart-5` | `#10b981` | Emerald |

## 타이포그래피

| 역할 | 폰트 | 용도 |
|------|------|------|
| 본문 | Geist Sans (`--font-geist-sans`) | 일반 UI 텍스트, 헤딩 |
| 코드/데이터 | Geist Mono (`--font-geist-mono`) | 기술 스택 태그, 데이터 수치, 코드 블록 |

**사용 규칙**:
- 기술적 내용(코드, 데이터, 수치)은 `font-mono` 클래스로 표시
- 한글 본문은 Geist Sans가 자연스럽게 렌더링
- 헤딩은 `font-sans` + `font-bold` + `tracking-tight`

## 컴포넌트 패턴

### shadcn/ui 컴포넌트 (base-nova 스타일)

현재 설치된 컴포넌트: `button`, `card`, `badge`

컴포넌트는 `@/components/ui/`에 위치하며 `@base-ui/react` 기반으로 구현되어 있습니다.

#### Button 사용 시 주의
- `asChild` prop은 base-ui에서 지원하지 않으므로, 링크에는 `<a>` 태그에 직접 스타일링
- base-ui Button은 `render` prop을 사용하는 패턴

#### Badge variants
- `default` — primary 배경
- `secondary` — secondary 배경 (섹션 라벨용)
- `outline` — 테두리만 (필터/태그용)
- `destructive` — 오류 표시

#### Card
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`

### 커스텀 컴포넌트

| 컴포넌트 | 경로 | 설명 |
|----------|------|------|
| `ThemeProvider` | `@/components/theme-provider` | next-themes 래퍼 |
| `ThemeToggle` | `@/components/theme-toggle` | 해/달 아이콘 토글 버튼 |

## 레이아웃

### 컨테이너

- 최대 너비: `max-w-5xl` (1024px)
- 좌우 패딩: `px-4 sm:px-6`
- 섹션 간 구분: `border-t border-border/40`

### 페이지 구조

```
┌─────────────────────────────┐
│ Header (sticky, blur bg)    │  h-14
├─────────────────────────────┤
│ Hero Section                │  flex-1 (centered)
│  - Tag badge                │
│  - Title + cursor blink     │
│  - Description              │
│  - CTA buttons              │
│  - Stats grid (3 columns)   │
├─────────────────────────────┤
│ Features (3 cards grid)     │
├─────────────────────────────┤
│ Tech Stack (tag cloud)      │
├─────────────────────────────┤
│ Footer                      │
└─────────────────────────────┘
```

## 애니메이션 & 효과

### 페이지 로드
- **Staggered reveal**: 컴포넌트들이 `opacity-0 translate-y-2` → `opacity-100 translate-y-0`로 순차 등장
- **Delay**: 0ms → 75ms → 150ms → 200ms → 300ms

### 배경 효과
- **Dot Grid**: `radial-gradient(circle, currentColor 1px, transparent 1px)` 24px 간격
- **Floating Shapes**: `blur-3xl` + `animate-float` (12s, 10s, 14s 주기, 지연시간 stagger)
- **Header Blur**: `bg-background/80 backdrop-blur-md`

### 마이크로 인터랙션
- **CTA 버튼**: `hover:bg-primary/80 active:translate-y-px`
- **기술 태그**: `hover:border-primary/30 hover:text-primary`
- **기능 카드**: `hover:border-primary/30 hover:bg-card/80`
- **커서 블링크**: 제목 옆 `animate-pulse` 커서 효과

### Float 키프레임
```css
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}
```

## 다크 모드 구현

### ThemeProvider 설정

```tsx
<ThemeProvider
  attribute="class"        // <html>에 .dark 클래스 토글
  defaultTheme="dark"      // 기본값 다크 모드
  enableSystem             // 시스템 설정 감지
  disableTransitionOnChange // 전환 시 transition 비활성화
>
```

### CSS 변수 전환

Tailwind v4의 `@custom-variant dark` 지시문 사용:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

`.dark` 클래스 선택자로 모든 색상 변수를 재정의합니다. `prefers-color-scheme` 미디어 쿼리는 사용하지 않습니다.

## 반응형 브레이크포인트

| 브레이크포인트 | 너비 | 적용 |
|----------------|------|------|
| 기본 | < 640px | 단일 컬럼, 작은 패딩 |
| `sm:` | ≥ 640px | Feature 그리드 2열 |
| `md:` | ≥ 768px | 더 큰 폰트/패딩 |
| `lg:` | ≥ 1024px | Feature 그리드 3열, 최대 타이틀 크기 |

## 시각 효과 배분 (70/30 규칙)

### 깔끔함 70%
- 넉넉한 여백과 패딩
- 명확한 타이포그래피 계층
- 정렬된 그리드 레이아웃
- 절제된 색상 팔레트 (주로 배경/카드/보더)
- 간결한 카드 UI

### 개발자 감성 30%
- 모노스페이스 폰트 (수치, 기술 태그)
- 도트 그리드 배경
- 깜빡이는 터미널 커서 효과
- 블러 처리된 플로팅 도형
- 코드를 연상시키는 `< >` 장식

## AI 슬롭 안티패턴 (금지)

| 금지 | 대체 |
|------|------|
| 보라색-파란색 그라데이션 | 단일 primary color |
| Inter/Roboto/Arial 폰트 | Geist Sans + Geist Mono |
| 과도한 그라데이션 버튼 | solid/outline 버튼 |
| 유리 형태(glassmorphism) 남용 | 절제된 blur + border |
| 아이콘 과다 사용 | 텍스트 + 필요한 곳에만 아이콘 |
| 떠다니는 카드/요소 난무 | 절제된 float 애니메이션 (3개 이하) |

## 페이지별 가이드

### `/` 랜딩 페이지
- 전체 높이를 채우되 스크롤 최소화
- Hero 섹션에 무게 중심
- 둥근 카드와 태그
- 기술적 수치는 `font-mono` + `text-primary`

### `/login` 로그인 페이지 (예정)
- 중앙 정렬 카드 레이아웃
- 배경 Dot Grid 유지
- 동일한 Header/Footer 구조
- 폼 요소는 shadcn `input` 컴포넌트 사용

### `/embed` 기술 시연 페이지 (예정)
- 데이터 밀도가 높은 레이아웃
- 검색 키워드 및 결과 수치는 **Bold** + `font-mono` + `text-primary`로 강조
- 수치 데이터는 시각적으로 부각 (더 큰 폰트, primary 색상)
- 카드 내부에 데이터 시각화 요소 포함
