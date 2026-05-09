# 랜딩 페이지 디자인 문서

**날짜**: 2026-05-09
**프로젝트**: cl_embed 랜딩 페이지 리뉴얼
**상태**: ✅ 구현 완료 (2026-05-09)

---

## 1. 개요

기술 시연용 포트폴리오 프로젝트의 메인 랜딩 페이지를 리뉴얼한다. 기존 Create Next App 기본 템플릿을 대체하며, 깔끔함 70% + 개발자스러운 특수효과 30%의 가중치를 적용한다.

**선택한 미학**: Neural Bloom — 다크 베이스에 AI를 연상시키는 소프트 글로우, 그라데이션, 블러 오브. 기술적이면서도 세련된 무드.

---

## 2. 컬러 시스템

### Light Mode
| 변수 | 값 | 용도 |
|------|-----|------|
| `--background` | `#fafafa` | 베이스 배경 |
| `--foreground` | `#18181b` | 메인 텍스트 |
| `--primary` | `#6366f1` | 인디고 (CTA, 액센트) |
| `--accent` | `#8b5cf6` | 바이올렛 (서브 액센트) |
| `--muted` | `#a1a1aa` | 서브텍스트 |
| `--border` | `#e5e5e5` | 보더 |
| `--card-bg` | `rgba(255,255,255,0.03)` | 카드 배경 |

### Dark Mode
| 변수 | 값 | 용도 |
|------|-----|------|
| `--background` | `#09090b` | 베이스 배경 |
| `--foreground` | `#fafafa` | 메인 텍스트 |
| `--primary` | `#6366f1` | 인디고 |
| `--accent` | `#a78bfa` | 라이트 바이올렛 |
| `--muted` | `#71717a` | 서브텍스트 |
| `--border` | `#27272a` | 보더 |
| `--card-bg` | `rgba(255,255,255,0.03)` | 카드 배경 |

---

## 3. 섹션 구조

### 3.1 Header
- **레이아웃**: flex, space-between, items-center
- **좌측**: 로고 텍스트 "cl_embed" (font-weight: 600, font-size: 16px)
- **우측**: 테마 토글 버튼 (sun/moon 아이콘, lucide-react)
- **배경**: 투명, sticky 포지셔닝
- **패딩**: px-6, py-4

### 3.2 Hero Section
- **배경**: 그라데이션 오브 2개 오버레이
  - 오브 1: 인디고 (#6366f1, opacity 8%, top-left, 200px)
  - 오브 2: 바이올렛 (#8b5cf6, opacity 6%, bottom-right, 150px)
  - blur: 150px
- **타이틀**:
  - 텍스트: "AI-Powered\nCategory Intelligence"
  - 스타일: 그라데이션 텍스트 (`#e0e0e0` → `#a0a0ff`)
  - font-size: 40px (mobile) / 56px (desktop)
  - font-weight: 700
  - letter-spacing: -0.5px
  - line-height: 1.1
- **서브 텍스트**:
  - 텍스트: "다국어 AI 카테고리 추천 시스템"
  - 색상: muted
  - font-size: 14px / 16px
- **CTA 버튼**:
  - Primary ("기술 시연"): 그라데이션 배경 (#6366f1 → #8b5cf6), box-shadow 글로우
  - Secondary ("로그인"): 아웃라인, border-primary
  - rounded-lg, padding: 10px 24px
- **정렬**: 중앙 정렬, flex-col

### 3.3 기술 스택 배지
- **레이아웃**: flex, gap-2, flex-wrap, 중앙 정렬
- **배지 스타일**:
  - border: 1px solid --border
  - background: semi-transparent
  - padding: 4px 12px
  - border-radius: 9999px (pill)
  - font-family: monospace
  - font-size: 12px
  - 색상: primary/accent
- **기술 스택 목록**: pgvector, Ollama, Laravel, Next.js, Redis, Docker
- **애니메이션**: 페이지 로드 시 stagger fade-in (100ms 간격)

### 3.4 핵심 수치 카드 (3개)
- **레이아웃**: flex, gap-4, 중앙 정렬
- **카드 스타일**:
  - background: rgba(255,255,255,0.03)
  - border: 1px solid --border
  - padding: 12px 16px
  - border-radius: 12px
- **수치 스타일**: 그라데이션 텍스트 (primary → accent)
- **카드 목록**:
  1. 100ms — 캐시 응답
  2. 3개 — 다국어 지원
  3. cosine — 유사도 검색

### 3.5 Footer
- **텍스트**: "MIT © 2026 cunlim"
- **색상**: muted, font-size: 12px
- **정렬**: 중앙

---

## 4. 애니메이션

| 요소 | 애니메이션 | 상세 |
|------|----------|------|
| Hero 텍스트 | fade-up | opacity 0→1, translateY 20px→0, 300ms ease-out |
| CTA 버튼 | glow pulse | 호버 시 box-shadow 확장, 200ms transition |
| 배지 | stagger fade-in | 100ms 간격, opacity 0→1 |
| 배경 오브 | slow float | translateY ±10px, 6s ease-in-out infinite (선택적) |

---

## 5. 반응형 브레이크포인트

| Breakpoint | Width | 변경사항 |
|------------|-------|---------|
| Mobile | < 640px | 배지 2열, 타이틀 40px, 푸터 세로 |
| Tablet | 640px - 1024px | 배지 3열, 타이틀 48px |
| Desktop | > 1024px | 배지 4열, 타이틀 56px, 최대 너비 제한 |

---

## 6. 구현 파일

```
nextjs/app/
├── page.tsx          # 메인 랜딩 페이지
├── layout.tsx        # 루트 레이아웃 (테마 프로바이더)
└── globals.css      # CSS 변수, 애니메이션

nextjs/components/
├── ui/               # shadcn/ui 컴포넌트
│   ├── button.tsx
│   └── toggle.tsx    # 테마 토글용
├── header.tsx        # 헤더 컴포넌트
├── hero-section.tsx  # 히어로 섹션
├── tech-badges.tsx   # 기술 스택 배지
├── stats-cards.tsx   # 핵심 수치 카드
└── footer.tsx        # 푸터

nextjs/components/theme-provider.tsx  # next-themes 프로바이더
```

---

## 7. 의존성

- `next-themes`: 다크/라이트 모드 토글
- `lucide-react`: 아이콘 (Sun, Moon)
- `clsx`, `tailwind-merge`: 클래스 유틸리티
- `tailwindcss-animate`: 애니메이션 (또는 CSS @keyframes 직접 작성)

---

## 8. 제외 사항

- 라우팅 (현재는 단일 페이지)
- 로그인/회원가입 UI (별도 페이지)
- `/embed` 기술 시연 페이지 (별도 디자인 문서)
