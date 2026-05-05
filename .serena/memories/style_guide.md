# 코드 스타일 및 컨벤션

## PHP / Laravel

### 기본 규칙
- **PHP 버전**: 8.5
- **중괄호 사용**: 제어 구조에 항상 중괄호 사용 (한 줄이어도)
- **타입 선언**: 명시적 반환 타입과 파라미터 타입 힌트 사용

### 생성자 프로퍼티 프로모션
```php
// 사용
public function __construct(public GitHub $github) { }

// 비사용 (빈 생성자)
private function __construct() { }
```

### 열거형 (Enum)
- 키 이름: TitleCase 사용
```php
enum Status: string {
    case Active = 'active';
    case Inactive = 'inactive';
}
```

### PHPDoc
- 인라인 주석보다 PHPDoc 블록 우선 사용
- 복잡한 로직에만 인라인 주석 사용
- 배열 형태 정의: `@return array<string, int>`

### Laravel 컨벤션
- 새 파일 생성: `php artisan make:` 명령어 사용
- 모델 생성: 팩토리와 시더 함께 생성
- API: Eloquent API Resources 및 API 버전링 사용
- URL 생성: 이름 있는 라우트와 `route()` 함수 사용

## 코드 포맷팅 (Laravel Pint)
- PHP 파일 수정 후 반드시 포맷팅 실행:
```bash
docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan pint --dirty --format
```

## 테스트 (Pest PHP)
- 테스트 생성: `docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan make:test --pest {name}`
- 테스트 실행: `docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --compact`
- 테스트 필터링: `docker exec -w /var/www/cl_embed/laravel cl_embed_laravel php artisan test --compact --filter=testName`

## Next.js / TypeScript

### 기본 규칙
- **TypeScript**: 명시적 타입 사용
- **컴포넌트**: 함수형 컴포넌트 사용
- **네이밍**: PascalCase (컴포넌트), camelCase (함수/변수)

### Tailwind CSS
- 유틸리티 클래스 사용
- 반응형 디자인: `sm:`, `md:`, `lg:`, `xl:` 프리픽스
- 다크 모드: `dark:` 프리픽스

## 일반 규칙
- 기존 코드 컨벤션 준수
- 재사용 가능한 컴포넌트 확인 후 새 컴포넌트 생성
- 변수/메서드 이름: 설명적이고 명확하게
