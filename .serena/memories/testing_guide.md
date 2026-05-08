# 테스트 가이드

## TDD (필수)
- 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것
- CLAUDE.md에 CRITICAL로 지정된 프로세스

## 테스트 프레임워크
- **Laravel**: Pest 4 (pestphp/pest)
- 테스트 생성: `php artisan make:test --pest TestName` (Feature)
- 유닛 테스트: `php artisan make:test --pest --unit TestName`

## 테스트 실행
```bash
# 모든 테스트 실행
docker exec cl_embed_laravel php artisan test --compact

# 특정 테스트만 필터
docker exec cl_embed_laravel php artisan test --compact --filter=testName
```

## 테스트 범위 (Phase 1 우선순위)
- 백엔드 핵심 파이프라인: 분할/조립, 예외 처리, Chaining, Lock, Rate Limit 방어
- 데이터베이스: 마이그레이션, 모델, 팩토리, 시더 관련 테스트
- 모델 생성 시 팩토리와 시더 함께 생성할 것

## 주요 패키지 버전
- pestphp/pest (PEST) - v4
- phpunit/phpunit (PHPUNIT) - v12

## 추가 규칙
- 승인 없이 테스트를 삭제하지 말 것
- 모델 생성 시 팩토리의 커스텀 states 사용 가능 여부 확인
- Faker: `$this->faker->word()` 또는 `fake()->randomDigit()` 사용
