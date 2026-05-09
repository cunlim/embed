# UI 디자인 가이드

## 디자인 원칙
1. `example-skills:frontend-design` skill을 사용해야 한다
2. shadcn/ui (base-nova style) 사용하며 white/dark 모드 전환이 가능해야 하고 반응형으로 제작
3. 브라우저 검증 필요 시 Playwright plugin 사용, `https://embed.cunlim.dev` 접속
4. `/` 랜딩 페이지: height 짧고 깔끔함 70%, 특수효과 + 개발자스러운 스타일 30%
5. `/embed` 기술 시연 페이지: 검색 키워드 및 결과 데이터 Bold 및 수치화 하이라이팅
6. **모든 문서와 주석은 한국어로 작성**

## 디자인 시스템

### 색상 테마
CSS 변수 기반 (Tailwind v4 `@theme` + `@custom-variant dark`)

| 변수 | Light | Dark | 용도 |
|------|-------|------|------|
| `--background` | `#f8fafc` (slate-50) | `#060a1a` | 페이지 배경색 |
| `--foreground` | `#0f172a` (slate-900) | `#e2e8f0` (slate-200) | 기본 텍스트 색상 |
| `--card` | `#ffffff` | `#0d1226` | 카드/컨테이너 배경 |
| `--primary` | `#0891b2` (cyan-600) | `#22d3ee` (cyan-400) | 주요 액션 색상 |
| `--secondary` | `#6366f1` (indigo-500) | `#818cf8` (indigo-400) | 보조 액션 색상 |
| `--accent` | `#f59e0b` (amber-500) | `#fbbf24` (amber-400) | 강조/포인트 색상 |
| `--muted` | `#f1f5f9` | `#131836` | 비활성/보조 영역 |
| `--muted-foreground` | `#64748b` | `#8896b6` | 보조 텍스트 |
| `--border` | `#e2e8f0` | `#1c2350` | 테두리 선 |
| `--ring` | `#0891b2` | `#22d3ee` | 포커스 링 |

### 그라디언트
- **Primary gradient**: `linear-gradient(135deg, --primary, --secondary)` — 주요 CTA 버튼 및 타이틀
- **텍스트 그라디언트**: `text-gradient` 클래스 사용 (`background-clip: text`)

### 타이포그래피

| 용도 | 폰트 | 굵기 |
|------|------|------|
| Heading (대제목) | **Sora** | 700-800 |
| Body (본문) | **DM Sans** | 400-500 |
| Mono (코드) | **Geist Mono** | 400 |

### 컴포넌트 스타일

#### 버튼
```tsx
// Primary 버튼 — 그라디언트 배경
<"bg-gradient-to-r from-primary to-secondary rounded-full px-7 h-12 font-semibold">

// Outline 버튼 — 보더 스타일
<"border border-border bg-card/50 rounded-full px-7 h-12 backdrop-blur-sm">
```

#### 카드
- `rounded-2xl border border-border bg-card p-8`
- 호버 시 `hover:border-primary/20` + 그림자 효과
- 상단 그라디언트 보더 라인: `absolute top-0 right-6 left-6 h-0.5 rounded-full bg-gradient-to-r`

#### 아이콘
- **lucide-react** v1.14.0 사용
- 아이콘 import 경로: `lucide-react/dist/esm/icons/{name}.mjs` (자동 번들링)

#### 그리드
- Stats: `grid-cols-2 md:grid-cols-4` with `gap-px` + `border` (테두리 공유)
- Features: `grid-cols-1 md:grid-cols-3 gap-6`
- Tech stack: `grid-cols-3 sm:grid-cols-4 gap-3 md:gap-4`

### 효과 (CSS Only)

| 클래스 | 용도 |
|--------|------|
| `.text-gradient` | 그라디언트 텍스트 |
| `.orb` | 배경 플로팅 오브 (blur + opacity) |
| `.grid-overlay` | 기술적 느낌의 그리드 패턴 |
| `.animate-float` | 부유 애니메이션 (12s) |
| `.animate-fade-in-up` | 등장 애니메이션 (0.8s) |
| `.stagger-{1-6}` | 지연 등장 (0.1s~0.6s) |

### 테마 전환
- `class` 전략: `document.documentElement.classList.toggle('dark')`
- localStorage `theme` 키에 저장
- FOUC 방지: layout.tsx의 인라인 `<script>`로 초기 테마 적용
- Toggle 버튼: Sun/Moon 아이콘 교차 전환

### 반응형 기준
- **Mobile first**: 기본 1열, `sm:` 태블릿, `md:` 데스크톱
- `max-w-6xl` 컨테이너 (px-6)
- Hero: `text-4xl` → `sm:text-5xl` → `md:text-6xl` → `lg:text-7xl`

## 페이지별 가이드라인

### `/` 랜딩 페이지
- 페이지 길이: 7개 섹션 (Nav, Hero, Stats, Features, HowItWorks, TechStack, CTA, Footer)
- Hero 전체 뷰포트 (min-h-dvh)
- Code decoration: 큰 `</>` 및 `{ }` 장식, cURL 예제 박스
- Hero 하단 Scroll indicator

### `/embed` 기술 시연 페이지
- 검색 결과 Bold + 수치화 하이라이팅 필수 적용
- 동일한 theme system, typography, spacing 사용
- 언어 선택 Select box, 결과 리스트 표시

### `/login` 페이지
- 동일 theme system 유지
- 간결한 폼 레이아웃 (centered card)
- 소셜 로그인 버튼 (Google, GitHub, Naver)

## Tailwind v4 주의사항
- `@import "tailwindcss"` (3개 지시어 없음)
- `@theme inline { }` 블록으로 커스텀 토큰 정의
- `@custom-variant dark (&:where(.dark, .dark *))`로 클래스 기반 dark mode
- 기존 `@apply`는 제한적으로 사용
