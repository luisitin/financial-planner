# Irregular expenses  (`cashflow/sinking-funds`)

**Status:** usable (phase 4)
**Purpose:** Yearly and one-time costs turned into a monthly amount to set aside so the money is there when the bill lands.

## Inputs
Plan sections read (`needs`): `expenses` (quarterly, yearly, one-time with a date), `transactions` (yearly/quarterly payments found by Bills and regular payments), `recurringIgnored`.
`compute(plan, { today })`.

Written by this page (gap #12, 2026-11-13; optional, no version bump; `docs/DATA_MODEL.md` `expenses`): on a quarterly or
yearly expense, `setAside` (what is already set aside for it, $), `setAsideAt` (the day that figure was saved) and
`nextDue` (its next due date, `YYYY-MM-DD`). Saving the bill's form here writes them through `ctx.store.update`; a blank
"Already set aside" removes `setAside` and `setAsideAt`, a blank "Next due" removes `nextDue`. The Expenses form keeps
them when it saves the same bill (it merges `{ ...expense, ...clean }`).

## Outputs
`funds[]` (`key`, `expenseId`, `name`, `icon`, `source` typed/found, `amount`, `period`, `yearly`, `monthly`, `next`, `monthsToNext`, `saveByThen`, and `aside` on a followed bill), `monthly`, `yearly`, `dueNext[]` (within 3 months), `hasData`.
`aside` = `{ amount, at, due, months, cycle, needed, short, toFinish, extra, lastDue, state }`, `state` one of `ready`,
`on-track`, `short`, `no-date`, `stale`. Also exported: `nextDueOn(base, months, today)`,
`asideOf({ amount, cycle, setAside, due, today, at, noteFor })`, `CYCLE`.

## Formulas
- Quarterly and yearly typed items: monthly = yearly / 12. One-time items with a future date: monthly = amount / months until the date (at least 1). Past one-time items are dropped.
- Found yearly/quarterly payments are added unless a typed item has the same amount (within 1).
- Sorted by soonest next date, then by monthly amount.
- **What is already set aside (gap #12, H13 and H12)**, for a quarterly or yearly typed bill with `setAside` (a number, 0 or more):
  - cycle L = 3 (quarterly) or 12 (yearly) months; A = the bill.
  - due date: `nextDue`, else the Expenses date (`startDate`), rolled on by whole cycles to the first one on or after
    today, each counted from the first date (`addMonths(base, k × L)`, so January 31 every three months stays on the
    31st when the month has one). A bill with `nextDue` alone is rolled the same way; with neither field it keeps
    today's `next` (the date as typed), untouched.
  - n = whole months until due (`monthsBetween(today, due)`, the same count as "in 3 months" on the page).
  - needed by now = A × (L − n) ÷ L, with L − n held between 0 and L (more than a cycle away: nothing yet).
  - short = max(0, needed − set aside); "short" when it rounds to a dollar or more, else "on track".
  - each month to finish = (A − set aside) ÷ max(1, n); shown as "Put aside $X a month to catch up" when n ≥ 2 and as
    "Put aside $X before it is due" (the whole rest) when n is 0 or 1.
  - ready: set aside ≥ A (no date needed); extra = set aside − A, said when it rounds to a dollar or more.
  - no date anywhere: the line says what is set aside and asks for the date (the rest cannot be worked out).
  - a figure noted for a bill that has passed (stale): the bill a figure was noted for is the first due date on or
    after the day it was noted (`nextDueOn(base, L, setAsideAt)`). When that date is before today, the figure was for
    that bill (it may have been paid from it), so it says nothing of the next one: `state` "stale", `lastDue` that date,
    nothing worked out, and the line asks for a new figure. Noted on the due day itself counts for that bill (the safe
    side: it asks again rather than call a paid bill set aside). Without `setAsideAt` it cannot be told and the figure
    counts as before.
  - The total at the top and each line's monthly figure do not change: they are the steady amount for the bill.
- Sources, read 2026-11-13:
  - YNAB help, "Understanding Target Types in YNAB" (support.ynab.com, last updated October 5, 2026): a yearly target
    asks for the yearly amount spread evenly to its date ($600 a year asks $50 a month); a "Fill up to" target with a
    due date counts the money already in the category and asks only for the rest by the due date. The steady pace gives
    "needed by now"; the "fill up to" rule gives "each month to finish".
  - Consumer Financial Protection Bureau, Your Money, Your Goals, "Savings plan" tool (files.consumerfinance.gov,
    2015): "Do you have money set aside for expenses that come one to four times per year? For example, automobile
    insurance, renter's insurance...". The page names it on screen.
  - No current figure (limit, rate or price) is used: the arithmetic is the person's own bill and dates.

## What a person sees
- **First view, nothing noted yet:** as before: "Set aside $X a month", the lede, "Coming up in the next three months",
  every irregular cost with its monthly amount, "Right column: what to put aside each month...", "Change these on
  Expenses"; no part. Three small changes: one line under the list while a bill that comes back is listed and none is
  followed ("Tap a bill that comes yearly or every three months to note what is already set aside for it."); such a
  bill's right column says "Set aside ›" (its tap opens the set-aside form), a one-time cost keeps "Edit ›" (its tap
  opens Expenses); and a date early next month, less than a whole month away, reads "next month" under "Coming up"
  instead of "this month" (12/1 seen on 11/13).
- **A followed bill's line** (on the first view, never folded): "$950 of $1,200 set aside · due in March · on track";
  "$640 of $1,200 set aside · short $260 by March" with the short words in amber and "Put aside $187 a month to catch
  up." under it; "All $1,200 set aside · due in March"; "$1,300 set aside, $100 more than the bill · due in March";
  "$640 of $1,200 set aside · no date yet: tap to add one"; "... short $560, due this month"; a figure noted for a bill
  that has passed: "$1,200 noted for the bill due November 12 · tap to update" (never hidden by "N more"; the form's
  help says "Last noted 10/1/2026, for the bill due 11/12/2026.").
- **On request:** tap a bill that comes yearly or every three months, in either list: its form opens under that line (`ui.openUnder`;
  the phone's Back shuts it; a second tap shuts it; a tap on another bill moves the form there on the same Back step). "Already set aside" ($), dated today on save; "Next due" under
  "More details (optional)" when Expenses has a date ("Blank: 3/1/2027, from Expenses."), in sight when there is none
  (the answer needs it); Save and Cancel; "Change the bill on Expenses" (outlined) for the amount, how often and the
  rest. After Save the green line under the row that was tapped names its new state: "Saved. Car insurance: $640 of
  $1,200 is set aside, $260 short by March. Put aside $187 a month to catch up." (R7). Tapped under "Coming up", it lands
  there; when the save moved the bill out of the next three months, under its line in the list.
- **"How this is worked out"** (shut; drawn only once a bill is followed, status "N set by you"): how the right-hand figure is
  worked out, each followed bill's sum with its own figures ("Set aside by now: $1,200 × 9 ÷ 12 = $900. You noted $640
  on 11/13/2026: $260 short. Still to put aside: $1,200 − $640 = $560, ÷ 3 months = $187 a month."; "due in December,
  less than a month away" for a date early next month; for a stale figure "You noted $1,200 on 10/1/2026, for the bill
  due November 12, so it does not count toward the next one"), what it leaves
  out (money added after the figure was noted), and the CFPB source with its read date.
- **A long list** shows six costs, then "N more irregular costs" (`rest()`); a short bill, a stale figure and the bill
  just saved are never among the hidden ones.
- One-time costs still open their own form on Expenses (CF-5).

## Builder chose (gap #12; the spec left these open)
1. The form lives on this page, under the bill's line: the design names "the bill's edit form", and this commit may only
   change this page's folder. Tapping a bill that comes back now opens it here instead of the Expenses form (CF-5);
   "Change the bill on Expenses" inside it keeps that way one tap further. One-time costs keep CF-5's tap.
2. Only bills that come back (quarterly, yearly) are followed, as the design says; one-time costs are not (their monthly
   figure is already "what is left ÷ months until the date").
3. "Next due" is folded only when Expenses has a date: with none, the answer needs the date, so the box is in sight
   (`docs/OPTIONAL.md` R21: a box whose hidden default would mislead stays out of the fold).
4. "Dated today on save": every save with a figure writes `setAsideAt` = today, also when the figure did not change
   (the person has just said it is still what is set aside).
5. n is whole months (the page's own "in 3 months"), so "needed by now" leans a little early, never late.
6. The headline and each line's monthly figure stay the steady amount (what to budget every month); the catch-up is
   said under a short bill's line, in the green line and in the working.
7. A followed bill's date is rolled forward to its next due date (a yearly bill typed with last March's date shows next
   March); bills not followed keep the date as typed, so `compute()` is byte-identical for every plan without the new
   fields (4,212 of 4,212 plan-days over the 14 households with every pack and the four fixture plans, three days).
8. A figure noted on the day a bill fell due counts for that bill, not the next (it asks again rather than risk calling
   a paid bill set aside); the critic's reading was "before the due date".
9. Nothing followed: no "How this is worked out" part and the "Right column" line stays in place (the design: "Unchanged
   until a figure is set"); once a bill is followed the line moves into the part, beside the working.

## Tests
`module.test.mjs`: typed quarterly/yearly/one-time, a past one-time dropped, a found yearly payment, totals and the
due-next list. Gap #12: rolling the due date (whole cycles from the first date, month ends, today, ahead, invalid);
on track, short and over (ready, extra, exactly on pace, $0 typed, half a dollar); the catch-up (3 months, due this
month, more than a cycle away; the pure helper); no `setAside` gives today's fund key for key (blank, null, negative
and nonsense values read as absent; one-time never followed); a quarterly cycle (and rolled from Expenses); the
person's date wins, a date alone, a past date rolled, no date, totals unchanged. Words: when it is due in calendar
months; the line per case (9); the sentence per case (8); the green line per case (5). The page on the fake DOM with
the real kit: nothing followed (hint line, the working shut, no box, no filled button); a short and an on-track bill
(amber words, catch-up, the working's sums, status "2 set by you"); the working with one month or less to go
("before it is due") and with the whole bill set aside; the form (date folded or in sight; Save writes the
figure and today; the green line right under the line, said once); a date saved then the figure cleared; a one-time
cost opens Expenses and the form's way there; a long list cut at six keeping the short bill. Invariance over the
households and the four fixtures on three days. Critic fixes (2026-11-13): a figure noted on or before a due date that
has passed (yearly, quarterly, the person's own date, two bills back, no day noted, still ahead; the pure helper; its
line, sentence, working and form help; kept in sight); "Set aside ›" and "Edit ›"; "less than a month away" and "next
month" for a date early next month, "this month" said once; nothing followed draws no part and keeps the "Right
column" line; a bill tapped under "Coming up" (a real tap, `ui.openUnder` on the stand-in) gets its green line there,
or under its list line when the save moved it out of the next three months.

## Ideas / not yet
- A linked savings account as the set-aside figure (which account holds the money), so it follows the balance.
- One-time costs with money already set aside (the monthly would then be what is left ÷ months).

## Touch and input stress test (2026-11-11, claude-g)
- A typed cost opens its own form on Expenses with a way back; "date unknown" reads "no date yet: tap to add one"; "Change these on
  Expenses" under the list (CF-5, F2). Typed `funds[]` carry `expenseId`. Since gap #12 (2026-11-13) a bill that comes
  yearly or every three months opens its set-aside form here instead, with "Change the bill on Expenses" inside it.
