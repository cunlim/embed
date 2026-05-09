# UI 디자인 가이드

## 1. 디자인 원칙

| 우선순위 | 원칙 | 설명 |
|----------|------|------|
| 1 | **일관성** | 모든 페이지는 동일한 디자인 토큰(색상, 타이포그래피, 간격)을 공유합니다. |
| 2 | **개발자 감성** | 모노스페이스 폰트, 코드 스니펫, 그리드 배경 등 개발자 지향 요소를 50% 포함합니다. |
| 3 | **깔끔함** | 불필요한 요소 배제, 충분한 여백, 단일 뷰포트 높이로 간결하게 유지합니다. |
| 4 | **반응형** | 모든 페이지는 모바일(375px)부터 데스크톱(1920px)까지 대응합니다. |
| 5 | **테마 전환** | 화이트/다크 모드 전환이 가능하며, localStorage에 설정을 저장합니다. |

## 2. 디자인 토큰 (Design Tokens)

### 2.1 색상

CSS 커스텀 속성(oklch)으로 정의. 모든 shadcn/ui 컴포넌트가 이 변수를 참조.

```css
/* Light 모드 (기본값) */
:root {
  --background: oklch(0.985 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --primary: oklch(0.445 0.186 271.38);    /* 진한 인디고 */
  --accent: oklch(0.5 0.2 246.12);          /* 블루 */
  --muted: oklch(0.965 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0);
  --radius: 0.75rem;
}

/* Dark 모드 */
.dark {
  --background: oklch(0.025 0.008 265);     /* 딥 블랙 */
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.045 0.01 265);
  --primary: oklch(0.5 0.2 246.12);         /* 라이트 블루 */
  --accent: oklch(0.5 0.2 246.12);
  --border: oklch(0.13 0.015 265);
}
```

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--background` | 화이트 | 딥블랙 | 페이지 배경 |
| `--foreground` | 블랙 | 화이트 | 본문 텍스트 |
| `--primary` | 인디고 | 라이트블루 | 주요 버튼, 강조 |
| `--accent` | 블루 | 블루 | 링크, 액센트 |
| `--muted-foreground` | 그레이 | 그레이 | 보조 텍스트 |
| `--border` | 라이트그레이 | 다크그레이 | 테두리 |

### 2.2 타이포그래피

| 용도 | Font | Weight | Size (Desktop) | CSS Variable |
|------|------|--------|----------------|--------------|
| Display (제목) | Instrument Sans | 700 | text-6xl/7xl | `--font-sans` |
| 본문 | Instrument Sans | 400 | text-base/sm | `--font-sans` |
| Mono (코드) | JetBrains Mono | 400 | text-xs | `--font-mono` |
| 내비게이션 | JetBrains Mono | 400 | text-xs | `--font-mono` |

- **Instrument Sans**: Google Fonts에서 `next/font/google`로 로드 (400, 500, 600, 700)
- **JetBrains Mono**: Google Fonts에서 `next/font/google`로 로드
- **제한**: Inter, Roboto, Geist, system-ui 사용 금지

### 2.3 간격 (Spacing)

- 페이지 패딩: `px-6 sm:px-10 lg:px-16`
- 섹션 간격: Tailwind v4 기본 스케일 사용
- 카드 패딩: `p-4 sm:p-5`

### 2.4 모서리 (Border Radius)

| 레벨 | 값 | 용도 |
|------|-----|------|
| `--radius` | 0.75rem | 버튼, 카드 |
| `--radius-md` | 0.5rem | 입력 필드 |
| `rounded-xl` | 0.75rem | 코드 블록, 카드 |

## 3. 레이아웃 원칙

### 3.1 랜딩 페이지 (`/`)

- **높이**: `min-h-dvh` (단일 뷰포트, 스크롤 최소화)
- **구조**: Header → Hero (중앙 정렬) → Footer (테크 스택 바)
- **배경**: `grid-bg` (60px 그리드 패턴, 원형 페이드 아웃 마스크) + `noise-overlay` (미세 노이즈 텍스처)
- **상단 여백**: `py-5` (헤더), `pb-24 pt-8` (히어로 영역)

### 3.2 로그인 페이지 (`/login`)

- **기본 레이아웃**: 랜딩과 동일한 `min-h-dvh`, `grid-bg`, `noise-overlay` 공유
- **카드**: 중앙 정렬 카드, `rounded-xl border bg-card/40 backdrop-blur-sm`
- **헤더**: 랜딩과 동일한 헤더 재사용 (`> cl_embed` 로고 + 테마 토글)
- **푸터**: 랜딩과 동일한 푸터 재사용

### 3.3 Embed 기술 시연 페이지 (`/embed`)

- **기본 레이아웃**: 랜딩과 동일한 `grid-bg`, `noise-overlay` 공유
- **검색 영역**: 상단 중앙 정렬, 헤더 바로 아래
- **결과 영역**: 검색 키워드 및 결과 도출 데이터는 **Bold** 및 **수치화**하여 하이라이팅
- **사용자 가이드**: 검색 결과가 없는 경우와 같은 엣지 케이스 처리 필수
- **로딩 상태**: 스켈레톤 로더 또는 프로그레스 표시

## 4. 컴포넌트

### 4.1 공통 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `ThemeProvider` | `components/theme-provider.tsx` | "use client", Context API 기반 테마 관리 |
| `ThemeToggle` | `components/theme-toggle.tsx` | 태양/달 아이콘 전환 애니메이션 |
| `Button` | `components/ui/button.tsx` | shadcn/base-ui Button (variant: default, outline, ghost, destructive, link) |
| `DropdownMenu` | `components/ui/dropdown-menu.tsx` | shadcn/base-ui DropdownMenu |

### 4.2 테마 전환

- **저장 키**: `localStorage('cl-embed-theme')`
- **초기화 스크립트**: `next/script` `beforeInteractive` 전략으로 HTML `<body>`에 삽입
- **FOUC 방지**: `suppressHydrationWarning` 사용, 레이아웃에서 초기 `className="dark"` 고정 후 JS로 오버라이드
- **토글 애니테이션**: SVG 회전/스케일 전환 (`rotate-0 scale-100 dark:rotate-90 dark:scale-0`)

### 4.3 개발자 효과

| 효과 | 구현 | 설명 |
|------|------|------|
| `grid-bg` | CSS background-image + mask-image | 60px 정사각 그리드, 원형으로 페이드 |
| `noise-overlay` | CSS fixed position ::before | SVG feTurbulence 노이즈 1.5% 불투명도 |
| `gradient-text` | background-clip: text | primary → accent 그라데이션 |
| `cursor-blink` | CSS ::after + keyframes | `_` 커서 깜빡임 |
| `code-line` | CSS ::before (attr data-line) | 라인 번호가 있는 코드 스타일 |
| `animate-fade-in-up` | Tailwind + keyframes | 스태거(stagger) fade-in 애니메이션 |

## 5. 반응형 중단점 (Breakpoints)

| 구분 | Tailwind | 적용 |
|------|----------|------|
| Mobile | `sm` (640px) 미만 | 내비게이션 링크 숨김, 버튼 세로 배치 |
| Mobile | `sm` (640px) | 내비게이션 표시, 버튼 가로 배치 |
| Tablet | `md` (768px) | 제목 크기 조정 |
| Desktop | `lg` (1024px) | 전체 여백 확대, 제목 최대 크기 |

**모바일 우선** 설계. 모든 페이지는 `sm:` variant로 데스크톱 레이아웃을 오버라이드.

## 6. 파일 구조 (페이지)

```
app/
├── layout.tsx          # Root layout (fonts, theme provider, noise overlay)
├── page.tsx            # 랜딩 페이지
├── globals.css         # Tailwind v4 + theme variables + effects
├── login/
│   └── page.tsx        # 로그인 페이지 (미구현)
└── embed/
    └── page.tsx        # Embed 기술 시연 페이지 (미구현)
components/
├── theme-provider.tsx  # Context 기반 테마 관리
├── theme-toggle.tsx    # dark/light 모드 전환 버튼
└── ui/
    ├── button.tsx      # shadcn Button
    └── dropdown-menu.tsx # shadcn DropdownMenu
lib/
└── utils.ts            # cn() 유틸리티 (clsx + tailwind-merge)
```

## 7. 페이지별 주의사항

### 랜딩 페이지 (`/`)
- 절대 `h-dvh` 넘지 않게 유지 (한 화면에 모든 내용)
- 코드 스니펫은 실제 프로젝트 사용 예시를 반영
- "Instantly mapped." 뒤 `cursor-blink` 효과 유지

### 로그인 페이지 (`/login`) — 향후 구현
- 헤더와 푸터는 랜딩과 동일하게 유지
- 소셜 로그인(OAuth) 버튼은 `shadcn Button` 사용
- 이메일 입력 필드는 `shadcn Input` 사용
- 다크/라이트 모드에서 모든 OAuth 아이콘 가시성 확인

### Embed 페이지 (`/embed`) — 향후 구현
- 검색 결과 Bold 하이라이팅 및 수치화 필수
- 로딩 중 스켈레톤 UI 표시
- 결과 없음 상태에도 레이아웃 무너짐 방지
- WebSocket (Reverb) 연결 상태를 상단에 인디케이터로 표시

## 8. 폰트 로드 방식

```tsx
// layout.tsx - next/font/google 사용
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});
```

- CDN/외부 CSS 로드 금지 — 반드시 `next/font/google` 사용
- `display: swap`으로 폰트 로드 중 fallback 텍스트 표시
