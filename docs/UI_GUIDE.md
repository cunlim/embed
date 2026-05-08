# UI 디자인 가이드

## 디자인 원칙
1. **도구처럼 보여야 한다**: 마케팅 템플릿이 아닌, 직관적이고 매일 쓰는 대시보드 환경 구축. 검색과 추천 데이터에 집중한다.
2. **명확한 계층구조 및 즉각적 피드백**: 대/중/소 계층 및 실시간 데이터 처리율을 사용자가 실시간으로 확인 가능하게 한다.
3. **결과 시인성 확보**: 검색 키워드 및 결과 도출 데이터를 사용자가 한눈에 파악할 수 있도록 볼드(Bold) 및 수치화하여 하이라이팅한다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상
### 배경
| 용도 | 값 |
|------|------|
| 페이지 | #0a0a0a |
| 카드 | #141414 |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 | text-white |
| 본문 | text-neutral-300 |
| 보조 | text-neutral-400 |
| 비활성 | text-neutral-500 |

### 데이터/시맨틱 색상
| 용도 | 값 |
|------|------|
| 긍정/성공 | #22c55e |
| 부정/에러 | #ef4444 |
| 중립/기본 | #525252 |

## 컴포넌트
### 카드
`rounded-lg bg-[#141414] border border-neutral-800 p-6`
### 버튼
- Primary: `rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors`
- Text: `text-neutral-500 hover:text-neutral-300 transition-colors`
### 입력 필드 및 Select
`rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-white`

## 레이아웃 및 타이포그래피
- **전체 너비**: `max-w-5xl`
- **정렬**: 좌측 정렬 기본. (중앙 정렬 금지)
- **간격**: 내부 요소 `gap-3~4`, 메인 섹션 간 `space-y-8`
- **타이포그래피**: 
  - 페이지 제목: `text-4xl font-semibold text-white`
  - 카드 제목: `text-sm font-medium text-neutral-400`
  - 본문: `text-sm text-neutral-300 leading-relaxed`

## 애니메이션 및 아이콘
- **허용 애니메이션**: `fade-in (0.4s)`, `slide-up (0.5s)`. 그 외 모든 글로우/바운스 효과 금지.
- **아이콘**: SVG 인라인 적용, `strokeWidth 1.5`, 둥근 배경 박스 컨테이너 금지.

## 화이트/다크 모드 전환
- **전략**: Tailwind `darkMode: 'class'` (`tailwind.config`에 `darkMode: 'class'` 설정). HTML `<html>` 요소에 `class="dark"` 유무로 모드 전환.
- **상태 유지**: 사용자 선호를 `localStorage.getItem('theme')`에 저장. 최초 방문 시 `prefers-color-scheme` 시스템 설정을 감지해 fallback.
- **전환 버튼**: 헤더 영역 우측에 배치. UI: `rounded-lg bg-neutral-900 dark:bg-neutral-800 border border-neutral-800 px-3 py-2 text-neutral-400 hover:text-neutral-200 transition-colors`. Sun/Moon SVG 아이콘을 조건부 렌더링.
- **화이트 모드 색상** (기존 다크 모드 값과 쌍):
  | 용도 | 다크 모드 | 화이트 모드 |
  |------|-----------|-------------|
  | 페이지 배경 | #0a0a0a | #fafafa |
  | 카드 배경 | #141414 | #ffffff |
  | 카드 테두리 | border-neutral-800 | border-neutral-200 |
  | 주 텍스트 | text-white | text-neutral-900 |
  | 본문 | text-neutral-300 | text-neutral-600 |
  | 보조 | text-neutral-400 | text-neutral-500 |
  | 비활성 | text-neutral-500 | text-neutral-400 |
  | 입력 필드 배경 | bg-neutral-900 | bg-neutral-100 |
  | 입력 필드 테두리 | border-neutral-800 | border-neutral-300 |

## 반응형 레이아웃
- **기준**: Tailwind 기본 브레이크포인트 (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`). **모바일 우선(mobile-first)** 설계. 별도 중단점 정의 금지.
- **3단계 레이아웃 변화**:
  | 범위 | 동작 |
  |------|------|
  | `< md (768px)` | 단일 컬럼. 사이드바/헤더 드로어로 전환. 카드 그리드 `grid-cols-1`. 모바일용 하단 네비게이션 바 노출. |
  | `md ~ lg (768px ~ 1024px)` | 2단계 계층 구조. 사이드바 축소 아이콘만 표시. 카드 그리드 `grid-cols-2`. |
  | `>= lg (1024px)` | 최대 레이아웃. 전체 사이드바 노출. 카드 그리드 `grid-cols-3` (필요 시 `grid-cols-4`). |
- **컨테이너**: `max-w-5xl`을 넘지 않도록 제한. 모바일 뷰에서는 양옆 여백 `px-4`, 데스크톱에서는 `px-6`.
- **텍스트 크기**:
  | 요소 | 모바일 | 데스크톱 |
  |------|--------|----------|
  | 페이지 제목 | `text-2xl` | `text-4xl` |
  | 카드 제목 | `text-xs` | `text-sm` |
  | 본문 | `text-xs` | `text-sm` |

---

## 도메인 특화 컴포넌트

### 검색 추천 영역
- 텍스트 입력 및 타겟 언어(한국어/중국어/영어) 선택, 임베딩 모델 Select Box (소스코드/DB 사전 등록 모델만 표시, 유저 임의 추가 불가).
- **키워드 하이라이트**: `LIKE` 조건으로 검색된 결과 리스트에서 입력 키워드는 **Bold** 처리.
- **유사도 및 출력 설정**: 코사인 유사도 수치 결과 함께 표시. 출력 추천 개수 설정 가능 (기본값 10개).
- **진행률 바(Progress Bar)**: 백엔드 이벤트 수신 시 '번역 완료 건수' 및 '임베딩 완료 건수'를 프로그레스 바로 렌더링 (락이 걸려있는 상태일 경우 중복 호출 없이 UI 업데이트만 수행).

### 버튼 A (벡터 계산 과정 모달)
- 동작: 결과 간 벡터의 $cosine\_similarity = \frac{A \cdot B}{||A|| ||B||}$ 계산식 과정을 노출.
- UI 처리: 원시 벡터 배열 노출 시 앞뒤 일부만 표기하고 중간은 줄임표(...) 생략, 최하단 최종 유사도 표기.

### 버튼 B (동적 계층형 Select Box 모달)
- 동작: `"A>B>C"` 형태의 원시 문자열을 동적 파싱하여 계층 구조 생성. 해당 결과가 대/중/소 단계별로 이미 선택된 상태의 Select Box들을 렌더링.
- 상호작용: 
  - 상위 카테고리 변경 시 하위 Select Box가 실시간으로 연동 업데이트.
  - "카테고리를 선택해주세요" 클릭 시 하위 Select Box 즉시 숨김.
  - 최하위 분류 도달 시 해당 카테고리 코드 및 임베딩 값을 표시하고 '완료' 버튼 노출.

### 인증 및 사용자 UI
- **로그인/회원가입 모달**: 
  - 불필요한 정보 입력을 최소화한 단순한 폼 디자인.
  - 이메일/비밀번호 입력 필드와 함께 OAuth(Google, GitHub, Naver) 소셜 로그인 버튼을 카드 하단에 배치. 소셜 버튼은 각 브랜드의 공식 색상이나 모노톤(흰/검)으로 통일감 있게 배치.
- **개인 설정 영역**: 
  - 추천 개수 조정(기본값 10개)을 위한 슬라이더(Slider) 또는 숫자 입력기 제공.

### 관리자(Admin) 전용 영역
- **접근 권한**: 일반 유저에게는 숨김 처리, 어드민 권한 식별 시 사이드바 또는 상단 헤더에 노출.
- **카테고리 관리 폼**: 
  - 신규 카테고리 입력을 위한 단일 Text Input (한국어 전용).
  - 입력 후 '추가' 버튼 클릭 시 즉각적인 피드백(성공/에러 토스트 메시지) 제공.
  - 목록 조회 영역에서 개별 항목 수정/삭제 아이콘(Trash, Edit) 제공.