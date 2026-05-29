# Suggested Commands

> 모든 명령어는 Docker 컨테이너 대상. 상세는 `laravel/AGENTS.md`, `nextjs/AGENTS.md` 참조.

## Laravel (cl_embed_laravel)

```bash
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel vendor/bin/pint --format agent
docker exec cl_embed_laravel php artisan config:clear  # 테스트 전 필수
```

## Next.js (cl_embed_nextjs)

```bash
docker exec cl_embed_nextjs npm test
docker exec cl_embed_nextjs npm run lint
docker exec cl_embed_nextjs npx tsc --noEmit
```

## Docker

```bash
docker compose -f docker/docker-compose.yml stop
docker compose -f docker/docker-compose.yml up -d
```

## Playwright 인증

> 상세 절차는 `laravel/AGENTS.md` 참조.
