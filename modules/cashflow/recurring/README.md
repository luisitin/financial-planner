# Bills and regular payments  (`cashflow/recurring`)

**Status:** usable (phase 4)
**Purpose:** The payments that come back every week, month or year, when the next one is due, and which look missed.

## Inputs
Plan sections read (`needs`): `transactions`, `expenses`, `income`, `recurringIgnored`. Writes: `recurringIgnored` ("Not a bill").
`compute(plan, { today })`.

## Outputs
`detected[]` (`key`, `payee`, `accountId`, `category`, `cadence`, `cadenceLabel`, `amount` signed, `count`, `first`, `last`, `next`, `missed`, `spread`, `ids`, `monthly`), `planned[]` (from Income/Expenses), `dueSoon[]` (within 14 days, with `days`), `missed[]`, `monthlyOut`, `monthlyIn`, `dismissed`, `total`.

## Formulas
- Grouping: account + normalised payee (`normalizePayee`), transfers excluded.
- Cadence: the median gap in days between occurrences must fall in a band (`CADENCES`: weekly 5-9, every two weeks 12-16, twice a month 13-17, monthly 26-35, quarterly 80-100, yearly 340-390) and at least 60% of the gaps must be in that band.
- Amount: the median; `spread` = median absolute deviation / |median|. Two occurrences only count when the amount is identical (spread < 2%) and the cadence is monthly or longer; a spread over 50% is a shop, not a bill.
- Next: the first cadence step after today (months for monthly/quarterly/yearly, days otherwise). Missed: the first expected date after the last occurrence is more than 5 days in the past.
- Monthly figure: |amount| x occurrences per month (52/12, 26/12, 2, 1, 1/3, 1/12).

## Edge cases
No transactions: the typed items still list. A dismissed key stays out until `recurringIgnored` is edited (Settings > export shows it). A payee whose gaps change cadence (weekly then monthly) is dropped rather than guessed.

A salary typed as a yearly (or quarterly) figure, the setup's default, is paid in paychecks, not once a year
(`payRhythm` in core/math/periods.js: the Paycheck page's count for that person, else 26, every two weeks). Bills and regular payments labels it "A year, paid every two weeks" instead of "once a year" (2026-11-02).

## Tests
`module.test.mjs`: date helpers, monthly/biweekly/yearly detection, a shop and transfers excluded, a missed gym, totals, dismissals, empty plan. The fixture `recurringPlan()` is shared with Forecast, Irregular expenses and Subscriptions.

## Ideas / not yet
- "Add to Expenses" from a found payment (one tap creates the expense).
- Amount drift alerts (a bill that went up).

## Touch and input stress test (2026-11-11, claude-g)
- "Not a bill" asks first, naming the payee, and says what it did (p-cashflow-b-goals F3: one tap hid it from two pages with no
  word, and a second quick tap hid the next row). A folded "Hidden" card at the bottom lists the hidden payees (`compute`'s
  `hidden: [{ key, payee }]`) with "Put back" (removes the key from `plan.recurringIgnored`). `hideRow` and `hiddenCard` are
  exported for Subscriptions.
- With no bank file the hero says these are the bills you typed and keeps the filled "Import a bank file" (CF-5). Each typed bill
  opens its own form on Expenses (`#/cashflow/expenses?edit=<id>&back=cashflow/recurring`), with "Change these on Expenses" and
  "Change what comes in" under the list (CF-5, F2).
