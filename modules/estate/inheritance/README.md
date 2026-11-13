# Expected inheritance  (`estate/inheritance`)

**Status:** usable (phase 8)
**Purpose:** An inheritance you might receive, as a what-if beside the plan (never inside it): what arrives after tax and costs, what it would change if it came, and if it came half as large or ten years later.

## Inputs
`estate.inheritance`, the retirement plan (`buildInputs`, `project`, `affordableSpending`). Writes `estate.inheritance = { items: [{ id, from, amount (today's dollars), year, kind: "cash"|"home"|"ira"|"roth", notes, pastRbd?, fromBirthYear?, heirId? }] }` (the last three only from an inherited IRA's part, see "Emptying it within 10 years"). Heavy: five plan runs, each with the affordable-spending search.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, items[] (with kindLabel, net), total, net, taxRate, base, withIt, half, later, spendingMonthly, extraMonthly, endGain }`; each run `{ success, failYear, endReal, affordableMonthly }`.

## Formulas
- What arrives (`netOf`): cash and Roth money whole; a traditional IRA or 401(k) x (1 - the plan's flat tax rate) (inherited from a non-spouse after 2019 it must be emptied within ten years, SECURE Act, and each withdrawal is income); a house x (1 - 6% selling costs), with no gains tax on the value stepped up at death (IRC 1014).
- Each item enters the plan's engine as money into savings (a negative event) in its year (not before this year; never after the plan's end).
- Runs: without it (the plan), with it, half as much, every item `LATER_YEARS` (10) years later. Extra spending = with it minus without, in the affordable spending a month (the most the plan could spend in retirement and still last).

## Edge cases
- Nothing entered: only the plan's own run.
- The engine treats inherited money as taxable savings from then on; in the page's own answer an inherited IRA is still all taxed on arrival, at the flat rate. The ten years and their tax are shown beside it (next section), never inside it.

## Tests
`module.test.mjs`: what arrives per kind, nothing expected, an inheritance's effect (more left, more to spend, half and later in between), a year in the past; the rest under "Emptying it within 10 years".

## Ideas / not yet
- A chance it comes (weighted outcomes); state inheritance tax for the heir's state and relationship.
- The inherited IRA as its own bucket inside the plan's run (today the ten years are shown beside the answer, not in it).
- State income tax on the withdrawals; the required withdrawal for the year of death itself; a trust or an estate as the one that inherits (the 5-year rule).

## Stress test 2026-11-11 (touch and input)

- Add holds until an amount is typed (1 to 1,000,000,000): an empty Add was saved as $0, said "Added." and drew four result rows from it (IE-2).

## Loans in the spending figure (2026-11-11, loans lane fix round 1, money review D11)
The runs on this page spend a loan the figure holds only until its payoff, as Will the money last? does (they use the same
engine inputs). The one figure this page prints as "spending" is the figure itself, loans included; it is not lowered for the
years after a payoff. Left as it is: Inheritance compares runs, and each run has the payoff in it.

## Simple first (2026-11-13, with gap #36; docs/OPTIONAL.md)
**First view.** Nothing entered: the hero and the five-box add form. With something entered: "If it comes" (two tiles and one sentence, written per case in `answerSentence`: the money lasts only with it; lasts either way; runs out either way, later or in the same year), "If it is smaller, or later" (four rows), the list (six rows, then "N more inheritances" by `rest()`), and "+ Add another inheritance". One filled button (the add form's, or none).
**One tap away**, as rows of one card: "How this is worked out" (the three rules the page used to print at its foot as "Good to know", what arrives per kind, how the ten years are worked, the sources with their read date) and one row per inherited IRA or Roth IRA. **More on this**: three questions (Long-term care, Estate tax, Your tax bracket).
**After a save** the green line names the answer (`savedLine`: "Added. If it comes, you could spend about $2,660 a month more in retirement."); the first one added redraws the page from its top, so the line is drawn at the top; a save inside an IRA's part keeps that part open with its line above the form (S11 in the module test).
**Counts.** `tests/first-view.known.json`: the empty plan's words 180 -> 130 (budget 100; what is left is the hero's three sentences, the five labels and the three questions).

## Emptying it within 10 years (gap #36)
One part (kind `item`) per item of kind `ira` or `roth`, at most four (`EMPTYING_MAX`; the page holds five parts). Title "Emptying it within 10 years" for one account; several are named, "Emptying the IRA from <from>" (`partTitles`). A fifth account gets no row and a line under the card says so. Status (`emptyingSays`): the tax of the first way offered ("about $78,160 tax in all"), "no tax" for a Roth IRA, "needs your income" when no income is entered, or "N set by you". All of it is `emptying(plan, { today })` in `compute.js`, called by the view in the browser: `compute()` itself is untouched (40 runs over the 14 households, four fixture plans and the empty plan, with and without an item of every kind, gave byte-identical output against the commit before; the module test holds the rest).

**What it shows.** One sentence per case (`emptyingSentence`), then a row per way the rule allows with its federal tax in all, the tax as a share of what comes out, and (when not known) when the way applies; the line on who has other choices (`eligibleNote`); what the tax covers and that this is not tax advice; and, for an IRA, one question with Save, two more boxes under "More details (optional)".

| the person had begun required withdrawals | ways shown |
|---|---|
| yes (typed, or by their birth year) | evenly; only the yearly minimum, the rest in the last year |
| yes, and an even share is under the yearly minimum in some year (`evenShort`: an heir of about 80 or more) | only the yearly minimum (an even share would be a missed required withdrawal) |
| no | evenly; all in the last year |
| not sure (the default) | all three, the last two saying when they apply (and evenly too, when `evenShort`) |
| a Roth IRA | all in the last year; evenly (both "no tax") |

**Inputs (all optional, on the item).** `pastRbd` "yes" | "no" (absent = not sure; "Not sure" removes it); `fromBirthYear` (read only as a whole year from 1900 to this year, `bornOf`; anything else in a hand-edited file counts as not given; the item's `year` is rounded to a whole year here); `heirId` (absent = the adult marked "Me"; choosing "Me" removes it; asked only when the household has two adults).

**Formulas.** Balance B in today's dollars; k = 1..10 are the years after the year of death (`year`); Bk the balance at the start of year k, wk the withdrawal, B(k+1) = (Bk - wk) x (1 + g).
- g = (1 + s x stocks + (1 - s) x bonds) / (1 + inflation) - 1: the plan's expected return above inflation at the share of stocks it holds now (`buildInputs`; 60% and the Assumptions defaults when the plan cannot be run). Builder's choice: the mix now, not the mix in the years of the withdrawals.
- **Evenly** (`drawPlans().even`): wk = Bk / (11 - k). Year 10 takes all that is left; each year's withdrawal is the one before grown by g.
- **As required** (`drawPlans().required`, `inheritedDivisor` in `core/math/rmd.js`): wk = Bk / Lk for k = 1..9, year 10 takes the rest. Lk = the longer of the heir's figure (Single Life Table at the heir's age in the year after the death, less 1 each later year) and the owner's (the table at the owner's age in the year of death, less 1 for each year after it; only when `fromBirthYear` is set), never under 1. Not worked out when the heir has no birth date on People (the sentence says so).
- **All in the last year** (`drawPlans().last`): w10 = B x (1 + g)^9.
- **Had required withdrawals begun** (`pastRbdOf`): what was typed; else, from `fromBirthYear`, with R = the year the start age is reached (`rmdStartYear`): death after R + 1 = yes, in or before R = no, in R + 1 = not sure (the first one is due by April 1 of that year, and the page asks for years, not days).
- **Tax on a year's withdrawal**: `federalTax` (core/math/tax.js) with the withdrawal added to ordinary income, minus without, at this year's tables, everything in today's dollars. The other income: this year's return as the Federal estimate holds it (`known()`) for the years before the household retires; for the years after, what the plan's own run through the brackets holds for that year (pensions, Social Security, its own withdrawals; `project` with `taxSettings({ mode: "brackets" })`, divided by that year's price level); past the plan's last year, its last year. The spec said "the household's other income from the tax projection"; that run holds no pay before retirement, so this year's return stands in for the working years (builder's choice).
- A Roth IRA: tax 0 on every row (a qualified withdrawal; the part says it holds when the person who died first put money in a Roth IRA at least five years before: the five years count from their first Roth IRA, Publication 590-B (2025), "Distributions after owner's death").
- **Two tax figures on one page.** The page's answer takes the plan's flat tax rate off an IRA in one go (`netOf`); the ten years are taxed year by year through the brackets. Each IRA's part says so with both the answer's figure and the rate (`bridgeSentence`).
- **No income entered** (`noIncome`: nothing in this year's return and nothing in the plan's retired years): the tax would be counted on this money alone and come out near $0. The shut row says "needs your income", and the part opens with one sentence saying the figures are too low and a link to Income.
- **Close in age** (`close`): the heir's birth year minus `fromBirthYear` is 10 or less. By years only, so the note says "by the birth years".
- The rows never say "what you keep": money left in longer has grown more, so two ways' totals are not the same money. They give the tax and its share of what comes out.

**Staying open.** A part saved in stays open for the rest of the visit (a module-level set, never stored): after a save in another account's part and when the page is drawn again on Back, until the person shuts it or the app is opened again. The form kit keeps "More details (optional)" the same way, so the two are open or shut together.

**Builder's choices.** Rows with their tax instead of chips (a chip would be a choice with nothing to save; every way is shown at once). One question in sight and two boxes under "More details (optional)" (the spec put all three there; a form with only a Save in sight is not a form). The parts card lists "How this is worked out" before the account rows: that is `parts()`'s fixed order. The 10-year rows are still shown to an heir who is close in age, with the note that they have other choices: the page cannot know they will use them.

**Sources (read 2026-11-13).** irs.gov, ecfr.gov and federalregister.gov could not be opened from the build machine (the network refuses them), so the texts were read from public copies and a search of irs.gov, and say so here:
- IRS Publication 590-B (2025), "10-year rule", "Eligible designated beneficiaries", "Owner Died on or After Required Beginning Date" and Appendix B, Table I: the full text as extracted in github.com/emmilco/us-tax-model (`sources/2025/p590b.cols.txt`), and irs.gov/publications/p590b through a web search. Quoted facts: all of it out by December 31 of the year holding the 10th anniversary of the death; the rule applies to a designated beneficiary who is not an eligible one whether or not the owner had reached the required beginning date; before that date "no distribution is required for any year before the 10th year"; on or after it, yearly amounts on "the longer of" the heir's and the owner's life expectancy; eligible: the surviving spouse, the owner's minor child, a disabled or chronically ill person, anyone not more than 10 years younger; a spouse may treat the IRA as their own.
- The Single Life Table (`SINGLE_LIFE`): 26 CFR 1.401(a)(9)-9(b) as published in T.D. 9930 (85 FR 72472, November 12, 2020; for years from 2022), text as copied in github.com/lexifina/united-states-irs-guidance-law (`td/2020/09930.md`); all 121 ages compared by script with that text, and by eye with Publication 590-B (2025) Table I. A US government work and a public fact; no code was taken from either repository.
- The final regulations on required withdrawals: T.D. 10001, 89 FR 58886, July 19, 2024, applying to calendar years from January 1, 2025 (found by search on govinfo.gov and federalregister.gov; the yearly-withdrawal rule itself is quoted from Publication 590-B above). Penalties for missed yearly withdrawals were waived for 2021 to 2024 (a summary by Grant Thornton, found by the same search; not read in the Treasury's own text, and not said on screen).
- Not verified at the source and so not stated as a figure on screen: the size of the penalty for a missed withdrawal ("How this is worked out" says only that a missed required withdrawal is penalized: Publication 590-B (2025), "10-year rule", Caution, the excise tax on what is left in too long).

**Tests** (`module.test.mjs`): the table (17 ages, never rising, 121 long); the divisor; evenly empties exactly in year 10; as required uses the table and ends in year 10; all in year 10; had withdrawals begun (typed, by age, the year between); the tax as with-minus-without on this year's return, and lower on a retired year's income; which ways are offered; which adult inherits; a Roth IRA gives tax 0; every sentence case; each way's row; the eligible-heir note (list, close in age, exactly 10, older heir); F1 an old heir is never offered a way that takes less than the yearly minimum; F2 no income; F4 a birth year out of range and a year with a fraction; the row titles, the fifth account's line, the bridge sentence with the answer's own figure; a saved part stays open (S11, two accounts, shut by the person); the answer's sentence per case and the green line; invariance (the three boxes move no figure of `compute()`, only `ira` and `roth` get a part, other kinds do not move an IRA's figures, over the 14 households, four fixtures and the empty plan); the page drawn on the stand-in DOM (first view empty and with an IRA, several accounts, S11, adding).
