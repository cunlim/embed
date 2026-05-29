# Conventions

> 상세 내용은 `AGENTS.md` 참조. 여기서는 핵심 invariant만 기록.

## Laravel 컨벤션

- PHP 변경 전 `vendor/bin/pint --format agent` 실행 필수
- `Resource::collection()` → `{data: [...]}`, 단일 → `{data: {...}}`
- 캐싱: 그룹 전체를 하나의 캐시 키로 묶어 저장 (개별 `Cache::remember()` 금지)
- pgvector: `::vector` 명시적 캐스트 필수, `array_fill` 금지

## Next.js 컨벤션

> 상세 내용은 `nextjs/AGENTS.md` 참조.

- ESLint `react-hooks/refs`: render 중 `.current` 접근 금지. 모달 open 초기화는 `eslint-disable-next-line` 필요
