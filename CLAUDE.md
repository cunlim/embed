# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고할 가이드라인을 제공합니다.

## 문서화 언어 규칙

- **모든 문서와 주석은 한국어로 작성합니다.**
- 코드 식별자(변수명, 함수명, 클래스명 등)는 영어를 유지합니다.
- README, CLAUDE.md, AGENTS.md, PRD 등 문서 파일은 한국어로 작성합니다.
- 코드 내 주석은 한국어로 작성합니다.

## plugin, skills, mcp 사용
* 모든 프론트엔드 UI 작업은 `ui-ux-pro-max:ui-ux-pro-max` plugin을 활성화하여 수행한다.
* 구현 계획 수립, 코드 리뷰, TDD 등 구조적 접근이 필요한 작업은 `superpowers` plugin을 활성화하여 수행한다.
* 버그 수정 후 동일 유형의 실수를 방지하려면 `compound-engineering` plugin으로 학습 문서를 갱신한다.

## Subagent-Driven Development worktree 주의사항

- **worktree agent가 수정한 파일은 메인 워크트리에 "local changes"로 표시됨** — 공유 파일시스템으로 인해 worktree agent의 변경사항이 메인 워크트리에서 수정된 파일로 나타난다. `git merge <worktree-branch>` 전에 `git stash && git merge <worktree-branch> --no-edit && git stash pop`으로 머지한다.
- **worktree agent의 git commit 실패** — 서브에이전트는 권한 문제로 `git commit`에 실패하는 경우가 많다. 컨트롤러가 머지 후 직접 커밋해야 한다.
- **머지 후 worktree branch 삭제 실패** — `git branch -d <branch>`가 worktree 디렉토리 잔존으로 실패할 수 있다. `.claude/worktrees/` 디렉토리를 수동 정리한다.

## 프로젝트 개요

AI 기반 다국어 카테고리 추천 시스템 (포트폴리오). 사용자 텍스트를 분석해 네이버 카테고리 체계 기준으로 적합한 카테고리를 추천. 한국어/중국어/영어 지원, pgvector 코사인 유사도 검색 사용.

진행 상황은 `phases/` 디렉토리와 `git log`로 확인합니다.

docker container 들은 port 를 개방하지 않으니 localhost 로 접속하지 말고 https://embed.cunlim.dev 로 접속해주세요

## 레포지토리 구조

- `nextjs/` — 프론트엔드: Next.js 16 + React 19 + Tailwind v4 + TypeScript
- `laravel/` — 백엔드: Laravel 13 + PHP 8.5 + Pest 4
- `docker/` — Docker Compose + Dockerfiles (5개 서비스: nextjs, laravel, pgvector, redis, swagger)
- `docs/` — 설계 문서 (PRD, ARCHITECTURE, ADR, UI_GUIDE, solutions/)
- `phases/` — Phase별 작업 산출물
- `scripts/` — Claude Code Harness 스크립트

## 개발 프로세스

- **CRITICAL: TDD** — 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것. "나중에 테스트를 추가하겠다"는 접근은 허용되지 않는다.
  - TDD 적용 범위와 테스트 최소 요건은 [`laravel/CLAUDE.md`](laravel/CLAUDE.md)와 [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) 참조
  - Laravel: Pest 4 (`php artisan test --compact`)
  - Next.js: Vitest + React Testing Library (`docker exec cl_embed_nextjs npm test`)
- **Phase step 완료 조건** — step의 모든 파일 생성 후 테스트 실행하여 **0 failure**를 확인해야 한다. 실패가 있으면 step을 완료할 수 없다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- PHP 변경 완료 전 `vendor/bin/pint --format agent` 실행 (컨테이너 내부)
- **DB 테이블명**은 Laravel 기본 복수형 컨벤션을 따른다 (예: `categories`, `translation_caches`). 명시적 `protected $table` 지정은 불필요.
- **Form Request는 항상 명시적 `authorize()` 메서드를 포함**해야 한다. 기본값 `true`라도 명시적으로 선언한다.
- **버그 수정 패턴은 파일 내 모든 발생 지점에 적용** — `create()`→`firstOrCreate()` 같은 패턴 변경 시 public 메서드만 수정하고 private 메서드를 누락하지 않도록 `grep`으로 파일 전체를 확인한다.

## Phase 운영 규칙

- **완료된 phase는 수정하지 않는다** — 모든 phase가 `completed`인 상태에서 새 기능이 여러 레이어(API+Job+Frontend)에 걸쳐 있다면 신규 phase로 생성한다. 기존 phase에 step을 추가하거나 기존 step을 수정하지 않는다.
- **신규 phase 설계 전 `phases/*/index.json` 전체 확인** — 각 phase의 step summary를 읽고 기존 구현 범위를 파악한 후 새 phase의 step을 설계할 것

## 기술 스택

| 영역 | 스택 | 상세 |
|------|------|------|
| 백엔드 | Laravel 13 + PHP 8.5 | `laravel/CLAUDE.md` 참조 |
| 프론트엔드 | Next.js 16 + React 19 | `nextjs/CLAUDE.md` 참조 |
| 인프라 | PostgreSQL 15 + pgvector, Redis, Ollama, Docker | `docs/ADR.md`, `docs/ARCHITECTURE.md` 참조 |

## 검색 캐시 (search_logs)

- **임베딩 캐시는 모든 사용자가 공유** — `SearchLogRepository::findByNormalizedKeyword(string $normalizedKeyword)`가 정규화 키워드만으로 조회. user_id/session_id 분기 없이 모든 사용자가 동일 검색어의 임베딩을 재사용한다.
- `EmbeddingCacheService::getOrCreateEmbedding(string $keyword, string $modelName, ?int $userId = null)` — sessionId 파라미터 없음.
- `SearchLog` 모델에 `session_id` 컬럼 없음 (2026-05-19 제거됨). `POST /api/recommend`는 public.

## 컨테이너 접속

Next.js 관련 작업은 호스트에서 직접 실행하지 말고 반드시 `cl_embed_nextjs` 컨테이너 내부에서 실행해야 합니다. (node_modules 권한 문제 방지)

- Laravel 작업 디렉터리: `/var/www/html` (홈 디렉터리 `/home/appuser`와 혼동 금지)
- Next.js 작업 디렉터리: `/app`
- 컨테이너명은 `docker compose ps`로 확인

## supervisord 프로세스 관리

Laravel 컨테이너의 프로세스(serve, queue)는 supervisord가 관리합니다 (`docker/laravel/supervisord.conf`). 설정 변경 후 `supervisorctl reread && supervisorctl update`로 반영합니다.

```bash
docker exec cl_embed_laravel supervisorctl status
```

## Stop 훅 (테스트 자동화)

- **`run-all-checks.sh`** — Stop 시 `lint → tsc → vitest → pint → pest` 순차 실행 후 Windows 토스트 알림 전송
- **결과 파일** — `.claude/hooks/test-results/*.txt` (gitignored), 각 파일 마지막 줄 `EXIT=<code>`로 종료 코드 기록
- **알림** — `~/.claude/hooks/notify-checks.sh`가 exit code를 읽어 실패 항목만 요약. 전체 통과 시 "All checks passed"
- **수동 실행** — `.claude/hooks/run-all-checks.sh` 직접 실행 가능 (코드 동기화 포함)

## 알려진 이슈

- **`execute.py` spawned Claude CLI 실패** — spawned Claude CLI가 `--dangerously-skip-permissions`를 사용해도 멈추거나(hang) 컨테이너에만 구현하고 호스트 `index.json`을 갱신하지 못해 "Step did not update status"로 실패할 수 있다. 실패 시 **컨테이너에 코드가 이미 구현되어 있는지 먼저 확인**하고, 있으면 호스트로 동기화 후 index.json을 수동 갱신한다. 진행이 없으면 `kill` 후 직접 step 구현.
- **shadcn 컴포넌트 설치 시 confirm** — 기존 파일이 있으면 overwrite 확인(y/N)으로 배치 설치가 중단된다. `echo 'y' | npx shadcn@latest add <component>`로 회피.
- **Docker 바인드 마운트 주의사항**:
  - **동기화 불일치** — 호스트↔컨테이너 파일 변경이 즉시 반영되지 않을 수 있다. 파일 수정 후 **반드시 `wc -l`로 양쪽 라인 수를 비교**할 것.
    - **단일 파일**: `cat <host-path> | base64 | docker exec -i <container> bash -c "base64 -d > <container-path>"`
    - **대량 파일 (tar 파이프)**: `tar -C <host-dir> --exclude='node_modules' --exclude='vendor' --exclude='.git' -cf - . | docker exec -i <container> tar -C <container-dir> -xf -`
    - **컨테이너→호스트**: `docker exec cat <container-path> > <host-path>`
  - **신규 디렉토리** — 호스트에서 새 디렉토리를 만들면 컨테이너에 자동 반영되지 않을 수 있다. `docker exec cl_embed_laravel mkdir -p <path>`로 컨테이너에도 동일 디렉토리 생성.
    - **컨테이너→호스트 동기화 시 신규 디렉토리** — spawned Claude 등이 컨테이너에 새 디렉토리를 생성한 경우, 호스트에도 `mkdir -p`로 선행 생성 후 동기화해야 한다.
  - **`composer require` 후 동기화** — 컨테이너 내부에서 실행 시 생성/변경된 파일은 컨테이너에만 존재한다. `docker exec cl_embed_laravel cat <container-path> > <host-path>`로 호스트에 복사.
- **`npx shadcn add` 후 `package.json`/`package-lock.json` 확인** — shadcn 컴포넌트 추가 시 의존성 변경이 발생하면 두 파일이 수정된다. `git diff --stat`으로 누락 없이 커밋되었는지 확인할 것.
  - **bind mount 디렉토리는 daemon(root)이 생성** — `docker compose up -d` 시 bind mount 소스 디렉토리가 없으면 Docker daemon이 root 소유로 생성. 새 bind mount 추가 시 CI에서 `mkdir -p`로 미리 생성할 것.
- **API 라우트에는 세션 미들웨어 없음** — `routes/api.php`는 `StartSession` 미들웨어가 기본 포함되지 않는다. API 컨트롤러에서 `$request->session()` 호출 시 `RuntimeException: Session store not set on request.`이 발생한다. `$request->hasSession()`으로 사전 체크하고 없으면 `Str::uuid()` 등으로 대체할 것.
- **root 소유 경로에 파일 복사** — `/etc/` 등 root 소유 디렉터리에 파일을 쓸 때는 `docker cp <host-path> <container>:/path/to/file`가 가장 간결하다.
- **pgvector `<=>` distance 컬럼 미선택** — `orderByRaw('embedding <=> ?::vector', ...)`만 사용하면 distance 값이 SELECT 절에 포함되지 않아 모델 속성으로 접근할 수 없다. `selectRaw('*, embedding <=> ?::vector as distance', [...])`를 함께 사용해야 한다.
- **Swagger 문서 stale** — CI/CD 배포 후 `storage/api-docs/api-docs.json`이 갱신되지 않아 Swagger UI에 일부 엔드포인트만 표시될 수 있다. `docker exec cl_embed_laravel php artisan l5-swagger:generate`로 재생성. deploy.yml에 자동화되어 있으나 수동 작업 환경에서는 별도 실행 필요.
- **컨테이너 파일 변경 후 HMR 미감지** — `docker exec cl_embed_nextjs touch <container-path>`로 Turbopack Fast Refresh를 트리거할 수 있다.
- **hookify 플러그인 오버헤드** — hookify가 PreToolUse/PostToolUse/Stop/UserPromptSubmit 훅을 등록하지만, `.claude/hookify.*.local.md` 규칙이 없으면 빈 동작으로 시간만 소요된다. 불필요하면 `~/.claude/settings.json`에서 `"hookify@claude-plugins-official": false`로 비활성화.
- **테스트 DB 오염 (duplicate table/migration)** — PostgreSQL 테스트 DB에 `migration`/`users` 테이블이 이미 존재한다는 오류 발생 시 `docker exec cl_embed_laravel php artisan migrate:fresh --env=testing --force`로 초기화.
- **Playwright 인증 페이지 테스트** — `docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::first()->createToken("debug")->plainTextToken;'`로 Sanctum 토큰을 생성한 뒤, Playwright에서 `localStorage.setItem("auth_token", token)`으로 주입하고 `/embed`로 이동한다.
- **`deploy.yml` `migrate:rollback --step=1` 위험** — 모든 migration이 batch 1일 때 `--step=1`은 전체 rollback을 유발할 수 있다. migration 전 batch 번호를 기록하고 `--batch=N`으로 특정 batch만 롤백할 것.
- **테스트 DB 사용자 격리** — `dbeaver_lim_test`는 `cl_embed`에 CONNECT 권한이 없다. `.env.testing`(`DB_USERNAME=dbeaver_lim_test`)이 적용된 환경에서는 실수로 `migrate:fresh`를 실행해도 PostgreSQL이 `permission denied`를 반환하여 운영DB가 보호된다. `.env.testing`은 gitignore, `.env.testing.example`만 커밋, CI에서 `$LIVE_ROOT`로부터 복사한다.
- **`bootstrap/cache/config.php` 운영DB 오염 위험** — `php artisan config:cache` 실행 후 캐시된 설정은 `phpunit.xml`의 `<env>` 오버라이드와 `.env.testing`을 **무시**한다. 이 상태에서 `php artisan test`를 실행하면 `RefreshDatabase` trait이 운영DB에 `migrate:fresh`를 실행하여 모든 데이터가 소실된다. **반드시 `php artisan config:clear`로 캐시를 제거한 후 테스트를 실행할 것.** Stop 훅(`run-all-checks.sh`)에서 자동으로 `config:clear`를 선행 실행하도록 설정되어 있다.

## 인프라 환경 (WSL2)

- **WSL2 `networkingMode=mirrored`**: Windows 호스트와 WSL2가 동일한 네트워크를 공유. Docker 컨테이너 내부에서 `host.docker.internal`로 Windows 호스트의 Ollama(port 11434)에 접근 가능.
- **Ollama**: Windows 호스트에서 실행 중인 Ollama(`host.docker.internal:11434`)를 Laravel 컨테이너가 호출한다.

## Docker Compose

```bash
cd docker && docker compose up -d                     # 모든 서비스 시작
cd docker && docker compose down                      # 모든 서비스 중지
```

**WSL2 `restart` 불가** — `docker compose restart` 시 바인드 마운트 경로가 무효화되어 `no such file or directory` 오류 발생. `stop` + `up -d` 조합을 사용할 것. `--force-recreate`도 동일 문제.

## 로깅

로그 경로 상세는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 참조.

## CI/CD (셀프호스티드 WSL GitHub Actions 러너)

- **릴리스**: `scripts/git_release.sh` 실행 (develop → main 머지 후 푸시, 완료 후 develop 복귀)
- **러너 경로**: `/var/app/actions-runner`
- `main` 브랜치 푸시 시 컨테이너 재시작 및 데몬 재실행.
- **CI 재실행** — `gh run rerun`이 토큰 권한 부족으로 실패할 경우, 빈 커밋을 main에 푸시하여 CI/CD 트리거 (`git commit --allow-empty -m "chore(ci): CI 트리거"` → `git push origin main`). 완료 후 `git checkout develop && git merge main && git push origin develop`로 동기화.
- **`.env`/`.env.local` 파일** — gitignore 대상이므로 CI/CD에서 `$LIVE_ROOT`로부터 복사. `LIVE_ROOT`는 GitHub Repository Variables에 설정 (절대 경로 노출 방지).
- **Node 의존성** — `docker compose build`의 `RUN npm ci`로 설치, `/app/node_modules` 익명 볼륨이 bind mount보다 우선해 보존. 별도 npm ci 불필요.
- **CI 종료 후 bind mount 경로 차이** — CI/CD "Restart Containers" 단계가 `$LIVE_ROOT/docker`에서 실행되므로 bind mount는 자동 로컬 경로로 복귀. 문제 발생 시 `docker inspect cl_embed_nextjs --format '{{range .Mounts}}{{if eq .Destination "/app"}}Source: {{.Source}}{{end}}{{end}}'`로 확인, CI workspace를 가리키면 `docker compose stop && docker compose up -d`로 복구.
- **`isAdmin`/`isSuperAdmin` 시그니처 변경 시 `tsc --noEmit`** — user 객체(`{role?: string}`) 기반 권한 체크로 변경 시 `npx tsc --noEmit`으로 모든 호출자를 찾아 갱신. `admin/page.tsx`, `auth-buttons.tsx` 등에서 `isAdmin(user.id)` → `isAdmin(user)`로 변경.
- **`make:migration` 빈 파일 생성** — bind mount 환경에서 `php artisan make:migration`이 0-byte 파일을 생성할 수 있다. 호스트에서 직접 작성 후 `cat <host-path> | base64 | docker exec -i cl_embed_laravel bash -c "base64 -d > /var/www/html/<container-path>"`로 동기화.

## 관련 문서

- [`laravel/CLAUDE.md`](laravel/CLAUDE.md) — 백엔드 명령어, 데몬 실행, 코드 컨벤션, 패키지
- [`nextjs/CLAUDE.md`](nextjs/CLAUDE.md) — 프론트엔드 명령어, 패키지
- [`nextjs/AGENTS.md`](nextjs/AGENTS.md) — Next.js 16 브레이킹 체인지 (필독)
- **Feature Spec 3축** — 새 기능 구현 전 이 3개 문서의 요구사항 일관성을 반드시 확인한다:
  - [`docs/PRD.md`](docs/PRD.md) — 제품 요구사항 (Why), Phase 정의, 성능 목표
  - [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 인프라·데이터 흐름 (How), 페이지 구성, API 엔드포인트
  - [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md) — UI 명세 (What), 컴포넌트·버튼·상태·아이콘 구체 스펙
- [`docs/ADR.md`](docs/ADR.md) — 아키텍처 결정 기록 (pgvector, Ollama, Sanctum)
