# Architecture Decision Records

## 인프라

Docker 컨테이너: 프로젝트 전용 3개 (Next.js, Laravel, Swagger UI) + 공유 인프라 2개 (PostgreSQL 15+pgvector, Redis).

- **Nginx 라우팅**: `/` → Next.js, `/api/` → Laravel FPM, `/swagger/` → Swagger UI, `/app/` → Reverb WebSocket (현재 미사용, 인프라만 유지)
- **도메인**: `https://embed.cunlim.dev` (cloudflared tunnel) / `http://localhost:3000` (Docker 포트 바인딩)
- **동시성 제어**: `TranslationCache::firstOrCreate`로 동일 카테고리 중복 번역 결과 방지 (현재 분산 락 미구현)

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
**이유**: 다량의 텍스트 번역 시 발생하는 외부 API 비용을 없애고 분당 요청 제한(Rate Limit 429) 문제를 근본적으로 차단한다. 프로바이더 추상화를 통해 Ollama 외에도 OpenAI 호환 API 등 다양한 프로바이더를 유연하게 전환할 수 있다. "대>중>소" 카테고리를 분할하여 캐싱함으로써 중복 번역 시간을 획기적으로 절약한다. `bge-m3:latest`은 다국어 임베딩에 특화되어 있어 ko/zh/en 모든 언어의 검색을 단일 모델로 처리할 수 있다.
**트레이드오프**: 로컬 모델의 환각(Hallucination) 응답과 딜레이가 발생할 수 있어, 백엔드 로직 내에 Unicode 문자 범위 기반 검증 및 최대 3회의 자동 재시도(각 시도 간 500ms 지연, `translation_max_attempts` 설정), 동기 처리 환경에서는 RuntimeException 전파 + 프론트엔드(task-execution.tsx)의 단계별 재시도(최대 3회 + 2초 지연)로 실패를 관리한다. 환각 검증은 타겟 언어의 허용 문자셋을 기준으로 판단한다 (en 타겟에 비라틴 문자가 2자 이상 연속 포함되면 환각으로 간주). 고유명사 등 자연스러운 단일 문자 혼입을 고려해 2자 이상 연속 등장 기준을 적용한다. **HTTP 수준 재시도**: 클라이언트의 `retryCall()`이 HTTP 429/5xx·연결 타임아웃을 지수 백오프(1s→2s→4s)+지터로 최대 `http_max_attempts`(기본 3)회 자동 재시도. 4xx 클라이언트 에러는 재시도 제외. 프론트엔드 `task-execution.tsx`도 단계별 최대 3회 재시도 + 단계 간 2초 지연으로 이중 방어.
**보안**: 프로바이더 API 키는 `.env`로 관리하되, 프로덕션 환경에서는 Docker secrets 또는 환경 변수 주입 방식 사용. `translation_caches`의 `source_text`/`translated_text`는 평문 저장되며, 민감 도메인 데이터 입력 시 사용자 가이드 필요.

### ADR-004: Next.js와 Laravel 간의 인증/인가(Auth) 아키텍처
**결정**: Laravel Sanctum을 활용한 API Token 기반 인증 및 Laravel Socialite를 통한 OAuth 연동을 채택한다. 토큰 만료 시간은 기본 24시간으로 설정하며, 토큰 접두사를 지정하여 로그 유출 시 탐지를 지원한다.
**이유**: 프론트엔드(Next.js)와 백엔드(Laravel)가 분리된 멀티 컨테이너 환경이므로 상태를 유지하지 않는(Stateless) 토큰 방식이 적합하다. 다양한 소셜 로그인(Google, GitHub, Naver)을 손쉽게 통합하기 위해 Laravel Socialite를 활용하여 개발 공수를 최소화한다.
**트레이드오프**: Next.js 서버 컴포넌트에서 API 요청 시마다 토큰을 헤더에 실어 보내야 하는 관리 로직(NextAuth.js 등 연동)이 추가로 필요해 프론트엔드 구현 복잡도가 약간 상승한다. OAuth 스코프는 최소 권한 원칙 적용 (Google: email+profile, GitHub: read:user+user:email, Naver: 이름+이메일).

---

### ADR-005: 외부 API 키 해시 저장 및 Quota 원자적 차감
**결정**: 외부 API(`/api/v1/search`) 인증에 사용되는 API 키는 SHA-256 해시로 저장한다. 생성 시 평문 키를 사용자에게 1회 반환하고, DB에는 `key_hash`(SHA-256 hex, 인덱스)와 `key_prefix`(표시용 10자)만 저장한다. Quota 차감은 `WHERE api_quota_remaining > 0` 조건을 포함한 원자적 SQL 연산으로 수행하여 동시 요청으로 인한 TOCTOU 경쟁 조건을 방지한다. 내부 API(`/api/categories`)와 외부 API 모두 모든 사용자(관리자 포함)에게 quota를 차감한다.
**이유**: DB 유출 시 평문 키가 즉시 악용되는 위험을 제거한다. Quota 체크와 차감이 분리된 비원자적 패턴에서는 동시 요청이 quota를 음수로 만들 수 있으며, 이는 `hasQuota()`가 영구 false를 반환하여 사용자가 API를 완전히 사용하지 못하는 장애로 이어진다.
**트레이드오프**: 키 해시 저장으로 키 미리보기(`key_preview`)는 prefix만 표시 가능. 분실 시 키 재생성 필요. 원자적 차감은 단일 SQL에서 `affected rows`로 성공 여부를 판단하므로, 차감 실패 시 이미 quota가 소진된 것으로 처리 — 사용자에게 429 반환.

### ADR-006: Rate Limit 미들웨어 IP 기반 fallback
**결정**: `ApiRateLimit` 미들웨어에서 bearer 토큰이 없는 요청에 대해 IP 기반 rate limit을 적용한다. 기존 토큰 기반 rate limit은 유지하되, 무토큰 요청은 `api_rate_limit:ip:{ip}` 키로 분당 60회 제한을 적용한다.
**이유**: 토큰이 없는 요청(401 반환)에 rate limit이 적용되지 않으면, 공격자가 무제한으로 인증 실패 요청을 보내 미들웨어 스택과 DB(`findByKey()` 쿼리)에 부하를 줄 수 있다. 각각 다른 랜덤 토큰을 사용하면 토큰별 고유 버킷이 생성되어 기존 rate limit도 우회 가능하다.
**트레이드오프**: IP 기반 제한은 프록시 뒤에서 동일 IP를 사용하는 사용자群体을 함께 제한할 수 있으나, `$request->ip()`는 `X-Forwarded-For`를 존중하므로 cloudflared tunnel 환경에서는 정상 동작한다.

---

## Deferred / Open Questions

### From 2026-06-06 review — 전체 해결됨

~~1. **[P1] Sanctum 토큰 만료 정책 미정의** — 해결됨: ADR-004에 토큰 만료(24시간), 접두사, OAuth 스코프 결정 추가.~~

~~2. **[P1] 다중 프로바이더 API 키 관리 전략 미정의** — 해결됨: ADR-003에 시크릿 관리 전략(Docker secrets) 추가.~~

~~3. **[P2] 번역 캐시 데이터 보호 전략 미정의** — 해결됨: ADR-003에 캐시 보호 고려사항 추가.~~
