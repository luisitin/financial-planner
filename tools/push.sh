#!/bin/bash
# push the branch, then move main forward to the same commit (owner, 2026-11-07: "Update main, keep it in step").
# Never forces: main moves only when it is strictly behind the branch.
set -e
cd $REPO
git checkout -q HEAD -- CHANGELOG.md 2>/dev/null || true
B=claude/creative-build-b531q0
git fetch -q origin $B main
git merge-base --is-ancestor origin/$B HEAD || { echo "branch moved on: pull first"; exit 1; }
git push -q origin HEAD:$B 2>&1 | grep -v hint || true
git fetch -q origin main $B
if [ -f "$SP/main-hold" ]; then
  echo "pushed $(git rev-parse --short HEAD); main held at $(git rev-parse --short origin/main) (main-hold: the static-site fix is not in yet)"
elif git merge-base --is-ancestor origin/main origin/$B; then
  git push -q origin "$(git rev-parse origin/$B)":refs/heads/main 2>&1 | grep -v hint || true
  git fetch -q origin main
  echo "pushed $(git rev-parse --short HEAD); main at $(git rev-parse --short origin/main)"
else
  echo "pushed $(git rev-parse --short HEAD); main has commits the branch lacks: not moved"
fi
