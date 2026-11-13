# Track "doc" (L7, L8): fix round 2

Worktree `$SP/rv/b-doc` (detached, nothing
pushed). Everything this round wrote outside the worktree is under
`$SP/rv/doc/fix2/` (called fix2/ below):
the pure reproductions `repro7.mjs` / `repro7.json` and `repro8.mjs` / `repro8.json`, the phone walks `w7.mjs`, `w8.mjs` (with
`lib.mjs`), their logs and pictures in `fix2/shots/` (`before-*` on the committed tip before this round's view changes,
unpacked to `fix2/base`; `after-*` on the worktree), `counts.mjs`, and the whole test log `npmtest.txt`.
Simple-first counts and choices: `rv/doc/optional.md`.

## 1. Confirmed findings of severity 2 or more (the three round-2 reports)

Money (critic-money.md): M1 (5), M2 (5), M3 (4), M4 (4), M5 (4), M6 (3), M7 (3), M8 (3), M9 (3), M10 (2), M11 (2), M12 (2),
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

Each line: the finding, what the critic saw, what the rebased build does with the same file and plan (`repro8.json`), and
the test. "Fixed" means fixed by fix round 1's edits, now inside L8; "fixed this round" means the rebased build still
showed it and this round changed it.

- **M1 = P1a = B2 (5)** card file, plan with no card. Saw: into "Jamie's plan at work", balance ticked to -6,522.17, net
  worth 37,000 to 478, Undo left it. Now: no account guessed, no account of another kind offered (`options: []`), no
  balance offer, the 401(k) untouched; the page says "You have no card on your plan yet. Add it, then choose the file again.
  Nothing has been brought in." with "Add this card". Not reproduced: fixed. Test: "M1 /
  P1 / B2: a file never goes to an account of another kind ...". B2's variants (only a 401(k) on the plan, a checking
  file; a credit-line file on the family plan) give no account and no offer, or only the card and loan lines as choices.
- **P1b (5)** three cards. Saw: "This goes to Checking", ticked. Now: no guess, chips "Visa card", "Mastercard", "Store card"
  (walked: `after-i-riley-card-*`). Fixed. Test: as M1.
- **P1c = N1 (4)** an account picked by hand or given by the page (`?accountId=`). Saw: no word, ticked "set Savings to
  4,512.36" / "set Visa to 4,512.36 owed" / the mortgage. Now: a file of another kind is said ("This file is from a
  checking account (ending 7351). Visa is not a checking account. Pick the account it belongs to."; picked by hand: "This
  file says it is a checking account; Savings is another kind of account. Check it is the right one. Its balance is left
  alone.") and its balance is never offered there (`otherKind` / `mismatch`, offer null); "Bring it in to Visa anyway"
  waits under More options. Fixed. Test: "P1c / N1: a
  checking file on the savings account or the card the page was opened for ...".
- **P1d (5)** Get started's one "Credit cards" line. Saw: ticked "set Credit cards to 6,522.17 owed". Now: goes there, the
  balance offered but not ticked (`lump`). Fixed. Test: "P1d: Get started's one 'Credit cards' line ...".
- **M4 (4)** Prairie Bank file, the only checking is at Chase. Saw: picked, ticked 4,512.36. Now: not guessed; said
  ("This file is from Prairie Bank; Chase checking is at Chase. Is it this account?") with the account as a chip; picked by hand, the
  balance is offered unticked. Fixed. Test: "M4: another bank's file ...".
- **B1 (4)** savings file after a checking file whose line ids repeat. Saw: went to checking, ticked 11,703.12. Now: no
  guess from ids alone (an id counts only with the same amount and about the same day), 0 lines hidden. Fixed. Test: "B1 /
  M10: a line id counts only with the same amount ...".
- **B3 (3)** two checking accounts in one file. Saw: both onto the plan's only checking. Now: neither guessed; the file's
  accounts are listed ("Checking ending 7351", "Checking ending 1234") to pick. Fixed. Test: "B3: two checking accounts
  in one file ...".
- **M8 (3)** the CSV, then the QFX of the same days. Saw: 2 lines added again (Amazon, Transfer Sav). Now: 0 added, 10
  skipped (a NAME cut at 32 characters still matches). Fixed. **M9 (3)** same lines, new ids: saw 10 added; now 0 added,
  10 skipped. Fixed. Test: "M8 / M9: lines from a CSV are not added again ...".
- **M10 (2)** every FITID "0". Saw: 1 added, 3 skipped, in $0. Now: 4 added, in 2,310.55, out 1,542.70. Fixed. Test: "B1 /
  M10".
- **M11 (2)** card in credit (charges negative, balance +25.17). Saw: ticked "set Visa to $25.17 owed". After round 1 the
  critic's 12-line file was asked, but **reproduced** for a short file: a two-line card file (one charge, one payment)
  was neither asked nor said (the rule wanted most lines to be charges). Fixed this round: `balanceOffer` asks ("credit")
  when the file is a card's, the balance is above 0 and at least half its lines are money out (or it has none); never
  ticked. Test: "M11: a card file whose charges are negative ..." (now with the two-line file, asked, and a file with
  flipped signs, not asked).
- **M15 (2)** monthly files 07, 08, 09, then 10. Saw: "Anything on 9/28 to 10/8 is missing". Now: no gap; the file's own
  DTSTART/DTEND (10/1) are used. Fixed. Test: "M15: the days a file covers ...".
- **N5 = B5 (3)** account number with dashes in the file's name, in NAME, MEMO, FITID. Saw: kept and shown. Now: file name
  "XXXX_activity.qfx", payees "XFER FROM CHK ...", "INTEREST TO ...", ids one-way (`27zlk91rb94ph`), no run of 4 or more
  of the account's digits anywhere in the plan. Fixed. Test: "B5 / N5: no account number is kept ...".
- **M1 (Undo part) = P5 = B4 (3)** Undo after a ticked balance. Saw: Checking stayed 4,512.36, nothing said. Now: Undo asks
  "... and put Checking's balance back to $6,000.00 (11/11/2026)?" and does it (figure, date, that day's point, a guess).
  Fixed. Test: "M1 / P5 / B4: Undo of an import puts back the balance it set ...". Walked: `after-i-P5-*`.
- **B6 (3)** file cut short. Saw: a fourth line "(no description) -$14.00", no warning. Now: `complete: false`, the half
  line dropped, the notice "This file looks cut short ..." and the balance not offered. Fixed. **N6 (2)** odd lines, CDATA,
  no closing tags. Saw: "2 lines", ticked, no word; "(no description)"; 0 lines. Now: 4 lines that could not be read are
  counted and said (and in "See the lines" summary), no tick; "STREAMING & MORE", "HOME <GARDEN> CENTER"; the file
  without closing tags reads its 2 lines. Fixed. Test: "B6 / N6: a file cut short ...".
- **N7 (2)** DTASOF tomorrow in GMT; next year. Saw: 11/13/2026; 11/12/2027. Now: today (11/12) and no offer. Fixed. Test:
  "N7: a balance dated tomorrow ...".
- **P15 (2)** Import opened on the long way round. Now: one filled "Choose the file" with the Quicken/QuickBooks hint, the
  account asked only for a CSV or when the file cannot tell, pasting under "More options", the balance choice above the
  Import button. Fixed in round 1; walked (`after-i-landing-*`).
- **P16 (1)** words on the preview: one date range, no "No columns to check", "Set the balance of Savings to ...", "the
  only card line in your plan", "transactions" on both line and button, the second account of a two-account file named on
  return. Fixed; walked (`after-i-two-*`, `after-i-dana-prairie-*`).
- **M17 (1)** docs/RESOURCES.md cited Plaid's free tier to a page that does not state it. Now: "What is free is a Trial of
  10 linked logins for life (plaid.com/docs/account/billing, read 2026-11-11: "You can create 10 Production Items on a
  Trial plan")". Fixed this round (docs only).

### L7 (Document reader)

Same form; the stubs are the critics' own (`rv/doc/p2/stubs/*.txt`, `b2/`, `money/`), the plans the phone-built ones.

- **M2 (5)** a catch-up line dropped. Saw: Robin's 401(k) $107.69 only ($2,800 a year, not $7,200); the Roth pair $200
  ($5,200, not $10,600). Now: 273.84 (both lines summed, $7,120 a year) and 407.69 ($10,600); the card says the parts
  ("$107.69 + $166.15 catch-up"). Fixed. Test: "M2: every line of a kind is added ...".
- **M3 (4)** one stray word sets the pay rhythm. Saw: "Monthly Transit Pass" made a biweekly stub monthly; "Bi Weekly",
  "Semi Monthly", "Standard weekly hours 40.00" misread; 02/16-02/28 read as every two weeks. Now: the period's dates win
  (biweekly, biweekly, semimonthly, biweekly, semimonthly), and "How often are you paid?" is a box on the stub's fold
  ("Change"). Fixed. Test: "M3: how often the stub pays ...".
- **M5 = P3 = B10 (4)** minus signs and brackets. Saw: only the match offered. Now: 401(k) 110.77, Roth 55.38, match
  110.77, federal 231.40 (minus layout); Casey's ADP stub 166.15 / 83.08; "(110.77)" read as 110.77. Fixed. Test: "M5 /
  P3 / B10 ...".
- **M6 (3)** "HSA ER Match" above "401(k) ER Match". Saw: match $25.00 ($650 a year). Now: 73.85 ($1,920.10 a year). Fixed.
  Test: "M6: another benefit's employer line ...". **N3 (3)** "Charity Matching Gift": saw a $650 match; now no match.
  Fixed (same test and "M14 / N3 / B9").
- **M7 = P2 (4)** Lee's stub with no person picked. Saw: read as Dana's, the filled "Use it" set Dana's pay to $52,000.
  Now: Lee's (her pay matches), said in one line ("This looks like Lee's pay stub, paid every two weeks: ... Change it
  above if that is wrong."); when neither pay matches and no name is on it, "Whose pay stub is this?" chips and nothing
  changes. Fixed. Test: "M7 / P2: whose stub it is ...".
- **P4 (3)** no period on Dana's stub. Saw: every two weeks (pay $84,500, 401(k) $5,070). Now: twice a month, because
  $3,250 x 24 is her $78,000 on file (said); her bonus paycheck ($126,000 a year) is flagged as unlike her usual pay. Fixed.
  Test: "P4: a stub that does not say how often it pays ...".
- **P7 (3)** a stub pasted as one line. Saw: only the match. Now: Dana 195 / 97.50 / 262.50; Casey 110.77 / 55.38 / 110.77.
  Fixed. Test: "P7: a stub pasted as one line ...".
- **P9 (2)** Casey, no 401(k) line. Saw: "Not found: ...", nothing about the 401(k). Now: a card "This pay stub shows no
  money going into a 401(k). That matches what is on file ($0)." with "See what putting some in would do"; Jamie with $250
  a month on file is told the stub has no line and where to check. Fixed. Test: "P9 / M12 ...".
- **P14 (2) and M12 (2)** Lee's Roth-only stub. Saw: two cards ("none on this stub" $0 and a new Roth row); using one
  counted the saving twice ($3,600 against the stub's $1,800). Now: one card asks "Is it the same money?", with "Yes, it is
  the same money" ($6,880 a year in all) and "No, both go in" ($8,680), neither filled; what each does is under "What each
  answer does". With two own-money lines the stub's total and the plan's are said in one line, in amber once a card was
  used and they still differ. Fixed. Tests: "a Roth-only stub: ONE card asks ...", "P9 / M12 ...".
- **M14 = N3 = B9 (2-3)** the wrong line's dollars. Saw: wages first ($2,769.23 as the 401(k)), "401(k) 4.00 110.77" as $4,
  "4% of 2,769.23" as 2,769.23, a share-only line taking the net pay under it, a heading taking Medical under it, a surname
  "Roth" as a Roth line, a year-to-date-only line offered as $67,202 a year. Now: 110.77 in each; the share-only line is
  said as unread with a box to type it; the YTD-only line is said as unread ("may be the year-to-date total. It is not
  used.") and a lone figure as big as the paycheck is offered only as a doubt ("This looks like the wrong line", no
  filled button, "Set my own number"). **Reproduced this round** for one more surname case, a business name in capitals
  ("ROTH & SONS FREIGHT Check 10443.00" read as $10,443 of Roth a paycheck): fixed this round, a line that starts with
  "Roth" counts only when the plan's words follow or the amount comes right after "Roth" and its own words (`ROTH_ONLY` in
  compute.js). Test: "M14 / N3 / B9: the dollars of the wrong line are never offered ..." (six "Roth" layouts that must
  still read, and the business name that must not).
- **N2 (4)** TSP, 457(b), "Retirement Plan". Saw: the plan's line not read, "none on this stub" offered $0 for the $250 a
  month on file. Now: read (110.77 / 55.38 / 98.46). Fixed. Test: "N2: TSP, 457(b) ...".
- **N4 (3)** a "Work 401(k)" with no owner (Net worth's "Joint or shared"). Saw: a second 401(k) made. Now: the stub's
  401(k) goes into "Work 401(k)", and using it makes it Riley's. Fixed. Test: "N4: a 401(k) nobody owns ...".
- **B8 (3)** Ana's second job. Saw: "Now $470, would be $60", pay 101,400 to 31,200. Now: the clinic's stub goes to the
  clinic's 403(b) row and pay line ("same"), the tax taken out says the plan keeps one figure for two jobs; a job box asks
  which job when the stub cannot tell. Fixed. Test: "B8: a second job's stub ...".
- **B11 (2)** no adult on the plan. Saw: every re-read added another "Your pay". Now: no proposals, "Add yourself on People
  first", one "Add yourself" button. Fixed. Test: "B11: with no adult on the plan ...".
- **P6 (3)** the next filled "Use it" slid under the thumb after a use. Now: the used card stays where it was (a used
  change keeps its place, it never moves into or out of the fold), and the next filled button is the next plain change in
  the order shown. Walked: `after-r-casey-used-*`.
- **B7 (3)** after "Use it", changing Whose or the pay rhythm showed the other card as "Done.". Now: a use is remembered
  for the stub, person and rhythm it was made with; changing either shows the cards fresh. Walked (w7 "b7").
- **P10 (2)** the "saved" note at 60% strength: now a full-strength `notice ok` inside the used card. Walked.
- **P11 = B13 (2, 1)** "Now: X. Would be: X ... instead of X": a used card now reads "Was: ... Now: ..." from the change
  as tapped. Walked.
- **P12 (2)** after the last change, nothing said what it did: each saved note names the page that shows it, and "See if
  the money lasts" follows any 401(k) or match change. Walked.
- **P13 (2)** at 320 px, "Read it" changed nothing visible: the changes now come to the top of the screen once after
  reading, and the pasted text folds away below them. Walked at 320 (`after-r-casey-read-320*`).
- **P8 (3)** nothing leads to the pay stub page: this track added the words people search with (pay stub, payslip,
  earnings statement, ...) to the reader's aliases. The links from "What you save for retirement" and "Will the money
  last?" are in the retirement track's files (not this lane); named for that track in the hand-back.
- **M13 (2)** a Roth 401(k) row the reader makes keeps going after the job's pay ends: the row is written like every other
  contribution row; when it stops is the projection's rule (`modules/retirement/projection/compute.js`, claude-c's lane).
  Not changed here; the README says so and it is named in the hand-back.
- **M16 (1)** pay and tax cards in whole dollars: cards now show cents as printed ("$231.40 every two weeks"). **P17 (1)**
  dates as the app writes them, "Read Lee's pay stub", "Lee's federal tax taken out of each paycheck", "Our guess, made
  when you added what goes in". **B12 (1)** "Not found" items joined with "; ". **N8 (1)** a pasted stub not read yet
  survives Back and Forward (kept in the module's draft, never saved). All walked or read in `after-w7-log.json`.

### Found on the way (not in the three reports)

- **L8 wording**: the whole test run failed `tests/wording.test.mjs` ("no British spelling ... in the words on screen") on
  L8's "tick it only if this is your only card" (US English says check / uncheck a box). Now "do this only if it is your
  only card." (the sentence serves the box and the "Update the balance" button). Test: the wording test, 8/8.
- **L8 two folds named "More options"** on one screen (the landing's and the one holding "Bring it in to Visa card
  anyway"): the second is now named for what it holds, "It does belong on Visa card" (README and a test comment follow).
- **Seen, not changed (L7, the statement path, older than this track)**: an account statement dated 9/30 is offered with
  the filled "Use it" over a balance on file dated 11/12, and using it replaces the newer figure (its date too). The
  reader's first test ("proposals against the plan, and applying them") asserts exactly that, and a figure dated today is
  often only the day it was typed in Get started, so whether an older statement should replace it, or only join the
  account's history the way Import refuses an older bank balance, is a decision for the owner, not a fix for this round.
  Walked: `after-r-statement-390-full.png`.

## 5. Simple first

See `rv/doc/optional.md`.

## 6. Checks

On the final commits (L7 449a4d5, L8 9d34f08 on 707355c), worktree clean:
- `npm run registry`: 161 modules, `modules/registry.js` unchanged.
- Touched modules' tests: reader 28/28, import 14/14, ofx 27/27, import-banks and the wording tests green.
- Whole `npm test` (`fix2/npmtest-final.txt`): 189,456 tests, 188,816 pass, **0 fail**, 3 skipped, 637 todo. The run
  before it (`fix2/npmtest.txt`, with the phone walks running beside it) had 2 failures: the known speed test "takes well
  under 1.5 s" (load; green on the final run) and the wording test on L8's "tick it" (fixed, section 4).
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,881 files (and on each commit's staged files).
- `tests/golden/**` unchanged against 707355c. CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md untouched; the lines are in
  `rv/doc/L7.changelog` and `rv/doc/L8.changelog`.
- Phone walks (sandbox only, ports 9731-9734, every server stopped, ports free at the end): `w7.mjs`, `w8.mjs`,
  `past.mjs`, `visa.mjs`; 390 and 320 px, light and dark; no page errors, no sideways scroll on any screen.

Only Chromium is installed. To try on the real iPhone: the file picker offering .qfx / .qbo / .ofx downloads (and the
"download" file name kept as XXXX); a windows-1252 file through Safari's TextDecoder; the balance box's label tap and its
44 px row; a pay stub pasted from a PDF in Safari (line breaks, the Unicode minus, brackets); the select wheels for "How
often are you paid?" and the account; the page scrolling itself to the changes after "Read it"; folds staying open after
"Use it" or Undo redraws the page; the keyboard over the paste box at 320 px.

## 7. Commits

- L7 Document reader: **449a4d5** "Document reader: a pay stub fills and checks the 401(k), Roth part and match"
- L8 Import: **9d34f08** "Import: the bank's Quicken or QuickBooks file (OFX, QFX, QBO), no columns to check"
  (keeps "Prompt: quick-ofx-import")

Each is one local commit on 707355c (this round's changes folded in with `--fixup` and
`GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c`), each message now ends with a "Review fixes" paragraph naming
what the two critic rounds changed, then exactly the Agent / Co-Authored-By / Claude-Session lines. Nothing pushed.

Not this track's files (named for the hand-back): M13, when a Roth 401(k) row stops (the projection, claude-c's
`modules/retirement/projection/compute.js`); P8's links to the reader from "What you save for retirement" and "Will the
money last?" (the retirement track); the statement path's older-balance question (section 4, a decision for the owner).
