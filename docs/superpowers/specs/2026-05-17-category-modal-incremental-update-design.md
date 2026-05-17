# 카테고리 모달 증분 업데이트

## 배경

관리자 페이지의 카테고리 상세 모달에서 번역/임베딩 개별 실행 시 UI가 깨지고, 실행 완료 후 모달 전체가 refresh 되는 문제를 해결한다.

## 문제

1. **UI 깨짐**: 개별 실행 버튼 클릭 시 버튼이 사라지고 Loader2 아이콘으로 대체됨. 데이터 컬럼에도 전역 spinner가 표시됨.
2. **전체 refresh**: WebSocket 진행 이벤트 수신 시마다 API 전체 재조회로 모달이 완전히 다시 렌더링됨.

## 변경 범위

| 파일 | 변경 |
|------|------|
| `laravel/app/Events/CategoryProgress.php` | `?string $result = null` 추가 |
| `laravel/app/Jobs/CategoryTranslateEmbedPipeline.php` | completed broadcast 시 결과 데이터 전달 |
| `nextjs/components/admin/category-modal.tsx` | UI 수정 + 증분 업데이트 |
| `nextjs/hooks/useCategoryProgress.ts` | CategoryProgress 타입에 result 추가 |

## 설계

### 백엔드

- `CategoryProgress` 이벤트에 `result` 필드 추가 (번역 완료 시 번역 텍스트, 임베딩 완료 시 첫 10개 값 JSON 배열)
- `CategoryTranslateEmbedPipeline` job에서 completed dispatch 시 result 전달

### 프론트엔드

- `stepResults: Map<StepName, string>` 상태로 WebSocket 결과 저장
- 데이터 컬럼: spinner 제거, 실행 중에도 "처리전" 텍스트 유지
- 액션 컬럼: `<Button>` 래퍼 유지, 내부 아이콘만 `<Loader2>`로 교체
- 개별 step 완료 시 `onReload()` 호출하지 않음
- 전체 pipeline 완료 (`.category.completed`) 시에만 최종 동기화로 `onReload()` 1회 호출
