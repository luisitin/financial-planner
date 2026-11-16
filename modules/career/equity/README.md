# Equity compensation  (`career/equity`)

**Status:** usable, phase 10
**Purpose:** Tracks your employer stock plans: vesting and purchase schedules, the taxes they trigger and how concentrated you are.

## Inputs
- `equity = { symbol, price, priceAsOf, personId, grants: [...], espp: [...] }`, the Employer stock page's section
  (`investments/employer-stock` reads the same grants and its `vestSchedule()` and price; nothing is kept twice).
  This page adds `grants[].optionType: "nso" | "iso"` (options only; blank = nonqualified) and
  `espp: [{ id, offeringDate, purchaseDate, shares, price (paid per share), fmvOffering, fmvPurchase, discount }]`
  (purchase-plan shares, from the plan's statement or Form 3922).
- The price: the Employer stock page's (the typed price, or Holdings' when newer).
- Whose job (`equity.personId`, else whoever has a salary); their pay and the household's Medicare wages
  (`cashflow/income`); the household's federal tax (`taxes/federal` `taxInputs`, with the itemized state and local
  taxes); the state's rate (`taxes/state`); the wage base (`retirement/social-security` `maximumEarnings`).
- Writes `equity` (the company, grants, purchase-plan shares).

## Outputs
`compute(plan, { today })` -> `{ ready, needsPrice, year, symbol, price, priceAsOf, person, personWages, stake, grants, rsuYears, options, isoRoom, isoOver, espp, esppSkipped, amtNow, stateRate, notes }`
(shapes in the `compute` comment), plus `deferred` (`deferredPay`: the deferred pay plans' payouts and their tax) only when
`equity.deferred` holds a plan, so with none the output is the same, key for key.

## Formulas
- **Vesting** is the Employer stock page's `vestSchedule`: the cliff's share at `cliffMonths`, then every `every`
  months to `vestMonths`, whole shares.
- **Units by year** (`rsuYears`): every unit vesting in this calendar year (those already vested too) and next, at
  today's price, each year with its own Social Security wage base ($184,500 in 2026, $192,300 in 2027). Units are pay
  when they vest (IRS Publication 525; Publication 5992). This year's units are then part of the pay that every other
  figure for this year (options, the AMT, sales) stands on.
- **Tax on pay from stock** (`stockPayTax`), for units vesting or a nonqualified option's spread: federal = the
  household's `federalTax` with wages + the value, less without (income tax only); Social Security 6.2% on the part
  under the wage base ($184,500 in 2026) after the person's other pay; Medicare 1.45%; 0.9% on the household's
  Medicare wages above $250,000 joint / $200,000 single / $125,000 separate (IRC 3101(b)(2)); the state's rate.
  Withheld = 22% of the value for federal tax (37% above $1 million; IRS Publication 15, 2026) + Social Security and Medicare in full + the
  0.9% only on the person's own pay above $200,000 + the state's rate (assumed). Gap = owed − withheld: "set aside".
- **Alternative minimum tax** (`amt`, Form 6251 simplified): AMT income = AGI − the deduction taken (line 1, which can
  be below zero when pay is under the deduction) + the standard deduction (not allowed, IRC 56(b)(1)(E)) or, for an
  itemizer, the state and local taxes deducted (56(b)(1)(A)(ii)) less the 2026 limit on itemized deductions, which
  does not apply to the AMT (56(b)(1)(F)) + the incentive-option spread at exercise (56(b)(3)); it can be below zero
  (line 4), which means none. A married person filing separately adds back, once the exemption is gone (AMT income
  above the phase-out start + exemption ÷ `phaseOutRate`), `phaseOutRate` × the excess, at most the exemption (IRC
  55(d); for 2026 read the same way at 50%, which the IRS has not yet confirmed). Exemption = the year's amount −
  `phaseOutRate` × (AMT income − the phase-out start), at least 0. Tentative tax = 26% up to the 28% line + 28% above,
  with qualified dividends and long-term gains at their own rates, all of them (line 13 takes them from the gains
  worksheet's line 4, even the part the regular deduction covered), stacked on the regular ordinary taxable income
  (Part III, `taxOnQualified`), never more than the flat figure. AMT = tentative − the regular
  income tax before credits. 2026 (Rev. Proc. 2025-32 §4.10): exemption $90,100 single / $140,200 joint / $70,100 separate; phase-out from
  $500,000 / $1,000,000 / $500,000 at 50 cents a dollar (IRC 55(d)(4)(A)(ii)(I), (II) and (IV); P.L. 119-21 §70107
  made the rule permanent, added the 50% and indexes the $1,000,000 from 2025 prices); 28% above $244,500 ($122,250 separate).
  2025 (Rev. Proc. 2024-40 §2.11): $88,100 / $137,000 / $68,500; from $626,350 / $1,252,700 at 25 cents (IRC
  55(d)(2)); $239,100.
  Not modelled: other AMT items (private-activity bond interest, depletion), the AMT foreign tax credit.
- **AMT room** (`amtRoom`): the largest spread with AMT no more than today's + $0.50, by `largestAtOrUnder` on a
  doubling bracket, worked once for the year and shared across incentive grants from the oldest: each grant's
  options within it = floor(the room left ÷ its spread per share). Each grant's AMT is the extra it adds on top of the
  earlier grants.
- **Incentive options** (IRC 422): exercising adds no regular tax and no Social Security or Medicare (3121(a)(22));
  a qualifying sale is more than two years after the grant and more than one after the exercise (422(a)(1)), so from
  the day after the later anniversary (`dayAfter`; IRS Publication 544: a sale on the anniversary is short-term): the
  whole gain is long-term; sold sooner (a disqualifying sale) the spread is pay for income tax (`saleTax`). Exercise within 3 months
  of leaving the job (422(a)(2)); options usually end 10 years after the grant. AMT paid on exercise mostly comes back
  as the minimum tax credit in later years (IRC 53), said in words, not modelled.
- **The $100,000 rule** (422(d), `isoSplit`): for each calendar year, incentive options first exercisable that year are
  counted in grant order at the strike (an incentive option's strike is the grant-day price); the options past
  $100,000 are nonqualified. Their spread is pay (`stockPayTax`), the rest stays incentive.
- **Nonqualified options**: the spread at exercise (vested × (price − strike)) is pay: `stockPayTax`.
- **Purchase-plan shares** (`esppSale`, IRC 423, Publication 525): qualifying from the day after the later of the
  offering start + 2 years and the purchase + 1 year (more than two years and more than one). Qualifying: pay = shares × min(price now − price paid, discount × the
  offering-day price), at least 0; the rest a long-term gain (or loss). Otherwise: pay = shares × (the purchase-day
  price − price paid), even if the price fell; the rest a gain or loss, long-term from the day after the purchase's
  anniversary. Lots missing any of the three prices are left out, with a note.
  `saleTax`: pay as income (no Social Security or Medicare), short-term gains as income, long-term at their rates, the
  gains also counted for the 3.8% net investment income tax; a net loss off income together with the household's own
  allowed loss, at most $3,000 ($1,500 separate) in all; the state's rate on the total. The wait = tax now − tax at the
  qualifying date at today's price.
- **The stake**: the Employer stock page's share of everything invested (held shares, vested options, still to vest);
  10% is the usual most in one company.

## Edge cases
- A grant without shares or dates is skipped; an option under water has no spread and no tax.
- Units vested earlier this year are counted at today's price (their real value was the price on their day).
- State withholding is assumed equal to the state tax; employers' state supplemental rates vary.
- No grants, symbol or purchase-plan shares: the page starts with the company's price and a grant form. No share price:
  no figures, a notice asking for it and the company fold open. A grant with nothing vested says when the first vest is.

## Tests
`module.test.mjs`: the AMT tables (and the complete phase-out they imply), the AMT by hand (26%, 28%, the exemption
phase-out, a separate return), with no pay, Part III (and dividends the deduction covered), a separate return's
add-back, an itemizer, the AMT room, pay from stock (owed, withheld, the
wage base, the 0.9% at the household and the employer, 37% above $1 million, nothing), holding periods (the day after
the anniversary), the tax on a sale (the 3.8%, the household's loss limit), the family's units, incentive and
nonqualified options with this year's vests in the base, two grants sharing the room, the $100,000 split, lots with
and without prices, no share price, next year's wage base, not ready.

## Ideas / not yet
- Early exercise and the 83(b) election for restricted stock; the minimum tax credit year by year.
- A sale plan: how many units to sell at each vest to get under 10%.

## Answer key
`tests/golden-career.test.mjs` checks `amt`, `amtRoom` and `esppSale` against 2,000 AMT rows and 1,000 purchase-plan
sales worked independently from the IRS forms (`tools/golden_career`, `tests/golden/career/RULES.md`). It found the
Part III and separate-return add-back errors fixed above.

Review 2026-11-06 (round 7): "rides on the company that pays you" says you for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only).

## The whole return (round 8 review, 2026-11-06)
Under each year's "set aside", the page now says what the whole return comes to with the paychecks counted too
(`taxes/withholding` `taxAnswer`, the Federal estimate's answer for this year's return). The stock's own gap, 1,398 for the
equity couple, is not the April bill, 6,338. View only; no formula changed.

## Each year on its own tax tables (round 8 review fix, 2026-11-06)
Next year's units were worked on this year's tax tables, so the two pages disagreed. For the equity couple's 2027
units (60,000), Equity compensation said 498 to set aside and Employer stock said 352.

Now each year in `rsuYears` uses its own tax inputs, the same as Employer stock's `inputsFor`:
- this year: the plan's return (unchanged);
- the plan's set tax year: the plan's return;
- any other year: that year's tables with no typed gains.

Until the IRS publishes a later year's tables, they are the latest ones raised for inflation (`core/math/tax.js`
`paramsFor`). Rows built that way carry `estimated: true`, and the page says so under that year.

Figures for 2027: federal tax on 60,000 is 13,642 on 2027's tables against 13,788 on 2026's, so both pages say 352.
Test: "next year's units are worked on next year's tax tables".

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** What the vesting units cost is this household's tax. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. The base is the Federal estimate's return without this year's units (`taxView(..., { without: "stock" })`, `knownWithout(..., "stock")`): the Federal estimate has them in its wages already and this page adds them itself, so they must not be counted twice. The card now shows the extra 0.9% Medicare tax row (owed on the household's pay past the line, held back on the person's pay past 200,000), so "federal tax on it", "held back" and that row add up to "set aside". With a business, "Federal tax on it" is the Federal estimate's return with the units less without them (known() and knownWithout(), so the 20% business deduction and half the self-employment tax are worked again), and a row shows the change in the business's self-employment tax (the units fill the Social Security base, and move the 0.9% on the business's profit).

Round 8 follow-up (2026-11-07): the card's labels say "Social Security and Medicare (0.9% included)" and "self-employment and Medicare tax changes by".

## First view and the rows one tap away (simple first, opt spec 6.1 class B; 2026-11-16)
The page adopted `core/ui/more.js` (docs/OPTIONAL.md); it draws no `<details>` by hand.
- **First view**: the answer cards as before (the stake, units by year, incentive options, each option grant, purchase-plan
  shares), then the page's list, **"Grants"**: its rows with Edit and Remove and an outlined "+ Add another grant", or, while
  there are none, its add form. The form asks first for Kind, Units or options granted and Grant date, and "Options: the
  price you pay per share" only while Kind is an option (units have no price to pay); the name and the vesting pattern sit
  under "More details (optional)", blank by default (a blank vesting box saves the usual 48 months, a 12-month cliff and
  every 3 months, as each box's help says, so the line opens short).
- **One card of quiet rows** (kind `own`): **"The company"** (symbol, price, who works there; its status is "ACME at $50.00"
  or "not set yet") and **"Purchase-plan shares"** (the purchases; its add form while there are none). "The company" opens
  by itself only when the page has grants or shares to value and no price (the box the answer needs is in sight, R9); a
  save in a row keeps that row open with its green line (R17); Edit on a purchase opens its row with the form.
- **"More on this"**: "How much rides on one company?" (Employer stock), "What else does work give you?" (Work benefits),
  "What is the tax when you sell?" (Capital gains).
- **One filled button** on the first view: while the grant form is open its "Add the grant" is the one; the company's Save
  is outlined then, and so is the add or save of every other row's form, opened or not (opening "Purchase-plan shares"
  beside the grant form showed two filled buttons); while the company's price is missing for grants on the list, its Save
  is the one and the other rows' forms are outlined.
- Builder's choices: the company row is shut on an empty page (before, the company and the grant form were both open with
  two filled buttons: 12 boxes): the hero says "Add each grant from your stock plan's website below; the share price comes
  next." Purchase-plan boxes are no longer marked required at the box (a shut row may hold no required box); a purchase
  missing a date or a price is refused at Save with the same words as before.
- Counts (`node qa/first-view-node.mjs career/equity`): before 175 words, 12 boxes, 2 filled buttons with a plan (172, 11, 2
  on the empty plan); after 115 words, 3 boxes, 1 filled button, 3 rows on both (with "Pay held for later"; 122 words and
  4 boxes until the option price box went for units). The browser
  check (`node qa/first-view.mjs career/equity`) first found "Add the grant" below the first screen on the empty plan (the
  company's Save had been there before); the hero's line and two helps were cut to one line each ("Units, options and
  purchase-plan shares from your employer: when they vest, the tax on each, what to set aside, and when selling costs
  less."; "Units become shares as they vest; options are the right to buy at a set price."; "A lower-tax sale counts its two
  years from this date."), and it now ends at 840 px of 844; every page budget is met there and its entry is gone. Tests:
  "S11 (R17)" and "the page drawn".

## Pay held for later (deferred pay plans; gap list, next 60, item 30; 2026-11-16)
A deferred pay plan from work (a nonqualified deferred compensation plan): pay the employer keeps back now and pays out
later, taxed as pay when it is paid. One quiet row of the parts card, **"Pay held for later"** (kind `own`; a named own part
on a page with several). Its status: the years of one plan ("2031 to 2035", "in 2031"), or "2 plans"; nothing while empty.

**What it holds.** Empty: what it is for, the form, the risk line. With plans: each plan a record (its name, or "Pay held
for later" when none was typed; all it pays out in today's dollars, one sentence per case, Edit and Remove; a plan with no
year to pay in also has an outlined "Add your birth date" to People), then how the tax is worked out, the risk, and, once a
plan has a year, what Will the money last? does with the payouts; "+ Add another plan" opens the form. A save keeps the row
open with a green line naming the new answer and an Undo; Remove asks first and has Undo. Edit takes the green line away
(its Undo would take back the add or save of the plan being edited). While the grant form shows (no grants yet) or the
company's price is missing, the plan form's button is outlined: the page's one filled button is that other one.

**Inputs** (`equity.deferred`, optional; docs/DATA_MODEL.md): `[{ id, name, personId, balance, yearly, untilYear, years,
startYear, growth }]`. The form asks first for Name, What is in it now, What you put in each year, Paid out over (years) and
Starts paying ("The year you stop work (2042)", with two adults "The year Ana stops work (2050)" for the plan's owner,
changing with "Whose plan"; or a year from this year to 45 years on); under "More details (optional)": Last year you put
pay in, Grows each year after prices rise, Whose plan (two adults). No box is required at the box (a shut row holds no
required box); Save refuses with words at the box: nothing in it and nothing going in ("Type what is in it now, or what you
put in each year."), a last year before this one ("Type 2026 or later, or leave it empty.") unless it is the year saved
before (a plan saved in 2026 with 2026 as its last year saves again in 2027 as it is: the box's floor is that year too),
parts outside 1 to 30, growth outside -10% to 15%.

**Formulas** (`deferred.js` `payouts`, `compute.js` `deferredPay`, `payoutTax`). Y0 = this year; S = the start year (the
plan's, or its owner's stop year = birth year + retirement age, theirs or the plan's or 65, as Will the money last? reads
them), never before Y0 (moved to Y0 and said: "It would have started before 2026, so it is counted from 2026."); N = the
parts (1 to 30, blank = 1); g = growth a year after prices (blank = 0); B = what is in it; C = what goes in a year; U = the
last year it goes in (blank = S - 1).
- Stored data the form cannot make (an import, a hand edit): S at most Y0 + 100, and B and C at most $1 trillion each (the
  form's money boxes stop under a billion), so every figure stays finite and the work stays short: a stored start year of
  2,000,000,000 looped two billion contribution years (ten seconds a draw), and $1e308 grew to Infinity.
- Years put in: k = max(0, min(U, S - 1) - Y0), 0 when nothing goes in. From next year: this year's is taken as in B.
- Value when it starts: V = B (1 + g)^(S - Y0) + sum over y = Y0+1 .. Y0+k of C (1 + g)^(S - y).
- Each yearly part: P = V / a, a = sum over j = 0 .. N-1 of (1 + g)^(-j) (N when g = 0): equal parts, what is left growing,
  paid out to the last cent (the parts taken back to S add up to V).
- The base for year y: this year's return as the Federal estimate has it, without this year's vesting units (`taxView(...,
  { without: "stock" })`, the page's own base), its wages times the share of the household's pay (salary and bonus lines)
  of adults still at work in y (an adult's pay ends in their stop year); a child counts for the child tax credit only while
  under 17 at the end of y, and child care for the care credit only while a child is under 13 in y (IRC 24(c)(1),
  21(b)(1)(A), the ages the Federal estimate applies), so a payout in 2055 for a family whose child is 6 today is not wiped
  out by today's child credit.
- The tax in year y: T_y = F(base_y with every payout of y added to ordinary income) - F(base_y), F = the federal income tax
  (`federalTax` total less the 0.9% Medicare tax), at this year's tables (2026: Rev. Proc. 2025-32 section 4, as
  modules/taxes/federal/data has them). Each plan's share: T_y x its payout / all payouts of y.
- Hand cases (tests): single, $100,000 of pay, born 1980, stops at 62 (2042). B 100,000, C 10,000 to 2029, start 2031, N 5:
  k 3, V 130,000, P 26,000 for 2031 to 2035; tax each year 22% x (105,700 - 83,900) + 24% x (109,900 - 105,700) = 5,804.
  A lump of 100,000 in 2031: 23,564. From leaving work (2042), pay gone: 26,000 alone, 10% x (26,000 - 16,100) = 990 a year;
  100,000 at once alone: 13,170. Growth 3%: V = 148,718.77, P = 31,527.60.

**Words, one sentence per case** (`deferredLines`, `deferredSummary`, `deferredSaid`): "All of it in 2031: about $100,000,
with about $23,564 of federal tax." / "$26,000 a year from 2031 to 2035, with about $5,804 of federal tax each year." / runs
when the tax differs by year: "2040 to 2041: $20,000 a year, with about $4,400 of federal tax each year." and "2042 to 2044:
..." / with no year to pay in (from leaving work, no birth date): "Not counted yet: it pays from the year you stop work, and
that needs your birth date." (Bo's: "... the year Bo stops work, and that needs Bo's birth date.") / a zero: "with no
federal tax".
Saves: "Added. ..." / "Saved. ..." (for runs: "It pays $100,000 from 2040 to 2044, with about $9,970 of federal tax in
all."), "Removed "2026 deferral"."; Undo: ""2026 deferral" is off the list again." / "... is back as it was." / "... is
back on the list."
- How: "In today's dollars. Federal tax only, at this year's tables, on top of your household's other income now (less the
  pay of anyone who has stopped work by then). Social Security and Medicare tax was taken when the pay went in."
- Risk: "Until it is paid, this money is the company's: if the company fails, you wait in line with everyone else it owes."

**Sources** (read 2026-11-16):
- IRS Publication 5528 (Rev. 3-2024), Nonqualified Deferred Compensation Audit Technique Guide,
  https://www.irs.gov/pub/irs-pdf/p5528.pdf: I.B.1, an unfunded plan is the employer's "mere promise to pay", its assets
  stay the employer's general assets, "subject to the claims of the employer's creditors if the employer becomes insolvent"
  (the risk line); II.C, deferred amounts are taken into account for Social Security and Medicare at the later of when the
  work is done and when there is no substantial risk of forfeiting them, once (the "special timing rule": no payroll tax on
  the payout); III.B.4 (section 409A), payment only at a specified time or fixed schedule, separation from service, and a
  few other events, chosen before the year the pay is earned (the two ways a plan starts here).
- IRS Publication 15-A (2026), https://www.irs.gov/publications/p15a, "Nonqualified Deferred Compensation Plans": income
  tax withholding on amounts includible in income; Social Security, Medicare and FUTA when the services are performed or
  the risk of forfeiture ends, whichever is later.
- IRS Publication 525 (for 2025 returns), https://www.irs.gov/pub/irs-pdf/p525.pdf, "Nonqualified deferred compensation
  plans": the year's deferrals are shown in box 12 of Form W-2 with code Y, and "This amount isn't included in your income".
- Could not be read here: the regulations themselves (eCFR refuses automated reads), so the guide's summary of Treas. Reg.
  31.3121(v)(2)-1 is what the payroll line rests on.

**Builder's choices** (never asked; said here):
- Growth defaults to 0% after prices: the payouts keep up with prices and no more, so nothing is overstated; a person who
  knows the plan's funds types a rate.
- Equal parts are level payments with what is left growing at the same rate (with no growth, the balance over N); plans
  that pay "the balance over the payments left" pay the same with no growth.
- Federal tax only. State tax on payouts depends on where the person lives when paid (and a state may not tax payments
  over 10 years or more from such a plan), so it is left out and the line says "Federal tax only".
- The base is today's return, with the pay of anyone stopped by then taken out and children counted by their age that
  year; Social Security and pensions that start later are not added (a payout in retirement may be taxed a little low),
  a business's profit and other income stay as today even after their owner stops work, the age-65 deduction is counted
  as today (this year's tables would give the 2025-2028 senior deduction to years it no longer exists), and a grown child
  is not counted as another dependent. The deferral itself is not taken off this
  year's wages here (Income may hold pay before it); the Federal estimate owns that.
- A plan typed here and also as an account on Net worth is counted twice by Will the money last?; the plan's balance
  belongs here only.
- The row is shut on every visit except right after a save in it; it is not open for a plan with deferred pay only.

**Will the money last?** counts each payout as income in the year it is paid (once a plan has a year to pay in, the row
says "The Will the money last? page counts each payout as income in the year it is paid."; the page's name is not left
mid-sentence with its question mark). `deferred.js` `deferredIncomes` gives one engine line a placed plan:
`{ name: "Pay held for later: <name>", yearly: P, fromYear: S, untilYear: S + N - 1, startAge: 0, cola: true, taxable: true,
pretax: true, notInMonth: true, type: "other", deferred: <the plan's id, or true> }`, pushed last in `retirement/projection` `buildInputs`, so every page that
starts there counts it (Year by year, Chance the money lasts, the stress tests). The engine (`core/math/retirement.js`):
- with the brackets it is ordinary income in its year, like every taxable line (the flag changes nothing there);
- with the one simple tax rate, which taxes no income line, the flag taxes it at that rate, like money out of a pre-tax
  account (it is pay set aside before tax): in retirement as part of the year's tax, which savings pay; before the
  household retires the income pays it and the rest goes into savings (`incomeSaved`), as new money does with the brackets;
- `notInMonth`: today's month does not hold it, so a payout before the household retires is saved after its tax, whatever
  the owner's switch for pensions says (no plan held one before, so no frozen figure moves);
- in "Income counted" it reads "Pay held for later: 2026 deferral: $26,000 a year from 2031 (you are 51) to 2035", or for
  a payout all in one year "Pay held for later: X: $100,000 in 2060 (Ana is 70)", and among what pays for retirement it
  is "other income";
- Retire early leaves it out of its "a year of other income" words (it is paid in set years, often one: a $100,000 payout
  in 2060 read "$100,000 a year of other income" with no end); its ages still count it, through the projection.
Invariance: `tests/deferred-pay-invariance.test.mjs` digests Equity compensation's compute, the projection's inputs, the
engine's six ways in the flat and the brackets setting, the projection and Year by year over 46 invented plans (every qa
fixture plan, the 14 households' base plans, the phone-built and round 8 households, the empty plan and the family with
stock pay) and finds each byte for byte as at 7d9ca39. Tests: "the engine: a pretax line ..." and "Will the money last?
counts each payout ...".
