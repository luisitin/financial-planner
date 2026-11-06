# Budget  (`cashflow/budget`)

**Status:** usable (phase 4)
**Purpose:** An envelope for each kind of spending: what is spent so far this month, what is left, and whether the pace is right.

## Inputs
Plan sections read (`needs`): `budgets` (`[{ id, category, amount, period: "monthly", rollover }]`), `transactions`, `categories`. Writes: `budgets`.
`compute(plan, { today, month })`.

## Outputs
`month`, `label`, `dayOfMonth`, `daysInMonth`, `daysLeft`, `envelopes[]` (`amount`, `rollover`, `carried`, `available`, `spent`, `left`, `share`, `pace`, `expectedByNow`), `totals`, `unbudgeted[]`, `suggestions[]`, `hasBudget`, `hasData`.

## Formulas
- Spent = spending-kind transactions of the month in that category (transfers excluded), as positive money out.
- Carried (rollover only) = max(0, last month's amount - last month's spent): unspent money moves forward, overspending does not become a debt.
- Available = amount + carried; left = available - spent.
- Pace: over when spent > available; "ahead" when spent > expected-by-now x 1.1 + 1 where expected-by-now = available x day of month / days in month; else on track.
- Suggestions (2026-11-01) = per spending category without an envelope, the total over those of the last three months that the bank files cover from start to end (`transactions/ledger` `monthCover`), divided by the number of those months (`suggestFrom.length`), so "average of 2 whole months" is the number it was divided by and a month with nothing in a category counts as nothing. Before, a month cut by the file counted as a month (Groceries $500 instead of $675 on a file cut Oct 9) and the label could say "average of 2 months" over a division by 3 ($273 for a $410 car payment). With no whole month in the files, there are no suggestions and the page says what the files cover and to import 90 days.
- `stale`: the files stop more than 3 days (`COVER_SLACK`) before today in the month shown, so "spent so far" is missing days; the page says where they stop.

## Days missing between files, and a card's missing file (2026-11-02)
- Suggestions also skip a month that is whole at both ends but has a hole in any account's files (`monthHoles`, Transactions >
  Ledger): `suggestSkipped: [{ ym, holes }]`, and the page says "August 2026 is left out: Chase checking has no lines from
  7/31 to 8/2." The sample family's November suggestions were averaged over August to October, and August is missing the
  mortgage of Aug 2: "Rent or mortgage $1,320" (two mortgages over three months). Now September and October: $1,980.
- A card whose own file is missing (Ledger `unimportedCardLines`) counts in no category's suggestion: its payments are no
  kind of spending yet. `suggestCards: [{ cardId, name, label, average, months }]` (the total over the same months / their
  number) is said above the list: "Visa card's purchases aren't in these amounts: about $2,795 a month went to it, but its own
  file isn't in, so what it bought isn't sorted into kinds yet. Bring in the Visa file." So "Eating out $94" reads as checking
  only, not as the whole of it.
- This month's payments to such a card are spending with no envelope: one `unbudgeted` line per card `{ category: "", card:
  true, cardId, label: "Visa card, details not imported yet", spent }`, never an envelope to add. Envelopes never count it.
- Review (2026-11-02): a month is left out unless it is whole account by account (Ledger `monthGaps().whole`: no hole, no
  account whose lines stop early or start late), so a Visa file from 8/20 or one stopping on 9/19 leaves August or September
  out too. `suggestSkipped[].issues` (Ledger `gapIssues`) carry the reason; the page groups months that share one ("July and
  August 2026 are left out: Chase checking has no lines from 7/31 to 8/2."). `suggestCards[]` adds `inMonths` (the months its
  stand-ins were in) and `total`: with the Visa's file in for September only, the note says "Visa card's purchases in October
  aren't in these amounts: $2,610 went to it then, but its October file isn't in..." instead of "about $1,305 a month".
- Re-check 4 (2026-11-02): one rule for the days between files (Ledger `coverageByAccount`: more than a quiet spell of 7
  days and 2 x the account's spacing, or a usual monthly payment due in them). One checking file a month, each record from its
  first to its last line (8/3-8/29, 9/1-9/26, 10/1-10/31): no hole, suggestions from August to October (groceries $997, as
  dc6e73c). A payment counted for neither of two cards at one bank (Ledger `unsureCardPayments`) leaves its month out with the
  one sentence ("$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought"); the
  month's page says it as `unsure` above the envelopes. `suggestCards[]` and the card's line carry `before`/`first`: a payment
  before the card's first line reads "before its file starts on 8/1".

## A bill paid once a month (2026-11-02)
An envelope whose month so far is one payment of 90% or more of its amount (and not over it) reads "paid", not
"spending fast": the mortgage paid on the 1st is not a fast pace. Two payments, or one under 90%, pace as before.
The month before must look the same (one payment in that category, within 10% of this one), so a single big
grocery trip on the 2nd still reads "spending fast".
Opened from the Monthly review (`?month=2026-10`), the page shows that month until a month is picked here.

## Edge cases
No today and no month: nothing. A past month counts as complete (day = days in month). Adding an envelope for a category that has one updates it instead.

## Tests
`module.test.mjs`: spent/carried/available/left, pace states, unbudgeted list, suggestion averages over whole months only (a cut first month left out), no suggestions without a whole month, stale files, a past month. A month with a 4-day hole between two files left out (groceries (310 + 300) / 2 = $305, rent $1,000) and back once the files join; the sample family in November (August left out, mortgage $1,980, eating out $94, the Visa's (2,980.55 + 2,610.30) / 2 = $2,795 apart, October's card payment unbudgeted) (2026-11-02). Re-check: a quiet savings account (interest on 7/31 and 10/31) and no card suggests from August to October with nothing skipped (finding 4); a Visa file stopping on 10/10 leaves October out ("Visa card's lines stop on 10/10") with no card line, since its 10/14 payment no longer stands in (finding 2). Re-check 4: money 1 (one checking file a month: August to October, groceries $997, nothing skipped) and money 4 (a payment for one of two Chase cards: no suggestions, each month's sentence, October's `unsure`).

## Start from your expenses (round 4, 2026-11-02)
With no envelopes and no whole bank month to average, `compute` returns `fromExpenses`: the Expenses page's monthly amount
per kind of spending (its `byCategory`, debt payments included), rounded to the dollar, and `fromExpensesTotal`. The page
shows them in a "Start from your expenses" card with one filled button, "Use these as my budget" (`useExpenses(draft,
rows, newId)` adds one envelope per kind not budgeted yet, in one save), and "Import a bank file instead". It also says
what is left after them, tax and saving, read from Next best action's `spare.monthly` (the Dashboard's figure), so no new
left-over number is made. Before, "Set a budget" (the spending guide's step) opened an empty form and the person retyped
every bill. With envelopes but no bank file yet, the page says spending shows once a file is in, and drops the
"on track" pills and "left" amounts that read $0 spent. The confirmation shows at the top.

## Ideas / not yet
- Yearly envelopes and per-envelope notes; "money to assign" against income.

## Start from your expenses in a lean month (review 2026-11-02, round 5)
The card's last line reads Next best action's spare, as the Dashboard does. When Side income's "count on" holds part of
uneven pay back (`spare.held` above $0.50) and the month is short, it says so: "In a lean month, these, tax and your saving
come to about $X more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard. A month
that brings the Income page's amount leaves about $Y." (Y = `spare.fullAbout`; "Even a month that brings the Income page's
amount is about $Y short." when below 0). A month with money left adds "counting uneven pay at what you can count on".
Before, a freelancer whose full month leaves money read only "... $770 a month more than comes in". Test: `module.test.mjs`
(the page drawn with a stand-in UI kit, read back as text).

A full month within $5 of $0 (review 2026-11-02, round 5, second review): `spare.fullKind` (cashflow/budget-percent `fullKind`: "ahead", "even" within $5 of $0, "short") decides the words, so it reads "only just about breaks even" instead of "leaves about $0" or "is still about $0 short". The card reads "Even a month that brings the Income page's amount only just about breaks even." Test:
`module.test.mjs`.

## Recheck 2026-11-05
With bank files in but no whole month to suggest from (two cards at one bank, no file for either), "Start from your expenses"
said "Spending against each envelope shows once a bank file is in", which was false. It now says "Your bank files have no
whole month to suggest amounts from yet." and the months left out and why; with no bank file at all the old words stay. A
payment counted for neither card is said by its short reason (`brief`, ledger `unsureBrief`), so the months share one
sentence: "August to October 2026 are left out: money went to your Chase cards, whose files aren't in." Test: the page's
words for Freedom and Sapphire on plan3, and for a plan with no bank file.
