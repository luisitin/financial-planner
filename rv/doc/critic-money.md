# Money critic: track "doc" (L7 aaed872, L8 6ce1c29), checked 2026-11-12

Served from my own detached copy of 6ce1c29 (rv/v-doc-money, port 9741, sandbox, kit), base = `git archive fa2026e`
(rv/base-fa). Scripts and shots: rv/doc/money/ (l7a.mjs, l7b.mjs, l8a.mjs, inv.mjs, deps.mjs, walk.mjs, shots/,
shots/walk-log.json). Every finding below was confirmed by running code and, where marked, on screen. Invented households
and files only.

## What holds (checked, no finding)
- Tests: reader, ofx, import, import-banks, every golden-*.test.mjs and guesses-invariance: 186,295 run, 0 fail.
  tests/golden/** untouched by both commits (git diff empty); golden keys unchanged.
- Invariance: only three code files changed (core/ofx.js, ai/reader/compute.js, transactions/import/compute.js). The
  static import graph puts 7 compute modules downstream of them (ai/reader, overview/monthly-review, overview/plan,
  reports/annual-review, transactions/import, transactions/statements, system/docs). Every one of them on 1,423 plans
  (every qa/fixtures *Plan builder, 4 Get started personas, every qa/households archetype with every pack, the 5
  phone-built households, the empty plan): 9,961 compute outputs, base vs head, 0 differ. Every other module's code and
  import closure is byte-identical, so its output is too. (A full every-module run exceeded 15 min and was stopped.)
- Said = done, L7 (l7b.mjs): Casey's stub -> 401(k) $110.77 biweekly = $2,880.02 a year, Roth $55.38 = $1,439.88 into a
  new "Casey's Roth 401(k) at work" (limitKind 401k), match $2,880.02 on the pay-the-tax-later row only. Federal
  pretax401k after = 2,880.02, Roth 1,439.88 not excluded. Same stub again: all five "same".
- Splits keep the total: Lee (Roth-only stub, $150/month on file as pre-tax): after the $0 offer and the Roth row,
  own money 1,800.00 -> 1,799.98 a year; federal: Lee pre-tax 1,800 -> 0, Roth 1,799.98. Match ($1,560) on the $0
  pay-the-tax-later row, never on Roth (D-C2).
- Engine: a $0 401(k) row with a match is still projected (projection/compute.js:939 yearly = own + match > 0).
- L8 notice = plan: "Chase checking's balance is now $4,512.36 as of 11/12/2026" and the plan holds 4512.36 asOf
  2026-11-12, old 4,200 kept as a 2026-11-11 point. Money in $4,621 / out $1,824 hand-summed from the file (4,621.10 /
  1,824.24).
- Law (opened on law.cornell.edu): IRC 402A(c)(2) "Designation limits" (Roth and pre-tax share one deferral limit:
  supports the Roth 401(k) counted against the 401(k) limit); 402(a) (taxed when distributed: the match is
  pay-the-tax-later by default); 402A(a)(2) as added by SECURE 2.0 s.604 (a Roth match is a plan option). Correct.
- OFX fields: NAME is GenericNameType, maxLength 32; FITID maxLength 255 (OFX 2 schema OFX_Common.xsd, opened via the
  ofx4j copy on raw.githubusercontent.com; ofx.net's PDF returned 503). TRNAMT signs and LEDGERBAL/DTASOF read right.

## Findings (most severe first)

### M1 (5) L7: a catch-up line is dropped, and the page offers to lower the person's 401(k) saving
Steps: Robin (nearRetiree, 63, $600 a month on file) -> #/ai/reader?kind=paystub -> paste a biweekly stub with
"401(k) 4.00% 107.69" and "401(k) Catch-Up 166.15" (273.84 a paycheck = $7,120 a year) -> Read it.
Evidence: card "Robin's 401(k), pay the tax later. Now: $600.00 every month. Would be: $107.69 every two weeks. That is
$2,800 a year instead of $7,200." with "Use it" (shots/robin-390-k401.png, robin-320-k401.png, robin-320-dark-k401.png,
robin-390-dark-k401.png). "Found in it" lists only $107.69; the catch-up line is not mentioned anywhere. After the Use it
taps the plan holds 107.69 biweekly ($2,799.94 a year) and Will the money last? goes from "runs out in 2057 (age 94)" to
"runs out in 2055 (age 92)" (robin-390-before.png, robin-390-after.png). The same with Roth: a stub with "ROTH 401K 200.00"
and "ROTH CATCH UP 207.69" reads Roth $200 (l7a.mjs, "catch-up fields 2"); from 2026 SECURE 2.0 s.603 makes a high
earner's catch-up Roth, so a second Roth line becomes common. readFields takes the first matching line per field
(compute.js readFields `findIndex`), which the build log noted as an edge but nothing on screen says.
Fix: for k401 and roth401k, add every line that matches the field (each line's first money, still skipping loan, match
and employer lines), and list the parts in "Found in it" ("401(k) $107.69 + catch-up $166.15"). Until then, when a second
matching line exists, say "This stub has another 401(k) line ($166.15, catch-up) that is not counted" and offer no
"Use it" for that field. Test: Robin's stub gives k401 273.84; the Roth pair gives 407.69.

### M2 (4) L8: another bank's file is put on the plan's only account of that kind, and its balance overwrite is pre-ticked
Steps: family fixture (Chase checking, institution "Chase", $4,200) -> Import -> pick rv/doc/files/Prairie7351_Activity.qfx
(ORG "Prairie Bank").
Evidence: "Your bank's download for Checking ending 7351 (Prairie Bank) ... Chase checking is your only checking account,
so it is picked above." The filled "Import 10 transactions" with "Also set Chase checking's balance to $4,512.36, the
bank's figure on 11/12/2026 (on file: $4,200.00)" ticked by default (shots/prairie-390.png, prairie-320-dark.png). One
tap: Chase checking's balance becomes 4,512.36 as of 2026-11-12 and its 10 lines are Prairie Bank's
(walk-log.json "prairie-390"). guessOfxAccount returns why "kind" without looking at ORG once one account of the kind
exists; the box is `checked: true` for every guess.
Fix: when the guess is "kind" and the file names a bank (ORG has a word of 3+ letters) that is not in the account's name or
institution while the account has an institution, do not pre-pick (the amber "Check the account" line), or at least say
"The file is from Prairie Bank; Chase checking is at Chase". Pre-tick the balance only when the guess is "holds" or
"name" or the person picked the account; else leave it unticked. Test: this file on the family plan -> no pre-tick.

### M3 (3) L8: lines brought in from a CSV are added again from the QFX of the same days
Steps: family plan with qa/fixtures/chase-checking.csv already imported into Chase checking -> Import -> pick the same ten
lines as the bank's QFX (rv/doc/money/files/Chase0421_Activity.qfx: NAME cut at 32 characters, the OFX maximum, the rest
in MEMO).
Evidence: "Its lines are already on Chase checking, so it is picked above." then the filled "Import 2 transactions": "Amazon
Mktpl Amzn -$42.17" and "Transfer Sav -$500.00", money out $542 (shots/csv-then-qfx-390.png). After the tap the account
has 12 lines: both the CSV's "Online Transfer to SAV ...5566 transaction#: 9981" and the QFX's "Online Transfer to SAV
...5566 t" for -$500 on 8/29, and both Amazon lines (walk-log.json "csvThenQfx"). dedupe matches an id'd line to a no-id
line only by the full key, whose payee part differs once a description is longer than 32 characters.
Fix: an incoming line with an extId and no id match is also a duplicate of a no-id line on the same account with the same
date and amount whose normalized payee starts with the incoming one's (or, simpler, same account, date and amount, one
for one). Test: chase-checking.csv then this QFX -> add 0.

### M4 (3) L7: an HSA employer match is read as the 401(k) match
Steps: Jamie (noMatch, "no match" on file) -> #/ai/reader?kind=paystub -> paste a stub whose Employer Contributions list
"HSA ER Match 25.00" before "401(k) ER Match 83.08".
Evidence: "Jamie's employer's match. Now: no match on file. Would be: $25.00 every two weeks, about $650 a year" with
"Use it" (shots/hsa-390-match.png); the right figure is 83.08 x 26 = $2,160. Use it also turns workPlans.match to true.
The match labels' first pattern `\b(er|employer|company)\b...match` takes the first such line, whatever benefit it is for.
Fix: add HSA, FSA, health, dental, vision and life to the match field's skip pattern, and try the 401(k)-specific match
labels before the generic one. Test: this stub reads match 83.08.

### M5 (2) L8: a re-download whose FITIDs changed adds every line again
Steps (code, l8a.mjs): import a QFX of 10 lines; import the same lines again with other FITIDs.
Evidence: "first QFX added 10 ; same lines, new FITIDs: add 10 skip 0". The base key-only dedupe on the same second file
adds 0. dedupe never checks the key of an id'd line against id'd lines on file ("another id = another line"), though the
spec says the FITID is "checked before key". Whether a given bank changes FITIDs between downloads was not checked here.
Fix: after the id pass, match by key as a multiset: an id'd line with no id match is a duplicate while the plan holds as
many lines with that key as the file does. Two $4.50 coffees in one file still both come in; a re-download adds 0.

### M6 (2) L8: a card with a credit balance is offered as money owed
Steps: family -> Import -> rv/doc/money/files/Maple_credit.qbo (charges negative, BALAMT 25.17, a $6,445.16 payment).
Evidence: "Also set Visa card's balance to $25.17 owed, the bank's figure on 11/11/2026 (on file: $6,400.00 owed)",
ticked (shots/card-credit-390.png). The card is $25.17 in credit; net worth would be $50.34 too low. balanceOffer uses
|BALAMT| for every debt.
Fix: in a card file whose charges are negative (the sign the import already relies on), owed = -BALAMT; when that is
below 0 say "a credit of $25.17" and do not pre-tick (or store it as a credit).

### M7 (2) L7: a semimonthly stub for Feb 16-28 is counted as 26 paychecks
Steps (code, l7a.mjs): a stub "Pay Period 02/16/2027 - 02/28/2027" with no frequency words.
Evidence: period "biweekly" (13 days <= 14), so the 401(k) and the match it writes are x26 instead of x24 (+8.3%). The
date rule predates L7, but L7 now writes 401(k) rows and the match from it, and the "How often are you paid?" box does
not appear because a period was inferred.
Fix: a period that starts on the 1st or 16th and ends on the 15th or the month's last day is semimonthly; or show the
"How often are you paid?" box whenever only the dates decided.

### M8 (1) L7: pay and withholding changes are shown in whole dollars but saved to the cent
Evidence: "Would be: $231, every two weeks" (shots/hsa-390-match.png) and "$198" (robin-390-k401.png) while "Found in it"
says $231.40 / $198.00 and the plan gets 231.40. The build fixed this for the 401(k) lines only.
Fix: fmtVal uses fmt.money(v, cur, undefined, 2) for perPaycheck and amount on a pay stub.

## Safari (not walked: Chromium only). Try on the real iPhone
- Import: readAsArrayBuffer and TextDecoder("windows-1252") on a 1252 QFX with an é or ’; the Files picker with the
  broad accept list (no greyed .qfx/.qbo/.ofx, a file saved as "download").
- Reader: a stub copied from a PDF in Safari/Files: whether line breaks survive (one long line reads no 401(k) lines).

Servers: the one on 9741 was stopped by the kit's stop(); the review worktree rv/v-doc-money and rv/base-fa removed.
