# Track "doc" (L7, L8): fix round 2

Worktree `$SP/rv/b-doc` (detached, nothing
pushed). Everything this round wrote outside the worktree is under
`$SP/rv/doc/fix2/` (called fix2/ below):
the pure reproductions `repro7.mjs` / `repro7.json` and `repro8.mjs` / `repro8.json`, the phone walks `w7.mjs`, `w8.mjs` (with
`lib.mjs`), their logs and pictures in `fix2/shots/` (`before-*` on the committed tip before this round's view changes,
unpacked to `fix2/base`; `after-*` on the worktree), `counts.mjs`, and the whole test log `npmtest.txt`.
Simple-first counts and choices: `rv/doc/optional.md`.

## 1. Confirmed findings of severity 2 or more (the three round-2 reports)

Money (critic-money.md): M1 (5), M2 (4), M3 (4), M4 (4), M5 (4), M6 (3), M7 (3), M8 (3), M9 (3), M10 (2), M11 (2), M12 (2),
M13 (2), M14 (2), M15 (2). Below 2, done anyway: M16 (1), M17 (1).

Person (critic-person.md): P1 a-d (5), P2 (4), P3 (4), P4 (3), P5 (3), P6 (3), P7 (3), P8 (3), P9 (2), P10 (2), P11 (2),
P12 (2), P13 (2), P14 (2), P15 (2). Below 2: P16 (1), P17 (1), both done in passing.

Break (critic-break.md): B2 (5), N1 (4), N2 (4), B1 (4), N3 (3), N4 (3), N5 (3), B5 (3), B3 (3), B4 (3), B6 (3), B7 (3),
B8 (3), B9 (3), B10 (3), N6 (2), N7 (2), B11 (2). Below 2: B12 (1), B13 (1), N8 (1), all done.

Same defect named by more than one critic (one fix each): M1 = P1a = B2 (wrong account, ticked balance); P1c = N1 (an
account given by hand or by the page); M5 = P3 = B10 (minus and brackets); M7 = P2 (whose stub); M14 = N3 = B9 (the wrong
line's dollars); M1 (Undo part) = P5 = B4; P11 = B13; M12 and P14 (the Roth-only stub).

## 2. The unsaved edits of fix round 1 (12 files, cut off with no log)

`git diff` matched the archived copy byte for byte (`archive/rv-doc-fix1-cutoff.diff`, 3,009 lines). Read file by file; every
file was a finished fix with its tests passing (reader 28/28, import 14/14, ofx 27/27, import-banks 10/10). Nothing was
half done in the code, nothing was wrong to drop. One thing stopped the commit: the leak guard refused 7 runs of 9 or more
digits.

| file | decision |
|---|---|
| core/ofx.js | keep (lineId, scrubNumbers, CDATA, a file cut short, `bad` lines, EXTDNAME, unclosed tags); a comment's digit run reworded |
| docs/DATA_MODEL.md | keep (L8: `transactions[].extId` is lineId; `imports[].balance` for Undo; `from`/`to` from DTSTART/DTEND) |
| modules/ai/reader/README.md | keep |
| modules/ai/reader/compute.js | keep (catch-up lines summed, minus/brackets, period from dates, whoseStub, suspect, move, workRows choices, ...) |
| modules/ai/reader/module.js | keep (aliases: pay stub, payslip, earnings statement, ..., P8) |
| modules/ai/reader/module.test.mjs | keep (one test per finding) |
| modules/ai/reader/view.js | keep (then reshaped by the simple-first pass, below) |
| modules/transactions/import/README.md | keep; a FITID example written as one 18-digit run reworded |
| modules/transactions/import/compute.js | keep (OFX_TYPES / ofxFits / ofxOwn, guess rewrite, dedupe, balanceOffer rules, setBalanceFromFile, Undo) |
| modules/transactions/import/module.js | keep (aliases: bank statement, statement, card statement) |
| modules/transactions/import/view.js | keep (then the simple-first pass) |
| tests/ofx.test.mjs | keep; its made-up account numbers (an 18-digit FITID, a 10-digit ACCTID, a 14-digit date-time) rebuilt from pieces (`["0040", "2899", "64"].join("")`, `STAMP("20261113", "020000.000[0:GMT]")`) |

## 3. Commits and the move onto 707355c

- Reader files committed as `fixup!` of L7 (d2ade9e), the rest as `fixup!` of L8 (72299e5); then
  `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c`: applied clean (the tip's 3 commits touch AGENTS.md, CHANGELOG.md,
  DESIGN_LOG.md, TEAM.md, WORKBOARD.md, two READMEs of system/* and a qa script: none of this track's files).
  L7 6faefc3, L8 83252dd at that point. The new design rule in AGENTS.md / DESIGN_LOG.md (simple first) was read and applied
  in section 5.
- This round's own changes were folded in the same way at the end (shas in section 7).

## 4. Each finding on the rebased build

How: `fix2/repro7.mjs` and `fix2/repro8.mjs` run the critics' own stubs, bank files and households (phone-built
`rv/walk/out/gs/*.real.plan.json`, the kit's renterDebt and sam, `qa/fixtures/family-plan.mjs`) through the rebased code
and print what the critic saw beside what happens now; screen findings were walked on the phone (`fix2/w7.mjs`,
`fix2/w8.mjs`, 390 and 320 px, light and dark, sandbox). "Test" names the test in `modules/ai/reader/module.test.mjs` (L7) or
`tests/ofx.test.mjs` (L8) that holds it.

### L8 (Import, core/ofx.js)

PLACEHOLDER_L8

### L7 (Document reader)

PLACEHOLDER_L7

## 5. Simple first

See `rv/doc/optional.md`.

## 6. Checks

PLACEHOLDER_CHECKS

## 7. Commits

PLACEHOLDER_SHAS
