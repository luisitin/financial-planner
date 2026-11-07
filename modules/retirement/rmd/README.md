# Required withdrawals  (`retirement/rmd`)

**Status:** usable (phase 5)
**Purpose:** When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look.

## Inputs
`household`, `accounts` (401(k), IRA, insurance cash value), the projection (for the sizes).

## Outputs
`people[]` (startAge, startYear, yearsUntil, firstRmd nominal and real), `schedule[]` from the projection (year, age, factor, rmd, rmdReal, taxes (the plan's flat rate, kept for the answer key), extraTax, extraTaxReal, deferredEnd), `totalRmdReal`, `totalTaxReal`, `totalExtraTaxReal`, `table[]` (ages 72-100), `hasDeferred`. `schedule[].owners` (whose withdrawals: `{ id, name, age, factor, rmd, rmdReal }`, each at their own age). `thisYearTax(plan)`: `{ year, total, byPerson, socialMore, separate }`. Helpers `rowIncome`, `addedTax`, `withdrawalTax` (also used by How much to take out).

## Formulas
`core/math/rmd.js`: IRS Publication 590-B Table III (Uniform Lifetime Table, in effect from 2022); start age 70½ for people born before July 1, 1949 (the year they reach it: their 70th for a birthday in January to June, their 71st from July), 72 for July 1949 to 1950, 73 for 1951-1959, 75 from 1960 (SECURE 2.0). Required amount = each owner's prior year-end balance in their own 401(k)s and IRAs / the factor for the age they reach that year; the projection keeps each owner's slice of the pre-tax bucket (`rmd.owners` in the engine), an account with no owner belongs to the first person, and life-insurance cash value (in the same bucket) has none.

## This year's withdrawal (2026-11-02, round 4)
For each owner whose withdrawals have started and who holds pre-tax money, the page leads with "Take at least $13,080
from Ruth's IRA by December 31, 2026" and an outlined "I've taken it" (`thisYear`, `markTaken`; stored as the optional
`retirement.rmdTaken[year][personId]` = the day tapped, DATA_MODEL). Needs attention lists an untaken one from October
(a fix in December; "to do" for a first year), and the calendar's December 31 row says the amount.
- Amount: each account's balance on December 31 of last year divided by the Uniform Lifetime factor for the age reached
  this year (`rmdAmount`). The balance is the account's history point nearest that day (within 45 days), else today's
  balance, which the page calls an estimate and asks for the year-end statement figure.
- First year (the year the start age is reached): it may wait until April 1 next year, but then two fall in that year.
- Each 401(k)'s share comes out of that 401(k); IRAs may be added together and taken from any one of them. A 401(k) at
  a job still held can usually wait until retiring (the plan document decides); IRAs cannot.
- Missing it: a 25% excise tax on what was not taken, 10% if it is taken within two years.
- Sources (read 2026-11-02): IRS, "Retirement topics: Required minimum distributions (RMDs)", page last reviewed
  2026-04-08 (the December 31 and April 1 dates, two withdrawals after waiting, the 25%/10% excise tax, prior December 31
  balance over the Uniform Lifetime factor); IRS, "Retirement plan and IRA required minimum distributions FAQs", last
  reviewed 2026-01-29 (Q1 the still-working delay, not for IRAs or 5% owners; Q5 IRAs totalled, 401(k)s separately).
  Not handled: the Joint Life table (a sole spouse beneficiary more than 10 years younger lowers the amount) and
  inherited accounts.

## The tax a withdrawal brings (round 8, 2026-11-06, widow-2)
The page said "Taxed at the plan's 15%" and "about $2,412 of tax" for a widow's $16,078 withdrawal, and nothing on this year's
card. It now says what each withdrawal adds to that year's federal income tax: the tax on the year's income with it less the tax
without it (`addedTax`), on top of the year's other income as the projection has it (`rowIncome`: pensions, a partner's pay,
rent; every pre-tax withdrawal and conversion; Social Security through its worksheet; from the taxable account the gain share
of sales and the dividends, as the brackets mode counts them; on the brackets setting the engine's own `taxInfo`).
- Through `core/math/tax.js` `federalTax` with the projection's brackets settings (`taxSettings(plan, { mode: "brackets" })`:
  the filing status; the tables of `modules/taxes/federal/data/federal.js` indexed with the plan's inflation after the last
  published year; those 65 or over).
- This year's card: "Taking it adds about $3,429 to your federal income tax for 2026: it is taxed as income, and it makes
  $13,666 more of Social Security taxable", and "ask them to hold back about $3,429 for the tax" (`thisYearTax`: this year's
  amounts from the December 31 balances in place of the projection's; each person's figure is theirs on top of the rest).
  Nothing is said while the first adult still works (the projection holds no pay for them).
- The schedule: "adds about $X of federal tax" in today's dollars; a year the first adult still works keeps the plan's flat
  rate, said as such. `taxes` and `totalTaxReal` keep the flat figure the answer key (`tests/golden/retirement/rmd.csv`)
  checks.
- The widow by hand (2026): with it 22,800 + 16,078 = 38,878 of income; 38,878 + 13,800 (half of $27,600 of Social Security) =
  52,678, so 0.85 x (52,678 - 34,000) + 4,500 = 20,376.30 of the benefit is taxed; AGI 59,254.30; less 16,100 + 2,050 + 6,000 =
  24,150; taxable 35,104.30; tax 1,240 + 12% x 22,704.30 = 3,964.52. Without it: 22,800 + 13,800 = 36,600; 0.85 x 2,600 +
  4,500 = 6,710; AGI 29,510; taxable 5,360; tax 536. It adds 3,428.52 (round 8's $3,428 is 3,964 - 536, both rounded).
- Sources (read 2026-11-06): IRS Rev. Proc. 2025-32 (2026: standard deduction $16,100 single, $2,050 more for an unmarried
  filer 65 or over, 10% to $12,400 and 12% to $50,400 single); 26 U.S.C. 151(d)(5)(C) (Cornell LII: $6,000 for each person 65
  or over, taxable years before 2029, less 6% of MAGI over $75,000 / $150,000, joint returns only for the married); 26 U.S.C. 86
  (Cornell LII: Social Security taxed over $25,000 / $34,000 single, $32,000 / $44,000 joint, up to 50% / 85%); IRS Publication
  590-B (2025): the Uniform Lifetime factor 25.5 at 74, 24.6 at 75.

## Converting once they have started (round 8, 2026-11-06, widow-3)
When someone's withdrawals have started, the schedule's last line says a conversion is still allowed: "Once this year's
required withdrawal is out, you can still move more to a Roth (a conversion). The required amount itself cannot be
converted; what you convert is taxed as income that year, then has no required withdrawals and, once the Roth has been
open five years, comes out tax-free for you and for your heirs." Before they start it keeps the line about converting in the low-income years first. Sources (read
2026-11-06): IRS Publication 590-A (2025), "Required distributions" under conversions ("You can't convert amounts that must be
distributed from your traditional IRA for a particular year", the year you reach 73 included); Publication 590-B (2025): Roth
IRAs have no required withdrawals for the owner, and a qualified distribution (after the five-year period, made to a
beneficiary after death) is not taxed.

## Round 8 reviews (2026-11-06): separate returns, shares that add up, the federal hold-back, owners' own ages
- **Filing separately, each spouse's own return (review D1).** A couple of 75 filing separately, each with a $400,000 IRA, a
  $20,000 pension and $30,000 of Social Security, read "adds about $3,577" on each card ($7,154 together): the household's
  income ran through the separate-return brackets with one deduction. Each spouse now has their own return (IRS Pub. 501: "you
  generally report only your own income, credits, and deductions"; `core/math/tax.js` `federalTax` with `separate`):
  `rowIncome` gives `by` (each income to its owner, matched to the engine's own list of incomes paid that year; each required
  withdrawal to its owner from `row.rmdBy`; the other pre-tax withdrawals, conversions and the taxable account's gains and
  dividends in proportion to the required withdrawals, all to the first adult in a year with none; each spouse's own age for
  the 65-or-over amount), and `addedTax` prices each spouse's share on their own return. Living together, Social Security has
  no base amount on a separate return (26 U.S.C. 86(c)(1)(C)(ii) and (c)(2)(C): both zero), and no senior deduction (151(d)(5)(C):
  married people only on a joint return). By hand, with this year's amounts rounded to $16,260: with it 20,000 + 16,260 + 0.85 x
  30,000 = 61,760, taxable 61,760 - 17,750 = 44,010 (16,100 + 1,650 at 65 for a married filer, Rev. Proc. 2025-32), tax 1,240 +
  12% x 31,610 = 5,033.20; without it 45,500, taxable 27,750, tax 3,082; each card 1,951.20, together 3,902.40 (3,902.44 from the
  projection's unrounded 16,260.16 each). Spouses who lived apart all year (`taxes.livedApart`, as the Federal estimate reads it)
  get the single base amounts, $25,000 / $34,000 (`withdrawalTax`): 4,273.72 - 760 = 3,513.72 each.
- **The cards add up (review D4).** On one return each person's figure was the tax on their withdrawal put last, on top of the
  other's: the couple filing jointly read $3,041 on each card, $6,081 together, $485 short of the $6,566.44 the two add (the first
  pulls Social Security into tax at 85%, the second does not). Each card is now `total x their amount / the sum`.
- **The hold-back is federal (review D5) and not "if you like" (UX 5).** "Ask them to hold back about $3,429 for the federal tax
  (your state may tax it too)", the bracket left out in the nine states with no income tax (`modules/taxes/state` `NO_WAGE_TAX`).
  Once taken, the card keeps "It adds about $3,429 to your 2026 federal income tax; if none was held back, Estimated payments says
  how to cover it" (UX 11). With Batch 1 (Federal and Estimated count the withdrawal) the hold-back can come from Estimated
  payments' own figure; that is for claude-b when the two land.
- **Started for someone who has pre-tax money (review D3).** "Once this year's required withdrawal is out, you can still move
  more to a Roth" was shown when any adult was past the start age; it now needs that adult to own pre-tax money.
- **Each year at its owners' own ages.** The schedule read "2035 · age 84, factor 16.8" for a 75-year-old spouse's IRA (the
  first adult's age and factor; the amount was right, the engine uses the owner's age). `schedule[].owners` names each owner with
  their own age and factor ("2035 · Bea, age 75 · factor 24.6", or "ages 75 / 75 · factors 24.6 / 24.6"); `age` and `factor`
  stay the first adult's for the answer key (`tests/golden/retirement/rmd.csv`).
- Sources read 2026-11-06: 26 U.S.C. 86(c) and 151(d)(5)(C) (Cornell LII); IRS Rev. Proc. 2025-32 (irs.gov/pub/irs-drop/rp-25-32.pdf:
  $16,100 for a married person filing separately, $1,650 more at 65 for the married); IRS Publication 501 (separate returns);
  26 U.S.C. 401(a)(9)(C)(v)(II) (Cornell LII: the start age is 75 for those who reach 74 after 2032).
- Tests: `module.test.mjs` (fixtures `qa/fixtures/retiree-cases.mjs` `separateCouple`, `youngerOwnerCouple`; the widow): each
  failed before its fix.

## This year's pay before retiring (verify, 2026-11-06)
The projection holds no pay for the first adult (the engine counts pensions, Social Security, rent and a partner's pay that goes
on), so in a year that is both this year and a retirement year (retired in June, or past the retirement age with a job still on
the Income page) the withdrawal was priced on top of too little: Ann, 74, retired June 30 from a $60,000 job, read nothing on her
card ("adds $0") for a $15,686 withdrawal that adds $2,999. `payThisYear(plan, today)` adds the first adult's own pay lines
(salary, bonus, business; theirs or with no owner in the household: a partner's or a child's job is not theirs) for the days of this year each was paid (start and end dates;
no end date: to December 31) to their income for this year only (`rowIncome`'s `pay`: `thisYearTax`, this year's schedule row,
and How much to take out's `requiredTax`). By hand: pay 60,000 x 181 / 365 = 29,753.42; with the withdrawal 45,439.42 + 12,000 =
57,439.42 of provisional income, 20,400 of the $24,000 benefit taxed (85% cap), AGI 65,839.42, taxable 41,689.42, tax 1,240 +
12% x 29,289.42 = 4,754.73; without it 11,090.41 taxed, AGI 40,843.83, taxable 16,693.83, tax 1,755.26; it adds 2,999.47. Sources
as above (Rev. Proc. 2025-32; 26 U.S.C. 86 and 151(d)(5)(C), Cornell LII; read 2026-11-06). Not counted: pay typed only as
"Wages this year" on the Federal estimate, interest and dividends typed only on the Income page; for this year the Federal
estimate's own with-and-without difference is the fuller figure once it counts the withdrawal (Batch 1). Test: `module.test.mjs`
"verify: a withdrawal this year is priced on top of the pay ...".

## Tests
`tests/retirement.test.mjs` (table, start ages, amounts) and `tests/retirement-pages.test.mjs` (the page). `module.test.mjs`
(round 8): the widow's added tax against `federalTax` and the hand figures above, the schedule's `extraTax`, the flat
`taxes` unchanged, and the page's words (fixture `qa/fixtures/widow-plan.mjs`).

## Independent answer key and source audit

`tests/golden/retirement/rmd.csv` contains 1,100 invented cases, replayed by
`tests/golden-retirement.test.mjs`. Each of eleven rules has 60 grid, 30 edge,
and 10 extreme cases. The full layout, assumptions, and rule inventory are in
`tests/golden/retirement/briefs/rmd.md`; the independent Python generator is
`tools/golden_retirement/rmd.py`. Monetary answers are calculated without
intermediate rounding and serialized to cents; factors and rates use six decimals.
Every tenth case has a second derivation recorded in its note.

The source for the factors is [IRS Publication 590-B, Appendix B, Table III](https://www.irs.gov/publications/p590b),
read on 2026-10-26. For example, the age-73 factor is 26.5, so an invented
$100,000 prior December 31 balance requires $100,000 / 26.5 = $3,773.58.
The page displays ages 72 through 100, while the published table extends to
age 120 and over. The helper's Infinity below age 72 and completed-age lookup
for fractional inputs are interface conventions, not historical tax rules.

The publication's IRA Owners section requires age 70.5 for birthdays before
July 1, 1949, and age 72 for July 1, 1949 through 1950; the original README's
"72 before" therefore omits an older cohort. Age 73 applies to 1951 through
1959; age 75 for 1960 and later follows
[SECURE 2.0, section 107](https://www.congress.gov/117/plaws/publ328/PLAW-117publ328.pdf).
Birth month determines the calendar year age 70.5 is reached. Fixed
2026-10-30 (F-030): `rmdStartAge` and `rmdStartYear` take the birth date.

The publication calculates an owner's required distribution from that owner's
accounts. A spouse's IRA is not part of that owner's balance: two invented
$100,000 IRAs owned by two age-73 adults each require $3,773.58; the household
total is $7,547.17 before rounding the individual outputs. Fixed 2026-10-30
(F-030): each person's balance and first withdrawal are their own.

Ordinary life-insurance cash value does not by itself become an IRA subject
to required withdrawals. [IRS retirement plan investments FAQs](https://www.irs.gov/retirement-plans/retirement-plan-investments-faqs)
and IRC 408(a)(3) explain the IRA prohibition on investing in life insurance.
The key assumes an ordinary policy, not an insurance product inside a qualified
plan, and retains the page's inclusion as an explicit TODO disagreement.
Table II's younger-spouse exception and inherited IRA rules require information
the page does not model and are not inferred from a partner's age.

Schedule arithmetic follows the projection README's annual model. In the key,
cash pays the invented $12 annual spending so required withdrawals alone
change the pre-tax balance. With growth `g`, inflation `i`, flat tax rate `t`,
and factor `f`, required amount is `B / f`; the following balance is
`(B - B / f) * (1 + g)`. Year `n` real required amount is the nominal amount
divided by `(1 + i)^n`; its modeled tax is `required * t`. Lifetime real sums
add those unrounded annual real amounts. The fixed rates are invented inputs,
not IRS tax rates or forecasts. The second method uses exact rational products
of retained shares to check the decimal annual ledger.

Review 2026-11-06 (round 7): "You start at 75", "This is your first year", "your 2026 withdrawal is taken" and the 401(k) note say you/your for the unnamed first adult ("Me", or "You" from `thisYear` when no name is typed), with the verb to match; typed names read as before (core/words.js). Words only.

## Plain words on the first screen (path part 3, 2026-11-06)
"pre-tax accounts" is "accounts you haven't paid tax on yet (like a 401(k) or a traditional IRA)"; the stat is "Not taxed yet, today";
the Roth sentence and its source moved into the folded IRS table, below the first screen. No figure changed.

## Path part 3, review fixes
- With no account you haven't paid tax on yet, the Roth sentence and the IRS source line show under the notice (`ROTH_SOURCE` in view.js, also in the IRS-table fold); they are below the first screen.

## Batch 5b (2026-11-06): a page a layman can use
The owner's answer, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page". View only; `compute`, `thisYear` and `thisYearTax` are unchanged.
- **The first screen answers in two sentences.** "This year, take at least $16,078 from Ruth's retirement account by December
  31: the law requires it. With your $50,400 of Social Security and pension, you can spend about $5,000 a month and the money
  lasts in 9 of 10 markets." The second is `withdrawal-strategy` `firstYear`'s income and sources with Monte Carlo's careful
  figure (`careful.js` `whenCareful`, a grey bar until it is worked out; "plus health insurance" when the plan adds it; at what you
  plan, how many of 10 when that is fewer than 9). Two people: "take at least $16,260 from Al's IRA and $16,260 from Bea's IRA by
  December 31: the law requires both"; a first one: "by April 1, 2027". Taken: "Ruth's 2026 required withdrawal is taken."
  Not started: "Nothing is required yet. Required withdrawals from Bea's IRA start in 2035, when Bea turns 75." and the first
  one's size. No pre-tax money: "The law requires no withdrawals: there is no 401(k) or traditional IRA on file."
- **What to do: one card, one line, one filled button.** "It adds about $3,429 to your 2026 federal tax: ask your bank or broker
  to hold that back when they send it." (each spouse's own return when filing separately; "Your state may tax it too." where it
  does), the first-year and 401(k) notes when they apply, "Missing it costs 25% of what was not taken." and a filled "I've taken
  it" (a stat with the amount on each card when two people are due).
- **The years ahead in a sentence** ("Next year's is about $16,402, in today's dollars. All of them together come to about
  $410,244.") and the Roth line, with an outlined "Roth conversions".
- **How this is worked out**: the rule, each withdrawal's workings ("Ruth's retirement account holds $410,000 today. The law
  divides that by 25.5, the IRS figure for age 74: $16,078.", the Social Security it makes taxable), the penalty in full, the
  year-by-year list at each owner's own age and IRS figure, the conversion rule, the IRS table and the sources. "factor",
  "IRS table" and publication names are only there.
- Tests: `module.test.mjs` "5b page: ..." (the widow, taken, two at once, a first one, not started, no pre-tax money; no
  paragraph over 160 characters and no jargon on the first screen), each failing before the change; the batch-5 tests reworded
  with the page.

## Batch 5b reviews (2026-11-06): what the layman review changed
Under the owner's answer of 2026-11-06, word for word: "You can do as you please. Just make sure a layman can easily understand
and use the page".
- Taken: said once (UX 15). The hero reads "Done for 2026."; the green notice stays; the card reads "Marked as taken on
  November 6, 2026." (with the owner's name when two are due).
- Once taken, how to pay the tax without a link to a page that disagrees (UX 2: Estimated payments does not count the withdrawal
  until Batch 1 lands and said "No estimated payments needed"): "It adds about $3,429 to your 2026 federal tax. If none was held
  back, send that to the IRS by January 15, 2027 (irs.gov/payments)." January 15 of the next year is the fourth instalment date
  for the year's estimated tax (IRS Form 1040-ES); tax held back from an IRA withdrawal counts as paid evenly through the year
  (26 U.S.C. 6654(g)), which is why the untaken card asks for it to be held back.
- An account named without its owner gets the owner's name (UX 16): "from Kim's Old 401(k)"; "Pat's 401(k)" stays as it is.
- The chance in the same words as the other retirement pages (UX 7, `careful.js chanceWords`): "it lasts in about half of
  markets (47%)".
- No links inside sentences (UX 17): "How much to take out" and "Will the money last?" are outlined buttons.

## Batch 5b with path part 3 (merged 2026-11-07)
Batch 5b's page in path part 3's plain words: with no adults yet the lede says "accounts you haven't paid tax on yet (like a
401(k) or a traditional IRA)"; with no such account, "If you have one, add it on What you own." and `ROTH_SOURCE` (the Roth
sentence and the source line) under the answer. Batch 5b's page has no balance tile, so "Not taxed yet, today" went with it;
with an account on file "How this is worked out" carries the Roth sentence and the sources in its own lines. No figure changed.

## Follow-up 2026-11-07: one plain way of saying the odds
The owner's standing words: "It should feel easy for a layman ... not ... concepts / words too hard to understand." Every page that says how often
the money lasts now uses `modules/retirement/odds.js` (`chanceWords`, re-exported by `careful.js`; `BAD_RUN` = "even in a bad run of years",
`BAD_RUN_NOTE` = "(only 1 in 10 is worse)"). A "pretend future" is one made-up run of good and bad years; the share of pretend futures in which the money lasts is the
chance. The words, after "the money lasts": 100% "in every pretend future we ran"; 90% or more "even in a bad run of years"; 45% to under 60% "about half
the time"; under 10% "in fewer than 1 of 10 pretend futures"; else "in about N of 10 pretend futures" (N rounded down, never 9 under 90%); with the number
"(93 of 100)" after "of 10 pretend futures", else "(93 of 100 pretend futures last)", where it helps. No page says "markets" for a try ("9 of 10 markets", "every market tried", "simulated markets",
"100 markets" are gone; "if markets do as well as average" stays: it means average returns, not a try). The amber pill "fewer than 9 in 10" is
"short in a bad run". Decision (no owner to ask), changed after the UX review of 2026-11-07 (it found "tries" unexplained where it first appears): "pretend futures", which explains itself, over "tries" or "runs".

## Follow-up 2026-11-07: Roth off the first screen, the hold-back link
- "Roth" is a word a layperson does not know, and path part 3 bans it on the first screen. This page is shorter than the screen, so moving the card down was not enough: the Roth line and its
  button moved out of "The years ahead" into their own card, "Making them smaller", just above "How this is worked out" (which stays last: its folded text still counts as on the screen when the page is short, so the sentence about Roth IRAs must sit below the first 844 px), and the card says what a Roth account is instead of its name: "Moving some
  into an account you pay the tax on now, and never have to take money out of, makes them smaller before they start." / "Once this year's is out, you can still move more into an account you
  pay the tax on this year, then never have to take money out of." The outlined button is "Move some to a tax-free account" and opens Roth conversions, which names and explains the word.
  Decision (no owner to ask): the plain description over "a Roth account (one you already paid tax on)", because the walk's check counts any visible "Roth" on the first screen.
- Once the withdrawal is marked taken, the fallback "send that to the IRS by January 15" stays and gains a link where Estimated payments has something to
  say: with a hold-back (`taxes/estimated` `holdBack`: a withdrawal still to come) "If none was held back, Estimated payments shows how much to have held
  back from a withdrawal still to come."; with only payments to make "... January 15, 2027 (irs.gov/payments). Estimated payments has the amounts by quarter."
  Test: "follow-up 2026-11-07 (B)".
