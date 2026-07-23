# UI 디자인 가이드

## 디자인 원칙

1. **shadcn/ui 사용**: 모든 UI 컴포넌트는 shadcn/ui (`base-nova` 스타일) 기반으로 구축한다.
2. **반응형 디자인**: 모바일(375px) → 태블릿(768px) → 데스크톱(1280px+) 순으로 mobile-first 디자인.
3. **화이트/다크 모드**: `next-themes` 기반 class 전략으로 light/dark 모두 지원.
4. **랜딩 페이지 스타일 비중**: 깔끔함 50% + 특수효과/개발자스러운 스타일 50%.

---

## 2. 타이포그래피

| 항목 | 값 |
|------|-----|
| Heading 폰트 | Noto Sans SC (한/영/중 다국어 지원) |
| Body/Mono 폰트 | Noto Sans SC (본문), Space Grotesk (코드 표시) |
| Body 행간 | `leading-relaxed` (1.625) |
| Heading 행간 | `leading-tight` (1.25) |

### 타입 스케일

| 타입 | 모바일 | 데스크톱 |
|------|--------|----------|
| Display/H1 | text-4xl | text-6xl~7xl |
| H2 | text-2xl | text-3xl |
| H3 | text-base | text-xl |
| Body | text-base | text-lg |
| Meta | text-xs | text-xs |

---

## 3. 컴포넌트 스타일

### 3.1 버튼

| 변형 | 용도 |
|------|------|
| `default` | 주요 CTA, 토글 그룹 선택 항목 |
| `outline` | 보조 액션. **hover 시 `hover:bg-muted hover:text-foreground` 필수** — 기본 `hover:text-accent-foreground`는 light 모드에서 텍스트 invisible |
| `ghost` | 토글 그룹 비선택 항목, 테마 토글. `hover:bg-primary/50` |
| `link` | 인라인 텍스트 링크 |

**토글 그룹 패턴**: 2~3개 옵션 전환 시 `variant={active ? "default" : "ghost"}` + ghost에 `hover:bg-primary/50`. size="sm", h-7 px-2 text-xs.

### 3.2 StatusBadge

카테고리 테이블에서 번역 상태를 아이콘만으로 표시. 라벨 텍스트 없이 `aria-label`로 접근성 제공.
- 완료: `CheckCircle2` (green)
- 진행중/부분: `Clock` (blue)
- 미처리: `Minus` (muted)
- 모든 상태: `flex items-center justify-center` — 테이블 셀 내 중앙정렬

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
  - 카테고리 검색 (ko/zh/en 언어 선택 버튼 + `GET /api/categories?similarity_query=...`)
  - 카테고리 목록 (shadcn Table, 페이지네이션 10/20/50, URL 동기화)
  - 계층 탐색 (CategoryHierarchy — 동적 깊이 select, `>` 구분자)
  - 카테고리 추가·수정·삭제 (권한 기반)
  - 일괄 처리 (step 순차 실행, 중지/재실행)
- **상태 표시**: 빈 상태(Database 아이콘), 로딩(Skeleton), 에러(AlertCircle + 재시도)

### 6.4 `/admin` 관리자 페이지

- **superadmin 전용**. 사이드바 메뉴(시스템 설정 / 회원 관리 / 안내). SettingsPanel에서 임베딩/번역 프로바이더 설정(임베딩·번역 API 키 포함)·pagination·cache 설정 조회/수정. 회원 관리 패널에서 회원 목록·상세 모달·API 사용량 통계·회수 조절. 인증 실패 시 서버사이드 redirect로 어떤 UI도 노출되지 않음.

### 6.5 `/mypage` 마이페이지

- **로그인 사용자 전용**. 독립 경로(`/mypage`). 헤더 닉네임에서 링크.
- **구성 순서**: API key 관리 → 사용량 대시보드 → 기간별 추이 차트 → 최근 호출 이력
- **API key 관리**: Card + key 목록(이름·상태배지·truncated key·복사·편집·일시정지·삭제). 생성 Dialog.
- **사용량 대시보드**: 4-stat grid(총 호출·오늘 호출·남은 회수·활성 key). 2cols mobile / 4cols desktop.
- **기간별 차트**: div 기반 bar chart(결정적 height 수식). no chart library.
- **호출 이력**: Table(날짜·API key·상태배지·처리시간).

### 6.6 공통 패턴

- **아이콘**: lucide-react만 사용, 이모지 금지
- **로딩**: Skeleton 또는 `animate-pulse`
- **빈 상태**: 아이콘 + 설명 + CTA
- **에러**: inline error + retry button + `aria-live="polite"`

---

## 7. 성능 & 접근성

- 이미지: `next/image`, 폰트: `next/font/google`, 번들: 동적 임포트
- 대비: 4.5:1 (일반) / 3:1 (큰 텍스트), 포커스: `focus-visible:ring-2 focus-visible:ring-ring`
- 터치 타겟 최소 44x44px, 모바일 body 최소 16px
- icon-only button은 `aria-label` 필수
