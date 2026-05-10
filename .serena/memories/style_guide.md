# 코드 스타일 및 컨벤션

## 문서화 언어
- 모든 문서와 주석은 한국어로 작성
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어 유지
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어

## Laravel (PHP 8.5)
- **PHP 8 속성(Attribute) 사용**: `$fillable`/`$hidden` 대신 `#[Fillable([...])]`와 `#[Hidden([...])]` 사용
- **생성자 프로퍼티 프로모션**: `public function __construct(public Type $var) {}`
- **타입 힌트**: 모든 메서드에 명시적 반환 타입과 파라미터 타입 선언
- **제어 구조**: 단일 라인이라도 항상 중괄호 사용
- **URL 생성**: `route()` 헬퍼 함수와 명명된 라우트 사용
- **API 리소스**: 버저닝과 함께 Eloquent API Resources 사용
- **커밋 메시지**: conventional commits 형식 (feat:, fix:, docs:, refactor:)
- **Pint 포맷팅**: PHP 변경 완료 전 `vendor/bin/pint --format agent` 실행 (컨테이너 내부)
- **TDD 필수**: 새 기능 구현 시 테스트 먼저 작성

## Next.js 16 + React 19 + TypeScript
- Next.js 16은 브레이킹 체인지가 있으므로 `node_modules/next/dist/docs/` 참조 필수
- App Router 기본, 실시간 인터랙션 필요한 부분만 Client Component
- shadcn/ui 컴포넌트 사용
- Tailwind CSS v4 사용

## UI 디자인 가이드라인 (docs/UI_GUIDE.md 참조)
### AI 슬롭 안티패턴 금지
- backdrop-filter: blur() (글래스모피즘 금지)
- gradient-text (그라데이션 텍스트 금지)
- "Powered by AI" 배지
- box-shadow 글로우 애니메이션
- 보라/인디고 브랜드 색상
- 배경 gradient orb (blur-3xl 원형)
- 균일한 rounded-2xl

### 색상
- 페이지 배경: #0a0a0a
- 카드 배경: #141414
- border: neutral-800
- Primary 버튼: bg-white text-black hover:bg-neutral-200
- Text 버튼: text-neutral-500 hover:text-neutral-300

### 컴포넌트 스타일
- 카드: `rounded-lg bg-[#141414] border border-neutral-800 p-6`
- Primary 버튼: `rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors`
- 입력 필드: `rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-white`
- 전체 너비: `max-w-5xl`
- 좌측 정렬 기본 (중앙 정렬 금지)

### 애니메이션
- 허용: fade-in (0.4s), slide-up (0.5s)
- 그 외 글로우/바운스 효과 금지
- 아이콘: SVG 인라인, strokeWidth 1.5

## 데이터베이스
- PostgreSQL 15 + pgvector 확장
- VECTOR(1024) 타입 사용 (bge-m3:latest)
- 주요 테이블: categories, category_embeddings, translation_caches, search_logs, users
