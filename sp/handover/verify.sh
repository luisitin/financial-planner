#!/bin/bash
# verify.sh: proves the package can rebuild the in-flight code by itself. For every code/<path>/BASE.txt in the package
# worktree ($SP/state-wt) it makes a clean worktree at the base, applies the patches and the unsaved-edits diff, and
# compares the resulting tree with the "tree:" line. Needs SP and REPO. Touches nothing else. Exit 0 = all equal.
set -uo pipefail
: "${SP:?set SP}"; : "${REPO:?set REPO}"; WT="$SP/state-wt"; V="$SP/handover/vwt"; fail=0
cd "$REPO" || exit 1
for b in $(cd "$WT" && find code -name BASE.txt | sort); do
  d="$WT/${b%/BASE.txt}"; name="${b%/BASE.txt}"
  base=$(sed -n 's/^base ([^)]*): //p' "$d/BASE.txt"); want=$(sed -n 's/^tree: //p' "$d/BASE.txt" | tr -d '-')
  git worktree remove --force "$V" >/dev/null 2>&1
  git worktree add -q --detach "$V" "$base" 2>/dev/null || { echo "FAIL $name: base $base is not in this clone (shallow clone? git fetch --unshallow origin)"; fail=1; continue; }
  ok=1
  if ls "$d"/commits/*.patch >/dev/null 2>&1; then git -C "$V" -c user.name=verify -c user.email=noreply@anthropic.com am -q "$d"/commits/*.patch >/dev/null 2>&1 || ok=0; fi
  if [ -s "$d/uncommitted.diff" ]; then git -C "$V" apply --index "$d/uncommitted.diff" 2>/dev/null || ok=0; fi
  got=$(git -C "$V" write-tree)
  if [ "$ok" = 1 ] && [ "$got" = "$want" ]; then echo "OK   $name: rebuilt code equals what was packaged"; else echo "FAIL $name: applied=$ok, tree ${got:0:8} is not ${want:0:8}"; fail=1; fi
done
git worktree remove --force "$V" >/dev/null 2>&1
exit $fail
