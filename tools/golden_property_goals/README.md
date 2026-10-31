# Vehicles, big purchases and renovations answer key

One independent answer key for three household pages: "Vehicles" (what a car costs a year, and keep, buy or lease),
"Big purchase planner" (save up, finance or pay cash, and which goals give way) and "Renovation" (paying for a home
improvement):

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `pg_key.py` | `tests/golden/property-goals/vehicles.csv` | 1,500 | invented households with one or two cars. Each car's year: value lost, fuel or electricity, insurance, upkeep, registration, the loan's interest over the next 12 payments, total, per mile, monthly. The what-if for the first car over 1 to 10 years: keep (only the upkeep rising), buy and lease (running costs flat) (paid, back, cost, monthly, end value, owed at the end), the trade-in, the new loan or the cash back, the cheapest (a walk with a $1 margin); blank what-if inputs at the page's defaults (an electric first car's new car charged like the car when its mpg is blank, E1); contrasts |
| | `tests/golden/property-goals/purchases.csv` | 1,500 | invented big purchases with 0 to 4 goals. Total with tax, whole months to the date (W2), save up (monthly and earned), finance (level, all 0%, or 0% for the promo months then the APR), pay cash (fits when the usable cash covers the amount), and for each way the goals that give way (a goal already done skipped, a spare below 0 counted as 0; new monthly, old and new months, paused) and what no goal covers; contrasts |
| | `tests/golden/property-goals/renovations.csv` | 1,500 | invented home projects. Value added, equity change; cash and the cushion in months; home-equity line, cash-out refinance against keeping the old mortgage (none without a mortgage), personal loan: monthly, interest, fees, deductible, tax saved (within the $750,000 limit, closing costs left out; the line's by IRS Publication 936 Table 1, the mortgage's own share cut while the line runs), today's money (after the tax saved), fits; blank rates and years at the page's defaults; the ranking and the best (a walk with a $1 margin); law / contrast columns |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the model as small
functions. `tests/golden/property-goals/RULES.md` gives each rule in plain words with the source text and works three
examples by hand (section 8). Those examples are rows `veh-0001` and `veh-0002` (Ana's sedan and hatchback; the sedan kept
one year), `veh-0025`, `-0027`, `-0028`, `-0032` and `-0007` (a blank new mpg and upkeep; cash back; the $1 margin of the cheapest;
an electric first car with a blank new mpg),
`pur-0001`, `pur-0020`, `pur-0033` and `pur-0034` (Ben's sofa; a goal already done; a spare below 0), and `ren-0001`,
`ren-0002`, `ren-0004`, `ren-0008`, `ren-0014` and `ren-0016` (Cy and Dee's kitchen; with less cash and no itemizing; with no
mortgage; a mortgage over the limit, L1; the $1 margin; a blank refinance rate).

**Independence.** This key was written from the brief (which states the three pages' models, "page convention") and the
sources listed in `rules.py` and RULES.md (26 U.S.C. 163 and 63, IRS Publication 936 (2025), the CFPB home-equity booklet,
12 CFR part 34, HUD Mortgagee Letter 2019-11, a Freddie Mac page, the Texas Comptroller, a CFPB deferred-interest page and
three car-depreciation articles). Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never
imports or runs the app. The only things taken from `tools/golden_property/` and `tools/golden_debt/` are their layout and
conventions (how a key script, its two derivations, its guard and its README are laid out); no figure or code is shared.

The pages' documented model is the spec, and the main columns follow it: since the second revision of 2026-10-31 that
includes the conventions the pages state (V1-V3, P1-P3, R1-R5, and since the fourth revision L1, A7, A9, B5 and D1;
RULES.md section 7). Where a fact a page states could be
wrong (a lender's limit, a tax rule, a payment formula), or where the key read the brief another way, the main column keeps
the page's arithmetic and a law / contrast (`alt_*`) column gives the other figure; its source is in RULES.md sections 3.3,
3.5, 4.1, 4.3 to 4.5, 5 and 6.

The script works every row in two separate ways. It refuses to write any CSV if, between the two:
- an amount differs by more than a cent,
- a rate or ratio differs by more than 1e-6, or
- any other value (count, month, date, flag, label, order of the goals or of the ranking) differs at all.

In fact they agree exactly, before rounding, on every value: vehicles.csv 90,100 amounts, 3,610 rates and ratios and
14,110 other values; purchases.csv 44,432 amounts and 46,474 other values; renovations.csv 64,500 amounts, 9,000
rates and ratios and 30,000 other values. Both derivations are exact (`fractions.Fraction`), so the guard's cent and 1e-6
slack is never used.

## Run

```
python3 -B -I tools/golden_property_goals/pg_key.py
```

Python 3 standard library only (made with 3.13; about 5 minutes, most of it `rules.py` stepping every renovation loan's
interest month by month in exact fractions for R2). The run is deterministic: `random.Random(20261031)` (and, for the fuel
price an electric first car carries since the fourth revision, `random.Random(20261032)`), and the generator draws only
integers (`randint`, `randrange`, `choice`, `sample`), never a float. A second run writes
byte-identical files. This was checked on 2026-10-31, after the fourth revision as corrected that day (E1), with two runs into separate scratch
folders (byte-identical, their printed reports too) and a third into the real one:

| File | sha256 |
|---|---|
| vehicles.csv | `a3aca0c086a77a48ec408f47ec07d04682be7ccc7b23e8f33104f8a180e9d99f` |
| purchases.csv | `c826d731e620f0f875223449cdd843fc51c932e402f1edce49066acf3e7a31af` |
| renovations.csv | `656bd73ad52cc9fa3848c48f67500ce6df5b184e490d57fd4d5fc0c833211f06` |

The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, and `-B` covers Python's own cache, so no
`__pycache__` lands in the repo. `-I` keeps the environment and the current folder off the import path; the script puts its
own folder on it to find `rules.py`.

What a run does, in order:
1. Importing `rules.py` runs its 194 self-checks.
2. Derivation 2 is checked against RULES.md section 8 (70 assertions): Ana's two cars and the sedan's keep / buy / lease
   with every contrast (and the one-year keep, a blank new mpg and upkeep, cash back with and without cash down, the
   wagon's $1 margin, the electric hatchback with a blank new mpg), Ben's sofa (save up by W2 and by W1, the promo payment, the deferred-interest contrast, both ways'
   giving goals, pay cash, the done goal of `pur-0020` with its contrast, a spare of -150 with its literal contrast), and
   the kitchen (cash, line, refinance, loan, the tax saved and today's money after tax with their contrasts, no mortgage,
   the $1 margin, every ranking, the line over the limit by L1, a blank refinance rate).
3. All three CSVs are worked, every row both ways.
4. 137 coverage minimums taken from the brief and the stated conventions are checked.
5. The three CSVs are rendered in memory and written only once all of that has passed and all three have rendered (a row
   that does not fit its columns stops the run too); the run then prints every check count, the coverage and the three
   sha256.

Options:
- a folder argument writes the CSVs there instead (`pg_key.py /tmp/x`);
- `--mutate NAME` puts one deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script);
- `--skip-examples` turns off the examples check, so the row guard has to find a mistake alone.

That is how the table under "Deliberate mistakes" was made.

`tests/golden/property-goals/todo.json` is for the test that compares the pages with these files
(`tests/golden-property-goals.test.mjs`): it lists, by cause, the rows where a page disagrees with this key.

**Revised 2026-10-31 after that comparison** (RULES.md section 11). Six conventions changed, each with a deliberate mistake
below that undoes it: C1 is now 3% of mortgage + cost (the page's reading; the brief does not say); B8 counts the set-aside
money up to the total (earned is 0, not below 0, when more is set aside); what could be borrowed is at least 0; C4 lets the
refinance fit only when its new loan is at most 80% of the value (HUD1911; the brief let it always fit); A5 credits a
positive trade-in on the lease and A6 takes what the old loan still owes off Keep's back (like for like; the brief's
figures are the contrasts `alt_lease_equity_not_credited` and `alt_keep_owed_end_ignored`).

**Revised again 2026-10-31: the pages' stated conventions are the main columns** (RULES.md sections 7 and 11). The brief
said the main columns check each page's own model exactly; the first run found places where they held the key's own reading
instead. The pages' conventions, given to the key, are now the main readings in both derivations, each with a deliberate
mistake below that undoes it, and the key's earlier reading is kept as an `alt_*` column:

| Rule | Main now | The key's earlier main, now the contrast column(s) |
|---|---|---|
| V1 | Keep: only the upkeep rises (`upkeep x (1 + rise)^t`) | `alt_keep_rise_all` |
| V2 | Buy and Lease running costs flat (lease upkeep x 0.5) | `alt_buy_rise_all`, `alt_lease_rise_all`; Keep's rule on the new car `alt_buy_rise_upkeep_only`, `alt_lease_rise_upkeep_only` |
| P1 | `months` by W2 (the day of the month must be reached), and every save-up figure from it | `alt_months_w1`, `alt_save_monthly_w1`, `alt_save_earned_w1` |
| P2 | a goal already done is skipped when goals give way | `alt_save_giving_done_goals_give`, `alt_save_uncovered_done_goals_give`, `alt_finance_giving_done_goals_give`, `alt_finance_uncovered_done_goals_give` |
| P3 | `cash_fits` = usable cash >= amount | `alt_cash_fits_keeps_emergency_target` |
| R1 | tax saved within $750,000 ($375,000), closing costs left out | `alt_line_tax_saved_no_limit`, `alt_refi_tax_saved_extra_interest` |
| R2 | today's money after the tax saved, discounted like the payments | `alt_line_todays_money_before_tax`, `alt_refi_todays_money_before_tax` |
| R3 | no refinance without a mortgage with a payment (columns blank) | `alt_refi_no_mortgage_monthly`, `alt_refi_no_mortgage_todays_money`, `alt_refi_no_mortgage_fits`, `alt_ranking_refi_no_mortgage` |
| R5 | `ranking` / `best` by a walk with a $1 margin | `alt_ranking_lowest_first`, `alt_ranking_before_tax` |

V3 (A6, A5) and R4 (C4, the line's 85%) were already the main readings. P3 came with the note "already the key's main";
that held for the amount and what is left, not for the fit (the key tested what is left against the emergency target), so the
fit was changed too. Columns gone because they would equal a main column: `alt_keep_rise_upkeep_only`, `months_w2`,
`line_law_tax_saved`, `refi_law_tax_saved`.

**Revised a third time 2026-10-31, after a verifier's review** (RULES.md sections 5.5 and 11). R1 puts the limit's share on
the line's interest alone. Publication 936's Table 1 puts it on all the home's interest (line 12: "the total of the average
balances of all mortgages"; line 15: "Multiply the amount on line 13 by the decimal amount on line 14"). So once the line
takes the home debt over the limit ($750,000, or $375,000 filing separately), the mortgage's own deduction is cut too. Two law columns give that figure,
`line_law_tax_saved_table1` and `line_law_todays_money_table1`, worked in both derivations. No main column changed. In 146
rows the law's tax saved was lower than R1's, and with the law's figure the best way changed in 5 (the fourth revision made
that figure the main one, L1). RULES.md 4.4's reason for P3
was also corrected: the usable cash includes the emergency fund. The verifier read the pages' code to check the key, and the
reasons it corrected (RULES.md 4.4, 4.5, 5.3) say so. No figure or formula came from the app.

**Revised a fourth time 2026-10-31: five more of the pages' stated conventions** (RULES.md sections 3.4, 4.5, 5.2 to 5.6, 7
to 11). Each is the main reading in both derivations, the key's earlier main reading is kept as an `alt_*` column where it
differs, and one new deliberate mistake undoes each:

| Rule | Main now | The key's earlier main, now the contrast column(s) |
|---|---|---|
| L1 | the line's tax saved = (line interest x s_new - the mortgage's interest over the line's term x (s_old - s_new)) x top, s_new = min(1, L / (M + C)), s_old = min(1, L / M) (0 when M = 0); today's money after that tax, discounted like the payments; the ranking and the best from it; `line_mortgage_interest_in_term` added | R1's line figure: `alt_line_tax_saved_r1`, `alt_line_todays_money_r1`, `alt_ranking_line_r1` |
| A7 | cash back = max(0, max(0, trade-in) + cash down - new price x (1 + tax)); buy paid = cash down + max(0, -trade-in) - cash back + payments + running (the key's formula already, now exercised by five edge rows) | none (no difference) |
| A9 | the cheapest by a walk keep, buy, lease: a later way replaces the current one only when it costs more than $1 less | `alt_cheapest_lowest` |
| B5 | need = amount - max(0, spare): a spare below 0 counts as 0 | `alt_save_need_spare_literal`, `alt_save_uncovered_spare_literal`, `alt_finance_need_spare_literal`, `alt_finance_uncovered_spare_literal` |
| D1 | blank inputs at the pages' defaults: a refinance rate or years 6.5% / 30 (closing 3%), a line 8% / 10, a loan 12% / 5; a new mpg 32, a new upkeep $500, new price 35,000, tax 6%, rate 7%, term 60, insurance share 1.25, lease 450 / 3,000 / 36 months / 12,000 miles / 0.25, upkeep rise 10% | A3 (a blank new mpg or upkeep keeps the old car's): `alt_buy_blank_keeps_old`, `alt_lease_blank_keeps_old`; C4's first half (no refinance unless its rate and years are typed): `alt_ranking_blank_refi_not_offered` |

Columns gone because they would equal a main column: `line_law_tax_saved_table1`, `line_law_todays_money_table1`. Sixteen
edge rows were added after each file's earlier edges (`veh-0025` to `-0032`, `pur-0033` to `-0035`, `ren-0016` to `-0020`),
and every electric first car now carries a fuel price for the new car's 32 mpg (RULES.md section 10). The random rows are
the same draws as in the third revision (see "The generator"), so the new files could be matched row by row, by inputs,
against the third revision's: only the intended columns changed (vehicles.csv: the 96 electric-first-car rows' buy and lease
figures, the cheapest in 9 of them; purchases.csv: nothing; renovations.csv: the line's tax saved and today's money in 145
rows, the ranking in 10 and the best in 5).

**Corrected 2026-10-31, after the fourth revision's comparison with the pages (E1; RULES.md sections 3.4 and 11).** The
test's run against the fourth revision found one cause: every electric first car (96 rows, all with a blank new mpg) had
its new car priced as a petrol car at 32 mpg and the fuel price the key had given it, where the page charges the new car
like the car (buy 96 rows, lease 96, the cheapest 9; `veh-0007`: buy 18,353.11 on the page, 21,299.11 in the key). The key
was wrong: D1 gives the new mpg box its default, which the page takes, but an electric car is charged by its kWh (the page's
README: "electric: miles x kWh a mile x price") and the page does not compare gas against electric (its README: "Gas
against electric" under "Ideas / not yet"). Both derivations now charge an electric first car's new car like the car when
its mpg is blank, and keep the fourth revision's figure as a contrast:

| Rule | Main now | The fourth revision's main, now the contrast column(s) |
|---|---|---|
| E1 | on an electric first car with a blank new mpg, the new car charged like the car (Buy's and Lease's running costs, paid, cost, monthly; the cheapest) | `alt_buy_electric_new_at_32_mpg`, `alt_lease_electric_new_at_32_mpg` |

purchases.csv and renovations.csv did not change (the same sha256). In vehicles.csv only the 96 electric-first-car rows
changed: their buy and lease figures (now the fourth revision's `alt_*_blank_keeps_old`, the new upkeep being typed on all of
them), the contrasts built on the new car's running costs, the note, and the cheapest in 9 (`veh-0481`, `-0701`, `-0703`,
`-0776`, `-0783`, `-0822`, `-0828`, `-1140`, `-1248`); the new contrast equals the fourth revision's main. One new deliberate
mistake undoes E1.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the `rules.py` docstring
and RULES.md section 1 give the sha256 of each copy. No source was read again for this script, and the script adds no figure
of its own: every default and limit it uses comes from `rules.py` (derivation 1) or is restated from the brief and the same
sources (derivation 2's constants, each with its source on the line).

| Tag | Source | Used for |
|---|---|---|
| STATED | the pages' stated conventions, given to the key on 2026-10-31 | V1-V3, P1-P3, R1-R5; L1, A7, A9, B5, D1 (fourth revision) (RULES.md section 7) |
| BRIEF | the task brief, "Today is 2026-10-31" | every page convention: the car's year, the 12% used-car loss, new-car values 0.8 then 0.85 a year, insurance share 1.25, upkeep rise 10%, lease upkeep halved, keep / buy / lease; whole months, save up, finance, cash, giving way; value added, line 8% / 10 years at 85% combined, refinance costs 3%, loan 12% / 5 years, today's money, tax saved, cushion, ranking |
| USC163, LII163, P936 | 26 U.S.C. 163(h)(1), (h)(3)(B), (h)(3)(F), (h)(4); Publication 936 (2025) | a home-equity line or cash-out refinance used to substantially improve the home is acquisition debt; closing costs rolled into a refinance are not; the $750,000 ($375,000 separate) limit, permanent since Pub. L. 119-21; personal (unsecured) loan interest is not deductible |
| CFPBHL, OCC34 | CFPB HELOC booklet; 12 CFR part 34 subpart D appendix A, footnote 2 | the line's borrowable amount has the shape value x a percentage - mortgage, with no number set by a regulator: 85% is a page convention |
| HUD1911, FMREFI | HUD Mortgagee Letter 2019-11; Freddie Mac "Understanding the costs of refinancing" | the 80% cash-out limit (the refinance's fit, C4, and `refi_above_fha_80`); refinance costs "3%-6% of your loan principal" (the first reading of the 3%, now the contrast) |
| RAMSEY, LTREE, SFARM | Ramsey Solutions, LendingTree, State Farm car-depreciation articles | the new-car 20% then 15% a year is a page convention consistent with popular averages (RULES.md 3.2) |
| TXMV, CFPBDI | Texas Comptroller motor-vehicle FAQ; CFPB deferred-interest page | contrasts only: a trade-in lowering the taxable price, and the interest a deferred-interest offer would charge back |

## Figures

| Figure | Value | Source |
|---|---|---|
| Car | loss blank = 12% a year; new car x 0.8 after year one, then x 0.85 a year; insurance share blank = 1.25; upkeep rise blank = 10% a year; the lease's upkeep halved | BRIEF (page conventions) |
| What-if blanks (D1) | new mpg 32 (at the car's fuel price; on an electric first car the new car is charged like the car, E1), new upkeep $500, new price 35,000, tax 6%, rate 7%, term 60, lease 450 a month, 3,000 due, 36 months, 12,000 miles a year, 0.25 a mile; cash down blank = 0 | STATED |
| The cheapest (A9) | a later way replaces the cheapest only when it costs more than $1 less | STATED |
| Cash back (A7) | max(0, max(0, trade-in) + cash down - new price x (1 + tax)) | STATED |
| Loans | interest = balance x rate / 12 a month; payment = min(payment, balance + interest); stop at a balance of 0.005 or less; level payment pmt(rate / 12, n, amount), 0% = amount / n | BRIEF |
| Line, refinance, loan | line 8% over 10 years, borrowable = value x 85% - mortgage, at least 0; refinance costs 3% (of mortgage + cost, C1 revised), a blank refinance rate or years 6.5% and 30 years (D1); personal loan 12% over 5 years | BRIEF; the page's reading for C1; STATED (D1) |
| Law | acquisition debt up to $750,000 ($375,000 married filing separately), closing costs rolled in left out (R1, main); the share on all the home's interest, so the line over the limit also cuts the mortgage's deduction over the line's term (L1, main since the fourth revision) | USC163 (h)(3)(F)(i)(II); P936, Table 1 lines 12-15; STATED (L1) |
| The best | a later way replaces the best only when its today's money is more than $1 lower (R5) | STATED |
| Cash-out refinance | the new loan at most 80% of the value (the refinance fits, C4) | HUD1911 |
| Display | money to the cent, rates and ratios to six decimals, half up | BRIEF |

## Who each row is

- **vehicles.csv.** A household with one or two cars (`cars`, one per `;`). The first car is the one in the what-if. A car
  is petrol (`mpg` and `fuel_price`) or electric (`electric` = `yes`, `kwh_per_mile`, `kwh_price`); its loan is all three
  loan fields or none. The what-if is a whole number of years, 1 to 10. Every random row types the what-if in full, except
  the new mpg of an electric first car and, half the time, the insurance share and the upkeep rise; two edge rows leave
  what-if fields blank (D1). An electric first car carries a fuel price, used only by E1's contrast (its new car at 32
  mpg); its own year and, by E1, its new car are charged by electricity.
- **purchases.csv.** One purchase on `today` = 2026-10-31, with the household's `spare`, `usable_cash`, `emergency_target`
  and `cash_return` from elsewhere in the app, and 0 to 4 goals (`goals`, one per `;`). Every row has a term, so the finance
  way always exists; the save-up way exists only with a date. `spare` is below 0 only in three edge rows (B5).
- **renovations.csv.** One project, with the household's `usable_cash`, `blended_return`, `top_rate`, `itemizes` and
  `essential_monthly`. A home (`home` = `yes` and a value) has a mortgage (all three fields) or none, and a refinance rate
  and term (blank only in three edge rows, D1). `filing_status` (`other` or `married_separate`) sets the limit of R1 ($750,000 or $375,000).

## How each row is worked (derivation 1: rules.py)

- **vehicles.csv.** `rules.vehicles_case`: `car_year` (with `loan_year` = `run_loan` month by month for 12 months),
  `keep_way` (`rise_on='upkeep'`, V1), `buy_way` and `lease_way` (`rise_on='none'`, V2; the D1 defaults for blanks; cash
  back as A7 states it), with `running_costs` summed year by year and `used_value` / `new_value` as powers; the cheapest by
  `best_by_walk` with a $1 margin (A9) and the `alt` contrasts (`rise_on='all'` and `'upkeep'`; `blanks='old'` for A3; the
  plain lowest). The new loan's months in the period come from `rules.run_loan`.
- **purchases.csv.** `rules.big_purchase_case`: `months_to_date` (W2 by its formula, plus W1 by `add_months` and W3),
  `save_up_monthly` (closed form) for both counts, `promo_payment` (closed form p = A / (k + (1 - (1 + r)^-m) / r)),
  `give_way` (a spare below 0 taken as 0, B5, `spare_literal=True` for its contrast; a done goal skipped in the loop;
  `done_gives=True` for the contrast) with `months_to_goal` (a logarithm guess
  corrected by exact comparison), the cash test (P3 and its contrast) and the deferred-interest contrast. The level payment
  from the start is `rules.level_payment`, all 0% is `rules.promo_payment(..., promo = term)`, and each goal's months and
  arrival are `rules.months_to_goal` and `rules.add_months`.
- **renovations.csv.** `rules.renovation_case`: `loan_way` (level payment, `annuity_pv` closed form), `refi_new_loan`, the
  old mortgage by `run_loan(..., keep=True)` with its payments and its monthly interest summed one by one (`pv_payments`);
  for L1 the first heloc years x 12 of those monthly interests (the mortgage during the line, or until it is paid), summed
  and discounted; the D1 defaults for a blank refinance rate or years;
  each new loan's interest PV by `pv_interest` (the loan stepped month by month and each month's interest discounted; the
  3%-of-the-new-loan contrast scales the main loan's, the schedule being linear in the amount), the law shares
  (`law_deductible_share`), the walk (`best_by_walk`, `rank_by_walk`) and the plain sort for the contrast.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, with its own parser of the CSV's input strings (numbers and dates) and without calling a
`rules.py` function; the page conventions are restated as constants from the brief and the sources.

- **Every fixed-payment loan in closed form.** After k uncut payments the balance is B g^k - p (g^k - 1) / r (B - p k at
  0%), g = 1 + r. The month whose payment is cut is the first k* + 1 with B_k* g <= p, found by doubling and bisection
  (monotone because the payment is above the first month's interest); the run stops after the limit, or at a balance of
  0.005 or less. Interest = paid - (opening - closing balance). `rules.py` steps month by month and sums the interest.
- **Level payments** as A r g^n / (g^n - 1). `rules.py` uses A r / (1 - (1 + r)^-n).
- **Running costs** as one geometric series, base x ((1 + rise)^Y - 1) / rise. `rules.py` sums the years.
- **Car values** stepped year by year (x (1 - loss), or x 0.8 then x 0.85). `rules.py` takes powers.
- **Leases started** counted by stepping lease starts 0, L, 2L, ... inside the period. `rules.py` takes ceil(P / L).
- **Whole months (W2)** as the largest k for which today's day of the month, k months on, is on or before the date, compared
  as (year, month, day) with the day not clamped to the month's length. `rules.py` uses the formula (difference in months,
  less 1 when the day is earlier). **W1 (the contrast)** from the calendar-month difference, less one when today moved that
  many months on lands after the date; `rules.py` steps `add_months` up and down.
- **Save up** from the annuity factor sum_{t<n} (1 + i)^t built by Horner's rule: m = (total - S (1 + i)^n) / factor.
  `rules.py` uses the closed form with i / ((1 + i)^n - 1).
- **The finance payment** from two runs of the schedule (payment 0 and payment 1): the final balance is linear in the
  payment, so p = B(0) / (B(0) - B(1)). One routine covers level, all 0% and promo-then-rate. `rules.py` uses its closed
  form. The deferred-interest contrast is r (k A - p k (k - 1) / 2) in closed form; `rules.py` sums the months.
- **Goals' months** by doubling and bisection on the closed-form balance S (1 + g)^n + M ((1 + g)^n - 1) / g (it never
  falls as n grows). `rules.py` starts from a logarithm and corrects by exact comparison.
- **The giving order** by repeated selection with a pairwise rule (priority 3 before 2 before 1, then the later due date,
  then the listed order), over the goals not done (taken out before the order is made, P2). `rules.py` sorts on a key and
  skips a done goal inside the loop.
- **Today's money** of a level payment by Horner's rule on the discount factor (acc = (acc + 1) v, n times); of the old
  mortgage in closed form: p (1 - v^k) / j for its level payments plus its smaller last payment discounted k + 1 months.
  `rules.py` uses the annuity closed form for the first and sums the old mortgage's payment list for the second.
- **The interest's present value (R2)** in closed form: month m's interest is (r A - p) g^(m-1) + p, so the sum is
  (r A - p) v sum_{k<n} (g v)^k + p a_n; for the old mortgage its level months so, plus the cut last month's interest
  r B_k discounted k + 1 months. Every loan's, the contrast's included, is worked directly. `rules.py` steps each loan month by
  month and discounts each month's interest.
- **The best (R5)** by jumping from the first way to the first later way more than $1 lower, and again from there; the
  ranking by repeating that on the ways left. `rules.py` walks the ways once with a running best. The contrast's plain
  ranking by repeated selection of the lowest (a tie keeps the earlier); `rules.py` sorts on (today's money, order).
- **L1** with the mortgage during the line in closed form: the same fixed-payment loan as above with the line's months as
  its limit (it stops early when the mortgage is paid), its interest = paid - principal repaid, its interest's PV by the
  level months plus the cut last month. `rules.py` slices the old mortgage's month-by-month interest list.
- **The cheapest (A9)** by a running best that moves only for more than $1 less, and the contrast's lowest in the same pass;
  `rules.py` uses `best_by_walk` and `min` on (cost, order).
- **B5** by clamping the spare at 0 before the need is formed; the contrast leaves it as typed. **D1**'s defaults are
  restated as constants in this file and put in place before anything is worked (`whatif_2`); the A3 contrast keeps the
  typed blanks to fall back on the old car's fuel and upkeep.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up (away from zero for negatives). Rates and
  ratios (per mile, cushion months, the new car's loss, loan-to-value, the law shares) are rounded the same way to six
  decimals. Payments are never rounded to the cent before they are used (R2), so a page that rounds the payment first can
  differ by a few cents over a schedule.
- Ties are real: written amounts that sit exactly on a half cent before rounding number 544 in vehicles.csv, 293 in
  purchases.csv and 74 in renovations.csv (shares with three or four decimals times money, e.g. a total of 33,038.121 less
  3,974 x 1.004 = 29,048.225 in `pur-0264`; RULES.md's 35,230.765). They are rounded up; a page that rounds
  half to even, or in floating point, can be a cent off there.
- Totals are sums of exact values, so a written total can differ from the sum of its written parts by a cent.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder twice: once with the examples check, and once without it
(`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | Examples check | Row guard |
|---|---|---|
| a loan's last payment is never cut | caught (8.1 sedan) | refused at `veh-0001` (keep loan paid 6,288.55 vs 6,300.00) |
| Keep's running costs all rise (A1), not only the upkeep (V1) | caught | refused at `veh-0001` (keep running 20,384.08 vs 23,809.89) |
| Buy's and Lease's upkeep rises (Keep's rule), not flat (V2) | caught | refused at `veh-0001` (buy running 17,875.00 vs 18,206.53) |
| the lease uses the old car's running costs | caught | refused at `veh-0001` (lease running 17,125.00 vs 17,500.00) |
| leases started = floor(period / lease months) | caught | refused at `veh-0001` (2 vs 1) |
| a new car loses 15% from year one | caught | refused at `veh-0001` (end value 13,363.36 vs 14,198.57) |
| the new car taxed on its price less the trade-in | caught | refused at `veh-0001` (financed 19,560.00 vs 18,600.00) |
| the lease credits nothing for a positive trade-in | caught | refused at `veh-0001` (lease paid 35,065.00 vs 47,065.00) |
| keep's back leaves in what the old loan still owes | caught (8.1, the one-year keep) | refused at `veh-0002` (keep back 13,787.38 vs 15,840.00) |
| whole months by W1, not W2 (P1) | caught (8.2: 7 vs 8) | refused at `pur-0001` (7 vs 8) |
| save-up deposits at the start of each month | caught | refused at `pur-0001` (304.99 vs 303.98) |
| the promo months charged interest | caught | refused at `pur-0001` (96.79 vs 116.34) |
| within a priority the earliest due date gives first | **not caught** (the sofa has no tie) | refused at `pur-0022` (Course vs Holiday gives first) |
| a goal already done gives way too (P2) | caught (8.2, `pur-0020`) | refused at `pur-0020` (save uncovered 24.99 vs 0.00) |
| a goal's months rounded down | caught | refused at `pur-0001` (11 vs 10 months) |
| earned below 0 when more than the total is set aside | caught | refused at `pur-0009` (0.00 vs -820.00) |
| pay cash fits only when what is left is at least the emergency target (P3) | caught | refused at `pur-0001` (fits yes vs no) |
| refinance costs 3% of the new loan | caught | refused at `ren-0001` (new loan 303,850.00 vs 304,123.71) |
| the refinance always fits | caught | refused at `ren-0005` (fits no vs yes) |
| what could be borrowed written below 0 | caught | refused at `ren-0005` (0.00 vs -17,000.00) |
| the line borrows up to 80% | caught | refused at `ren-0001` (58,000.00 vs 39,000.00) |
| tax saved without itemizing | caught | refused at `ren-0002` (deductible no vs yes) |
| payments discounted from month 0 | caught | refused at `ren-0001` (34,316.79 vs 34,459.77) |
| tax saved with no limit and the closing costs counted (R1) | caught | refused at `ren-0001` (refinance tax saved 58,327.33 vs 60,911.35) |
| today's money before the tax saved (R2) | caught | refused at `ren-0001` (line today's money 1,554.04 vs 4,316.79) |
| a refinance on a home without a mortgage (R3) | caught (8.3, no mortgage) | refused at `ren-0004` (new loan blank vs 30,900.00) |
| the best is the lowest, no $1 margin (R5) | caught (8.3, `ren-0014`) | refused at `ren-0014` (ranking cash;line;loan;refi vs line;cash;loan;refi) |
| the line's tax saved keeps the mortgage's whole deduction (R1, not L1; a law column in the third revision, the main since the fourth) | caught (8.3, `ren-0008`; not caught before the fourth revision, the kitchen being under the limit) | refused at `ren-0008` (line tax saved 2,466.77 vs 9,655.01) |
| L1: the mortgage's interest over its whole remaining life, not the line's term (fourth revision) | caught (8.3, `ren-0008`) | refused at `ren-0008` (line tax saved 2,466.77 vs -1,562.10) |
| A7: the equity and cash down above the new car with its tax do not come back as cash (fourth revision) | caught (8.1, cash back) | refused at `veh-0027` (cash back 17,560.00 vs 0.00) |
| A9: the cheapest is the lowest cost, no $1 margin (fourth revision) | caught (8.1, the wagon) | refused at `veh-0032` (cheapest keep vs buy) |
| B5: need = amount - spare even when spare is below 0 (fourth revision) | caught (8.2, spare -150) | refused at `pur-0033` (save need 304.99 vs 454.99) |
| D1: a blank new mpg keeps the old car's fuel cost, not 32 mpg (fourth revision; on a petrol car since E1) | caught (8.1, blank new mpg) | refused at `veh-0025` (buy running 19,437.50 vs 19,875.00; it was `veh-0007` before E1) |
| E1: on an electric first car a blank new mpg is 32 at its fuel price, not charged like the car (E1's correction) | caught (8.1, the electric hatchback) | refused at `veh-0007` (buy running 15,354.00 vs 18,300.00) |

In all sixty-eight runs (thirty-four mistakes, each with and without the examples check) no CSV was written; every run
exited with an error before writing. All were run again on 2026-10-31 after the fourth revision, and once more after E1's
correction, against the final code (the five of the fourth revision and E1's are its last six rows; the mistakes that undid
a first-revision rule were kept, and the two that undid the key's own readings of what rises and of whole months became
`keep_rise_all`, `buy_lease_rise` and `months_w1`). Each earlier mistake is still refused at the same row as before, but for
D1's `blank_mpg_keeps_old_fuel`: keeping an electric car's charging is now the main reading (E1), so it is refused at the
first petrol row with a blank new mpg (`veh-0025`) instead of `veh-0007`.

## The generator

Edge rows come first, then random rows. Nothing is redrawn: every draw goes through both derivations and the guard.
Money is drawn in whole cents or dollars, rates in basis points, shares in hundredths, dates as whole months and days.
Since the fourth revision each file draws exactly as many random cases as in the third (1,476, 1,468 and 1,485,
`RANDOM_DRAWS`) and keeps the first that fit after its edge rows, so the random rows are the third revision's (the last 8,
3 and 5 draws give way to the new edges, and the ids of the others move by that many); the fuel price of an electric first
car comes from a second stream, so it moves no other draw.

### vehicles.csv: 32 edge rows (`veh-0001` to `-0032`), then 1,468 random rows

Edges: RULES.md 8.1; the sedan over 1, 2, 3, 4 and 10 years (period shorter than, equal to and longer than the lease, miles
equal to and under the allowance); an electric first car with a blank new mpg (the new car charged like the car, E1; its contrast at 32 mpg and the fuel price it carries); no loan; a car worth less than its loan;
0% new rate; an 84-month new loan over 3 years; upkeep rise 0; typed loss, share and rise; a gas guzzler where buying wins
and one where leasing wins; an old loan at 0%; a tiny loan paid off in month 1; two cars with loans; an electric second car
with a loan; a loan of 24 level payments over 2 years; a large cash down; a 39-month lease; 9 years at a 15% rise;
decimals in price, mpg and fuel price. Fourth revision (`veh-0025` to `-0032`): the sedan with a blank new mpg and upkeep;
every what-if field blank but the years (D1); a car worth more than the new car with its tax, with 3,000 down and with
none; one with a loan whose equity still covers it; one worth more than the price but not its tax, tipped into cash back by
the cash down; equity and cash down covering the new car exactly (A7); buy 0.40 below keep (A9).

Random rows: 1 or 2 cars (60 / 40), years 1 to 10; 12% of first cars are gas guzzlers (10 to 17 mpg, high miles and upkeep,
cheap leases) so that buy and lease win sometimes; 7% of other first cars are electric (with a blank new mpg), 20% of second
cars; an electric first car carries a fuel price from 2.50 to 5.60 (the second stream), used only by E1's contrast. Old loans: none 35%, any term 35%, paid off inside the period 15%, worth less than the loan 15%; the payment is the
level payment over the remaining term rounded up to the cent (a quarter to the dollar), so it is always above the first
month's interest. The new loan's amount is kept above $500 (A7 is exercised by the edge rows only).

### purchases.csv: 35 edge rows (`pur-0001` to `-0035`), then 1,465 random rows

Edges: RULES.md 8.2 and variants of it: no date; today; earlier this month; November 30 and 15; December 30; February 28;
set aside above and equal to the total; cash return 0; spare 0 and spare 2,000; promo = term; APR 0; no promo; promo 1 and
23 of 24; more than you have; a done goal that is skipped (P2); goals saving nothing (one by growth, one never); the same priority
with different and with equal due dates; four goals; no goals; cents and a four-decimal tax; the six priority orders of
three goals (`pur-0027` to `-0032`); and a spare below 0 (B5, `pur-0033` to `-0035`: the sofa at -150, the same with more
than the total set aside, -200 with no goals).

Random rows: dates none 7%, this month 5%, next month 5%, a month's last day 2 to 60 months on 13%, any day 70%; set aside 0,
part, above or equal to the total; promo none 40%, the whole term 15%, part 45%; APR 0 in 10%; 0 to 4 goals, each with
priority 1 to 3, a due date 1 to 120 months on, done in 8%, saving nothing in 10%, growth 0 in 30%; spare 0 in 15%, 5,000
in 12%; cash return 0 in 20%.

### renovations.csv: 20 edge rows (`ren-0001` to `-0020`), then 1,480 random rows

Edges: RULES.md 8.3 and its variant; no home; no mortgage; not enough equity; plan return 0; a refinance below the old rate;
a debt over $750,000; married filing separately; a mortgage at 0%; extra interest negative; every default typed; only the
loan fits (the refinance above 80% of the value); recoup 1.5, no itemizing and a plan return of 8.01% against the line's 8%
(the line 0.87 below cash, so cash stays best by the $1 margin, R5; until 2026-10-31 this row was an exact tie at the line's
rate, which the after-tax rule breaks); a cheap line beating cash. Fourth revision (`ren-0016` to `-0020`): the
refinance rate blank, rate and years blank, years blank (D1); a mortgage under the limit that the line takes over it, and a
mortgage paid off inside the line's term, filing separately (L1).

Random rows: no home 8%; no mortgage 18% of homes; mortgage 10% to 97% of value at 2.25% to 7.99% (0% in 2%) with the level
payment over 36 to 360 months rounded up to the cent; line, refinance-cost, loan rate and years each blank half the time;
married filing separately 15%; plan return 0 in 12%; itemizing half the time.

## Coverage (from the run)

**vehicles.csv**

| | Rows |
|---|---|
| total | 1,500 (32 edge, 1,468 random) |
| 1 car / 2 cars | 890 / 610 |
| period 1 ... 10 years | 139 / 139 / 153 / 157 / 153 / 146 / 161 / 150 / 143 / 159 |
| first car: no loan / paid off inside the period / still owed at the end (A6) | 480 / 772 / 248 |
| first car worth less than its loan | 250 |
| electric cars (any position) / electric first car (a blank new mpg: the new car charged like the car, E1) | 225 / 96 |
| old loan at 0% / a car loan paid off inside its 12-month year | 87 / 142 |
| new rate 0% / new loan still owed at the end / paid off inside the period (or nothing financed) | 210 / 517 / 983 |
| period shorter than / equal to / longer than the lease | 321 / 100 / 1,079 |
| miles over / equal to / under the allowance | 999 / 49 / 452 |
| upkeep rise 0 / blank (10%) / typed above 0 | 214 / 632 / 654 |
| loss blank / insurance share blank | 871 / 761 |
| cheapest keep / buy / lease | 921 / 373 / 206 |
| the cheapest is another way under the all-rising contrast (A1) | 36 |
| a positive trade-in credited on the lease (A5) / Keep's back less what is still owed (A6) | 1,250 / 248 |
| buy with cash back (A7) / nothing financed and no cash back | 4 / 1 |
| the cheapest kept by the $1 margin (A9; the lowest is another way) | 1 (`veh-0032`) |
| a blank new mpg on a petrol first car / a blank new upkeep / every what-if field blank but the years (D1) | 2 / 2 / 1 |
| A3's contrast differs (a blank new mpg or upkeep keeping the old car's) | 2 (`veh-0025`, `-0026`) |
| E1's contrast differs (an electric first car's new car at 32 mpg) / changes the cheapest | 96 / 9 |

**purchases.csv**

| | Rows |
|---|---|
| total | 1,500 (35 edge, 1,465 random) |
| no date / this month / next month / later | 112 / 80 / 68 / 1,240 |
| W2 differs from W1 (the contrast) / from W3 | 124 / 1,096 |
| set aside above / equal to the total | 159 / 79 |
| cash return 0 / spare 0 | 310 / 226 |
| spare below 0 (B5) / ways where the literal spare would change the need | 3 / 6 |
| save: spare enough / goals give way / more than you have | 761 / 553 / 390 |
| finance: spare enough / goals give way / more than you have | 812 / 604 / 408 |
| finance level / all 0% / promo then rate | 531 / 357 / 612 |
| cash fits / does not (P3) / fits but leaves less than the emergency target (the contrast says no) | 1,175 / 325 / 395 |
| rows with 0 / 1 / 2 / 3 / 4 goals | 128 / 319 / 361 / 439 / 253 |
| three goals, priority order 1-2-3 / 1-3-2 / 2-1-3 / 2-3-1 / 3-1-2 / 3-2-1 | 13 / 20 / 9 / 22 / 23 / 38 |
| ways where two or more goals give way / where a same-priority goal due later gives first | 591 / 342 |
| goals already done / saving nothing / never reached | 233 / 306 / 122 |
| paused goals, counted per way | 1,521 |
| done goals skipped (P2), counted per way / ways where that changes who gives | 168 / 157 |

**renovations.csv**

| | Rows |
|---|---|
| total | 1,500 (20 edge, 1,480 random) |
| no home / home without a mortgage (no refinance, R3) / with a mortgage | 127 / 239 / 1,134 |
| R3 contrast: the refinance with no mortgage would fit / would be the best | 233 / 87 |
| refinance rate below / equal to / above the old rate | 453 / 1 / 680 |
| mortgage rate 0 | 21 |
| line fits / not enough equity | 991 / 382 |
| not enough cash (cushion negative) | 373 |
| itemizes yes / no | 725 / 775 |
| plan return 0 | 187 |
| refinance above (does not fit, C4) / at or below the 80% cash-out limit | 476 / 658 |
| what could be borrowed 0 (value x 85% below the mortgage) | 170 |
| law share below 1 (line) / and itemizing, so the limit cuts the line's tax saved / refinance law share below 1 / 1.03 | 304 / 149 / 581 |
| L1: the line's tax saved below R1's / below 0 / the mortgage alone under the limit / the mortgage paid off inside the line's term | 147 / 39 / 30 / 43 |
| with R1's line figure (L1's contrast) the ranking / the best would change | 10 / 5 |
| married filing separately (the $375,000 limit, R1) | 228 |
| extra interest negative / refinance tax saved below 0 (R1) | 279 / 139 |
| line rate blank / refinance cost blank / loan rate blank | 684 / 686 / 759 |
| refinance rate blank / years blank (D1) / the ranking without that refinance differs (D1's contrast) | 2 / 2 / 3 |
| best cash / line / refinance / loan | 844 / 221 / 227 / 208 |
| ranking / best differs before tax (R2's contrast) | 179 / 91 |
| best kept by the $1 margin (R5; the lowest is another way) | 1 (`ren-0014`) |

## CSV columns

Money has two decimals. Rates and ratios have six. Dates are ISO (`2026-04-15`). Flags are `yes` / `no`. Months and counts
are whole numbers. A blank means "not typed" in an input column and "does not apply" (or "never", for a goal's months) in
an output column. Every file starts with `case_id, row_kind` (`edge` or `random`) and ends with `note` (on an edge row,
what it pins down; on every row, the notable things).

**vehicles.csv**

Inputs:
- `cars`: one car per `;`, fields joined by `|` in this order (blank allowed): `name | value | miles | mpg | fuel_price |
  electric | kwh_per_mile | kwh_price | insurance | maintenance | registration | loss | loan_balance | loan_rate |
  loan_payment`. Rates and shares are decimals (0.06 = 6%). No loan: the three loan fields blank.
- The what-if (for the first car): `years, new_price, new_sales_tax, new_mpg, new_rate, new_term, cash_down,
  new_insurance_share, new_maintenance, lease_monthly, lease_due, lease_months, lease_miles, lease_excess, upkeep_rise`.

Outputs:
- `car_results`: per car in input order, one per `;`, fields joined by `|`: `value_lost | fuel | insurance | maintenance |
  registration | loan_interest | total | per_mile | monthly | loan_paid_year | loan_balance_after_year |
  loan_months_year` (the last three blank without a loan).
- `period_months`; `trade_in` (value - loan balance), `loan_left` (the first car's loan balance today, 0 without a loan),
  `negative_trade_in_cash` (paid in cash on buy and lease), `financed`, `cash_back` (A7: max(0, max(0, trade-in) + cash
  down - new price x (1 + tax)), above 0 in four edge rows), `new_payment`.
- Keep: `keep_loan_paid, keep_loan_months, keep_running, keep_paid, keep_end_value, keep_owed_end, keep_back, keep_cost,
  keep_cost_monthly` (`keep_running`: only the upkeep rises, V1; `keep_back` = `keep_end_value` - `keep_owed_end`, A6).
- Buy: `buy_loan_paid, buy_loan_months, buy_running, buy_paid, buy_end_value, buy_owed_end, buy_back, buy_cost,
  buy_cost_monthly` (`buy_running` flat, V2; `buy_back` = end value - owed at the end).
- Lease: `lease_count` (leases started), `lease_due_total`, `lease_payments`, `lease_excess_miles` (miles over the allowance
  x years), `lease_excess_charge`, `lease_running` (flat, the new upkeep halved, V2), `lease_paid`, `lease_end_value`,
  `lease_owed_end`, `lease_back` (all three 0), `lease_cost`, `lease_cost_monthly`.
- `cheapest`: `keep`, `buy` or `lease`, by the walk keep, buy, lease with a $1 margin (A9).
- Contrasts (each a way's cost with one reading changed): `lease_trade_in_credited` (the positive trade-in taken off the
  lease, A5), `alt_keep_rise_all`, `alt_buy_rise_all`, `alt_lease_rise_all` (every running cost rising, A1, the key's first
  reading of V1 and V2), `alt_buy_rise_upkeep_only`, `alt_lease_rise_upkeep_only` (Keep's rule, the upkeep rising, on the
  new car), `alt_lease_old_running` (A2: the old car's running costs, flat, upkeep halved), `alt_lease_equity_not_credited`
  (A5, the brief's), `alt_buy_tax_after_trade_in_credit` (TXMV), `alt_keep_owed_end_ignored` (A6, the brief's),
  `new_car_loss_at_end` (1 - 0.8 x 0.85^(years - 1), against the sources' "about 60% by year five"); fourth revision:
  `alt_cheapest_lowest` (A9's earlier reading: the lowest cost, ties keep / buy / lease), `alt_buy_blank_keeps_old`,
  `alt_lease_blank_keeps_old` (the buy and lease costs by A3, D1's contrast: a blank new mpg keeps the old car's fuel or
  electricity cost, a blank new maintenance its upkeep); E1's correction: `alt_buy_electric_new_at_32_mpg`,
  `alt_lease_electric_new_at_32_mpg` (the buy and lease costs with an electric first car's blank new mpg at 32 mpg and the
  fuel price it carries, the fourth revision's reading; equal to the main costs on every other row).

**purchases.csv**

Inputs: `spare, usable_cash, emergency_target, cash_return, name, price, sales_tax, when, set_aside, apr, term, promo,
goals`. `goals`: one goal per `;`, fields joined by `|`: `name | priority | due | target | set_aside | monthly | growth`.

Outputs:
- `total`; `months` (W2, P1), `months_w3` (blank without a date).
- Save up (blank without a date): `save_monthly`, `save_earned`, `save_need` (monthly - max(0, spare), at least 0, B5),
  `save_giving`,
  `save_uncovered`, `save_more_than_you_have`.
- Finance: `finance_kind` (`level`, `all_zero` or `promo_then_rate`), `finance_principal` (total - set aside, at least 0),
  `finance_payment`, `finance_interest`, `finance_need`, `finance_giving`, `finance_uncovered`,
  `finance_more_than_you_have`.
- `*_giving`: the goals that give something, in the order they give, one per `;`, fields joined by `|`: `name | gives |
  new_monthly | old_months | new_months | paused` (new months blank when paused; old months blank when never reached). A
  goal already done never gives (P2).
- Pay cash: `cash_after` (usable cash - principal), `cash_fits` (usable cash >= principal, P3).
- `goals_months`: every goal in input order, `name | months | arrival` at its own saving (blank = never).
- Contrasts: `alt_level_payment`, `alt_level_interest` (the APR from the first month), `alt_all_zero_payment`,
  `balance_after_promo`, `deferred_interest_if_not_paid` (only for promo then rate; B9); `alt_months_w1`,
  `alt_save_monthly_w1`, `alt_save_earned_w1` (whole months by W1, the key's first reading; blank without a date);
  `alt_save_giving_done_goals_give`, `alt_save_uncovered_done_goals_give`, `alt_finance_giving_done_goals_give`,
  `alt_finance_uncovered_done_goals_give` (a goal already done gives too, the key's first reading; same format as
  `*_giving`); `alt_cash_fits_keeps_emergency_target` (cash fits only when what is left is at least the emergency target,
  the brief's test); fourth revision: `alt_save_need_spare_literal`, `alt_save_uncovered_spare_literal`,
  `alt_finance_need_spare_literal`, `alt_finance_uncovered_spare_literal` (B5's earlier reading: need = amount - spare even
  when spare is below 0; equal to the main columns when spare is at least 0).

**renovations.csv**

Inputs: `usable_cash, blended_return, top_rate, itemizes, essential_monthly, cost, recoup, home, home_value,
mortgage_balance, mortgage_rate, mortgage_payment, heloc_rate, heloc_years, refi_rate, refi_years, refi_cost_share,
loan_rate, loan_years, filing_status` (the last for the law contrast only).

Outputs:
- `value_added`, `equity_change`, `borrowable` (blank without a home).
- Cash: `cash_fits`, `cash_todays_money` (0), `cushion`, `cushion_months`.
- Line and loan, each: `*_monthly, *_months, *_interest, *_fees` (0), `*_deductible`, `*_tax_saved` (the line by L1:
  (interest x s_new - `line_mortgage_interest_in_term` x (s_old - s_new)) x top rate, s_new = min(1, L / (M + C)), s_old =
  min(1, L / M)), `*_pv_payments`, `*_todays_money` (after the tax saved, R2; the line's with L1's mortgage term),
  `*_fits`.
- Refinance (all blank without a home, or without a mortgage, R3; a blank rate or years 6.5% and 30 years, D1):
  `refi_new_loan, refi_fees` (closing costs),
  `refi_monthly, refi_months, refi_old_payment, refi_old_months_left, refi_payment_change, refi_new_interest,
  refi_old_interest, refi_interest` (the extra interest, new - old), `refi_deductible, refi_tax_saved` ((new interest x
  min(M + C, L) / N - old interest x min(1, L / M)) x top rate, R1; can be below 0), `refi_pv_new, refi_pv_old,
  refi_todays_money` (after the tax saved, R2), `refi_fits` (N at most 80% of the value).
- `ranking` (the ways that fit, `;`-joined: the R5 walk repeated), `best` (its first).
- `line_mortgage_interest_in_term` (L1: the old mortgage's interest over the line's heloc years x 12 months, stepped on
  its own payment, or until it is paid; blank without a mortgage with a payment).
- Law / contrast: `line_cltv_after`, `line_law_share` (s_new), `refi_ltv_after`, `refi_above_fha_80`, `refi_law_share`,
  `refi_tax_saved_whole_new_interest`; the 3%-of-the-new-loan reading `alt_refi_new_loan, alt_refi_fees, alt_refi_monthly,
  alt_refi_todays_money` (after tax), `alt_refi_ltv_after`; `alt_line_tax_saved_no_limit`, `alt_refi_tax_saved_extra_interest`
  (R1's contrasts); `alt_line_todays_money_before_tax`, `alt_refi_todays_money_before_tax` (R2's); on a home without a
  mortgage only, `alt_refi_no_mortgage_monthly`, `alt_refi_no_mortgage_todays_money`, `alt_refi_no_mortgage_fits`,
  `alt_ranking_refi_no_mortgage` (R3's: a refinance with an old side of 0); `alt_ranking_lowest_first` (R5's: lowest first,
  exact ties in the order cash, line, refi, loan), `alt_ranking_before_tax` (the walk on before-tax figures); fourth
  revision: `alt_line_tax_saved_r1`, `alt_line_todays_money_r1` (R1's line figure, L1's contrast: the line's interest x
  s_new x top only; equal to the main columns when M + C <= L, with no mortgage or without itemizing), `alt_ranking_line_r1`
  (the walk with it), `alt_ranking_blank_refi_not_offered` (D1's contrast, C4's first half: the walk without the refinance
  where its rate or years is blank). Gone: `line_law_tax_saved_table1`, `line_law_todays_money_table1` (now the main
  `line_tax_saved`, `line_todays_money`).

## Open points (judgement calls a reviewer should know)

1. **Whole months (W2, P1)** are (years x 12 + months) between today and the date, less 1 when the date's day of the month
   is before today's; at least 1. From October 31 to 2027-06-30 that is 7 (W1, the key's first reading, says 8). W1 and W3
   are written beside it (124 and 1,096 rows differ). Goal arrival dates use `add_months` (B6, unchanged).
2. **Running costs:** Keep's upkeep rises by the upkeep rise, fuel, insurance and registration stay at today's figures (V1);
   Buy's and Lease's are flat (V2); year 1 at today's level. Every cost rising (A1, the key's first reading) and Keep's rule
   on the new car are contrasts. A doubt for the owner: the old car's upkeep rises while the new car's does not, which
   leans the comparison toward buying or leasing (the cheapest is another way in 36 rows under A1).
3. **The lease's running costs** are the new car's (new mpg, insurance x the share, registration, the new upkeep halved)
   (A2, stated by the page in V2); the old car's is a contrast. Registration is the same for the new car (A4).
4. **A blank new mpg** is 32 mpg at the car's fuel price, a blank new upkeep $500 (D1, the page's stated convention since
   the fourth revision; A3, the old car's fuel and upkeep, is the contrast). A blank new mpg occurs on every electric first
   car (96 rows) and on two petrol edge rows. On an electric first car the new car is charged like the car (E1, the key's
   correction after the fourth revision's comparison: the page charges an electric car by its kWh and does not compare gas
   against electric); the fourth revision's 32-mpg petrol car at the fuel price each electric first car carries is the
   contrast (`alt_*_electric_new_at_32_mpg`; it changes the cheapest in 9 of the 96). A typed new mpg on an electric first
   car (no row has one) keeps the petrol rule in the key; the comparison found that the page charges the car's kWh whatever
   the box says, so the box does nothing there: a finding for the owner.
5. **The lease credits a positive trade-in** (A5, revised): the old car goes when the lease starts, so its equity comes
   back at signing (12,000 in `veh-0001`), as Buy takes it off what is financed; the brief credited nothing
   (`alt_lease_equity_not_credited`). `lease_trade_in_credited` is the amount; the lease's paid is net of it.
6. **Keep takes off what the old loan still owes at the end** (A6, revised; 248 rows): back = the value then - the debt
   then, like for like with Buy, which pays the whole loan off. A short keep can still cost less than nothing
   (`veh-0002`: -5,687.38; the brief's -7,740.00 is `alt_keep_owed_end_ignored`): the car's value today is not counted as
   paid on any way.
7. **Lease end value and owed at the end** are written 0 (the car goes back; the brief says back = 0). `loan_left` is the
   first car's loan balance today.
8. **The full new price is taxed** (the brief); the trade-in tax credit some states give is a contrast.
9. **Loan interest** is the sum of each month's interest (A8); a payment never falls at or below the first month's interest
   in these rows; a schedule stops at a balance of 0.005 or less.
10. **The cheapest** (A9, the page's stated convention since the fourth revision) is a walk keep, buy, lease that moves to
    a later way only when it costs more than $1 less; it decides only `veh-0032` (buy 0.40 below keep). The best (R5) is a walk in the order cash, line, refinance, loan
    that moves to a later way only when it is more than $1 lower, compared exactly before rounding; the ranking repeats the
    walk on the ways left. It decides only `ren-0014` (the line 0.87 below cash: cash stays best; sorted plainly the line
    would be first).
11. **No date** means no save-up way (B1). **Already saved enough** gives save 0, principal 0 and earned 0: the set-aside
    money counts up to the total (B8, revised; 145 rows where more was set aside, which the first reading wrote as a
    negative "earned").
12. **Giving way** (B3-B5, P2): need = monthly amount - max(0, spare) (B5, stated since the fourth revision: a spare below 0
    counts as 0; three edge rows, the literal reading as the contrast); priority 3, then 2, then 1, the later due date first, equal
    dates in listed order (`pur-0023`). **A goal already done is skipped** (P2, the page's convention; 168 times across the
    two ways a done goal would have given, and in 157 ways the givers change); the contrast lets it give. A goal that gives
    all its monthly saving is paused with no new months (B4). Only goals that give something are listed in `*_giving`.
13. **Goals' months** are rounded up exactly (a target reached exactly is not pushed a month later); blank = never (no
    saving and no growth to help, or beyond 1,200 months, B7).
14. **The promo** is a true 0% period with one level payment over the whole term, solved exactly. APR 0 with any promo is
    `all_zero` (72 rows with a partial promo). The deferred-interest charge-back is a contrast (CFPBDI), simple monthly
    interest on the opening balance (B9).
15. **The 3% refinance cost** is 3% of mortgage + cost, N = 1.03 (mortgage + cost) (C1, revised: the page's reading; the
    brief does not say, and FMREFI's "3%-6% of your loan principal" is a range); 3% of the new loan, N = (mortgage + cost) /
    0.97, is the `alt_refi_*` contrast. The kitchen's loan-to-value is 0.799605 one way and 0.800326 the other, either side
    of the 80% cash-out limit.
16. **The tax saved (R1, L1)** counts the interest on acquisition debt up to $750,000 ($375,000 married filing separately),
    and for the refinance not the interest on the closing costs rolled in: line (L1) = (interest x s_new - the mortgage's
    interest over the line's term x (s_old - s_new)) x top; refinance
    = (new interest x min(M + C, L) / N - old interest x min(1, L / M)) x top, below 0 in 139 rows. The extra interest x top
    (C2, the key's first reading), the whole interest with no limit and the whole new interest are contrasts. **Today's money
    is after the tax saved (R2)**, the tax discounted month by month with the interest it comes from; the before-tax figure is
    a contrast.
17. **Deductible** is `yes` for the line and the refinance only when the household itemizes; the personal loan is `no`
    (163(h)(1)); cash has none. **Fees** are 0 for the line and the loan; the refinance's are its closing costs.
18. **The refinance fits when its new loan is at most 80% of the value** (C4, revised: HUD1911's cash-out limit, and R4;
    476 rows are above it); the personal loan always fits; the line fits when borrowable (at least 0) >= cost; cash when
    usable cash >= cost. Without a home there is no line or refinance; **without a mortgage there is no refinance** (R3; 239
    rows; the contrast, an old side of 0, would fit in 233 and be the best in 87).
19. **The line** is a level-payment loan over its years (C5); a real line usually has an interest-only draw period and a
    variable rate.
20. **The limit shares** (R1) take the existing mortgage as post-2017 acquisition debt and the limit by principal at the
    start (C8); the refinance's share is min(mortgage + cost, limit) / new loan, because the closing costs rolled in were not
    used to buy, build or improve. Only `filing_status` = `married_separate` changes the limit.
21. **The line over the limit (L1, the main reading since the fourth revision).** R1 cut only the line's own interest to the
    limit's share. P936 Table 1 cuts all the home's interest, so the line also takes away part of the mortgage's deduction
    while both run. L1 uses the mortgage's interest over the line's months, stopping when it is paid (the first months of
    the old mortgage's month-by-month run in `rules.py`, closed form in `pg_key.py`). The third revision's law columns are now
    the main ones; R1's figure is the contrast (147 of 149 capped rows differ; the best in 5). A mortgage balance with no
    payment (no row has one) adds no interest.
22. **Rounding** happens only when a value is written; payments are not rounded first (R1, R2).
23. **A blank refinance rate or years** takes 6.5% and 30 years (D1, since the fourth revision); before, the key offered no
    refinance (C4's first half, the contrast ranking). Only three edge rows have them blank.
24. **Pay cash fits when the usable cash covers the amount** (P3). The note given with P3 called this "already the key's
    main"; the key's fit was in fact the brief's "what is left is at least the emergency target", now
    `alt_cash_fits_keeps_emergency_target` (they differ in 395 rows).

## What the key leaves out (on purpose)

- The car-loan interest deduction of 163(h)(4) (2025-2028), state taxes and fees, gap insurance, lease acquisition and
  disposition fees, a lease's money factor and residual (the page takes the monthly payment as given).
- A car with 0 miles (A10): the rules handle it, the rows do not exercise it. (A negative financed amount, A7, is
  exercised by five edge rows since the fourth revision.)
- Mortgage insurance, points, the standard-deduction offset of itemizing, variable rates, a line's draw period, the timing
  of the tax saving beyond discounting it with each month's interest (R2), and Publication 936's average-balance method.
