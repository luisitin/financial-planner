#!/bin/bash
# Assembles the hand-over state of builder claude-b and commits it on the local branch
# wip/claude-b-state (an orphan branch, worktree $SP/state-wt). Text only, paths made portable.
# Usage: make.sh "one line saying what changed"   (then: leak check + push, see push.sh)
set -uo pipefail
SP=$SP
REPO=$REPO
PROJ=$CLAUDE_PROJECT
WT="$SP/state-wt"; H="$SP/handover"; BR=origin/claude/creative-build-b531q0
MSG="${1:-refresh}"
cd "$REPO" || exit 1
if [ ! -d "$WT" ]; then
  git worktree add -q --detach "$WT" HEAD || exit 1
  ( cd "$WT" && git checkout -q --orphan wip/claude-b-state && git rm -rfq . ) || exit 1
fi
for d in notes tools workflows rv w1 opt touch buildlog; do rm -rf "${WT:?}/$d"; done
rm -f "${WT:?}"/*.md
san() { sed -e "s#$SP#\$SP#g" -e "s#$PROJ#\$CLAUDE_PROJECT#g" -e "s#$REPO#\$REPO#g" -e 's#$TMP/main-gate[A-Za-z0-9]*#$TMP/main-gate#g'; }
cpx() { # cpx <src file> <dst path under the state root>: copy a text file with portable paths
  [ -f "$1" ] || return 0
  if grep -qI . "$1" 2>/dev/null || [ ! -s "$1" ]; then mkdir -p "$(dirname "$WT/$2")"
    case "$1" in *.md|*.txt|*.changelog|*.msg) san < "$1" | python3 "$H/redact.py" > "$WT/$2";; *) san < "$1" > "$WT/$2";; esac; fi
}
cpdir() { # cpdir <src dir> <dst dir> <find args...>: copy matching text files, flat names kept relative
  local src="$1" dst="$2"; shift 2; [ -d "$src" ] || return 0
  ( cd "$src" && find . -type f "$@" -size -1500k 2>/dev/null ) | while read -r f; do cpx "$src/$f" "$dst/${f#./}"; done
}
snap() { # snap <worktree> <dst>: the worktree's commits above the shared branch as patches + what is uncommitted as one diff
  local wt="$1" out="$WT/$2"; [ -d "$wt/.git" ] || [ -f "$wt/.git" ] || return 0
  mkdir -p "$out"
  local base head n tree idx
  base=$(git -C "$wt" merge-base HEAD "$BR"); head=$(git -C "$wt" rev-parse --short=7 HEAD)
  n=$(git -C "$wt" rev-list --count "$base..HEAD")
  if [ "$n" -gt 0 ]; then git -C "$wt" format-patch -q "$base..HEAD" -o "$out/commits"; sed -i -E '1s/^From ([0-9a-f]{7})[0-9a-f]{33} /From \1 /' "$out"/commits/*.patch; fi
  idx="$H/tmp-index.$$"; rm -f "$idx"
  GIT_INDEX_FILE="$idx" git -C "$wt" read-tree HEAD
  GIT_INDEX_FILE="$idx" git -C "$wt" add -A 2>/dev/null
  tree=$(GIT_INDEX_FILE="$idx" git -C "$wt" write-tree); rm -f "$idx"
  local unc=0
  if [ "$tree" != "$(git -C "$wt" rev-parse 'HEAD^{tree}')" ]; then
    git -C "$wt" diff HEAD "$tree" > "$out/uncommitted.diff"; unc=$(git -C "$wt" diff --name-only HEAD "$tree" | wc -l)
  fi
  { echo "worktree: ${wt#$SP/} (in the old session's scratchpad; gone now)"
    echo "base (on $BR): $(git -C "$wt" rev-parse --short=7 "$base")"; echo "head: $head"; echo "commits above base: $n (commits/*.patch, apply in order with git am)"
    echo "uncommitted files at snapshot: $unc (uncommitted.diff, apply on top with git apply)"
    git -C "$wt" log --format='  %h %s' "$base..HEAD" | cut -c1-160; } > "$out/BASE.txt"
}

# 1. the two hand-written files and the notes
cpx "$H/PROMPT.md" PROMPT.md; cpx "$H/STATE.md" STATE.md; cpx "$H/README.md" README.md
cpx "$SP/ux/sessions.md" notes/sessions.md; cpx "$SP/owner-decisions.md" notes/owner-decisions.md
# 2. tools the next session needs
cpx "$SP/commit_item.py" tools/commit_item.py; cpx "$SP/ux/kit.mjs" tools/kit.mjs; cpx "$SP/ux/status.py" tools/status.py
cpx "$SP/push.sh" tools/push.sh; cpx "$H/make.sh" tools/make-state.sh; cpx "$H/redact.py" tools/redact.py
# 3. workflow scripts (plain JavaScript for the Workflow tool)
for f in retirement-levers-build ux-touch-sweep-harness optional-complexity-design ux-wave1-design; do
  for p in "$PROJ"/workflows/scripts/$f-*.js; do [ -f "$p" ] && cpx "$p" "workflows/$(basename "$p")"; done; done
cpx "$SP/w1/build-wf.js" workflows/wave1-build-wf.js; cpx "$SP/w1/design-alt-wf.js" workflows/wave1-design-alt-wf.js
cpx "$SP/rv/build-wf.js" workflows/retirement-build-wf.copy.js; cpx "$SP/ux/walk-wf.js" workflows/ux-walk-wf.js
# 4. the retirement request (owner, 2026-11-11b)
for f in spec walk engine pages connect ux verify-code verify-web; do cpx "$SP/rv/$f.md" "rv/$f.md"; done
for t in scn ret doc; do
  cpdir "$SP/rv/$t" "rv/$t" -maxdepth 1 \( -name '*.md' -o -name '*.changelog' -o -name '*.msg' \)
  snap "$SP/rv/b-$t" "rv/$t/code"
done
# 5. wave 1 of the touch stress test (owner, 2026-11-11)
cpdir "$SP/w1" w1 -maxdepth 1 \( -name '*.md' -o -name '*.json' -o -name '*.diff' -o -name '*.mjs' \)
for d in place place2 forms forms2 taps; do cpdir "$SP/w1/$d" "w1/design/$d" -maxdepth 1 -name '*.md'; done
for d in accept-place accept-forms accept-taps; do cpdir "$SP/w1/$d" "w1/$d" -maxdepth 1 \( -name '*.mjs' -o -name '*.md' -o -name '*.sh' \); done
cpdir "$SP/w1/integ-patches" w1/integ-patches -maxdepth 1 -name '*.patch'
for t in place taps forms; do snap "$SP/w1/build-$t" "w1/code-$t"; done
snap "$SP/w1/integ" w1/code-integ
# 6. the optional-complexity audit and design (owner, 2026-11-12)
cpdir "$SP/opt" opt -maxdepth 1 \( -name '*.md' -o -name '*.mjs' \)
for t in inline dial stages; do snap "$SP/opt/proto-$t" "opt/code-proto-$t"; done
# 7. the permanent touch check (harness)
cpdir "$SP/touch" touch -maxdepth 1 \( -name '*.md' -o -name '*.mjs' \)
snap "$SP/wtouch" touch/code
# 8. the build log artifact's generator and data (pictures stay on the artifact)
for f in gen.py build.py pair.py swap.py impact-merge.py enrich.json impact.json index.html; do cpx "$SP/buildlog/$f" "buildlog/$f"; done
cpdir "$SP/buildlog/raw" buildlog/raw -maxdepth 1 -name '*.json'
# 9. the UX findings behind wave 1 and wave 2 (verified lists)
cpdir "$SP/ux" ux -maxdepth 1 -name '*.md'
# manifest
{ echo "# Manifest ($(date -u '+%Y-%m-%d %H:%M UTC'))"; echo; echo "Shared branch tip when this was made: $(git rev-parse --short "$BR"); main: $(git rev-parse --short origin/main)"; echo
  ( cd "$WT" && find . -name BASE.txt | sort | while read -r b; do echo "## ${b%/BASE.txt}"; cat "$b"; echo; done )
  echo "## Files"; ( cd "$WT" && find . -type f -not -path './.git*' | sort | sed 's#^\./##' | awk '{print "- " $0}' ); } > "$WT/MANIFEST.md"
cd "$WT" && git add -A && if git diff --cached --quiet; then echo "state: nothing changed"; else
  git commit -q -m "State: $MSG" -m "Agent: claude-b
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS" && echo "state: committed $(git rev-parse --short HEAD), $(git ls-files | wc -l) files, $(du -sh --exclude=.git . | cut -f1)"; fi
