# Money critic: track "doc" (L7 aaed872, L8 6ce1c29), re-checked 2026-11-12 (second pass)

The builder's worktree is still at 6ce1c29 (two commits on fa2026e, nothing uncommitted), so this pass checks the same code as
the first money pass. Every finding below was run again by me; the first pass is kept at
$SP/rv/doc/m2/critic-money.round1.md.
New in this pass: M1 (as a money finding, on screen, with Undo), M3, M7, M10, M12, M13, M14 (the rate), M15, M17, and the
whole-app invariance run.

Served from my own detached copy of 6ce1c29 (rv/v-doc-money; ports 9741, 9742, 9743; the sandbox; the kit), base = `git archive
fa2026e`. Everything is under $SP/rv/doc/m2/
(called m2/ below): scripts l7.mjs, l7b.mjs, l7c.mjs, l7d.mjs, l8.mjs, l8b.mjs, deps.mjs, inv.mjs, freeze.mjs; walks w7.mjs, w8.mjs,
w9.mjs with logs shots/w7-log.json, w8-log.json, w9-log.json; screenshots m2/shots/; files m2/files/. Invented households and files only.

## What holds (checked, no finding)
- **Tests.** modules/ai/reader/module.test.mjs, tests/ofx.test.mjs, transactions/import/module.test.mjs, tests/import-banks.test.mjs:
  53 of 53. Every tests/golden-*.test.mjs and tests/guesses-invariance.test.mjs: 186,242 tests, 0 fail (620 todo, as before).
  `git diff fa2026e..6ce1c29 -- tests/golden` is empty: golden keys unchanged.
- **Invariance (base fa2026e against head 6ce1c29, plans without the new optional fields; none of the plans holds an `extId`).**
  INVARIANCE_LINES
- **Said = done, L7, on screen (Casey, phone-built; m2/shots/casey-390*.png, 320, 320-dark, 390-dark).** Cards: 401(k) "$110.77 every
  two weeks. That is $2,880 a year", Roth "$55.38 … $1,440 a year" into a new "Casey's Roth 401(k) at work", match "about $2,880 a
  year". After the four "Use it": the plan holds 110.77 biweekly with match 2,880.02 and 55.38 biweekly with match 0. What you save
  for retirement: "$7,200 a year … $4,320 of your own money and $2,880 from employers", "401(k) / 403(b) $4,320 of $24,500" (the Roth
  401(k) counts against the 401(k) limit, IRC 402A(c)(2)). Federal estimate: "Wages $69,120 … less $2,880 of pre-tax 401(k)
  contributions". Will the money last?: "runs out in 2047 (age 67)" before, "2067 (age 87)" after. By hand: 110.77 x 26 = 2,880.02;
  55.38 x 26 = 1,439.88; 72,000 - 2,880 = 69,120.
- **The federal tax difference (l7.mjs).** Casey: 7,010 before, 6,376.40 after: 633.60 less = 22% of 2,880.02; the Roth 1,439.88 is
  not excluded. Lee (Roth-only stub, both cards used): 10,448 before, 10,664 after: 216 more = 12% of the 1,800 that stops being
  pre-tax.
- **Nothing counted twice (l7e.mjs).** Casey's money left over each month (Next best action's `spare`) falls from $573 to $273
  after the stub: retirement saving 0 -> 359.99 a month = 4,319.90 / 12 (the person's own money on both rows, once; the match is
  not in it), federal tax 52.80 a month less = 633.60 a year.
- **Splits keep the person's total.** Lee: 1,800.00 a year on file as pay-the-tax-later; after the $0 card and the Roth card,
  1,799.98 (69.23 x 26). The same stub again: every card "Already on file".
- **The match rule (D-C2).** The match is only ever on the pay-the-tax-later row: Lee's $1,560 lands on a $0 row, none on the Roth
  row. A plan with only a Roth 401(k) row carrying a typed $1,300 match and a stub match of $50 a paycheck: the match moves to a
  new $0 pay-the-tax-later row; the plan's match a year is 1,300 before and after, never twice (l7b.mjs, J).
- **The engine (l7c.mjs).** Casey after the stub and the same rows typed by hand give the same projection (short at 87, 241,009 at
  retirement in today's dollars). A $0 row with a match is projected. A row typed as a share of pay becomes dollars.
- **L8, on screen (family fixture; m2/shots/prairie-390*.png, card-390*.png).** Prairie file: money in $4,621 / out $1,824 (hand-summed
  4,621.10 / 1,824.24); notice "Chase checking's balance is now $4,512.36 as of 11/12/2026" = the plan (4512.36, as of 2026-11-12,
  the old 4,200 kept as a 2026-11-11 point); Net worth $287,100 -> $287,412 (+312.36). Same file again adds 0. Card file: charges
  money out with no flip, "$6,522.17 owed (on file: $6,400.00 owed)", Net worth $287,100 -> $286,978 (-122.17). No offer when the
  plan's balance is dated after the file's.
- **Law and sources, opened 2026-11-12.** law.cornell.edu 26 U.S.C. 402(a) ("taxable to the distributee, in the taxable year … in
  which distributed"); 402A(a)(2) (an employer's designated Roth match, "not excludable from gross income", added by Pub. L.
  117-328 div. T s.604(a)) and 402A(c)(2) (Roth and pre-tax deferrals share one limit); 414(v)(7) (catch-up must be Roth above
  $145,000 of the prior year's wages from the employer sponsoring the plan, indexed in $5,000 steps). OFX 2.1.1 schema
  (schemas.liquid-technologies.com/OFX/2.1.1/genericnametype.html): NAME is at most 32 characters. ofx-js LICENSE: MIT, "Copyright
  2012-2017 Apps Attic Ltd.". plaid.com/docs/account/billing: "You can create 10 Production Items on a Trial plan" (see M17 for the
  date). L7 and L8 put no sourced statistic on screen.
- **Phone.** No sideways scroll and no page error in any walk at 390 and 320 px, light and dark. One filled "Use it" among a
  stub's cards, one filled button in the import preview.

## Findings (most severe first)

### M1 (5) L8: a card file on a plan with no card goes into the 401(k), and the pre-ticked box sets it to -$6,522.17; Undo does not bring it back
Steps: Jamie (phone-built noMatch: a 401(k) of $30,000, checking, savings, a car loan, no card) -> Import -> pick
rv/doc/files/Maple_8642.qbo (a card file, BALAMT -6522.17) -> tap the filled "Import 5 transactions".
Evidence: the account box stays on its first entry, "Jamie's plan at work". The preview: "Check the account above: Card ending 8642
could be more than one of your accounts. This goes to Jamie's plan at work." then the filled button and, ticked, "Also set Jamie's
plan at work's balance to -$6,522.17, the bank's figure on 11/11/2026 (on file: $30,000.00)" (m2/shots/jamie-card-390.png,
jamie-card-320.png, jamie-card-320-dark.png). One tap: notice "Jamie's plan at work's balance is now -$6,522.17"; Net worth $37,000
-> $478, "-$6,522 in retirement accounts (pre-tax)" (jamie-card-390-networth.png); Will the money last? "runs out in 2052 (age 70)"
-> "2048 (age 66)" (jamie-card-390-hero-after.png). Past imports -> Undo: "Removed the 5 transactions from Maple_XXXX.qbo."; the
401(k) is still -6,522.17, and its history holds only that point: the $30,000 is gone from the plan (jamie-card-390-undo.png,
-undo-networth.png, w9-log.json). In code (l8.mjs 4, 8d, 8e): `prepareOfx` returns no account, the view falls back to the box as it
is; `balanceOffer` has no check that the file's kind fits the account (a card's -6,522.17 on checking, a checking 4,512.36 as
"owed" on the card are both offered); the box is `checked: true` whenever there are lines.
Fix: (1) view.js: with no guess and no pick by hand, do not use the box's first account: ask "Which of your accounts is Card ending
8642?" with a first option "Pick the account" (and "It is not on my plan yet ›" to Net worth), and show no Import button until one
is picked. (2) `balanceOffer` returns null unless `OFX_TYPES[fileAccount.kind]` includes the account's type. (3) Tick the box only
when the guess is "holds" or "name"; otherwise leave it unticked. (4) `importRecord` keeps what the balance was (`balanceWas: {
balance, asOf }`) when the import set it, Undo puts it back and says so, and `keepOnFile` keeps a same-day figure. Tests: this file
on Jamie -> no account, no offer; a card file on checking by hand -> no offer; Undo -> 30,000 as of 2026-11-11.

### M2 (5) L7: a catch-up line is dropped, and the page offers to cut the person's 401(k) saving
Steps: Robin (phone-built nearRetiree, 63, $600 a month on file) -> #/ai/reader?kind=paystub -> paste a biweekly stub with
"401(k) 4.00% 107.69" and "401(k) Catch-Up 166.15" ($273.84 a paycheck, $7,119.84 a year) -> Read it -> every "Use it".
Evidence: "Robin's 401(k), pay the tax later. Now: $600.00 every month. Would be: $107.69 every two weeks. That is $2,800 a year
instead of $7,200." (m2/shots/robin-390.png, robin-320-dark.png). "Found in it" lists $107.69 only. After the taps: the row is
107.69 biweekly; What you save for retirement "$2,800 of your own money"; Federal "less $2,800 of pre-tax 401(k)"; Will the money
last? "runs out in 2057 (age 94)" -> "2055 (age 92)" (robin-390-before.png, robin-390-after.png). A Roth pair ("ROTH 401K 200.00",
"ROTH CATCH UP 207.69") reads $200 = $5,200 a year instead of $10,600 (l7b.mjs C2). From 2026 a high earner's catch-up must be Roth
(IRC 414(v)(7)), so a second line is the usual layout for people over 50. `readFields` takes the first matching line per field.
Fix: for `k401` and `roth401k` add every matching line (each line's first money, still skipping loan, match and employer lines)
and show the parts in "Found in it" ("401(k) $107.69 + catch-up $166.15"). Tests: Robin's stub reads 273.84; the Roth pair 407.69.

### M3 (4) L7: one stray word decides how often the person is paid, every yearly figure follows it, and there is no box to correct it
Steps: Casey -> #/ai/reader?kind=paystub -> paste a stub with "Pay Period 10/19/2026 to 11/01/2026", no frequency line, and a
deduction line "Monthly Transit Pass 45.00". Also: the same stub with "Pay Frequency: Bi Weekly".
Evidence: transit stub: the one filled button is "Pay on the Income page. Now: $72,000, annual. Would be: $2,769, monthly. That is
$33,231 a year instead of $72,000."; "Casey's 401(k) … $110.77 every month. That is $1,329 a year" (true: $2,880); the match
"about $1,329 a year" (m2/shots/transit-390.png, transit-320-dark.png). "Bi Weekly": "Would be: $2,769, weekly. That is $144,000 a
year instead of $72,000", 401(k) and match "$5,760 a year" (bispace-390.png). By code (l7b.mjs E): "Semi Monthly" -> monthly (half);
"Standard weekly hours 40.00" -> weekly (double); a period of 02/16-02/28 with no words -> every two weeks (26 instead of 24
paychecks, +8.3%). "How often are you paid?" is not on the screen in any of these (it shows only when nothing was read). The word
rule is older than L7 (fa2026e compute.js:116), but L7 now writes the match a year, the Roth row and new rows from it, and this
page is where "Read it from a pay stub ›" lands.
Fix: `bi[\s-]?weekly` and `semi[\s-]?monthly` anywhere; "weekly" or "monthly" only on a line that also says pay, paid,
frequency, schedule or cycle; when the period dates give another answer than the words, use the dates; a period from the 1st or
16th to the 15th or the month's last day is twice a month. Always show how often, quietly, with a way to change it ("Paid every
two weeks · Change"), so a wrong reading is one tap from right. Tests: the five stubs above.

### M4 (4) L8: another bank's file is put on the plan's only account of that kind, with the balance overwrite ticked
Steps: family fixture (Chase checking, institution "Chase", $4,200) -> Import -> rv/doc/files/Prairie7351_Activity.qfx (ORG
"Prairie Bank").
Evidence: "Your bank's download for Checking ending 7351 (Prairie Bank) … Chase checking is your only checking account, so it is
picked above." Filled "Import 10 transactions", ticked "Also set Chase checking's balance to $4,512.36 … (on file: $4,200.00)"
(m2/shots/prairie-390.png, prairie-320-dark.png). One tap: Chase checking is 4,512.36 as of 2026-11-12 and holds Prairie Bank's 10
lines (w8-log.json). `guessOfxAccount` never looks at ORG once one account of the kind exists.
Fix: when the guess is "kind", the file names a bank (a word of 3+ letters in ORG) and the account has an `institution` or name
that does not hold it, do not pre-pick: the amber line "This file is from Prairie Bank; Chase checking is at Chase. Is it this
account?" and the box unticked (M1's rule 3). Test: this file on the family plan -> no pre-pick, no tick.

### M5 (4) L7: a stub that prints what comes off with a minus (the common payroll layout) loses the 401(k) and Roth lines; only the match is offered
Steps: Casey -> paste a stub with "Federal Income Tax -231.40 5,090.80", "401(K) -110.77* 2,436.94", "Roth 401K -55.38 1,218.36",
"401K Employer Match 110.77 2,436.94" -> Read it -> Use it.
Evidence: "Found in it (9 of 9)" shows "401(k), pay the tax later -$110.77", "Roth 401(k), pay the tax now -$55.38", "Federal
income tax withheld -$231.40"; the only card with a button is "Casey's employer's match … about $2,880 a year"
(m2/shots/minus-390.png, minus-320.png). After the tap: What you save for retirement "$0 of your own money and $2,880 from
employers", "Casey · $0 every month · employer adds $2,880 a year" (a match on nothing going in); Will the money last? "runs out in
2053 (age 73)" where the full stub gives 2067 (age 87). The proposals test `fields.k401 > 0`.
Fix: for what comes off the pay (federal, k401, roth401k) read the amount's size (`Math.abs`) when the line's figure is negative
or in brackets. Never offer a match on a row with nothing going in without saying so ("nothing goes into this 401(k) on file:
check the 401(k) line first"). Tests: this stub reads 110.77, 55.38 and 231.40.

### M6 (3) L7: an HSA employer line is read as the 401(k) match
Steps: Jamie ("no match" on file) -> paste a stub whose Employer Contributions list "HSA ER Match 25.00" above "401(k) ER Match
73.85".
Evidence: "Jamie's employer's match. Now: no match on file. Would be: $25.00 every two weeks, about $650 a year" (m2/shots/hsa-390.png);
right is 73.85 x 26 = $1,920.10. After "Use it": match 650, `workPlans.match: true`, What you save "$650 from employers".
Fix: the match field skips lines that say HSA, FSA, health, dental, vision, life or stock, and tries the labels that name the
401(k) or 403(b) before the bare "ER/employer/company … match". Test: this stub reads 73.85.

### M7 (3) L7: a partner's stub is read as the first adult's, even when it names the partner
Steps (l7d.mjs): Dana & Lee, #/ai/reader?kind=paystub (no `&person=`) -> Lee's stub ("Employee: Lee", gross 2,000.00, 401(k) 69.23).
Evidence (by code; the view starts its "Whose" box on the first adult): the proposals are for Dana: pay 78,000 -> 52,000 a year
(the first one not "already on file", so the filled "Use it"), Dana's 401(k) 4,800 -> 1,799.98 a year, withholding in Dana's slot.
Fix: when the text holds exactly one adult's name as a word, pick that person; with two adults who have pay and no `&person=`,
ask "Whose pay stub is this?" (two chips) before any card is shown. Test: this stub -> Lee.

### M8 (3) L8: lines brought in from a CSV are added again from the QFX of the same days
Steps: family plan with qa/fixtures/chase-checking.csv imported into Chase checking -> Import -> m2/files/Chase0421_Activity.qfx
(the same ten lines as the bank's QFX: NAME cut at 32 characters, the OFX maximum, the rest in MEMO).
Evidence: "Its lines are already on Chase checking, so it is picked above." then the filled "Import 2 transactions": "Amazon Mktpl
Amzn -$42.17", "Transfer Sav -$500.00", "money out $542" (m2/shots/csv-then-qfx-390.png): both are on file already, with the
longer CSV text.
Fix: an incoming line with an id and no id match is also a duplicate of a no-id line on that account with the same day and amount
whose bank text starts with the incoming text (or the other way round), one for one. Also read `<EXTDNAME>` when a file has it.
Test: the CSV, then this QFX -> add 0.

### M9 (3) L8: the same lines downloaded again with other line ids are all added again
Steps: family -> Import m2/files/Chase0421_Activity.qfx (10 lines) -> Import m2/files/Chase0421_again.qfx (the same file, every
FITID changed).
Evidence: "Its lines are already on Chase checking, so it is picked above." and, under it, the filled "Import 10 transactions",
"0 Already on file", "Money in $3,900, money out $1,506" (m2/shots/new-ids-390.png). The base's key check adds 0 for this file.
Which banks change ids between downloads was not checked.
Fix: after the id pass, match by key as a count: a line with an id and no id match is a duplicate while the plan holds as many
lines with that key as the file does. Two $4.50 coffees in one file still both come in.

### M10 (2) L8: a file that repeats one line id drops every line after the first as "already on file"
Steps: family -> Import m2/files/SameId.qfx (four different lines, each `<FITID>0`).
Evidence: "Import 1 transaction", "3 Already on file skipped as duplicates", "Money in $0, money out $54" on an account with no
lines (m2/shots/same-id-390.png, same-id-320.png): a $2,310.55 paycheck and $1,450.00 of rent are left out (true: in 2,310.55, out
1,542.70). OFX says the id is unique per account; a file that breaks that loses money silently here. Which banks do it was not checked.
Fix: an id match counts as a duplicate only when the amount is the same (and the day within a few days); otherwise bring the line
in and keep no `extId` for it.

### M11 (2) L8: a card that is in credit is offered as money owed
Steps: family (Visa $6,400 owed, dated 11/01) -> Import m2/files/Maple_credit.qbo (charges negative, a $6,445.16 payment,
BALAMT 25.17).
Evidence: ticked "Also set Visa card's balance to $25.17 owed"; after the tap Net worth $293,475 (m2/shots/card-credit-390.png,
w8-log.json); the card is $25.17 in credit, so net worth is $50.34 too low. `balanceOffer` takes |BALAMT| for every debt. Some
issuers do send what is owed as a positive figure, so the sign alone cannot be trusted either.
Fix: in a card file whose charges are negative, a positive BALAMT is not ticked and is asked: "The file says $25.17. Is that what
you owe, or a credit?".

### M12 (2) L7: using some of a stub's cards counts the saving twice, and no card says the total
Steps: Dana & Lee -> #/ai/reader?kind=paystub&person=setup-partner -> Lee's Roth-only stub -> "Use it" on the Roth card only.
Evidence: What you save for retirement: "Lee: 401(k) / 403(b) $3,600 of $24,500", rows "Lee's plan at work $1,800 a year" and "Lee's
Roth 401(k) at work $1,800 a year" (m2/shots/lee-roth-390-contributions.png); the stub shows $1,800 in all. Dana with a stub of
4% pay-the-tax-later and 2% Roth, Roth card only: 6,360 a year against the stub's 4,680 (l7c.mjs 3, 4). The used card then reads
"That is $1,800 a year instead of $1,800" (lee-roth-390-used.png).
Fix: one line above the 401(k) cards: "This stub: $1,800 a year of Lee's own money. On file now: $1,800. After the changes you
have used: $3,600." in amber while the two differ; and no "instead of" when both figures are the same.

### M13 (2) L7 with the engine: a Roth 401(k) row the reader makes keeps going after the job's pay ends
Steps (l7c.mjs 2): Casey with the pay line ending 2030-12-31 -> the stub's three cards used -> `buildInputs`.
Evidence: "Casey's plan at work" stops in 2030 (`untilYear: 2030`); "Casey's Roth 401(k) at work" has no end and runs to the
retirement year (2045): 15 years of $1,440 that cannot go in. projection/compute.js counts a row as "at work" only when its account
is a `401k` or it carries a match, and by D-C2 the reader's Roth row never carries one.
Fix: not in this track's files. Post on WORKBOARD for claude-c: `atWork` should also be true when `limitKind(acct.type, acct.name,
c.employerMatch) === "401k"`. Say so in the reader README until then.

### M14 (2) L7: nothing checks a 401(k) figure against the pay or the yearly limit
Steps: Casey -> a stub with "401(k) Eligible Wages 2,769.23" above the 401(k) line; a stub with "401(k) 4.00 110.77 2,436.94" (the
share of pay printed without a % sign).
Evidence: "Would be: $2,769.23 every two weeks. That is $72,000 a year. Use it" (m2/shots/wages-390.png): all of the pay, three
times the $24,500 limit. "Would be: $4.00 every two weeks. That is $104 a year" and a match of "about $104 a year"
(nopct-390.png); right is $110.77.
Fix: skip a line that says wages, earnings, eligible or taxable; when gross pay was read and the first figure times gross / 100
is within 2 cents of the next figure, the first is a rate; a figure at or above gross pay, or a year above the limit with
catch-up, gets an amber line and no filled button.

### M15 (2) L8: the days a file covers are taken from its first and last line, not from the file's own range, so a quiet week reads as missing days
Steps (l8b.mjs): three monthly files that say DTSTART/DTEND 07/01-07/31, 08/01-08/31, 09/01-09/30 (lines from the 2nd to the 27th)
-> October's file (10/01-10/31, first line on the 9th).
Evidence: the imports are recorded as 07/02-07/27, 08/02-08/27, 09/02-09/27; October's preview warns "Your last Chase checking
lines end 9/27; this file starts 10/9. Anything on 9/28 to 10/8 is missing (your mortgage usually goes out on the 2nd). Bring in a
file from 9/28, or add those by hand." The bank's files cover every one of those days. After the import the ledger holds a hole
9/28-10/8 (11 days), and picking September's or October's file again offers nothing to count as checked (`fills` is empty: each
file's span is its own lines'). The same two ranges show on one screen in the family walk: "10 lines from 10/20/2026 to
11/12/2026" in the first line, "10/20/2026 to 11/10/2026" on the tile (m2/shots/prairie-390.png).
Fix: for an OFX file, `fileFrom` / `fileTo` (and the import record's `from` / `to`) are DTSTART and DTEND when they are real dates
that contain the lines, DTEND capped at today. Test: these four files -> no warning.

### M16 (1) L7: pay and withholding cards show whole dollars, the plan gets cents
Evidence: "Would be: $231, every two weeks" beside "Found in it … $231.40"; the plan holds 231.40 (m2/shots/hsa-390.png,
robin-390.png). The 401(k) cards were fixed to the cent, these were not.
Fix: `fmtVal` uses two decimals for `perPaycheck` and `amount` on a pay stub.

### M17 (1) docs/RESOURCES.md: the date Plaid's free tier ended is cited to a page that does not state it
Evidence: "Its free Development tier ended on 2024-06-20 … (plaid.com/docs/account/billing, read 2026-11-11)". That page, opened
2026-11-12, has the 10-Item Trial and no word about the Development tier or that date.
Fix: cite the page that states the date, or keep only the Trial sentence. Not on screen.

## Seen, not this track
- taxes/state (claude-a's folder): for Casey, whose state is PA, the leftover's state tax falls by 7.37 a month (88.42 a year =
  3.07% of 2,880.02) once the stub's pay-the-tax-later row is in (l7e.mjs). Pennsylvania's rule for an employee's 401(k) money
  should be checked there: I could not open the Department of Revenue's own statement in this session, so this is a pointer, not a
  finding.

## Safari (not walked: only Chromium is installed). Try on the real iPhone
- Import: `readAsArrayBuffer` and `TextDecoder("windows-1252")` on a 1252 QFX with an é or ’; the Files picker with the broad accept
  list (no greyed .qfx / .qbo / .ofx; a file saved as "download").
- Import: the balance tick box (a bare checkbox inside a flex label): that a tap on the words unticks it, and that it is a 44 px row.
- Reader: a stub copied from a PDF in Safari or Files: whether line breaks survive (one long line reads no 401(k) line); whether a
  minus sign arrives as "-" or as a Unicode minus (M5's fix must take both).

## Housekeeping
Servers on 9741, 9742 and 9743 were each stopped by the kit's stop(); no process was killed by pattern. The review worktree
rv/v-doc-money and the unpacked base m2/base were removed at the end. Nothing was written to the repo or to the builder's worktree.
