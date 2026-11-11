# Retirement contributions  (`retirement/contributions`)

**Status:** usable (phase 5)
**Purpose:** What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits.

## Inputs
`retirement.contributions` `[{ id, accountId, personId, amount, period, employerMatch (yearly) }]`, `accounts` (the account's type decides the bucket and the limit kind), `household`. Writes: `retirement.contributions`.

## Outputs
`items[]`, `yearly`, `matchYearly`, `totalYearly`, `byPerson[]` (`limits[]`: kind, label, limit incl. catch-up, used, over, catchUp, year of the figures), `limitsYear` (the newest year that has every kind), `kindYear`, `limits` (`limitsFor(year)`), `hsa` (`hsaPicture`), `warnings[]`, `hasData`.

## Shared helpers (exported from `compute.js`; every page that needs a limit uses them)
- **`limitsFor(year)`** -> `{ year, kinds: { "401k", ira, hsa, fsa }, kindYear: { kind: table year }, rothPhaseOut, rothPhaseOutYear, giftExclusion, giftExclusionYear, fullYear, complete }`. Each kind comes from the newest year of `data/limits.js` at or before `year` that has it; a year before the first table takes the first. The IRS publishes the HSA limits in the spring (Rev. Proc. 2026-24, dated 2026-05-29, for 2027) and the 401(k), IRA, FSA, Roth IRA and gift figures in October and November (none of 2027's by 2026-10-31), so a 2027 date gets 2027's HSA figures and 2026's others, and `kindYear` says which. Never read `LIMITS[year]` directly: a partial year has only some kinds.
- **`iraDeductPhaseOut`** (round 8, in `data/limits.js` for 2025 and 2026): the traditional IRA deduction's MAGI ranges for someone covered by a plan at work (`covered`: single and head of household, joint, separate) and for someone not covered whose spouse is (`spouse`), IRC 219(g)(3)(B) and (g)(7). 2026: 81,000-91,000, 129,000-149,000, 0-10,000; spouse 242,000-252,000 (Notice 2025-67, IR-2025-111, read 2026-11-06); 2025: 79,000-89,000, 126,000-146,000, 0-10,000; spouse 236,000-246,000 (Notice 2024-80, IR-2024-285, read 2026-11-06). Read through `investments/limits` `iraDeductRanges(year)` (the newest year at or before it); used by the Federal estimate's IRA deduction (`known.js` `iraStep`) and the Limits page.
- **`catchUpFor(def, age)`**: the catch-up for the age reached in the year (`def` = one kind of `limitsFor(year).kinds`): 401(k) from 50 (IRC 414(v)(5)(A)), the 60-63 amount instead in the years a person reaches 60, 61, 62 or 63 (414(v)(2)(E)(i), 11,250 in 2025 and 2026, Notices 2024-80 / 2025-67); IRA from 50 (219(b)(5)(B)); HSA 1,000 from 55 (223(b)(3), not indexed). 0 when the age is not known; the health FSA has none.
- **`hsaPicture(plan, year, { contributions })`** -> `{ year, kindYear, coverage, coverageChosen, coveredId, shared, base, catchUpAmount, catchUpAge, typed, rows, people: [{ id, name, role, age, eligible, catchUp, rowsPayroll, rowsEmployer, payroll, employer, used, limit, room, over, excess }], household: { limit, catchUp, payroll, employer, used, room, over, excess } }`. `contributions` is this page's `items` (or its `compute()` result); left out, they are read from the plan. Under IRC 223:
  - *Cover* (`taxes.hsa.coverage`): `"none"` no high-deductible plan, so nobody may have money in an HSA (223(b)(1): the limit counts only months the person "is an eligible individual"; 223(c)(1)(A)(i): eligible means covered by a high deductible health plan); `"self"` only the covered adult (`taxes.hsa.coveredId`, else the adult marked "Me", else the first adult); `"family"` every adult. Left out or unknown: read as `"self"`, the old default (`coverageChosen: false`).
  - *Money*: each adult's own HSA rows, amount + employer match (employer money "reduce[s] the amount you or any other person can contribute", Pub. 969; 223(b)(4)(B)); the HSA page's typed `contribution` and `employer` where they are more than all the HSA rows put together go on the covered adult (or "Me"), so a plan that types only the HSA page still works. A row that names no adult goes on its account's owner, else on that adult.
  - *Limit*: an eligible adult gets the self-only or family amount (`data/limits.js`: 4,300 / 8,550 in 2025, Rev. Proc. 2024-25 s.2.01(1); 4,400 / 8,750 in 2026, Rev. Proc. 2025-19 s.2.01(1); 4,500 / 9,000 in 2027, Rev. Proc. 2026-24 s.3.01(1)) + their own catch-up; others 0. Married (joint or separate) with family cover, the two spouses share one family limit (223(b)(5): "the limitation ... (without regard to any additional contribution amount ...) shall be divided equally between them unless they agree on a different division"; Pub. 969: "Each spouse must make the additional contribution to their own HSA"): each spouse's limit = own catch-up + max(0, family - max(0, the other spouse's money - the other spouse's catch-up)), the most that spouse could have given the other's money (answer key `tests/golden/limits/RULES.md` 5.4). Adults who are not married to each other each get the whole family amount. `room = max(0, limit - used)`, `over = max(0, used - limit)`; spouses sharing the limit can both show the same dollars over.
  - *Excess*, the money that is really over (taxed as pay, 106(d)(1) "to the extent such amounts do not exceed the limitation under section 223(b)"; Pub. 969 "Excess contributions made by your employer are included in your gross income"): `over` per adult, except for spouses sharing the family limit, who split it the way that leaves the least money over and, among those, nearest to equal halves (223(b)(5)'s default; RULES.md convention 6). Household excess = the sum; it can be more than the household's `over` when a spouse 55 or over does not use their own catch-up, which cannot go into the other's account.
  - *Household*: limit = the cover amount + the catch-ups of the eligible adults (0 without cover); used = all the money; room, over against it.
  - Not modelled: the month-by-month limit for part-year cover (223(b)(2)), Medicare ending eligibility (223(b)(7)), a general-purpose FSA ending eligibility (223(c)(1)(A)(ii); the HSA page warns).
  Checked against the answer key's `hsa_*` columns (3,000 households, `tests/golden/limits/households.csv`): every per-adult and household figure agrees when the plan names its cover.

## The match question (2026-11-02)
Next best action asks about the employer match when an adult is paid and has a 401(k) with nothing going in; the Dashboard's
button then reads "Check if Bo's job matches retirement saving" and opens this page. The page asks it as one question
with three answers, so the move is done here: "Yes: add what Bo puts in" opens the add form with Bo and that 401(k) chosen;
"No match at Bo's job" saves `retirement.workPlans[personId].match = false`; "That 401(k) is from a job Bo left" saves
`accounts[].formerJob = true`. Both are optional fields (DATA_MODEL), shown under the question with a Change button that
takes them back. With two or more 401(k)s the question lists them and has one "<account> is from a job Bo left" button
each; "Yes" picks the account whose name does not say old, former, previous, prior or rollover. The confirmation names the new next move from the Dashboard's list. A new contribution's account box starts
on a retirement account (not a brokerage one, not an old job's 401(k)).

When every 401(k) a paid person has is from a job left (`newJob` in the ask), the question is about the job now: "Does
Bo's job now have a retirement plan with a match?", with "Yes: add Bo's new 401(k)" (opens Net worth, where accounts are
added) and "No plan or no match at Bo's job" (saves `retirement.workPlans[id].match = false`).

## Is it enough? (2026-11-02)
Under the yearly total the hero says the share of pay (own money and employer money over salary and bonus) and the plan's
own answer from Will the money last? (overview/setup `standing().retire`, the Dashboard's): "That is 12% of your pay, your
employers' money included. At this rate the money lasts to the end of the plan: you are on track. Will the money last? ›"
(tight: "lasts, with little to spare"; short: "runs out at about 84: saving more is the surest fix"; no Social Security
yet: "Once Social Security is in the plan, this says whether that is enough").

Review fixes (2026-11-02): the share of pay counts business income (what a SEP or solo 401(k) is based on), as How am I
doing? does (a mixed household read 36% instead of about 18%; a fully self-employed one got no share). The "Once ... is in
the plan" sentence names what is missing (birth dates or Social Security) instead of always asking for Social Security.

## Formulas
- Yearly = amount x times per year (`core/math/periods.js`) + employer match.
- Limits (`data/limits.js`, IRS, read through `limitsFor`): 2026: 401(k)/403(b) 24,500 (+8,000 from 50; 11,250 from 60 to 63), IRA 7,500 traditional and Roth together (+1,100 from 50), HSA 4,400 self-only (+1,000 from 55; 8,750 family). 2025 also listed; 2027 has only the HSA so far (4,500 / 9,000, Rev. Proc. 2026-24 s.3.01(1)). The HSA row of each person is `hsaPicture`'s: it follows the HSA page's cover (a spouse outside self-only cover has a limit of 0 and is told why; spouses with family cover share the family limit). The age reached in the year is what counts. A Roth account counts as a Roth 401(k)/403(b) (with the 401(k) limit, IRC 402A(c)(2)) when it has an employer match or its name says 401(k), 403(b), 457 or TSP; otherwise as a Roth IRA (the IRA limit, 408A(c)(2)) (`limitKind`). An employer's 401(k) match is outside the elective-deferral limit; an employer's HSA deposits share the HSA limit (IRS Pub. 969, Employer contributions).

## Tests
`tests/retirement-pages.test.mjs`: totals, match, catch-up limits, an over-limit warning. `module.test.mjs`: `limitsFor` (2024 to 2030, the partial 2027), `catchUpFor` (every age band), `hsaPicture` (RULES.md 10.4's shared family limit, self-only and no cover, typed money, unmarried adults), the HSA rows.

## Ideas / not yet
- The overall 415(c) limit; after-tax 401(k).

## Independent answer-key audit

`tests/golden/retirement/contributions.csv` contains 2,200 invented cases (22 rules;
60 grid, 30 edge and 10 extreme cases each). Its rules, exact flattened layout,
rounding and worked second checks are in
[`tests/golden/retirement/briefs/contributions.md`](../../../tests/golden/retirement/briefs/contributions.md).
The independent generator `tools/golden_retirement/contributions.py` uses Decimal
and rational arithmetic without executing application code. Every tenth case is
checked again with repeated addition, a direct total-cap table, remaining room or
a conservation identity. Money is written to cents; replay tolerance is 0.005.

The statutory source checks are [IRS Notice 2024-80](https://www.irs.gov/pub/irs-drop/n-24-80.pdf)
for 2025 employee/IRA limits and [Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf)
for 2026. The self-only HSA cap is 4,300 in 2025 and 4,400 in 2026; family caps are
8,550 and 8,750 respectively, from [Rev. Proc. 2024-25 §2.01(1)](https://www.irs.gov/pub/irs-drop/rp-24-25.pdf)
and [Rev. Proc. 2025-19 §2.01(1)](https://www.irs.gov/pub/irs-drop/rp-25-19.pdf).
[Publication 969](https://www.irs.gov/publications/p969), Additional contribution,
supports the age-55 additional 1,000. The future-year answer key freezes the newest
published figure of each kind rather than inventing future law: 2026's, and for the HSA
2027's 4,500 ([Rev. Proc. 2026-24 §3.01(1)](https://www.irs.gov/pub/irs-drop/rp-26-24.pdf),
dated 2026-05-29, read 2026-10-31; the key's generator and lead audit were updated
2026-10-31 and the 33 future-year HSA rows regenerated). All balances in the fixtures are invented
worked examples, whose arithmetic and source are in each row's note.

**Fixed 2026-10-30 (F-030):** employer HSA deposits now count toward the HSA limit (Publication 969: employer payments reduce what the individual may contribute), so a 2026 self-only HSA at age 40 with 4,400 from the individual and 100 from the employer uses 4,500 against the 4,400 limit and is over by 100. Employer 401(k) money remains outside the elective-deferral limit; the separate overall defined-contribution cap is not modelled. The HSA cover now comes from the HSA page (`hsaPicture`); the key's cases name none, which reads as self-only cover of the adult marked "Me".

## Review 2026-11-06 (round 7): you and your
- Review 2026-11-06 (round 7): the match question and its answers (view.js) say you/your for the unnamed first adult and "your spouse" for Get started's partner ("Does your spouse's job add money when your spouse saves ..."), via `core/words.js`; record titles ("Me: 401(k) / 403(b)") keep the name as a label. No compute change.

## Round 8 (2026-11-06): no 401(k) on file yet (item 1)
Next best action's match step now also lists a paid adult with no 401(k) of their own (`ask[]` entries with
`noAccount: true`, `kind` "known" | "plan" | "ask" and Work benefits' figures in `match`). The question card for one:
- match known (tiers typed on Work benefits): "Start Jasmine's 401(k) and get the whole match", with what it takes ("Putting
  in 3% of pay ($45 a paycheck, about $38 less take-home pay) gets $1,170 a year from the employer") and one button,
  "Start it at 3%": a $0 401(k) named "Jasmine's 401(k)" (ownerId that person, dated today) and the contribution row
  (amount = the year's amount / paychecks to the cent, period by paychecks: 52 weekly, 26 biweekly, 24 twice a month, 12
  monthly, else once a year with the year's amount; employerMatch = the match a year). Notice: "Jasmine's 401(k) is
  started: $45 a paycheck goes in (3% of pay) and the employer adds $1,170 a year. Tell human resources or the benefits site the same 3%."
- otherwise: "Does Priya's job have a retirement plan with a match?" with a common match's worth, and three answers: "Yes:
  start Priya's 401(k)" (the $0 401(k), then the add form opens on it with Priya and every two weeks; no amount is saved
  until one is typed), "No plan or no match at Priya's job" (`retirement.workPlans[id].match = false`), and "Not sure"
  (shows where to look; nothing is saved).
The card is shown for the match step whatever its status but done (it was only for "check"). The hero says "No retirement
account yet: the question below starts a 401(k) at work in one tap" and the empty form card is gone while there is no
account (it showed an empty card under "First add the retirement accounts themselves on the Net worth page"). Tests:
module.test.mjs "round 8 item 1".

## Round 8 batch 2 review fixes (2026-11-06)
Tests: module.test.mjs "round 8 review" and the updated item 1 tests.
- **Words that say what the app does (UX 8).** The hero: "No retirement account yet: one tap below adds your 401(k) to the
  plan." After a start: "Added to your plan: $45 a paycheck (3% of pay), and the employer adds $1,170 a year. To actually start
  it, sign up at 3% with human resources or your job's benefits site." The button for "is there a plan?" is "Yes: add X's 401(k)".
- **The cost before the tap, the month after it (UX 2, money D2).** When the month has less than starting the match takes
  (Next best action's `costShort`), the card shows Next best action's sentence ("This takes about $83 a month from take-home
  pay, and about $3 is left each month: put the $50 a month extra on Visa card (Pay off debts) toward it instead ... and trim
  about $30 a month of spending"). The confirmation adds `leftWords`: "Each month is now about $80 short: lower the $50 extra on
  debts (Pay off debts) or trim spending to make up for it."
- **No question after "Yes" (UX 3).** "Yes: add X's 401(k)" adds the $0 401(k) and saves `retirement.workPlans[id].match =
  true` (the answer Get started saves to the same question; "A plan with a match at X's job" can be taken back with Change).
  From then, and for any 401(k) on file with nothing going in and a typed match, the card is "Start what goes into X's 401(k)
  and get the whole match" (typed) or "How much goes into X's 401(k)?" (a plan, the match not typed), with "Start it at 6%" (a
  contribution on that 401(k): the year's amount at the match's share of pay / paychecks, to the cent; the employer's match
  only when typed on Work benefits, else 0 and "type what the employer adds once you know it") and "Type my own amount" (the
  form, filled in with that amount, and a line saying so). No "That 401(k) is from a job X left" about the 401(k) just added.

## Follow-up 2026-11-07 (HSA verify R1)
`compute()` reads `hsaPictureMedicare` (taxes/federal/hsa-medicare.js, the picture the HSA page and the return use), so someone on Medicare has an HSA limit of 0 here too, and the
warning says why ("Ruth: on Medicare all year, and once you are on Medicare you cannot add to an HSA. 4,400 goes in, this year's limit is 0. Change it on the HSA page."; in the
year someone turns 65, "on Medicare from July ... (only the months before Medicare count)"). The two files import each other (hsaPicture / hsaPictureMedicare); both are only
called at run time, so the cycle is harmless.

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- **F4.** "Type my own amount" (and tapping a row) opens a guessed amount or match grey: an empty box, the guess as its placeholder, "leave it empty to keep it". A blank box keeps the guess as the person's figure. `applyContributionEdit` ends both guesses on any save, equal to the guess or not (spec S2).
- **F5.** The row shows "(5% of pay)" for a share chosen in Get started (`pctOfPay`).

## Stress test 2026-11-11 (claude-e, wave 2)
- "The plan adds these every year..." (not a page title as a noun) and one 44 px button "See if the money lasts ›" in place of a
  16 px link (R-A8, FF8).

## Landings, the match check, and the answer after a save (2026-11-11, owner's request; spec L3)
The card "What this rests on" on Will the money last? (`modules/retirement/levers.js`, see `projection/README.md`) links here
onto the box that holds the figure. Tests: `module.test.mjs` "L3: ..." (real UI kit on the fake DOM), `tests/levers.test.mjs`
"L3 ...".

- **`?add=<pid>`** ("Type what goes in ›"): `workLanding(plan, pid)` picks the row. With nothing of the person's own going in (a
  $0 row, or none on their 401(k)), the form opens on that row (or a new one into it) **filled in with the change the card ran**:
  `usualShare` of pay a month plus the usual match at that share (`workAlt`, kind "usual"), and a line "Filled in with the change
  we tried on your retirement answer: 6.6% of pay ($396 a month), the usual for pay like Casey's, and the usual match, about
  $2,880 a year. Change both to Casey's own figures ...". Saving it as it is gives the card's answer (said = done; tested on
  Casey: 67 → 88). A figure of the person's own, or our grey guess, is never typed over: the line names the change instead, in
  the row's own period ("1% of pay more: $140 every two weeks instead of $115"). With no 401(k) on file, the question card
  above (the one that adds it) is scrolled to instead.
- **`?match=<rowId>`** ("Check the match ›"): the row opens on "Employer adds, a year", focused and selected, with "Most
  employers that match add about 4% of pay when you put in 6% (Vanguard, How America Saves 2026): about $2,040 a year for
  Jamie at what goes in now. Type the real figure ..." (`matchLanding`: the usual match at all the person's own money at work,
  the card's own figure; the formula typed on Work benefits instead when there is one).
- A link lands once per arrival (the route object, as `?show=` on Assumptions): the box is brought to the middle of the
  screen after the first paint, focused with `preventScroll`, and outlined for 2 seconds (a rule scoped to the form's card,
  put in only then). A link to someone or a row not in the plan lands nowhere.
- **The match check** (`matchChecks`): a row into a plan at work with money of the person's own going in, no match on it (not
  our guess), and `retirement.workPlans[pid].match` never answered gets "No match on file. Is that right?" with **That's
  right** (filled; saves `workPlans[pid].match = false`, the answer Get started and "No match at X's job" save, and it can
  be taken back with Edit), **It matches** (opens the row on the match box, focused in the tap so a phone opens its
  keyboard) and **Not sure** (where to look; "Until it is answered, the plan counts no match"). One question at a time: not
  while a question card above is showing. A match said with `workPlans[pid].match === true` and none typed is not asked
  here (the card's match row reads "Not counted" and links to the box).
- **The answer after a save.** Every save on this page goes through one `update`, which keeps the retirement answer before it
  (`answerOf`: one projection at average markets, the same as Will the money last?'s verdict). The notice after it adds
  "Your retirement answer: now runs out at 76 (was 66)." (`answerChangeWords`: "now lasts to the end, age 95 (was: runs out
  at 66)", "still lasts to the end, with about $41,000 more left at 95 (today's dollars)", "still runs out at 70" when what
  goes in changed and the age did not; nothing when the save changed no contribution and the answer did not move, or when
  the plan has no answer yet). A notice with this line stays; a plain "Contribution saved." still goes after 4 seconds.
- **D-A4 (copied from the spec): "the usual" comes from sourced tables only.** The match cards' "common match" words now
  read the guesses' own table, `matchTerms()` (`overview/guesses/estimators/saving.js`: Vanguard, How America Saves 2026,
  median match value 4% of pay, earned in full at 6% put in): "Most employers that match add about 4% of pay when you put in
  6% (Vanguard, How America Saves 2026): about $2,280 a year for Priya" (`usualMatchAt`, rounded as the guess is: whole $10 a
  month, twelve of them; was "A common match, 50% of what you put in up to 6% of pay ... $1,740"). The 50%-up-to-6% tiers
  (`career/benefits/compute.js:24`) are a second, older convention still used for the "Start it at 6%" amount and by Next
  best action's own words (claude-f's file); they are not used for "the usual match" on this page or the card.
- **D-A6 (copied): writes from the card.** The card on Will the money last? writes only the leftover answer (L4); every
  other row links to the page that owns the figure, landing on the box, as above.

## The money left over, as a row of its own (2026-11-11, owner's request; spec part B, L4)
Will the money last?'s card asks "What happens to the $X left over each month?" in place (`projection/README.md` "The money
left over each month, answered in place"). "Invested for later" and "It stays in the bank" write one ordinary row here,
`leftover-<n>`: monthly, employer match 0, the lead earner's, into a brokerage or a savings account (one on file, or a new $0
"Investments for later" / "Savings for later"). It is listed, edited and removed like any other row.
- **D-B1 (copied).** Default unchanged: not counted until the person answers; no silent change to anyone's answer.
- **D-B3 (copied).** The row's `personId` is the lead earner, so it stops at that person's retirement age; it grows with pay
  raises, as every row does.
- **D-B7 (copied).** "Into which account" also lists a checking or savings account that a row already uses, so a "stays in
  the bank" row can be edited here. New rows into cash accounts are made only by that answer (a new row on this page still
  starts on a retirement account, never a bank one).
- Removing the row also removes the answer (`retirement.leftover`), so the card asks again and every figure is as before it;
  the notice says what that did to the retirement answer, as for any save here.
- An **invested** row is saving out of pay to every page: Next best action's left-over takes it off (`con.yearly`), so the
  left-over the Dashboard shows drops by the row's amount; nothing is counted twice.
- A row into the **bank** (a checking, savings or cash account: `isBankAccount`, the projection's cash bucket, `BUCKET_OF[type]
  === "cash"`; the test holds the two lists together) is money that stays in checking and savings (review 2026-11-12, M3: the
  Dashboard said it "goes into retirement", Benchmarks counted it as 11% of pay saved for retirement, and the emergency fund
  lost its date, though the money sits in the very savings account that is the cushion). `compute` leaves it out of `yearly`,
  `matchYearly`, `totalYearly` and each person's limits, and gives it as `bankYearly`; so every page that reads those sums (Next
  best action, the Dashboard, Benchmarks, this hero) counts it where it is, in the bank. The projection still counts it, in the
  cash bucket at the cash rate (said = done with the card). The hero says it on its own line ("$530 a month stays in Savings
  for later, counted for later") and the row reads "stays in the bank, counted for later".
