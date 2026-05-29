# Conventions

## 문서화 언어

- 모든 문서와 주석은 **한국어**로 작성
- 코드 식별자(변수명, 함수명, 클래스명)는 **영어** 유지

## 언어 순서

- UI·API에서 언어 순서는 **ko → en → zh** (한영중) 통일

## Laravel 컨벤션

- **PHP 8 속성(Attribute)** 사용: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`, `#[Hidden([...])]`
- **API 리소스**: `Resource::collection()` → `{data: [...]}`, 단일 → `{data: {...}}`
- **Resource collection 항목은 객체** — 연관 배열 전달 시 에러 발생
- **PHP 변경 전** `vendor/bin/pint --format agent` 실행 필수
- **OA 어노테이션**: `OA\JsonContent`에 `type: 'object'` 명시 필수
- **서비스 클래스**: 의존성 mock하여 위임 동작 검증하는 테스트 필수
- **캐싱**: 그룹 전체를 하나의 캐시 키로 묶어 저장 (개별 `Cache::remember()` 금지)
- **PostgreSQL 트랜잭션 abort**: `create()` + catch 대신 `firstOrCreate()` 사용
- **pgvector raw SQL**: `::vector` 명시적 캐스트 필수 (PDO는 text로 바인딩)
- **pgvector 테스트**: `array_fill` 금지 (collinear 벡터), 서로 다른 방향 사용

## Next.js 컨벤션

자세한 내용은 `nextjs/AGENTS.md` 참조. 핵심 요약:
- **App Router만 사용**, **기본값: Server Components**
- **ESLint**: `set-state-in-effect`(effect 내 setState 금지), `refs`(render 중 `.current` 금지), `useSearchParams`는 `<Suspense>` 경계 필수
- **shadcn Select**: `<select>`가 아님, `role="combobox"` 기반
- **`CardTitle`**: `<div>`임, `role="heading"` 없음

## TDD 적용 범위

| 대상 | 테스트 유형 |
|------|------------|
| Controller | Feature (HTTP 응답, mock, DB 단언) |
| Form Request | Feature (유효성 검증, 실패 시나리오) |
| Eloquent Resource | Feature (응답 형식 검증) |
| Model | Unit (Factory, 관계, 캐스팅) |
| Service | Unit/Feature (의존성 mock + 위임 검증) |
| Command/Scheduled Task | Feature (실행 결과 검증) |
| 프론트엔드 훅/유틸 | Vitest + RTL |
