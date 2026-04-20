# 개발 명령어

## Laravel 백엔드

### 개발 서버 실행
```bash
# Laravel 개발 서버 + 큐 + 로그 + Vite
composer run dev

# 또는 개별 실행
php artisan serve
php artisan queue:listen --tries=1 --timeout=0
php artisan pail --timeout=0
npm run dev
```

### 테스트 실행
```bash
# 전체 테스트
php artisan test

# 컴팩트 모드
php artisan test --compact

# 특정 테스트 필터링
php artisan test --compact --filter=testName

# Pest 전용
php artisan make:test --pest TestName
```

### 코드 포맷팅
```bash
# PHP 파일 포맷팅
vendor/bin/pint --dirty --format agent

# 포맷팅 테스트 (수정 없음)
vendor/bin/pint --test --format agent
```

### 데이터베이스
```bash
# 마이그레이션 실행
php artisan migrate

# 마이그레이션 롤백
php artisan migrate:rollback

# 마이그레이션 리프레시
php artisan migrate:fresh

# 시더 실행
php artisan db:seed
```

### 라우트 확인
```bash
# 전체 라우트 목록
php artisan route:list

# 특정 메서드 필터링
php artisan route:list --method=GET

# 특정 경로 필터링
php artisan route:list --path=api
```

### 설정 확인
```bash
# 설정 값 확인
php artisan config:show app.name
php artisan config:show database.default

# 환경 변수 확인
# .env 파일 직접 읽기
```

### 기타 아티즌 명령어
```bash
# 사용 가능한 명령어 목록
php artisan list

# 명령어 도움말
php artisan [command] --help

# 틴커 실행
php artisan tinker --execute 'User::count();'
```

## Next.js 프론트엔드

### 개발 서버 실행
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

### 프로덕션 서버 실행
```bash
npm start
```

### 코드 검사
```bash
npm run lint
```

## Docker

### 컨테이너 실행
```bash
# docker-compose.yml이 있는 디렉토리에서
docker-compose up -d

# 특정 서비스 실행
docker-compose up nextjs_01 -d

# 로그 확인
docker-compose logs -f nextjs_01
```

## Git

### 기본 명령어
```bash
# 상태 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "메시지"

# 푸시
git push

# 풀
git pull

# 브랜치 생성
git checkout -b 브랜치명

# 브랜치 목록
git branch
```

## 시스템 명령어

### 파일 탐색
```bash
# 디렉토리 목록
ls -la

# 현재 경로
pwd

# 파일 찾기
find . -name "*.php"

# 내용 검색
grep -r "검색어" .
```

### 권한 관리
```bash
# 실행 권한 부여
chmod +x 파일명
```

## 개발 워크플로우

### 새 기능 추가
1. 테스트 작성 (TDD)
2. 코드 구현
3. 포맷팅 실행: `vendor/bin/pint --dirty --format agent`
4. 테스트 실행: `php artisan test --compact`
5. 커밋 및 푸시

### 버그 수정
1. 테스트로 문제 재현
2. 코드 수정
3. 테스트 실행
4. 포맷팅 실행
5. 커밋 및 푸시