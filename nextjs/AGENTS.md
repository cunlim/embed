<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## 주요 함정 (자주 마주치는 케이스)

1. **App Router만 사용**: `pages/` 디렉토리 기반 Pages Router는 사용하지 않는다. 모든 페이지는 `app/` 디렉토리 내 `page.tsx`로 생성.
2. **기본값: Server Components**: `"use client"` 지시문이 없는 모든 컴포넌트는 Server Component로 동작한다. `useState`, `useEffect`, `onClick` 등은 Client Component에서만 사용 가능.
3. **async 컴포넌트**: Server Component는 `async function`으로 선언하고 직접 `await`로 데이터를 가져올 수 있다. `getServerSideProps` / `getStaticProps`는 존재하지 않음.
4. **Metadata API**: `<Head>` 대신 `export const metadata: Metadata` 또는 `generateMetadata()` 사용.
5. **Route Handlers**: `pages/api/` 대신 `app/api/` 디렉토리 내 `route.ts` 파일 사용.
6. **fetch 캐싱**: Next.js 16은 기본적으로 `fetch` 요청을 캐시하지 않는다. 캐싱 필요 시 명시적 `cache: "force-cache"` 지정.
<!-- END:nextjs-agent-rules -->
