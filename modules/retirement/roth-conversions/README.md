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

## Follow-up 2026-11-07 (batch 5b R4): gains and dividends do not use up the room
The room under a rate is what ORDINARY taxable income leaves. Qualified dividends and long-term gains are stacked on top of ordinary income (IRS Pub.
550; the Qualified Dividends and Capital Gain Tax Worksheet), so they never fill the 10%, 12% ... rates. `core/math/tax.js` `roomUnder` and the
engine's top-up (`core/math/retirement.js`) now measure `ordinaryTaxable` (taxable income less the qualified part, never below 0) against the bracket's
top; they measured all taxable income, which counted the gains and dividends as filling the rate. Hand check, single, 2026: $32,000 of qualified
gains and dividends and no other income, deduction 16,100, the 10% rate ends at 12,400 of ordinary taxable income: room 28,500, tax 1,240 (the gains stay in the
0% rate: taxable 44,400 under 49,450). Rows with no qualified income are unchanged (the frozen key's `room` rows have none).
- Kim (45, $950,000 brokerage, no pay): "Converting makes little difference for you: about $4,948 more" is now "no-help": her dividends no longer fill the 10%
  rate, so it converts about $451,000 in all (before: $22,000), which costs the marketplace help with health insurance before 65 and pushes dividends out
  of the 0% rate, and leaves far less than not converting. The reason line is "Until 2048, your other income fills the 10% rate (investment gains and dividends
  count), so this converts nothing before then." -> "Until {year}, your other income (pay, pension, taxable Social Security, withdrawals) fills the {rate}
  rate, so this converts nothing before then." (shown only when a late start has that cause).
- The equity household (`earlyRetirees`): the 10% rate converts about $321,740 (was $166,944) and gives up $111,262 of the marketplace help (was $11,548)
  for $121,042 less tax; it leaves $2,151,634 (was $2,291,778, the best), the 12% rate $2,112,783 (was $2,191,158), so not converting ($2,207,021) is now
  the best. (The first version of this follow-up showed 10% as best, $2,250,678: a float hair over the top made some years convert $0; see below.)
- Verify (2026-11-07): ordinary taxable income is taxable income less the qualified part, and that subtraction can leave the engine's first try a hair
  (1e-11) over the rate's top. The top-up read that as "over", stepped back by the same hair, was still over, and converted $0 for the year (the equity
  household skipped 2032 and 2034 at 12%; 29 of 197 sampled qa plans moved, none at 3051787). `core/math/retirement.js` now takes a first try within a
  tenth of a cent of the top, either side, as on it (a hair over is stepped back under, as before). Test: "a year whose first try lands a hair over".
- Table rows carry `ordinaryTaxable` beside `taxableIncome`; each conversion year ends with `ordinaryTaxable` at the rate's top.

Money review of the follow-up (2026-11-07):
- M2: when the lowest rate loses more of the help with health insurance before 65 than it saves in tax, the first screen says that ("Even at the lowest rate you would end with
  less. Before 65, what you convert counts as income, and that costs more of the help ... than it saves in tax (at the 10% rate, about $101,116 of help lost for $31,097 less tax)")
  instead of "the tax now is about what it would be later" (kept only where no help is lost). Kim: converting at 10% pays $31,097 less tax and gives up $101,116 of help. Not done,
  the owner's call: stop each year's conversion at the help's income line so a fill never buys a cliff (it would bring back the helpful conversion for households like the
  surviving-spouse sample, whose old $13,029 gain now reads "no-help" because the bracket-correct room crosses the line). Reach: 17 of 334 sampled plans flip, all one household.
- M3: the line under the table no longer says gains and dividends "count toward each rate's limit": they are taxed on top of other income and do not use up a rate, but a
  conversion can push some of them from the 0% rate to 15%.
- M4: decided to TELL, not to cap. Stopping the fill where taxable income reaches the next gains-rate top (tried) cuts a 22% fill from $48,475 to $22,141 for anyone with gains
  just under the 0% top, so it changes what "fill" means. Instead the engine records `gainsMoved` per conversion year (dividends and gains the conversion pushed past a gains-rate
  top) and the hero adds ", or a little more in years it also raises the tax on your investment earnings" when the table shown has any. Kim at 10%: 2026 none, 2027 7,432 pushed
  (58,382 taxable against the 50,950 top).
- Words: the button reads "Move money up to the 10% tax rate"; "Leaves it where it is; you pay tax as you take it out."; the no-years lines say what a Roth is and who benefits
  ("your children would pay tax at a higher rate on what you leave them"). "the lowest rate, 10%" keeps its short form: the line is held to 160 characters.
- Verify (2026-11-07), money review note: the late-start reason names what fills the rate, "your pay, pension, taxable Social Security and 401(k) or IRA withdrawals" (withdrawals from an investment account fill nothing).

## Wording follow-up (2026-11-07, claude-b lane B)
- First screen (2026-11-07): one sentence says what a Roth conversion is, one says what a rate means ("Each rate is a ceiling: each year the plan converts only as much as stays taxed at that rate or lower. At the 22% rate, none of it reaches 24%."); Medicare's extra charge has its own sentence with the figure and the rate it is about (the rate the year-by-year list shows: the plan's own while conversions are on, else the best way, else 22%), when the years shown pass it ("Medicare also charges extra on its monthly premiums, from 65, when your income two years earlier passes about $109,000 (in today's dollars). Converting at the 22% rate in 2026 to 2030 would pass it. The figures below count that charge."); "that bracket" became "the room under that rate"; the list of other ways is "Other choices: each ends with less than not converting". Under "How this is worked out" IRMAA is spelled out (income-related monthly adjustment amount). The math is unchanged.

## Stress test 2026-11-11 (claude-e, wave 2)
- The folded year list's rows read "$21,005 to convert"; "Income before" is mentioned only beside the wide table (RB4).

## Simple first (2026-11-13, opt C6)
Every fold is now drawn by `core/ui/more.js` (docs/OPTIONAL.md), titles unchanged, so the first view is the same:
- "How this is worked out": kind `how`, a folded card. Settings > How much to show > "Show how answers are worked out" opens it
  on this phone; a person's own tap on it is kept for 90 days.
- "Other choices: each ends with less than not converting (N)": kind `item`, a row inside "How much to convert". Its title is
  pinned by two tests and names the group it holds, so it is not renamed to "N more ways"; no switch opens it.
- "Conversion settings": kind `item`, a folded card, with its status ("off", "on, at the 22% rate"). It holds a pick from a
  list, not a figure to type, so "Set my own numbers" would be untrue; R24 lets a builder pin such an `own` title in
  `PINNED_TITLES` (`qa/first-view-lib.mjs`), which this change could not edit, so it is an item until then (builder's
  choice; flipping it to `own` with the pin is a two-line change). No switch opens it. A change of "Convert each year" draws it
  open on the redraw that follows (R17), never remembered.
S11 in `module.test.mjs`: a save from the hero moves no part; a save in Conversion settings keeps that part open and moves no
other.

## Stop sooner (2026-11-14, gap design #26)
**What a person gets.** Nothing new on the first view. Inside "Conversion settings" there is one optional row of chips,
"Stop sooner": "No earlier stop" (the default: the tax rate alone, as before), "Under Medicare's income surcharge" and
"Under the marketplace credit line". Under them, one sentence for each line (what it is, its figure, its years) and a short
list: each choice at the rate the page shows, what it leaves at the end against no earlier stop, and its tax and health
insurance over the whole plan. A tap saves, says the new answer in a green line, and leaves the part open.

**Data.** `retirement.conversionCeiling?: "bracket" | "medicare" | "marketplace"` (optional, no version bump; absent,
"bracket" or anything else = the tax rate alone; "No earlier stop" removes the field). Read by `ceilingOf(plan)` in
`ceiling.js`. `projection/compute.js` `buildInputs` hands the engine `inputs.conversionCeiling` only while conversions are on
and a line is chosen and has at least one year; otherwise no key is added, so every other page is as it was.

**Formulas** (`ceiling.js`, pure; the engine step is in `core/math/retirement.js`, "rothConversion").
- conversion_t = the most c >= 0 with BOTH ordinary taxable income_t(c) <= the top of the chosen rate AND
  counted income_t(c) <= line_t x prices_t. A year already over its line before any conversion converts nothing. The engine
  solves it with the same probe-and-secant step as before, on max(over the rate's top, over the line); both rise at least a
  dollar for each dollar converted (the tax on a conversion is paid from other money, which can add gains), so the answer is
  the largest c at or under both.
- counted income = adjusted gross income (ordinary income + dividends and gains + the taxed part of Social Security) + tax-exempt
  interest (an income line with `taxable: false`, type "investment"). For the marketplace line the untaxed part of Social Security
  is added too. These are the two programmes' own measures: Medicare's is AGI plus tax-exempt interest (42 USC 1395r(i)(4)(A);
  SSA POMS HI 01101.010); the marketplace's also adds untaxed Social Security and excluded foreign income (26 USC 36B(d)(2)(B)).
  They match what `retirement/medicare` (`magiReal`) and `retirement/healthcare` (`magi`) already compute from a run, and the
  tests check the result against those two pages' own figures, not against this file.
- **Medicare.** A year's premium is set from the tax return of two years before (42 USC 1395r(i)(4)(B)(i); SSA: "2026 premiums
  are generally based on 2024 tax return information"). So in every year t in which someone is 65 or older, and still within
  their plan, in t + 2 (`medicareYears`), line_t = the first surcharge tier for the household's filing status, read from
  `retirement/medicare/data/medicare.js` (`tiersFor(status)[0][0]`; no figure is copied here). The table holds the tier in
  today's dollars and the Medicare page compares each year's income in today's dollars against it; the line is used the same
  way (line x that year's prices), so the two pages can never disagree about a year. `IRMAA_FIRST_TIER` in `compute.js`, which
  was a second copy of the figure, now reads the same table (same values: the outputs are byte-identical).
- **Marketplace.** In each year marketplace cover is bought, line_t = that year's `cliff` from `retirement/healthcare`'s own
  compute (four times the poverty line for the household's size under "As the law stands"; `marketplaceLines`). Under "If the
  larger 2021-2025 credits come back" there is no line: nothing is capped, no chip is offered, and Conversion settings says in
  one sentence "no cliff under these rules: at higher incomes each extra $1 costs 8.5 cents of credit" (the flat top share of
  that schedule, `topShare`). Married filing separately gets no credit, so the choice is not offered.
- A conversion stops `UNDER` = $1 (today's dollars) below a line, so cents of rounding never land on the wrong side. Both
  lines are "more than" tests in the law, so a dollar under is safely inside.
- `stops` in the page's output: the tax rate alone and each line, each run through the same `run()` as the page's options at
  the rate `shown` (so each pays its own health bill: marketplace premium less credit before 65, Medicare with its surcharge
  after). lifetime tax = sum of each year's tax / that year's prices; health insurance = the health line's total, today's
  dollars. `sameAsBracket`: the line changes no year (converted amount within $1, the end within $0.50).

**Sources, and what could be checked on 2026-11-14.** The session's network could open no .gov or law site (law.cornell.edu,
uscode.house.gov, ssa.gov and kff.org all refused), so the rules were re-checked through web search results only, read
2026-11-14, and the app's own citations (read 2026-10-31 in `medicare/data/medicare.js` and `healthcare/data/aca.js`) stand:
- Two-year look-back and Medicare's income measure: SSA POMS HI 01101.020 and HI 01101.010 (both dated 12/02/2025: income
  "from two years prior to the year for which the premium is being determined, but not more than three years prior"; AGI plus
  tax-exempt interest), and SSA's Medicare premiums page (over $218,000 filing jointly, over $109,000 otherwise, for 2026).
  The 2027 lines were not published in what the search returned; the app indexes the 2026 line with prices, as the Medicare page does.
- The marketplace line: IRS Publication 505 (2026), "What's New", and the Congressional Research Service report R48290:
  for tax years after 2025 a household over 400% of the poverty line gets no premium tax credit; the 2021-2025 rule that lifted
  the limit ended. The same results say there is no longer a cap on paying back a credit received in advance, which makes
  ending a year just over the line cost more, not less.
- Whether the larger credits apply this year: no. KFF (October 30, 2026) and news of the 2027 open enrollment (November 2,
  2026) describe the larger credits as expired and the extension bills as proposals; no enacted law was found. So "As the law
  stands" holds and the marketplace line is real for 2026 and 2027 cover.
A builder with open network access should re-read the two statute sections at uscode.house.gov and put the date here.

**Decisions (the spec was silent or the code differed).**
- A chip is offered only when its line would change a year of this plan at the rate shown (or is the plan's saved choice),
  which is stricter than "someone reaches 65 in the plan": a chip that changes nothing is noise on a phone.
- Under the larger-credit rules the spec asked for a chip that caps nothing; the page shows the sentence without a chip.
  The spec's sentence said "up to 8.5 cents"; between three and four times the poverty line a dollar can cost more than that
  (the share itself is still climbing), so the sentence says "at higher incomes" instead.
- The spec said the Medicare line is "the tier for t + 2"; the app keeps tiers in today's dollars, so the line for t is the
  same tier at year t's prices, exactly how the Medicare page judges that year.
- Where a plan's health insurance is already inside its spending (or an Expenses line pays it), no premium is worked out
  from income and every choice's health figure would be $0: the list then
  shows tax only and says "what this saves on premiums is not shown" (`healthPriced` false).
- The engine gained one more thing than the spec named: tax-exempt interest is summed (`incomeExempt`) so a line can count it.
- The choice sits in "Conversion settings" (an item part, as C6 left it), not a part named `own`: the part holds picks, no box.
- The line is not solved in t for the surcharge two years on in tomorrow's rules: a tier change by law would move it.
  It is also held at year t's prices, not t + 2's, so a stop sits about two years of inflation under where the tier will be
  when the premium is set: on the safe side, and the same comparison the Medicare page makes (review, 2026-11-14: kept).

**After the two reviews (2026-11-14).**
- While conversions are off, nothing is the plan's yet: the list shows no "yours" pill, and the green line after a tap says
  "It counts once conversions are on in your plan" and quotes no end figure. The chip that is on still shows the saved choice
  (it is the setting's value, like "Convert each year" beside it), so a tap is seen to have been saved.
- Each choice's figure carries its noun ("$52,267 more left at the end.") and sits on its own line under the name (beside a
  long name it broke the name letter by letter at 320 px); the cost line reads "Tax over your whole
  plan: ...; health insurance: ...".
- Where a line is explained on the first view, the way out is named: '"Stop sooner" in Conversion settings keeps you under
  that line' (marketplace) and '"Stop sooner" in Conversion settings avoids it' (Medicare's charge). The second is
  kept to seven words so the first view's word count stays inside its entry (309 before, 310 now, 310 allowed).
- The Medicare sentence names a year only when someone turns 63 in it (`turns63`); with someone already past 63 it says
  "This keeps each year just under it."
- A line saved earlier that has nothing left to act on (the pre-tax money is gone, or there are no years to convert in)
  draws no chips; the page then says so in "Conversion settings" with one outlined button, "Remove that stop" (`idleWords`).

**Tests.** `module.test.mjs` "#26 ...": test 1 (absent, "bracket" and junk are byte-identical; the engine with an Infinity
line), the engine (lands on the line to a cent, converts nothing over it, counts tax-exempt interest), test 2 (Medicare page:
3 surcharge years become 0, each priced year at or under the tier), test 3 (Healthcare page: 4 years past the line become 0,
credit kept), test 4 (lifetime tax and health insurance for each choice), test 5 (larger-credit rules cap nothing), every
sentence case, and the page (chips, tap, saved state). `tests/roth-ceiling-invariance.test.mjs`: 33 invented plans, field
absent against "bracket", inputs, engine rows and every page that reaches the projection.
