# Admin 페이지 재설계

**날짜:** 2026-05-17
**상태:** 설계 완료

## 개요

Admin 페이지의 카테고리 리스트와 번역·임베딩 관리 UI를 재설계한다. 리스트는 한국어만 표시하고, 나머지 언어 정보는 모달에서 관리한다. Play 버튼을 View 버튼으로 변경하여 자동 실행을 제거하고, 모달에서 명시적 실행 버튼을 제공한다.

## 현황 진단

백엔드 API(`POST /api/categories`, `POST /api/categories/{id}/translate-embed`)는 정상 동작하며 번역과 임베딩이 DB에 저장된다. 문제는 WebSocket 이벤트가 프론트엔드에 도달하지 않는 것으로 추정된다.

## 백엔드 변경

### 새 엔드포인트: `GET /api/categories/{id}/translations`

모달 오픈 시 카테고리별 번역·임베딩 상태와 결과를 조회한다.

**응답 구조:**
```json
{
  "data": {
    "id": 12,
    "category_code": "CAT_kookgi76",
    "category_name_ko": "테스트>카테고리>추가테스트",
    "embedding_dimensions": 1024,
    "languages": {
      "ko": {
        "translation_text": "테스트>카테고리>추가테스트",
        "embedding": {
          "status": "completed",
          "preview": [0.022, -0.056, 0.091, 0.003, -0.018]
        }
      },
      "en": {
        "translation_text": "Test>Category>Additional test",
        "embedding": {
          "status": "completed",
          "preview": [-0.041, 0.089, -0.012, 0.055, -0.003]
        }
      },
      "zh": {
        "translation_text": "测试>类别>进一步测试",
        "embedding": {
          "status": "completed",
          "preview": [0.012, -0.034, 0.056, 0.078, -0.023]
        }
      }
    }
  }
}
```

- `embedding_dimensions`: 전역값, config에서 읽음
- `embedding.preview`: 앞 5개 값만
- `status`: `"completed"` | `"pending"` | `"failed"` | `"running"`

### 기존 엔드포인트 수정: `POST /api/categories/{id}/translate-embed`

개별 버튼(번역 실행, 임베딩 실행)에서 특정 언어·단계만 실행할 수 있도록 요청 바디에 선택적 파라미터를 추가한다.

**요청 바디:**
```json
{
  "steps": ["translation.zh"]  // 생략 시 전체 5단계 실행
}
```

가능한 값: `"translation.zh"`, `"translation.en"`, `"embedding.ko"`, `"embedding.zh"`, `"embedding.en"`

복수 단계 전송 시 순차 실행. `"translation.zh"`와 `"embedding.zh"`를 함께 보내면 번역 후 임베딩 순서 보장.

### 카테고리 목록 API 확장

`GET /api/categories` 응답에 `translation_status: "completed" | "partial" | "pending"` 필드 추가. zh·en 번역과 ko·zh·en 임베딩 모두 존재하면 `completed`, 일부만이면 `partial`, 전무면 `pending`.

### WebSocket 디버깅

- Reverb 채널명, 앱 키, 인증 검증
- `supervisorctl` 로그 + 브라우저 Echo 디버그 동시 확인

## 프론트엔드 변경

### 메인 테이블 (3컬럼)

| 컬럼 | 내용 |
|------|------|
| 한국어 카테고리 | `category_name_ko` |
| 상태 | 아이콘: 녹색 체크(처리완료) / 노란 경고(일부처리) / 회색 대시(처리안됨) |
| 보기 | 눈 아이콘 버튼, 클릭 시 모달 오픈 |

### 카테고리 상세 모달

**레이아웃:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  카테고리 상세                                                [닫기]    │
│  코드: CAT_kookgi76                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ☑ 한국어 (ko)                                            [완료]        │
│  │  원본   │ 테스트>카테고리>추가테스트                   │ 📋  │        │
│  │  임베딩 │ [0.022, -0.056, 0.091, 0.003, -0.018]…     │ 📋  │        │
│                                                                          │
│  ☑ 영어 (en)                                              [완료]         │
│  │  번역   │ Test>Category>Additional test              │ 📋  │           │
│  │  임베딩 │ [-0.041, 0.089, -0.012, 0.055, -0.003]…   │ 📋  │           │
│                                                                          │
│  ☑ 중국어 (zh)                                            [완료]         │
│  │  번역   │ 测试>类别>进一步测试                         │ 📋  │           │
│  │  임베딩 │ [0.012, -0.034, 0.056, 0.078, -0.023]…    │ 📋  │           │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                      [전체 실행]         │
└──────────────────────────────────────────────────────────────────────────┘
```

**3컬럼 구성**: `라벨 | 값 (줄임표) | 액션`

**액션 셀 로직:**
- 번역/임베딩 완료 → 복사 버튼 (📋)
- 한국어 원본 완료 → 복사 버튼
- 미완료 → 실행 버튼 (상호 배타적)
- 한국어 원본은 실행 버튼 없음 (번역 불필요)

**언어 순서:** 한국어 → 영어 → 중국어

**상태 뱃지 (4가지):** 완료(녹색) / 진행중(파란 spinner) / 실패(빨간) / 대기(회색)

**너비:** `max-w-3xl` 이상

### 6개 액션 버튼

| 버튼 | 위치 | 대상 |
|------|------|------|
| 번역 실행 | en 번역 행 | en 번역 |
| 번역 실행 | zh 번역 행 | zh 번역 |
| 임베딩 실행 | ko 임베딩 행 | ko 임베딩 |
| 임베딩 실행 | en 임베딩 행 | en 임베딩 |
| 임베딩 실행 | zh 임베딩 행 | zh 임베딩 |
| 전체 실행 | 모달 하단 | 체크박스 선택된 모든 언어 |

### 파일 변경

| 파일 | 작업 |
|------|------|
| `nextjs/app/admin/page.tsx` | 테이블 재설계, Play→View, 모달 분리 |
| `nextjs/components/admin/category-modal.tsx` | 신규 — 카테고리 상세 모달 |
| `nextjs/hooks/useCategoryDetail.ts` | 신규 — GET translations API 페칭 |
| `nextjs/hooks/useCategoryProgress.ts` | WebSocket 구독 유지, 자동 실행 제거 |
| `nextjs/lib/api.ts` | `fetchCategoryDetail()` + 상태 타입 추가 |

### 데이터 흐름

1. 보기 버튼 → 모달 오픈 → `GET /api/categories/{id}/translations` → 상태 렌더링
2. 실행 버튼 → `POST /api/categories/{id}/translate-embed` → WebSocket 진행 수신 → 완료 후 재페칭

## 테스트

### Playwright E2E

- 관리자 로그인 (token injection), 테이블 렌더링, 상태 아이콘
- 모달 열기/닫기, 언어별 데이터 표시, 복사 버튼
- 전체 실행 + 개별 실행, WebSocket 진행 확인, 완료 후 상태 갱신
- 실패 상태 표시 + 재시도

### Vitest (프론트엔드)

- `useCategoryDetail`: API → 상태 변환 로직
- `CategoryModal`: 언어 섹션 렌더링, 버튼 표시/숨김
- `page.tsx`: 테이블 컬럼, 상태 아이콘 로직

### Pest (백엔드)

- `GET /api/categories/{id}/translations`: 응답 구조, 상태 필드
- `GET /api/categories`: 확장 필드 `translation_status`

## 2026-05-17 수정 — UI 버그 수정

### 1. 체크박스 및 상태 뱃지 제거

- 언어별 체크박스 제거. `checked` state, `Checkbox` import 삭제.
- 언어 헤더의 `statusBadge()` 제거. 언어명만 표시.
- `handleRunAll`: 체크박스 필터링 없이 모든 누락 step 실행.

### 2. 복사 알림 및 전체값 복사

- `sonner` toast 추가 (`npx shadcn add sonner`). `<Toaster />`를 layout에 추가.
- `copyToClipboard` 함수에서 `toast("클립보드에 복사되었습니다")` 호출.
- 임베딩: `renderRow`의 display 값(앞 5개+`…`)과 복사 값(전체 `preview` 배열)을 분리.
  - 복사 시 전체 preview 배열을 JSON 문자열로 복사.

### 3. 실행 버튼 로딩 및 결과 갱신

- `useCategoryProgress` 훅 개선:
  - `activeStep: StepName | null` 추가 → 특정 step만 로딩 스피너 표시.
  - `isRunning`은 전체 실행 버튼 `disabled` 용도로만 사용(스피너 없음).
  - WebSocket 이벤트 수신 시 `onUpdate` 콜백 호출.
- `CategoryModal`:
  - `onUpdate` 콜백에서 `reload()` 호출하여 데이터 재페칭.
  - 개별 버튼: `activeStep === stepName`일 때만 `Loader2` 표시.
  - 전체 실행 버튼: `disabled={isRunning}`만 적용(스피너 없음).
  - API 에러 시 `setError`로 실패 메시지 표시.
