# Contribution limits  (`investments/limits`)

**Status:** usable (phase 7)
**Purpose:** This year's limits for 401(k)s, IRAs, HSAs, FSAs and 529 gifts against what is going in, the room left, how much each adult may put in a Roth IRA directly, and the deadlines.

## Inputs
- `modules/retirement/contributions/data/limits.js` (limits per year, catch-ups, the Roth IRA income ranges and the gift exclusion), read through `limitsFor(year)` and `catchUpFor` of `retirement/contributions`. Each kind comes from the newest year that has it, so a 2027 date has 2027's HSA figures (Rev. Proc. 2026-24 s.3.01(1): $4,500 self-only, $9,000 family) and 2026's others. `kindYear` says which year each kind's figures are from, each row carries its `year`, and `limitsYear` is the newest year with every kind.
- The Contributions page's items: what goes in, per person, with each item's `limitKind`.
- `hsaPicture` (the Contributions page's `hsa`): the cover in `taxes.hsa.coverage` and `coveredId`, plus each adult's HSA money.
- The Federal estimate's `taxInputs`: AGI, each person's pay and pre-tax 401(k) kept out of income, the traditional IRA deduction, the health FSA, and HSA money and excess per person.
- The Income page's other income, by person.
- `dueDay` of `household/calendar` for the filing date.
- `retirement.workPlans[personId].afterTax` and `.afterTaxToRoth` (optional; the two answers of "After-tax money into Roth", below), Get started's `.plan`, and `annualAdditions` in `data/limits.js` (the 415(c) limit: 70,000 for 2025, 72,000 for 2026).

## Outputs
- `people[]` with `rows[]` for the 401(k), IRA and HSA: `limit` (with catch-up), `catchUp`, `catchUpFull`, `catchUpCapped`, `used`, `room`, `over`, `accounts`, `hasAccount`, `year`. HSA rows also have `eligible`, `shared`, `payroll` and `employer`.
- `base`: the limits before catch-ups. `payKnown`: whether the Income page has any pay.
- `hsa`: `coverage`, `coveredName`, `shared`.
- `totals`, `fsa`, and `gift` (the exclusion and the five-year amount).
- `roth`: `filingStatus`, `livedApart`, `separate`, `year`, `phaseOut`, `magi` (one return; `null` on separate returns), `status` (one return; on separate returns the more limited spouse's), and `people[]`. Each person has `magi`, `status`, `full`, `reduced`, `traditional`, `roth`, `allowed` and `over`.
- `deadlines[]`, `notes`, `warnings` (Roth IRA money over what is allowed).
- Beside `compute()` (which is unchanged by it): `afterTaxRoom(plan, params, d)`, the room for after-tax 401(k) money per adult with a plan at work (below).

## Formulas
**401(k).** Money is sorted by the Contributions item's `limitKind`, not by account type. A Roth account is a Roth 401(k) when it has an employer match or its name says 401(k), 403(b), 457 or TSP. Its money counts against the 401(k) limit with the pre-tax money (IRC 402A(c)(2): Roth deferrals may not exceed the limit "over ... the aggregate amount of elective deferrals ... which the employee does not designate"). `hasAccount` uses the same test, with the account's largest match.
- limit = 402(g) amount + catch-up.
- Catch-up: from 50, or the 60-63 amount instead (414(v)(2)(B)(i), (E)(i)).
- The catch-up is at most the person's compensation less min(their deferrals, the 402(g) amount) (414(v)(2)(A)(ii): "the excess (if any) of (I) the participant's compensation ... over (II) any other elective deferrals").
- Compensation is the Federal estimate's `k401.people[].compensation`: the person's salary and bonus on the Income page, plus their business income for someone self-employed (415(c)(3)(B), 401(c)(2): earned income). When the Income page has neither for anyone, the page cannot know it and shows the whole catch-up.
- used = pre-tax + Roth 401(k); room = max(0, limit - used); over = max(0, used - limit). The employer match is not counted.

**IRA.** Traditional and Roth IRA money (limitKind `ira`) share one limit + catch-up from 50 (219(b)(5); 408A(c)(2)). The pay is assumed to cover it (as the answer key assumes).

**The traditional IRA deduction (IRC 219(g), round 8).** `iraDeduction({ traditional, full, magi, covered, spouseCovered,
filingStatus, livedApart, year })` -> `{ deductible, limit, rule, range, reduced }`: someone covered by a plan at work (an
active participant, 219(g)(5)) deducts the IRA limit (`full`, with the catch-up) less full x (MAGI - start) / (end -
start), the reduction rounded down to $10 so the limit left is rounded up (219(g)(2)(C)), at least $200 until the end
(219(g)(2)(B)), 0 from the end; the same `rothReduced` the Roth check uses. Not covered but married to someone who is:
the spouse range (219(g)(7)). Nobody covered: all of it. The ranges are `iraDeductPhaseOut` in
`retirement/contributions/data/limits.js` (`iraDeductRanges(year)`: the newest year at or before it): 2026 covered single
and head of household 81,000 to 91,000, joint and qualifying surviving spouse 129,000 to 149,000, separate 0 to 10,000;
spouse 242,000 to 252,000 (Notice 2025-67, IR-2025-111, read 2026-11-06); 2025 79,000 to 89,000, 126,000 to 146,000,
236,000 to 246,000 (Notice 2024-80, IR-2024-285, read 2026-11-06). Separate returns of spouses who lived apart all year
take the single range (219(g)(4)). `coveredAtWork(plan, personId)`: a Contributions row of theirs (or on an account they
own) into a 401(k), 403(b) or Roth 401(k), from pay or the employer's match; a pension at work counts in the law too and
is not on file (Batch 3 asks Get started). MAGI comes from the Federal estimate's figures (taxes/federal `known.js`
`iraStep`: AGI with the rentals' result and without the IRA and student loan deductions, 219(g)(3)(A)). The page's IRA
row carries `deduct` = `{ deductible, traditional, rule, range, magi }` when there is traditional IRA money, and says
"all of it comes off", "only X of Y comes off this year's income" or "none of it comes off" with the range, that the rest
goes in after tax (keep a record of it, Form 8606), and, when none comes off, what usually does better: a Roth IRA
directly when the adult is under the Roth limit, else the backdoor route. Checked against the answer key's `trad_ira_deductible` on its 2,900
rows of 2025 and 2026 (part `deduct`): all agree. Worked (joint, both covered, 2026, 7,500 in): MAGI 213,000 -> 0;
140,000 -> 7,500 - 7,500 x 11,000 / 20,000 = 3,375, the reduction 4,125 rounded down to 4,120 -> 3,380; 120,000 -> 7,500.

**HSA** (`hsaPicture`, IRC 223).
- With no high-deductible plan (`coverage: "none"`), nobody may put money in, so the limit is 0 and any money is over (223(b)(1), (c)(1)(A)).
- With self-only coverage, only the covered adult may (`coveredId`, else the adult marked "Me"). Everyone else has 0.
- With family coverage, every adult may.
- Each adult's own money counts: their HSA rows, the amount and the employer's deposits (223(b)(4)(B); Pub. 969 "You must reduce the amount you or any other person can contribute to your HSA by the amount of any contributions made by your employer"). The HSA page's typed money goes only where it is more than the rows, on the covered adult or "Me", never on each adult.
- Eligible adults get the self-only or family amount + their own $1,000 catch-up from 55 (223(b)(2), (b)(3)).
- Married people with family coverage share one family limit (223(b)(5)). Each spouse's limit = own catch-up + max(0, family - max(0, the other's money - the other's catch-up)) (RULES.md 5.4, example 10.4).

**Roth IRA, per person.**
- MAGI = the Federal estimate's AGI + the traditional IRA deduction it took (219(g)(3)(A): AGI "without regard to ... the deduction allowable under this section"; applied to Roth IRAs by 408A(c)(3)(B)(i)). It is worked to the cent. When the Federal estimate's figures hold income the Income page leaves out (`known().changed`: stock pay vesting this year, this year's required withdrawal, a business at its profit, rentals after costs), MAGI is their AGI + the IRA deduction they allow + the student loan interest deduction (round 8: Mo and Lin, 210,000 + 30,000 of pay and 105,000 of stock vesting, MAGI 318,000, so a Roth IRA of 0 each; it read 213,000). Filing separately each return gets its own part of that change (its AGI with and without them).
- **Filing separately** (two adults), each spouse's own MAGI is built from:
  - their pay less the pre-tax 401(k) kept out of income (up to limit + catch-up, from `taxInputs().k401`; 402(g)(1)(A));
  - less their own health FSA (`fsa` for the adult marked "Me", `fsaPartner` for the other; the answer key puts its one FSA on A's employer); typed wages are box 1, which already leaves out the FSA and HSA money, so nothing more comes off them;
  - less their HSA payroll money, plus their HSA excess;
  - plus the Income page's other income that names them;
  - plus half of the household's remaining income (typed income, gains and income that names no one). This halving is the answer key's convention, RULES.md 2.2 "half the other income". Pub. 501: "If you file a separate return, you generally report only your own income".
  - With typed wages, the wages are split by each spouse's share of the pay.
- Range: the joint range on a joint return. Filing separately, $0 to $10,000, unless the spouses lived apart all year (`taxes.livedApart`): then they are not treated as married and use the single range (408A(c)(3)(C) applying 219(g)(4); Pub. 590-A Table 2-1).
- Status follows Pub. 590-A Table 2-1's bands:
  - "ok" below the start, and at exactly 0 on the separate range ("zero (-0-)": the full amount);
  - "partial" from the start (above 0 on the separate range) up to the end;
  - "over" at or above the end.
- full = IRA limit + catch-up.
- reduced = full - (full x (MAGI - start) / (end - start), rounded down to $10). It is full at or below the start and 0 at or above the end. A result above $0 but below $200 becomes $200 (408A(c)(3)(A) and 219(g)(2)(B), (C); Pub. 590-A Worksheet 2-2).
- allowed = max(0, min(reduced, full - traditional IRA money)) (408A(c)(2)). Shown as "Ana can put up to $X in a Roth IRA directly this year".
- over = max(0, Roth IRA money - allowed). It warns of the 6% yearly tax on an excess (IRC 4973(a), (f)).

**Deadlines.** IRA and HSA money for a year can go in until the filing date (219(f)(3), 223(d)(4)(B), 408A(c)(6)): April 15 of the next year, moved to the next day that is not a weekend or a D.C. legal holiday (7503; D.C. Code 28-2701). `dueDay("<year+1>-04-15")` handles this; for 2027 money it is Tuesday April 18, 2028. 401(k) money must come out of pay by December 31.

**529.** The gift exclusion per giver per child, and five times it at once with the five-year election (2503(b); 529(c)(2)(B); Form 709 instructions).

## Edge cases
- No contributions: every limit shows full room, with a note.
- No adults on the People page: the Roth check shows one line, "You".
- A spouse outside self-only coverage, or anyone without a high-deductible plan, shows "None this year" with the reason and a link to the HSA page. If money goes in anyway, it shows as over.
- Self-employed income (Income page "business") counts as compensation for the 401(k) catch-up cap at its full figure, before the self-employment tax deduction, so a solo 401(k) is capped only when the business earns less than the deferrals.
- Filing separately with more or fewer than two adults: the household's MAGI is used for everyone.
- On a 2027 date the Roth IRA range is 2026's, and the page says so.

## Tests
- `module.test.mjs`: one test per formula above, using the worked examples of `tests/golden/limits/RULES.md` 10.1-10.4.
- `tests/investments.test.mjs`.
- `tests/golden-limits.test.mjs`: each adult's 401(k), IRA and HSA rows, the IRA row's deductible part (`deduct`, against `trad_ira_deductible`, round 8), and the per-person Roth MAGI, status and `allowed` against `roth_allowed`, all against the independent answer key.
- `module.test.mjs` (round 8): `iraDeduction` on the three worked cases and the spouse, separate and lived-apart rules; the Limits page on the equity household (Roth 0 each with the stock pay counted) and the IRA row's `deduct`.

## Ideas / not yet
- 529 state deductions by state; SEP/Solo 401(k) limits for the self-employed.
- The IRA limit capped by compensation (219(b)(1)(B), the spousal IRA 219(c)).

Review 2026-11-06 (round 7): "You can put up to ... in a Roth IRA", "You have no Roth IRA room left", "Only you are on the self-only high-deductible health plan. If your spouse is covered too ..." and the warning "Your 3,000 is going into a Roth IRA" ("Your spouse's 3,000 ...") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before ("Ben: 3,000 is going ..."; core/words.js). Test: "Review 2026-11-06 (round 7): the Roth IRA warning says your ...".

## The IRA deduction's words (round 8 review, 2026-11-06)
- **What comes out tax-free:** "The X put in after tax comes out tax-free later; what it earns is taxed" (Pub. 590-B: only
  the basis on Form 8606 comes back free of tax). It used to say the money "comes out tax-free later", which read as good
  as a Roth.
- **Joint income:** on a joint return the income the limit is tested on is said as "your joint income".
- **Moving to a Roth IRA:** when this adult is under the Roth IRA's income limit, the line adds that this year's
  contribution can still be moved to a Roth IRA before the return is filed. That is a recharacterization, IRC 408A(d)(6);
  Pub. 590-A (2025), "Recharacterizations": by trustee-to-trustee transfer "by the due date (including extensions)", read
  2026-11-06.

## After-tax money into Roth (gap list, next 60, item 28; 2026-11-15)
The "mega backdoor": some 401(k) and 403(b) plans take money after tax on top of the pre-tax and Roth money, up to the
yearly limit on all money going into a person's accounts in the plan, and let it be moved to Roth inside the plan or
taken out while the person still works.

**On screen.** Nothing new on the first view except one quiet row, and only when an adult has a 401(k) or 403(b) at work:
a one-row parts card after the Roth IRA card, "After-tax money into Roth" (kind `own`, title pinned in
`qa/first-view-lib.mjs` `PINNED_TITLES`: it holds two picks and no figure to type, so "Set my own numbers" would be
untrue). Its status is the room summed over the adults whose way is not closed, said "$56,730 if allowed" while an answer
is "Not sure" and "$56,730 of room" only once both are yes (`roomSays`, at most 19 characters for three adults: review o1
P1, most plans do not take after-tax money, so the figure is never shown as a promise), "no room left", "not possible",
or once an answer is given "N set by you" (R25). Opened, it says what this is in two sentences, then for each adult: the
room in the same words at the right of the name ("Closed", no figure, once the way is closed; "No room left"), the
answer (one sentence per case, with where to find out in the plan's own words), when no pay is on file the sentence that
the full limit is used and a 44 px link "Add pay on the Income page ›" (review o1 F4), how the room is worked out, the
usual 401(k) room still left, the catch-up, and two questions as chips, "Yes", "No", "Not sure" ("Not sure" on until
answered; the second question goes when the first is "No"; neither shows when there is no room). Then: "Only what the money earns before the move is taxed,
so moving it soon after it goes in keeps the tax small. This is information, not advice." and "Nothing here changes your
plan. The room uses what goes in from pay and from the employer, which you can change here:" with "What you save for
retirement ›" under it (a 44 px row). A tap saves at once
(`store.update`), the part stays open on the redraw (R17) and its green line names the new answer ("Saved. Ana's plan
takes after-tax money: up to $56,730 more could go in this year."). First view, before and after (node
qa/first-view-node.mjs investments/limits): retired couple 430 words / 32 figures both (no plan at work: no row, the
page's entry unchanged), family 395/28 -> 402/29, renter 331/20 -> 338/21, empty plan 293/11 both.

**Who.** `atWorkPlan(plan, personId, pay)`: a row of theirs this year (or on an account they own) into a 401(k) or Roth
401(k) at the current job, from pay or from the employer; else Get started's "Retirement plan at work?" (`workPlans[id].plan`:
No closes it, Yes opens it); else pay on file and a 401(k) or Roth 401(k) of their own at the current job (Retirement
contributions' `isLaterAccount` / `isNowAccount`: not marked from a job left, no "old", "former", "previous", "prior" or
"rollover" in its name). An account that names no adult is the first adult's. An account named 457, TSP or Thrift is
left out: a 457(b) plan or the Thrift Savings Plan is not a 401(k) or 403(b), which is what this route is about.

**Formulas** (`afterTaxRoom`, pure; `annualAdditionsFor(year)` reads `annualAdditions` in `data/limits.js`, the newest
year at or before it, the first before the table):
- cap = min(the 415(c) amount, the person's compensation), or the amount when no compensation is on file. IRC 415(c)(1):
  the lesser of the dollar amount and "100 percent of the participant's compensation". Compensation is the Federal
  estimate's `k401.people[].compensation` (pay, and business income for someone self-employed), as the catch-up cap reads it.
  With none on file (`payKnown` false) the person's words say so: "Ana's pay is not on the Income page, so this uses the
  full $72,000. If Ana earns less than that, the limit is all of Ana's pay." (review o1 F4).
- The amount: 72,000 for 2026, 70,000 for 2025. Notice 2025-67: "The limitation for defined contribution plans under
  section 415(c)(1)(A) is increased in 2026 from $70,000 to $72,000" (read 2026-11-15, https://www.irs.gov/pub/irs-drop/n-25-67.pdf);
  the IRS's COLA table, "Defined contribution plan limit 72,000 / 70,000" for 2026 / 2025 and nothing yet for 2027 (read
  2026-11-15, https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions).
- own = min(the 401(k) row's pre-tax and Roth money, the 402(g) amount); catch-up money does not count. The IRS's 401(k)
  limits page (read 2026-11-15, https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits):
  the limit "applies to the total of: elective deferrals (but not catch-up contributions), employer matching
  contributions, employer nonelective contributions, allocations of forfeitures", and "cannot exceed the lesser of: 100%
  of the participant's compensation, or $72,000 in 2026 ($80,000 including catch-up contributions or up to $83,250 for
  those age 60 to 63)". catchUpIn = min(catch-up, max(0, the row's money - the 402(g) amount)).
- employer = the employer's money a year on the person's 401(k) rows (the match; the plan holds no other employer money).
- A row's person (review o1 F1): the adult it names, else the account's owner, else the first adult, as `atWorkPlan`,
  Retirement contributions' list per person and the Federal estimate read it, so a row marked "Household" counts. The
  catch-up is worked as compute() works it (414(v)(2)(A)(ii)) on those rows: the same figure whenever every row names its
  person. compute()'s own 401(k) row is unchanged and still counts only rows that name the person (as Retirement
  contributions' compute does); changing it would move figures on this page and that one, so it is left for its own change.
- room = max(0, cap - own - employer). regularLeft = max(0, the 402(g) amount - the row's money): money put there uses
  the same room, and the page says so ("It counts toward the same $72,000: what goes in there comes off the $56,730.").
- Worked (the invented family, 2026): Ana, 36, puts 470 every two weeks (12,220 a year) in her 401(k) and her employer
  adds 3,050: 72,000 - 12,220 - 3,050 = 56,730; 24,500 - 12,220 = 12,280 of usual room left. Riley (the renter), 39,000
  of pay, nothing in: all of the pay, 39,000. At 55 with 32,500 in (24,500 + the 8,000 catch-up) and 10,000 from the
  employer: 72,000 - 24,500 - 10,000 = 37,500.
- The tax on the move, said in one line: "You generally include the taxable amount (fair market value minus your basis
  in the distribution) of an in-plan Roth rollover in your gross income" (IRS, Retirement plans FAQs on designated Roth
  accounts, read 2026-11-15, https://www.irs.gov/retirement-plans/retirement-plans-faqs-on-designated-roth-accounts);
  "Earnings associated with after-tax contributions are pretax amounts" (IRS, Rollovers of after-tax contributions in
  retirement plans, on Notice 2014-54, read 2026-11-15, https://www.irs.gov/retirement-plans/rollovers-of-after-tax-contributions-in-retirement-plans).
  The same FAQ: the plan may limit in-plan Roth rollovers to amounts it could pay out, and says when an in-service
  withdrawal is allowed; hence the second question asks whether the money can be moved to Roth while working, either
  way, and its help names both ("in-plan Roth conversion" or "in-service withdrawal").

**Cases** (`verdict`, one sentence each, `afterTaxWords`): "full" no room ("Ana's work plan is already at its $72,000
limit for 2026, so no after-tax money fits this year."; with the pay as the limit "... at its 2026 limit, which is all
of Ana's pay ($30,000), ..."); "no" the plan does not take it ("Ana's plan does not take after-tax money, so this way
into Roth is closed."); "stuck" it cannot be moved or taken out while working, whatever the first answer ("Ana's plan
cannot move after-tax money to Roth while Ana works, so this way into Roth is closed. After-tax money left in the plan
grows, and the growth is taxed as pay when it comes out."; with the first answer still "Not sure", review o1 F5: "If
Ana's plan takes after-tax money, that money cannot be moved to Roth while Ana works, so this way into Roth is
closed."); "ok" two yeses ("Ana could put up to $56,730 more into the plan after tax this year and move it to Roth.");
"ask" otherwise, saying where to find out, with the words the plan's papers use (review o1 P2): both ("... if the plan
allows it. Not sure? Ask HR, or look on the plan's website for "after-tax contributions" and "in-plan Roth
conversion"."), the move ("Ana's plan takes after-tax money: up to $56,730 more could go in this year. Not sure? Ask
HR, or look on the plan's website for "in-plan Roth conversion" or "in-service withdrawal"."), or whether it takes it
("... if the plan takes after-tax money. Not sure? Ask HR, or look on the plan's website for "after-tax
contributions"."). The questions: "Does Ana's work plan take after-tax money, on top of the usual 401(k) money?" and
"Can that money be moved to Roth while Ana still works there?" (moved inside the plan or taken out to a Roth IRA, the
two ways the FAQ names). An unnamed first adult reads "You could ...", "Your plan ...", "while you still work there"
(core/words.js). A date before the table (a phone's clock set back) says "The 2025 limit (the earliest this app has)",
never "not out yet" (review o1 F2).

**Builder's choices.**
- Nothing is counted in the plan. Retirement contributions has no kind for after-tax money: a row into a 401(k) there
  counts as pre-tax money against the 24,500 (and the Federal estimate takes it off income up to that), and a row into a
  Roth account named 401(k) counts as Roth 401(k) money. So the link is for what goes in from pay and from the employer,
  which the room is worked from, and the page never asks for after-tax money to be typed there. Counting it needs a
  `limitKind` "after-tax" on Contributions, the Federal estimate leaving it in income, and this page's `own` reading it.
- The limit is per employer ("plans maintained by one employer", the IRS page): all of a person's 401(k) money is
  counted against one limit, the careful side for someone in two unrelated employers' plans.
- The answers are facts about the person's plan at work, so they live beside Get started's answer on
  `retirement.workPlans`, not in `whatIfs`; no figure reads them (the invariance test).
- The room is the brief's formula even when the usual 401(k) room is not used: the line "Ana also has $12,280 of usual
  401(k) room left this year. It counts toward the same $72,000: what goes in there comes off the $56,730." says what
  comes off it, as part of the same limit, so it does not read as contradicting the figure (review o1 P3). It gives no
  order to fill them in: that would be advice. When the way is closed only the first sentence stays.
- A hand-edited `workPlans` entry that is not a plain object is read as nothing when an answer is written, never spread
  into keys "0", "1" ... (review o1 F3).
- Words on screen never say "415(c)" or "mega backdoor"; the search words do.

**Tests** (`module.test.mjs`): the limit by year and the page's other 2026 figures against Notice 2025-67, Rev. Proc.
2025-19 and Rev. Proc. 2025-32 (all agree, nothing corrected); the room in every case above; who has a plan at work; the
verdicts from the answers; every sentence, "you" forms included; the two keys' writes; review o1 (a "Household" row,
a date before the table, a malformed entry, no pay, "stuck" with the first answer unknown, the plain questions); the page
(no row without a plan at work, shut on arrival, the title and status, no number box, a tap saves and names the answer,
the plan changes only there); S11; invariance: compute() here and on Retirement contributions byte-identical to 461df76 over the fixtures, the
empty plan and the 1,400 households (digests), and with the answers saved every page's compute() is unchanged.
