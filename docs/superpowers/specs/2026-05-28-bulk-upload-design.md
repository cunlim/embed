# 대량 카테고리 업로드 기능 설계

## 개요

embed 페이지의 "추가" 섹션에 단일/대량 모드 토글을 추가하고, xlsx 파일을 통한 대량 카테고리 업로드 기능을 구현한다.

## 배경

현재 "추가" Card에서는 한 번에 하나의 카테고리만 등록 가능하다. 대량 등록이 필요한 사용자를 위해 xlsx 파일 업로드를 지원한다.

## 요구사항

1. "추가" Card 상단에 단일/대량 radio 버튼 토글
2. 대량 모드: xlsx 파일 업로드, 샘플 다운로드 버튼, 진행률 표시, 결과 통계
3. xlsx 구조: 2행부터 데이터, A열=카테고리 코드, B열=한국어(필수), C열=영어, D열=중국어
4. A열, B열이 비어있으면 실패로 처리, 결과 통계에 표시
5. 처리 결과 통계: 성공 개수 / 실패 개수 표시
6. 샘플 파일: `archive/카테고리대량등록_v1.xlsx` → `nextjs/public/samples/` 이동

## 아키텍처

### 백엔드 변경

**`CategoryStoreRequest`** — 선택적 번역 필드 추가:
- `category_name_en`: nullable, string, max:255
- `category_name_zh`: nullable, string, max:255

**`CategoryController::store()`** — 번역 필드가 있으면 Category 모델에 함께 저장

### 프론트엔드 변경

**Radio 토글**: `embed-page-inner.tsx`의 "추가" CardHeader에 "단일" / "대량" pill 버튼 (기존 필터 pill 패턴 재사용)

**대량 업로드 컴포넌트** (`components/bulk-upload.tsx`):
- 파일 input (xlsx 전용, drag-and-drop 미지원 — 단순성 유지)
- 샘플 다운로드 버튼 (`/samples/카테고리대량등록_v1.xlsx`)
- 업로드 실행 버튼
- 진행률 표시 (현재 행 / 전체 행)
- 결과 통계 (성공 N건 / 실패 N건)
- 실패 행 목록 (행 번호 + 실패 사유)

**xlsx 파싱**: `xlsx` (SheetJS) 라이브러리 사용, 클라이언트 사이드 파싱

**API 통합**: `createCategory()` 확장 — `category_name_en`, `category_name_zh` 파라미터 전달

### 파일 구조

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `laravel/app/Http/Requests/CategoryStoreRequest.php` | 수정 | 번역 필드 규칙 추가 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | 수정 | store()에서 번역 필드 저장 |
| `laravel/tests/Feature/CategoryStoreTest.php` | 수정/신규 | 번역 필드 저장 테스트 |
| `nextjs/lib/api.ts` | 수정 | createCategory() 파라미터 확장 |
| `nextjs/app/embed/embed-page-inner.tsx` | 수정 | Radio 토글 + 대량 모드 전환 |
| `nextjs/components/bulk-upload.tsx` | 신규 | 대량 업로드 컴포넌트 |
| `nextjs/public/samples/카테고리대량등록_v1.xlsx` | 이동 | 샘플 파일 |
| `nextjs/app/embed/__tests__/page.test.tsx` | 수정 | 테스트 업데이트 |

### 테스트 전략

- **백엔드**: Pest — 번역 필드 포함 생성, 번역 필드 없는 기존 동작 유지
- **프론트엔드**: Playwright E2E — 샘플 xlsx 업로드 → 성공/실패 통계 확인

### 제외 범위

- Drag-and-drop 파일 업로드 (단순 file input만 사용)
- 업로드 취소 기능
- 업로드 후 자동 번역/임베딩 실행 (별도 "작업 실행"으로 처리)
