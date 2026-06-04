# Architecture Decision Records

## 인프라

5개 Docker 컨테이너 (Next.js, Laravel, Swagger UI, PostgreSQL 15+pgvector, Redis).

- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel FPM, `/swagger/` → Swagger UI, `/app/` → Reverb WebSocket (현재 미사용, 인프라만 유지)
- **도메인**: `https://embed.cunlim.dev` (cloudflared tunnel)
- **동시성 제어**: Redis `Cache::lock("category-translate:{categoryId}")`로 동일 카테고리 중복 실행 방지

## 철학
MVP 속도를 최우선으로 하되, 벡터 검색(Embedding)을 통한 압도적인 검색 성능과 정확도를 제공한다. 외부 API 의존도를 최소화하여 비용을 절감하고, 독립적으로 작동하는 최소 구현을 선택한다. 백엔드(HTTP API, 데이터 파이프라인)와 프론트엔드의 철저한 역할 분리를 통해 대량 데이터 처리 시의 병목을 방지한다.

---

### ADR-001: 단일 데이터베이스 기반 벡터 검색 엔진
**결정**: RDBMS로 PostgreSQL 15+를 채택하고, `pgvector` 익스텐션을 도입한다. 임베딩 컬럼은 고정 차원이 아닌 `vector`(비고정 차원) 타입을 사용하여, 서로 다른 차원을 가진 다중 임베딩 모델을 유연하게 지원한다 (예: `bge-m3:latest` 1024d, OpenAI `text-embedding-3-small` 1536d).
**이유**: 메인 데이터(카테고리)와 벡터 데이터(임베딩)를 단일 데이터베이스에 보관함으로써 트랜잭션 관리와 JOIN 쿼리 편의성을 극대화한다. 코사인 유사도 검색을 통해 압도적 성능의 추천 엔진을 구축할 수 있다. 비고정 차원 `vector` 타입을 사용하면 프로바이더나 모델 전환 시 마이그레이션 없이 즉시 적용 가능하다.
**트레이드오프**: Pinecone 등 클라우드 기반 전용 벡터 DB 대비 초대형 스케일 아웃에서는 불리할 수 있으나, 현재 기술 시연용 포트폴리오의 규모에서는 인프라(컨테이너)의 단순함과 속도가 우선이다. 비고정 차원은 동일 컬럼 내 혼합 차원 벡터가 저장될 수 있으므로, 검색 시 차원 불일치 오류에 주의해야 한다.

### ADR-002 (보류): 비동기 Queue+Reverb → HTTP API 동기 처리로 전환. WebSocket 인프라 복잡도가 MVP 이점을 상회하여 기능은 보류되었으나, Reverb/Queue worker 인프라는 향후 재활용을 위해 유지 중.

### ADR-003: 다중 프로바이더 지원 및 분할 캐싱 기반 번역/임베딩
**결정**: 다중 프로바이더(Ollama, OpenAI 호환 등)를 지원하는 추상화된 임베딩/번역 시스템을 구축하고 `translation_caches`를 도입한다. 설정은 `embed`(임베딩)과 `translate`(번역) 그룹으로 분리되며, 각 프로바이더별 API 키 설정을 지원한다. 로컬 Ollama 모델(`translategemma:4b`)을 기본 번역 모델로, `bge-m3:latest`(1024차원 다국어)을 기본 임베딩 모델로 사용한다. `bge-m3:latest`은 한국어를 포함한 다국어 텍스트를 고품질 1024차원 벡터로 변환하므로, 번역 없이 원문 임베딩만으로 한국어 검색을 지원한다.
**이유**: 다량의 텍스트 번역 시 발생하는 외부 API 비용을 없애고 분당 요청 제한(Rate Limit 429) 문제를 근본적으로 차단한다. 프로바이더 추상화를 통해 Ollama 외에도 OpenAI 호환 API 등 다양한 백엔드를 유연하게 전환할 수 있다. "대>중>소" 카테고리를 분할하여 캐싱함으로써 중복 번역 시간을 획기적으로 절약한다. `bge-m3:latest`은 다국어 임베딩에 특화되어 있어 ko/zh/en 모든 언어의 검색을 단일 모델로 처리할 수 있다.
**트레이드오프**: 로컬 모델의 환각(Hallucination) 응답과 딜레이가 발생할 수 있어, 백엔드 로직 내에 Unicode 문자 범위 기반 검증 및 최대 3회의 자동 재시도(각 시도 간 500ms 지연, `translation_max_attempts` 설정), 수동 관리를 위한 `failed_jobs` 로직을 필수 구현해야 한다. 환각 검증은 타겟 언어의 허용 문자셋을 기준으로 판단한다 (en 타겟에 비라틴 문자가 2자 이상 연속 포함되면 환각으로 간주). 고유명사 등 자연스러운 단일 문자 혼입을 고려해 2자 이상 연속 등장 기준을 적용한다. **HTTP 수준 재시도**: 클라이언트의 `retryCall()`이 HTTP 429/5xx·연결 타임아웃을 지수 백오프(1s→2s→4s)+지터로 최대 `http_max_attempts`(기본 3)회 자동 재시도. 4xx 클라이언트 에러는 재시도 제외. 프론트엔드 `task-execution.tsx`도 단계별 최대 3회 재시도 + 단계 간 2초 지연으로 이중 방어.

### ADR-004: Next.js와 Laravel 간의 인증/인가(Auth) 아키텍처
**결정**: Laravel Sanctum을 활용한 API Token 기반 인증 및 Laravel Socialite를 통한 OAuth 연동을 채택한다.
**이유**: 프론트엔드(Next.js)와 백엔드(Laravel)가 분리된 멀티 컨테이너 환경이므로 상태를 유지하지 않는(Stateless) 토큰 방식이 적합하다. 다양한 소셜 로그인(Google, GitHub, Naver)을 손쉽게 통합하기 위해 Laravel Socialite를 활용하여 개발 공수를 최소화한다.
**트레이드오프**: Next.js 서버 컴포넌트에서 API 요청 시마다 토큰을 헤더에 실어 보내야 하는 관리 로직(NextAuth.js 등 연동)이 추가로 필요해 프론트엔드 구현 복잡도가 약간 상승한다.