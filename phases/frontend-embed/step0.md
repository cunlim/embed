# Step 0: websocket-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 디자인 시스템과 아키텍처를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "데이터 흐름" 5~6단계)
- `/docs/UI_GUIDE.md` (전체 — 디자인 시스템, 컴포넌트, 애니메이션)
- `/nextjs/CLAUDE.md`
- `/nextjs/AGENTS.md`
- `/nextjs/app/layout.tsx`
- `/nextjs/app/globals.css`
- `/nextjs/package.json`

## 작업

Next.js에서 Laravel Reverb WebSocket을 구독하기 위한 클라이언트 측 설정을 구성하라.

### 패키지 설치

컨테이너 내부에서 실행:
```bash
npm install laravel-echo pusher-js
npm install --save-dev @types/pusher-js
```

### Echo 클라이언트 생성 (`nextjs/lib/echo.ts`)

```typescript
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

export const createEcho = (): Echo => {
  return new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
  });
};
```

### 환경변수

`.env.local`에 Reverb 설정 추가:
```
NEXT_PUBLIC_REVERB_APP_KEY=<app-key>
NEXT_PUBLIC_REVERB_HOST=embed.cunlim.dev
```

> **중요**: `NEXT_PUBLIC_REVERB_APP_KEY`는 Laravel `.env`의 `REVERB_APP_KEY`와 동일한 값을 사용해야 한다. Reverb는 앱 키를 공유하므로 Laravel 쪽 설정값을 그대로 복사해 넣어야 한다. 임의의 값을 생성하지 마라.

### useEcho 훅 (`nextjs/hooks/useEcho.ts`)

싱글톤 Echo 인스턴스를 제공하는 React 커스텀 훅. 컴포넌트 마운트 시 연결, 언마운트 시 disconnect.

### useBatchProgress 훅 (`nextjs/hooks/useBatchProgress.ts`)

번역 배치 진행률을 구독하는 커스텀 훅.

```typescript
interface BatchProgress {
  batchId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: 'processing' | 'completed' | 'failed';
  progressPercent: number;
}

export function useBatchProgress(batchId: string | null): BatchProgress | null;
```

Echo 채널 `translation.{batchId}`를 구독하고 `.listen('.translation.progress', ...)`로 이벤트 수신.

## 생성할 파일

- `nextjs/lib/echo.ts`
- `nextjs/hooks/useEcho.ts`
- `nextjs/hooks/useBatchProgress.ts`
- `nextjs/.env.local` (수정 — Reverb 환경변수 추가)

## Acceptance Criteria

```bash
# 패키지 설치 확인
docker exec cl_embed_nextjs npm ls laravel-echo pusher-js 2>&1

# 타입 검사
docker exec cl_embed_nextjs npx tsc --noEmit

# 빌드
docker exec cl_embed_nextjs npm run build
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. UI_GUIDE.md의 구현 체크리스트를 확인한다.
3. 결과에 따라 `phases/frontend-embed/index.json`의 해당 step을 업데이트한다.

## 금지사항

- Echo 인스턴스를 전역 변수로 관리하지 마라. React 라이프사이클에 맞춰 훅으로 관리하라.
- WebSocket 연결을 컴포넌트 내에서 직접 관리하지 마라. `lib/echo.ts`에서 중앙 관리하라.
- Reverb 설정값을 하드코딩하지 마라. 반드시 환경변수로 관리하라.
- 기존 테스트를 깨뜨리지 마라
