# Docker 컨테이너 Next.js 서버 사이드 디버깅 breakpoint 미작동 수정

## Context

Docker 컨테이너 내부에서 VS Code를 열면 breakpoint가 정상 작동하지만, Host(WSL2)에서 VS Code를 열고 `attach` 디버깅 시 breakpoint가 걸리지 않는 이슈.

**근본 원인:** Node.js inspector가 컨테이너 내부 경로(`/app/src/...`)를 리포트하는데, Host VS Code의 파일 경로(`/var/app/www/cl_embed/nextjs/src/...`)와 불일치하여 경로 매핑이 안 됨. 컨테이너 내부에서 열면 경로가 동일하므로 정상 작동.

## 수정 대상 파일

1. `/var/app/www/cl_embed/.vscode/launch.json` — root 워크스페이스용
2. `/var/app/www/cl_embed/nextjs/.vscode/launch.json` — nextjs 디렉토리 직접 오픈용

## 수정 내용

### 1. Root `.vscode/launch.json` — 서버 사이드 디버깅 설정에 경로 매핑 추가

```json
{
  "name": "Next.js: 서버 사이드 디버깅",
  "type": "node",
  "request": "attach",
  "port": 9229,
  "skipFiles": ["<node_internals>/**"],
  "restart": true,
  "localRoot": "${workspaceFolder}/nextjs",
  "remoteRoot": "/app",
  "sourceMaps": true,
  "sourceMapPathOverrides": {
    "webpack://_next/*": "${workspaceFolder}/nextjs/*",
    "webpack:///*": "${workspaceFolder}/nextjs/*"
  }
}
```

- `localRoot`: Host에서 VS Code가 바라보는 nextjs 소스 경로
- `remoteRoot`: 컨테이너 내부의 nextjs 소스 경로 (WORKDIR `/app`)
- `sourceMaps` + `sourceMapPathOverrides`: 서버 사이드 번들 소스맵 매핑

### 2. `nextjs/.vscode/launch.json` — 동일 패턴, 경로 조정

```json
{
  "name": "Next.js: 서버 사이드 디버깅",
  "type": "node",
  "request": "attach",
  "port": 9229,
  "skipFiles": ["<node_internals>/**"],
  "restart": true,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app",
  "sourceMaps": true,
  "sourceMapPathOverrides": {
    "webpack://_next/*": "${workspaceFolder}/*",
    "webpack:///*": "${workspaceFolder}/*"
  }
}
```

## 검증

1. `docker compose -f docker/docker-compose.yml up -d`로 컨테이너 실행
2. Host VS Code에서 `.vscode/launch.json`의 "Next.js: 서버 사이드 디버깅" 선택 → 디버그 시작
3. `nextjs/` 내 임의 `.tsx` 파일에 breakpoint 설정
4. 브라우저에서 해당 페이지 접근 → breakpoint 정지 확인
