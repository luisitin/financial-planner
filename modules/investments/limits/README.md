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

## Outputs
- `people[]` with `rows[]` for the 401(k), IRA and HSA: `limit` (with catch-up), `catchUp`, `catchUpFull`, `catchUpCapped`, `used`, `room`, `over`, `accounts`, `hasAccount`, `year`. HSA rows also have `eligible`, `shared`, `payroll` and `employer`.
- `base`: the limits before catch-ups. `payKnown`: whether the Income page has any pay.
- `hsa`: `coverage`, `coveredName`, `shared`.
- `totals`, `fsa`, and `gift` (the exclusion and the five-year amount).
- `roth`: `filingStatus`, `livedApart`, `separate`, `year`, `phaseOut`, `magi` (one return; `null` on separate returns), `status` (one return; on separate returns the more limited spouse's), and `people[]`. Each person has `magi`, `status`, `full`, `reduced`, `traditional`, `roth`, `allowed` and `over`.
- `deadlines[]`, `notes`, `warnings` (Roth IRA money over what is allowed).

## Formulas
**401(k).** Money is sorted by the Contributions item's `limitKind`, not by account type. A Roth account is a Roth 401(k) when it has an employer match or its name says 401(k), 403(b), 457 or TSP. Its money counts against the 401(k) limit with the pre-tax money (IRC 402A(c)(2): Roth deferrals may not exceed the limit "over ... the aggregate amount of elective deferrals ... which the employee does not designate"). `hasAccount` uses the same test, with the account's largest match.
- limit = 402(g) amount + catch-up.
- Catch-up: from 50, or the 60-63 amount instead (414(v)(2)(B)(i), (E)(i)).
- The catch-up is at most the person's compensation less min(their deferrals, the 402(g) amount) (414(v)(2)(A)(ii): "the excess (if any) of (I) the participant's compensation ... over (II) any other elective deferrals").
- Compensation is the Federal estimate's `k401.people[].compensation`: the person's salary and bonus on the Income page, plus their business income for someone self-employed (415(c)(3)(B), 401(c)(2): earned income). When the Income page has neither for anyone, the page cannot know it and shows the whole catch-up.
- used = pre-tax + Roth 401(k); room = max(0, limit - used); over = max(0, used - limit). The employer match is not counted.

**IRA.** Traditional and Roth IRA money (limitKind `ira`) share one limit + catch-up from 50 (219(b)(5); 408A(c)(2)). The pay is assumed to cover it (as the answer key assumes).

**HSA** (`hsaPicture`, IRC 223).
- With no high-deductible plan (`coverage: "none"`), nobody may put money in, so the limit is 0 and any money is over (223(b)(1), (c)(1)(A)).
- With self-only cover, only the covered adult may (`coveredId`, else the adult marked "Me"). Everyone else has 0.
- With family cover, every adult may.
- Each adult's own money counts: their HSA rows, the amount and the employer's deposits (223(b)(4)(B); Pub. 969 "You must reduce the amount you or any other person can contribute to your HSA by the amount of any contributions made by your employer"). The HSA page's typed money goes only where it is more than the rows, on the covered adult or "Me", never on each adult.
- Eligible adults get the self-only or family amount + their own $1,000 catch-up from 55 (223(b)(2), (b)(3)).
- Married people with family cover share one family limit (223(b)(5)). Each spouse's limit = own catch-up + max(0, family - max(0, the other's money - the other's catch-up)) (RULES.md 5.4, example 10.4).

**Roth IRA, per person.**
- MAGI = the Federal estimate's AGI + the traditional IRA deduction it took (219(g)(3)(A): AGI "without regard to ... the deduction allowable under this section"; applied to Roth IRAs by 408A(c)(3)(B)(i)). It is worked to the cent.
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
- A spouse outside self-only cover, or anyone without a high-deductible plan, shows "None this year" with the reason and a link to the HSA page. If money goes in anyway, it shows as over.
- Self-employed income (Income page "business") counts as compensation for the 401(k) catch-up cap at its full figure, before the self-employment tax deduction, so a solo 401(k) is capped only when the business earns less than the deferrals.
- Filing separately with more or fewer than two adults: the household's MAGI is used for everyone.
- On a 2027 date the Roth IRA range is 2026's, and the page says so.

## Tests
- `module.test.mjs`: one test per formula above, using the worked examples of `tests/golden/limits/RULES.md` 10.1-10.4.
- `tests/investments.test.mjs`.
- `tests/golden-limits.test.mjs`: each adult's 401(k), IRA and HSA rows, and the per-person Roth MAGI, status and `allowed` against `roth_allowed`, all against the independent answer key.

## Ideas / not yet
- 529 state deductions by state; SEP/Solo 401(k) limits for the self-employed.
- The IRA limit capped by compensation (219(b)(1)(B), the spousal IRA 219(c)).
