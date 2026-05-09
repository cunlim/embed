# Step 2: login-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 디자인 시스템과 기존 페이지를 파악하라:

- `/docs/UI_GUIDE.md` (전체 — 특히 §6.2 로그인 페이지, §3.1 버튼, §4.2 컨테이너)
- `/docs/ARCHITECTURE.md` (특히 "/login" 라우트)
- `/docs/PRD.md` (특히 §4)
- `/docs/ADR.md` (ADR-004)
- `/nextjs/CLAUDE.md`
- `/nextjs/AGENTS.md`
- `/nextjs/app/layout.tsx`
- `/nextjs/app/globals.css`
- `/nextjs/app/page.tsx` (디자인 패턴 참고)
- `/nextjs/components/` (기존 컴포넌트)
- `/nextjs/lib/api.ts` (이전 step에서 생성됨 — API 함수 참고)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 디자인 시스템을 완전히 이해한 뒤 작업하라.

## 작업

`/login` 로그인/회원가입 페이지를 생성하라 (UI_GUIDE.md §6.2 참조).

### 페이지 구성

1. **중앙 정렬 카드 레이아웃**
2. **로그인 폼**:
   - 이메일 입력 (shadcn Input)
   - 비밀번호 입력 (shadcn Input)
   - "로그인" 버튼 (Primary variant)
3. **회원가입 폼**:
   - 이름, 이메일, 비밀번호, 비밀번호 확인 입력
   - "회원가입" 버튼
4. **소셜 로그인 섹션**:
   - 구분선 + "또는" 텍스트
   - Google, GitHub, Naver OAuth 버튼
   - `variant="outline"` + 각 서비스 아이콘
5. **상태 처리**:
   - **에러**: `role="alert"`, 빨간색 텍스트 + AlertCircle 아이콘
   - **로딩**: 버튼 disabled + Spinner 아이콘
   - **성공**: 토큰 저장 후 리다이렉트

### useAuth 훅 (`nextjs/hooks/useAuth.ts`)

인증 상태와 액션을 관리:
```typescript
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'github' | 'naver') => void;
}
```

인증 토큰은 `localStorage`에 저장하고, API 호출 시 헤더에 포함.

### 폼 검증

shadcn Form + React Hook Form 사용. 클라이언트 측 유효성 검사:
- 이메일 형식
- 비밀번호 최소 8자
- 회원가입 시 비밀번호 확인 일치

### OAuth 흐름

`loginWithOAuth()`는 `/api/auth/{provider}/redirect`로 리다이렉트. 콜백은 `/api/auth/{provider}/callback`에서 처리 후 토큰과 함께 프론트엔드로 리다이렉트.

## 생성할 파일

- `nextjs/app/login/page.tsx`
- `nextjs/hooks/useAuth.ts`
- `nextjs/lib/api.ts` (수정 — 인증 API 함수 추가)

## Acceptance Criteria

```bash
# 타입 검사
docker exec cl_embed_nextjs npx tsc --noEmit

# 빌드
docker exec cl_embed_nextjs npm run build

# eslint
docker exec cl_embed_nextjs npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. UI_GUIDE.md의 §8 구현 체크리스트를 확인한다.
3. Playwright로 `/login` 페이지를 브라우저에서 확인한다.
4. 라이트/다크 모드 모두 테스트한다.
5. 결과에 따라 `phases/frontend-embed/index.json`의 해당 step을 업데이트한다.

## 금지사항

- 비밀번호를 클라이언트 측 localStorage 외의 장소에 저장하지 마라. XSS 위험.
- OAuth 콜백 URL을 하드코딩하지 마라. 환경변수와 Laravel의 `redirect` 설정을 사용하라.
- 버튼/링크 최소 터치 영역 44x44px을 준수하라.
- 기존 테스트를 깨뜨리지 마라
