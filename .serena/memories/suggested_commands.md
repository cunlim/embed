# 자주 사용하는 명령어

모든 명령어는 Docker 컨테이너 `php_01`에서 실행됩니다.

## Laravel Artisan 명령어

### 마이그레이션
```bash
# 마이그레이션 실행
docker exec -w /var/www/cl_embed/laravel php_01 php artisan migrate

# 마이그레이션 롤백
docker exec -w /var/www/cl_embed/laravel php_01 php artisan migrate:rollback

# 마이그레이션 상태 확인
docker exec -w /var/www/cl_embed/laravel php_01 php artisan migrate:status

# 마이그레이션 초기화 (모든 테이블 삭제 후 다시 생성)
docker exec -w /var/www/cl_embed/laravel php_01 php artisan migrate:fresh

# 시드 데이터 실행
docker exec -w /var/www/cl_embed/laravel php_01 php artisan db:seed
```

### 코드 생성
```bash
# 컨트롤러 생성
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:controller Api/PostController

# 모델 생성 (팩토리, 마이그레이션, 시더 포함)
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:model Post -mfs

# 마이그레이션만 생성
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:migration create_posts_table

# 리소스 클래스 생성
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:resource PostResource

# Request 클래스 생성
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:request StorePostRequest

# 테스트 생성
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:test --pest PostTest
docker exec -w /var/www/cl_embed/laravel php_01 php artisan make:test --pest --unit PostServiceTest
```

### 라우트
```bash
# 라우트 목록 확인
docker exec -w /var/www/cl_embed/laravel php_01 php artisan route:list

# 라우트 캐시 삭제
docker exec -w /var/www/cl_embed/laravel php_01 php artisan route:clear
```

### 설정
```bash
# 설정 캐시 삭제
docker exec -w /var/www/cl_embed/laravel php_01 php artisan config:clear

# 캐시 삭제 (모든 캐시)
docker exec -w /var/www/cl_embed/laravel php_01 php artisan cache:clear

# 뷰 캐시 삭제
docker exec -w /var/www/cl_embed/laravel php_01 php artisan view:clear
```

### 환경
```bash
# 환경 정보 확인
docker exec -w /var/www/cl_embed/laravel php_01 php artisan about

# 환경 변수 목록
docker exec -w /var/www/cl_embed/laravel php_01 php artisan env
```

### 테스트
```bash
# 전체 테스트
docker exec -w /var/www/cl_embed/laravel php_01 php artisan test

# 컴팩트 모드
docker exec -w /var/www/cl_embed/laravel php_01 php artisan test --compact

# 특정 테스트
docker exec -w /var/www/cl_embed/laravel php_01 php artisan test --compact --filter=PostTest
```

### 코드 포맷팅
```bash
# Pint로 코드 포맷팅
docker exec -w /var/www/cl_embed/laravel php_01 php artisan pint --dirty --format
```

### 빌드/서브스크라이버
```bash
# 빌드 목록 확인
docker exec -w /var/www/cl_embed/laravel php_01 php artisan vendor:publish --provider="App\\Providers\\AppServiceProvider"

# 에셋 빌드 (Next.js)
docker exec -w /var/www/cl_embed/nextjs node_01 npm run build
```

## Docker 명령어

```bash
# PHP 컨테이너 접속 (대화형 쉘)
docker exec -it php_01 bash

# PHP 컨테이너에서 특정 명령어 실행
docker exec -w /var/www/cl_embed/laravel php_01 php artisan ...

# 로그 확인
docker logs -f php_01

# 컨테이너 재시작
docker restart php_01
```

## Next.js 명령어

```bash
# 개발 서버 실행
docker exec -w /var/app/www/cl_embed/nextjs node_01 npm run dev

# 프로덕션 빌드
docker exec -w /var/app/www/cl_embed/nextjs node_01 npm run build

# ESLint 실행
docker exec -w /var/app/www/cl_embed/nextjs node_01 npx next lint
```
