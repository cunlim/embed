# UI 디자인 가이드

## 디자인 원칙

1. `/example-skills:frontend-design` 스킬을 사용해야 한다
2. shadcn/ui 사용, white/dark 모드 전환 가능, 반응형 디자인
3. 브라우저 검증은 playwright plugin 사용, https://embed.cunlim.dev 접속
4. `/` 랜딩 페이지: 깔끔함 70% + 특수효과 + 개발자스러운 스타일 30%
5. `/embed` 기술 시연 페이지: 검색 키워드 및 결과 데이터를 **볼드(Bold)** 및 **수치화**하여 하이라이팅

---

## Neural Bloom 디자인 시스템

랜딩 페이지에서 확립된 디자인 시스템을 모든 페이지에서 일관되게 적용합니다.

### 컬러 시스템

#### CSS 변수
```css
:root {
  /* Light Mode */
  --background: #fafafa;
  --foreground: #18181b;
  --primary: #6366f1;
  --accent: #8b5cf6;
  --muted: #a1a1aa;
  --border: #e5e5e5;
  --card-bg: rgba(255, 255, 255, 0.03);
  --glow-primary: rgba(99, 102, 241, 0.25);
  --glow-accent: rgba(139, 92, 246, 0.2);
}

.dark {
  /* Dark Mode */
  --background: #09090b;
  --foreground: #fafafa;
  --primary: #6366f1;
  --accent: #a78bfa;
  --muted: #71717a;
  --border: #27272a;
  --card-bg: rgba(255, 255, 255, 0.03);
  --glow-primary: rgba(99, 102, 241, 0.35);
  --glow-accent: rgba(139, 92, 246, 0.25);
}
```

#### Tailwind 클래스
| CSS 변수 | Tailwind 클래스 | 용도 |
|----------|----------------|------|
| `--background` | `bg-background` | 메인 배경 |
| `--foreground` | `text-foreground` | 메인 텍스트 |
| `--primary` | `text-primary`, `bg-primary` | CTA, 액센트 |
| `--accent` | `text-accent`, `bg-accent` | 서브 액센트 |
| `--muted` | `text-muted` | 서브텍스트 |
| `--border` | `border-border` | 보더 |

### 그라데이션 텍스트
```css
.gradient-text {
  background: linear-gradient(135deg, #e0e0e0 0%, #a0a0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 글로우 버튼
```css
.btn-glow {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.btn-glow:hover {
  box-shadow: 0 0 20px var(--glow-primary), 0 0 40px var(--glow-accent);
  transform: translateY(-1px);
}
```

### 애니메이션
| 클래스 | 용도 |
|--------|------|
| `.animate-fade-up` | Hero 텍스트 페이드업 |
| `.animate-float` | 배경 그라데이션 오브 플로트 |
| `.animate-stagger-1` ~ `.animate-stagger-6` | Stagger 페이드인 |

### 배경 그라데이션 오브
```tsx
{/* 인디고 오브 */}
<div className="absolute top-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[150px] animate-float" />

{/* 바이올렛 오브 */}
<div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-accent/10 rounded-full blur-[150px] animate-float" />
```

---

## 페이지별 가이드라인

### `/` (랜딩 페이지) — ✅ 구현 완료

**상태**: Neural Bloom 스타일로 구현 완료

**컴포넌트**:
- `Header` — 로고 + 테마 토글
- `HeroSection` — 그라데이션 오브 + 타이틀 + CTA
- `TechBadges` — 6개 기술 스택 배지
- `StatsCards` — 핵심 수치 3개
- `Footer` — 카피라이트

---

### `/login` (로그인 페이지)

**가이드라인**:
- Neural Bloom 테마 일관성 유지
- 로그인 폼은 중앙 정렬, 카드를 사용한 컨테이너
- Primary CTA: `btn-glow` 클래스
- 소셜 로그인 버튼 (Google, GitHub, Naver)은 아웃라인 스타일
- 헤더: 랜딩 페이지와 동일한 `Header` 컴포넌트 사용
- 폼 필드: shadcn/ui `Input` 컴포넌트 사용

**레이아웃**:
```
┌─────────────────────────────────┐
│ Header (재사용)                 │
├─────────────────────────────────┤
│                                 │
│        ┌─────────────────┐      │
│        │  cl_embed       │      │
│        │  로그인         │      │
│        │                 │      │
│        │  [이메일]       │      │
│        │  [비밀번호]     │      │
│        │                 │      │
│        │  [로그인 버튼]  │      │
│        │                 │      │
│        │  ─── 또는 ───   │      │
│        │  [Google] [GitHub] [Naver] │
│        │                 │      │
│        │  계정이 없으신가요? │    │
│        └─────────────────┘      │
│                                 │
└─────────────────────────────────┘
```

---

### `/embed` (기술 시연 페이지)

**가이드라인**:

1. **검색 결과 하이라이팅**:
   - 검색 키워드: `gradient-text` 또는 `font-bold`로 강조
   - 결과 수치 (유사도 %, 응답 시간 등): **볼드체** + 수치 단위 강조
   - 예: "**87.5%** 유사도", "**142ms** 소요"

2. **레이아웃**:
   - 헤더: `Header` 재사용
   - 메인: 2컬럼 레이아웃 (좌: 입력 폼, 우: 결과)
   - 모바일: 단일 컬럼 스택

3. **입력 폼 영역**:
   - 검색어 입력: shadcn/ui `Input`
   - 언어 선택: shadcn/ui `Select` 또는 `DropdownMenu`
   - CTA: `btn-glow`

4. **결과 표시 영역**:
   - 카테고리 카드: `bg-card-bg border border-border rounded-xl`
   - 유사도 점수: `gradient-text`로 강조
   - 응답 시간: `font-bold` + 단위 강조

5. **카드 스타일**:
   ```tsx
   <div className="bg-card-bg border border-border rounded-xl p-4">
     <h3 className="font-semibold">카테고리명</h3>
     <p className="text-sm text-muted">카테고리 설명</p>
     <div className="mt-2">
       <span className="gradient-text font-bold">87.5%</span>
       <span className="text-xs text-muted ml-2">유사도</span>
     </div>
   </div>
   ```

---

## 공통 컴포넌트

### ThemeProvider
```tsx
// components/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### Header
```tsx
// components/header.tsx - 재사용 가능한 헤더
```

---

## 의존성

```json
{
  "dependencies": {
    "next-themes": "^0.4.6",
    "lucide-react": "^1.14.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  }
}
```

---

## 브라우저 검증 체크리스트

모든 페이지 구현 후 아래 항목 검증:

- [ ] https://embed.cunlim.dev 접속
- [ ] 다크/라이트 모드 전환 정상 동작
- [ ] 반응형 레이아웃 (모바일/태블릿/데스크탑)
- [ ] 애니메이션 동작 확인
- [ ] CTA 버튼 hover 효과 확인
