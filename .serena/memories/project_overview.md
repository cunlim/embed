# 프로젝트 개요

## 프로젝트 이름
cl_embed

## 프로젝트 설명
Laravel 백엔드와 Next.js 프론트엔드를 결합한 하이브리드 웹 애플리케이션

## 기술 스택

### 백엔드 (Laravel)
- **PHP**: 8.5
- **Laravel Framework**: v13
- **Laravel Reverb**: v1 (실시간 이벤트)
- **Laravel Boost**: v2 (AI 에이전트 지원)
- **Laravel Pint**: v1 (코드 포맷팅)
- **Laravel Pail**: v1 (로깅)
- **테스트**: Pest PHP v4, PHPUnit v12
- **데이터베이스**: SQLite (테스트), PostgreSQL (추정)

### 프론트엔드 (Next.js)
- **Next.js**: 16.2.4
- **React**: 19.2.4
- **TypeScript**: 5
- **Tailwind CSS**: 4
- **ESLint**: 9

### 인프라
- **Docker**: 컨테이너화된 개발 환경
- **네트워크**: docker_public_1, docker_private_1

## 프로젝트 구조
```
/var/app/www/cl_embed/
├── laravel/          # 백엔드 (Laravel)
│   ├── app/          # 애플리케이션 코드
│   ├── config/       # 설정 파일
│   ├── database/     # 마이그레이션, 시더
│   ├── routes/       # 라우트 정의
│   ├── tests/        # 테스트
│   └── ...
├── nextjs/           # 프론트엔드 (Next.js)
│   ├── app/          # Next.js 앱 디렉토리
│   ├── public/       # 정적 파일
│   └── ...
├── docker/           # Docker 설정
│   └── docker-compose.yml
└── doc/              # 문서
```

## 주요 기능
- Laravel 백엔드 API 서버
- Next.js 프론트엔드 웹 인터페이스
- 실시간 이벤트 (Laravel Reverb)
- AI 에이전트 지원 (Laravel Boost)