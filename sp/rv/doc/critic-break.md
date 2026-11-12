# Break critic: track "doc" (L7 aaed872, L8 6ce1c29), checked 2026-11-12

I served my own detached copy of 6ce1c29 (rv/v-doc-break) on ports 9761-9766, in the sandbox, with the kit. I removed the
worktree at the end. Every server I started was stopped by the kit's stop(), and I killed nothing by pattern.
- Scripts: rv/doc/break/ (sweep.mjs, ofxattack.mjs, readerattack.mjs, r1.mjs to r6.mjs, mkfiles.mjs, mkleak.mjs,
  mkfitid.mjs).
- Invented files: rv/doc/break/files/.
- Shots and logs: rv/doc/break/shots/ (r1-log.json to r5-log.json).

Every finding below was confirmed by running code and, where marked, on screen. All households and files are invented.
I left out L4 and L6 items (leftover answer, split then Undo): they are not in this track. The import's Undo stands in for
"then Undo" here (B4).

## What holds (checked, no finding)

**Sweep.** I ran 1,451 plans through `reader.compute` (8 stubs, each adult and none), every `applyProposal` in turn,
`prepareImport`, `prepareOfx` for every file account, and `applyBalanceOffer`. That is 63,564 runs:
- 0 throws and 0 non-finite figures.
- The plans: every qa fixture, the personas (finished and mid-setup), every qa/households archetype with every pack, the
  5 phone-built households, and the empty plan.
- The odd plans: no people, one adult, no pay, no accounts, birth years 19800 and 198, $1e12 rows, "abc" amounts, a person
  removed, no retirement section, and a row whose account is gone.
- The stubs: full, Roth only, none, zero, huge, negative, YTD-only, and binary garbage.
- The files: 3 of the builder's and 10 of mine (truncated, broken, renamed, two checking accounts, dashed account number,
  ids made from the day, and a 2,400-line file).
- The inputs were deep-frozen, so nothing mutates the plan it is given.

**Tests.** tests/ofx.test.mjs, reader and import module tests: 43 of 43 pass.

**Double taps at 120, 250, 400 and 700 ms:**
- "Use it": only one change is applied each time, with no second row and no second account.
- "Import 10 transactions": 10 lines and one import record each time.
- "Update the balance": one history point. At 120 ms the second tap lands on the paste box, which gets focus; on an
  iPhone the keyboard would open (shots/i4-double-balance-390.png).

**Renamed and odd files:**
- A CSV renamed .qfx goes through the CSV path (Import 10).
- A QFX renamed .txt, and a file named "download" with no extension, are read as OFX by content.
- A broken file (an HTML "session expired" page with an OFX header) gives "That file has no bank or card lines in it.
  Download it again ..." (shots/i5-*.png).

**Other paths:**
- No accounts: "First, add the account this file comes from" (shots/i9-noaccounts-390.png).
- Back then Forward mid-preview: the preview is gone and nothing is imported (the file must be picked again).
- The same file twice adds 0. A 2,400-line file with 3,000 lines on file: prepareOfx takes 162 ms in Node.

## Findings (most severe first)

### B1 (4) L8: a savings file is put on the checking account because the two accounts' line ids repeat
**Steps.**
1. Family plan (Chase checking, Ally savings) → Import → rv/doc/break/files/Chk_dayids.qfx → Import 3.
2. Import → Sav_dayids.qfx. It is the savings account's own download, with ids made from the day and a count
   ("[number removed]"). Such ids are unique within each account, which is all the OFX rule asks, so they repeat across the two
   accounts.

**Evidence** (shots/f1-savings-into-checking-390.png, -320-dark.png; r4-log.json):
- The screen reads "Your bank's download for Savings ending 6543 (Chase) ... Its lines are already on Chase checking, so
  it is picked above."
- The filled button is "Import 1 transaction". The "Already on file" tile shows 1.
- The box "Also set Chase checking's balance to $11,703.12 ... (on file: $4,380.00)" is ticked.
- After one tap:
  - Chase checking is $11,703.12;
  - the $3.12 interest is on checking;
  - the savings' +$200 transfer is dropped as a duplicate;
  - Ally savings is untouched (0 lines, $11,500).

**Cause.** `guessOfxAccount` counts an `extId` match on any account of any type. The id that matched belonged to a
different line (another date and amount).

**Fix.**
- For "holds", count only plan accounts of the file's kind (`OFX_TYPES`).
- Count an id match only when the date and amount match too.
- In `dedupe`, treat the same `extId` with another date or amount as a different line.
- Test: Chk_dayids then Sav_dayids → Ally savings (by kind), 2 added, no balance offer on checking.

### B2 (4) L8: a card file with no guess goes to Chase checking, with a pre-ticked box that sets checking to -$6,522.17
**Steps.** Family plan plus a second card ("Store card") → Import → rv/doc/files/Maple_8642.qbo (no card is named Maple).

**Evidence** (shots/c1-card-default-390.png, -320-dark.png; r5-log.json):
- An amber notice: "Check the account above: Card ending 8642 could be more than one of your accounts. This goes to Chase
  checking."
- The filled "Import 5 transactions".
- A ticked box: "Also set Chase checking's balance to -$6,522.17, the bank's figure on 11/11/2026 (on file: $4,200.00)".
- After one tap, Chase checking is -6,522.17 and holds the card's 5 charges and payment.
- With no guess, the view falls back to the account box's first account, whatever its kind, and `balanceOffer` offers a
  card's figure on a checking account.

**Fix.**
- With no guess, preselect nothing ("Pick the account this file is for"). List accounts of the file's kind first, and
  disable Import until one is picked.
- Never offer a balance onto an account of another kind (a card file onto a non-debt account).
- Pre-tick the balance only when the guess is "holds" or the person picked the account.
- Word the notice: "Card ending 8642: which of your 2 cards is it?"
- Related to money critic M2 (pre-tick on a "kind" guess). This case has no guess at all.

### B3 (3) L8: two checking accounts in one file both go to the plan's only checking account, and the second's balance overwrites the first
**Steps.**
1. Family plan → Import → rv/doc/break/files/Prairie_two_checking.qfx (Checking ending 7351 and Checking ending 1234) →
   Import 3.
2. Pick the file again, as the page says ("One at a time: pick the file again for the next one").

**Evidence** (shots/i1-two-second-390.png, -320-dark.png; r2-log.json twoChecking):
- The second pick reads "Your bank's download for Checking ending 1234 ... Chase checking is your only checking account,
  so it is picked above."
- The box "Also set Chase checking's balance to $310.40 ... (on file: $2,500.00)" is ticked.
- After the tap:
  - Chase checking holds the 6 lines of two real accounts, including the transfer between them as -500 and +500;
  - its balance is 310.40;
  - the history is [11/11: 310.40], so the earlier 4,200 and 2,500 are gone (see B4).

**Fix.**
- When the file holds 2 or more accounts of one kind, make no "kind" guess. The person picks for each, and the balance is
  unticked.
- Better: remember in the import record which file account (by the last 4 and kind, not kept) went where, and never guess
  a second file account onto the same plan account.

### B4 (3) L8: Undo of an import does not undo the balance it set, and the earlier balance is lost
**Steps.** Continue B3 (the second account's import set Chase checking to $310.40) → Import → Past imports → Undo the
newest → OK.

**Evidence** (shots/u1-undo-390.png; r3-log.json undo):
- The dialog says "Remove the 3 transactions from Prairie_two_checking.qfx?" and the notice "Removed the 3 transactions
  ...". Nothing is said about the balance.
- After Undo, Chase checking is still $310.40 as of 11/11, with history [11/11: 310.40].
- The $4,200 on file before is nowhere: `keepOnFile` kept it as a point of the same day, and `saveBalance` then
  replaced that point.
- Undo filters only `transactions` and `imports`.

**Fix.**
- When the tick was applied, the import record keeps `{ balance: { accountId, was, wasAsOf, history } }`.
- Undo puts that back when the balance still equals the imported figure, and says "Chase checking's balance is back to
  $4,200.00".
- Test: import with the tick, then Undo → balance, asOf and history equal the plan before.

### B5 (3) L8: account numbers are kept in the plan, right under "The account number is not kept."
**Steps.** Family plan → Import → rv/doc/break/files/Savings_2899_64.qfx (invented ACCTID "0040-2899-64"). One line's NAME
is "XFER FROM CHK 40287351"; one line has an empty NAME and a MEMO of "INTEREST TO 0040-2899-64". Import 2.

**Evidence** (shots/u2-numbers-390.png, -320-dark.png; r3-log.json numbers.saved):
- The preview says "The account number is not kept." and, a few lines below, "bank wrote: XFER FROM CHK 40287351" and
  "bank wrote: INTEREST TO 0040-2899-64".
- The saved plan holds:
  - `rawPayee: "INTEREST TO 0040-2899-64"` (the account's own number as written);
  - `rawPayee: "XFER FROM CHK 40287351"`;
  - `extId: "[number removed]"` (the FITID still holds "[number removed]": `cleanFitid` removes only the ACCTID as written
    or without leading zeros, so a dashed one is missed).
- A FITID built from the last 6 digits is also kept: "[number removed]" (Prairie_fitid6.qfx).

**Fix.**
- In `parseOfx`, scrub every ACCTID in the file from NAME, MEMO and FITID: as written, digits only, and without leading
  zeros, each of 5 or more characters, replaced by "...<last4>".
- Store `extId` as a short hash of the FITID (FNV-1a hex), so no digits of the bank's id are kept at all.
- Test: after this file, the saved JSON holds no run of 5 or more of the ACCTID's digits.

### B6 (3) L8: a cut-short download brings in a made-up line ($14.00, "(no description)") and the real one is added beside it later
**Steps.** Family plan → Import → rv/doc/break/files/Prairie7351_cut.qfx (the Prairie file cut inside
`<TRNAMT>-1450.00`, as an interrupted download leaves it).

**Evidence** (shots/i2-truncated-390.png; break/ofxattack.out):
- The screen reads "4 lines ... Import 4 transactions", with "(no description) 10/27/2026 · bank wrote: -$14.00" in the
  rows. There is no warning and no balance.
- After import, the full file next time adds 7 lines, including the real "-1450 Oakwood Apartments Rent".
- The phantom -$14 (no id, another amount) stays beside it.

**Fix.**
- `parseOfx` returns `complete: /<\/OFX>/i.test(text)`. When the file is not complete, it drops the last STMTTRN if that
  is not closed.
- The view then says: "This file looks cut short: it does not end the way a bank's file ends. Download it again." It
  offers only complete lines, or none.
- Test: Prairie7351_cut.qfx → 3 lines, the notice, no -14.

### B7 (3) L7: after "Use it", changing Whose or "How often are you paid?" shows the other card as "Done." although nothing was saved
**Steps (Whose).** Dana & Lee (couple2k) → #/ai/reader?kind=paystub → paste rv/doc/person/stubs/dana.txt → Use it on
"Dana's 401(k)" → Whose = Lee.

**Evidence** (shots/r1-whose-lee-390.png; r1-log.json whose):
- The card reads "Lee's 401(k), pay the tax later. Now: $150.00 every month. Would be: $195.00 twice a month ... Done."
  It is grayed, with no Use it.
- The plan still has Lee at 150 monthly.

**Steps (period).** Jamie (noMatch) → paste a stub with no frequency ("401(k) 133.33") → Use it (every two weeks) → "How
often are you paid?" = Twice a month.

**Evidence** (shots/r5-period-390.png; r1-log.json period):
- "Now: $133.33 every two weeks. Would be: $133.33 twice a month. That is $3,200 a year instead of $3,467. Done."
- The row is still biweekly.

**Cause.** `accepted` holds proposal ids ("k401", "match"), so any later proposal with that id counts as done.

**Fix.**
- Keep `accepted` as a Map of id to the applied proposal's signature (op, side, personId, amount, period, employerMatch).
- Mark a card done only when its signature matches. Or clear `accepted` when Whose, the period or the kind changes.
- Test (view logic or a pure helper): after a use and a person switch, the card offers Use it.

### B8 (3) L7: a second job's pay stub overwrites the first job's 401(k) row, and the card does not say which account
**Steps.** Family plan plus Ana's second job: an account "Clinic 403(b)" with a $60 biweekly row, and income "Ana's clinic
shifts" $1,200 biweekly → #/ai/reader?kind=paystub → paste the clinic stub ("403(b) 60.00") → Use it on "Ana's 401(k)".

**Evidence** (shots/r6-twojobs-390.png, -320.png, r6-twojobs-contributions-390.png; r1-log.json twojobs):
- The card reads "Ana's 401(k), pay the tax later. Now: $470.00 every two weeks. Would be: $60.00 every two weeks. That
  is $1,560 a year instead of $12,220."
- After Use it, Ana's main row c-ana is $60, the clinic row is unchanged at $60, and $10,660 a year of saving is gone.
- `workRows` takes the person's first 401(k) row. The pay card overwrites the first salary too (that part predates L7).

**Fix.**
- `workRows` returns every work row of the person.
- With more than one, show "Which job is this pay stub from?" (a select of the work accounts, by name). Default to the
  row nearest the stub's figure, and name the account in each card ("into Clinic 403(b)").
- Pick the salary the same way.
- Test: this plan and stub → the proposal targets c-clinic.

### B9 (3) L7: a 401(k) line with only the year-to-date figure is offered as this paycheck's, nearly 3 times the yearly limit
**Steps.** Jamie (noMatch) → #/ai/reader?kind=paystub → paste a stub with "Description Current YTD" columns whose 401(k)
line has only the year-to-date number ("401(k)                              2,584.68"; this period's cell left blank).

**Evidence** (shots/r7-ytd-390.png, r7-ytd-320-dark.png; r1-log.json ytd):
- "Jamie's 401(k), pay the tax later. Now: $250.00 every month. Would be: $2,584.68 every two weeks. That is $67,202 a
  year instead of $3,000."
- It has Use it. The 2026 limit is $24,500, plus $8,000 from 50 (`limitsFor(2026)`).
- The same holds for the match: a YTD-only "401(k) ER Match 1,744.68" gives about $45,362 a year.
- A typo-sized "401(k) 27,692.30" gives $719,999.80 a year (readerattack.out).

**Fix.**
- When perYear(k401 + roth401k) is over the person's 401(k) limit for their age (`limitsFor` plus catch-up), or the
  match is over it, show "This is more than anyone can put into a 401(k) in a year. It may be the year-to-date figure:
  check the stub." Offer no Use it, or only after the person types the amount.
- With a Current/YTD header and only one number on the line, read nothing.
- Test: this stub → no k401 Use it.

### B10 (3) L7: a stub that prints what comes off with a minus loses its 401(k) and Roth lines, and offers only the match
**Steps.** Casey (noContrib) → #/ai/reader?kind=paystub → paste rv/doc/person/stubs/casey-adp.txt ("401K -166.15
3,489.15", "Federal Income Tax -241.12 ...").

**Evidence** (shots/r9-negative-390.png; r1-log.json negative):
- "Found in it" shows "401(k), pay the tax later -$166.15" and "Federal income tax withheld -$241.12".
- There is no 401(k) card and no withholding card, only "Casey's employer's match ... $83.08 every two weeks, about
  $2,160 a year". Using it puts a match on Casey's $0 row.
- The person critic's stub folder has this file, so this may overlap with their report.

**Fix.** Take the absolute value for the deduction fields (k401, roth401k, match, federal): a minus there is the stub's
sign for money taken out. Test: casey-adp → k401 166.15, federal 241.12.

### B11 (2) L7: on a plan with no people, every re-read adds another "Your pay"; the 401(k) line is found but nothing is said
**Steps.** qa household 01-single-adult with the warnings-and-roles/no-people pack (income "Maya's pay" $2,450 biweekly,
no people) → #/ai/reader?kind=paystub → paste a stub → Use it on Pay → Clear → paste the same stub → Use it.

**Evidence** (shots/r6-nopeople-round2-390.png; r6.mjs output):
- Both rounds read "Pay on the Income page. Now: nothing yet. Would be: $2,769, every two weeks."
- The income list ends as Maya's pay plus two "Your pay" at 2,769.23 biweekly.
- "401(k), pay the tax later $110.77" is found, but no 401(k) card appears and nothing says why.
- The sweep shows the same on all 16 no-people plans. L7's `alreadyOnFile` does not catch it: the income is looked up by
  `personId === undefined`.

**Fix.**
- With no adults, show "Add yourself on Household first; then the pay and 401(k) lines can be used ›" and offer no Use
  it.
- Or match a salary whose owner is gone.

### B12 (1) L7: "Not found" reads as more items than there are
**Evidence** (shots/r8-noline-390.png; Casey, a stub with no 401(k) line): "Not found: 401(k), pay the tax later, Roth
401(k), pay the tax now, employer match."

**Fix.** Use labels without commas ("401(k) (pay the tax later)"), or join them with "; ".

### B13 (1) L7: a used card says "instead of" the same figure
**Evidence** (shots/u3-afteruse-390.png): after Use it on Dana's 401(k), the card reads "Now: $195.00 twice a month. Would
be: $195.00 twice a month. That is $4,680 a year instead of $4,680." The "before" is recomputed from the saved plan.

**Fix.** Keep the proposal as tapped (B7's Map) and write "Was: $400.00 every month. Now: $195.00 twice a month."

## Safari (not walked: only Chromium is installed). Try on the real iPhone
- **Import, picking files.** In the Files picker, the .qfx, .qbo and .ofx files and one saved as "download" can be picked.
- **Import, a cut-short download.** Interrupt a download in Safari and pick the partial file. It must not bring in a
  made-up line (B6, after the fix).
- **Import, double tap on "Update the balance".** The second tap focuses the paste box; check whether the keyboard opens.
- **Import, the balance tick box.** Tap the words; does it toggle?
- **Reader, the "Whose" and "How often are you paid?" wheels.** Change each after a Use it (B7, after the fix).
- **Reader, copied text.** A stub copied from a PDF in Safari or Files: do the minus signs and the Current/YTD columns
  arrive as in B9 and B10?
