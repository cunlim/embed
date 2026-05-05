# 테스트 가이드

## 테스트 프레임워크

### Pest PHP (주 테스트 프레임워크)
- **버전**: v4
- **설정**: `phpunit.xml`에서 Pest 설정
- **테스트 디렉토리**: `tests/Unit`, `tests/Feature`

### PHPUnit
- **버전**: v12
- **Pest와 호환**: Pest는 PHPUnit 기반

## 테스트 실행

모든 테스트 명령어는 Docker 컨테이너 `cl_embed_laravel`에서 실행됩니다.

### 전체 테스트
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test
```

### 컴팩트 모드 (출력 간소화)
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --compact
```

### 특정 테스트 필터링
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --compact --filter=testName
```

### 유닛 테스트만 실행
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --testsuite=Unit
```

### 피처 테스트만 실행
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --testsuite=Feature
```

## 테스트 작성

### 새 테스트 생성
```bash
# 피처 테스트
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan make:test --pest UserTest

# 유닛 테스트
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan make:test --pest --unit UserServiceTest
```

### Pest 테스트 구조
```php
<?php

use App\Models\User;

test('사용자 생성 테스트', function () {
    $user = User::factory()->create();

    expect($user->name)->toBeString();
    expect($user->email)->toBeString();
});

it('사용자 이메일 유효성 검사', function () {
    $user = User::factory()->create(['email' => 'test@example.com']);

    expect($user->email)->toBe('test@example.com');
});
```

### 데이터베이스 테스트
```php
<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('데이터베이스 마이그레이션 테스트', function () {
    // RefreshDatabase가 각 테스트 후 DB 리셋
    expect(User::count())->toBe(0);

    User::factory()->count(5)->create();
    expect(User::count())->toBe(5);
});
```

### 팩토리 사용
```php
<?php

test('팩토리 사용 테스트', function () {
    // 기본 팩토리
    $user = User::factory()->create();

    // 커스텀 상태
    $admin = User::factory()->admin()->create();

    // 여러 개 생성
    $users = User::factory()->count(10)->create();
});
```

### 모킹
```php
<?php

use App\Services\PaymentService;

test('결제 서비스 모킹', function () {
    $mock = mock(PaymentService::class);

    $mock->shouldReceive('process')
         ->once()
         ->andReturn(true);

    // 테스트 코드...
});
```

## 테스트 환경 설정

### 테스트 데이터베이스
- **종류**: SQLite 메모리 DB
- **설정**: `phpunit.xml`의 `<php>` 섹션
```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

### 테스트 환경 변수
```xml
<env name="APP_ENV" value="testing"/>
<env name="CACHE_STORE" value="array"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="SESSION_DRIVER" value="array"/>
```

## 테스트 팁

### 테스트 실행 속도 향상
1. `--compact` 플래그 사용
2. 특정 테스트만 필터링
3. 테스트 캐시 활용

### 테스트 커버리지
- 유닛 테스트: 핵심 로직
- 피처 테스트: 사용자 시나리오
- 엣지 케이스: 예외 상황

### 테스트 작성 원칙
1. 테스트는 명확하고 이해하기 쉽게
2. 하나의 테스트는 하나의 개념만 테스트
3. 테스트 데이터는 팩토리 사용
4. 테스트 후 데이터 정리 (RefreshDatabase)
