#!/bin/bash
# Proves the package is enough to rebuild the in-flight code: for every snapshot, a clean worktree at its base gets the
# patches (git am) and the uncommitted diff (git apply), and its tree must equal the tree of the original worktree.
set -uo pipefail
SP=$SP
REPO=$REPO; WT="$SP/state-wt"; V="$SP/handover/vwt"; fail=0
cd "$REPO"
for b in $(cd "$WT" && find . -name BASE.txt | sort); do
  d="$WT/${b%/BASE.txt}"; src="$SP/$(sed -n 's/^worktree: \([^ ]*\) .*/\1/p' "$d/BASE.txt")"
  base=$(sed -n 's/^base ([^)]*): //p' "$d/BASE.txt")
  [ -d "$src" ] || { echo "SKIP ${b%/BASE.txt}: source worktree gone"; continue; }
  idx="$SP/handover/tmp-vindex.$$"; rm -f "$idx"
  GIT_INDEX_FILE="$idx" git -C "$src" read-tree HEAD; GIT_INDEX_FILE="$idx" git -C "$src" add -A 2>/dev/null
  want=$(GIT_INDEX_FILE="$idx" git -C "$src" write-tree); rm -f "$idx"
  git worktree remove --force "$V" >/dev/null 2>&1; git worktree add -q --detach "$V" "$base" || { echo "FAIL ${b%/BASE.txt}: no base $base"; fail=1; continue; }
  ok=1
  if ls "$d"/commits/*.patch >/dev/null 2>&1; then git -C "$V" -c user.name=verify -c user.email=noreply@anthropic.com am -q "$d"/commits/*.patch >/dev/null 2>&1 || ok=0; fi
  if [ -s "$d/uncommitted.diff" ]; then git -C "$V" apply --index "$d/uncommitted.diff" 2>/dev/null || ok=0; fi
  got=$(git -C "$V" write-tree)
  if [ "$ok" = 1 ] && [ "$got" = "$want" ]; then echo "OK   ${b%/BASE.txt}: rebuilt tree equals the original"; else
    echo "FAIL ${b%/BASE.txt}: applied=$ok tree ${got:0:8} vs ${want:0:8}; differing: $(git -C "$V" diff --name-only "$got" "$want" 2>/dev/null | head -5 | tr '\n' ' ')"; fail=1; fi
done
git worktree remove --force "$V" >/dev/null 2>&1
exit $fail
