#!/bin/bash
# make.sh "<what changed>": rebuilds the hand-over package of builder claude-b from the scratchpad and commits it on the
# local branch wip/claude-b-handover (worktree $SP/state-wt). It never pushes: use push.sh.
# Needs: SP (scratchpad), REPO (the clone), optional CLAUDE_PROJECT (where this session's workflow scripts are kept;
# default $SP/claude-project, which is where unpack.sh puts the old ones).
# The package mirrors the scratchpad: sp/<same path> for reports and scripts, code/<worktree path>/ for in-flight code
# as patches, workflows/scripts/ for workflow scripts. unpack.sh is the inverse.
# SKIP_UNSAVED="rv/b-doc ..." leaves a worktree's unsaved edits out (its commits are still packaged).
# Safe by construction: the new package is assembled in a staging folder and replaces the old one only when its key
# files are there and it has not shrunk by more than 30% (FORCE=1 to override after reading why).
set -uo pipefail
: "${SP:?set SP to your scratchpad}"; : "${REPO:?set REPO to the clone}"
PROJ="${CLAUDE_PROJECT:-$SP/claude-project}"
BRANCH=wip/claude-b-handover; SHARED=origin/claude/creative-build-b531q0
WT="$SP/state-wt"; H="$SP/handover"; ST="$H/stage"; MSG="${1:-refresh}"
cd "$REPO" || exit 1
for need in "$H/PROMPT.md" "$H/STATE.md" "$H/README.md" "$H/unpack.sh" "$SP/rv/spec.md" "$SP/ux/kit.mjs" "$SP/commit_item.py"; do
  [ -s "$need" ] || { echo "make.sh: missing $need. Nothing was changed. (Did you run unpack.sh first?)"; exit 1; }
done
rm -rf "${ST:?}"; mkdir -p "$ST"

# text copied into the package: machine paths become $SP / $REPO / $CLAUDE_PROJECT, model names are dropped
san() { sed -e "s#$PROJ#\$CLAUDE_PROJECT#g" -e "s#$SP#\$SP#g" -e "s#$REPO#\$REPO#g" \
            -e 's#$TMP/main-gate[A-Za-z0-9]*#$TMP/main-gate#g' \
            -E -e 's/Claude (Opus|Fable|Sonnet|Haiku) [0-9]+(\.[0-9]+)?/Claude/g' -e 's/claude-(opus|fable|sonnet|haiku)-[0-9]+(-[0-9]+)*/[model id]/g' \
            -e 's/\b(Opus|Sonnet|Haiku|Fable) [0-9]+(\.[0-9]+)?\b/[model]/g'; }
cpx() { # cpx <source file> <path in the package>
  [ -f "$1" ] || return 0
  grep -qI . "$1" 2>/dev/null || return 0                    # text only
  [ "$(stat -c %s "$1")" -le 1500000 ] || { echo "  skipped (over 1.5 MB): ${1#$SP/}"; return 0; }
  mkdir -p "$(dirname "$ST/$2")"
  case "$1" in *.md|*.txt|*.changelog|*.msg|*.tsv) san < "$1" | python3 "$H/redact.py" > "$ST/$2";; *) san < "$1" > "$ST/$2";; esac
}
mirror() { # mirror <folder under $SP> <maxdepth> <name pattern>...   -> sp/<same path>
  local rel="$1" depth="$2"; shift 2; [ -d "$SP/$rel" ] || return 0
  local args=(); for p in "$@"; do args+=(-o -name "$p"); done
  ( cd "$SP/$rel" && find . -maxdepth "$depth" -type f \( "${args[@]:1}" \) -not -path '*/node_modules/*' 2>/dev/null ) | sort | while read -r f; do
    f="${f#./}"; if [ "$rel" = "." ]; then cpx "$SP/$f" "sp/$f"; else cpx "$SP/$rel/$f" "sp/$rel/$f"; fi; done
}
dashed() { echo "$1" | sed -E 's/(....)/\1-/g; s/-$//'; }   # a hash in groups of four, so no long run of digits
snap() { # snap <worktree path under $SP>   -> code/<same path>/{BASE.txt, commits/*.patch, uncommitted.diff}
  local rel="$1" wt="$SP/$1" out="$ST/code/$1"; [ -e "$wt/.git" ] || return 0
  mkdir -p "$out"; local base n idx tree unc=0
  base=$(git -C "$wt" merge-base HEAD "$SHARED") || return 0
  n=$(git -C "$wt" rev-list --count "$base..HEAD")
  if [ "$n" -gt 0 ]; then git -C "$wt" format-patch -q "$base..HEAD" -o "$out/commits"
    sed -i -E -e '1s/^From ([0-9a-f]{7})[0-9a-f]{33} /From \1 /' -e 's/^(Co-Authored-By: Claude) (Opus|Fable|Sonnet|Haiku) [0-9.]+ </\1 </' "$out"/commits/*.patch; fi
  idx="$H/tmp-index.$$"; rm -f "$idx"
  GIT_INDEX_FILE="$idx" git -C "$wt" read-tree HEAD; GIT_INDEX_FILE="$idx" git -C "$wt" add -A 2>/dev/null
  tree=$(GIT_INDEX_FILE="$idx" git -C "$wt" write-tree); rm -f "$idx"
  local left=""
  if [ "$tree" != "$(git -C "$wt" rev-parse 'HEAD^{tree}')" ]; then
    unc=$(git -C "$wt" diff --name-only HEAD "$tree" | wc -l)
    case " ${SKIP_UNSAVED:-} " in *" $rel "*) left="unsaved edits in $unc file(s) were LEFT OUT of the package (the leak guard refuses text in them; STATE.md says what to do)"; tree=$(git -C "$wt" rev-parse 'HEAD^{tree}'); unc=0;;
      *) git -C "$wt" diff HEAD "$tree" > "$out/uncommitted.diff";; esac; fi
  { echo "worktree: \$SP/$rel"
    echo "base (a commit on the shared branch): $(git -C "$wt" rev-parse --short=7 "$base")"
    echo "head when packaged: $(git -C "$wt" rev-parse --short=7 HEAD)"
    echo "commits above base: $n (commits/*.patch, in order, git am -3)"
    echo "files with unsaved edits: $unc (uncommitted.diff, on top, git apply --index)"
    echo "tree: $(dashed "$tree")"
    [ -n "$left" ] && echo "$left"
    git -C "$wt" log --format='  %h %s' "$base..HEAD" | cut -c1-160; } > "$out/BASE.txt"
}

# ---- what is mirrored (paths under $SP) ----
mirror . 1 commit_item.py owner-decisions.md
mirror ux 1 kit.mjs sessions.md walk-wf.js
mirror ux/synth 1 '*.tsv' '*.py'; mirror ux/synth/themes 1 '*.md'
mirror rv 1 '*.md' '*.js'
for t in scn ret doc; do mirror "rv/$t" 1 '*.md' '*.changelog' '*.msg' '*.py'; done   # not the invented bank files or their makers: their ids look like account numbers to the leak guard
mirror rv/ret/money 1 'critic-money-round1-*.md'
mirror rv/walk/out/gs 1 '*.real.plan.json'
mirror w1 1 '*.md' '*.json' '*.mjs' '*.js' '*.py'
for d in place place2 forms forms2 taps; do mirror "w1/$d" 1 '*.md' steps.json; done
for d in accept-place accept-taps accept-forms; do mirror "w1/$d" 3 '*.mjs' '*.js' '*.md' '*.sh'; done
mirror w1/judge-place 1 '*.mjs'
mirror w1/bf 1 journeys.mjs jlib.mjs walk-all.mjs accept-all.sh serve.mjs
mirror w1/integ-patches 1 '*.patch'
mirror opt 1 '*.md' '*.mjs'
mirror touch 1 '*.md' '*.mjs'
mirror buildlog 1 gen.py build.py pair.py swap.py impact-merge.py enrich.json impact.json impact-raw.json impact-verified.json index.html
mirror buildlog/raw 1 '*.json'
mirror est/design 1 '*.md'
mirror gap 1 '*.md'
mirror gap/gc 1 '*.md'
mirror handover 1 PROMPT.md STATE.md README.md make.sh verify.sh push.sh unpack.sh redact.py
for w in rv/b-scn rv/b-ret rv/b-doc w1/build-place w1/build-taps w1/build-forms w1/integ w1/bp/combo wtouch opt/proto-inline opt/proto-dial opt/proto-stages gap/gc/g21/wt gap/gc/g34/wt; do snap "$w"; done
for f in retirement-levers-build ux-touch-sweep-harness optional-complexity-design ux-wave1-design handover-cold-read buildlog-details buildlog-impact buildlog-wave2 buildlog-why-verify; do
  for p in "$PROJ"/workflows/scripts/$f-*.js; do [ -f "$p" ] && cpx "$p" "workflows/scripts/$(basename "$p")"; done; done
for f in PROMPT.md STATE.md README.md unpack.sh; do cp "$ST/sp/handover/$f" "$ST/$f"; done
sed -i "s/@STAMP@/$(date -u '+%Y-%m-%d %H:%M UTC')/" "$ST/STATE.md" "$ST/sp/handover/STATE.md" 2>/dev/null
{ echo "# Manifest ($(date -u '+%Y-%m-%d %H:%M UTC'))"; echo
  echo "Shared branch tip when this was made: $(git rev-parse --short=7 "$SHARED"); main: $(git rev-parse --short=7 origin/main)"; echo
  echo "## In-flight code (each folder: BASE.txt, commits/, uncommitted.diff)"; echo
  ( cd "$ST" && find code -name BASE.txt 2>/dev/null | sort | while read -r b; do echo "### ${b%/BASE.txt}"; cat "$b"; echo; done )
  echo "## Files"; ( cd "$ST" && find . -type f | sort | sed 's#^\./##' | awk '{print "- " $0}' ); } > "$ST/MANIFEST.md"

# ---- safety, then swap into the package worktree ----
for need in PROMPT.md STATE.md README.md unpack.sh sp/rv/spec.md sp/ux/kit.mjs sp/commit_item.py sp/handover/make.sh; do
  [ -s "$ST/$need" ] || { echo "make.sh: the new package would lack $need. Nothing was changed."; exit 1; }; done
ls "$ST"/code/*/*/BASE.txt >/dev/null 2>&1 || ls "$ST"/code/*/BASE.txt >/dev/null 2>&1 || { echo "make.sh: no in-flight code was found (worktrees missing?). Nothing was changed. If that is right, run with FORCE=1."; [ "${FORCE:-0}" = 1 ] || exit 1; }
if [ ! -d "$WT" ]; then
  if git rev-parse -q --verify "refs/remotes/origin/$BRANCH" >/dev/null; then git worktree add -q -B "$BRANCH" "$WT" "origin/$BRANCH" || exit 1
  else git worktree add -q --detach "$WT" HEAD && ( cd "$WT" && git checkout -q --orphan "$BRANCH" && git rm -rfq . ) || exit 1; fi
fi
new=$(cd "$ST" && find . -type f | wc -l); old=$(cd "$WT" && git ls-files | wc -l)
if [ "$old" -gt 0 ] && [ $((new * 10)) -lt $((old * 7)) ] && [ "${FORCE:-0}" != 1 ]; then
  echo "make.sh: the new package has $new files, the old one $old. Refusing to shrink it this much (FORCE=1 to override). Nothing was changed."; exit 1; fi
find "${WT:?}" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$ST/." "$WT/"; rm -rf "${ST:?}"
cd "$WT" && git add -A && if git diff --cached --quiet; then echo "package: nothing changed"; else
  git commit -q -m "Hand-over package: $MSG" -m "Agent: claude-b
$(cat "$H/trailer.txt" 2>/dev/null)" && echo "package: committed $(git rev-parse --short HEAD), $(git ls-files | wc -l) files, $(du -sh --exclude=.git . | cut -f1) (was $old files)"; fi
