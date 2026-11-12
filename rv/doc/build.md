# Track "doc" build log (claude-b, builder): L7 then L8

Worktree: $SP/rv/b-doc (detached, base fa2026e).
Ports: 9731-9739. Spec: ../spec.md (section 3, build-order rows L7 and L8).

## Resume note
This run found the worktree already made by an earlier run, with L7 edits uncommitted (reader compute, view, README,
module.test, DATA_MODEL `guesses` line) and no build.md. Nothing was committed. This run reviewed that work line by line
against the spec, kept it where it holds, fixed what did not, walked it on the phone, and committed it as L7.

## L7: Document reader, a pay stub fills and checks the 401(k), Roth part and match (commit aaed872)

Files: modules/ai/reader/{compute.js, view.js, README.md, module.test.mjs}, docs/DATA_MODEL.md (`workPlans.match` and
`.plan`: the reader is a new writer, no bump).

Kept from the earlier run: the three fields (k401 / roth401k / match) with skip patterns, `workRows`, `op: "work"`
proposals that make a missing row or a $0 account at use, the match always on the pay-the-tax-later row (D-C2) and moved
off a Roth row, the Roth-only stub's $0 offer, `firstMoney` skipping a rate, `firstDate` refusing a day that does not
exist, the `?kind=paystub&person=` landing, "How often are you paid?", one filled "Use it", the notice where it was tapped.

Changed in this run (after reading the screens):
- "Pay on the Income page: $72,000 a year instead of $72,000" and the same stub read twice offered five pointless
  "Use it"s: new `alreadyOnFile` (`same: true`), shown as "Already on file: ... Nothing to change." with no button.
- After the 401(k) row was used, the guess engine re-estimated the match on it ($1,920 a year, our guess) and the match
  card said "Now: $1,920 a year" as if typed: `before.guess` now reads "(our guess)", a guess is never "already on file",
  and every path a used figure writes drops its guess entry (`clearGuess`), so settle never moves it again.
- `workPlans[id].plan: true` when money going in is used (a stub with a 401(k) deduction shows a plan at work, so the L2
  card's work row appears even for a Roth-only stub); never for the $0 offer; the match answer left to the match line.
- "Found in it" showed $111 and $55 above proposals at $110.77 and $55.38: pay stub lines now to the cent.
- "Not found: roth 401(k)" lowercased a name: only the first letter is lowered, never "Roth" or "Social".
- New income for the unnamed first adult was "Me's pay" (and "My's pay" with no person): now "Your pay".
- The pay stub intro was 8 lines at 320 px with "Read it" below the fold: shortened, "Read it" now on the first screen.
- A plain arrival at #/ai/reader after a pay stub landing still said "Read your pay stub": it opens the general page now.
- The purity check caught the word "document" in a compute.js comment: reworded.

Tests: modules/ai/reader/module.test.mjs 15 of 15 (8 new: money/rate/dates; three lines read apart; Casey filled; no 401(k)
in either tap order; Roth-only $0 and moved match; whose 401(k); account numbers never kept; plan/match answers; "Your
pay"; already on file and guesses). With retirement/contributions and tests/guesses*.test.mjs: 92 of 92.
npm run check OK; leak guard OK (2867 files). npm run registry: 161 modules, registry.js unchanged.

Phone walk (kit, sandbox, port 9731; script rv/doc/l7walk.mjs, log shots/l7-log.json):
- Casey (noContrib), #/ai/reader?kind=paystub at 390 and 320, light and dark: "Read your pay stub", one filled "Read it",
  no census problems, no sideways scroll, no page errors. Shots: shots/l7-{390,390-dark,320,320-dark}-{landing,read}.png,
  shots/l7-320-landing-v2.png (after the shorter intro).
- Casey, every "Use it" in turn (shots/l7-390-use0..3.png): Income already on file (no button); withholding; 401(k)
  $110.77 every two weeks into Casey's plan at work; Roth 401(k) $55.38 into a new "Casey's Roth 401(k) at work" ($0);
  match $2,880.02 a year on the pay-the-tax-later row. Each notice sits where the tap was. workPlans {plan, match: true}.
  Plan JSON has no "6789". Same stub again: 0 "Use it", five "Already on file" (shots/l7-390-again.png). Contributions
  then lists both rows and "$2,880 from employers" (shots/l7-390-contributions.png).
- Dana & Lee (couple2k), ?kind=paystub&person=setup-partner, Lee's Roth-only stub: "Whose" is Lee; the $150-a-month row
  on file gets the $0 offer; Roth row made; match $1,560 a year on a $0 pay-the-tax-later row; no "4321" kept
  (shots/l7-lee-{390,320}-read.png, l7-lee-390-used.png).

Deviations from the spec:
- The card's "Read it from a pay stub ›" link lives in projection/view.js (L2, the retirement track's file): not touched
  here; this page answers the address. Noted in the README.
- Two pre-tax lines on one stub (a 401(k) and a separate catch-up line) read the first only; noted as an edge.

Try on a real iPhone: paste a stub copied from a PDF opened in Safari or Files. If the line breaks arrive as spaces, the
whole stub is one line and the 401(k) lines (which skip a line that says Roth, match or employer) may not be read: the
reader then says "Not found" for them and nothing wrong is proposed, but check how a real copy arrives. Also: the select
boxes ("How often are you paid?", "Whose") open the iOS wheel; the textarea at 16 px does not zoom.

## L8: OFX / QFX / QBO bank and card files in Import (Prompt: quick-ofx-import)

Prompt read first: prompts/quick/quick-ofx-import.md. Followed where it does not contradict the spec. Two places it does:
it asks for "the account id" back from the parser (the spec: never store the account number; `last4` only, shown once,
never saved) and for a branch, push and pull request (the track rules: one local commit, never push).

Files: new core/ofx.js (own reader, no dependency, no copied code; ofxtools never opened), new tests/ofx.test.mjs;
modules/transactions/import/{compute.js, view.js, README.md (status line and an OFX section), module.js (writes
`accounts`, purpose, aliases)}; docs/DATA_MODEL.md (`transactions[].extId`, `imports` currency/fileName); docs/RESOURCES.md
(Plaid's free Development tier ended 2024-06-20, Trial of 10 logins; ofx-js is bradenmacdonald/ofx-js, MIT, Apps Attic Ltd;
not used); transactions/connect module.js, README and catalog row purpose drop "or Plaid"; the catalog's Import row.

What it does:
- `isOfx` by content (OFXHEADER line, `<?OFX`, `<OFX>`), never by name; the picker's accept list is the spec's broad one.
- Bytes read with readAsArrayBuffer, decoded by the header's CHARSET (`decodeOfx`): 1252 through TextDecoder plus a
  0x80-0x9F map (WHATWG index-windows-1252), because Node's TextDecoder reads "windows-1252" as ISO-8859-1 (found by the
  test: a ’ came out as U+0092). Browsers decode it right; the map is a no-op there.
- One tree builder for SGML and XML (a tag with text is a leaf; a box when it is a known statement aggregate or the file
  closes it; else an empty leaf). Dates: the first 8 digits, time and zone ignored. TRNAMT keeps its sign. Entities decoded.
- Account numbers: only last4 leaves the parser; a FITID built from the account number has it replaced by "#"; the import
  record's file name has the digits replaced by XXXX. Tested: the plan JSON after three imports holds neither the full
  numbers nor their last 4.
- `prepareOfx` feeds `prepareRows` (rules, totals, `gapBefore`, `uncoveredDays`, `alsoOn`); `prepareImport` dispatches to
  it, so any caller gets OFX for free. `dedupe`: an `extId` is checked first within its account; same id = duplicate,
  another id = another line even with the same key; matches a no-id line with the same key one for one; no-id lines exactly
  as before (CSV unchanged; the existing 24 import tests pass unchanged).
- Account guess without the number: lines already held (>= half), else the only account of the kind, else the bank's
  name (FI/ORG) among several, else the person checks (amber line). Several accounts in a file: a select, one at a time.
- Balance: LEDGERBAL offered when newer than (or different on the same day as) the plan's; a card's is |BALAMT| owed and
  keeps the stored sign (`saveBalance`), the old figure kept as a point (`keepOnFile`), a guess on it dropped. With lines to
  add it is a ticked box under Import (one tap does both); with nothing new it is its own button.

Tests: tests/ofx.test.mjs 14 of 14 (detection; dates with zones; amounts and entities; SGML checking; XML card with
charges negative; two accounts and a missing </STMTTRN>; CHARSET 1252 bytes; into Import with the account guessed and
the balance offered; the gap check; duplicates by FITID, renamed line, CSV line, no FITID by key; two accounts one at a
time; the guess; the balance offer and its point; no account digits kept and the file name masked). With
transactions/*/module.test.mjs, tests/import-banks.test.mjs and tests/modules.test.mjs: 276 of 276. check OK; leak guard
OK (two comments in core/ofx.js first tripped the 9-digit rule: reworded; test dates are written in two parts and account
numbers are 8 digits or masked, so no allow entry was needed).

Phone walk (kit, sandbox, port 9733; script rv/doc/l8walk.mjs, files rv/doc/files from mkfiles.mjs, log shots/l8-log.json):
- Family fixture, 390: Prairie7351_Activity.qfx (1252, an é and a ’). Preview: "Your bank's download for Checking ending
  7351 (Prairie Bank): 10 lines ... No columns to check. The account number is not kept." "Chase checking is your only
  checking account, so it is picked above." Filled "Import 10 transactions", the ticked "Also set Chase checking's balance
  to $4,512.36, the bank's figure on 11/12/2026 (on file: $4,200.00)." (shots/l8-390-checking.png, -full.png). Import ->
  Categorize: "Added 10 transactions from PrairieXXXX_Activity.qfx. Chase checking's balance is now $4,512.36 as of
  11/12/2026. Now give them a category." (l8-390-categorize.png). Plan: 10 lines with extId, balance 4,512.36 as of 11/12,
  import record "PrairieXXXX_Activity.qfx", none of 40287351 / 7351 / 8642 anywhere. Same file again: 0 Import buttons,
  "Its lines are already on Chase checking", "Everything in this file is already on file. Nothing to do." (l8-390-again.png).
- Card file (XML .qbo) at 390 and 320, light and dark: Visa card picked ("your only card"), 5 lines, card charges money
  out with no flip; no balance offer (the plan's Visa balance is dated after the file's) (l8-{390,390-dark,320,320-dark}-card.png).
- Two accounts (320): "This file holds 2 accounts. Bring in" with "Checking ending 7351" / "Savings ending 9964"
  (l8-320-two.png). A file named "download" with no extension: read as OFX by content.
- Casey (phone-built), 320: "Checking is your only checking account"; balance unticked, import, then the same file shows
  "Everything in this file is already on file" and a filled "Update the balance to $4,512.36"; tap -> "Checking's balance
  is now $4,512.36 as of 11/12/2026." in view (the shell's echo) (l8-casey-320*.png).
- No sideways scroll anywhere, no page errors. Census: only "Use the pasted text: under the top bar" after the preview
  scrolls up (the CSV path's own bringUp scroll; the button is simply scrolled past, not covered while in use).
- Fixed after the first walk: the balance tick box sat on its own line centred above its words (class "field" is a column
  layout): now a plain flex label; its words shortened; the file-account options lost their "(1 line" tail at 320 px
  (count dropped from the option); the stats tiles touched the balance button: spaced.

Deviations from the spec:
- `last4` is shown in the preview line ("Checking ending 7351") each time the file is shown, never saved; the spec's
  "shown once" read as "shown, not kept".
- Several accounts in one file are brought in one at a time (pick the file again), not mapped all at once.
- Payees go through the existing `prettyPayee`, which drops non-ASCII letters ("CAFé LUNA" -> "Caf Luna", for CSV files too):
  not changed here because `normalizePayee` feeds every saved `key`; reported for the transactions/rules owner.
- OFX investment statements: said ("bring in a positions CSV on Holdings"), not read (spec: later, after claude-h).

Try on a real iPhone (Safari not walked: only Chromium is installed):
- Files app: pick a .qfx / .qbo / .ofx downloaded in Safari; check none is greyed out with the broad accept list, and that
  a file saved as "download" with no extension can be picked (it is read by content).
- readAsArrayBuffer + TextDecoder("windows-1252") on a 1252 file with an é or ’ in a payee.
- The balance tick box: 44 px row, tap on the words ticks it.
- Bank sites' real downloads: some send OFX 1.0.2 SGML with CRLF and no closing tags at all; some send the whole file on one
  line (both covered by tests, not by a real file).

## End of track
Commits on top of fa2026e, in order: aaed872 (L7), 6ce1c29 (L8). Whole `npm test` before the L8 commit: 189,285 tests,
188,643 pass, 0 fail, 3 skipped, 639 todo (2 min 36 s; the two speed tests passed first time). Leak guard over the commit
range (files and messages): OK. Servers started on 9731, 9732 and 9733 were each stopped by the kit's stop(); no process
was killed by pattern. CHANGELOG lines: rv/doc/L7.changelog, rv/doc/L8.changelog.
Left for others: the card's "Read it from a pay stub ›" link (L2, retirement track); OFX positions on Holdings (after
claude-h); `prettyPayee` dropping accented letters (transactions/rules owner); Safari not walked.
