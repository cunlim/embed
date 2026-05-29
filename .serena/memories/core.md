# Core — 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템. 벡터 검색(pgvector)으로 다국어 카테고리를 추천한다.

## 아키텍처

> 상세 내용은 `mem:tech_stack`, `AGENTS.md` 참조.

## 핵심 비즈니스 로직

- 카테고리 번역: 로컬 Ollama `translategemma:4b`
- 임베딩: 로컬 Ollama `bge-m3:latest` (1024차원 다국어)
- 동시성 제어: Redis `Cache::lock("category-translate:{categoryId}")`
- 캐싱: 그룹 전체를 하나의 캐시 키로 묶어 저장 (개별 `Cache::remember()` 금지)
