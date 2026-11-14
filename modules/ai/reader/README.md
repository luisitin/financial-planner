# Document reader  (`ai/reader`)

**Status:** usable (phase 8; a W-2, a 1099 and last year's return since 2026-11-14, gap design #23)
**Purpose:** Paste (or pick) a pay stub, an account statement, a Social Security statement, an advisor's plan, a W-2, a 1099 or last year's tax return: the page finds the figures in it, shows what each would change in the plan (now, and what it would become), and changes nothing until you tap "Use it" on each one.

## Inputs
The document's text: pasted, a `.txt` file read in the browser, or a PDF's text layer read on the PC (`POST /api/document/text` in `server/server.mjs`, pdf.js through `server/statements.mjs` `pdfPages`; scans and photos are refused there and pointed to the Statements page, whose vision model reads pictures). The plan (people, income, contributions, accounts, Social Security, advisor). The text is held in the page's memory only; it is never saved.

Writes (one accepted proposal at a time, `applyProposal` inside `store.update`): `income[]` (the person's salary amount and period, or a new salary line), `taxes.withholding.self|partner`, `retirement.contributions[]` (the person's 401(k) rows: the amount and period of the pay-the-tax-later row and of the Roth 401(k) row, the employer match on the pay-the-tax-later row; a missing row, and a missing $0 account for it, are made), `accounts[]` (that $0 account), `retirement.workPlans[personId].match: true` (the stub shows a match) and `.plan: true` (money goes in from the paycheck), an account's `balance`, `asOf` and `history` point, `retirement.socialSecurity[personId].monthlyAtFRA`, `advisor` (changes, fee, quoted chance; compared on scenarios/advisor-plan). From a W-2, a 1099 or last year's return (gap design #23, below): `taxes.thisYear.wages | withheld (+ withheldTyped) | otherOrdinary | qualifiedIncome | taxExemptInterest | iraWithdrawals`, a row added to `taxes.gains`, `taxes.priorYear { agi, tax }`, and a W-2's 401(k) money on the same `retirement.contributions[]` rows a pay stub fills.

Opened with `#/ai/reader?kind=paystub` (Will the money last?'s "Read it from a pay stub ›", 2026-11-11) the page starts on a
pay stub: its heading is "Read your pay stub", the box asks for the stub, and the kind is not guessed. `&person=<id>` picks
whose stub it is. Both are taken once per arrival (the route object, as `?show=` landings are); text kept from an earlier
visit that is another kind of paper is cleared then. A plain arrival (`#/ai/reader`) with nothing pasted opens the general
page again. The link from Will the money last?'s card is built with that card (L2, the retirement track); this page only
answers the address.

## Outputs
`compute(plan, { text, kind, personId, accountId, today, extra, typed, jobRowId, accountFor })` -> `{ kind, detected, fields, found: [{ key, label, unit, value, parts? }], missing: [labels], proposals: [{ id, op, label, before, after, ...target }], stub }`. `stub` (a pay stub only): `{ personId, who, ask, other, noPeople, period, periodWhy, payOnFile, stubYearly, odd, jobs, jobRowId, own: { stub, file }, unread, noPlanLine }` (see "Round-1 review" below).
`workRows(plan, personId, { jobRowId })` -> `{ later, now, laterAcct, nowAcct, jobs, laterChoices }`: the person's own 401(k) rows (see below).
`hasPreTaxLine(text)` -> whether a stub has a pay-the-tax-later plan line at all, read or not.
`readPlanLines(lines, gross)`, `stubLines(text)`, `stubPeriod(text, start, end)`, `whoseStub(plan, text, fields, asked)`, `ownLimit(person, today)`, `moneyIn(text)`: the pieces of a pay stub's reading, each tested on its own.

## How it reads (no model needed)
- `detectKind`: keyword scores (net pay / gross / YTD / pay date; social security / full retirement age; probability of success / assumptions / inflation / advisor; ending balance / statement period).
- `readFields`: for each field of the kind, the first line matching one of its label patterns and not one its `skip` pattern names; the value after the label, else on the next line (unless that line is one the field skips). Money: the first amount with a `$`, thousands commas or cents (bare whole numbers, such as years and ages, are skipped; a number followed by `%` is a rate, never money, so "401(k) 6.00% 243.00" reads 243.00), brackets or a minus sign for negatives; so on a pay stub the "current" column comes before "YTD". Percent: `6.5%` -> 0.065. Dates: `MM/DD/YYYY`, `YYYY-MM-DD`, `Month D, YYYY`, `D Mon YYYY`; a day that does not exist (2026-02-31) is no date; for a statement date or a period end, the last date of a range.
- Pay frequency (`stubPeriod`, changed 2026-11-12): the pay period's dates first (the 1st to the 15th, or the 16th to the month's last day: twice a month; the 1st to the last day: monthly; else by length: 6 to 8 days weekly, 13 or 14 every two weeks, 15 or 16 twice a month, 28 to 31 monthly); else the words: "biweekly" / "bi-weekly" / "bi weekly" / "every two weeks" and "semi-monthly" / "semi monthly" / "twice a month" anywhere, "weekly" or "monthly" only on a line that also says pay, paid, frequency, schedule or cycle. When the dates and the words disagree the dates win. Neither: the pay on file decides when exactly one rhythm fits it (below), else the person is asked.
- An advisor's spending stated per year is divided by 12.

## A pay stub's 401(k) lines (2026-11-11, the owner's request)
Pay stubs list the 401(k) money in separate lines, and those lines are exactly the inputs the retirement answer rests on
("maybe they didn't input how much they contributed ... the match"). No bank link returns a deferral or a match; the stub does.
- Three fields, read apart (`readPlanLines`; the line rules were tightened on 2026-11-12, see "Round-1 review"):
  - `k401`, "401(k), pay the tax later": a line that names the plan (`PLAN_WORDS`: 401(k), 401K, 403(b), 457(b), TSP,
    thrift, deferred comp, retirement plan, retirement savings) and does not say Roth, match, employer, ER, company,
    agency, loan, after-tax, wages, earnings, eligible, taxable, hours, rate, balance, vested or limit. The old pattern
    `/40[13]\s*\(?[kb]\)?/` also caught "ROTH 401K" and read it as pre-tax.
  - `roth401k`, "Roth 401(k), pay the tax now": a Roth line that names the plan ("Roth 401(k)", "401K Roth", "Roth TSP")
    or starts with Roth and goes on only in a deduction's words before its figure ("ROTH CATCH UP", "Roth 55.38", "Roth EE
    Deferral 2%"); never the employer's, a loan, an IRA or a wages line. "Roth" inside a name ("Casey Roth") is not one,
    nor a business named Roth ("ROTH & SONS FREIGHT  Check 10443.00", fix round 2).
  - `match`, "Employer match": a line that names the plan and the employer ("401(k) ER Match", "Employer 401(k)", "ER
    403b", "TSP Agency Match"); when the stub has none, a "match" line that names the employer, ER or the company
    ("Company Match"). Never another benefit's line (HSA, FSA, health, dental, vision, medical, life, stock, charity,
    gift, insurance, disability). Printed on some stubs only.
- Each becomes an `op: "work"` proposal on the person's own rows (`workRows`): `later` is the first row into a `401k` account,
  `now` the first row into a `roth` account that Contributions counts as a Roth 401(k) (`limitKind` "401k": a match on it, or
  401(k), 403(b), 457, TSP or thrift in its name). An account from a job the person left (`formerJob`, or named "old",
  "former", "previous", "prior" or "rollover") is never this paycheck's plan.
- A row that does not exist is proposed too (`make`): "row" into an account of that kind the person owns with no row yet,
  else "account": a new `{ type: "401k" | "roth", name: "<Name>'s 401(k) at work" | "<Name>'s Roth 401(k) at work",
  balance: 0, asOf: today, ownerId, history: [] }` ("Your ..." for the first adult left unnamed) and its row `{ amount,
  period, employerMatch: 0 }`. The "401(k)" in the Roth account's name makes Contributions count it against the 401(k) limit
  (IRC 402A(c)(2)), not the IRA's. Using a proposal looks the row up again on the plan as it is then, so the person can tap
  the three in any order and never gets two accounts of a kind.
- Amounts: a paycheck's figure and the stub's period (`period`), written as the row's `amount` and `period`; a year is
  `perYear(amount, period)` (core/math/periods.js: 52, 26, 24 or 12 paychecks). A row typed as a share of pay loses its
  `pctOfPay` (it is dollars now).
- The match: `employerMatch` is a yearly figure, so the stub's match a paycheck times the paychecks a year
  (`perYear(match, period)`, to the cent). It always goes on the pay-the-tax-later row: most plans add the employer's money
  as pay-the-tax-later (IRC 402(a); a Roth match is only an option a plan may offer, SECURE 2.0 Act section 604). A match
  typed on the Roth 401(k) row moves there (it is set to 0 on the Roth row, so it is never counted twice), and a $0
  pay-the-tax-later row is made for it when none exists. Using a match above 0 sets `retirement.workPlans[id].match: true`,
  so an earlier "no match" answer no longer holds. Using money going in above $0 (either 401(k) line) sets
  `retirement.workPlans[id].plan: true`: a stub with a 401(k) deduction shows the job has a plan, so Get started's "No" gives
  way; the match answer on file is left to the match line, since a stub without one does not say there is none.
- A Roth-only stub: when the stub has a Roth line and no pay-the-tax-later line at all (`hasPreTaxLine` false: not even one
  whose figure was unreadable) while the plan has money going into the pay-the-tax-later row, the money on file may be this
  same Roth money: Get started's "Through work" always saves a 401(k), so Roth money is often on file as
  pay-the-tax-later. ONE card asks (the Roth proposal carries `move`): "Lee's 401(k) money is Roth on this stub ... Is the
  money on file this same Roth money?" with two outlined answers. "Yes, it is the same money" applies the Roth row and
  sets the pay-the-tax-later row to $0 in the same change (`zeroLater`); "No, both go in" adds the Roth row and leaves the
  other. Neither is the filled button: it is the person's answer. (Before 2026-11-12 this was a second card, "none on this
  stub", whose "Use it" slid under the thumb when the first was used.)
- How often you are paid: the stub's period dates or its words; a stub that says neither takes the rhythm that fits the pay
  on file, and is asked ("How often are you paid?", four chips above the changes) when none or several fit. It is always
  said in one line above the changes ("Dana's pay stub, paid twice a month · Change").

Decisions followed (spec of 2026-11-11, `retirement/contributions/README.md` holds them):
- D-C1. Words: "Pay the tax later" and "pay the tax now". Never "deferred", "free" or "bucket" on screen.
- D-C2. The match is "later": until the match rule (L9) lands, nothing here ever puts a match on a Roth row.

Guesses and figures already on file (2026-11-11):
- A row's amount or match that is our guess (`isGuess`, the guesses ledger) reads "(our guess)" in "Now:", so a guess is
  never shown as the person's own figure. Using a document's figure drops the guess entry on every path it writes
  (`clearGuess`: the row's `amount` and `employerMatch`, a moved Roth match, an account's `balance`, Social Security's
  `monthlyAtFRA`): the figure came from the person's own paper.
- `alreadyOnFile(x)` (`same: true`): a change that would change nothing that counts is said as "Already on file: ... Nothing
  to change." with no "Use it": the same pay a year to the dollar (a $72,000 salary read as $2,769.23 every two weeks is
  $71,999.98), the same withholding a paycheck and period, the same 401(k) money a year, the same match a year with none on
  the Roth row, the same balance and date, the same Social Security amount. A guess on file is never "already on file".
- A pay stub's lines in "Found in it" are shown to the cent ($110.77), as printed, so they read the same as the changes.

On the screen: the first plain change not used yet is the one filled "Use it"; the rest are outlined. A question (the Roth
card), a doubted figure, a match with none of the person's own money, a second job's withholding, and every change while a
caution stands (the pay looks like the other adult's; this paycheck is not like the usual one) are never the filled button.
Each "Use it" says so where it was tapped, and the card stays in its place for the visit with what it changed ("Was: $250.00
every month ($3,000 a year). Now: $123.08 every two weeks ($3,200 a year)." and "Casey's Roth 401(k), pay the tax now:
saved. Casey's Roth 401(k) at work is on Net worth › at $0: type its balance there. What you save for retirement › shows
it.", the page names as links). After a 401(k) or match change an outlined "See if the money lasts ›" follows the cards.

## Simple first (the owner, 2026-11-12 and 2026-11-13: "it should stay simple by default")
Each choice, and where the rest went (nothing was removed; opening or closing a fold never changes the plan):
- **The landing** is one box and one filled "Read it". Picking a text file (or a PDF on the computer) and the list of what
  the page finds sit behind a quiet "More options". The privacy line stays in view.
- **Once read**, the page opens on "What it would change". The pasted text folds away at the bottom ("The pay stub you
  pasted · Paste another"): the box, "Read it" again, "Clear" and "More options" are inside.
- **At most three changes** show (`FIRST`), in this order: the 401(k) you pay the tax on later, the Roth 401(k), the
  employer's match (the money lines the owner asked about; the match, a hint worth money, is never folded), then the pay,
  then the tax taken out. The rest wait behind one quiet fold that says what it holds ("1 more change: tax taken out").
  A used or doubted change never hides behind it: the fold starts after the last card that must be seen.
- **Already on file** is one quiet line with the figures ("Already on file, nothing to change: Casey's pay, $72,000 a
  year."), not a card per figure.
- Whose stub it is and how often it pays stay one quiet line with "Change"; when both were worked out from the pay on
  file, why is said in one line, not two ("This looks like Dana's pay stub, paid twice a month: $3,250.00 x 24 is Dana's
  $78,000 a year. Change it above if that is wrong."). A question the stub and the plan cannot answer is asked as chips
  above the changes; "What the app read on it" stays folded (open when nothing else shows).
- **The Roth-only question** keeps its two outlined answers in view; what each answer does to the plan is one tap away
  under "What each answer does".
- **The own-money total** ("This stub: $X a year of Jamie's own money. On file now: ...") is said only when the stub has
  two own-money lines (the 401(k) and the Roth 401(k)), since one card already says both figures; it turns amber once a
  card was used and the two still differ (review M12).
- A fold opened on this visit stays open when the page is drawn again after a "Use it" (kept in the page's memory, never
  saved), so a change used inside a fold keeps its confirmation in view. "What the app read on it" is such a fold too
  (fix round 3, F3): "Ask the AI to find the rest", tapped inside it, keeps it open with the AI's answer or its error
  (a red notice that says to look at Settings) under the button, and its summary says "5 of 9, the AI did not answer" or
  "7 of 9, 2 from the AI", so a closed fold still tells what it holds. Its count may wrap under the heading at 320 px.

## Round-1 review (2026-11-12): what a pay stub's reading rests on
Every rule below answers a confirmed finding of the first review round (three critics: money, person, break); each has a
test in `module.test.mjs` named by the finding.

Reading the lines (`readPlanLines`, `stubLines`):
- **Every line of a kind is added** (M2). A catch-up is its own line ("401(k) Catch-Up 166.15", "ROTH CATCH UP 207.69"):
  Robin's stub is 107.69 + 166.15 = 273.84 a paycheck, x 26 = $7,119.84 a year, not $2,800. From 2026 a high earner's
  catch-up must be Roth (IRC 414(v)(7), added by SECURE 2.0 Act section 603), so a pay-the-tax-later
  line and a Roth catch-up line on one stub is the usual layout over 50. The same line printed twice (same words, same
  amount) counts once. The parts are kept (`found[].parts`) and shown: "401(k) $107.69 + catch-up $166.15".
- **What comes off the pay is read as its size** (M5, P3, B10): a stub may print a deduction as -166.15 or (110.77). The
  federal tax, 401(k), Roth and match figures are `Math.abs` of the line's figure.
- **A line's amount** is its first money figure. After "% of" it is the last figure on the line ("401(k) 4% of 2,769.23
  110.77" is 110.77). A first figure that is the share of pay printed without its % sign is passed over: when gross pay
  was read and first x gross / 100 is within 2 cents of the next figure ("401(k) 4.00 110.77" with gross 2,769.23: 4 x
  2,769.23 / 100 = 110.77) (M14).
- **A line with no figure takes the next line's only when that line holds no letters** (a stub copied cell by cell). A
  heading ("401(k) Plan") or a share-only line ("401(k) 4%") never takes the dollars of the line under it (N3); the page
  then says the stub has a 401(k) line it could not read (`stub.unread: "line"`) and offers a box to type it.
- **A wages line is not money going in** ("401(k) Eligible Wages 2,769.23"), nor an hours, rate, balance or limit line (M14).
- **Under a "Current ... YTD" heading**, a plan line with one figure where the gross pay line has two may be the
  year-to-date figure: nothing is read (`stub.unread: "ytd"`) (B9).
- **The match** is the plan's own employer line when there is one; another benefit's employer line never is (M6: "HSA ER
  Match 25.00" above "401(k) ER Match 73.85" reads 73.85, x 26 = $1,920.10 a year).
- **A stub pasted as one line** (fewer than 3 line breaks in more than 80 characters, a copy from a PDF) is cut where a
  figure is followed by a new label (a capital letter, or the plan's name) and read line by line again (P7).

A figure that cannot be right (`suspect`, M14, N3, B9): a proposal for the person's own money or the match gets no "Use it"
when its amount is half the gross pay or more ("pay": a wages line, the whole paycheck), or, for the person's own money,
when a year of it is above the most a person may put in (`ownLimit`: the 401(k) limit plus the catch-up for the age they
reach this year, from `limitsFor` and `catchUpFor`: $24,500, $32,500 from 50, $35,750 at 60 to 63 in 2026; IRC 402(g)(1),
414(v)(2)) ("limit": likely the year-to-date figure). The card says which, and a "Set my own number" fold takes the amount
from one paycheck; a typed number (`typed`) is the person's and is not checked.

Whose stub it is (`whoseStub`, M7, P2): the person the page was opened or set for; else the only adult whose name is in
the text as a word; else the only adult whose pay on file is within 2% of gross x pay periods (each of the four rhythms
when the stub does not say); else the only adult with pay, or the only adult. Two adults with pay and nothing to tell
them apart: the page asks "Whose pay stub is this?" (two chips) and proposes nothing until the person says. When the
page's person is set and the stub's yearly pay is more than 15% from their pay on file and within 2% of another adult's,
an amber line says so, one tap switches, and no "Use it" is filled. Every card names its person ("Dana's pay", "Lee's
federal tax taken out of each paycheck").

How often it pays, when the stub does not say (P4): the rhythm whose gross x periods (52, 26, 24, 12) is within 2% of the
person's pay on file, when exactly one fits ("Taken as twice a month: $3,250.00 x 24 is Dana's $78,000 a year. Change it
above if that is wrong."); none fits: every proposal has `needsPeriod`, shows the paycheck's figure only, and waits for
the answer (no silent "every two weeks"). When the rhythm is known from the stub and gross x periods is more than 15%
from the pay on file (`stub.odd`: a bonus, overtime, unpaid days), an amber line says the yearly figures would assume
every paycheck is like this one, and no "Use it" is filled.

The person's own money a year on the stub and on file (`stub.own`, M12): `perYear(k401 + roth401k, period)` beside the
sum of the person's pay-the-tax-later and Roth 401(k) rows; one line above the 401(k) cards, amber once a card was used
and the two still differ (using only the Roth card of a stub would count the saving twice).

Which rows (`workRows`):
- Two jobs (B8): a person with two rows into 401(k) accounts gets "Which job is this pay stub from?" (chips; the default
  is the row whose yearly amount is nearest the stub's), each card names the account, and the pay card goes to the salary
  line nearest the stub's pay a year (named when there are two). The plan keeps one withholding figure per person, so the
  withholding card says to add both jobs' tax together and is never the filled button.
- A 401(k) nobody owns (N4): Net worth saves "Joint or shared" as no owner. With no account or row of the person's own,
  such a 401(k) that no other adult pays into is this paycheck's when the household has one adult or it is the only one;
  using the change makes the person its owner. Several: the card asks "Which account is it?" (each, then "A new one").
- No adult on the plan (B11): nothing is proposed and the page says to add yourself on People first (before, every
  re-read added another "Your pay").

No retirement line at all (P9): with pay and take-home read and no plan line of the person's own, a card with no button
says what the stub shows ("This pay stub shows no money going into a 401(k). That matches what is on file ($0)." with an
outlined "See what putting some in would do ›"), or, when the plan says money goes in, that no line was found.

A line printed as $0.00 this paycheck (fix round 3, F1: "401(k) 0.00 1,200.00"). A line of the person's own that reads
0.00, with no own line above $0 and none left unread, is said on the same card (`stub.noPlanLine` with `zeroLine: true`,
`sides`, `ytd`, `set`), never passed over:
- nothing on file for it: "This pay stub shows $0.00 going into the 401(k) this paycheck ($1,200.00 so far this year).
  That matches what is on file ($0)." with the outlined "See what putting some in would do ›";
- money on file: in amber, "... ($1,200.00 so far this year); the plan says $3,000 a year. If you stopped, change it on
  What you save for retirement ›, or set it to $0 here." with an outlined "Set it to $0" (never the filled button; a
  caution never is). It sets only the rows on file for the $0.00 lines that hold money to $0 (their period kept, the
  match left as it is, said in its confirmation), as `op: "work"` changes through `applyProposal`; the card then reads
  "Was: $250.00 every month ($3,000 a year). Now: $0." and is never folded away.
- "so far this year" (`readPlanLines(...).ytd`): the line's second figure, only when the gross pay line also prints two
  figures (this paycheck, then the year so far, the common two-column layout) and every line of that kind has two.
- Only the stub's own lines count: a 0 the AI gives for a line the stub does not have is not a $0.00 line. A line under
  "Current ... YTD" with one figure stays the unread case (B9), never $0.

Known, not in this page's files (M13, posted for claude-c): a Roth 401(k) row this page makes carries no match (D-C2), and
`retirement/projection/compute.js` counts a row as "at work" only when its account is a `401k` or the row has a match, so
that row does not stop when the job's pay ends. The fix is there: `atWork` should also be true when
`limitKind(acct.type, acct.name, c.employerMatch) === "401k"`.

## The AI (optional)
"Ask the AI to find the rest": `buildPrompt` asks for the missing fields as JSON (null when not stated, never account numbers); `parseAnswer` keeps only known keys, checks numbers and dates and turns percents into fractions. AI figures are marked "from the AI: check it" and, like every figure, reach the plan only through "Use it" (docs/PLAN.md AI policy).

## Edge cases
- No account chosen for a statement: no balance proposal.
- Account numbers are not read or kept, and the page says so ("Account numbers on it are never read or kept."); the AI is told not to return them.
- A pay stub with a 401(k) and no row for it on file: the row (and a $0 account) is proposed (before 2026-11-11 it needed an existing row).
- A person with two jobs: the page asks which job the stub is from (the row nearest its figure is the default); the other job's row and pay line are left alone.
- A pasted stub that is not read yet is kept while the app is open (Back and Forward do not lose it); it is never saved.

## Tests
`module.test.mjs`: money, percents and dates (a rate is never money, a day that does not exist is no date); the kind from the words; a pay stub (current column, frequency from dates); a statement, a Social Security statement and an advisor's plan; proposals and applying each; the AI answer's parsing and `extra` fields. The 401(k) lines (2026-11-11): pre-tax, Roth, loan and match read apart, the old "ROTH 401K read as pre-tax" case; a Casey-like household (a $0 row) filled, a Roth 401(k) account made whose `limitKind` is "401k", the match on the pay-the-tax-later row and `workPlans.match: true`, the same stub again making nothing; no 401(k) at all, in either tap order the same plan with one account of each kind; a Roth-only stub's $0 offer (and none when a pre-tax line is there or nothing is on file); a match on a Roth row moved, never counted twice; an old job's account left alone, "Your" for the unnamed first adult; no account-number digits in the fields, the proposals or the plan after use; `plan: true` when money goes in (and never for the $0 offer), the match answer left alone without a match line; "Your pay" for the unnamed first adult; already on file (pay a year to the dollar, the same stub read twice), a guess shown as one, never "already on file", and dropped when the stub's figure is used. Round-1 review (2026-11-12), one test per finding: M2 catch-up lines added (273.84, the Roth pair 407.69, a line printed twice once); M3 the five frequency stubs and the dates over the words; M5/P3/B10 minus and bracket layouts; M6 the HSA line; M7/P2 whose stub (pay, name, asked, the other adult's pay); P4 the rhythm from the pay on file, `needsPeriod`, a bonus paycheck; P7 a one-line stub; P9/M12 no plan line and the own-money totals; M14/N3/B9 wages, a rate with no % sign, "% of", a heading, a surname, the year-to-date figure, `suspect` and `ownLimit` (24,500 / 32,500 / 35,750), a typed number unchecked; N2 TSP, 457(b), thrift, deferred comp, "Retirement Plan" and the plan words against `limitKind`; N4 an unowned 401(k); B8 two jobs; B11 no adult; the Roth-only stub's one card, "the same money" and "both go in". Fix round 3 (F1): the year so
far beside this paycheck's figure (only with a two-figure pay line); a $0.00 401(k) line with $0 on file and with $250 a
month on file (one change sets only that row to $0, period and match kept, `workPlans` untouched, read again it matches);
a $0.00 Roth line, both lines at $0.00, a $0.00 line beside a Roth line above $0, a one-figure line under "Current YTD",
and a 0 from the AI.

## A W-2, a 1099 or last year's return (gap design #23, 2026-11-14)
Three more kinds of paper (`forms.js`, pure; its words in `form-words.js`, pure; its screen in `forms-view.js`). The kind is
guessed from the words, as for the others (`formScores`, added after the four older kinds so a tie keeps the old guess:
`tests/reader-invariance.test.mjs`), or picked; `#/ai/reader?kind=w2 | f1099 | f1040` opens the page on one.

**Read by words, not line numbers.** Each figure is the amount after its box or line WORDS (`readLabeled`): the 2025 Form 1040
renumbered its lines (adjusted gross income is "11a ... This is your adjusted gross income", 11b repeats it, line 15 "This is
your taxable income" subtracts line 14 from 11b, line 24 "This is your total tax"; before 2025 it was line 11), so a line
number is never relied on. In the part of the line after the label (`amountIn`): references ("line 10", "lines 22 and 23",
"box 2a", "Schedule 1") and dot leaders go; a number with a letter after it is a box or line ("11a", "1d"); a bare whole
number is skipped when it is the label's own box or line number, a year, or the next box's number; the last figure left is
the amount (brackets or a minus: negative, kept only for the adjusted gross income). A label with no amount after it takes
the line under it: the figure in the label's place when that line is a row of figures under a row of labels (a form copied
box by box: "1 Wages ... 2 Federal income tax withheld" over "94,900.00 9,120.00"; only figures with a $, commas or cents
count, so a ZIP code is no figure), or its one figure when it holds no words. The words of the form's other boxes are known
(`IGNORE`) so a row of labels pairs with its row of figures and one box's words never stand for another's.

- **W-2** (Form W-2, 2026; General Instructions for Forms W-2 and W-3, 2026, "Box 12 codes"): box 1 "Wages, tips, other
  compensation", box 2 "Federal income tax withheld", box 5 "Medicare wages and tips"; box 12 (`box12`, each code once, since
  a W-2 is often pasted with its copies B, C and 2): D (401(k) elective deferrals), E (403(b)), G (457(b): "elective deferrals
  and employer contributions (including nonelective deferrals)", so G may hold the employer's money) add up as money put in
  before tax ("pay the tax later"); AA (Roth 401(k)), BB (Roth 403(b)), EE (Roth governmental 457(b)) as Roth ("pay the tax
  now"); W "Employer contributions to a health savings account (HSA) ... (including amounts the employee elected to
  contribute using a section 125 (cafeteria) plan)". The rest (DD, the cost of health coverage, and every other code) is not
  read. A code is a capital letter pair standing alone before an amount on a box 12 line, so "D" inside "Deferral" is none.
- **1099** (Forms 1099-INT and 1099-DIV, Rev. January 2024; 1099-B, 2026; 1099-R, 2026), alone or in one combined broker
  statement: 1099-INT box 1 "Interest income", box 3 "Interest on U.S. Savings Bonds and Treasury obligations", box 8
  "Tax-exempt interest"; 1099-DIV 1a "Total ordinary dividends", 1b "Qualified dividends", 2a "Total capital gain distr.", 12
  "Exempt-interest dividends" (added to tax-exempt interest); 1099-B 1d "Proceeds" and 1e "Cost or other basis", read apart
  under a line that names "short-term" or "long-term" alone (box 2's printed words name both, and a tick does not copy as
  text, so they decide nothing), a "Total" line first; 1099-R box 1 "Gross distribution", 2a "Taxable amount" (only on a
  1099-R: the same words are on other forms; never "Taxable amount not determined"); box 4 "Federal income tax withheld" on
  any of them, the distinct amounts added (a combined statement prints one per form).
- **Form 1040** (2025, and the years before): "adjusted gross income", "taxable income", "total tax" (each first as "This is
  your ...").
- **The year** (`formYear`): "Tax year 2025", "For calendar year 2025", "For the year Jan. 1-Dec. 31, 2025", else a year on the
  line that names the form ("Form W-2 Wage and Tax Statement 2025"), else one in its first three lines; a revision ("Rev.
  January 2024"), a print date or a year after this one is none. A form that does not say is taken as last year's (a W-2 or a
  1099 comes after the year it covers; a return is read for last year's), the page says so, and "Which year it is for" changes
  it. None of the changes resting on such a year is the filled button.

**Identifiers never come in** (`scrub`, run on the text before anything is read, on what is kept for the visit, shown in the
box and sent to the AI helper): nine digits as 3-2-4 (dashes or spaces) and their masked forms ("XXX-XX-1234"), 2-7 (an
employer number), a masked account number ("XXXX1234"), a run of seven or more digits that is not an amount, and the digits
after a label that names one (social security number, SSN, TIN, EIN, identification number, account, control or routing
number). Every result is built from a fixed list of keys (`FORM_FIELDS`, the proposals' and checks' own keys), so none can be
proposed, kept or shown; the AI is told to give none back, and `parseAnswer` keeps only known keys and drops a figure of nine
digits or more on a tax form. Tests build such numbers from pieces at run time; the leak guard's allow file is not touched.

**Which year's figures a form may change.** The Federal estimate works out one year: `taxes.year`, else this year (its "Tax
year" box). A W-2 or 1099 for that year can fill that year's boxes; one for another year never changes them (owner's design
rule: "Last year's W-2 never overwrites this year's figures"). So:

| form | what it proposes (each one field, each by its own "Use it") | when |
|---|---|---|
| W-2 | box 12 D+E+G a year on the person's pay-the-tax-later 401(k) row, AA+BB+EE on the Roth 401(k) row (`op: "work"`, `period: "annual"`; a missing row and a $0 account are made, as for a pay stub) | only when nothing goes in on file or only our guess: a figure the person set stays, and a line says what the W-2 shows against it |
| W-2 | box 1 to `taxes.thisYear.wages`, box 2 to `withheld` (with `withheldTyped: true`, as the Federal estimate's own Save writes it) | only a W-2 for the Federal estimate's year |
| 1099 | interest (INT 1 + 3) and dividends that are not qualified (DIV 1a - 1b) to `otherOrdinary`; DIV 1b to `qualifiedIncome`; tax-exempt interest (INT 8 + DIV 12) to `taxExemptInterest`; 1099-R 2a to `iraWithdrawals`; box 4 to `withheld` | only a 1099 for the Federal estimate's year; one of another year says so and how to switch the Federal estimate's year |
| 1099 | a row on Capital gains (`taxes.gains`): capital gain distributions (DIV 2a, as a long-term gain with no cost), each term's 1099-B sales with their cost | the same; sales whose term or cost is not on the form are not added, and a line says so |
| Form 1040 | `taxes.priorYear { agi, tax }` (Estimated payments' safe amount) | only the return of the year before the Federal estimate's |

- **Never replaced, added to.** A box of the Federal estimate that already holds a figure the person typed is not replaced:
  the change would make it that figure plus this form's (`adds`), the card says so ("Now: $94,900 typed. Would be: $157,300,
  the $94,900 and this W-2's $62,400. If the $94,900 already holds this W-2, leave this."), and it is never the filled button.
  This is how the second W-2 of a couple or the second bank's 1099-INT goes in. The same figure already there is "already on
  file" (a form read twice). Our guess there is replaced. A W-2's wages or tax taken out while another adult has pay says that
  the Federal estimate keeps one figure for the household, and is never the filled button.
- **Counted twice?** Interest and dividends while the Income page has dividends and interest (`investment` items), or a
  1099-R's taxed part while it has a pension, carry an amber line that it may count them twice, and are never the filled
  button. Income and the Federal estimate are not changed by one another here: which is meant is the person's call.
- **What a W-2 says with nothing to use** (`checks`): the pay before tax ("about": box 5 leaves out what was taken from pay
  for health coverage; without box 5, box 1 plus D, E and G) against the pay on file (within 15%: "close to"; none on file:
  add it on Income); a 401(k) figure the person set against the W-2's; the HSA money through work (code W) against the HSA
  and FSA page. Code W is NOT written to the employer's HSA money, as the design first said: the IRS says W holds the
  employee's own cafeteria-plan money too, and a W-2 cannot tell the two apart, so the line names both and links the page.
- **Whose W-2** (`formFacts`): the adult the page was set for; else the only adult; else the only one named in it; else the
  only one whose pay on file is within 10% of its pay before tax; else the only adult with pay; else "Whose W-2 is this?"
  (chips) and nothing is proposed until the person says. A 1099 and a return are the household's.
- `formProposals` never reads text into a proposal: each holds only figures, ids and fixed words.

**On the screen** (`forms-view.js`, drawn by view.js once a form is read; the landing and every other kind of paper are drawn
exactly as before, and opened with nothing read the page is the same page). Simple first:
- **First view:** "What it would change" with one quiet line saying whose form and which year, and what that year means ("Ana's
  W-2 for 2025. It covers 2025, so it fills in only what the plan does not have yet." / "..., the year the Federal estimate
  works out."); the changes as cards (the money of the year first: last year's return, the 401(k), the Roth 401(k), wages, tax
  taken out, interest, dividends, sales, withdrawals), then what the form says with nothing to use; three cards, then "N more
  figures" (`rest()`: never fewer than three folded, never a used card or an amber one); what agrees with the plan in one
  quiet line ("Already on file, nothing to change: Ana's pay, about $101,400 a year.").
- **One filled button:** the first plain change's "Use it". Never filled: a change that adds to a typed figure, one with an
  amber line, the household's wages or tax taken out while another adult has pay, one resting on a year the form does not say.
- **Each "Use it"** writes its one field (`applyProposal`), and its card stays in its place saying "Was: ... Now: ..." with a
  green line naming the new figure and the page that shows it ("Saved: $94,900 of wages for 2025. Federal estimate › shows the
  tax with it."), also once the plan holds it; an outlined way on follows ("See the Federal estimate ›", "See Estimated payments
  ›", "See if the money lasts ›").
- **Questions:** "Whose W-2 is this?" as chips, when nothing tells (nothing is proposed until answered); nobody on People: "Add
  yourself on People first".
- **One quiet tap away**, as parts (`core/ui/more.js`; no `<details>` by hand on this screen): "The figures" (each box read, its
  box number, "from the AI: check it", "Not found: ...", the outlined "Ask the AI to find the rest"; it opens while the AI's
  error stands, and stays open after the AI answers); "How this is worked out" (the boxes, the year rule, identifiers, the IRS
  forms and the read date); and, last, "The W-2 you pasted · Paste another" (what it is, whose, which year it is for, the box
  with the text as kept: identifiers blanked, "Read it", "Clear", picking a file). A choice changed in it keeps it open (R17).
- The page's older screens (the pay stub, a statement, Social Security, an advisor's plan) keep their own folds; converting them
  to the parts helper is the opt spec's commit for this page (C19), not this design: view.js itself does not use the helper.

Sources, read on www.irs.gov on 2026-11-14: 2026 General Instructions for Forms W-2 and W-3 (https://www.irs.gov/pub/irs-pdf/iw2w3.pdf,
"Box 12—Codes"); Form W-2 (2026) (https://www.irs.gov/pub/irs-pdf/fw2.pdf); Form 1040 (2025) (https://www.irs.gov/pub/irs-pdf/f1040.pdf,
"Created 9/5/25": lines 11a, 11b, 15, 24); its instructions (https://www.irs.gov/pub/irs-pdf/i1040gi.pdf); Forms 1099-INT and 1099-DIV
(Rev. January 2024) (https://www.irs.gov/pub/irs-pdf/f1099int.pdf, https://www.irs.gov/pub/irs-pdf/f1099div.pdf), 1099-B (2026)
(https://www.irs.gov/pub/irs-pdf/f1099b.pdf), 1099-R (2026) (https://www.irs.gov/pub/irs-pdf/f1099r.pdf). The safe amount's 100% / 110%
over $150,000 ($75,000 filing separately) is IRC 6654(d)(1)(B)(ii) and (d)(1)(C), as taxes/estimated has it. Only facts (box and line
words) are taken from them; no code.

Tests (`module.test.mjs`, the cases named "#23"; `tests/reader-invariance.test.mjs`): a W-2 in three layouts with the plain
rules alone; box 12 (copies, codes not read, a capital inside a word, the parts D + G); a combined 1099 and a 1099-R; the 2025
and an older Form 1040 (references, dot leaders, line numbers, an amount on the next line, a loss year); the year (revision,
print date, a year to come, assumed, picked); the kind from the words, and the old papers' kinds; identifiers (built at run
time) in no output, no plan after every change, no AI prompt, dropped from an AI answer; last year's W-2 leaves this year's
figures alone, keeps a figure the person set, fills nothing or our guess; a W-2 of the Federal estimate's year, the second
W-2 added; a 1099 of that year, read again (already on file), the Income page's cautions, sales without a term or cost, a
1099-R untaxed or with its taxed part not said; a 1099 of another year; last year's return and another year's; each change
writes one field; whose W-2; every sentence (R5); on the screen: the landing as before and the ?kind= landings, parts only and
one filled button (the first-view check's own `structure()` and `handWritten()`, empty), "3 more figures", S11 (after a Use it
only that card changes, also once the plan holds it), the chips, the year changed inside the folded paper (it stays open), the
AI helper's error kept in view and its prompt without identifiers. Invariance: the reader's output for every paper it read
before, with each kind picked and each adult named, is byte for byte what it was (a digest per plan of 33 plans, written down
from the code before this design).

## Ideas / not yet
- Photos read by the vision model through the statements route.
- A retirement statement kind (vested balance, contributions this period and this year by source: pay the tax later, Roth, match).
- PDFs on the phone with pdf.js in the browser (Apache-2.0); try it on an iPhone first.
- More kinds: a mortgage statement, an insurance declarations page (fill Policies).
- A W-2's state boxes (15 to 17) for State tax, once taxes/state (claude-a's) reads a W-2's figures; a return's other lines
  (wages, interest, dividends) as ideas against the plan, as an advisor's tool reads a return.
