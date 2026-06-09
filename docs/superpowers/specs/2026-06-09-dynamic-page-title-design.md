# 동적 페이지 타이틀 설계

## 배경

현재 `app/layout.tsx`에 고정된 `metadata.title: "CL Embed | AI 카테고리 추천 시스템"`이 모든 페이지에 적용되고 있다. 페이지별로 `|` 뒤 텍스트를 다르게 표시해야 한다.

## 목표

- 메인페이지(`/`): 기존 타이틀 유지
- 다른 페이지: `"CL Embed | <페이지별 부제목>"` 형식으로 `|` 뒤만 변경
- og:title도 동일하게 동기화

## 설계

### 방식: `title.template` + per-page metadata

Next.js App Router의 `Metadata.title.template` 기능을 사용한다.

### Root layout 변경

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: "CL Embed | %s",
    default: "CL Embed | AI 카테고리 추천 시스템",
  },
  // ... 나머지 동일
};
```

- `template`: 각 페이지의 title이 `%s`에 치환됨
- `default`: template이 적용되지 않는 fallback (메인페이지)

### 페이지별 부제목

| 라우트 | 부제목 | 파일 |
|--------|--------|------|
| `/` | _(default 사용)_ | `app/page.tsx` — 변경 없음 |
| `/embed` | 카테고리 관리 | `app/embed/page.tsx` |
| `/login` | 로그인 | `app/login/page.tsx` |
| `/mypage` | 마이페이지 | `app/mypage/page.tsx` |
| `/admin` | 시스템 설정 | `app/admin/page.tsx` |
| `/admin/member` | 회원 관리 | `app/admin/member/page.tsx` |
| `/docs` | API 문서 | `app/docs/page.tsx` |

각 page.tsx에 다음 추가:

```typescript
export const metadata: Metadata = {
  title: "부제목",
};
```

### 최종 결과 예시

- `/` → `<title>CL Embed | AI 카테고리 추천 시스템</title>`
- `/embed` → `<title>CL Embed | 카테고리 관리</title>`
- `/login` → `<title>CL Embed | 로그인</title>`

## 수정 대상 파일

1. `app/layout.tsx` — metadata.title 객체形式 변경
2. `app/embed/page.tsx` — metadata 추가
3. `app/login/page.tsx` — metadata 추가
4. `app/mypage/page.tsx` — metadata 추가
5. `app/admin/page.tsx` — metadata 추가
6. `app/admin/member/page.tsx` — metadata 추가
7. `app/docs/page.tsx` — metadata 추가

## 테스트

- 각 페이지 접속 시 `<title>` 태그 값 확인 (Playwright)
- 브라우저 탭 표시 title 시각적 확인
