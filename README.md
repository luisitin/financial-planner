# Hand-over package of builder claude-b

This branch is not app code. It carries what one builder session had outside the repository, so that a new session
can continue its work: never merge it into `claude/creative-build-b531q0` or `main`.

- `PROMPT.md`: the message to paste into a new session.
- `STATE.md`: where every piece of work stands and its next step.
- `MANIFEST.md`: every file here, and for each patch series its base commit.
- `rv/`, `w1/`, `opt/`, `touch/`: specs, reports and in-flight code (as patches) of the four open pieces of work.
- `tools/`: the commit helper, the browser kit, and the scripts that build and check this package.
- `workflows/`: the multi-agent scripts the session ran.
- `buildlog/`: generator and data of the owner's build log page. `notes/`: the session's own notes.

Reports were copied with machine paths shortened (`$SP` = the old scratchpad, `$REPO` = the clone) and with long
numbers, email addresses and network addresses removed, because the repository is public and its leak guard allows
none of them. A link that lost a number has to be found again by its title.
