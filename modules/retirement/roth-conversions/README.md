# Roth conversions  (`retirement/roth-conversions`)

**Status:** usable (phase 6)
**Purpose:** Fills a bracket with Roth conversions in the years before required withdrawals and shows what that does to lifetime tax and spending.

## Inputs
Everything the Projection page reads; `retirement.rothConversion` (`{ on, fillRate, untilAge }`, set here; turning it on also switches `retirement.taxMode` to the brackets); `household.filingStatus`.

## Outputs
`options[]` (no conversions, then the 10%, 12%, 22% and 24% brackets filled): `totalConvertedReal`, `taxesReal`, `endBalanceReal`, `endAfterTaxReal`, `rmdReal`, `success`, `failYear`, `chosen`, `best`, `offer`, `healthReal`, `creditReal`, `creditLostReal`, `cliffYears`, `cliffIncome`; `verdict`, `helps`, `noWindow`; `table[]` for the chosen (or best) setting: each year with a conversion, income before it, the conversion, the year's tax, the bracket it ends in, and whether it crosses the Medicare surcharge line (IRMAA, from 63 because of the two-year look-back); `span` (the years conversions are possible), `rmdStartAge`.

## Formulas
The engine's conversion step (`core/math/retirement.js`): in each retirement year before the required-withdrawal age (and the until-age), once the year's spending withdrawals are settled, convert pre-tax money to Roth until taxable income sits at the top of the chosen bracket (`roomUnder`, then trimmed or topped up so the tax on the conversion itself, when it has to come from pre-tax money, is included); the tax is settled from the buckets like any other. Options are ranked by `endAfterTaxReal` (Withdrawal order page). IRMAA first tier 2026: 109,000 single / 218,000 joint, indexed with the plan's inflation.

## Edge cases
Conversions are skipped in a year they would make the plan fail. The marketplace (ACA) credit before 65 is priced in each setting's own run (round 8, below), from the projection's health line (retirement/healthcare: the years someone has stopped work and is under 65). The 5-year rule is text.

## Tests
`tests/tax-pages.test.mjs` (a big pre-tax pot is helped; a couple already in the 12% bracket barely is), `tests/retirement.test.mjs` (the engine step), `module.test.mjs`.

## Independent answer key and audited sources

`tests/golden/retirement/roth-conversions.csv` holds 1,000 invented cases,
100 for each of ten rules, each split into 60 grid, 30 edge and 10 extreme
cases. The complete inventory and CSV layout are in
`tests/golden/retirement/briefs/roth-conversions.md`. The independent generators
are `tools/golden_retirement/roth_conversions.py` and `tax_oracle.py`.
They do not import the application. Every tenth row has a second calculation
or conservation check recorded beside its source.

Bracket ceilings and deductions are from [IRS Rev. Proc. 2025-32](https://www.irs.gov/irb/2025-45_IRB).
The temporary age-65 deduction uses [IRC 151(d)(5)(C)](https://www.law.cornell.edu/uscode/text/26/151)
and [IRS Schedule 1-A instructions](https://www.irs.gov/instructions/i1040gi).
Taxable traditional-IRA distributions and conversions are described in
[IRS Publication 590-B](https://www.irs.gov/publications/p590b).
Rates and balances in the fixtures are invented scenario inputs. Source-year
tax amounts remain exact; future indexing is the stated hypothetical planning
assumption, not a prediction of tax law.

For a single person under 65 in 2026, the 12% bracket ends at $50,400 and
the standard deduction is $16,100. With no other income and enough cash
to pay the tax, the target conversion is `50,400 + 16,100 = $66,500`;
its federal tax is `12,400 * .10 + 38,000 * .12 = $5,800`.
The independent solver first fixes the withdrawals already needed for spending,
then solves for the largest conversion that stays under the chosen taxable
income ceiling while the remaining accounts can pay the extra tax. The answer
is found to cent precision, rather than assuming a fixed number of corrections
will converge. Fixed 2026-10-30 (F-030): `roomUnder` and the engine's conversion step
solve to a fraction of a cent (secant steps inside a bracket, `largestAtOrUnder` in
`core/math/tax.js`), the senior deduction follows the law (per person, joint returns
only), and conversions under $1 are no longer skipped: an available $0.01 with no tax
liability converts $0.01.

Required-withdrawal age and an explicitly supplied until-age are both exclusive
conversion boundaries. A failed spending plan converts nothing. The reported
span counts eligible years even if the pre-tax account is empty; the table
contains only years with a positive conversion. Real totals divide each
nominal conversion, tax and required withdrawal by that year's cumulative price
level before summing. The chosen option and best option are separate fields;
ties keep the first listed option.

The $109,000 individual and $218,000 joint 2026 Medicare thresholds and the
two-year lookback follow [SSA POMS HI 01101.031](https://secure.ssa.gov/poms.NSF/lnx/0601101031)
and the [CMS 2026 Medicare fact sheet](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles).
That POMS table places a surviving spouse with a dependent child in the
individual tier, which is used here. The flag starts at age 63 to look ahead
to age 65, and requires income strictly above the threshold; equality does
not trigger it. Later threshold indexing follows the page's planning assumption.
Money is rounded only for annual federal tax and final CSV answers; rates
are written with six decimal places.

## Round 8 (2026-11-06): each setting pays its own health bill (equity-1)
A couple stopping work at 60, Bo on the marketplace 2034-2038: the page called "Fill the 12% bracket" best ($2,474,810 left
after tax against $2,207,021 for none), but every setting was run with the health line of the saved setting (none), which kept
the premium tax credit. Filling 12% takes their income over the line where the credit stops (four times the poverty line) in all
five years, $121,102 of help lost (today's dollars), so 12% really leaves $2,191,158, less than none. With "12%" saved, the
same page read 12% best again, priced the other way round.
- Each setting is run on a copy of the plan with that setting saved (`planFor`: `retirement.rothConversion` = `{ on, fillRate,
  untilAge }`, `taxMode: "brackets"`), so buildInputs' health line (`projection/compute.js` healthCover, from `planIncome`, which
  runs the plan's own conversions) is that setting's: the marketplace credit before 65 and Medicare's income surcharge after.
- Per option: `healthReal` (the health line's total), `creditReal` (the marketplace credit over the bridge years, today's
  dollars: retirement/healthcare `years[].credit`), `creditLostReal` = none's credit - this setting's (floor 0), `cliffYears`
  (years over the line) and `cliffIncome` (the household's line in the first such year).
- The couple now: none $2,207,021, 10% $2,291,778 (best, gives up $11,548 of the credit), 12% $2,191,158, 22% $1,989,616,
  24% $1,852,076 (each the figure the page shows when that setting is the saved one), the same whichever is saved.
- The hero names the help lost ("From the 12% bracket up, income in 2034 to 2038 passes the line where the help with
  marketplace health insurance stops, which gives up about $121,102 of it before 65; the figures here count that"), each
  option says what it gives up, and the marketplace note leaves the fold for a notice under the hero when the plan has
  marketplace years (with the household's line in dollars when a setting crosses it). Without such years it stays in the fold.
- Cost: five builds of the inputs instead of one (each prices the health line once); about 40-60 ms a call on this plan.
- Not built (needs the engine): the "stay under the credit line" setting (fill to the line less other income in marketplace
  years, then to the bracket from 65) needs a per-year ceiling in `core/math/retirement.js`'s conversion step, which this batch
  does not change; and the credit worked inside `project()` from each year's own income.
- The 400% line: 26 U.S.C. 36B(c)(1)(A) (Cornell LII, read 2026-11-06); the rule that lifted it, 36B(c)(1)(E), covers taxable
  years before January 1, 2026 only. The household's line and the credit are retirement/healthcare's (its README, sources
  read 2026-10-31).
- Test fix: `tests/tax-pages.test.mjs`' single retiree at 60 (marketplace 2026-2030) still has 22% best, now by about $28,900
  (it read $110,700 with the credit kept); without the health line (healthIncluded) the gain is over $100,000 as before.

## Round 8 (2026-11-06): no years to convert in (widow-3)
A widow of 74 read "Conversions do not help this plan much" (five identical runs: the window is retirement to the
required-withdrawal age, and she is past it), with "Use this" on each setting, which turned conversions on and switched the
projection's tax setting to the brackets for conversions that never happen.
- `verdict`: `"no-pretax"` (nothing to convert), `"no-years"` (no years before the required-withdrawal age), `"fails"`,
  `"helps"`, `"no-help"`; `noWindow`: `{ reason, age, retireAge, rmdStartAge, name }`, reason `"started"` (at or past that age
  this year), `"late"` (retires at or after it), `"until"` (the chosen until-age comes before retirement), `"none"`.
- The page then says why and what still works: "This page only works out conversions before 73, the age required withdrawals
  start, and Ruth is 74. After that you can still convert once each year's required amount is out: take that year's
  required amount first (it cannot be converted), then anything more moved to a Roth is taxed as income that year and never
  again", and the heirs' line: "most heirs other than a husband or wife must empty an inherited IRA within 10 years ... A Roth
  they inherit comes out tax-free once it has been open five years". No settings list, no "Use this" (`offer` is false for every
  setting with no window or nothing to convert; "Turn conversions off" stays while they are on).
- Sources (read 2026-11-06): IRS Publication 590-A (2025), conversions, "Required distributions": "You can't convert amounts
  that must be distributed from your traditional IRA for a particular year", including the year you reach 73; IRS Publication
  590-B (2025): the 10-year rule ("withdraw the entire balance of the IRA by December 31 of the year containing the 10th
  anniversary of the owner's death"), eligible designated beneficiaries (a surviving spouse, a minor child, disabled or
  chronically ill, not more than 10 years younger) who may stretch it, and a Roth's qualified distribution (after the five-year
  period, made to a beneficiary after death) untaxed.
- Later (the engine): convert after the required withdrawal in the years from that age.

## Round 8 reviews (2026-11-06)
- **The younger spouse's money (review D3).** Al, 75, with no pre-tax money, and Bea, 66, with a $600,000 IRA: the page said
  "Converting once required withdrawals have started ... take that year's required amount first", true of nobody here. Bea has no
  required withdrawals until 2035 (75: 26 U.S.C. 401(a)(9)(C)(v)(II)), and only a year's required amount cannot be converted
  (IRS Publication 590-A, "Required distributions", read 2026-11-06). `noWindow.reason` is `"started"` only when the first adult
  owns pre-tax money (the engine's `rmd.owners` share); otherwise `"owner-younger"`, and `noWindow.younger` lists each other adult
  with pre-tax money under their own start age (`{ name, startYear, startAge, deferredNow }`): "Bea's $600,000 has no required
  withdrawals until 2035, so Bea can convert any part of it each year before then; each conversion is taxed as income that year."
  The engine still converts by the first adult's age only (`core/math/retirement.js`), which is claude-b's or the owner's call.
- **Nothing converted, nothing offered (UX 10).** A pension that fills the 10% bracket left "Fill the 10% bracket" converting $0
  with "Use this", which switched the tax setting for nothing: a setting is offered only with at least $1 converted
  (`totalConvertedReal >= 1`).
- **The plan's own setting well behind the best (UX 3).** `behind`: `{ fillRate, byBest, byNone, creditMore, fails, failYear }`
  when conversions are on and the saved setting leaves $1,000 or more less after tax than the best (or runs out while the best
  lasts). The couple saved on 12%: "Your plan is set to fill the 12% bracket. That leaves about $100,620 less than the 10% bracket
  (2,291,778 - 2,191,158), and $15,863 less than not converting (2,207,021 - 2,191,158), mostly because it gives up more of the
  help with health insurance before 65" (said when creditMore, $121,102 - $11,548, is at least half the gap), a filled "Switch to
  the 10% bracket", the "your plan" pill amber (plain when merely not the best; green only for the best), and the year-by-year card
  titled "Your plan's setting, the 12% bracket, year by year".
- **What the lost help is compared with (UX 4).** "about $121,102 less help than with no conversions" in the hero and on each
  setting (Health cover's own figure for the same years is against income just under the line; its words are claude-b's).
- **No years: no projection notes (UX 9).** "Set your own figure on this page" (the Projection page's note) sat alone under the
  answer; with nothing to try the projection's notes are not shown, and with years to try "on this page" reads "on the Projection
  page". The note's own words are in `projection/compute.js` (claude-b's to change at the source).
- Tests: `module.test.mjs` (fixtures `qa/fixtures/retiree-cases.mjs` `youngerOwnerCouple`, `fullBracketRetiree`,
  `shortSavingsRetiree`; the couple saved on 12%; the widow), each failing before its fix.

## Tests (round 8)
`module.test.mjs`: the couple (each setting's figure equals the saved-setting figure; 10% best whether off or 12% is saved;
credit lost by 12%) and the widow (`qa/fixtures/widow-plan.mjs`: verdict, no setting offered, the page's words, no "Use this",
the tax setting untouched).

## Ideas / not yet
- Stop at the IRMAA line as a choice; partial-year retirements; state tax on conversions.
- Stay under the marketplace credit line before 65 (needs a per-year ceiling in the engine's conversion step).

## Batch 5b (2026-11-06): compared on the same spending, and a page a layman can use
The owner's answer, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page".
- **Compared on the same spending every year.** With the share, years-left and guardrail ways now spending guaranteed income on
  top of their withdrawal (How much to take out README), the tax a conversion saves would be spent, not kept, and "left at the
  end" would miss it. `compute` runs every setting with `strategy: "fixed-real"`, so the ranking is the same whichever way the
  plan uses. Test "5b: a plan on another way compares its conversion settings at the same spending every year" (failed before).
- **The first screen.** h1 "Roth conversions"; the answer in one sentence ("Moving about $113,780 to a Roth from 2028 to 2040
  leaves about $6,702 more at the end, after tax."; the years only when the year-by-year list is the best way's own), then "Each
  year, convert only what is taxed at up to 10%." and one filled button ("Convert up to 10% each year"; "... instead" when the
  plan's own setting is behind, said in one line: "Your plan converts up to 12%: that leaves about $100,620 less than up to 10%,
  and $15,863 less than none."). Each setting is a record "Taxed at up to N%" with "$X left", one line ("Moves about $Y in all.
  $Z less help with health insurance before 65 than with no conversions.") and an outlined "Use this one" (the best one's button
  is the filled one). No year with nothing to try says "do not help": the widow reads "Ruth can still move money to a Roth: only
  what is above each year's required withdrawal, taxed as income that year." and one line on heirs.
- **Plain words.** "bracket" is "taxed at up to N%", the premium tax credit is "the help with health insurance before 65" (the
  line it stops at in dollars, not "four times the poverty line"), IRMAA is "Medicare's extra charge for higher incomes". The
  year-by-year list, each setting's tax and required withdrawals, the rules (five years, paying the tax from savings) and one
  line of official names are under "How this is worked out", one short line each; "Conversion settings" stays last.
- Tests: `module.test.mjs` "5b page: ..." (the couple at 60 retiring at 62, the couple saved on 12%, the widow; no paragraph
  over 160 characters on the first screen), each failing before the change; the batch-5 tests reworded with the page.

## Batch 5b reviews (2026-11-06): what the layman review changed
Under the owner's answer of 2026-11-06, word for word: "You can do as you please. Just make sure a layman can easily understand
and use the page".
- **Dollar amounts, not a rate that reads as a share of the account** (UX 4). Each option carries `moves: [{ year, real }]`
  (every year it converts $1 or more, today's dollars). The hero: "Move to a Roth about $4,000 in 2028, then about $13,700 a
  year from 2033 to 2040" (runs of years; a run whose amounts differ by more than a quarter says where it starts and ends; more
  than two runs: the total and the span; $100s). The button and rows say "the 10% rate", never "up to 10%".
- **The switch to the real rates is said** (UX 3). Before the tap: "This page uses the real tax rates; your plan uses a flat 15%
  until you turn conversions on." The confirmation: "Done: your plan now converts at the 10% rate: about $4,000 in 2028, then
  about $13,700 a year from 2033 to 2040. It also works out tax at the real rates now, not a flat 15%: that alone changes what
  Will the money last? says." (The couple's 65% to 82% is mostly the real rates: with them and no conversions it reads 85%.)
- **A small gain is called small** (UX 13): under 2% of what is left with no conversions, "Converting makes little difference
  for you: about $X more at the end, after tax", and the button is outlined. When the first move comes years after the window
  opens: "Until 2048, your other income fills the 10% rate (investment gains and dividends count), so this
  converts nothing before then." It says what the setting does, not that nothing could be converted: the engine fills
  each rate on taxable income with qualified gains and dividends included, so Kim's brokerage fills it until 2048. That is
  conservative: a conversion the standard deduction covers owes no tax while her gains stay in the 0% band, and from 2026 she
  could move up to about the deduction (about $16,100 in 2026) each year at no tax. Measuring the room on ordinary income (with
  the gains stacked on top, stopping where they would leave the 0% band) is a change to the conversion step in
  `core/math/retirement.js`, its oracle (`tools/golden_retirement/roth_conversions.py`) and the roth-conversions key: handed
  off, not in batch 5b. The year rows say "no other taxed income · no tax that year" instead of "$0 of income before · $0 of
  tax · taxed at up to 10%", and when every year the shown setting converts in owes no tax the hero says "with no tax to pay in
  those years", not "each taxed at the lowest rate, 10%" (Kim: $0 of tax in each of 2048 to 2055).
- **Money runs out either way**: "The money runs out in 2051 with or without conversions." / "Conversions move tax around;
  they do not add money. Will the money last? shows what would fix the plan." and an outlined "Will the money last?" button,
  not a link inside the sentence. The projection's spending note reads "Spending is today's expenses; change it under
  Retirement settings on Will the money last?" (the page by its own name, not "the Projection page").
- **Differences, not totals** (UX 11): each rate is "$6,702 more" / "$259,612 less" / "runs out 2057" against not converting;
  the fold gives the no-conversions total and says why Will the money last?'s "left at the end" is another figure (pre-tax money
  at full value, and the flat rate until conversions are on).
- **Costly rates folded away** (UX 10): a rate that leaves less than not converting (or runs out) is under "Other rates: each
  leaves less than not converting (N)", with no button.
- **Ruth, 74** (UX 12): "You can still move money to a Roth once each year's required amount is out. You pay the tax on it now,
  at your rate." / "It pays off only if your heirs would pay a higher rate on an inherited IRA later."
