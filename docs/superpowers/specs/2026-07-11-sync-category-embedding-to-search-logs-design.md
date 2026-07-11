# 카테고리 임베딩의 검색 로그 동기화 설계 명세서 (Design Spec)

- **작성일:** 2026-07-11
- **주제:** 카테고리 임베딩(`category_embeddings`) 생성 시 검색 로그(`search_logs`)에 임베딩 자동 동기화

---

## 1. 요구사항 정의 (PRD)

### 1.1. 배경
* 카테고리 관리자나 벌크 업로드를 통해 등록된 카테고리에 대한 임베딩(`category_embeddings`)이 만들어진 경우, 나중에 동일한 텍스트로 사용자가 유사도 검색을 시도할 때 이미 생성된 벡터가 있음에도 외부 임베딩 API(Ollama/OpenAI)를 중복으로 다시 호출하여 임베딩을 생성해야 하는 비용 낭비가 존재함.
* `search_logs`는 검색어 캐싱용 임베딩으로 사용되고 있으므로, 카테고리 명의 임베딩이 생성될 때 이를 `search_logs`에도 똑같이 미리 저장해 두면 검색어 입력 시 캐시 히트(Cache Hit)율을 비약적으로 증가시키고 응답 속도를 개선할 수 있음.

### 1.2. 주요 기능
* 단일 카테고리 임베딩 처리(상세 모달) 또는 다중 배치 임베딩 처리 시, 임베딩 벡터가 저장되는 동일한 트랜잭션/흐름에서 `search_logs` 테이블에 정규화된 텍스트와 함께 해당 벡터 데이터를 캐싱(저장)함.
* 동일 키워드에 대해 중복 레코드가 발생하지 않도록 정규화된 키워드와 모델명을 기준으로 `updateOrCreate` 처리함.

---

## 2. 세부 설계 및 데이터 흐름 (ADR)

### 2.1. 데이터 흐름

```
[UI: 작업 실행 / 상세 모달]
         │
         ▼
[CategoryController::runStep()]
         │
         ▼
[CategoryProcessingService::runStep()]
         │
         ├───► EmbeddingGenerator::generate()
         │            │
         │            ▼ (OpenAI/Ollama 호출)
         │         [Vector] (1024차원)
         │
         ├───► CategoryEmbedding::updateOrCreate()
         │            │
         │            ▼ (저장: category_embeddings 테이블)
         │
         └───► SearchNormalizer::normalize(텍스트)
                      │
                      ▼
               SearchLog::updateOrCreate()
                      │
                      ▼ (저장: search_logs 테이블)
```

### 2.2. 변경 대상 클래스 및 파일

#### [CategoryProcessingService.php](file:///var/app/www/cl_embed/laravel/app/Services/CategoryProcessingService.php)
* **의존성 주입:** `SearchNormalizer` 클래스를 추가로 의존성 주입받거나, `app(SearchNormalizer::class)`을 통해 획득.
* **로직 변경:**
  ```php
  // embedding.ko, embedding.en, embedding.zh 처리 영역
  $vector = $embedder->generate($textForEmbedding);

  // 1) category_embeddings 저장
  CategoryEmbedding::updateOrCreate([...], ['embedding' => $vector]);

  // 2) search_logs 캐싱 저장 (신규 추가)
  $normalizer = app(SearchNormalizer::class);
  $normalized = $normalizer->normalize($textForEmbedding);
  
  \App\Models\SearchLog::updateOrCreate(
      [
          'normalized_keyword' => $normalized,
          'embed_model_name' => $embedModelName,
      ],
      [
          'user_id' => auth('sanctum')->id() ?? $category->user_id,
          'search_keyword' => $textForEmbedding,
          'embedding' => $vector,
      ]
  );
  ```

---

## 3. 테스트 및 검증 계획

### 3.1. 자동화된 기능 테스트
* **[RunStepApiTest.php](file:///var/app/www/cl_embed/laravel/tests/Feature/RunStepApiTest.php)**
  * `POST /api/categories/{category}/run-step — embedding.ko가 정상 동작한다` 테스트 케이스에서 임베딩 생성 시 `search_logs`에 정상적으로 데이터가 삽입/업데이트되는지 `assertDatabaseHas` 코드를 추가하여 검증.

### 3.2. 수동 E2E 플레이라이트 검증
* Next.js 프론트엔드의 임베딩 액션을 구동하여 정상적으로 동작하는지 확인하고 에러 발생 여부 검토.
