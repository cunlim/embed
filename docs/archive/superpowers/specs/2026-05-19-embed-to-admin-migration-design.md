# embed → admin 기능 이전 설계

## 목표

embed 페이지(`/embed`)의 모든 기능을 admin 페이지(`/admin`)로 이전하고, embed 페이지는 빈 상태로 둔다. admin에 이미 존재하는 기능(검색, 카테고리 CRUD, 개별 실행)은 보존한다.

## 이전 대상 기능 (3가지)

### 1. 카테고리 계층 탐색

- 3단계 Select Box (대분류 → 중분류 → 소분류)로 카테고리 브라우징
- `parseHierarchy()` (`lib/category.ts`) 재사용
- `useCategories` 훅은 admin에서 이미 사용 중이므로 공유
- 소분류 선택 시 해당 카테고리의 CategoryModal 열기

### 2. 일괄 번역

- 언어 선택 (중국어 / 영어) 후 "전체 번역 실행" 버튼
- `getAllCategories()`로 전체 카테고리 조회 → 각 카테고리에 `runStep()` 호출
- Progress bar로 진행률 표시 (완료/실패 건수)
- 완료 후 카테고리 목록 새로고침

### 3. 코사인 유사도 상세 다이얼로그

- 검색 결과의 유사도 점수 클릭 시 5단계 벡터 처리 파이프라인 설명
- admin 검색 결과에 이미 `similarity_score` 표시 중 → 점수에 `onClick` 추가

## admin 사이드바 레이아웃 (변경 후)

상단에서 하단 순서:
1. **카테고리 검색** (기존 유지)
2. **카테고리 계층 탐색** (신규)
3. **카테고리 추가** (기존 유지)
4. **일괄 번역** (신규)

## 코드 리팩토링

### 신규 컴포넌트 추출 (`components/admin/`)

| 컴포넌트 | 파일 | 담당 기능 |
|----------|------|-----------|
| `CategoryHierarchy` | `category-hierarchy.tsx` | 대/중/소 3단계 Select, 선택 시 모달 열기 콜백 |
| `BatchTranslate` | `batch-translate.tsx` | 일괄 번역: 언어 선택, 실행, Progress bar |
| `CosineDetailDialog` | `cosine-detail-dialog.tsx` | 5단계 파이프라인 설명 다이얼로그 |

### 기존 파일 변경

| 파일 | 변경 내용 |
|------|-----------|
| `app/admin/page.tsx` | 신규 컴포넌트 통합, 검색 결과 클릭 핸들러 추가 |
| `app/embed/page.tsx` | 모든 기능 제거, 인증 가드 + 안내 메시지만 유지 |

### 중복 제거

embed의 검색/추천 기능은 admin 검색(동일한 `POST /api/recommend` 사용)이 이미 대체하므로 이전하지 않는다.

## embed 페이지 최종 상태

- 인증 가드 유지 (비로그인 → `/login?redirect=/embed`)
- "카테고리 추천 기능이 관리자 페이지로 이전되었습니다" 안내 + `/admin` 이동 버튼

## 테스트 계획

- admin 페이지에서 계층 탐색 Select 동작 확인 (Playwright)
- admin 페이지에서 일괄 번역 실행 및 Progress bar 확인 (Playwright)
- admin 검색 결과 클릭 → 코사인 유사도 다이얼로그 표시 확인 (Playwright)
- embed 페이지 접속 시 안내 메시지 표시 확인
- `npm test` (Vitest) 통과 확인
- `php artisan test --compact` (Pest) 통과 확인 (백엔드 변경 없으므로 기존 통과 유지)

## 백엔드 변경

없음. API는 기존 그대로 사용한다.

## 제약

- shadcn/ui 컴포넌트만 사용, lucide-react 아이콘만 사용
- CSS 변수(oklch)만 사용, raw hex 금지
- mobile-first 반응형
- 다크 모드 지원
