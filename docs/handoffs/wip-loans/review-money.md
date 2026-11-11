# Loans lane 1: money review

claude-b reviewer, 2026-11-07. Patch `scratchpad/loans/patch.diff` applied on c804ed0 in `scratchpad/wloansr1`. The base for comparison was a
second c804ed0 worktree. Both worktrees are now removed. Scripts are in `scratchpad/loans/rv/`. Nothing was committed or pushed.

## Verdict: not ready to merge. Fix D1, D2 and D3 first.

What works, checked by hand:
- **One payoff.** Debts' payoff equals my own amortization, `n = -ln(1 - r*B/P)/ln(1+r)` on the payment less tax and insurance,
  for every household below.
- **Debts and the retirement figure agree.** Get started's retirement figure and Will the money last? use the same payoff as
  Debts. The bought grid (`bought/v2/oneanswer.mjs`) shows `retirementDisagrees` 68 at base and 0 with the patch.
- **The engine rows match the hand formula** to the dollar:
  - the base, that is spending less the loan part, rises with prices;
  - the loan part is fixed and stops at payoff, with `lastMonths/12` paid in the payoff year;
  - tax and insurance stay in the spending and keep rising.
- **The 25-year-old couple stays at June 2054** (331 months) after "Keep" on both figures, and after typing the same two figures on Get
  started. The rate stays at 6.7%.
- **Typed plans did not move.** Over the 1,400 qa plans compared with c804ed0:
  - Debts months: 0 moved;
  - Home page cost totals: 0 moved;
  - mortgage months: 0 moved.
- **Unanswered plans with both figures typed** read exactly as at base.
- **The escrow question's three answers work in the plain case.** Example: $200,000 typed, $1,600 typed, rate 4.6%.

  | Answer | Months (app = hand) |
  |---|---|
  | No | 171 |
  | Yes, $400 typed | 267 |
  | Yes with no figure, or Not sure ($463.99, our guess) | 294 |

- **The P&I cap works where it was asked.** Principal and interest against the purchase loan's: 61 is 0.99, 66 is 1.00, the
  Florida widow (72) is 1.00, 80 is 0.99.
- **The Home page lists the tax and insurance once.** For the 25-year-old couple: $3,302 + $1,253 = $4,555 = $379.63 x 12.
- **Edge cases that behave:**
  - a 0% loan pays off in owed / payment months;
  - a loan with no rate is read as 0%;
  - a paid-off loan (owed $0) is left out;
  - a payment below the interest runs to the plan's end as a fixed amount;
  - a loan ending the month work stops (120 months) is left out; at 121 months it is counted.
- **The tools pass.**
  - `npm test`: 188,424 pass, 1 fail, 627 todo. The failure is the timing test "verify 5, C" in transactions/ledger (1,772 ms
    under load). It passes alone and has nothing to do with this patch.
  - `npm run check`: OK.
  - The leak guard: OK.

What is wrong, most harmful first:

| # | Defect | New with this patch? | Size |
|---|---|---|---|
| D1 | A retirement figure the person types loses every loan's payoff. Hard rule `sr.verdict.monotone` goes from 3 to 57 failures | yes | high |
| D2 | "Keep" on the balance moves the payment, and "Keep" on the payment moves the balance (item 4's cap) | yes | high |
| D3 | The P&I cap overrides a loan start and term typed on Debts. A typed start long ago makes a $4,840 payment | yes (items 4 and 7) | high |
| D4 | A rental's loan still rises with prices while it runs (item 1 not done for rentals) | not fixed | medium |
| D5 | A guessed tax and insurance can stretch a typed loan to 40-55 years, and a kept one moves later | yes | medium |
| D6 | The answer on one mortgage changes another (one shared tap). "Yes" can be dropped without a word | yes | medium |
| D7 | Tax and insurance typed above half the payment are cut to half without a word | yes | medium-low |
| D8 | A typed mortgage that never answered the question: at payoff, its tax and insurance leave retirement spending too | yes (owner's call) | medium |
| D9 | The full guess sanity sweep does not match the report: HD-ESCROW-ONCE 157 (not 0), loans-end 1, and 3 more regressions | qa | low |
| D10 | The "running when work stops" gate is all-or-nothing, by whole years of age | old | low |
| D11 | Pages that read `spending.yearly` directly still treat loans as lifelong | old | low |

## The five households, by hand

Today is 2026-11-07. `nper` is `-ln(1 - r*B/P) / ln(1+r)`, with r the monthly rate, B the balance and P the payment less tax and
insurance. Prices rise 3% a year (priceLevel 1.03^years). Every household was built by `qa/guess-sanity.mjs walk`, which runs Get
started's own apply functions; the rental is `qa/fixtures/round8-rental.mjs`.

### 1. Couple aged 25, Ohio, $45,000 each, nothing typed

- **Debts:** $210,000 at 6.7%, payment $1,770, tax and insurance $379.63, so $1,390.37 pays the loan.
  - r*B = 0.0055833 x 210,000 = 1,172.50
  - n = -ln(1 - 1,172.50/1,390.37) / 0.0055678 = 1.8534 / 0.0055678 = 332.9, so 333 months: **2054-08**. App: 333, 2054-08.
- **When work stops:** in 480 months (2066). The loan is paid off before then, so it is not in the figure. Only its $379.63 of tax and
  insurance goes on.
- **Retirement figure:** 3,560 + 379.63 = 3,939.63, so **$3,940**. App: 3,940. Base: 3,560, because the base left the tax and
  insurance out for life.
- **Engine:** spendingReal in 2066 is 47,280 = 3,940 x 12. Verdict on track both ways.
- **Keep:** the bought verify's version of this couple (`bought/v2/lib.mjs` household, $60,000 pay) stays at 331 months, June 2054,
  after Keep on both figures and after typing the same two figures. Base: 199 months (2043-06) after Keep.

### 2. Couple aged 50, Ohio, $80,000 + $70,000, nothing typed

- **Debts:** $150,000 at 4.3%. The payment is $1,290, down from $1,380 at base because of item 4's cap. Tax and insurance $463.99,
  so $826.01 pays the loan.
  - r*B = 537.50
  - n = -ln(1 - 537.50/826.01) / 0.0035769 = 1.05187 / 0.0035769 = 294.1, so 295 months: **2051-06**. App: 295, 2051-06.
  - Base: 248 months, 2047-07.
- **When work stops:** in 180 months (2041-11). The loan is still running, so its payment counts as a fixed $826.01 x 12 = $9,912 a
  year in 2041-2050, and 6/12 of that in 2051. The $463.99 stays and rises.
- **Engine:** the figure is $5,150 (the from-50 ledger figure); $61,800 a year less $9,912 = $51,888 in today's dollars.

  | Year | Working | App |
  |---|---|---|
  | 2041 | 51,888 x 1.558 + 9,912 = 90,753 | 90,752 |
  | 2051 | base + 4,956 = 113,598 | 113,598 |
  | 2052 | 51,888 x 2.1566 = 111,901 | 111,901 |

### 3. Florida widow, 72, retired, nothing typed

- **Debts:** $100,000 at 5%, payment $1,540 (base $1,730). Tax and insurance $539.87, so $1,000.13 pays the loan.
  - n = -ln(1 - 416.67/1,000.13) / 0.0041580 = 0.53893 / 0.004158 = 129.6, so 130 months: **2037-09**. App: 130.
  - The purchase loan (2005) has a P&I of about $995. The old P&I was pmt(5%/12, 104 months, 100,000) = $1,186.7. The ratio goes
    from 1.20 to 1.00.
- **Spending:** she is retired, so spending is today's bills from Expenses: $47,040 a year. The loan part is $1,000.13 x 12 =
  $12,002; the base is $35,038, which includes her $6,478 a year of tax and insurance.

  | Year | Working | App |
  |---|---|---|
  | 2026 | 35,038 + 12,002 = 47,040 | 47,040 |
  | 2037 | 35,038 x 1.3842 + 12,002 x 9/12 = 57,503 | 57,503 |
  | 2038 | 35,038 x 1.4258 = 49,956 | 49,956 |

- **Verdict:** short in 2030 both ways. Affordable spending goes from $10,613 to $16,796.

### 4. Single, 45, Ohio, $60,000, whose mortgage ends after work stops

- **Debts:** $110,000 at 4.4%, payment $930 (base $950). Tax and insurance $309.33, so $620.67 pays the loan.
  - n = -ln(1 - 403.33/620.67) / 0.00366 = 286.7, so 287 months: **2050-10**.
- **When work stops:** in 240 months (2046-11), so the loan is still running. The base read it as paid in 162 months (nper on the
  whole $950) and left out both the payment and the tax and insurance.
- **Retirement figure:** 2,390 + 930 = **$3,320**. App: 3,320.
- **Engine:** the base is (2,390 + 309.33) x 12 = $32,392.

  | Year | Working | App |
  |---|---|---|
  | 2046 | 32,392 x 1.8061 + 7,448 = 65,951 | 65,951 |
  | 2050 | 32,392 x 2.0328 + 7,448 x 10/12 = 72,053 | 72,053 |
  | 2051 | 32,392 x 2.0938 = 67,822 | 67,822 |

- **Verdict:** tight at base, short in 2062 with the patch. The base left out about $11,000 a year for four years and $3,712 a year of
  tax and insurance for life, so the new verdict is the truer one.

### 5. The rental household (`condoOnNetWorthPlan`)

- **Condo loan:** $150,000 at 4.5%, $851 a month.
  - n = -ln(1 - 562.5/851) / 0.0037430 = 289.0, so 289 months: **2050-12**.
- **Home mortgage:** $250,000 at 3.5%, $2,350 a month, so 127.55, or 128 months: 2037-07. It is paid off before work stops (2045-11).
  Both figures are typed, so no tax and insurance are taken out.
- **Retirement figure:** $5,200 = 4,350 + 851, rounded. The $300-extra variant pays off in 180 months (2041-11), before work stops, so
  its figure is 4,350. Both agree with Debts.
- **Still wrong (D4):** the condo loan's $851 is still carried rising with prices from 2045 to 2050, then given back as a rising "loan
  back" income from 2051. See D4 for the cost.

## Defects

### D1. A retirement figure the person types loses every loan's payoff (high; new; hard rule)

**Where:** `retirement/projection buildInputs`. `carriedLoans` is set only when the figure is Get started's own (`retireAuto`) or
today's bills. Typing a figure turns `retireAuto` off, through `saveSpendingFigure`, Get started's retirement box (setup compute.js
line 1546) or the Compare lever. From then on, the loans that Get started's figure, and the box showing it, still hold are spent for
life, rising with prices.

**Inputs:** the 45-year-old above (`rv/mono.mjs`). Retirement spending is lowered by $100 a month, from $3,320 to $3,220.

**Expected:** the verdict is no worse than "short in 2062". The figure still holds the $930 mortgage, which the page says ends in 2050.

**Actual:** short in 2056, six years sooner, and `inputs.loans` is empty. The grid's g1020 (45, Texas, payment $910 typed) goes from
tight to short in 2069.

**Full sweep:** `sr.verdict.monotone` (hard), part "-$100 a month in retirement": 0 of 252 failures at base, 53 of 252 with the patch.
The rule's total goes from 3 to 57. `npm test` does not run this part.

**Fix:** keep `spendingLoans(setupLoans)` for a typed figure saved from a screen that showed it holding those loans. Two ways:
- record the loans' account ids when the figure is saved (`retirement.loansHeld`, an optional field: add it to `docs/DATA_MODEL.md`),
  and use them while they still exist;
- or, more simply, apply `setupLoans` to any typed figure at least as large as their payments.

Under the box, say: "This holds your mortgage's $X a month until 2050; it stops then." Add a failing-first test: o45, -$100, no worse.

### D2. "Keep" on one figure moves the other (high; new from item 4 with Keep)

**Where:** the item-4 cap in `debt.mortgage.payment` runs only while the balance is ours (`!owed.typed`). `debt.mortgage.owed`, working
the balance back from a typed payment, still uses the purchase loan's months left, so it gives back the purchase loan's balance, not
our blended one. "Keep" (confirmGuess) turns the figure into a typed one, and settle then guesses the other figure again.

**Inputs:** bought verify households (`rv/keepgrid.mjs`, `rv/kg2.mjs`, `rv/keep.mjs`). 112 households: ages 20-85, single and couple,
OH/FL/CA/TX, nothing typed.

**Expected:** Keep never moves another figure. At base: 7 and 3 moves, all from $10 rounding (at most $40, or $1,000 of balance).

**Actual:**

| Action | Households moved | Worst cases |
|---|---|---|
| Keep the balance | 70 of 112 | widow, 72 FL: payment $1,540 → $1,730, payoff 2037-09 → 2035-07; 85 CA: $1,740 → $2,430, 2036-11 → 2032-08 |
| Keep the payment | 58 of 112 | widow: balance $100,000 → $84,000, payoff 2035-07; 60-year-old couple FL: $140,000 → $100,000, 2054-05 → 2042-07 |

**Working, for the widow:**
- *Keep the balance.* Once the balance is typed there is no cap, so the payment is pmt(5%/12, 104, 100,000) = $1,186.7, plus $539.87
  = $1,726.6, which rounds to $1,730.
- *Keep the payment.* The P&I is $1,540 - 539.87 = $1,000.13. Then pv(0.0041667, 104, 1,000.13) = 1,000.13 x 84.27 = $84,280, which
  rounds to $84,000.

**Fix:**
- (a) Apply the cap whenever the balance, typed or kept, is above the purchase loan's: a refinance restarted the clock either way.
- (b) Work the balance back from a typed payment with the same capped rule. The payment is flat at the purchase loan's P&I between
  that loan's balance and `pv(r, 360, bought.pi)`.
  - A typed P&I within the $5 rounding of `bought.pi` keeps the no-payment balance guess, clipped to that band.
  - A P&I above it uses `pv(r, 360, pi)`.
  - A P&I below it uses `pv(r, left, pi)`, as now.
- Test: Keep the balance, then Keep the payment, on the widow and on the 60-year-old FL couple. Neither figure and neither payoff
  moves.

### D3. The P&I cap overrides a loan start and term typed on Debts; a start long ago gives a huge payment (high; new from items 4 and 7)

**Where:** `startOf` returns `via: "loan"` from `debts[].startDate` and `termMonths` (item 7). The item-4 cap still runs on that start.
And `via: "loan"` has no "too long ago" rule like a typed purchase year has (`longAgo`, which falls back to `stale`).

**Inputs** (`rv/start.mjs`, nothing else typed unless said):

| Household | What the person typed | What the app shows | Expected |
|---|---|---|---|
| 45, Ohio | Debts start 2015-06, 360 months | $87,000, $790, 3.9%; Debts **274 months, 2049-09** | ends by 2045-06 at the latest. pmt(3.9%/12, 223, 87,000) = $548.8 of P&I; the cap gave about $481 |
| 60, Ohio | Debts start 1999-01, 360 months | card: "loan 1999, 2.2 years left"; Debts: 78 months (2033-05) | one answer, not two |
| 45, Ohio | balance $150,000, Debts start 2000-01 | **$4,840 a month** at 8.1%, 38 months. Base: $1,220 | not a payment four times the usual |

For the third row: 360 - 322 = 38 months left, so pmt(8.1%/12, 38, 150,000) plus tax and insurance.

**Fix:**
- No cap when `start.via === "loan"`: the current loan's start is known, and its term sets the months.
- Treat a Debts start as stale (counted from our guess for the age, and said so) when the balance is above what that loan, at its
  term, would still owe. Use the same `longAgo` test as for a typed purchase year.

### D4. A rental's loan still rises with prices while it runs (medium; item 1 not done for rentals)

**Where:** `buildInputs` passes `skip: rentalLoanIds` to `spendingLoans`. `rentalLines` keeps the old treatment: the payment stays in
spending, rising with prices, and comes back after payoff as a "loan back" income that also rises with prices (`cola: true`).

**Inputs:** `condoOnNetWorthPlan`. The condo loan is $851 a month until 2050-12 (`rv/rental.mjs`).

**Expected:** a fixed $10,212 a year in 2045-2050, then nothing.

**Actual:** $851 x 12 x priceLevel. The overstatement is $10,212 x (priceLevel - 1):

| Year | Overstated |
|---|---|
| 2045 | $7,695 (patch $109,419 against $101,724 fixed) |
| 2050 | $10,547 |
| Total, 2045-2050 | **$54,557** ($28,777 in today's dollars) |

Engine runs confirm the totals. From 2051 the "loan back" cancels it exactly. The full guess sanity sweep still fails
`sr.verdict.loans-end` on this one fixture (spendingReal 62,400 before and after 2050).

**Fix:**
- Stop skipping rental loans in `spendingLoans`.
- In `rentalLines`, drop the "loan back" line when `spendingLoans` carries the loan. Keep "loan rest", which is already fixed
  nominal, for the part of the payment beyond what the spending holds.
- The payoff year then gets `lastMonths`, as other loans do.
- Update the rental tests: coverage and the "loan back" rows.

### D5. A guessed tax and insurance can stretch a loan to 40-55 years, and a kept one moves later (medium; new)

**Why:** the only guard on a guessed `escrowMonthly` is that what is left must be more than the month's interest. When the P&I left is
just above the interest, a small change in the guessed tax and insurance moves the payoff by decades.

**(a) "Not sure", or "Yes" with no figure, on a typed balance and payment** (`rv/unsure.mjs`). 90 households: our own guessed balance and
rate typed, with the payment typed at 85%, 90% or 100% of our guess.

| Result | Households |
|---|---|
| over 360 months | 33 |
| over 480 months | 14 |

Example: 25, Texas, $230,000 at 6.7%, payment $1,850, "Not sure":
- tax and insurance $531, so P&I $1,319;
- interest $1,284;
- 651 months, **2081**.

Working: -ln(1 - 1,284.17/1,319) / 0.0055678 = 651.

**(b) Typed on Debts: "Yes, $400"** with $230,000 at 6.7% and a $1,700 payment gives **792 months (2092)**. "Yes" with no figure on the
same loan writes nothing, because the usual $394-plus leaves no more than the interest. The answer then shows as "Choose one" again
(see D6).

**(c) A kept tax and insurance moves later.** After Keep, `escrowMonthly` is a live guess (`debt.mortgage.escrow`), so settle works it
out again when another figure changes. The 25-year-old couple keeps all three figures, then types a home value 1.5 times ours:

| Step | Tax and insurance | Payoff |
|---|---|---|
| after Keep | $393.69 | 2054-06 |
| home value 1.5 times ours | $590.53 | **2077-06** (607 months) |
| home value 1.1 times ours (by hand) | +$39 | +27 months |

The 50/49 couple goes from 2047-07 to 2059-08, and the widow from 2035-07 to 2039-01.

**Expected:** a guessed tax and insurance never makes the loan run longer than its term left (360 months when unknown). A figure kept
with a payment the person agreed to does not move later.

**Fix:**
- Cap every guessed tax and insurance at `payment - pmt(r/12, termLeft or 360, owed)` (0 if that is negative). In (a) that is
  $1,850 - $1,484 = $366, which gives 360 months.
- Freeze a kept figure: write it as a guess entry that is not worked out again (settle's frozen S6 path), or as the person's own.
- Add the 360-month bound to `HD-ESCROW-GUESS`.

### D6. The escrow answer on one mortgage changes another; "Yes" can be dropped without a word (medium; new)

**Where:** `answerEscrow` writes the plan-wide tap `guide.setup.taps.escrow` for every mortgage. `loanEscrow` and the payment
estimator read that tap for every mortgage that has no `escrowMonthly`.

**Inputs:** Get started's guessed home mortgage, plus a lake cabin mortgage typed on Debts ($100,000 at 5%, $900; `rv/two.mjs`).

**Expected:** an answer about the cabin's loan changes only the cabin's loan.

**Actual:**
- On the cabin, "No, I pay them myself" makes the **home's** guessed payment drop from $1,180 to $790. Its $394 of tax and insurance
  leaves the payment and the monthly spending.
- On the cabin, "Yes" with no figure writes nothing. `escrowMonthly` cannot find the cabin's home, so it falls to 0 and the field is
  deleted. The select shows "Choose one" again and the payment is read as all loan.

**Fix:**
- Write the tap only for Get started's own mortgage (`setup-debt-mortgage`).
- When no usual figure can be worked out, keep the answer and ask for the figure: "We couldn't work out the usual amount: type the
  tax and insurance from your statement." Do not turn "Yes" into "no answer".

### D7. Tax and insurance typed above half the payment are cut to half (medium-low; new)

**Where:** `loanEscrow` returns `min(escrowMonthly, payment/2)` for a typed figure too. Get started's `escrowFor` floors the P&I at half
the payment the same way. This often hits older owners: the P&I is fixed from long ago while tax and insurance have risen.

**Inputs:** 62, Florida, $30,000 at 6%, payment $1,600, "Yes, $900" (`rv/half.mjs`).

**Expected:** $700 pays the loan, so n = -ln(1 - 150/700) / 0.0049875 = 48.4, or 49 months (2030-12).

**Actual:** $800 pays the loan: 42 months (2030-05). The tax and insurance that go on after payoff are $800, not $900.

**Fix:** cap a figure the person typed only at the payment. When what is left does not cover the interest, say so on Debts.

### D8. A typed mortgage that never answered: its tax and insurance leave retirement spending at payoff (medium; owner's call)

**What happens:** "Typed and unanswered: nothing moves" holds on Debts. But retirement spending now removes the **whole** typed payment
at payoff, including the property tax and insurance it most likely holds (SCF 2025: 56% of payments do). Before, the whole payment
stayed for life.

**How common:** 697 of the 798 qa plans with a mortgage have no property tax or home insurance bill on Expenses. For them, retirement
spending after payoff now holds no property tax at all.

**Example:** H-0801. Its $1,100 mortgage leaves spending in 2030-07. If about $350 of that is tax and insurance, retirement spending is
about $4,200 a year (today's dollars) too low from 2031 on.

**Fix (retirement only; Debts unchanged):**
- For a typed mortgage on the home lived in, with no answer and no tax or insurance bill, keep the usual tax and insurance (capped at
  half the payment) in spending after payoff. In `spendingLoans`, `inBase` becomes the payment less that, and `escrowAfterPayoff` does
  the same.
- Say it on Will the money last?. Or ask the escrow question for these plans.

### D9. The full guess sanity sweep does not match the report (low; qa)

I ran `node qa/guess-sanity.mjs --rules <19 loan and spending rules>` on both trees: 1,574 mortgage households plus the 1,400 qa plans.
Results are in `rv/gs-wloansr1base/` and `rv/gs-wloansr1/`.

| Rule | Base | Patch | Why |
|---|---|---|---|
| `sr.verdict.loans-end` | 513 | **1** | the rental fixture (D4). The report says 0, which is true only of the test grid |
| `HD-ESCROW-ONCE` (hard) | 1,574 | **157** | a qa artifact. The Household takes the usual tax and insurance uncapped, but the app caps it at half the payment. Example g12: Texas, typed payment $500. The app uses $250 a month on both Debts and Home ($3,000 a year); the rule expects $4,775. Fix: `Household` should read `loanEscrow` |
| `sr.verdict.monotone` (hard) | 3 | **57** | D1 |
| `HD-AMORT-IDENTITY` (hard) | 426 | 442 | +16 mortgages: the rule does not know the item-4 cap. Update it as `tests/home-purchase.test.mjs` was |
| `HD-HOME-YEARS-IN` (soft) | 59 | 117 | the years in the home are implied from the longer payoff |
| `HD-MONO-AGE` (soft) | 1 | 2 | years left go from 24.25 to 25.5 between ages 42 and 43 |
| `HD-MORT-RATE-VINTAGE` (soft) | 928 | 936 | |
| `HD-MORT-YEARS-LEFT` (soft) | 301 | 229 | better |
| `pt.bought.payment-vs-pay` | 87 | 85 | better |
| `HD-ESCROW-GUESS` | – | 0 | new rule |

### D10. The "running when work stops" gate is all-or-nothing (low; old)

`loansThen` and `setupLoanParts` use `until = (retirement age - whole age) x 12`. So a loan is either fully in the figure or fully out.

Example: born 1971-03, work stops 2036-03.

| Loan ends | In the figure? | Payments counted in 2036 | Truth |
|---|---|---|---|
| 2036-11 (120 months) | no | none | 8 months of payments after work stops |
| 2036-12 (121 months) | yes | 12 months | |

The 121-month loan raises Get started's figure by $1,000. A household with one adult already retired starts retirement now in the
engine, but its figure leaves out loans that end before the working adult stops.

**Suggestion:** carry every loan whose payoff is after January of the retirement year, with `lastMonths` for the payoff year.

### D11. Pages that read `inputs.spending.yearly` directly treat loans as lifelong (low)

These are:
- Annuities `guaranteedShare`;
- withdrawal-strategy `planned`;
- sensitivity and inheritance `spendingMonthly`;
- the FIRE target.

Will the money last?'s own coverage uses the engine row. The builder listed FIRE and Goal seek; Annuities' share is the one that gives
a second answer.

## For claude-a's pages (message; not edited)

- **cashflow/statement:** a mortgage row counts the whole payment as debt service. The part that is tax and insurance should be a living
  cost. Read `balance/liabilities` rows' `escrow`, or `loanEscrow`, which reads `debts[].escrowMonthly` first.
- **balance/projection:** no code change, but its mortgage-free year moves:
  - with item 4's new guessed payments: for example the widow's 2035 becomes 2037, and a 60-year-old couple in Florida becomes 2054;
  - with kept tax and insurance.
- **goals/\* pages that read the leftover:** the guessed mortgage payment falls for owners 50 and over (for example $1,730 to $1,540),
  so their leftover rises.
- **debt/consolidation:** leaves mortgages out, so it is not affected.
