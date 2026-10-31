# Contribution limits answer key: 401(k), IRAs, Roth IRA income limit, HSA, health FSA

One independent answer key for the two contribution-limit pages:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `limits_key.py` | `tests/golden/limits/households.csv` | 3,000 | for one household in one tax year (2025 or 2026; 2027 for the HSA only): the 401(k) limit, catch-up, room and excess per adult, and what an excess puts in income; the IRA limit shared by traditional and Roth; MAGI, the Roth IRA income limit with its $10 rounding and $200 floor, and how much may go to a Roth IRA; the HSA limit per adult and for the household (one family limit shared by spouses, the catch-up at 55 into the person's own HSA, employer money counted); the federal income tax and payroll tax that HSA money taken through payroll saves; the health FSA limit, carryover, unspent money and the FSA + HSA warning; the IRA / HSA deadline; the 529 five-year amount. Beside them: three contrasts (the real traditional-IRA deduction under 219(g), the 415(c) annual additions, and the page's flat 7.65% payroll saving) and Pub. 590-A's three-place worksheet as a side column |

`tests/golden/limits/todo.json` starts empty (`{}`): it is for rows a test knows the pages do not match yet.

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the
model as small functions and `work_household(case)`. `tests/golden/limits/RULES.md` gives each rule in plain words
with the source text, and works one example per rule by hand. Those examples are rows `limits-2026-sgl-0001` to
`limits-2026-sgl-0015` of the CSV.

**Independence.** This key was written from the Internal Revenue Code (26 U.S.C. 63, 106, 125, 219, 223, 402,
402A, 408A, 414, 415, 529, 1401, 2503, 3101, 3102, 3121, 6072, 7503, 7703), the regulations (26 CFR 1.402(g)-1,
1.414(v)-1, 1.415(c)-1, 31.3101-2, 301.7503-1), IRS Notices 2013-71, 2020-33, 2023-62, 2024-80 and 2025-67, Rev.
Procs. 2024-25, 2024-40, 2025-19, 2025-32, 2026-24 and 2026-25, IRS Publications 590-A, 969 and 15-B, the Form
8959 and Form 709 instructions, SSA's Federal Register notices and D.C. Code 28-2701, through `rules.py` and
RULES.md. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. The only things taken from `tools/golden_health/` and `tools/golden_estate/` are their layout and
conventions; no figure or code is shared. (`rules.py`'s author also read the top of
`tests/golden/health/RULES.md` for its format, and took no figure from it.) The script works every row in two
separate ways, both in exact arithmetic. It refuses to write the CSV if an amount differs by more than a cent, or
any other value (age, status, flag, date) differs at all, between the two. In fact the two agree exactly, before
rounding, on every value of every row and every redrawn draw: 249,664 amounts and 42,112 other values.

## Run

```
python3 tools/golden_limits/limits_key.py
```

Python 3 standard library only (made with 3.13; about 6 seconds). The run is deterministic
(`random.Random(20261031)`; the generator draws only integers and never iterates a set), so a second run writes a
byte-identical file, also under another `PYTHONHASHSEED`. The script sets `sys.dont_write_bytecode` *before* it
imports `rules.py`, so no `__pycache__` lands in the repo. Importing `rules.py` runs its self-checks. The run then
checks derivation 2 against RULES.md's worked examples (91 assertions), works every row, checks the coverage the
brief asks for (the run stops if any item is missing), and writes the CSV only once all of that has passed. It
prints every check count and the coverage.

Options: a folder argument writes the CSV there instead (`limits_key.py /tmp/x`); `--mutate NAME` puts one
deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script); `--skip-examples` turns off the
RULES.md examples check, so the row guard has to find a mistake alone. That is how the table under "Deliberate
mistakes" was made.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the
`rules.py` docstring gives the sha256 of each copy. No source was read again for this script, and the script adds
no figure of its own: every amount it uses comes from `rules.py`'s tables.

| Tag | Source | Used for |
|---|---|---|
| USC402, USC402A, USC414, CFR402G, CFR414V | 26 U.S.C. 402(g), 402A(c), 414(v); 26 CFR 1.402(g)-1, 1.414(v)-1 | the 401(k) limit, one limit for pre-tax and Roth, the catch-up at 50 and 60-63 by the age reached by year end, the excess deferral in income |
| USC415, CFR415C | 26 U.S.C. 415(c); 26 CFR 1.415(c)-1(b) | the annual-additions contrast; catch-ups are not annual additions |
| N2480, N2567 | IRS Notices 2024-80 and 2025-67 | every 2025 and 2026 retirement figure: 402(g), 414(v), 415(c), IRA limit and catch-up, Roth and traditional phase-outs |
| N2362 | IRS Notice 2023-62 | pre-tax catch-ups stay out of income; the Roth catch-up rule bites from 2026 |
| USC219, USC408A, P590A | 26 U.S.C. 219(b), (c), (f)(3), (g); 408A(c)(2), (3), (6); Pub. 590-A (2025) | the shared IRA limit, MAGI, the reduction, the $10 rounding and $200 floor, living apart, spousal compensation, the deadline rule; Worksheets 1-2 and 2-2 |
| USC223, USC106, RP2425, RP2519, RP2624, P969, P15B | 26 U.S.C. 223(b), (c)(1), (d)(4); 106(d); Rev. Procs. 2024-25, 2025-19, 2026-24; Pubs. 969 and 15-B | HSA limits 2025-2027, the catch-up at 55, the shared family limit, employer and payroll money counted, the excess in income and payroll-tax wages, the FSA conflict |
| RP2440, RP2532, USC63, PL11921 | Rev. Procs. 2024-40 and 2025-32; 26 U.S.C. 63(c); Pub. L. 119-21 s.70102 | brackets and standard deductions for 2025 and 2026 (2025 as changed by Pub. L. 119-21), the FSA limit and carryover, the gift exclusion |
| USC3101, USC3121, USC1401, CFR3101, I8959, SSA25, SSA26 | 26 U.S.C. 3101, 3121(a); 1401(b)(2); 26 CFR 31.3101-2; Form 8959 instructions; SSA's 2025 and 2026 notices | 6.2% up to the wage base, 1.45%, the 0.9% additional Medicare tax and its thresholds, combined joint wages |
| USC125, N1371, N2033 | 26 U.S.C. 125(i); Notices 2013-71 and 2020-33 | the health FSA limit and the carryover (20% of the limit) |
| USC6072, USC7503, CFR7503, DC2701 | 26 U.S.C. 6072(a), 7503; 26 CFR 301.7503-1; D.C. Code 28-2701 | April 15, moved past weekends and D.C. holidays (Emancipation Day, April 16) |
| USC529, USC2503, I709, RP2625 | 26 U.S.C. 529(c)(2)(B), 2503(b); Form 709 instructions; Rev. Proc. 2026-25 | the yearly gift exclusion and the 5 x exclusion five-year election |
| IRSCOLA, IRSNEWS | irs.gov COLA table and the August to October 2026 news releases | what had and had not been published for 2027 by 2026-10-31 |

## Figures

| Figure | 2025 | 2026 | Source |
|---|---|---|---|
| 401(k) limit / catch-up 50+ / catch-up reaching 60-63 | $23,500 / $7,500 / $11,250 | $24,500 / $8,000 / $11,250 | N2480; N2567; USC414 (v)(2)(E) |
| 415(c) annual additions (contrast) | $70,000 | $72,000 | N2480; N2567 |
| IRA limit / catch-up 50+ | $7,000 / $1,000 | $7,500 / $1,100 | N2480; N2567 |
| Roth IRA phase-out | joint 236,000-246,000; single, head of household, separate and apart 150,000-165,000; separate and together 0-10,000 | 242,000-252,000; 153,000-168,000; 0-10,000 | N2480; N2567; USC408A (c)(3) |
| Traditional IRA phase-out (contrast) | in a plan: single 79,000-89,000, joint 126,000-146,000; spouse in a plan 236,000-246,000; separate 0-10,000 | 81,000-91,000; 129,000-149,000; 242,000-252,000; 0-10,000 | N2480; N2567 |
| HSA self-only / family / catch-up 55+ | $4,300 / $8,550 / $1,000 | $4,400 / $8,750 / $1,000 | RP2425; RP2519; USC223 (b)(3) |
| HSA 2027 | | self-only $4,500, family $9,000 | RP2624 |
| Health FSA limit / carryover | $3,300 / $660 | $3,400 / $680 | RP2440; RP2532 |
| Standard deduction single and separate / joint / head of household | $15,750 / $31,500 / $23,625 | $16,100 / $32,200 / $24,150 | RP2532 s.3.01, s.4.14; PL11921 |
| Social Security wage base | $176,100 | $184,500 | SSA25; SSA26 |
| Additional Medicare thresholds | single and head of household 200,000; joint 250,000 (combined); separate 125,000 (not indexed) | same | USC3101 (b)(2); I8959 |
| IRA / HSA deadline | April 15, 2026 | April 15, 2027 (2027 HSA money: April 18, 2028) | USC219 (f)(3); USC223 (d)(4)(B); USC408A (c)(6); USC7503; DC2701 |
| Gift exclusion / 529 five-year amount per giver | $19,000 / $95,000 | $19,000 / $95,000 | RP2440; RP2532; I709 |

**2027.** By 2026-10-31 the IRS had published only the 2027 HSA limits (Rev. Proc. 2026-24). There was no 2027
retirement-plan notice and no 2027 inflation-adjustment revenue procedure (RULES.md section 14). So a 2027 row
carries the ages, the HSA outputs and the deadline, and every other output is blank. SSA's 2027 wage base
($192,300) is in `rules.py` but unused.

## Who each row is

One household in one tax year, all twelve months, no dependents, the standard deduction and no credits, and
nobody 65 or older (adults are 22 to 64 by December 31).

- **Filing status.** `single` and `head_of_household` rows have adult A only. `married_joint` and
  `married_separate` rows have A and B. `lived_apart` = 1 means the spouses lived apart the whole year; it matters
  only on separate returns (two joint rows carry 1 to show that it is ignored there).
- **Each adult.** `birth`; a year's `pay`; `k401` (pre-tax 401(k), from pay), `roth401k` (Roth 401(k), same
  employer), `k401_match` (the employer's match for the year); `trad_ira`, `roth_ira` (direct); `hsa_payroll`
  (the person's own HSA money taken from pay, so outside income and payroll tax up to the limit), `hsa_employer`
  (employer deposits). Money taken from pay (401(k), Roth 401(k), HSA payroll money and A's FSA) never exceeds
  pay, and a match always comes with a deferral.
- **The household.** `coverage`: `none`; `self` = only A is HSA-eligible, with self-only high-deductible cover;
  `family` = one family high-deductible plan covering everyone, both spouses eligible (on a single or head of
  household return it covers someone who is not on the return). `other_income`: taxable interest for the year.
  `fsa_election`, `fsa_spent`: a health FSA through A's employer. A row with both an FSA and HSA money exists only
  to test the page's warning (50 rows).
- **`today`** is a date inside the year. It never changes an output: ages are the age reached on December 31.

## How each row is worked (derivation 1: rules.py)

`rules.work_household` gives every rule's outputs. The script adds, from `rules.py` functions:

- `hsa_excess` per adult: `rules.hsa_positions(...)['excess']` (work_household reports only the sum).
- `roth_allowed_worksheet`: `rules.phase_out(..., method='worksheet')`, then Pub. 590-A Worksheet 2-2 line 8 read
  literally ("If the result is less than $200, enter $200") inside the range, then line 11 (the lesser of that
  and the limit less traditional money).
- `wages` (W-2 box 1 as the law counts it), the same terms `work_household` adds up: pay - pre-tax 401(k) + the
  excess deferral in income - A's FSA salary reduction up to the limit - HSA payroll money + the person's HSA
  excess. On every row the script checks that these wages plus the other income (half each on separate returns)
  give exactly `rules.py`'s MAGI, so this glue cannot drift from `rules.py`.
- `agi_real_deduction` per adult: that return's MAGI minus the real deductions on it.

## The other way, run on every row before the CSV is written (derivation 2)

It is written separately in this file, in integers, and calls no `rules.py` function. It uses `rules.py`'s
tables only.

- **Units.** Money is held in half cents (200 to the dollar), because separate returns split the other income in
  half, and taxes in half cents x basis points.
- **Ages.** The year minus the first four characters of the birth date (`rules.py` parses the date).
- **401(k).** The catch-up comes from an age table: 64 and over gets the ordinary amount, 60 to 63 the higher
  one, 50 and over the ordinary one, else 0. Then it is capped by pay. The part treated as catch-up for 415(c) is
  the deferral beyond the 402(g) limit, up to the catch-up.
- **HSA.**
  - The per-person limit is the brief's own formula, min(family + cu_p - use_p, family + cu_p + cu_q - use_p -
    use_q) + use_p, held at no less than the person's own catch-up. `rules.py` writes it as cu_p + max(0, family -
    max(0, use_q - cu_q)).
  - The excess at the least-over division is worked as "equal halves, then a half one spouse leaves unused goes
    to the other". `rules.py` clamps A's share into an interval instead.
- **Phase-outs.** One integer floor division: reduction = full x (MAGI - start) // ($10 x width) x $10, then the
  $200 floor.
  - The worksheet ratio is an integer number of thousandths, floor((2000 x (MAGI - start) + width) / (2 x
    width)), at most 1,000. Line 8 is rounded up to $10.
  - The traditional-IRA range comes from a lookup table keyed by the return kind (joint; separate and together;
    alone, which takes single, head of household and separate-and-apart), whether the person is in a plan, and
    whether the spouse is.
- **Income tax.** Worked from the printed "$X plus N% of the excess over" bases of Rev. Procs. 2024-40 and
  2025-32, with the bracket found by bisection. `rules.py` adds up the bracket slices, and it rebuilds those
  printed bases in its self-checks.
- **Payroll tax.** In basis points: 620 x (min(wages without, base) - min(wages with, base)), 145 x the
  difference, and 90 x the return's combined Medicare wages over its threshold.
- **Deadline.** A day-by-day test of D.C. Code 28-2701: the fixed days; a Saturday holiday kept on the Friday
  before and a Sunday one on the Monday after; the Monday holidays by their day ranges; Thanksgiving; Inauguration
  Day. `rules.py` builds a set of holidays for three years instead.

The guard compares the two on 249,664 amounts and 42,112 other values (every row, and the 8 redrawn draws). No
amount differs at all before rounding, and the largest gap is 0.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up. Ties are real here: 1,403
  written amounts are exactly on a half cent before rounding. Most are the 1.45% Medicare part (`fica_saved_medicare`
  262, `fica_saved` 249, `fica_saved_flat` 206, `addl_medicare_saved` 65). The rest are a MAGI with half a cent
  on separate returns with odd-cent interest (`a_magi`, `b_magi`, the AGIs: 94 each) and income tax on such a
  MAGI (57). A float version may round these down: compare with a cent of tolerance.
- **IRA phase-outs** are whole multiples of $10 by law, so they never round when written.
- **Inputs** are written with two decimals. They are whole dollars except `other_income` and a share of random
  amounts, which carry cents.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder: once with the RULES.md examples check, and
once without it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | RULES.md examples check | Row guard |
|---|---|---|
| Roth reduction rounded to the nearest $10, not down | caught | refused at `limits-2026-mfj-0003` (4,880 vs 4,890) |
| no $200 floor | caught | refused at `limits-2026-mfs-0006` (10 vs 200) |
| exactly the start of the joint or single range labelled ok | not caught | refused at `limits-2025-mfj-0068` (status) |
| MAGI exactly 0 on the separate-and-together range labelled partial | not caught | refused at `limits-2025-mfs-0139` (status) |
| separate and together uses the single range | caught | refused at `limits-2026-mfs-0004` (status) |
| age on `today` instead of December 31 | not caught | refused at `limits-2026-mfj-0003` (age 51 vs 52) |
| the 60-63 catch-up treated as the ordinary one | caught | refused at `limits-2026-sgl-0001` (8,000 vs 11,250) |
| IRA catch-up kept at $1,000 (not indexed) | caught | refused at `limits-2026-sgl-0001` (1,000 vs 1,100) |
| Roth 401(k) money outside the 402(g) limit | caught | refused at `limits-2026-sgl-0001` (26,000 vs 36,000) |
| one spouse may use the other's HSA catch-up | caught | refused at `limits-2026-mfj-0008` (wages, through `ira_compensation`) |
| Social Security saved on all the HSA money | caught | refused at `limits-2026-sgl-0012` (272.80 vs 0) |
| additional Medicare threshold per person on a joint return | not caught | refused at `limits-2025-mfj-0472` (0 vs 38.48) |
| FSA salary reduction left in wages | caught | refused at `limits-2026-mfj-0011` (through `ira_compensation`) |
| an excess pre-tax deferral kept out of income | caught | refused at `limits-2026-sgl-0002` (0 vs 250) |
| a spouse-only participant on the participant range | caught | refused at `limits-2026-mfj-0003` (`agi_real_deduction`) |
| D.C. Emancipation Day left out | caught | refused at `limits-2027-sgl-0523` (2028-04-17 vs 2028-04-18) |

In all thirty-two runs no CSV was written.

## The generator

Edge rows come first, then random rows. A random draw is redrawn (8 of 2,386 draws) when any adult's MAGI is
exactly on a Roth or traditional-IRA range line, when an exact phase-out reduction is within $0.000001 of a $10
step, or when Pub. 590-A's three-place ratio is exactly on a half. Those cases are left to the labelled edge rows,
so float error in an app cannot flip a random row.

### Edge rows (labelled in `note`): 554

| Rows | What they pin down |
|---|---|
| `0001`-`0015` | RULES.md section 10. Rosa 61, 250 over, covered by Roth money, and all pre-tax (250 in income). Dev and Mara, joint MAGI 246,321: Roth 4,260 and 2,600, Mara 400 over, real deduction 4,890. Sam and Lee, separate: together and apart, and Lee at 9,990 (the $200 floor). Ana and Ben's family HSA: room 250 each; Ben +1,000; the ages swapped (a stranded catch-up); both 40 at 6,000; with an FSA. Kai at 210,000 and 186,000 (Social Security 0 and 179.80, Medicare 63.80, additional Medicare 39.60). Jo's FSA 3,600 / 2,900, and with an HSA |
| `0016`-`0066` | **ages:** reaching 49, 50, 54, 55, 59, 60, 63 and 64 in 2025 and 2026, born January 1, December 31, February 29 (when that birth year was a leap year) and a random day. `today` is before the birthday (or is January 1). The 401(k), IRA and HSA are exactly at the limits for that age, so a wrong age shows as room or over. The spouse is the age on the other side of the edge |
| `0067`-`0278` | **Roth phase-out**, for 2025 and 2026, each range (joint; single, which takes single, head of household and separate-and-apart in turn; separate and together), with and without the IRA catch-up. MAGI at start - 0.01 (except 0-10,000), start, start + 0.01, start + 1, a cent before and at the first $10 step, a reduction exactly a multiple of $10 and a cent below it, a reduction ending in 5-9.99, a point where the three-place worksheet gives $10 less, limits of 210 / 200 / 190 (raised to 200) / 10 (raised to 200), end - 1, end - 0.01, end and end + 1. Every other row adds traditional money, so the allowed amount is limit - traditional |
| `0279`-`0330` | **traditional IRA deduction (contrast):** in a plan, single (single, head of household, separate and apart in turn); in a plan, joint; not in a plan with the spouse in one (a Roth 401(k) + match), joint; separate and together with the spouse in a plan. Each at start, start + 1, a reduction ending in 5-9.99, 190 raised to 200, end - 1 and end. Plus separate and apart with only the spouse in a plan (full deduction), and nobody in a plan at 405,000 |
| `0331`-`0382` | **401(k):** under 50, 50-59, 60-63 and 64, at limit + catch-up -1, exactly, +1 and +2,500. Pre-tax only, Roth only, and mixed, with and without a match. 415(c): exactly at the limit, 1 over, a catch-up outside it, 100% of pay, and an excess deferral kept in. Roth 401(k) with and without a match, a Roth-only excess, and the catch-up capped by pay |
| `0383`-`0398` | **IRA:** under and over 50, at limit -1, exactly, +1, traditional / Roth / both. B with no pay on a joint return (spousal IRA) and on a separate one (compensation short, recorded) |
| `0399`-`0462` | **HSA,** 2025 and 2026: self-only and family (single and head of household), under and over 55, at -1, exactly and +1, from payroll, employer or both. Married with one family limit, for each of the four combinations of who is 55 or over, at the household limit -1, exactly and +1, on joint, separate-together and separate-apart returns. The stranded catch-up both ways; one spouse taking the whole family limit; a shared excess both spouses show; self-only cover with B's money (not eligible); employer money alone over; no cover; 50 is under the catch-up age |
| `0463`-`0488` | **payroll tax:** pay straddling the wage base, exactly at it, wages with the HSA money exactly at it, above it either way, 1 under. Straddling 200,000, wages with the HSA money exactly at 200,000, pay exactly 200,000, and head of household. Joint combined wages straddling 250,000; each spouse under 200,000 but 310,000 together; separate straddling 125,000; one spouse straddling the base |
| `0489`-`0504` | **FSA:** limit -1 all spent; at the limit with unspent exactly the carryover, and 1 over it; limit +1; 600 over (the part over stays in wages); a small election. With an HSA (the warning), and with employer HSA money for B |
| `0505`-`0522` | joint with `lived_apart` 1 (ignored); taxable income 0 either way (`today` January 1); the HSA money moving taxable income across the 12% / 22% line (`today` December 31); the 37% bracket; separate with 0.01 of interest (MAGI 5,000.005) and with 1,234.57; youngest (22, born January 1) and oldest (64, born December 31); no pay at all |
| `0523`-`0554` | the same HSA edges for **2027** (Rev. Proc. 2026-24); deadline April 18, 2028 |

### Random rows: 2,446

- **Years.** `0555`-`0622` are 2027 (68 rows: HSA only, every other contribution 0). `0623`-`3000` are 2025 and
  2026, filled so that each year has exactly 1,450 rows in all.
- **Filing status:** single 28, joint 37, separate 15 (half lived apart), head of household 20.
- **Coverage, by status:** single none 45 / self 45 / family 10; joint 35 / 25 / 40; separate 40 / 25 / 35;
  head of household 35 / 35 / 30.
- **Age:** 22-64 (70%) or 48-64 (30%).
- **Birthday:** January 1 (4%), December 31 (4%), February 29 when the year allows (3%), else a random day.
- **Pay:**
  - 15,000-45,000 (8%), 45,000-120,000 (37%), 120,000-200,000 (30%), 200,000-400,000 (20%), 400,000-800,000 (5%).
  - 15% of draws carry cents.
  - B: 2% no pay, 5% 1,000-15,000.
- **Each contribution** against its own limit (401(k) with the catch-up, IRA with the catch-up, HSA with the
  catch-up, FSA): none, under, exactly at, a little over (1-300), or well over (301-5,000). Weights:
  - 401(k): none 28, under 37, at 20, a little over 9, well over 6. 5% of those 50 and over stop at the 402(g)
    limit without the catch-up.
  - IRA: none 35, under 30, at 20, a little over 10, well over 5.
  - HSA: none 30, under 35, at 15, a little over 12, well over 8.
  - Caps on all of them: pay what is left after the FSA and HSA payroll money.
- **401(k) split:** pre-tax only 55, Roth only 15, mixed 30.
- **Match:** 2-6% of pay (55%), 1,000-6,000 (10%), near the 415(c) limit (5%), else none.
- **IRA split:** traditional only 30, Roth only 45, both 25.
- **HSA:**
  - Married family cover draws one household total (none 10, under 40, at 25, a little over 15, well over 10).
    A spouse 55 or over puts in their own catch-up first in 80% of cases. The rest is split in tenths.
  - Each person's money is payroll, or a quarter or half from the employer.
  - 3% of people who are not eligible have HSA money anyway.
- **FSA:** in 25% of rows without HSA cover, and 2% of the others (the warning). Election under the limit 60,
  at it 25, a little over 10, well over 5. All spent (40%) or 0-99% spent.
- **Interest:** none (40%), up to 2,000 (40%), 2,000-30,000 (15%), 30,000-150,000 (5%).

## Coverage (from the run)

| | Rows / adults |
|---|---|
| total | 3,000 rows (554 edge, 2,446 random; 2,386 random draws, 8 redrawn), 4,616 adults |
| year 2025 / 2026 / 2027 | 1,450 / 1,450 / 100 |
| single / joint / separate together / separate apart / head of household | 802 / 1,106 / 293 / 217 / 582 |
| one adult / two | 1,384 / 1,616 |
| coverage none / self / family | 1,278 / 922 / 800 |
| adults reaching 49 / 50 / 54 / 55 / 59 / 60 / 63 / 64 | 135 / 150 / 153 / 158 / 162 / 143 / 144 / 169 |
| birthdays January 1 / December 31 / February 29 (of them at an edge age) | 189 / 200 / 38 (59 / 71 / 14) |
| edge-age adults whose `today` is before the birthday | 631 |
| Roth, joint range: ok / partial / over (exactly at start / end) | 936 / 178 / 1,030 (12 / 12) |
| Roth, single range: ok / partial / over (exactly at start / end) | 1,025 / 167 / 560 (4 / 4) |
| Roth, separate and together: ok / partial / over (exactly at start / end) | 8 / 82 / 484 (8 / 6) |
| Roth partial: reduction rounded down / exactly a multiple of $10 / raised to the $200 floor | 359 / 52 / 92 |
| Roth partial: the three-place worksheet gives another amount | 67 |
| Roth allowed held down by traditional money / Roth money over the allowed amount | 485 / 1,292 |
| traditional IRA: real deduction below the page's (contrast) | 935 |
| 401(k) under / exactly at the limit / over | 1,610 / 781 / 514 |
| 401(k) excess in income / over but covered by Roth money / catch-up 60-63 / catch-up capped by pay | 278 / 241 / 367 / 72 |
| Roth 401(k) with a match / without | 877 / 367 |
| 415(c) exceeded (contrast) | 134 |
| IRA under / exactly at / over; compensation short (recorded) | 1,117 / 1,191 / 517; 81 |
| adults with HSA money / at their limit / over it / not eligible / with employer money | 1,854 / 500 / 593 / 67 / 917 |
| married family HSA with 0 / 1 / 2 spouses 55 or over | 241 / 260 / 60 |
| household HSA over its limit / money to remove above the household over (stranded catch-up) | 445 / 15 |
| rows with HSA payroll money / some of it over the limit | 1,326 / 431 |
| ... no Social Security saved (above the base) / additional Medicare saved / no income tax saved | 343 / 549 / 85 |
| ... the flat 7.65% differs from `fica_saved` | 750 |
| adults with pay above the wage base / at or under it (2025-2026) | 1,217 / 3,253 |
| FSA rows / over the limit / unspent above the carryover / with an HSA | 294 / 56 / 115 / 50 |
| adults whose MAGI has half a cent | 188 |
| written amounts exactly on a half cent before rounding | 1,403 |

## CSV columns

Money has two decimals. A blank means "does not apply": the `b_` columns of a one-adult row, the household
`magi`, `agi` and `agi_real_deduction` except on joint returns, and every output that needs an unpublished figure
on a 2027 row. `note` is empty on every random row; on an edge row it says what the row shows.

**Inputs:** `case_id, year, today, filing_status, lived_apart, coverage, other_income, fsa_election, fsa_spent`,
then `a_birth, a_pay, a_k401, a_roth401k, a_k401_match, a_trad_ira, a_roth_ira, a_hsa_payroll, a_hsa_employer`
and the same with `b_`.

- `case_id` is `limits-<year>-<sgl|mfj|mfs|hoh>-<row number>`. The number is the row's place in the file.

**Per adult** (`a_` and `b_`):

| Column | Meaning |
|---|---|
| `age` | the age reached on December 31: year - birth year |
| `k401_limit`, `k401_catch_up` | the 402(g) limit; the 414(v) catch-up (0 under 50; the higher amount in a year the person reaches 60, 61, 62 or 63), never above pay - the deferrals within the limit |
| `k401_used`, `k401_room`, `k401_over` | pre-tax + Roth 401(k); max(0, limit + catch-up - used); max(0, used - limit - catch-up) |
| `k401_in_income` | the part of the excess not covered by Roth 401(k) money, in this year's income (402(g)(1)(A)) |
| `ira_limit`, `ira_catch_up`, `ira_used`, `ira_room`, `ira_over` | one limit for traditional + Roth IRA, catch-up from 50 |
| `ira_compensation`, `ira_comp_ok` | the compensation behind the IRA (own box-1 wages; on a joint return the lower earner adds the spouse's less the spouse's IRA money); 1 when it reaches the limit with catch-up. Recorded only: every IRA output assumes enough compensation, as the brief says |
| `wages` | W-2 box-1 wages as the law counts them (see derivation 1) |
| `magi`, `agi` | that adult's return: box-1 wages (both spouses on a joint return) + interest (half each on separate returns); AGI = MAGI - traditional IRA as the page deducts it |
| `trad_ira_page_deduction` | the page's "fully deductible" traditional IRA, kept inside the 219(b) dollar limit |
| `roth_status` | Pub. 590-A Table 2-1's bands: `ok` below the start (on the separate-and-together range, at exactly 0), `partial` from the start (above 0 on that range) to below the end, `over` at or above the end |
| `roth_reduced_limit` | the limit with catch-up, reduced: full x (MAGI - start) / width rounded down to $10, a result between 0 and 200 raised to 200 |
| `roth_allowed`, `roth_over` | min(reduced limit, limit with catch-up - traditional IRA), not below 0; Roth IRA money above it |
| `hsa_eligible` | 1 when the coverage makes the person HSA-eligible (`self`: A only; `family`: everyone) |
| `hsa_limit`, `hsa_used`, `hsa_room`, `hsa_over` | the most this person could have given the other spouse's actual money (with one shared family limit: catch-up_p + max(0, family - max(0, used_q - catch-up_q))); payroll + employer money; room and over against it. With a shared limit both spouses can show the same dollars over, so the two `hsa_over` are not additive |
| `hsa_excess` | the person's money really over, at the division of the family limit that leaves the least over, as near equal halves as possible; it is what goes back into wages |

**Household:**

| Column | Meaning |
|---|---|
| `magi`, `agi` | joint returns only: the return's MAGI and AGI |
| `hsa_limit_household`, `hsa_total`, `hsa_room_household`, `hsa_over_household` | the coverage's limit + the catch-ups of eligible people 55 or over; all HSA money; room and over against it |
| `hsa_excess_to_remove` | the least money that must come out; above `hsa_over_household` when a catch-up cannot be used by the spouse who has the money |
| `income_tax_with`, `income_tax_without`, `income_tax_saved` | federal income tax (rate schedule on AGI - standard deduction; separate returns added) with the HSA payroll money and with it put back in pay; the difference |
| `fica_saved_ss`, `fica_saved_medicare`, `fica_saved` | 6.2% only on the part of each person's payroll-tax wages under the wage base; 1.45% on all; their sum |
| `addl_medicare_saved` | the 0.9% additional Medicare tax the lower Medicare wages save (joint returns combine both spouses) |
| `fsa_limit`, `fsa_carryover`, `fsa_over`, `fsa_unspent`, `fsa_forfeit`, `fsa_with_hsa` | the 125(i) limit; the carryover maximum; election - limit; election - spent; unspent above the carryover (lost if the plan carries over); 1 when an FSA and any HSA money are both funded |
| `ira_hsa_deadline` | the last day for IRA and HSA money for the year (ISO date) |
| `gift_exclusion`, `qtp_five_year_max` | the yearly gift exclusion per giver per person; 5 x it, the 529 five-year election amount per giver |

**Contrasts and side columns** (`a_`/`b_`, then household):

| Column | Meaning |
|---|---|
| `trad_ira_deductible` | the real 219(g) deduction: min(traditional, the limit reduced on the range that applies), for a person in a workplace plan (any 401(k) money of their own: pre-tax, Roth or match) or whose spouse is |
| `agi_real_deduction` | that return's AGI with the real deductions (per adult on every return; household on joint returns) |
| `annual_additions`, `limit_415c`, `over_415c`, `exceeds_415c` | deferrals - the part treated as catch-up + match; min(415(c) dollar limit, pay); the excess; 0/1 |
| `active_participant` | 1 when the person has any 401(k) money (pre-tax, Roth or match) |
| `roth_allowed_worksheet` | Pub. 590-A Worksheet 2-2: the ratio rounded to three places, line 8 up to $10 with the $200 rule, line 11. It is not the page's simplification: a page that uses the worksheet matches it where it differs from `roth_allowed` (67 adults, by $10) |
| `fica_saved_flat` | the page's simplification: 7.65% x the household's HSA payroll money |

## Open points (judgement calls a reviewer should know)

1. **Law, not the page, where they differ; the page's reading beside it only where the brief asks.** The
   contrasts are `trad_ira_deductible` / `agi_real_deduction`, the 415(c) columns and `fica_saved_flat`.
   `roth_allowed_worksheet` is a side method, not a contrast. Four law-over-page choices of `rules.py` (RULES.md
   section 12) change wages, so they also change MAGI, AGI, the Roth result, the income tax and compensation. They
   touch 1,038 of the 2,900 rows of 2025-2026, and none of them has a contrast column, as the brief asked:
   - A's FSA salary reduction is out of wages, up to the limit (294 rows).
   - Pre-tax 401(k) money over the limit that Roth money does not cover is income (278 adults).
   - HSA money over the limit is income and payroll-tax wages (454 adults).
   - The "fully deductible" traditional IRA stops at the IRA dollar limit (138 adults).

   A page that follows the brief's plain AGI will miss these rows. Each mismatch should be traced to one of the
   four before it is called a bug.
2. **Roth status exactly at the start follows Pub. 590-A Table 2-1** (changed 2026-10-31; it was `ok` at every start).
   The table files exactly the start of the joint and single ranges under "the amount you can contribute is reduced"
   ("at least $236,000 but less than $246,000"; "at least $150,000 but less than $165,000"), so the key says `partial`
   there, and it files MAGI of exactly 0 on the separate-and-together range under "you can contribute up to $7,000"
   ("zero (-0-)"; "more than zero (-0-) but less than $10,000" is reduced), so the key says `ok` there. The statute
   reduces nothing at exactly a start (408A(c)(3)(A): the excess over the start is zero), so the allowed amount is the
   full limit at every start; only the label is in question, and the IRS's own table decides it. 18 rows have an adult
   exactly at a start. `partial`: `limits-2025-hoh-0104`, `-mfj-0068`, `-mfj-0086`, `-mfj-0291`, `-mfs-0122` (apart, on
   the single range), `limits-2026-hoh-0228`, `-mfj-0174`, `-mfj-0192`, `-mfj-0317`, `-sgl-0210`. `ok` (MAGI 0,
   separate and together): `limits-2025-mfs-0139`, `-mfs-0156`, `-mfs-0297`, `-mfs-0390`, `limits-2026-mfs-0245`,
   `-mfs-0262`, `-mfs-0323`, `-mfs-0398`. A page that says `partial` at 0 on a separate return disagrees with both the
   table and the statute.
3. **Ages by the birthday, not the common-law "day before".** The age is year - birth year, so a January 1
   birthday counts in its own year and not in the year before. This follows 26 CFR 1.414(v)-1(g)(3)(ii) ("The
   employee's 50th or higher birthday would occur before the end of the employee's taxable year") and the brief.
   Pub. 501's rule ("considered to be age 65 on the day before your 65th birthday") is for the 65+ standard
   deduction only. 29 adults born on January 1 are 49, 54, 59 or 63 here and would get a catch-up a year early
   under the day-before reading. A February 29 birthday in a common year still counts that year.
4. **2027 rows are included** (100 rows: 32 edge, 68 random) because Rev. Proc. 2026-24 published the 2027 HSA
   limits. They carry only pay and HSA money. Their outputs are the ages, the HSA columns and the deadline, and
   everything else is blank. A test of a page with no 2027 figures can skip `year == 2027`.
5. **Pub. 590-A worksheet column.** `rules.phase_out(..., 'worksheet')` returns $0 when the three-place ratio
   rounds to 1.000 inside the range (MAGI within $5 of the end of a $10,000 range, or $7.50 of a $15,000 one).
   Line 8 read literally ("If the result is less than $200, enter $200") gives $200 there, and so does the law.
   The column follows line 8, which differs from `rules.py`'s worksheet on 34 adults (the end - 1 and end - 0.01
   edge rows). Against the law it differs on 67 adults, by $10 each.
6. **Extra columns** beyond the brief:
   - from `rules.py`: `k401_in_income`, `ira_compensation`, `ira_comp_ok`, `trad_ira_page_deduction`,
     `active_participant`, `hsa_eligible`, `hsa_excess_to_remove`, `fsa_forfeit`, `income_tax_with` /
     `_without`, `fica_saved_ss` / `_medicare`, and the household `agi_real_deduction`;
   - added by this script: `wages`, `hsa_excess` and `agi_real_deduction` per adult, and
     `roth_allowed_worksheet`.
7. **HSA conventions (`rules.py`):**
   - Eligibility comes from `coverage`.
   - An FSA with an HSA is only flagged (`fsa_with_hsa`, 50 rows); the HSA outputs are worked as if eligible,
     although 223(c)(1) would end eligibility for a general-purpose FSA.
   - Spouses share one family limit on separate returns too, and when they lived apart. 223 has no rule for
     living apart, and 7703(b) needs a child.
   - `hsa_limit` is the brief's per-person formula, held at no less than the person's own catch-up.
   - What is really over uses the least-over division nearest equal halves. 223(b)(5) says equal halves "unless
     they agree on a different division"; no source fixes the division when they never agreed.
   - Family cover is allowed on single and head-of-household returns (239 rows); the limit is then the family
     amount + the person's own catch-up.
8. **Income tax (`rules.py`):**
   - It is worked from the rate schedule on exact taxable income, not the IRS Tax Table, so it can differ from a
     Form 1040 by a few dollars.
   - Separate returns split the interest in half; with odd cents that leaves half a cent on each (188 adults).
   - Head of household is taxed as given, although the rows have no qualifying person.
9. **401(k):**
   - For 415(c), deferrals over the 402(g) limit count as catch-up first, up to the catch-up. An excess beyond
     that stays in as an annual addition (not distributed).
   - The 414(v)(7) Roth catch-up rule (from 2026, on last year's wages from the employer over $150,000) is not
     applied, because the row has no prior-year wages. 103 adults of 2026 are 50 or over, paid more than
     $150,000 this year, with pre-tax money beyond the 402(g) limit; if last year's pay was similar, that
     catch-up would have to be Roth. The key treats it as allowed pre-tax.
10. **FSA:** the election is excluded from A's wages up to the limit, and the part over stays in wages. No source
    says whether an election over the limit is excluded up to the limit or not at all.
11. **Compensation:** 110 adults have `ira_comp_ok` 0, 81 of them with IRA money. Most are on the separate 0-10,000
    Roth edge rows, where A's pay is that small, or have no pay on a separate return. Their IRA and Roth
    outputs still assume enough compensation, as the brief says. On a joint return a spouse with no pay borrows
    the other's (22 rows have a B with no pay).
12. **Float traps in the edge rows:**
    - 52 adults have an exact phase-out reduction that is a multiple of $10. A float version can land a hair
      under it and floor to the next $10 down.
    - The start + 0.01 and a-cent-before-a-step rows sit within a cent of a change.
    - These rows are right in the key. Random rows stay at least $0.000001 away from a step (the redraws above).
13. **Payroll tax:** the liability, not the employer's withholding (3102(f) withholds only above $200,000 per
    employer). A joint return combines both spouses' Medicare wages for the 250,000 threshold.
14. **Deadlines:** D.C. holidays only; disaster postponements and state holidays for filings outside D.C. are not
    modelled. 2025: April 15, 2026; 2026: April 15, 2027; 2027 (HSA): April 18, 2028.
15. **Inputs the brief left open:** every mix under "The generator", including the share of each status and
    coverage, the age and pay mixes, how often each contribution is at, under or over its limit, the HSA split
    between payroll and employer and between spouses, and the 100 rows of 2027.

## What the key leaves out (on purpose)

Part-year HDHP cover, the last-month rule and the testing period; Medicare enrollment (no one is 65); HSA
eligibility ended by a general FSA (flagged only); limited-purpose FSAs; the grace period instead of a
carryover; more than one employer (402(g) is per person, 415(c) per employer); after-tax 401(k) money,
forfeitures and the mega-backdoor; Roth conversions and backdoor Roth contributions; the 414(v)(7) Roth catch-up
requirement (no prior-year wages); the saver's credit; state income tax; excess-contribution excise taxes (4973)
and corrective distributions; and gift splitting between spouses (2513) beyond the per-giver amount.
