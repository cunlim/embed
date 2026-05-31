# Core — 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. 벡터 검색(pgvector)으로 다국어 카테고리를 추천한다.

> 상세 내용은 `mem:tech_stack`, 루트 `AGENTS.md` 참조.

## 핵심 컨벤션

- 문서·주석은 한국어, 코드 식별자는 영어
- UI·API 언어 순서: ko → en → zh
- 작업 완료 전 `.claude/hooks/run-all-checks.sh` → 모든 EXIT=0 확인
- 이슈 수정 전 Playwright로 실제 재현 먼저 확인
- Sub-agent driven 개발 권장

## 카테고리 접근 제어

- `user_id=1`(공개), 비로그인: 본인+공개, 로그인: 본인+공개, admin: 전체
- 모든 조회 API(`levels()`, `recommend()` 등)에 동일 적용

## 핵심 비즈니스 로직

- 번역: Ollama `translategemma:4b`, 임베딩: Ollama `bge-m3:latest` (1024차원)
- 동시성: Redis `Cache::lock("category-translate:{categoryId}")`
- 캐싱: 그룹 전체 하나의 캐시 키 (개별 `Cache::remember()` 금지)
- 번역/임베딩은 동기 HTTP 컨트롤러에서 step 단위 처리

## 주요 주의사항

- SSR 조건부 렌더링: `getToken()`은 서버에서 `null` → `serverHadToken` prop 사용
- Laravel `boolean` validation: `"true"`/`"false"` 불허 → `"1"`/`"0"` 사용
- 폴더 플레이스홀더: `__folder_placeholder__` → 모든 카테고리 쿼리에서 필터링
- Docker `docker exec`로 명령 실행, base64 방식으로 파일 전송
