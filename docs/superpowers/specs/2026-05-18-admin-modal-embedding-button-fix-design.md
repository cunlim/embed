---
name: admin-embedding-button-fix
date: 2026-05-18
status: draft
---

# Admin 카테고리 모달 임베딩 실행 버튼 disabled 조건 수정

## 문제

`nextjs/components/admin/category-modal.tsx`에서 `translationDone` 플래그가 번역 버튼과 임베딩 버튼에 동일하게 사용되어 두 가지 버그가 발생한다.

### Bug 1: 한국어 임베딩 버튼이 항상 활성화됨

한국어 카테고리 텍스트를 빈값으로 수정해도 한국어 임베딩 실행(Play) 버튼이 비활성화되지 않는다.

**원인**: 한국어(`hasTranslation: false`)의 `translationDone`이 항상 `true`로 하드코딩되어 있어, 임베딩 Play 버튼의 `disabled` 조건(`isExecuting || translationDone === false`)을 통과한다.

**재현**: Playwright으로 카테고리 모달 열기 → 한국어 input 비우기 → blur → 한국어 임베딩 "임베딩 실행" 버튼이 enabled 상태로 유지됨

### Bug 2: en/zh 임베딩 버튼이 한국어 빈값에 무조건 비활성화됨

한국어가 빈값이면 en/zh 번역 텍스트가 존재해도 en/zh 임베딩 Play 버튼이 비활성화된다.

**원인**: en/zh(`hasTranslation: true`)의 `translationDone`이 `!isKoEmpty && (...)`로 계산되어, 한국어가 비면 false가 된다. 이 false가 임베딩 Play 버튼까지 전파된다.

**재현**: Playwright으로 카테고리 모달 열기 → 한국어 input 비우기 → blur → 영어 임베딩 "임베딩 실행" 버튼이 disabled됨 (영어 텍스트 `Furniture/Interior...`가 존재함에도)

## 해결

`translationDone`을 두 개의 독립 플래그로 분리한다.

### 변경 전

```typescript
const translationDone = lang.hasTranslation
  ? (!isKoEmpty && (detail.translation_text !== null || completedSteps.has(transKey) || stepResults.has(transKey)))
  : true;
```

### 변경 후

```typescript
const hasTranslationText = detail.translation_text !== null || completedSteps.has(transKey) || stepResults.has(transKey);
// 번역 Play 버튼: 한국어 원본이 있어야 번역 가능
const translationDone = lang.hasTranslation
  ? (!isKoEmpty && hasTranslationText)
  : true;
// 임베딩 Play 버튼: 각 언어의 텍스트만 필요 (한국어 여부 불필요)
const embeddingReady = lang.hasTranslation
  ? hasTranslationText
  : !isKoEmpty;
```

### 전달 변경

- 번역 row: 기존대로 `translationDone` 전달 (변화 없음)
- **en/zh 임베딩 row**: `translationDone` → `embeddingReady`
- **ko 임베딩 row**: `true` → `embeddingReady` (ko 버전은 `!isKoEmpty`)

## 영향받는 파일

- `nextjs/components/admin/category-modal.tsx`만 수정 (코드 내 단일 변경)

## 검증

### Playwright 수동 확인 시나리오

| 상태 | ko 임베딩 Play | en 임베딩 Play | zh 임베딩 Play |
|------|:-:|:-:|:-:|
| ko=값있음, en=값있음, zh=값있음 | 활성화 | 활성화 | 활성화 |
| ko="", en=값있음, zh=값있음 | 비활성화 | 활성화 | 활성화 |
| ko=값있음, en="", zh="" | 활성화 | 비활성화 | 비활성화 |

### Vitest 테스트

`nextjs/components/admin/__tests__/category-modal.test.tsx`에 Play 버튼 disabled 조건을 검증하는 테스트 케이스가 존재하는지 확인. 없으면 단위 테스트로 `embeddingReady` 계산 로직을 검증하거나, Render + Play 버튼 상태 스냅샷 테스트를 추가한다.
