# 카테고리 임베딩의 검색 로그 동기화 구현 계획서 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리 임베딩(`category_embeddings`)이 생성될 때 동일한 임베딩 데이터를 검색 로그(`search_logs`) 테이블에도 캐싱 형태로 동기화 저장하여 유사도 검색 시 캐시 히트율을 극대화합니다.

**Architecture:** `CategoryProcessingService::runStep()` 내에서 임베딩 벡터가 정상적으로 생성 및 저장된 직후, `SearchNormalizer`로 카테고리 명을 정규화하여 중복 방지를 위해 `SearchLog::updateOrCreate()`를 호출합니다.

**Tech Stack:** PHP 8.2+, Laravel 11+, Pest PHP (Testing)

## Global Constraints
- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- 모든 UI·API에서 언어 순서는 `ko → en → zh` (한영중)로 통일합니다.

---

### Task 1: Pest 테스트 코드에 검증 로직 추가 (TDD 준비)

**Files:**
- Modify: `/var/app/www/cl_embed/laravel/tests/Feature/RunStepApiTest.php`

**Interfaces:**
- Consumes: 기존 `RunStepApiTest` 기능 테스트 케이스
- Produces: `embedding.ko` 실행 시 `search_logs` 테이블 적재 여부를 검증하는 추가 단언(Assertion)

- [ ] **Step 1: RunStepApiTest.php 수정**
  `/var/app/www/cl_embed/laravel/tests/Feature/RunStepApiTest.php` 파일의 `embedding.ko가 정상 동작한다` 테스트 케이스(라인 62-93) 하단에 `search_logs` 테이블의 생성을 검증하는 `assertDatabaseHas` 코드를 추가합니다.

  ```diff
   test('POST /api/categories/{category}/run-step — embedding.ko가 정상 동작한다', function () {
       $embedder = mock(EmbeddingGenerator::class);
       $embedder->shouldReceive('generate')
           ->once()
           ->with('테스트 카테고리')
           ->andReturn(array_fill(0, 1024, 0.01));
       app()->instance(EmbeddingGenerator::class, $embedder);
  
       $user = User::factory()->create();
       $category = Category::factory()->create(['category_name_ko' => '테스트 카테고리', 'user_id' => $user->id]);
  
       $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
           'step' => 'embedding.ko',
       ]);
  
       $response->assertOk()
           ->assertJson([
               'step' => 'embedding.ko',
               'status' => 'completed',
           ]);
       $response->assertJsonStructure([
           'translations' => [
               'id', 'category_code', 'languages',
           ],
       ]);
  
       // DB에 저장되었는지 확인
       $this->assertDatabaseHas('category_embeddings', [
           'category_id' => $category->id,
           'language' => 'ko',
       ]);
  +
  +    // search_logs 테이블에도 저장되었는지 확인
  +    $this->assertDatabaseHas('search_logs', [
  +        'search_keyword' => '테스트 카테고리',
  +        'normalized_keyword' => '테스트 카테고리',
  +        'embed_model_name' => config('services.embed.model', 'bge-m3:latest'),
  +    ]);
   });
  ```

- [ ] **Step 2: 테스트를 실행하여 실패 여부 확인**
  구현을 아직 하지 않았으므로 테스트가 실패하는 것을 확인해야 합니다.
  
  Run: `cd /var/app/www/cl_embed/laravel && ./vendor/bin/pest tests/Feature/RunStepApiTest.php`
  Expected: **FAIL** (search_logs 테이블에 해당 행이 없어서 실패 발생)

- [ ] **Step 3: 중간 커밋**
  실패하는 테스트 코드를 포함하여 커밋합니다.
  
  Run:
  ```bash
  git add laravel/tests/Feature/RunStepApiTest.php
  git commit -m "test: 카테고리 임베딩 시 search_logs 생성 여부 검증 테스트 추가"
  ```

---

### Task 2: 카테고리 임베딩과 search_logs 테이블 동기화 비즈니스 로직 구현

**Files:**
- Modify: `/var/app/www/cl_embed/laravel/app/Services/CategoryProcessingService.php`

**Interfaces:**
- Consumes: `EmbeddingGenerator`에 의해 생성된 임베딩 벡터 `$vector` 및 원본 텍스트 `$textForEmbedding`
- Produces: `search_logs` 테이블의 캐시 데이터 동적 생성/업데이트

- [ ] **Step 1: CategoryProcessingService.php 수정**
  `/var/app/www/cl_embed/laravel/app/Services/CategoryProcessingService.php` 파일의 `runStep()` 메소드에서 임베딩 처리 완료 직후 `SearchNormalizer`로 카테고리 명을 정규화하여 `SearchLog::updateOrCreate` 로직을 추가합니다.

  ```diff
              $vector = $embedder->generate($textForEmbedding);
  
              CategoryEmbedding::updateOrCreate(
                  [
                      'category_id' => $category->id,
                      'language' => $lang,
                      'embed_model_name' => $embedModelName,
                  ],
                  ['embedding' => $vector]
              );
  +
  +           // 임베딩 데이터를 search_logs 캐시 테이블에도 동기화 저장
  +           $normalizer = app(\App\Services\SearchNormalizer::class);
  +           $normalized = $normalizer->normalize($textForEmbedding);
  +
  +           \App\Models\SearchLog::updateOrCreate(
  +               [
  +                   'normalized_keyword' => $normalized,
  +                   'embed_model_name' => $embedModelName,
  +               ],
  +               [
  +                   'user_id' => auth('sanctum')->id() ?? $category->user_id,
  +                   'search_keyword' => $textForEmbedding,
  +                   'embedding' => $vector,
  +               ]
  +           );
  ```

- [ ] **Step 2: 테스트를 재실행하여 통과 여부 확인**
  
  Run: `cd /var/app/www/cl_embed/laravel && ./vendor/bin/pest tests/Feature/RunStepApiTest.php`
  Expected: **PASS**

- [ ] **Step 3: 전체 프로젝트 유효성 검사 도구 실행**
  저장소 루트에서 모든 체크 스크립트를 호출해 부작용이 없는지 유효성을 검증합니다.
  
  Run: `cd /var/app/www/cl_embed && .claude/hooks/run-all-checks.sh --terminal`
  Expected: **EXIT 0 (All checks passed)**

- [ ] **Step 4: 최종 구현 커밋**
  
  Run:
  ```bash
  git add laravel/app/Services/CategoryProcessingService.php
  git commit -m "feat: 카테고리 임베딩 시 search_logs 캐시 동시 동기화 로직 구현"
  ```
