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
(shapes in the `compute` comment).

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
  does not apply to the AMT (56(b)(1)(F)) + the incentive-option spread at exercise (56(b)(3)); at least 0. Exemption =
  the year's amount − `phaseOutRate` × (AMT income − the phase-out start), at least 0. Tentative tax = 26% up to the
  28% line + 28% above, with qualified dividends and long-term gains at their own rates stacked on the regular
  ordinary taxable income (Part III, `taxOnQualified`), never more than the flat figure. AMT = tentative − the regular
  income tax before credits. 2026 (Rev. Proc. 2025-32 §4.10): exemption $90,100 single / $140,200 joint / $70,100 separate; phase-out from
  $500,000 / $1,000,000 / $500,000 at 50 cents a dollar (P.L. 119-21 §70107); 28% above $244,500 ($122,250 separate).
  2025 (Rev. Proc. 2024-40 §2.11): $88,100 / $137,000 / $68,500; from $626,350 / $1,252,700 at 25 cents; $239,100.
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
phase-out, a separate return), with no pay, Part III, an itemizer, the AMT room, pay from stock (owed, withheld, the
wage base, the 0.9% at the household and the employer, 37% above $1 million, nothing), holding periods (the day after
the anniversary), the tax on a sale (the 3.8%, the household's loss limit), the family's units, incentive and
nonqualified options with this year's vests in the base, two grants sharing the room, the $100,000 split, lots with
and without prices, no share price, next year's wage base, not ready.

## Ideas / not yet
- Early exercise and the 83(b) election for restricted stock; the minimum tax credit year by year.
- A sale plan: how many units to sell at each vest to get under 10%.
