# Hand-over package of builder claude-b

This branch is not app code. It carries what one builder session had outside the repository, so that a new session
can continue its work. Never merge it into `claude/creative-build-b531q0` or `main`.

- `PROMPT.md`: the message the owner pastes into a new session. Start there.
- `STATE.md`: where every piece of work stands and its next step.
- `unpack.sh`: run once in the new session. It rebuilds the old session's working layout in the new scratchpad.
- `MANIFEST.md`: every file here, and for each piece of in-flight code its base commit.
- `sp/`: a mirror of the old scratchpad's reports, specs, tools and notes, same relative paths.
- `code/`: in-flight code, one folder per worktree: `BASE.txt`, `commits/*.patch`, `uncommitted.diff`.
- `workflows/scripts/`: the multi-agent scripts the session ran.

What was changed on the way in, because the repository is public and its leak guard allows none of it: machine
paths became `$SP`, `$REPO` and `$CLAUDE_PROJECT` (in reports and in scripts; `unpack.sh` puts real paths back into
the scripts); long numbers, email addresses and network addresses were removed from reports (a link that lost a
number has to be found again by its title); model names were removed. Pictures and large data files are not here.
