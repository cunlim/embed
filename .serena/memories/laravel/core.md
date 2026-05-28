# Laravel Core — 백엔드 모듈

## 디렉토리 구조

```
laravel/
├── app/
│   ├── Models/          — Eloquent 모델
│   ├── Services/        — 비즈니스 로직
│   ├── Http/            — Controllers, Requests, Resources
│   ├── Repositories/    — 데이터 액세스 계층
│   └── Providers/       — 서비스 프로바이더
├── config/
├── database/
├── routes/
├── tests/
└── resources/
```

## 주요 패턴

- **동기 HTTP 처리**: 번역/임베딩은 비동기 Job이 아닌 동기 HTTP 컨트롤러에서 step 단위 처리
- **`PUT /api/categories/{id}/update-text`**: 텍스트 업데이트 후 해당 언어의 CategoryEmbedding 삭제
- **`category_code`**: optional unique, `filled()`로 체크 (`??`는 빈 문자열 통과)
- **API 인증**: 세션 미들웨어 없음, `$request->user('sanctum')` 사용
- **OAuth**: 라우트는 `routes/web.php`, callback은 `RedirectResponse`, provider_token DB 저장 금지

## 테스트 환경

- 실제 PostgreSQL (`cl_embed_test`, `pgvector_03` 컨테이너)
- `RefreshDatabase` 자동 적용 (Pest.php)
- `.env.testing` — gitignore, `DB_DATABASE=cl_embed_test`
- 별도 테스트 DB 사용자: `dbeaver_lim_test`

## 알려진 이슈

- **`bootstrap/cache/config.php` 오염**: `php artisan test` 전 `php artisan config:clear` 필수
- **Swagger 문서 stale**: 배포 후 `l5-swagger:generate`로 재생성
- **`deploy.yml` `migrate:rollback --step=1` 위험**: batch 1에서 전체 rollback 유발
