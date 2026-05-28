# Tech Stack

## 백엔드 (laravel/)

- **PHP 8.5**, **Laravel 13**
- **PostgreSQL 15** + **pgvector** (벡터 검색)
- **Redis** (캐싱, 분산 락)
- **Laravel Sanctum** (API 인증)
- **Laravel Socialite** (OAuth: Google, GitHub, Naver)
- **L5-Swagger** (API 문서)
- **Pest PHP 4** (테스트 프레임워크)
- **Laravel Pint** (코드 포맷터)
- **로컬 AI**: Ollama `translategemma:4b` (번역), `bge-m3:latest` (임베딩, 1024차원)

## 프론트엔드 (nextjs/)

- **Next.js 16** (App Router only)
- **React 19**, **TypeScript 5**
- **Tailwind CSS v4** + **shadcn/ui** (base-nova 스타일)
- **Zod** (스키마 검증)
- **react-hook-form** (폼 관리)
- **Vitest** + **React Testing Library** (테스트)
- **ESLint** (린팅)

## 인프라

- **Docker Compose** — 5개 컨테이너
- **Nginx** — 리버스 프록시
- **Cloudflare Tunnel** — 외부 접속
