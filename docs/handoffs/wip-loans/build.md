# Loans lane 1: a loan's payment ends at its payoff, and the tax and insurance in a mortgage payment count once

claude-b, 2026-11-07. Base c804ed0. Built in `scratchpad/wloans`. Nothing was committed or pushed.
Patch: `scratchpad/loans/patch.diff` (`git diff --cached --binary c804ed0`, without planner.properties and data): 36 files, +1,215 / -180.
All households are invented: Get started builds, the qa fixtures and the qa households.

## Results per item

### 1. Retirement: a loan's payment counts only until its payoff, as a fixed amount
- **Before:**
  - Get started's retirement figure and Will the money last? carried a loan's whole payment for life, and raised it with prices.
  - "Running when work stops" was tested with `nper` on the whole payment, so the tax and insurance were counted as loan.
  - Guess sanity `sr.verdict.loans-end` failed on 3 of 3 households (KNOWN 3).
  - The bought grid (`bought/v2/oneanswer.mjs`): 68 of 448 households where the retirement figure and Debts disagree.
- **After:**
  - One payoff is used everywhere: `balance/liabilities loanMonths` (`ceil(nper(rate/12, payment + extra - escrow, owed))`).
  - Callers that use it: overview/setup `loansRunningThen` and `escrowAfterPayoff`, retirement/projection `setupLoans`, the new `spendingLoans`, a rental's loan in `rentalLines`, and qa `sr.verdict.loans-end`.
  - The engine (`core/math/retirement.js`) has a new input, `loans: [{ yearly, inBase, untilYear, lastMonths }]`:
    - the spending less `inBase` rises with prices;
    - each loan adds a fixed `yearly` in retired years, `lastMonths/12` of it in its payoff year, and nothing after;
    - with fixed-real and guardrails only (guardrails adds it on top and never trims it);
    - with no loans the rows are identical to before.
  - After payoff, a mortgage's tax and insurance stay in the spending and rise with prices.
  - **Results:**
    - `sr.verdict.loans-end`: 0 failures (fast grid, all checks pass).
    - oneanswer grid: `{"households":448,"withIssues":0,"retirementDisagrees":0}`.
    - Test grid of 108 Get started households (ages 20-60, OH/CA, nothing / payment / owed typed): running == Debts, and `setupFigure == retireDefault`.
- **Page:** under "Spending in retirement", Will the money last? says: "...holds Mortgage's $1,939 a month until 2045 (a fixed amount, not raised for prices; its $661 of tax and insurance goes on after)" (shot 5).

### 2. "Keep" on Our guesses, and the same figure typed, keep the tax and insurance
- **Before:** the couple aged 25 kept the balance and the payment. Escrow went to 0 and Debts showed 199 months (June 2043) instead of 331 (June 2054). `before/keep.txt`.
- **After:**
  - `escrowBefore` and `escrowKept` (home.js) write `debts[].escrowMonthly` = 393.69, still marked as our guess (key `debt.mortgage.escrow`).
  - Callers: the Keep and Save buttons on Our guesses, the Debts save, and Get started.
  - Results: Debts 331 months (June 2054) whether the person keeps the balance only, keeps both figures, or types the same two figures on Get started (`after-keep.txt`).
  - Get started typing the shown figures also keeps the guessed rate (6.7%; before, it was re-guessed as 4.6%).

### 3. Is the tax and insurance in a payment typed from a statement? Asked once
- **Debts** (mortgage details, not a rental's loan) asks "Does this payment include property tax and home insurance?" with a select:
  - "Yes, the lender pays them from it (the usual)";
  - "No, I pay them myself";
  - "Not sure";
  - plus the box "Of that, tax and insurance a month (if you know it)".
- **Get started 5b** asks the same question under "Paid a month", once a payment is typed, with three pills: Yes / No, I pay them myself / Not sure.
  - The help line says most mortgages include them through an escrow account.
  - "Of that, tax and insurance a month" shows under Yes.
- **What each answer writes:**
  - Yes with a figure: `escrowMonthly` = that figure.
  - No: 0.
  - Yes with no figure, or Not sure: the usual figure, marked as our guess.
- Get started's grey balance follows the answer: with No, the whole payment pays the loan.
- **Plans that typed both figures and never answer:** nothing is written, and Debts reads them as before (tested).

### 4. Older owners' guessed payment
- **Rule:** when our balance is above what the purchase loan would owe now, the principal and interest is capped:
  - `pi = min(pi, max(bought.pi, pmt(rate/12, 360, owed)))`;
  - the months then come from `nper`.
- **Results (P&I against the purchase loan's own P&I, before → after):**

| Owner | Before | After | Payment before → after |
|---|---|---|---|
| Age 61 | 1.14 | 0.99 | — |
| Age 66 | 1.16 | 1.00 | $990 → $900 |
| Florida widow, 72 | 1.20 | 1.00 | $1,730 → $1,540 |
| Age 80 | 1.43 | 0.99 | $1,170 → $920 |

- The payoff dates now come later. Example: age 80, July 2032 → September 2035 (`after-oldpi.txt`).
- Jordan (41, payment blank): $920 → $910. The tap "before 2010" with a blank payment: $1,200 → $920.

### 5. Year taps respect age
- `tapSpan` and `mortgageAsk` offer and read a span only from the year the oldest adult was about 20 (`YOUNGEST`).
  - A span that starts earlier is cut to that year.
  - A span that ends before that year is dropped. Example: age 25 and "2010 to 2019" gives null, and the options are 2020-21 / 2022 or later / Not sure.
- The car loan's taps follow the same rule: "5 or more years ago" needs age 25 or older.
- The mortgage page's refinance buttons use the same list (`startChoices`).
- Jordan (41), "before 2010": read as 2005-2009 at 5.9%, owed $76,300 (was 2000-2009 at 6.3%, $74,900).

### 6. The Home page counts the tax and insurance in the payment once
- **Before:** `HD-ESCROW-ONCE` failed on 9 of 18 (KNOWN 9). The Home page listed $0 tax and $0 insurance beside a payment that held them.
- **After:**
  - The lines read "Property tax, in your mortgage payment $3,424" and "Home insurance, in your mortgage payment $1,300". Together that is $393.69 x 12.
  - The page notes they come out of the payment and are counted once (shot 4).
  - `HD-ESCROW-ONCE`: 0 failures.

### 7. Smaller items
- **A 2- or 3-digit year** in Get started's year box (questions 4b and 5b):
  - Once the box is left, it gets the same words as 2027: "We can't use 20. Type the year as four digits between 1950 and 2026, like 2019, or leave it blank."
  - Continue waits once (shot 3).
- **"Mortgage insurance" stat:** shown only above 80% owed (`pmi.applies`).
  - Source: Homeowners Protection Act, 12 U.S.C. 4901-4902 (cancel on request at 80% of the original value, automatic at 78%), read 2026-11-07.
- **Home page "We use it to work out the mortgage's years left":** shown only when used (`yearUsed`).
- **Rate with both figures typed:** a purchase year typed no longer moves a guessed rate when the balance and payment are both typed (`start.via === "typed" && !both`).
- **Debts' own dates:** `debts[].startDate` and `termMonths` are read first by `startOf` (via "loan") when the balance is ours.

### 8. C2 follow-ups (checked at c804ed0 with scripts `loans/scripts/f25.mjs` and `f3.mjs`)
- **F2, orphan guesses (present at base, fixed):**
  - Before: deleting the mortgage on Net worth left `debts[setup-debt-mortgage].rate` and `.minPayment` in the ledger, and Our guesses still listed "Mortgage interest rate".
  - Fix: settle drops them (core/estimate `orphanDebt`). Now: none left, and the page no longer lists them.
- **F3, duplicate row (present, fixed):**
  - Before: rows "debt-readded 950 at 3.99%" and "setup-debt-mortgage 990 at 4.70%".
  - Fix: `setupRow` and `adoptRows` find the row by its account. Now: one row, "950 at 3.99%".
- **F4, twin matching (present, fixed):** `guessTwins` no longer offers a rental as the home we guessed, nor a "Personal loan" as the car loan. Tested.
- **F5, Q5b brings back a deleted guessed debt (present, not fixed):**
  - Evidence after the deletion: walking Q5b again recreates `setup-owe-mortgage`, and the pick stays `["mortgage"]`.
  - The two fixes are a product choice (say why on Q5b, or drop the pick when the setup account was deleted). Q5b cannot tell "deleted" from "never saved" without a new stored flag. Left for the owner.
- **F6, the saved tap disappeared (fixed in the view):** the tap is built from `startAsk` when `g.ask` is gone (shot 2 shows the tap).

## Decisions (also in the READMEs)
- **debt/mortgage `apart` ("far off"):** no longer said for a payment of ours that runs longer than the loan's years (that is `longer`, item 4). It is still said for one of ours that pays off far sooner (a small balance typed; home-purchase "verify" test).
- **Payoff includes Debts' extra payment** (Debts' own date). So a loan Debts pays off before work stops is no longer in Get started's figure. The rental condo (fixture `condoOnNetWorthPlan` with $300 extra) is now 4,350 and has no "loan back" line. Before, it was 5,200 with a fixed 10,212 a year given back from 2045.
- **Today's bills used as retirement spending:** each debt payment in them ends at Debts' payoff the same way (`spendingLoans` over Expenses' `debtsCounted`).
- **A share-of-savings strategy (percent, vpw)** adds no loans: it spends a share of savings.
- **Escrow guess precision:** kept to the cent (`rounded: true`), so a kept payment's payoff never moves (R11 rounding moved it by 2 months).
- **Question 5b now asks two questions on the mortgage** (when it was taken out, and tax and insurance). The task requires the second; it shows only once a payment is typed.
- **Coverage table:** not given a row. It lists only the 2026-11-02 inventory's 191 inputs, and the test pins that count.

## Sources (with dates)
- Homeowners Protection Act of 1998, 12 U.S.C. 4901-4902 (read 2026-11-07).
- SCF 2025 microdata X810 (released 2026-10-09; computed 2026-11-07): 56.0% of mortgage payers' payments include tax and insurance, so Not sure means included.
- Census ACS 2025 1-year B25103 and B25077 (posted 2026-10-29) and AHS 2023 PUF (dated 2025-01-22): property tax and insurance, through `escrowMonthly`.
- Freddie Mac PMMS yearly averages (already in the guess data).
- Amortization: core/math/finance.js `nper`/`pmt`.

## Files
- **core:**
  - core/math/retirement.js (engine `loans`);
  - core/estimate/engine.js and ledger.js (`orphanDebt`).
- **Shared compute:**
  - modules/overview/setup/compute.js;
  - modules/retirement/projection/compute.js;
  - modules/overview/guesses/estimators/{debts,home,purchase}.js;
  - modules/overview/guesses/compute.js;
  - modules/balance/liabilities/compute.js;
  - modules/debt/mortgage/compute.js;
  - modules/property/home/compute.js.
- **Designer-lane views** (claim row in docs/TEAM.md, 2026-11-07; DESIGN_LOG checked, nothing undone, no new CSS):
  - [designer] modules/balance/liabilities/view.js;
  - [designer] modules/overview/setup/view.js;
  - [designer] modules/overview/guesses/view.js;
  - [designer] modules/debt/mortgage/view.js;
  - [designer] modules/property/home/view.js (also "today's money" → "today's dollars");
  - [designer] modules/retirement/projection/view.js.
- **qa:** qa/guess-sanity.mjs (Household reads `escrowMonthly` first; new rule HD-ESCROW-GUESS) and qa/guess-sanity-rules.json.
- **Docs:**
  - docs/DATA_MODEL.md (`escrowMonthly` writers, `taps.escrow`, the age rule for taps);
  - docs/TEAM.md;
  - READMEs of retirement/projection, overview/guesses, overview/setup, property/home, debt/mortgage, balance/liabilities.
- **Tests:**
  - new: tests/loans-escrow.test.mjs (24 tests);
  - updated with working: tests/guess-sanity.test.mjs, tests/home-purchase.test.mjs, modules/{overview/guesses, overview/setup, retirement/projection, retirement/healthcare, insurance/life-needs}/module.test.mjs.
- No registry, golden or CHANGELOG edits.

## Tests
- **New file:** tests/loans-escrow.test.mjs, 24 pass. At c804ed0 it fails at import: `home.js does not provide an export named 'ESCROW_KEY'`. The figure evidence for BEFORE is in `loans/before/`.
- **Existing tests updated** (each change has a dated comment saying why):

| Test | Before | After | Why |
|---|---|---|---|
| guesses: estimator list | — | `debt.mortgage.escrow` key and its debt-row paths added | new estimator |
| guesses: rate with both typed and a year | moved by the year | does not move | item 7 |
| guesses: Jordan "before 2010" | 74,900 at 6.3% | 76,300 at 5.9% | item 5 |
| guesses: Jordan blank payment, C7 card | $920 | $910 | item 4 |
| setup: skip walk | $920 | $910 | item 4 |
| setup: tap "before 2010" | $1,200 and $84,000 | $920 and $83,000 | items 4 and 5 |
| setup: D8 | 1,640 | 1,630 | item 4 |
| projection: H-0826 | short in 2059 ($59,612); without health, short in 2057 ($49,149) | on track ($73,878); without health, on track ($63,416) | its "Mortgage (almost done)" $1,100 ends July 2030 |
| projection: family health line, 2051 | 77,116 | 43,636 | mortgage, Visa and car loan paid off before 2051 |
| projection: defect 1 (68/63 couple) | short in 2038, $66,863; FIRE none; Goal seek none | tight, $81,810; FIRE 63; Goal seek 63 | paid-off loans leave the spending |
| projection: health words | $630 | $620 | larger credit |
| projection: rental condo | 5,200 and "loan back" | 4,350 and no "loan back" | decision above |
| healthcare: 2027 | income 74,460, cost 7,610 | 73,264, 7,488 | payments fixed, not raised for prices |
| life-needs: Tom | need 1,038,000 | 929,000 | mortgage ends 2045 |
| life-needs: Sam | short either way, need 225,000 | not short either way, need 0 | the Visa "extra bigger than balance" pays off within the month and was spent for life at $60,600 a year; no 08-retired variant is short either way now; Tom still tests the rule |
| home-purchase: grid and D1/D3 payment identity | payment pays the balance off in the months left | also allows the item-4 cap (`ownPI`: the purchase loan's own P&I, never below a new 30-year loan's; months by nper, under 360) | item 4 |
| home-purchase: 25-year-old couple, "2020 or 2021" tap | January 2021 | July 2021 | item 5 (20 in 2021) |
| home-purchase: D6, 25-year-old couple, 2010s and pre-2010 taps | 4.1% and 6.3% | set aside (the no-tap rate); a 50/49 couple gets 4.1% and 6.3% | item 5 |

- **Full suite (npm test, final run):** 189,055 tests: 188,425 pass, **0 fail**, 627 todo, 3 skipped (2m56s). The 27 MB log was deleted after it was read; the summary is in `loans/npmtest3.summary`.
- **Before at base:** 0 fail (`loans/before/npmtest.summary`).
- **npm run check:** `check: OK`
  - guess coverage 61 of 191;
  - guess estimators 40 from 2 modules.
- **node tools/leak-guard.mjs --worktree:** `leak-guard: OK, 2853 files (worktree)`.
- **Wording rules** (scratchpad/words/wording.test.mjs, copied in for the run and removed): no slips in any changed file, before or after. The test's other failures are pre-existing, in other files.

## KNOWN changes (tests/guess-sanity.test.mjs, only lowered)
- `HD-ESCROW-ONCE`: 9 → removed (0 failures).
- `sr.verdict.loans-end`: 3 → removed (0 failures).
- **New hard rule `HD-ESCROW-GUESS`** (qa/guess-sanity-rules.json + qa/guess-sanity.mjs). It checks:
  - 0 < escrow <= payment / 2;
  - the payment less escrow is more than the interest;
  - escrow <= the usual tax + insurance;
  - 0.32%..4.11% of the home's value a year.
- It is checked on two fast households (a guessed payment kept; "Not sure"), with 0 failures.
- Fast run: 38 pass, 0 fail.

## Phone shots (390x844, isMobile, DPR 2, ?sandbox=1, server on port 9200, stopped by its PID)
All are in `scratchpad/loans/shots/`:
1. `1-debts-escrow-question.png`: Debts, the mortgage's details with the question and "about 394" in the box.
2. `2-get-started-q5b-escrow.png`: Get started 5b, Yes picked, the figure box, and the tap kept.
3. `3-get-started-year-message.png`: "20" in the year box. The words show under the box and in the notice, and Continue waits.
4. `4-home-tax-insurance-once.png`: the Home page lines "in your mortgage payment" and the counted-once note.
5. `5-will-the-money-last-loan-ends.png`: "Spending in retirement" with the mortgage's end year.
6. `6-debts-escrow-question-dark.png`: Debts in dark mode.

Also looked at, all fine at 390 px with no overflow or small tap targets:
- the mortgage page (June 2054, agreeing with Debts; the Mortgage insurance stat at 82% owed);
- Our guesses;
- Get started 5b in dark mode.

## What claude-a's pages should change (not edited)
- **cashflow/statement:** a mortgage row's tax and insurance should be a living cost, not debt service. The row's `escrow` (`balance/liabilities` rows, now from `loanMonths`) or `debts[].escrowMonthly` is the part of the payment that is tax and insurance. Today the whole guessed payment is counted as debt service.
- **balance/projection:** follows `debt/payoff`, which already pays the loan with `payment - escrow`. No change is needed, but its mortgage-free year moves with the new guessed payments (item 4) and kept escrow (item 2).
- **debt/consolidation:** leaves mortgages out, so it is not affected.
- **goals/\* pages that read the left-over:** move with the new guessed payments, but need no code change.
- **Wording slips on claude-a's pages** (from the wording run, pre-existing): balance/projection ("today's money" x10), balance/statement, cashflow/statement ("categorised"), debt/consolidation and debt/student-loans ("on Accounts"), goals/emergency-fund ("tick it").

## Other notes for later
- **Financial independence and Goal seek** scale the whole spending figure, loans included. They now see the loans end, but a scaled loan amount is scaled too.
- **A rental's "loan back" line** while the loan still runs is as before.
- **The percent and vpw strategies** ignore loans by design.
- **Get started's "Of that, tax and insurance a month" box** shows no grey figure (the help line says blank means the usual amount). A grey figure would need `ctx.guess("debt.mortgage.escrow")` on a row that does not exist yet.

## Cleanup
- My server (port 9200, PID 8301) was stopped by its PID.
- The worktree `scratchpad/wbase` (c804ed0, for the BEFORE runs) was removed. The build worktree `scratchpad/wloans` is kept, with its changes staged and nothing committed.
- The other worktrees in the scratchpad belong to other runs and were left alone.
- Scripts used: `scratchpad/loans/scripts/` (keep2, f25, f3, jordan, condo, h0826, fam, ln, ln2, seeds, t14b).
- BEFORE outputs: `scratchpad/loans/before/`.
- AFTER outputs: `scratchpad/loans/after-*.txt`.
