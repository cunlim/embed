# Architecture Decision Records

## 철학

- **작동하는 최소 구현 우선**: 포트폴리오 목적상 MVP 속도를 최우선으로 하되, 실제 운영 환경과 동일한 구조로 구축
- **외부 유료 API 최소화**: 번역/임베딩은 로컬 Ollama 사용, 비용为零
- **확장성 확보**: pgvector 다중 임베딩, Redis 큐/캐시 레이어를 두어 später 유연한 확장 가능

---

### ADR-001: Next.js App Router (프론트엔드 프레임워크)
**결정**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui
**이유**:
- SSR/CSR 전환이 용이하고, API 라우트를 내장해 별도 프론트엔드 서버 불필요
- App Router의 Server Components로 DB 페치 코드를 서버 사이드에 배치 가능
- shadcn/ui로 디자인 시스템 없이도 일관된 UI 즉시 구축
**트레이드오프**:
- React 생태계의 학습 곡선 (hooks, client/server boundary)
- Tailwind v4의 최신 문법에 대한 호환성 체크 필요

---

### ADR-002: Laravel 13 + Reverb (백엔드 + WebSocket)
**결정**: Laravel 13.5.0 + Laravel Reverb (Port 8080)
**이유**:
- Laravel의 Job/Queue/Eloquent 생태계가 번역+임베딩 파이프라인 구현에 직관적
- Reverb가 별도 Node.js WS 서버 없이 PHP 내에서 WebSocket 서버 제공
- Redis를 Queue Broker + Broadcasting Driver로 공통 활용 가능
**트레이드오프**:
- PHP 8.5 최신 문법 활용에 따른 패키지 호환성 확인 필요
- Reverb는 비교적 새로운 기술로 프로덕션 검증 사례 부족

---

### ADR-003: PostgreSQL + pgvector (벡터 검색)
**결정**: PostgreSQL 15 + pgvector extension, 고정 768차원 VECTOR
**이유**:
- 카테고리·번역 데이터와 벡터 데이터를 단일 DB에서 관리 (JOIN 단순화)
- pgvector의 `cosine_distance` 연산자로 임베딩 유사도 검색 직접 실행
- 기존 PostgreSQL 마이그레이션/시드 도구 그대로 사용 가능
**트레이드오프**:
- VECTOR 차원이 모델에 종속됨 — 모델 변경 시 마이그레이션 필요
- billions 스케일에는 별도 벡터 DB(Pinecone, Qdrant)가 유리하나 포트폴리오 범위에선 과잉

---

### ADR-004: Ollama 로컬 AI 모델
**결정**: Ollama 로컬 서버 — `translategemma:4b` (번역), `nomic-embed-text` (임베딩, 768차원)
**이유**:
- 외부 유료 API 비용为零, 네트워크 지연 없음
- Ollama REST API로 http://host.docker.internal:11434 호출, Docker 네트워크 내에서 직접 통신
- 모델 교체 시 DB의 `embed_model_name` 필드만 변경하면 되므로 확장 용이
**트레이드오프**:
- 로컬 GPU/CPU 리소스 필요 (WSL2에서 Ollama 실행)
- gemma 4b 모델의 번역 품질 한계 — 향후 모델 교체를 전제로 설계
- Rate Limit(429) 및 환각 응답에 대한 재시도 로직 필수

---

### ADR-005: Docker 멀티 컨테이너 아키텍처
**결정**: Docker Compose — `cl_embed_nextjs`, `cl_embed_laravel`, `cl_embed_pgvector`, `cl_embed_redis` 4개 서비스
**이유**:
- 인프라 구축 자동화 및 환경 일관성 확보
- `docker exec`로 컨테이너 내부에서 `serve`/`reverb:start`/`queue:work` 데몬 일괄 실행
- WSL2 Linux 환경에서 Linux 컨테이너 직접 실행 (nativeパフォーマンス)
**트레이드오프**:
- WSL2 + Docker Desktop 조합에서 리소스 소비 크다
- `WATCHPACK_POLLING` 적용으로 개발 시 파일 변경 감지 지연 가능성

---

### ADR-006: Job Chaining (번역 → 임베딩 파이프라인)
**결정**: `Bus::chain()` 또는 `Bus::batch()` — 카테고리(Row) 단위 독립 파이프라인
**이유**:
- 번역과 임베딩은 순서 종속적 — 번역 완료 없이는 임베딩 불가
- Row 단위로 분할하여 실패 시 해당 행만 재시도 가능
- `Cache::lock()`로 동일 언어+모델 조합의 중복 실행 방지
**트레이드오프**:
- 길게 연결된 체인이 전체 실패 가능성 — 개별 Job의 재시도 횟수 제한(기본 3회)으로 완화
- Laravel SerializesModels 이벤트 주의 (Eloquent 모델 직렬화)

---

### ADR-007: Redis Pub/Sub + Reverb (실시간 Progress)
**결정**: `Redis` Laravel Broadcasting Driver + `Reverb` Server
**이유**:
- Queue Worker가 Job 완료마다 Event 발송 → Redis Pub/Sub 경유 → Reverb → Nginx `/app/` → Client
- 별도 Node.js/WebSocket 라이브러리 없이 Laravel 생태계 내로 완전 내재화
- Nginx의 WebSocket Upgrade 헤더 (`/app/` 라우팅) 설정을 통해 기존 인프라와 통합
**트레이드오프**:
- Redis 단일 노드 운영 시 Pub/Sub 메시지 유실 가능 — 프로덕션에선 Redis Cluster 권장
- WSL2 환경에서 Reverb 포트(8080) 충돌 체크 필요

---

### ADR-008: translation_cache 기반 중복 번역 방지
**결정**: `translation_cache` 테이블 — `source_text` + `target_lang` UNIQUE 인덱스
**이유**:
- 동일 한국어 텍스트를 여러 카테고리에서 재사용할 경우, 중복 번역을 방지하여 Ollama API 호출 최소화
- 텍스트 분할 (`>` 기준) 후 개별 단위를 캐시하여 분할-재조립 구조와 자연스럽게 결합
- 캐시 히트 시 네트워크 왕복 지연 없음 — 응답 속도 향상
**트레이드오프**:
- 캐시 히트율에 따라 응답 품질 좌우 — 처음 실행 시 모든 텍스트에 번역 API 호출 발생
- Ollama 환각/비정형 응답이 캐시에 저장되면 이를 정정하기까지 수동介入 필요
- **방어 로직:** 정규식 검증 + 최대 3회 재시도로 환각 응답의 캐시 저장 방지

---

### ADR-009: Redis Throttle / Job 딜레이 (Rate Limit 우회)
**결정**: `Redis::throttle()` 또는 Job 간 `sleep()` 딜레이 적용
**이유**:
- Ollama 로컬 API는 분당 요청 제한(429)을 반환할 수 있음 — 특히 GPU 리소스 부족 시
- Throttle로 분당 요청 수를 제어하면 429 에러를 선제적으로 방지
- `Cache::lock()`과 조합하여 동일 언어+모델 조합의 동시 요청을 차단
**구현**:
```php
Redis::throttle('ollama')->allow(env('OLLAMA_THROTTLE_PER_MIN', 30))->every(60)->then(
    fn() => /* Ollama API 호출 */,
    fn() => throw new \RuntimeException('Rate limit exceeded')
);
```
**트레이드오프**:
- Throttle 딜레이로 전체 파이프라인 소요 시간 증가
- Ollama 서버 성능에 따라 `OLLAMA_THROTTLE_PER_MIN` 환경변수 조정이 필요

---

### ADR-010: Nginx URL 라우팅 규칙
**결정**: Nginx가 cloudflared tunnel → 서비스 간 프록시 역할, 3개 경로로 분기
**이유**:
- `/` (Next.js UI) — CSR/SRR 렌더링
- `/api/` (Laravel FPM) — REST API — `Location`, `Upgrade` 헤더 전달
- `/app/` (Laravel Reverb) — WebSocket Upgrade — 헤더 전환 필수
- 단일 Nginx로 3개 서비스를 관 리하여 인프라 단순화
**WebSocket Upgrade 헤더 (구현 필수)**:
```nginx
location /app/ {
    proxy_pass http://reverb:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```
**트레이드오프**:
- Reverb 포트(8080)가 WSL2 환경에서 충돌 가능 — 사전 체크 필요
- Redis Pub/Sub 메시지 유실 가능 — 프로덕션에선 Redis Cluster 권장