---
title: SQLite 테스트 DB에서 pgvector 마이그레이션으로 인한 RefreshDatabase 실패
date: 2026-05-10
category: test-failures
module: laravel_testing
problem_type: test_failure
component: testing_framework
severity: medium
symptoms:
  - RefreshDatabase trait이 setUp 단계에서 마이그레이션 실행 중 실패한다
  - SQLite in-memory DB가 CREATE EXTENSION IF NOT EXISTS vector 구문을 거부한다
  - RefreshDatabase에 의존하는 모든 테스트가 assertion 도달 전에 크래시된다
root_cause: test_isolation
resolution_type: test_fix
tags: [sqlite, pgvector, refresh-database, testing, migration]
---

# SQLite 테스트 DB에서 pgvector 마이그레이션으로 인한 RefreshDatabase 실패

## Problem

이 프로젝트의 테스트 환경은 `phpunit.xml`에서 `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`로 설정되어 있다. 그러나 마이그레이션에 pgvector 확장(`CREATE EXTENSION IF NOT EXISTS vector`)과 `vector(1024)` 컬럼 타입이 포함되어 있어, `RefreshDatabase` trait을 사용하면 SQLite가 이 구문을 이해하지 못해 `setUp()` 단계에서 크래시된다.

## Symptoms

- `RefreshDatabase` trait을 사용하는 모든 테스트 파일이 `SQLSTATE[HY000]: General error: 1 near "EXTENSION": syntax error` 와 함께 실패한다
- `tests/Pest.php`에 `// ->use(RefreshDatabase::class)`로 주석 처리되어 있으나, 그 이유가 문서화되어 있지 않다

## What Didn't Work

- `RefreshDatabase` trait 그대로 사용 — 마이그레이션의 `CREATE EXTENSION IF NOT EXISTS vector`가 SQLite에서 구문 오류 발생
- `DatabaseMigrations` trait 사용 — 동일한 문제

## Solution

`RefreshDatabase` 대신 `beforeEach`에서 필요한 테이블만 `Schema::create()`로 수동 생성하고, `afterEach`에서 `Schema::dropIfExists()`로 정리한다.

```php
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    Schema::create('translation_caches', function (Blueprint $table) {
        $table->id();
        $table->text('source_text');
        $table->string('target_lang', 10);
        $table->text('translated_text');
        $table->unique(['source_text', 'target_lang']);
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('translation_caches');
});
```

### 규칙

1. **프로덕션 스키마와 일치시킨다** — 테스트가 의존하는 컬럼과 제약조건을 마이그레이션의 `up()` 메서드와 동일하게 재현한다
2. **코드가 의존하는 제약조건을 포함한다** — 예: `UniqueConstraintViolationException`을 catch하는 로직이 있다면 unique 인덱스를 반드시 포함
3. **`afterAll`이 아닌 `afterEach`에서 정리한다** — 각 테스트가 깨끗한 상태에서 시작하도록 보장
4. **테스트가 실제로 접근하는 테이블만 생성한다** — 불필요한 테이블은 만들지 않는다

여러 테이블이 필요한 경우:

```php
afterEach(function () {
    Schema::dropIfExists('categories');
    Schema::dropIfExists('translation_caches');
});
```

## Why This Works

SQLite in-memory DB는 pgvector 확장을 지원하지 않지만, 표준 SQL DDL(`CREATE TABLE`, 인덱스, 제약조건)은 완전히 지원한다. 마이그레이션을 전체 실행하지 않고 필요한 테이블만 수동 생성하면 SQLite의 빠른 인메모리 속도를 그대로 활용하면서 pgvector 의존성을 우회할 수 있다.

`RefreshDatabase`의 트랜잭션 롤백과 동일한 격리 수준을 `Schema::dropIfExists`로 달성한다. 다만 트랜잭션 기반이 아니므로, 동일 테이블을 사용하는 병렬 테스트 실행 시 주의가 필요하다.

## Prevention

- **새 테스트 파일 작성 시**: `RefreshDatabase` 대신 수동 `Schema::create()` 패턴을 기본값으로 사용한다. `TextSplitter`처럼 DB 접근이 전혀 없는 단위 테스트는 테이블 생성 자체가 불필요하다
- **새 마이그레이션 추가 시**: `phpunit.xml`의 `DB_CONNECTION=sqlite`를 인지하고, SQLite와 호환되지 않는 DDL이 포함된다면 테스트 전략을 미리 결정한다
- **`laravel/CLAUDE.md` Testing 섹션에 이 지식을 명시**하여 향후 모든 개발자가 이 제약을 인지하도록 한다

## Related

- `laravel/CLAUDE.md` — Testing 섹션, `phpunit.xml`의 DB_CONNECTION=sqlite 설정
- `docs/ADR.md` — ADR-001 (pgvector 채택 배경)
- `tests/Pest.php:18` — `// ->use(RefreshDatabase::class)` 주석 (이유 없이 비활성화되어 있음)
