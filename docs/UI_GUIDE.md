# UI 디자인 가이드

## 디자인 원칙

1. **도구처럼 보여야 한다** — 마케팅 페이지가 아니라 매일 쓰는 대시보드. 정보 밀도 높고 불필요한 여백 최소화.
2. **기능이 곧 디자인** — 장식은 최소화. 컴포넌트가 스스로 설명되어야 함.
3. **다크모드 고착** — 라이트 모드 지원하지 않음. 항상 `#0a0a0a` 배경.

## AI 슬롭 안티패턴 — 하지 마라

| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰. 이 프로젝트에서는 `#f97316` orange 포인트 사용 |
| 모든 카드에 동일한 `rounded-2xl` | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 파티클/별 그라데이션 배경 | AI 서비스의 보편적 장식 |
| typewriter/cursor 깜빡임 애니메이션 | AI 챗봇 클리셰 |

## 색상

### 배경

| 용도 | 값 |
|------|------|
| 페이지 배경 | `#0a0a0a` |
| 카드/패널 | `#141414` |
| 입력 필드 배경 | `#1a1a1a` (neutral-900) |
| 구분선 | `border-neutral-800` (`#262626`) |

### 텍스트

| 용도 | 값 |
|------|------|
| 주 텍스트 | `text-white` / `#ffffff` |
| 본문 | `text-neutral-300` / `#d4d4d4` |
| 보조 텍스트 | `text-neutral-400` / `#a3a3a3` |
| 비활성/플레이스홀더 | `text-neutral-500` / `#737373` |

### 데이터/시맨틱 색상

| 용도 | 값 |
|------|------|
| 긍정/성공 | `#22c55e` (green-500) |
| 부정/에러 | `#ef4444` (red-500) |
| 경고 | `#f59e0b` (amber-500) |
| 중립/기본 | `#525252` (neutral-700) |
| 포인트 (절대 보라색 안 됨) | `#f97316` (orange-500) |

## 컴포넌트

### 카드

```
rounded-lg bg-[#141414] border border-neutral-800 p-6
```

### 버튼

```
Primary:     rounded-lg bg-orange-500 text-white hover:bg-orange-400 font-medium px-4 py-2
Secondary:   rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 px-4 py-2
Destructive: rounded-lg bg-red-600 text-white hover:bg-red-500 px-4 py-2
Text:        text-neutral-400 hover:text-neutral-200 px-3 py-1
```

### 입력 필드

```
rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-500
focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent
```

### Select Box (임베딩 모델 선택, 언어 선택)

```
rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200
```

### 프로그레스 바

```
h-2 w-full rounded-full bg-neutral-800
h-2 rounded-full bg-orange-500 (채워진 부분 — 포인트 컬러 사용)
```

### 모달

```
rounded-xl bg-[#141414] border border-neutral-800 p-6 shadow-2xl
```

## 레이아웃

- **전체 너비**: `max-w-5xl` (메인 콘텐츠), `max-w-7xl` (관리자/대시보드)
- **정렬**: 좌측 정렬 기본. 중앙 정렬 금지.
- **간격**:
  - 구성 요소 간: `gap-3` ~ `gap-4`
  - 섹션 간: `space-y-8`
  - 카드 내부: `p-6`
- **그리드**: `grid-cols-1 md:grid-cols-2` (2컬럼), `grid-cols-1 md:grid-cols-3` (3컬럼)

## 타이포그래피

| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-3xl font-semibold text-white` |
| 섹션 제목 | `text-xl font-semibold text-white` |
| 카드 제목 | `text-sm font-medium text-neutral-400 uppercase tracking-wide` |
| 본문 | `text-sm text-neutral-300 leading-relaxed` |
| 라벨 | `text-xs font-medium text-neutral-500` |
| 코딩/숫자 | `font-mono text-xs text-neutral-400` |

## 애니메이션

허용 목록 (최소限的に 사용):
- `fade-in (0.4s ease-out)` — 요소 등장
- `slide-up (0.3s ease-out)` — 패널/모달 등장

모든 다른 애니메이션 금지:
- `pulse`, `ping` — AI "thinking" 표시
- `bounce` —喜庆以外禁用
- `spin` — 로딩 외 사용 금지
- CSS transitions는 `transition-colors`, `transition-opacity`만 (모션 없음)

## 아이콘

- SVG 인라인 (`stroke` 속성 사용)
- `strokeWidth 1.5` (기본값)
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않음
- 아이콘만 단독 사용, 필요 시旁边에 텍스트 배치

## 특수 컴포넌트

### 버튼 A — 벡터 계산 과정 모달

```
제목:          "벡터 유사도 계산"
벡터 표시:     검색어 벡터 앞 3개 값 + "..." + 뒤 3개 값
              카테고리 벡터 앞 3개 값 + "..." + 뒤 3개 값
              예시: [0.123, -0.456, 0.789, ...] [-0.234, 0.567, -0.891]
벡터 스타일:   font-mono text-xs text-neutral-500, 배경 구분선 border-neutral-800
공식 표기:     cosine_similarity = (A · B) / (||A|| × ||B||)
              text-sm text-neutral-400, 라벨로 설명
결과 수치:      0.8234 — text-2xl font-bold text-orange-500
닫기 버튼:     Secondary 버튼
```

### 버튼 B — 동적 계층형 Select Box 모달

```
입력 데이터:   "가구/인테리어>DIY자재/용품>목재" 형태의 원시 문자열
파싱 로직:     ">" 기준 분할 → ['가구/인테리어', 'DIY자재/용품', '목재']

1단계 Select (대분류):
  - label: "대분류 선택"
  - options: 분할된 문자열의 1번째 세그먼트 고유값 리스트
  - 선택 시 → 2단계 Select 표시

2단계 Select (중분류):
  - label: "중분류 선택"
  - options: 상위 선택에 종속된 2번째 세그먼트 필터링 결과
  - 미선택 시: "카테고리를 선택해주세요" placeholder, disabled 스타일

3단계 Select (소분류):
  - label: "소분류 선택"
  - options: 상위+중위 선택에 종속된 3번째 세그먼트 필터링 결과
  - 미선택 시: disabled

최하위 도달 시 (모든 Select 선택 완료):
  - category_code: font-mono text-xs text-neutral-400
  - 임베딩 값: font-mono text-xs text-neutral-600 (768차원 벡터 앞뒤 일부)
  - '적용' 버튼: Primary 버튼 (orange-500), 클릭 시 부모 리스트에 선택 항목 적용
  - '닫기' 버튼: Secondary 버튼

상위 Select 변경 시:
  - 하위 Select 즉시 비활성화 + 숨김 (display: none)
  - 선택된 값 초기화
```

### 검색 결과 카드

```
카테고리명:    category_name (타겟 언어)
              키워드 부분만 <strong>Bold</strong> 처리 — text-neutral-300
카테고리 코드: category_code — text-xs font-mono text-neutral-500
유사도 수치:   text-sm font-medium text-orange-500, 소수점 4자리 (예: 0.8723)
버튼 영역:     버튼 A 아이콘 (벡터) + 버튼 B 아이콘 (계층형) — text-neutral-400 hover:text-neutral-200
클릭 동작:     카드 자체 클릭 → 상세 정보 표시 또는 버튼 A/B 모달 트리거
레이아웃:      rounded-lg bg-neutral-900 border border-neutral-800 p-4, hover:border-neutral-700
```

## 접근성

- 모든 입력 필드에 `label` 연결 (`htmlFor`/`id`)
- 에러 메시지 `text-red-500` + 아이콘
- `aria-disabled`로 비활성 상태 표현
- 색상 대비: 텍스트-배경 대비 WCAG AA 이상