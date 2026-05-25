# UI 디자인 가이드

## 디자인 원칙

1. **shadcn/ui 사용**: 모든 UI 컴포넌트는 shadcn/ui (`base-nova` 스타일) 기반으로 구축한다.
2. **반응형 디자인**: 모바일(375px) → 태블릿(768px) → 데스크톱(1280px+) 순으로 mobile-first 디자인.
3. **화이트/다크 모드**: `next-themes` 기반 class 전략으로 light/dark 모두 지원.
4. **랜딩 페이지 스타일 비중**: 깔끔함 50% + 특수효과/개발자스러운 스타일 50%.

---

## 1. 디자인 시스템

### 1.1 색상

모든 색상은 **oklch** 색 공간의 CSS 변수만 사용, raw hex 금지. Light/Dark 모드는 `global.css`의 `@layer base`에서 정의.

### 1.2 특수효과

Gradient Text, Grid Background, Glow Orb, Noise Overlay 등은 `global.css`에서 정의. 컴포넌트에서 클래스로 참조.

---

## 2. 타이포그래피

| 항목 | 값 |
|------|-----|
| Heading 폰트 | Archivo |
| Body/Mono 폰트 | Space Grotesk, fallback: Geist Mono |
| Body 행간 | `leading-relaxed` (1.625) |
| Heading 행간 | `leading-tight` (1.25) |

### 타입 스케일

| 타입 | 모바일 | 데스크톱 |
|------|--------|----------|
| Display/H1 | text-4xl | text-6xl~7xl |
| H2 | text-2xl | text-3xl |
| H3 | text-base | text-sm |
| Body | text-base | text-lg |
| Meta | text-xs | text-xs |

---

## 3. 컴포넌트 스타일

### 3.1 버튼

| 변형 | 용도 |
|------|------|
| `default` | 주요 CTA, `shadow-lg shadow-accent/20` |
| `outline` | 보조 액션. **hover 시 `hover:bg-muted hover:text-foreground` 필수** — 기본 `hover:text-accent-foreground`는 light 모드에서 텍스트 invisible |
| `ghost` | 테마 토글, 아이콘 버튼 |
| `link` | 인라인 텍스트 링크 |

CTA 버튼: `size="lg"`, `rounded-full`, hover 시 `scale-105`.

### 3.2 StatusBadge

카테고리 테이블에서 번역 상태를 아이콘만으로 표시. 라벨 텍스트 없이 `aria-label`로 접근성 제공.
- 완료: `CheckCircle2` (green)
- 진행중/부분: `Clock` (blue)
- 미처리: `Minus` (muted)

---

## 4. 레이아웃

| 브레이크포인트 | Tailwind | 레이아웃 |
|---------------|----------|---------|
| < 640px | default | 1열, full-width |
| 640px+ | `sm:` | 2열 그리드 |
| 1024px+ | `lg:` | `max-w-5xl` 제한 |
| 1280px+ | `xl:` | 더 넓은 여백 |

- 메인 컨테이너: `max-w-5xl mx-auto`
- 패딩: 모바일 `px-6`, 데스크톱 `sm:px-8`

---

## 5. 애니메이션

- `transform`과 `opacity`만 사용 (layout-triggering 금지)
- `prefers-reduced-motion: reduce`에서 모든 애니메이션 0.01ms로 억제
- 호버: 200-300ms, 페이지 진입: 400-500ms

---

## 6. 페이지별 디자인 규칙

### 6.1 `/` 랜딩 페이지

- **목적**: 기술 포트폴리오 소개, 프로젝트 첫인상
- **분위기**: 개발자 포트폴리오 + AI 기술 시연
- **구성**: 네비게이션 바 → 히어로(타이핑 효과, CTA) → 피처 섹션(터미널+카드) → 푸터
- **주의**: 한 화면에 핵심 정보를 컴팩트하게 배치

### 6.2 로그인 페이지

- **목적**: 이메일/비밀번호 및 OAuth 인증
- **레이아웃**: 중앙 정렬 `max-w-sm` 카드, 카드 상단 "CL Embed" 제목
- **소셜 로그인 버튼**: `variant="outline"`, `size="lg"`. hover: `hover:border-accent/30 hover:bg-muted hover:text-foreground`
- **에러**: `role="alert"`, AlertCircle 아이콘 + 빨간색 텍스트
- **로딩**: 모든 버튼 disabled + spinner
- `SiteHeader` 컴포넌트로 모든 페이지 헤더 일관성 유지

### 6.3 `/embed` 기능 시연 페이지

- **목적**: 카테고리 추천, CRUD, 번역/임베딩 실행
- **레이아웃**: 좌측 사이드바 + 우측 테이블 (`lg:col-span-2`)
- **핵심 기능**:
  - 카테고리 검색 (ko/zh/en 언어 선택 버튼 + `POST /api/recommend`)
  - 카테고리 목록 (shadcn Table, 페이지네이션 10/20/50, URL 동기화)
  - 계층 탐색 (CategoryHierarchy — 4단계 select, `>` 구분자)
  - 카테고리 추가·수정·삭제 (권한 기반)
  - 일괄 처리 (step 순차 실행, 중지/재실행)
- **상태 표시**: 빈 상태(Database 아이콘), 로딩(Skeleton), 에러(AlertCircle + 재시도)

### 6.4 `/admin` 관리자 페이지

- 관리 기능은 `/embed` 페이지에 통합되어 있으며, `/admin`은 `/embed`로의 이동 버튼만 제공하는 플레이스홀더 상태.

### 6.5 공통 패턴

- **로고**: 좌상단 `h-8 w-8 rounded-lg bg-primary text-primary-foreground`
- **테마 토글**: 우상단 Sun/Moon, `variant="ghost" size="icon"`
- **아이콘**: lucide-react만 사용, 이모지 금지
- **로딩**: Skeleton 또는 `animate-pulse`
- **빈 상태**: 아이콘 + 설명 + CTA
- **에러**: inline error + retry button + `aria-live="polite"`

---

## 7. 성능 & 접근성

### 성능
- 이미지: `next/image`, `loading="lazy"`
- 폰트: `next/font/google` 번들링
- 번들: 동적 임포트로 코드 분할

### 접근성
- 대비: 일반 4.5:1, 큰 텍스트 3:1 (light/dark 모두)
- 포커스: `focus-visible:ring-2 focus-visible:ring-ring`
- 키보드: Tab 순서 = 시각적 순서
- 스크린리더: icon-only button에 `aria-label`, 동적 콘텐츠에 `aria-live`
- 폼: `<label htmlFor>` + `<input id>` 연결
- 터치: 버튼/링크 최소 44x44px
- 폰트: 모바일 body 최소 16px (iOS 자동 줌 방지)
