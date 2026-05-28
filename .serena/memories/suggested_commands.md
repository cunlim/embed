# Suggested Commands

모든 명령어는 Docker 컨테이너 대상으로 `docker exec`를 통해 실행한다.

## Laravel (cl_embed_laravel)

```bash
# 테스트
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# 코드 포맷팅
docker exec cl_embed_laravel vendor/bin/pint --format agent

# Swagger 문서 생성
docker exec cl_embed_laravel php artisan l5-swagger:generate

# 마이그레이션
docker exec cl_embed_laravel php artisan migrate

# 설정 캐시 클리어 (테스트 전 필수)
docker exec cl_embed_laravel php artisan config:clear
```

## Next.js (cl_embed_nextjs)

```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 빌드
docker exec cl_embed_nextjs npm run build

# 린트
docker exec cl_embed_nextjs npm run lint

# 테스트
docker exec cl_embed_nextjs npm test

# 타입 체크
docker exec cl_embed_nextjs npx tsc --noEmit

# shadcn 컴포넌트 추가
docker exec cl_embed_nextjs npx shadcn@latest add <component>
```

## Docker

```bash
# 컨테이너 시작/중지
docker compose -f docker/docker-compose.yml stop
docker compose -f docker/docker-compose.yml up -d

# 컨테이너 재시작 후 HMR 복구
docker compose -f docker/docker-compose.yml stop
docker compose -f docker/docker-compose.yml up -d
# 그 다음 브라우저에서 Ctrl+Shift+R 또는 browser.newContext()
```

## Playwright 인증

```bash
# superadmin 사용자 확인
docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::where("role","superadmin")->first()?->id ?? "없음";'

# superadmin 토큰 발급
docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::find(<ID>)->createToken("debug")->plainTextToken;'

# Playwright에서 쿠키 설정 (페이지 이동 전)
page.evaluate(() => {
  const expires = new Date(Date.now() + 30 * 864e5).toUTCString();
  document.cookie = `auth_token=${encodeURIComponent('<TOKEN>')}; path=/; expires=${expires}; SameSite=Lax`;
});
```

## Git / 배포

```bash
# 릴리스 (develop → main 머지 후 푸시)
bash scripts/git_release.sh

# 코사인 유사도 계산
python scripts/cosine_similarity.py '[...]' '[...]'
```
