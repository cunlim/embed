#!/bin/bash
#
# develop → main 머지 및 푸시 스크립트
# 사용법: bash scripts/git_release.sh

set -e

echo "=== 현재 브랜치 확인 ==="
CURRENT_BRANCH=$(git branch --show-current)
echo "현재 브랜치: $CURRENT_BRANCH"

echo ""
echo "=== develop 브랜치 푸시 ==="
git push origin develop

echo ""
echo "=== main 브랜치로 전환 ==="
git switch main

echo ""
echo "=== main 브랜치 업데이트 ==="
git pull origin main

echo ""
echo "=== develop 브랜치를 main에 머지 ==="
git merge develop

echo ""
echo "=== main 브랜치 푸시 ==="
git push origin main

echo ""
echo "=== develop 브랜치로 복귀 ==="
git switch develop

echo ""
echo "=== 완료 ==="
echo "main 브랜치에 develop이 성공적으로 반영되고 푸시되었습니다."
