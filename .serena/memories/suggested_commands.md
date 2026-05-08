# 주요 명령어

## Docker Compose (docker/ 디렉토리에서 실행)
```bash
# 모든 서비스 시작
docker compose up -d

# 단일 서비스 재시작
docker compose restart cl_embed_laravel
docker compose restart cl_embed_nextjs

# 로그 확인
docker compose logs -f cl_embed_laravel
docker compose logs -f cl_embed_nextjs
docker compose logs -f pgvector_03
docker compose logs -f redis_04
```

## Laravel (docker exec 로 실행)
```bash
# 테스트 실행
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_laravel php artisan test --compact --filter=testName

# PHP 코드 포맷팅 (Pint)
docker exec cl_embed_laravel vendor/bin/pint --format agent

# 파일 생성
docker exec cl_embed_laravel php artisan make:model ModelName --migration --factory --seed --test
docker exec cl_embed_laravel php artisan make:test --pest TestName
docker exec cl_embed_laravel php artisan make:controller Api/ControllerName
docker exec cl_embed_laravel php artisan make:class ClassName

# 라우트 확인
docker exec cl_embed_laravel php artisan route:list

# 설정 확인
docker exec cl_embed_laravel php artisan config:show app.name
docker exec cl_embed_laravel php artisan config:show database.default

# 데몬 실행 (컨테이너 내부)
php artisan serve --host=0.0.0.0 --port=8000
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan queue:work

# 데몬 일괄 실행 (호스트에서)
docker exec -d cl_embed_laravel bash -c "
  nohup php artisan serve --host=0.0.0.0 --port=8000 > logs/serve.log 2>&1 &
  nohup php artisan reverb:start --host=0.0.0.0 --port=8080 > logs/reverb.log 2>&1 &
  nohup php artisan queue:work > logs/queue.log 2>&1 &
"

# Laravel MCP 도구 (Laravel Boost)
# database-query, database-schema, search-docs 도구 사용
```

## Next.js (docker exec 로 실행)
```bash
# 개발 서버
docker exec cl_embed_nextjs npm run dev

# 프로덕션 빌드
docker exec cl_embed_nextjs npm run build

# ESLint
docker exec cl_embed_nextjs npm run lint
```

## Git
```bash
# 브랜치 전략
git checkout -b feature/feature-name  # develop에서 분기

# develop → main 릴리스 (스크립트 사용)
./scripts/git_release.sh

# 커밋 메시지 형식
git commit -m "feat: 새로운 기능 추가"
git commit -m "fix: 버그 수정"
git commit -m "docs: 문서 업데이트"
git commit -m "refactor: 코드 리팩토링"
```

## CI/CD
- main 브랜치 푸시 시 GitHub Actions가 자동 배포 실행
- 셀프호스티드 WSL GitHub Actions 러너 사용
- SonarQube (키: cl_embed) 외부 분석
