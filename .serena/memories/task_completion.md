# Task Completion — 작업 완료 검증

작업 완료 전 반드시 아래 순서로 검증한다.

## 1. 전체 검증 스크립트 실행

```bash
.claude/hooks/run-all-checks.sh
```

## 2. 결과 확인

```bash
cat .claude/hooks/test-results/*.txt
```

모든 파일에서 `EXIT=0` 확인:
- `tsc` — TypeScript 타입 체크
- `lint` — ESLint
- `test` — Vitest (프론트엔드) + Pest (백엔드)
- `pint` — PHP 코드 포맷팅

## 3. 개별 검증 (필요 시)

```bash
# 프론트엔드 타입 체크
docker exec cl_embed_nextjs npx tsc --noEmit

# 프론트엔드 린트
docker exec cl_embed_nextjs npm run lint

# 프론트엔드 테스트
docker exec cl_embed_nextjs npm test

# 백엔드 테스트
docker exec cl_embed_laravel php artisan test --compact

# 백엔드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 백엔드 Swagger 문서 생성
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

## 4. UI 변경 시

- Playwright로 실제 동작 확인
- `https://embed.cunlim.dev`에서 테스트 (WSL2 호스트)

## 5. 컨테이너 파일 동기화 확인

```bash
# 바인드 마운트 불일치 시
wc -l <host-file> <container-file>
```
