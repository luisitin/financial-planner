#!/bin/bash
# unpack.sh: run once in a new session. Rebuilds the old session's working layout in YOUR scratchpad, so that every
# report, script, workflow prompt and note that says $SP/... is true again:
#   - copies sp/* to $SP/ (reports, tools, specs, notes) and puts real paths back into the scripts
#   - copies workflows/scripts/*.js to $SP/claude-project/workflows/scripts/
#   - rebuilds each in-flight worktree from code/<path>/ at $SP/<path> (git am, git apply) and checks its tree
# Needs: SP = your scratchpad (must not already hold rv/ or w1/), REPO = the clone (full history).
# It never pushes and never edits the repository's branches.
set -uo pipefail
: "${SP:?set SP to your scratchpad}"; : "${REPO:?set REPO to the clone}"
PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; [ -d "$PKG/sp" ] || PKG="$(dirname "$PKG")"; [ -d "$PKG/sp" ] || PKG="$(dirname "$PKG")"
[ -d "$PKG/sp" ] || { echo "unpack.sh: cannot find the package (a folder with sp/ and code/)"; exit 1; }
for d in rv w1 opt touch gap; do [ -e "$SP/$d" ] && { echo "unpack.sh: $SP/$d already exists. Refusing to overwrite work. Use an empty scratchpad folder."; exit 1; }; done
cd "$REPO" || exit 1
[ "$(git rev-parse --is-shallow-repository)" = true ] && { echo "shallow clone: fetching full history"; git fetch -q --unshallow origin || exit 1; }
mkdir -p "$SP" "$SP/claude-project/workflows/scripts"
cp -a "$PKG/sp/." "$SP/"; cp -a "$PKG"/workflows/scripts/. "$SP/claude-project/workflows/scripts/"
for top in $(ls "$PKG/sp") claude-project; do [ -e "$SP/$top" ] || continue
  grep -rlE '\$SP|\$REPO|\$CLAUDE_PROJECT' "$SP/$top" --include='*.mjs' --include='*.js' --include='*.cjs' --include='*.py' --include='*.json' 2>/dev/null | while read -r f; do
    sed -i -e "s#\\\$CLAUDE_PROJECT#$SP/claude-project#g" -e "s#\\\$SP#$SP#g" -e "s#\\\$REPO#$REPO#g" "$f"; done; done
chmod +x "$SP"/handover/*.sh 2>/dev/null
fail=0
for b in $(cd "$PKG" && find code -name BASE.txt | sort); do
  rel="${b#code/}"; rel="${rel%/BASE.txt}"; d="$PKG/code/$rel"; wt="$SP/$rel"
  base=$(sed -n 's/^base ([^)]*): //p' "$d/BASE.txt"); want=$(sed -n 's/^tree: //p' "$d/BASE.txt" | tr -d '-')
  mkdir -p "$(dirname "$wt")"
  git worktree add -q --detach "$wt" "$base" || { echo "FAIL $rel: cannot make a worktree at $base"; fail=1; continue; }
  ok=1
  if ls "$d"/commits/*.patch >/dev/null 2>&1; then git -C "$wt" am -q -3 "$d"/commits/*.patch >/dev/null 2>&1 || ok=0; fi
  if [ -s "$d/uncommitted.diff" ]; then git -C "$wt" apply --index "$d/uncommitted.diff" 2>/dev/null || ok=0; fi
  got=$(git -C "$wt" write-tree)
  if [ "$ok" = 1 ] && [ "$got" = "$want" ]; then echo "OK   $rel: rebuilt at $wt (unsaved edits are staged, not committed)"; else echo "FAIL $rel: applied=$ok, tree differs from what was packaged"; fail=1; fi
done
echo "unpack.sh: layout restored under $SP. Read $SP/handover/STATE.md next."
exit $fail
