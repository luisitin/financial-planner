# Debt answer key: pay off debts, credit cards, mortgage

One independent answer key for the three debt pages:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `debt_key.py` | `tests/golden/debt/payoff.csv` | 1,500 | 1 to 5 debts paid from one monthly budget: avalanche, snowball, avalanche with $100 more a month, and the required-payments-only baseline (both readings). For each: months until every debt is gone, total interest, total paid, the month each debt is paid off, or "never" |
| | `tests/golden/debt/cards.csv` | 1,000 | one card paid at its minimum (the required payment if one is set, else 2% of the balance with a $25 floor): months, interest, total paid, or never; and a balance transfer: interest on the old card over the promotion, the fee, the saving and the payment that clears it |
| | `tests/golden/debt/mortgage.csv` | 1,000 | months and interest left at the payment, with extra each month, every two weeks (the page's 13/12 model and, for contrast, 26 real half payments), a recast after a lump sum, and the months until the balance falls to 80% of the home's value (the page) and to the Homeowners Protection Act's 80% / 78% of the original value |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the
model as small functions. `tests/golden/debt/RULES.md` gives each rule in plain words with the source text,
and works one example per page by hand. Those examples are rows `po-edge-001`, `cc-edge-001` to `-004` and
`mo-edge-001` / `-002` of the CSVs.

**Independence.** This key was written from Regulation Z (12 CFR 1026.7(b)(12), appendices M1 and M2,
1026.53, 1026.55, 1026.36), the Homeowners Protection Act (12 U.S.C. 4901-4902), Fannie Mae's Servicing Guide
and the CFPB's consumer pages, through `rules.py` and RULES.md. Nobody opened `modules/`, `core/` or
`tests/*.test.mjs` while writing it, and it never imports or runs the app. The only things taken from
`tools/golden_student_loans/` and `tools/golden_paycheck/` are their layout and conventions; no figure or
code is shared. On 2026-10-31 the key was verified against the pages. To decide which side of each
disagreement was wrong, the verifier read the pages' code and READMEs, and changed two of the key's rules: the
balance-transfer payment when no required payment is set (open point 7), and the tie-break (open point 3).
Neither change takes a figure from the app. The script works every row in two separate ways, on two rounding tracks. It refuses to write
any CSV if a month count differs, or an amount differs by more than a cent, between the two ways. In fact the
two agree on every exact-track amount to within 6e-52 of a dollar before rounding, and exactly on every
cents-track amount.

## Run

```
python3 tools/golden_debt/debt_key.py
```

Python 3 standard library only (made with 3.13; about 70 seconds). The run is deterministic
(`random.Random(20261031)`), so a second run writes byte-identical files. The script sets
`sys.dont_write_bytecode` *before* it imports `rules.py`, so no `__pycache__` lands in the repo. Importing
`rules.py` runs its self-checks. The run then checks derivation 2 against RULES.md's worked examples, works
all three CSVs, and writes them only once all three have passed. It prints every check count and the
coverage. An optional argument writes the CSVs to another folder (`debt_key.py /tmp/x`), which is how the
deliberate mistakes below were run.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the
`rules.py` docstring gives the sha256 of each copy. For this key, one point was read again on 2026-10-31
in those saved copies: whether the 2% / $25 minimum is worked out again every month. Appendix M1 (b)(1) and
the SAS loop of appendix M2 were read in the copies whose XML sha256 are `adcbde9e...21a08ce7b6` and
`5e9a20e3...5aa1a5f0e8`, the copies `rules.py` names. In M2 the line `pmt = round(pmin * tbal,0.01)` sits
inside the `eins:` loop, before that month's interest, so the minimum is worked out each month from the
balance owed before the interest.

| Tag | Source | Used for |
|---|---|---|
| RZ7 | 12 CFR 1026.7(b)(12) | (ii) a payment at or below the month's interest never pays off ("negative or no amortization") |
| RZM1 | 12 CFR 1026 appendix M1 | (b)(1) the account's own minimum formula; (b)(4)(i), (v), (vii) only minimums, the last payment clears it, equal months |
| RZM2 | 12 CFR 1026 appendix M2 (SAS code) | the minimum worked out every month; interest = APR / 12; each month's amounts rounded to the cent (the cents track) |
| RZ55 | 12 CFR 1026.55(b)(1) | a promotional rate lasts at least 6 months |
| RZ36 | 12 CFR 1026.36(c)(1)(ii) | a servicer may hold a half payment until a full one has built up |
| HPA1, HPA2 | 12 U.S.C. 4901, 4902 | 80% of the original value on request (initial schedule or actual payments), 78% automatically (initial schedule) |
| CFPBB15 | CFPB Bulletin 2015-03 | extra payments do not bring the 78% date forward |
| CFPBWS, CFPBRD | CFPB "Your Money, Your Goals" worksheet; CFPB blog "How to reduce your debt" | avalanche = highest rate first, snowball = smallest balance first, a finished debt's payment moves to the next |
| CFPBKT | CFPB mortgage key terms, "Bi-weekly payment" | half the payment every two weeks, 26 a year, one extra monthly payment a year |
| CFPBCT | CFPB credit card key terms, "Balance transfer" | a fee is usually a percentage or a fixed amount, whichever is more |

## Figures

| Figure | Value | Source |
|---|---|---|
| Monthly interest | APR / 12 x the month's opening balance | page READMEs; RZM2 `(apr/365) * (365/12)` |
| Default minimum | max(2% x the month's opening balance, $25), worked out every month | page README (2% / $25 is the page's own default, not a legal figure); RZM1 (b)(1), RZM2 (worked out each month) |
| Lawful promotion | 6 months or more | RZ55 (b)(1) |
| Every two weeks (page) | payment x 13/12 each month | page README; CFPBKT (26 half payments = 13 monthly payments a year) |
| Mortgage insurance on request | 80% of the original value | HPA1 4901(2)(A); HPA2 4902(a) |
| Mortgage insurance automatic | 78% of the original value, initial schedule only | HPA1 4901(18)(A); HPA2 4902(b); CFPBB15 |

## Who each row is

- **Pay off debts.** One to five debts, each with a balance, an APR and a required monthly payment. No new
  charges, no fees, rates never change. The person pays exactly the budget every month: every required
  payment plus `extra`, and keeps paying it as debts are finished.
- **Cards.** One card, no new purchases or fees, the APR never changes. `required` blank means the person
  pays the page's default minimum each month. Set, it is a fixed dollar amount paid every month.
- **Balance transfer.** The whole balance moves to a new card at 0% for `promo_months`, with a fee of
  `fee_pct` x the balance added to the new balance. The comparison is with staying on the old card for those
  months, paying max(required, balance / promo months) each month. With `required` blank, that is balance /
  promo months.
- **Mortgage.** A fixed-rate loan with interest at rate / 12 on the month's opening balance. `payment` is
  principal and interest only. `original_value` is the home's value when the loan was made (the lower of the
  price and the appraisal, HPA1 4901(12)). `home_value` is today's value. The HPA columns assume the person
  has always paid exactly `payment`, so today's balance is on the loan's initial schedule.

## How each row is worked (derivation 1: rules.py, month by month)

`rules.py` steps every balance month by month in Decimal arithmetic held to 60 significant digits:
`payoff_plan` and `baseline` for the plans, `card_payoff`, `balance_transfer` and `regz_m2_single` for the
cards, and `mortgage_compare`, `amortize`, `recast_payment`, `months_to_ltv` and `schedule` for the mortgage.
Each month interest is added to the opening balance and the payment pays interest first, then principal.
The payment that clears a balance is exactly what is left, and a part month counts as a month. A payment at
or below the month's interest is "never".

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, in exact `fractions.Fraction` arithmetic. These are the values that are
written.

- **One balance at a fixed payment** (cards with a required payment, every mortgage schedule, the transfer).
  - The balance after k payments is B g^k - P (g^k - 1) / r, with g = 1 + r (B - kP at 0%).
  - The payoff month is the first N with balance_(N-1) x g <= P. It is found from a float estimate and then
    settled exactly by galloping and bisection on the exact closed form.
  - Interest = (N - 1) P + the last payment - B.
  - Never: P at or below the first month's interest.
- **The 2% / $25 minimum** in two closed-form phases.
  - While the opening balance is at least $25 / 2% = $1,250, each month multiplies it by f = 1 + r - 2%.
    That is a geometric series, ending at the first month below $1,250.
  - Below $1,250 the payment is a $25 annuity.
  - Never is decided by the first month: max(2% x B, $25) at or below r x B. If the first month shrinks
    the balance, every later month does too.
- **Plans, payoff to payoff.**
  - Between payoffs every open debt pays a fixed amount: non-targets their required payment, the target the
    rest of the budget. So each debt follows its own closed form.
  - The phase jumps to the first month in which some debt's own payment clears it.
  - That month is worked by a one-month rule written separately from `rules.payoff_plan`: interest, every
    required payment (or what is owed), then the rest of the budget down the target order.
  - Never: a phase in which no open debt's payment beats its interest.
- **Mortgage extras.**
  - Recast = (B - lump) r g^n / (g^n - 1), with n = the whole months left at the payment.
  - The fractional reading is exactly payment x (B - lump) / B.
  - The months to a limit T = the first k with balance_k <= T, settled exactly.
  - 26 half payments: the same closed forms at r = rate / 26 and P / 2.

The guard compares derivation 1 with derivation 2 on every month count (75,565 + 7,596 + 21,564 =
104,725), every payoff-month list, the avalanche and snowball target order, and every amount (22,206 + 8,098
+ 7,188 exact-track amounts; the cards count includes the `bt_interest_with_min_floor` contrast). On the exact track no amount differs by more than 1e-20 before rounding; the
largest gap is 5.7e-52 of a dollar.

### The two rounding tracks

- **Exact track (the main columns).** Nothing is rounded inside a schedule. Each written value is rounded
  once, half up to the cent (half away from zero on the one column that can be negative, `bt_saves`; this is
  `rules.cents`).
- **Cents track (the `*_cents_track` columns).**
  - Every month's interest and every computed payment is rounded half up to the cent, as RZM2 does: the 2%
    minimum, payment x 13/12, max(required, balance / promo months).
  - It is written from an integer-cents loop (`schedule_ct`, `plan_ct`). It is checked against a second
    exact loop written in the shape of RZM2's SAS code (`schedule_m2`, `plan_m2`).
  - The two agree exactly on all 22,206 + 3,225 + 3,594 cents-track amounts and all their month counts.
- **Months are the same on both tracks** on every random row (rows where they are not were redrawn). The
  one edge row where they differ, `cc-edge-009`, says so in `note`.
- **How to read it.** A figure from the app matches the key if it is within $0.01 of either track. Months
  must match exactly. Total paid on the cents track is what was owed + the cents-track interest.

**rules.py's own cents track is not the check, and is off by a few cents on a few rows.**
- **Where it comes from.** `rules.schedule`, `payoff_plan`, `card_payoff` and `balance_transfer` with
  `round_cents=True` compute interest as `cents(balance x (APR / 12))`. APR / 12 is held to 60 digits, and it
  does not end in decimal when the APR in basis points is not a multiple of 3. So an interest charge that is
  exactly on a half cent can fall a hair short and round down.
- **Example.** $2,100.00 at 20.74%: 2,100 x 0.2074 / 12 = 36.295 exactly, which rules.py rounds to 36.29.
  Exact half up gives 36.30.
- **The same in `regz_m2_single`.** It rounds `balance x (1 + APR / 12)`, with the same effect in other
  months. Example: $900.00 at 25.78% gives 919.335, which it rounds to 919.33.
- **How the key handles it.** The key writes the exact half-up track, which is RULES.md's stated rule. It
  reproduces rules.py's numbers exactly by running its integer loop with rules.py's 60-digit rate
  (`dec_interest`); any mismatch there also stops the run.
- **Size.** rules.py differs from the written cents track on 66 + 6 + 18 amounts, in 14 + 4 + 14 rows (payoff,
  cards, mortgage), by at most 3 cents.
- **Suggested fix in rules.py.** Multiply first, then divide: `cents(balance * apr / 12)`. The product is
  exact, and Decimal division is exact whenever the true quotient ends within 60 digits.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder. For the row-guard runs, the RULES.md
examples check was switched off, so the row guard had to find each one alone.

| Mistake (derivation 2 only) | RULES.md examples check | Row guard |
|---|---|---|
| avalanche ties broken by the later-entered debt first | not caught | refused at `po-edge-011` (target order) |
| money left in a payoff month given to the target only, never further down | caught | refused at `po-edge-001` (avalanche interest 31.22 vs 32.82) |
| a $20 floor (Regulation Z's example) instead of $25 | caught | refused at `cc-edge-001` (268 vs 313 months) |
| the 2% minimum worked once and held level | caught | refused at `cc-edge-001` (268 vs 94 months) |
| recast spread over the months left at payment + extra | not caught | refused at `mo-edge-001` (1,124.57 vs 1,303.83) |
| every-two-weeks factor 13/12 + 1/1200 | caught | refused at `mo-edge-001` (biweekly interest) |

In all six runs no CSV was written.

## The generator

Edge rows come first, then random rows. A random row is redrawn when any of these holds, so a small
rounding difference in an app cannot move a month:

- a last payment under $1;
- a payoff month with under $1 to spare. A debt's room in its payoff month is max(its required payment,
  its required payment + the budget still unspent at its turn) - what it owed; for one balance it is a full
  payment - the last payment;
- for cards and mortgages, either margin under 1% of the payment. A scheduled mortgage payment's own payoff
  is the exception and uses $1 only;
- the two tracks giving other month counts;
- a balance passing within $1 of a mortgage-insurance limit in the month it crosses or the month before;
- an exact tie in rate or balance inside a plan;
- a snowball whose answer changes if the order were re-sorted every month;
- a card whose minimum-only payoff takes over 1,200 months (100 years).

The redraw counts are in "Coverage".

### payoff.csv: 28 edge rows (`po-edge-001` to `-028`), then 1,472 random rows (`po-0001` to `po-1472`)

| Rows | What they pin down |
|---|---|
| `-001` | RULES.md example 1. Avalanche 5 months, $31.22; snowball $37.69; plus100 $22.74; baseline 15 months, $98.89; baseline_rollover 13 months, $96.19. The store card is paid off in month 4 and the rest rolls to the bank loan in the same month |
| `-002` to `-004` | one debt; one debt at 0%; a 0% balance that is an exact multiple of the payment (last payment a full one, 0.00 to spare: noted) |
| `-005` to `-007` | a required payment exactly equal to the interest. Never on its own; plus100 finishes. A target stuck at its interest until the other debt is paid (the baseline never). Every debt at its interest: never |
| `-008` to `-010` | a debt paid off in month 1, the rest rolling on the same month; a required payment above what the debt owes; two debts paid off in month 1 (the rollover cascades) |
| `-011` to `-015` | **ties, labelled.** Equal rates entered in both orders, equal balances in both orders, two 0% debts. The figures keep the input order, one valid tie-break (open point 3) |
| `-016` to `-019` | the total owed rises at first, yet the plan finishes (304 months, the longest row; the baseline never); a stuck plan (never) that plus100 rescues; the same debts rescued by a larger extra; a target that grows until the other debt is paid |
| `-020` | a snowball whose answer changes if the order were re-sorted every month. The note gives the re-sorted result: $96.16 of interest against the key's $101.30 (both 6 months, payoffs 6\|4) |
| `-021` to `-028` | five debts; five with a 0% debt; the largest balances with $2,000 extra; a $100 balance at 36% next to $60,000 at 0.01%; a required payment equal to the balance; avalanche = snowball order; rates 0.0001 apart; a non-target debt paid off first, its payment rolling to the target |

Random rows:

- **Debts per row:** 1 to 5, with weights 10/25/25/20/20.
- **Balance:** log-uniform from $100 to $60,000. In cents in 70% of debts, whole hundreds in 20%, whole
  dollars in 10%.
- **APR:** in steps of 0.0001. 0% in 10% of debts, 12% to 36% in 45%, 0.01% to 11.99% in 45%.
- **Required payment:** from 1% of the balance + the first month's interest (rounded up to the cent) up to
  the balance. 75% are 1 to 3 times that floor, 25% log-uniform up to the balance, and 30% are rounded up
  to whole dollars. So a random plan can never be "never"; only edge rows are.
- **Extra:** 0 in 15% of rows, a multiple of $25 up to $2,000 in 35%, log-uniform whole dollars from $1 to
  $2,000 in 50%.

### cards.csv: 25 edge rows (`cc-edge-001` to `-025`), then 975 random rows (`cc-0001` to `cc-0975`)

| Rows | What they pin down |
|---|---|
| `-001` to `-004` | RULES.md example 2. $3,000 at 18%: 268 months, $6,327.77 (cents track $6,327.65), first minimum held level 94 months, $2,586.71. $2,000 at 30%: never. $900 at 30%: 94 months, $1,431.31. The transfer: $451.70 interest, $90 fee, saves $361.70, $257.50 to clear |
| `-005` to `-007` | balance $1,250 exactly (2% = $25), $1,249.99, $1,250.01 |
| `-008`, `-009` | APR 24%: 2% exactly equals the interest (never). APR 23.99% on $1,260: 1,350 months. The cents track gives 1,357 months here, because rounding is as large as the monthly progress (noted) |
| `-010`, `-011` | APR 0 on the default minimum and with a required payment; the transfer saves minus the fee |
| `-012` to `-014` | a required payment below the interest and exactly equal to it (never); one that clears the card in a month |
| `-015` to `-017` | the shortest lawful promotion (6 months), fee 0, fee 5% |
| `-018`, `-019` | no required payment set and balance / promo months ($16.67) under the usual $25 minimum: paid as it is (the floored reading is `bt_interest_with_min_floor`); a required payment above balance / promo months that clears the card inside the promotion |
| `-020` to `-025` | a $100 balance; 36% with the floor above the interest, and below it (never); a first minimum exactly on a half cent (2% of $3,000.25 = 60.005, written 60.01); a $30,000 balance; a 21-month promotion |

Random rows:

- **Balance:** log-uniform from $100 to $30,000. Cents / hundreds / dollars as for the payoff rows.
- **APR:** in steps of 0.0001. 0% in 5% of rows, 12% to 29.99% in 65%, 30% to 36% in 10%, 0.01% to 11.99%
  in 20%.
- **Required payment:** blank (the default) in 54% of draws; 512 of the 1,000 rows end up on the default.
  - In 40% of draws it is the interest + 0.5% to 4% of the balance, at least $25, rounded up to the cent.
  - In 6% of draws it is 30% to 95% of the first month's interest, rounded down to the cent, so never.
  - Then 40% of all set payments are rounded up to whole dollars, which can lift a few of the second kind
    over the interest. 57 of the 481 random rows with a set payment are never.
- **Promo months:** 6, 9, 12, 15, 18, 21, or any of 6 to 21, with weights 10/5/25/20/20/10/10.
- **Fee:** in 60% of rows one of 3%, 4%, 5% or 0. Otherwise 0% to 5% in steps of 0.25%.

### mortgage.csv: 14 edge rows (`mo-edge-001` to `-014`), then 986 random rows (`mo-0001` to `mo-0986`)

| Rows | What they pin down |
|---|---|
| `-001` | RULES.md example 3. 323 months, $203,365.21; with $200 extra 235 months, $140,169.13; every two weeks 269 months, $164,142.23; recast $1,124.57 (fractional $1,125.00); 18 months to 80% of $240,000. The original value of $245,000 is the key's addition |
| `-002` | RULES.md's HPA example: $216,000 at 6%, $1,295.03 on a $240,000 home. 80% after payment 89, 78% after payment 103 |
| `-003` | already below 80% of both values (every MI column 0) |
| `-004`, `-005` | the payment is the 30-year and the 15-year level payment rounded up to the cent. The last payment is $2.12 and $0.02 short of a full one (noted) |
| `-006` | exactly double the 30-year level payment (rounded up) |
| `-007`, `-008` | lump = balance (recast 0); lump 0 (the recast formula re-spreads the balance over the whole months left) |
| `-009` to `-014` | extra 0; 2% on $1,200,000; 9% on $20,000 at about the 5-year payment; a home now worth less than its original value (the page's MI month comes after the HPA one); $2,000 extra; a rate off the 1/8% grid |

Random rows:

- **Balance:** log-uniform from $20,000 to $1,200,000.
- **Rate:** on the 1/8% grid from 2% to 9% in 70% of rows; otherwise 2.00% to 9.00% in steps of 0.0001.
- **Payment:** the level payment for n months, n from 60 to 360 (60-179 / 180-299 / 300-360 with weights
  25 / 35 / 40), times u, rounded up to the cent.
  - u = 1 exactly in 30% of draws. These are labelled `random, scheduled payment`: the scheduled payment,
    whose last payment is a few dollars short of a full one.
  - u from 1.0001 to 1.15 in 28%, and from 1.0001 to 2 in 42%.
- **Extra:** 0 in 20% of rows, a multiple of $50 up to $2,000 in 50%, whole dollars from $1 to $2,000 in 30%.
- **Lump:** 0 in 15% of rows, otherwise whole hundreds from $1,000 to min($100,000, 90% of the balance).
- **original_value:** the balance divided by an LTV of 82% to 97% (80% of rows) or 55% to 81.99%, to the
  nearest $100.
- **home_value:** the original value x 0.92 to 1.10 (70% of rows), 1.10 to 1.50 (20%) or 0.80 to 0.92 (10%),
  to the nearest $100.

## Coverage (from the run)

**payoff.csv**

| | Rows |
|---|---|
| total | 1,500 (28 edge, 1,472 random; 2,297 random draws) |
| debts per row 1 / 2 / 3 / 4 / 5 | 221 / 445 / 362 / 264 / 208 |
| a 0% debt / extra = 0 / a labelled tie | 342 / 239 / 5 |
| avalanche and snowball use different orders | 945 |
| avalanche interest lower than / equal to / higher than snowball | 830 / 667 / 0 |
| avalanche fewer / more months than snowball | 74 / 0 |
| plus100 sooner than avalanche / plus100 finishes where avalanche never does | 901 / 3 |
| baseline and baseline_rollover differ in months | 1,223 |
| never: avalanche / snowball / plus100 / baseline / baseline_rollover (edge rows) | 3 / 3 / 0 / 7 / 4 |
| avalanche: money passes the target in a payoff month | 1,180 |
| avalanche: two or more debts paid off in the same month | 641 |
| avalanche: a non-target debt is paid off before the target | 313 |
| avalanche: some debt paid off in month 1 | 260 |
| longest plan / largest interest | 304 months / $51,200 |
| written amounts exactly on a half cent before rounding | 6 |
| draws redrawn: under $1 to spare / last payment under $1 / tie / snowball re-sort differs / tracks differ | 284 / 265 / 101 / 169 / 6 |

**cards.csv**

| | Rows |
|---|---|
| total | 1,000 (25 edge, 975 random; 1,080 random draws) |
| default minimum / required payment set | 512 / 488 |
| never: default / required | 103 / 59 |
| default: starts at $1,250 or more (2% months, then $25) / $25 floor from the first month | 150 / 259 |
| default: holding the first minimum level would be faster | 147 |
| minimum-only months 1-24 / 25-120 / 121-360 / 361-1,200 / over 1,200 | 333 / 375 / 81 / 48 / 1 |
| APR 0 / APR 24% or more | 37 / 327 |
| transfer payment = balance / promo months / the required payment | 894 / 106 |
| no required payment and balance / promo months under the usual $25 minimum (the contrast pays more) | 122 (115 differ by more than a cent: $0.06 to $43.60 of interest) |
| transfer: card paid off inside the promotion | 120 |
| transfer saves a negative amount (fee above the interest) | 124 |
| promo months 6 / 9 / 12 / 15 / 18 / 21 / other | 110 / 45 / 248 / 200 / 240 / 104 / 53 |
| fee 0 | 173 |
| written amounts exactly on a half cent before rounding | 89 |
| draws redrawn: a last payment within the margin / over 1,200 months / tracks differ | 62 / 30 / 13 |

**mortgage.csv**

| | Rows |
|---|---|
| total | 1,000 (14 edge, 986 random; 1,184 random draws) |
| rate on / off the 1/8% grid | 739 / 261 |
| scheduled payment (a level payment rounded up) | 233 (all with both recast readings within a cent) |
| months left 1-120 / 121-240 / 241-360 | 261 / 430 / 309 |
| extra 0 / lump 0 / lump at or above the balance | 201 / 168 / 1 |
| home value below the original value | 398 |
| already at the limit (0 months): mi / hpa_request / hpa_auto / hpa_request_actual | 377 / 180 / 161 / 180 |
| mi_months earlier / later than hpa_request_actual_months | 466 / 316 |
| 26 half payments: less interest than payment x 13/12 | 1,000 |
| 26 half payments: fewer / more months than payment x 13/12 | 66 / 56 |
| recast: whole-month and fractional readings differ by more than a cent | 757 |
| written amounts exactly on a half cent before rounding | 85 |
| draws redrawn: a last payment within the margin / within $1 of an MI limit / tracks differ | 185 / 9 / 4 |

## CSV columns

Money has two decimals. Months are whole numbers. `never` means the payments never pay the balance off.
`apr`, `rate` and `fee_pct` are fractions (`0.1999` = 19.99%, `0.0300` = 3%). `note` is empty on every
random row; on an edge row it names any margin or track difference.

**payoff.csv**

`case_id, label, n_debts, debts, extra`, then for each of `avalanche, snowball, plus100, baseline,
baseline_rollover`: `_months, _interest, _paid, _payoff_months, _interest_cents_track`, then `note`.

- `debts` is `balance:apr:required` per debt, joined by `|`, in input order (`500.00:0.2400:40.00|300.00:0.1200:30.00`).
- `_payoff_months` gives the month each debt is paid off, by input order (`4|5`). On a never plan every
  field of that variant is `never`.
- `plus100` = avalanche with extra + 100.
- `baseline` = required payments only, nothing rolls over.
- `baseline_rollover` = avalanche with extra 0, freed payments rolling over.

**cards.csv**

`case_id, label, balance, apr, required, promo_months, fee_pct, min_first_payment, min_months,
min_interest, min_paid, min_interest_cents_track, held_min_months, held_min_interest, bt_payment, bt_interest,
bt_interest_cents_track, bt_fee, bt_saves, bt_pay_to_clear, bt_interest_with_min_floor, note`

- `required` blank = the 2% / $25 default.
- `min_first_payment` is the first month's minimum, unrounded until written.
- `held_min_*` (default rows only) is a contrast: the first minimum held level every month.
- `bt_payment` is the first month's max(required, balance / promo months); with `required` blank it is
  balance / promo months.
- `bt_interest` is the old card's interest over the promo months, or until it is cleared if sooner.
- `bt_fee` = balance x fee; `bt_saves` = bt_interest - bt_fee (can be negative); `bt_pay_to_clear` =
  balance x (1 + fee) / promo months.
- `bt_interest_with_min_floor` (`required` blank only) is a contrast: the old card's interest when the payment is
  at least the page's usual minimum, max(2% x the opening balance, $25), that is max($25, balance / promo
  months). Until 2026-10-31 this was the key's `bt_interest`.

**mortgage.csv**

`case_id, label, balance, rate, payment, extra, lump, home_value, original_value, months, interest,
interest_cents_track, extra_months, extra_interest, extra_interest_cents_track, months_saved, interest_saved,
biweekly_payment, biweekly_months, biweekly_interest, biweekly_interest_cents_track, biweekly_months_saved,
biweekly_interest_saved, bw26_half_payments, bw26_months, bw26_interest, recast_payment, recast_saving,
recast_payment_fractional, mi_months, hpa_request_months, hpa_auto_months, hpa_request_actual_months, note`

- `rate` has five decimals.
- `biweekly_*` is the page's model: payment x 13/12 every month. `biweekly_payment` is that amount; the
  exact track uses it unrounded.
- `bw26_*` is a contrast: 26 half payments a year, interest at rate / 26 per two weeks.
  `bw26_months` = ceil(12 x half payments / 26).
- `recast_payment` uses the whole months left at `payment`; `recast_saving` = payment - recast_payment.
  `recast_payment_fractional` is the contrast reading over the fractional months, = payment x
  (balance - lump) / balance.
- `mi_months`: months until the balance after a payment is at or below 80% of `home_value`, paying
  payment + extra (the page; 0 if it already is).
- `hpa_request_months` / `hpa_auto_months`: the same at 80% / 78% of `original_value`, paying `payment` only
  (the initial schedule).
- `hpa_request_actual_months`: 80% of `original_value` at payment + extra (HPA's "actual payments").

## Open points (judgement calls a reviewer should know)

1. **The default minimum is worked out again every month**, from the opening (statement) balance, and the
   $25 floor applies every month. This is the key's decision from Regulation Z: RZM1 (b)(1) uses the account's
   own formula, and RZM2's loop recomputes it each month (re-read for this key, see "Sources"). A required
   payment the person types in is held level. `held_min_*` shows the other reading. On the same $3,000 card
   it is 94 months instead of 268, so an app that holds the first minimum level shows up at once.
2. **Two rounding tracks; rules.py's own cents track is not used.** See "The two rounding tracks".
   rules.py's round_cents functions round some exact half cents down: up to 3 cents on 32 of the 3,500 rows.
   The fix belongs in rules.py, not in the CSVs. This file does not change rules.py.
3. **The target order is set once at the start, and the figures put a tie in input order.** No source decides
   either. The input order is one valid tie-break, not a rule: the payoff page sorts a tie by the debt's name,
   which is just as valid (found on verification, 2026-10-31). So a tie row checks an app only where its tie
   order is the input order. The test names the debts "Debt 1".."Debt n" in input order. In its renamed part,
   where the names run the other way, it does not compare a method whose order has a tie. Random rows have no
   exact ties and no rows where a monthly re-sort would change the answer (169 draws redrawn). `po-edge-011` to
   `-015` and `-020` show both.
4. **The budget is fixed**: every required payment + extra, every month. In a payoff month the money left
   goes down the order in the same month, so it can finish several debts at once.
5. **Two baselines.** `baseline` is required payments only with nothing rolling over, the key's reading of
   "the baseline pays required payments only". `baseline_rollover` is avalanche with extra 0 and the freed
   payments rolling on. They differ in months on 1,223 rows.
6. **"Never" for a plan** is decided exactly, phase by phase: never when no open debt's payment beats its
   interest. A never plan writes `never` in every field of that variant, the payoff-month list included, even
   if some debts would be paid off first. Random plans cannot be never, because every required payment is at
   least 1% + interest. Never appears only in edge rows.
7. **Balance transfer.** The promotional rate is 0%, and the fee is added to the new balance.
   - balance / promo months is worked out from the starting balance.
   - With no required payment set, the payment is balance / promo months. That is the page README's
     max(required, balance / promo months) with nothing set; no source sets a floor for this comparison.
     Until 2026-10-31 the key floored it at the page's usual minimum (2%, at least $25), which is
     max($25, balance / promo months) because 2% of any balance in the promotion is below balance / promo months
     (promo months < 50). The verification found that this was the key's reading, not the README's or a
     source's. That reading is kept as the contrast `bt_interest_with_min_floor`. Random rows are still
     redrawn on its margins too, so the rows are the same as before. Whether "staying put" should pay at least
     the usual minimum the page shows for the same card is the owner's call (RULES.md section 5, item 9).
   - If the old card is cleared inside the promotion, interest stops there.
   - The fee has no fixed-dollar minimum (CFPBCT says real fees often have one).
   - Promo months are 6 to 21 (RZ55).
8. **Recast** uses the whole months left at the current payment, without the extra (RULES.md). A lump at or
   above the balance gives 0. Lump 0 still gives the formula's value. The fractional reading is written beside
   it: on scheduled-payment rows the two agree within a cent, elsewhere they differ (757 rows).
9. **Every two weeks.** The page's 13/12 model is credited every month: unrounded on the exact track, rounded
   to the cent on the cents track. The `bw26_*` contrast is a "true biweekly" loan, with interest every two
   weeks at rate / 26 and 26 half payments a year. It always saves more interest than 13/12 (1,000 of 1,000
   rows), and its month count can come out on either side. No servicer rule was modelled (RZ36 lets a servicer
   hold half payments).
10. **Mortgage insurance.**
    - Months count the first month whose closing balance is at or below the limit (0 if already there).
    - The HPA columns take today's balance and `payment` as the initial schedule, because the row has no
      original loan amount or term. For the same reason the midpoint date (HPA 4902(c)) is not computed.
    - The HPA's other conditions are not modelled: a written request, payment history, the value not having
      fallen, FHA / VA exclusions.
    - Fannie Mae's current-value rules (75% / 80% by seasoning) are not computed. The page's `home_value`
      reading is written as the page says.
11. **Margins, not tolerances.** Random rows are redrawn rather than kept when they sit within $1 (or 1%) of a
    month boundary, or within $1 of an MI limit. So a correct app should match every month count exactly.
12. **Card months cap.** Random cards whose minimum-only payoff takes more than 1,200 months are redrawn (30
    draws). `cc-edge-009` keeps one, at 1,350 months.
13. **Inputs the brief left open:** the card balance range ($100 to $30,000), the APR mixes, the share of
    cards with a required payment, the promo-month and fee mixes, the mortgage's 30% scheduled payments, the
    original LTV and the home-value spread. All are listed under "The generator".

## What the key leaves out (on purpose)

Daily interest, grace periods, statement dates and leap years; new purchases, fees and penalty rates;
issuers' real minimum formulas (for example 1% + interest); Regulation Z's statement wording (years, the
36-month payment) beyond what `rules.py` already checks; promotional rates above 0%, deferred-interest
offers and fixed-dollar transfer fee minimums; variable-rate and interest-only mortgages, escrow, taxes and
insurance premiums; recast fees and minimum lump sums; servicers holding half payments; the HPA midpoint,
high-risk loans (77%), FHA / VA / USDA insurance and Fannie Mae's current-value rules; snowball orders that
are re-sorted every month.
