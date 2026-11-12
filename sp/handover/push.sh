#!/bin/bash
# push.sh: the only way the package leaves the machine. Git hooks do NOT run inside the package worktree (it has no
# .githooks folder), so this runs the repository's leak guard by hand on every unpushed package commit, then the
# rebuild proof, then pushes from the clone (never force). Needs SP and REPO.
set -uo pipefail
: "${SP:?set SP}"; : "${REPO:?set REPO}"; BRANCH=wip/claude-b-handover
cd "$REPO" || exit 1
node tools/leak-guard.mjs --commits "$BRANCH --not --remotes" || { echo "push.sh: the leak guard refused. Remove the text it names from the source file (or from what make.sh mirrors) and run make.sh again. Never exempt it."; exit 1; }
SP="$SP" REPO="$REPO" bash "$SP/handover/verify.sh" || { echo "push.sh: the rebuild proof failed. Not pushed."; exit 1; }
git push -q origin "$BRANCH" 2>&1 | grep -v "^remote:" ; git fetch -q origin "$BRANCH"
[ "$(git rev-parse "$BRANCH")" = "$(git rev-parse "origin/$BRANCH")" ] && echo "push.sh: pushed $(git rev-parse --short "$BRANCH") to origin/$BRANCH" || { echo "push.sh: push did not land"; exit 1; }
