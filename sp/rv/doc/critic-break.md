# Break critic, round 2: track "doc" (L7 aaed872, L8 6ce1c29), checked 2026-11-12

The track's head has not moved since the first break pass (still 6ce1c29), so nothing from that pass is fixed yet. This
round did two things: it ran every earlier finding again (all 13 still happen), and it attacked from new angles (8 more
findings). 21 findings in all: one at 5, three at 4, eleven at 3, three at 2, three at 1.

**Where everything is.** All paths below are under
`$SP/rv/doc/`.
- New scripts, files and logs: `b2/` (pure attacks `a1.mjs` to `a6.mjs`; walks `w1.mjs` to `w7.mjs`; invented bank files
  `b2/files/`; shots and logs `b2/shots/`, `w1-log.json` to `w6-log.json`).
- The first pass, kept as it was: `b2/critic-break.round1.md`. Its six walks, run again today: `b2/r1/` (logs
  `r1-log.json` to `r5-log.json`, `r6.out`, and the shots).

**How it was run.** My own detached copy of 6ce1c29 (`rv/v-doc-break`), served on ports 9761 to 9769, sandbox only, with
the kit, at 390 px light and 320 px dark. The copy is removed. Every server was stopped by the kit's `stop()`; the nine
ports answer nothing now; nothing was killed by pattern. The builder's worktree was only read. All households, banks,
names and numbers are invented.

**Not in this track.** A leftover answer when spending rises (L4) and a split then Undo (L6) belong to other tracks.
Import's Undo stands in for "then Undo" here (B4).

## What holds (checked, no finding)

- **Nothing throws, every figure finite.** The first pass's sweep, run again: 1,451 plans (every qa fixture, the
  personas, every qa/households archetype with every pack, the 5 phone-built households, the empty plan, 10 odd plans)
  through `reader.compute`, every `applyProposal`, `prepareImport`, `prepareOfx` for every file account and
  `applyBalanceOffer`: 67,917 runs, 0 throws, 0 non-finite figures, inputs deep-frozen. The 102 notes it prints are all B11.
- **New files and stubs.** 21 new bank files and 25 new stubs through the pure functions: nothing throws.
- **Odd plans on screen** (`b2/w5.mjs`, `b2/w5.out`): 14 plans (blank, Sam finished and mid-setup, a retired couple, a
  retiree, a freelancer, Morgan with only an IRA, Robin, a birth year of 19800, no pay, no accounts, a $1e12 row, all
  zeros, Lee removed after the reader made Lee's Roth account) at 390 px light and 320 px dark. Each: paste a stub, tap
  every "Use it", then open What you save for retirement, Will the money last?, Net worth, Income, Dashboard and Import
  with a QFX. 0 page errors, 0 console errors, no "NaN", "undefined", "Infinity" or "null" on any screen, no sideways
  scroll.
- **Double taps at 120, 250, 400 and 700 ms** (`b2/w3.mjs`, `b2/w4.mjs`):
  - each of the four "Use it" buttons of a full stub: one change each, 2 rows and 1 new account every time;
  - the "none on this stub" card, which disappears once used, at 6 phone widths (344 to 430 px) and 2 households: the
    second tap lands on the next card's text, never on its button;
  - "Import 10 transactions" (8 runs): 10 lines, 1 import record, the second tap lands on Categorize's text and files
    nothing;
  - "Read it" and "Clear": no error. After "Clear" the second tap lands in the paste box (the keyboard would open).
- **Back, reload, the same answer twice** (`b2/shots/w3-log.json`, backReload): Back then Forward after "Read it" and one
  "Use it" keeps the text and the cards. Reload clears the text and keeps the change. The same stub read and used again
  gives five "Already on file" cards, no second row, no second account.
- **A "No match" answer is respected.** Jamie, a stub with a 401(k) line and no match line, "Use it": the match stays $0
  and no guess is written (`w6-log.json`, jamieNoMatch).
- **Speed.** A 20,000-line QFX: 543 ms new, 814 ms when all 20,000 are on file (Node). A 1.7 MB paste: 15 to 27 ms.
- **Files that are not bank files.** UTF-16, a root written `<OFX xmlns=...>`, header only, empty: a plain "not a bank
  file" or "no bank or card lines" message, no crash.
- **Account numbers after import** (`b2/a6.mjs`): 30 files imported in full, the saved plan searched for each ACCTID as
  written, digits only, without leading zeros and every tail of 6 or more digits. 26 clean; 4 not (B5, N5).

## Findings (most severe first)

IDs starting with B are from the first pass and were run again today (`b2/r1/`). IDs starting with N are new.

### B2 (5) L8: a file with no guess goes to the first account in the box, whatever it is, with a ticked box that overwrites its balance
Raised from 4: this round it put a checking file into a 401(k).

**Steps (new).** A plan with people and pay and no accounts → Import says "First, add the account this file comes from"
→ instead open Document reader, paste a stub, "Use it" on the 401(k) card (it makes "Ana's 401(k) at work") → Import →
pick `files/Prairie7351_Activity.qfx`.

**Evidence** (`b2/shots/w6-checking-into-new-401k-390.png`, `-320-dark.png`; `w6-log.json`):
- Import no longer asks for an account: the reader's new 401(k) is the plan's only account.
- "Check the account above: Checking ending 7351 could be more than one of your accounts. This goes to Ana's 401(k) at
  work." The plan has no checking account at all, so the sentence is untrue.
- Filled "Import 10 transactions", ticked "Also set Ana's 401(k) at work's balance to $4,512.36 ... (on file: $0.00)".
- After one tap: Ana's 401(k) at work is $4,512.36 and holds 10 bank lines.

**Still true from the first pass** (`b2/r1/r5-log.json`, `c1-card-default-390.png`): the family plan with two cards and
the card file → "This goes to Chase checking", ticked "-$6,522.17", Chase checking ends at -6,522.17 with the card's 5
lines. Also new: a credit-line file → Chase checking, ticked "-$18,250.00" (`w2-log.json`, heloc).

**Fix.**
- With no guess, pick nothing: the account box shows "Pick the account this file is for", accounts of the file's kind
  first, and Import waits for a pick.
- No account of the file's kind in the plan: "This file is from a checking account, and your plan has none yet" with
  "Add the account" (the page's own first-step card), not a notice.
- `balanceOffer` returns null when the plan account's type is not in `OFX_TYPES[file kind]`.
- Tick the balance only when the guess is "holds" or the person picked the account.
- Test: no checking account in the plan and a checking file → no target, no offer.

### N1 (4) L8: opened for one account, Import puts any file there without a word, and the ticked box sets a card to the checking balance
**Steps.** Family plan → `#/transactions/import?accountId=a-visa` (what "Bring in the Visa file ›" opens from Monthly
review, Our guesses, Budget and Spending) → pick the checking download `files/Prairie7351_Activity.qfx` (the two
downloads sit side by side in Files).

**Evidence** (`b2/shots/w2-visa-asked-390.png`, `w2-visa-asked-320-dark.png`, `w2-visa-asked-390-after.png`;
`w2-log.json`, visaAsked):
- The preview says "Your bank's download for Checking ending 7351 (Prairie Bank): 10 lines" and nothing else: no notice,
  no line naming the account it goes to.
- Filled "Import 10 transactions", ticked "Also set Visa card's balance to $4,512.36 owed ... (on file: $6,400.00 owed)".
- After one tap: Visa card is $4,512.36 owed, its history is [11/12: 4,512.36] (the $6,400 is gone), and the card holds
  two paychecks of +$2,310.55 and the rent.
- The same happens after the account box is changed by hand for one file and another file is then picked: the card file
  goes to Ally savings, no notice (`w2-sticky-pick-390.png`; `w2-log.json`, stickyPick).
- Pure check (`b2/a2.mjs`): with an account given, the checking file offers $4,512.36 onto the mortgage ($265,000), the
  house, the 401(k) and the car loan alike.

**Cause.** `prepareOfx(..., { accountId })` skips the guess, and the view's notices all sit inside `if (!picked)`.
`picked` is never reset when a new file is chosen.

**Fix.**
- Check the kind on every path: when the picked account's type is not in `OFX_TYPES[file kind]`, show "This file is from
  a checking account (ending 7351). Visa card is a card. Pick the account it belongs to." and make Import wait.
- For the person who is sure, one quiet outlined "Bring it in to Visa card anyway" under a "More options" fold.
- Never offer a balance across kinds (as in B2).
- Reset `picked` to `!!asked` when a new file is chosen or text is pasted.
- Always name the target: "This goes to Visa card." above the Import button.
- Test: `?accountId=a-visa` and the checking file → no Import until an account is picked, no balance offer.

### N2 (4) L7: a stub that calls the plan TSP, 457(b) or "Retirement Plan" is told it has no pay-the-tax-later line, and the page offers to set the saving on file to nothing
**Steps.** Jamie (noMatch: $250 a month on file) → `#/ai/reader?kind=paystub` → paste a federal stub with "TSP 110.77",
"Roth TSP 55.38" and "TSP Agency Match 98.46" (`b2/files/stubs.json`, tsp) → "Read it".

**Evidence** (`b2/shots/w1-tsp-390.png`, `w1-tsp-320-dark.png`, `w1-tsp-390-zero-is-filled.png`,
`w1-tsp-390-contributions.png`; `w1-log.json`, tsp-390):
- "Not found: 401(k), pay the tax later." The TSP line is not read at all.
- A card: "Jamie's 401(k), pay the tax later: none on this stub. Now: $250.00 every month. This pay stub has a Roth
  401(k) line and no line for money you pay the tax on later, so it would be nothing." The stub has that line.
- After "Use it" on the withholding card, this card's "Use it" is the screen's one filled button.
- After every card is used: "Jamie's plan at work: $0", "Jamie's Roth 401(k) at work: $55.38". Own money on file goes
  from $3,000 a year to $1,440; the stub shows $166.15 a paycheck, $4,320 a year.
- Same card for "457(b) 110.77" with "Roth 457(b)", and for "Retirement Plan 110.77" with "Roth 55.38" (`b2/a4.mjs`).

**Cause.** `K401` knows only 401 and 403; `hasPreTaxLine` uses it. `limitKind` in Contributions already counts 457, TSP
and thrift as this kind of plan.

**Fix.**
- One shared list of plan words for the label, `hasPreTaxLine` and `limitKind`: 401(k), 403(b), 457(b), TSP, thrift,
  "deferred comp", "retirement plan", "retirement savings".
- Offer $0 only when the stub has no deduction line with any of those words, and never as the filled button: outlined,
  last, worded as a question ("Is the $250 a month on file this same Roth money?").
- Test: this stub → k401 110.77, roth 55.38, no zero card.

### B1 (4) L8: a savings file is put on the checking account because the two accounts' line ids repeat
Run again (`b2/r1/r4-log.json`, `f1-savings-into-checking-390.png`, `-320-dark.png`): Chk_dayids.qfx then Sav_dayids.qfx
→ "Its lines are already on Chase checking, so it is picked above", ticked "Also set Chase checking's balance to
$11,703.12 ... (on file: $4,380.00)". After one tap Chase checking is $11,703.12 with the $3.12 interest; Ally savings
has 0 lines and still $11,500.

**Fix.** Count "holds" only among accounts of the file's kind; count an id match only when the date and amount match;
in `dedupe`, the same `extId` with another date or amount is a different line. Test as in the first pass.

### N3 (3) L7: the dollars of the wrong line are offered: the next line's, a surname's, or the whole paycheck
**Steps and evidence** (Casey, noContrib; `#/ai/reader?kind=paystub`; stubs in `b2/files/stubs.json`; `w1-log.json`):
- **A line with only a percent takes the next line.** "Roth 401(k) 2%" followed by "Net Pay 2,159.84" → "Casey's Roth
  401(k), pay the tax now ... Would be: $2,159.84 every two weeks into a new account ... That is $56,156 a year."
  (`b2/shots/w1-pctOnly-390.png`)
- **A heading takes the next line.** "401(k) Plan" followed by "Medical 85.00" → "Casey's 401(k) ... Would be: $85.00
  every two weeks"; the real "401(k) Employee 110.77" two lines down is not read (`w1-planHeading-390.png`).
- **The word Roth anywhere.** First line "Casey Roth" (a surname), next line "Gross Pay 2,769.23" → "Casey's Roth
  401(k) ... $2,769.23 every two weeks ... That is $72,000 a year." (`w1-rothName-390.png`, `w1-rothName-320-dark.png`).
  "ROTH & SONS FREIGHT  Check 10443.00" → $10,443 a paycheck (`b2/a4.mjs`).
- **A wages line.** "401(k) Eligible Wages 2,769.23" above the real line → "Casey's 401(k) ... $2,769.23 every two
  weeks. That is $72,000 a year." After "Use it", Will the money last? reads "The money lasts ... it can pay for $98,343
  a year" (`w1-wagesFirst-390.png`, `-320-dark.png`, `w1-wagesFirst-390-projection.png`). "401(k) 4% of 2,769.23 110.77"
  reads 2,769.23 the same way.
- **Any "matching".** "Charity Matching Gift 25.00" → an employer's match of $650 a year (`b2/a3.mjs`).

**Cause.** `readFields` falls back to the next line for every field; the Roth label's third pattern is `\broth\b`; the
first matching line wins; nothing compares a figure with the pay or the yearly limit.

**Fix.**
- No next-line fallback for the 401(k), Roth and match fields, except when the next line holds no letters.
- A Roth line must also name a plan (401, 403, 457, TSP) or start with "Roth" and end in an amount.
- Skip lines with "wages", "earnings", "eligible", "taxable", "hours", "rate" for these fields; after "% of X" take the
  last amount on the line.
- A match line must name the plan, the employer or "ER".
- One guard for all (also B9): own money above half the gross, or a year above `limitsFor` for the person's age → no
  "Use it"; the card says "This looks like the wrong line" and a "Set my own number" fold takes the typed amount.
- Tests: the five stubs above → the right figure or no card.

### N4 (3) L7: a 401(k) the person added on Net worth is not found, and a second 401(k) account is made
**Steps.** Kit household renterDebt (Riley, one adult, "Work 401(k)" at $0 with "Whose account" left at the form's
default, "Joint or shared") → `#/ai/reader?kind=paystub` → paste the full stub → "Use it" on Riley's 401(k).

**Evidence** (`b2/shots/w1-riley-390.png`, `w1-riley-320-dark.png`, `w6-riley-two-401k-390.png`; `w1-log.json`,
riley-390; `w6-log.json`, riley):
- "Riley's 401(k), pay the tax later ... Would be: $110.77 every two weeks into a new account, Riley's 401(k) at work, at
  $0 until you type its balance on Net worth."
- After: Net worth lists "Work 401(k) $0" and "Riley's 401(k) at work $0"; the row and the match are on the new one.
- Net worth's form saves `ownerId: ""` for "Joint or shared" (`balance/net-worth/view.js:52`); `workRows` looks only at
  accounts the person owns.

**Fix.**
- In `workRows`, when the person owns no account of the kind: take an unowned `401k` account that is not a former job's
  when the household has one adult, or when it is the only one and no other adult has a row into it. Set its owner on use.
- With several candidates, a select in the card: "Which account is it?" (existing accounts, then "A new one").
- Test: this plan → `make: "row"`, account "Work 401(k)".

### N5 (3) L8: an account number written with dashes or spaces in the file's name is kept and shown
**Steps.** Family plan → Import → pick `b2/files/0040-2899-64_activity.qfx` → "Import 2 transactions" → Import again.

**Evidence** (`b2/shots/w2-filename-390.png`; `w2-log.json`, fileName; `b2/a2.mjs`):
- The preview says "The account number is not kept."
- The notice says "Added 2 transactions from 0040-2899-64_activity.qfx", Past imports lists that name, and the saved
  plan holds `"fileName":"0040-2899-64_activity.qfx"`.
- `safeFileName` only replaces digits that run straight into the last 4: "acct_40-2899-64.qfx" and "chk 0040 2899 64
  nov.qfx" come back unchanged; "Statement [number removed].qfx" is masked.

**Fix.** In `safeFileName`, replace every run of 6 or more digits, counting dashes, dots and spaces between them, with
"XXXX", then apply the last-4 rule. Test: the three names above hold no "2899".

### B5 (3) L8: account numbers are kept in the plan under "The account number is not kept."
Run again (`b2/r1/r3-log.json` numbers, `u2-numbers-390.png`; `b2/a6.mjs`): Savings_2899_64.qfx saves `rawPayee:
"INTEREST TO 0040-2899-64"`, `rawPayee: "XFER FROM CHK 40287351"` and `extId: "[number removed]"`; Prairie_fitid6.qfx
saves `extId: "[number removed]"`; Savings_dash.ofx saves `extId: "[number removed]"`.

**Fix.** Scrub every ACCTID of the file (as written, digits only, without leading zeros, 5 or more characters) from
NAME, MEMO and FITID; store `extId` as a short hash of the FITID. Test: no run of 5 or more of the ACCTID's digits left.

### B3 (3) L8: two checking accounts in one file both go to the plan's only checking account
Run again (`b2/r1/r2-log.json` twoChecking, `i1-two-second-390.png`): the second pick reads "Checking ending 1234 ...
Chase checking is your only checking account, so it is picked above", ticked "Also set Chase checking's balance to
$310.40 ... (on file: $2,500.00)".

**Fix.** With 2 or more accounts of one kind in the file, make no "kind" guess and leave the balance unticked.

### B4 (3) L8: Undo of an import does not undo the balance it set
Run again (`b2/r1/r3-log.json` undo, `u1-undo-390.png`): after Undo, Chase checking is still $310.40 as of 11/11 with
history [11/11: 310.40]; the dialog and the notice speak only of 3 transactions.

**Fix.** The import record keeps `{ balance: { accountId, was, wasAsOf, history } }`; Undo puts it back when the balance
still equals the imported figure and says so.

### B6 (3) L8: a cut-short download brings in a made-up line
Run again (`b2/r1/r2-log.json` truncated, `i2-truncated-390.png`): "4 lines ... Import 4 transactions", the fourth
"(no description) 10/27/2026 · bank wrote: -$14.00", no warning.

**Fix.** `parseOfx` returns `complete` (the file ends with `</OFX>`), drops an unclosed last line, and the view says
"This file looks cut short. Download it again."

### B7 (3) L7: after "Use it", changing Whose or "How often are you paid?" shows the other card as "Done."
Run again (`b2/r1/r1-log.json` whose and period, `r1-whose-lee-390.png`, `r5-period-390.png`): "Lee's 401(k) ... Now:
$150.00 every month. Would be: $195.00 twice a month ... Done." with Lee still at 150 a month; "Now: $133.33 every two
weeks. Would be: $133.33 twice a month ... Done." with the row still every two weeks.

**Fix.** Keep `accepted` as a Map of id to the applied proposal's signature, or clear it when Whose, the period or the
kind changes.

### B8 (3) L7: a second job's stub overwrites the first job's 401(k) row
Run again (`b2/r1/r1-log.json` twojobs, `r6-twojobs-390.png`): "Ana's 401(k) ... Now: $470.00 every two weeks. Would be:
$60.00 every two weeks. That is $1,560 a year instead of $12,220." The pay card offers "$31,200 a year instead of
$101,400".

**Fix.** `workRows` returns every work row; with more than one, "Which job is this pay stub from?" and the account named
in each card.

### B9 (3) L7: a year-to-date figure is offered as this paycheck's
Run again (`b2/r1/r1-log.json` ytd, `r7-ytd-390.png`): "Jamie's 401(k) ... Would be: $2,584.68 every two weeks. That is
$67,202 a year instead of $3,000." with "Use it". The fix is N3's guard.

### B10 (3) L7: a stub that prints deductions with a minus loses its 401(k) lines
Run again (`b2/r1/r1-log.json` negative, `r9-negative-390.png`): "401(k), pay the tax later -$166.15" is found, no
401(k) card, only the match. New: brackets do the same, "401(k) (110.77)" (`b2/a3.mjs`, brackets).

**Fix.** Take the absolute value for the deduction fields.

### N6 (2) L8: lines the reader cannot read vanish without a word, and the balance is still ticked
**Steps and evidence** (family plan → Import; `w2-log.json`):
- `b2/files/Prairie_oddlines.qfx` holds 6 lines; 4 are written in ways the reader does not read (an amount in brackets,
  "1.234,56", a day that does not exist, no amount). The screen says "2 lines", "Import 2 transactions", ticked "Also set
  Chase checking's balance to $2,412.36". No "Could not read" tile, which the CSV path has
  (`b2/shots/w2-oddlines-390.png`, `w2-oddlines-320-dark.png`).
- `b2/files/cdata.qbo` (names inside `<![CDATA[...]]>`, which XML allows): both lines come in as "(no description)",
  "bank wrote:" empty (`w2-cdata-390.png`, `w2-cdata-320-dark.png`).
- `b2/files/noclose_one.ofx` (no closing tags at all): "0 lines", three tiles of 0, no button and no message
  (`w2-noclose-390.png`). The build log says this shape is covered by tests; only a missing `</STMTTRN>` is.

**Fix.**
- `parseOfx` counts the STMTTRN it left out and why; `prepareOfx` returns them as `bad`; the view shows the CSV path's
  "Could not read" tile and leaves the balance unticked when any line was left out.
- Read CDATA as text before building the tree.
- 0 lines and no balance: one notice, "This file has no lines the app can read. Download it again, or try the CSV."
- Tests: the three files.

### N7 (2) L8: the bank's balance date is taken as printed, even when it is ahead of today
**Steps.** Family plan (today 11/12) → Import → `b2/files/Prairie_tomorrow.qfx` (DTASOF `[number removed].000[0:GMT]`, an
evening download stamped in GMT) → Import.

**Evidence** (`b2/shots/w2-tomorrow-390.png`; `w2-log.json`, tomorrow; `b2/a2.mjs`):
- "Also set Chase checking's balance to $4,180.00, the bank's figure on 11/13/2026"; after: `asOf: "2026-11-13"`.
- The next file, dated today, gets no balance offer (the plan's date is now after it).
- A date a year ahead (`Prairie_nextyear.qfx`) is accepted the same way: `asOf: "2027-11-12"`.

**Fix.** Pass today into `balanceOffer`; use the earlier of the file's date and today; a date more than a day ahead
gets no offer. Test both files.

### B11 (2) L7: with no people, every re-read adds another "Your pay"
Run again (`b2/r1/r6.out`, `r6-nopeople-round2-390.png`): two rounds leave Maya's pay plus two "Your pay" at 2,769.23.
Seen again on the blank plan (`b2/w5.out`, blank).

**Fix.** With no adults: "Add yourself on Household first" and no "Use it".

### B12 (1) L7: "Not found" reads as more items than there are
Run again (`b2/r1/r1-log.json` noline): "Not found: 401(k), pay the tax later, Roth 401(k), pay the tax now, employer
match." Join with "; ".

### B13 (1) L7: a used card says "instead of" the same figure
Run again (`b2/r1/r3-log.json` afterUse): "Now: $195.00 twice a month. Would be: $195.00 twice a month. That is $4,680 a
year instead of $4,680." The withholding card does it too: "Now: $231, every two weeks. Would be: $231, every two weeks."
(`w1-tsp-390-zero-is-filled.png`). Write "Was: ... Now: ..." from the proposal as tapped.

### N8 (1) L7: a pasted stub that is not read yet is lost on Back
Paste, do not tap "Read it", Back, Forward: the box is empty (`w3-log.json`, backReload.pastedThenBackForward). Keep the
box's text in the module's `text` on input (it is never saved).

## Safari (not walked: only Chromium is installed). Try on the real iPhone
- **Import, "Bring in the Visa file ›" then the wrong download** (N1, after the fix): the kind notice shows and Import
  waits.
- **Import, the Files picker**: .qfx, .qbo, .ofx and a file saved as "download" can all be picked; a name with dashes in
  it is masked under Past imports (N5, after the fix).
- **Import, an evening download**: is the balance dated today or tomorrow (N7)?
- **Import, double tap on "Update the balance" and reader, double tap on "Clear"**: the second tap lands in a text box;
  does the keyboard open?
- **Import, the balance tick box**: tap the words; does it toggle?
- **Import, a cut-short download** from Safari (B6, after the fix).
- **Reader, text copied from a PDF in Safari or Files**: do line breaks, minus signs, brackets and the Current / YTD
  columns arrive as in N3, B9 and B10? A stub that arrives as one line reads differently.
- **Reader, the "Whose" and "How often are you paid?" wheels** after a "Use it" (B7, after the fix).
