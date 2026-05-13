# UI 디자인 가이드

## 디자인 원칙

1. **shadcn/ui 사용**: 모든 UI 컴포넌트는 shadcn/ui (`base-nova` 스타일) 기반으로 구축한다.
2. **반응형 디자인**: 모바일(375px) → 태블릿(768px) → 데스크톱(1280px+) 순으로 mobile-first 디자인.
3. **화이트/다크 모드**: `next-themes` 기반 class 전략으로 light/dark 모두 지원.
4. **랜딩 페이지 스타일 비중**: 깔끔함 50% + 특수효과/개발자스러운 스타일 50%.
5. **브라우저 검증**: Playwright MCP 플러그인 사용, `https://embed.cunlim.dev`로 접속.

---

## 1. 디자인 시스템

### 1.1 색상 토큰 (CSS 변수)

Light/Light 모드는 `:root`, Dark 모드는 `.dark` 클래스에서 정의한다. 모든 색상은 **oklch** 색 공간을 사용한다. raw hex 값은 컴포넌트에서 직접 사용하지 않고 CSS 변수로만 참조한다.

| 토큰 | Light | Dark | 용도 |
|------|-------|------|------|
| `--background` | oklch(1 0 0) | oklch(0.145 0 0) | 페이지 배경 |
| `--foreground` | oklch(0.145 0 0) | oklch(0.985 0 0) | 기본 텍스트 |
| `--card` | oklch(1 0 0) | oklch(0.205 0.042 265.75) | 카드/표면 배경 |
| `--primary` | oklch(0.205 0.042 265.75) | oklch(0.588 0.158 265) | 주요 액션/버튼 |
| `--accent` | oklch(0.507 0.157 265.75) | oklch(0.507 0.157 265.75) | 강조/링크/하이라이트 |
| `--muted` | oklch(0.965 0.001 286.375) | oklch(0.269 0.015 286.375) | 비활성/보조 영역 |
| `--border` | oklch(0.922 0.003 286.375) | oklch(0.269 0.015 286.375) | 테두리/구분선 |
| `--destructive` | oklch(0.577 0.245 27.325) | oklch(0.577 0.245 27.325) | 삭제/위험 동작 |
| `--ring` | oklch(0.507 0.157 265.75) | oklch(0.507 0.157 265.75) | 포커스 링 |
| `--radius` | 0.625rem | 0.625rem | 기본 border-radius |

### 1.2 Gradient Text

```css
.gradient-text {
  background: linear-gradient(
    135deg,
    oklch(0.507 0.157 265.75),  /* blue */
    oklch(0.646 0.222 41.116)   /* orange/amber */
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 1.3 Grid Background

```css
.bg-grid {
  background-image:
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size: 60px 60px;
}
```

### 1.4 Glow Orb

```css
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
```

---

## 2. 타이포그래피

### 2.1 폰트 패밀리

| 역할 | 폰트 | CSS 변수 | 비고 |
|------|------|----------|------|
| Heading | Archivo | `--font-archivo` | 300~700 weight, bold headings |
| Body/Mono | Space Grotesk | `--font-space-grotesk` | body text, 모노스페이스 구간 |
| System fallback | Geist Mono | `--font-geist-mono` | layout.tsx에서 로드 |

Tailwind 매핑:
- `--font-sans` → Archivo (기본 텍스트)
- `--font-mono` → Space Grotesk (코드/터미널)

### 2.2 타입 스케일

| 타입 | 모바일 | 데스크톱 | Tailwind |
|------|--------|----------|----------|
| Display/H1 | text-4xl (2.25rem) | text-6xl~7xl (3.75~4.5rem) | `text-4xl sm:text-6xl lg:text-7xl` |
| H2 | text-2xl | text-3xl | - |
| H3 | text-base | text-sm | feature card heading |
| Body | text-base | text-lg | - |
| Meta | text-xs | text-xs | 보조 정보, 법적 고지 |
| Mono | text-xs | text-sm | 터미널 윈도우 |

### 2.3 행간

- Body: `leading-relaxed` (1.625)
- Heading: `leading-tight` (1.25) 또는 `tracking-tight`

---

## 3. 컴포넌트 스타일

### 3.1 버튼

| 변형 | 클래스 | 용도 |
|------|--------|------|
| Primary | `Button variant="default"` | 주요 CTA, `shadow-lg shadow-accent/20` |
| Outline | `Button variant="outline"` | 보조 액션 |
| Ghost | `Button variant="ghost"` | 테마 토글, 아이콘 버튼 |
| Link | `Button variant="link"` | 인라인 텍스트 링크 |

CTA 버튼 스타일:
```tsx
<Button
  size="lg"
  className="rounded-full px-6 shadow-lg shadow-accent/20
             transition-all duration-300 hover:shadow-xl
             hover:shadow-accent/30 hover:scale-105"
>
  액션 텍스트
  <ChevronRight className="h-4 w-4 transition-transform
    duration-200 group-hover:translate-x-0.5" />
</Button>
```

### 3.2 카드

Feature card 패턴:
```tsx
<div className="group relative overflow-hidden rounded-xl
                border border-border bg-card/50 p-4
                transition-all duration-300
                hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
  {/* 호버 시 드러나는 그라데이션 오버레이 */}
  <div className="absolute inset-0 bg-gradient-to-br
                  from-{color}-500/20 to-{color}-600/10
                  opacity-0 transition-opacity duration-300
                  group-hover:opacity-100" />
  <div className="relative z-10">{/* 콘텐츠 */}</div>
</div>
```

카드 아이콘 컨테이너: `h-9 w-9 rounded-lg border border-border bg-background`.

### 3.3 터미널 윈도우

```tsx
<div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm">
  <div className="flex gap-1.5 border-b border-border px-3 py-2">
    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
      filename.sh
    </span>
  </div>
  <div className="p-4 font-mono text-xs leading-relaxed sm:text-sm">
    {/* 터미널 라인 */}
    <span className="text-emerald-500">$</span> command
  </div>
</div>
```

### 3.4 배지 (상태 표시)

```tsx
<div className="inline-flex items-center gap-1.5 rounded-full
                border border-border bg-muted/50 px-3 py-1
                text-xs font-medium text-muted-foreground">
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full
                     animate-ping rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex h-2 w-2
                     rounded-full bg-emerald-500" />
  </span>
  라벨 텍스트
</div>
```

### 3.5 네비게이션 바

- 모바일: 심플 헤더 (로고 + 테마토글 + 메뉴)
- 데스크톱: 헤더 + 탐색 링크 (선택사항)
- 로고: `h-8 w-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold`

---

## 4. 레이아웃 규칙

### 4.1 반응형 브레이크포인트

| 브레이크포인트 | Tailwind | 레이아웃 변화 |
|---------------|----------|--------------|
| < 640px (모바일) | default | 1열, 스택, full-width |
| 640px+ (태블릿) | `sm:` | 2열 그리드, horizontal CTA |
| 1024px+ (데스크톱) | `lg:` | max-w-5xl 제한 |
| 1280px+ | `xl:` | 더 넓은 여백 |

### 4.2 컨테이너

- 메인 콘텐츠: `max-w-5xl mx-auto`
- 패딩: 모바일 `px-6`, 데스크톱 `sm:px-8`
- 섹션 간격: `pb-24` (하단), `py-12` (상하)

### 4.3 그리드

```html
<!-- 2열 레이아웃 -->
<div className="grid gap-6 md:grid-cols-2">
  <!-- 터미널 (좌) -->
  <!-- 피처 카드 (우) -->
</div>

<!-- 2x2 피처 카드 -->
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <!-- 4개 카드 -->
</div>
```

### 4.4 통계 표시줄

```html
<div className="flex items-center divide-x divide-border">
  <div className="flex flex-col items-center px-4 sm:px-8">
    <span className="font-mono text-lg font-bold sm:text-xl">값</span>
    <span className="text-xs text-muted-foreground">라벨</span>
  </div>
  <!-- ×3 -->
</div>
```

---

## 5. 애니메이션 가이드라인

### 5.1 지속 시간 & 타이밍

| 종류 | 지속 시간 | Easing |
|------|----------|--------|
| 호버 효과 | 200-300ms | `duration-200` ~ `duration-300` |
| 페이지 진입 | 400-500ms | `duration-500` |
| 스크롤 진입 | 500ms | `duration-500` + translate |
| 테마 전환 | 200ms | `duration-200` |

### 5.2 Developer 효과

- **타이핑 효과**: `setInterval 50ms` → 텍스트 한 글자씩 표시, 깜빡이는 커서
- **터미널 라인 진입**: stagger 600ms, `translate-x-2 → 0`, `opacity-0 → 100`
- **그리드 페이드**: `8s ease-in-out infinite alternate` (grid background)
- **글로우 오브**: `3s ease-in-out infinite alternate` (scale + opacity)
- **상태 닷**: `animate-ping` (online indicator)

### 5.3 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
모든 애니메이션은 `transform`과 `opacity`만 사용한다 (width/height/top/left 애니메이션 금지).

---

## 6. 페이지별 디자인 규칙

### 6.1 `/` 랜딩 페이지

- **목적**: 기술 포트폴리오 소개, 프로젝트 첫인상
- **분위기**: 개발자 포트폴리오 + AI 기술 시연
- **구성**:
  1. 네비게이션 바 (로고 + 테마 토글)
  2. 히어로 섹션 (타이틀, 타이핑 효과, 서브텍스트, CTA 버튼 2개, 통계 수치)
  3. 피처 섹션 (터미널 윈도우 + 4개 기능 카드)
  4. 푸터 (카피라이트 + 링크)
- **특수효과**: 그리드 배경, 글로우 오브, 타이핑 애니메이션, 터미널 라인 stagger, 노이즈 오버레이
- **주의**: height 길게 불필요, 한 화면에 핵심 정보를 컴팩트하게 배치

### 6.2 로그인 페이지

- **목적**: OAuth 소셜 계정 인증 (이메일/비밀번호 로그인 없음)
- **핵심 요구사항**:
  - 로그인/회원가입 구분 없음 — 소셜 버튼 클릭 시 미가입자는 자동 회원가입 후 로그인
  - 이메일·비밀번호 입력 필드 없음, 별도 로그인 제출 버튼 없음
  - Google, GitHub, Naver 3개 소셜 로그인 버튼만 제공
- **컴포넌트 구조**:
  - `components/site-header.tsx` — 공통 헤더. 로고 클릭 시 `/` 이동, ThemeToggle 항상 우측 고정, `badge`/`children` prop
  - `components/social-login.tsx` — 소셜 로그인 버튼 그룹. 페이지 및 Modal 양쪽에서 재사용 가능
  - `app/login/page.tsx` — 로그인 전용 페이지 (Card + SocialLogin)
- **디자인 방향**:
  - 랜딩 페이지와 동일한 색상 토큰, 그리드 배경, 글로우 오브 사용
  - `SiteHeader` 컴포넌트로 모든 페이지 헤더 일관성 유지
  - 중앙 정렬 `max-w-sm` 카드 레이아웃, 카드 상단에 "CL Embed" 제목
  - 소셜 로그인 버튼: `variant="outline"`, `size="lg"`, `cursor-pointer`
  - 버튼 호버: `hover:border-accent/30 hover:bg-muted hover:text-foreground` + `transition-all duration-200`
    - `hover:bg-accent/5` 사용 금지 — light 모드에서 `hover:text-accent-foreground`(흰색)과 조합 시 텍스트 invisible
  - 넉넉한 여백: 카드 `pt-8 pb-8`, 버튼 간 `gap-4`, 버튼 내부 `px-6 py-6`
  - 에러 상태: `role="alert"`, 빨간색 텍스트 + AlertCircle 아이콘
  - 로딩 상태: 모든 버튼 disabled + spinner

### 6.3 `/embed` 기술 시연 페이지 (미구현)

- **목적**: 검색 키워드 입력 및 카테고리 추천 결과 시각화
- **디자인 방향**:
  - 검색 입력창: 큰 라운드 입력 (`rounded-full`, `h-12` 이상)
  - 결과 카드: `border-border`, `bg-card`, hover 시 그림자 효과
  - 키워드 볼드 처리: `data.highlight === true` 시 `font-semibold text-accent`
  - 수치 하이라이트: 예) 정확도 `text-accent font-mono text-lg`
  - 결과 없음: `flex flex-col items-center gap-2 py-12` + 아이콘 + 메시지
  - 로딩 상태: skeleton 또는 pulse 애니메이션
  - 에러 상태: 빨간색 경고 + 재시도 버튼

### 6.4 `/admin` 관리자 전용 페이지 (미구현)

- **목적**: 카테고리 CRUD, 일괄 번역 트리거, 시스템 관리
- **접근 제어**: **로그인 필수**. 비로그인 시 `/login`으로 리다이렉트. `useAuth()` 훅으로 인증 상태 확인.
- **디자인 방향**:
  - 랜딩 페이지와 동일한 디자인 시스템 적용
  - 카테고리 목록: shadcn Table 컴포넌트
  - 카테고리 추가: 단일 텍스트 입력 + "추가" 버튼
  - 일괄 번역: 언어 선택 + "전체 번역 실행" 버튼 + 진행률 바
  - 빈 상태: "등록된 카테고리가 없습니다"
  - 에러: inline error + retry button

### 6.5 공통 패턴

모든 페이지에서 일관되게 적용할 패턴:
- **[b]로고[/b]**: 좌상단에 `h-8 w-8 rounded-lg bg-primary text-primary-foreground`
- **[b]테마 토글[/b]**: 우상단, Sun/Moon 아이콘 전환, `variant="ghost" size="icon"`
- **[b]폼 필드[/b]**: visible label, error below field, helper text
- **[b]로딩[/b]**: `animate-pulse` 또는 shadcn Skeleton
- **[b]빈 상태[/b]**: 아이콘 + 설명 + CTA
- **[b]에러[/b]**: inline error + retry button + `aria-live="polite"`
- **[b]아이콘[/b]**: lucide-react (Lucide 아이콘)만 사용, 절대 이모지 금지

---

## 7. 성능 & 접근성

### 7.1 성능

- 이미지: `loading="lazy"`, `next/image` 사용
- 폰트: `next/font/google`으로 빌드 시 번들링
- 애니메이션: transform/opacity만 애니메이션, layout shift 유발 금지
- 번들: 동적 임포트로 페이지별 코드 분할

### 7.2 접근성

- 대비: 일반 텍스트 4.5:1, 큰 텍스트 3:1 (light/dark 모두 검증)
- 포커스: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- 키보드: Tab 순서 = 시각적 순서
- 스크린리더: `aria-label` on icon-only buttons, `aria-live` on dynamic content
- 폼: `<label htmlFor="...">` + `<input id="...">` 연결
- 터치: 버튼/링크 최소 44x44px
- 폰트 크기: 모바일 body 최소 16px (iOS 자동 줌 방지)

---

## 8. 구현 체크리스트

새 페이지 또는 컴포넌트 제작 시 확인할 항목:

- [ ] shadcn/ui 컴포넌트 사용 확인
- [ ] CSS 변수로 색상 참조 (raw hex 금지)
- [ ] light/dark 모드 모두 테스트
- [ ] 375px 모바일 + 1280px 데스크톱 반응형 확인
- [ ] `prefers-reduced-motion` 처리
- [ ] aria-label 누락 없는지 확인
- [ ] SVG 아이콘 사용 (이모지 금지)
- [ ] 버튼/링크 hover + focus 상태 구현
- [ ] 빈 상태/로딩/에러 상태 처리
- [ ] 브라우저 콘솔 에러 0 확인
- [ ] Playwright로 시각적 검증
- [ ] 빌드 에러 없는지 확인
