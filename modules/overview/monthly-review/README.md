# Monthly review  (`overview/monthly-review`)

**Status:** usable (phase 9)
**Purpose:** Walks you through the month in ten minutes: fresh balances, the bank files, spending against the budget, the change in net worth, goals and what needs attention, then marks it reviewed with a note.

## Inputs
`accounts` (balance dates), `netWorthHistory`, `transactions`, `budgets`, `goals`, `reviews`, and through other computes: Net worth, Categorise, Budget, Where the money goes, Goals, Needs attention, Next best action. Params: `today`, `month` ("YYYY-MM"; default `defaultMonth(today)`: the month just ended during the first `LOOK_BACK_DAYS` (10) days, else this month). Writes `reviews` (only through "mark reviewed").

## Outputs
`{ ready, missing, month, label, choices, steps[], done, todo, reviewed, history, streak }`; each step `{ id, title, status: done|todo|info|skip, detail, go }`. `markReviewed(draft, month, today, note)` adds or replaces the month's entry (one per month, kept in month order).

## Which month it opens on (stress test 2026-11-11, MR-2 and MR-3)
`defaultMonth(today, plan)`: the month just ended while it has no review and the plan holds something dated before this month,
any day of the month (it used to switch to the current month on the 11th, leaving a month that could be closed open, and the
Dashboard had no way in for 20 days of every month); else this month. `checkInDue(plan, today)` follows the same rule and says
`done` once the month is checked in, with the month after it (`nextName`) and when that one is done (`nextWhen`).

## What the page says it counts (stress test 2026-11-11, MR-3, OV-3, MR-8, MR-5)
The hero counts the things to do (the chores: balances, net worth, bank files, filing) and, apart, the look steps that are
amber ("One thing left to do: save the month's net worth. Then 2 things are worth a look."); the bar counts both, so it is never
full while a look step is amber. The month still running has one filled button, "Next: <the first thing to do>"; a month that
has ended has "Finish the October 2026 check-in" (the page is called Monthly check-in, as the Dashboard's row says). After
finishing, the page stays on that month and starts from the top, so "October 2026 is done ✓" and the green line are in view;
the fold reads "Everything in this check-in (8)". The net worth step says where its button is ("at the bottom of Net worth");
opening Net worth at that card needs a change on balance/net-worth (its owner).

## The steps
1. Update the balances: done when every account's balance was typed in the last `FRESH_DAYS` (20) days. (Until 2026-11-01 a balance dated anywhere in the reviewed month counted, so the October review on Nov 1 ticked balances from Oct 1 as done.) Opens Update my balances while any is older. The saved net-worth point's date is shown in words.
2. Save the month's net worth: done when `netWorthHistory` has a point after the `LOOK_BACK_DAYS`-th (10th) of the month through the 10th of the next month (`monthPoint`), the newest one; the change is against the newest point saved on or before the 10th of the month. So October's review on Nov 2 counts a point saved that day ("$306,074 saved on 11/2/2026: up $10,965 since 10/2/2026"), and a point from Oct 2 alone (October's own start, which was September's review) leaves it to do. (Until 2026-11-02 only a point dated inside the month counted, so a review in early November could never tick October, and the change was against the month's own start; a first fix that day still let October 1-10 count, so the start-of-month point ticked the step and compared with nothing.)
3. Bring in the bank files: done when the month's files are in: the account files cover the whole month (`monthCover(...).full`, from Transactions > Ledger's coverage), or, for the month still running, they start by the `COVER_SLACK`-th day and reach within `COVER_SLACK` days of today. A file that stops on the 1st of the month leaves it to do: "Your files stop on 11/1/2026: import the rest of November 2026." "Optional" (skip) when the plan keeps no transactions. (Until 2026-11-02 one transaction dated in the month ticked it.)
4. File what came in: the month's transactions with no category and no transfer link. While the month's files are not in and nothing is unfiled it waits for them (skip), never "done" (until 2026-11-02 an empty month read "every transaction is filed").
5. Spending against the budget (a thing to look at, not a chore): envelopes over their amount for the month (Budget) give it an amber ring, or a pointer to set envelopes up; it waits (skip) until the month's files are in (it read "$0 spent" and ticked). Since 2026-11-02 an envelope over budget no longer blocks marking the month reviewed: being over is something to see, not a task you can finish.
6. Where the money went (information): the month's spending against the month before in dollars and as a share ("up $60 (5%) on September 2026"; on the same days of it when the file covers part of a month), the biggest category. (It printed the share as dollars: "up $0".)
7. Check the goals, 8. Look at what needs attention, 9. Take the next step: things to look at, shown with how they stand (a goal behind or an alert to fix gives the number an amber ring, `state: "todo"`), never counted: a goal can be behind for a year and the month is still reviewed. (Until 2026-11-02 they were counted, so no household with a goal behind could ever finish.)
`done` / `todo` count only the chores (balances, net worth, bank files, filing).

Each step opens its page with `?from=review&review=YYYY-MM`: the page shows "‹ Back to the October 2026 check-in" (overview/guide's frame, mode "review"), and Budget and Where the money went open on the month under review (`?month=`) until a month is picked there.

The month still running cannot be marked reviewed (`ended` false): its steps can be done, and the card says "November 2026
is still going: mark it reviewed in early December", with a button to the month just ended. Marked on the 2nd, it hid the
real check-in (the Dashboard asks only for a month not yet reviewed) though its files and spending were not in yet (2026-11-02).

Once the month is marked reviewed, the hero says "October 2026 is done ✓" with the month in a line (`summary`: net worth's change since the point before, spending and its change) and the next check-in ("early December, for November 2026", `nextCheck`); the steps fold behind "All steps". Nothing new is stored.

From the 1st to the 10th, while the month just ended is not reviewed, the Dashboard's "where you stand" card has one row "Your October check-in · Start ›" (it takes the stale-balances row's place, since the review starts with the balances).

## Every account, and the cards (2026-11-02)
Step 3 used to tick once the files together reached both ends of the month (`coverage`, the first and last date over every
account), so it never asked for an account with no lines (the sample family's Visa, whose autopays from checking are filed as
transfers) or for the days between two checking files. Now the span check above comes first (its old messages are kept),
then `monthGaps` (Transactions > Ledger) account by account; the step is done only when it finds nothing:
- a card whose own file is missing (`missingCardFiles`): "Visa card: $2,610 went to it from checking in October, but its own
  file isn't in, so what you bought on it is missing. Bring in the Visa file." (the payers by kind, checking or savings, else
  by name; `cardWords`);
- a hole in one account's files reaching into the month (`coverageByAccount`): "Chase checking has no lines from 7/31 to 8/2:
  bring in a file that covers those days, or add them by hand." (the whole hole, even where it starts the month before;
  `holeWords`);
- an account whose lines stop more than its slack before the month's end: "Second checking's lines stop on 10/19: bring in the
  rest of October."
The first two are shown, then "And N more."; the step's `query` is `{ accountId }` of the first, so its link opens the Import
page with that account picked. Filing and the budget then wait with "Waits for the missing file above." (the month's Chase
lines may all be filed; it is the card's file they wait for).

Review (2026-11-02): the words come from Ledger `gapIssues`, which adds an account whose files start late ("Visa card's lines
start on 8/20: bring in a file from 8/1."). A card with lines last month, none this month and nothing paid to it is no longer
asked for (a quiet month); a card whose daily lines stop is "short" once. The step carries `quiet: [{ accountId, name, from,
to }]` for the gaps it names (at most two) that can be marked as nothing happened, leaving out any whose days hold a usual
payment with none of it on file that month (Import `usualInDays`: plan3's 7/31 to 8/2 holds the mortgage of the 2nd and a
paycheck of the 1st, so it is never offered; a Visa file from 8/20 offers "Visa card: nothing happened 8/1 to 8/19"). The page shows one
outlined button per entry under the step; it writes Ledger `markQuiet` (an import entry with no lines, undone under Import >
Past imports) and confirms with a notice. "Where the money went" says "most on" a kind of spending, never a card's stand-in
line, then "$2,610 went to the Visa card, whose file isn't in" ("whose file misses some days" for a card with some lines).

## Re-check of the card patch (2026-11-02)
- "Nothing happened" (`quiet`) is never offered for days in which money went to that account from another one (Ledger
  `paymentsTo`), as well as days a usual payment falls in. Finding 3: with the Visa's file from 8/20 and checking's $2,450.22
  to it on 8/14, the button for the Visa's 8/1 to 8/19 is gone (pressing it dropped the stand-in and took August from
  $6,074.38 to $3,624.16); a Visa file from 8/10 still offers 8/1 to 8/9, which hold no payment.
- `links: [{ label, go, rest?, query? }]` on the files step when it names more than one account or days to add by hand: one
  outlined button each under the step ("Bring in the Visa file", "Bring in the Chase checking file", "Add Chase checking's
  lines by hand", which opens the Ledger on that account); the step itself still opens the first.
- Where the money went: a month whose files miss some days, or the month before it, is not compared as fact (Spending's
  `cmpGap`): "$5,714 spent in August 2026 (its files miss some days, so it is not compared with July 2026); ...", and
  September "(August 2026's files miss some days, so the two are not compared)". A stand-in dated before the card's file
  starts reads "$2,450 went to the Visa card, before its file starts on 8/20" (it read "whose file misses some days").

## Re-check 4 (2026-11-02)
- One rule for holes (Ledger `coverageByAccount`): a few quiet days at a file's edge are not missing; one checking file a
  month (8/3-8/29, 9/1-9/26, 10/1-10/31) and quarterly one-line savings files leave August to October done.
- A hole's step names the usual payments due in it ("Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes
  out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand."). Its links say
  the days: "Bring in the Chase checking file" opens Import with `need: "2026-07-31..2026-08-02"` (step 1 says "Bring in a
  Chase checking file that covers 7/31 to 8/2 ..."), and "Add Chase checking's lines by hand" opens the Ledger on that
  account with `query: { month: "2026-08", add: "2026-08-01" }`: the reviewed month, the add form open, dated the first
  missing day in that month (`from=review` kept, so the Ledger's back link returns here).
- A payment counted for neither of two cards: the step says "$2,610 went to one of your Chase cards in October; bring in the
  card files to see what it bought." with a "Bring in the <card> file" link per card; the spending step says "(its card
  purchases aren't all in, so it is not compared with September 2026)".
- A month before a card's first line: "Visa card: $640 went to it from checking in July, before its file starts on 8/1, so
  what you bought on it then is missing. Bring in the Visa file for July." and "$640 went to the Visa card, before its file
  starts on 8/1".

## A plan made this month (2026-11-02, round 4)
`firstDay(plan)` is the earliest day the plan holds anything for: an account's balance date or history point, a saved
net worth total, a bank line, a review (not `meta.createdAt`: an app opened empty in October and filled in on November 2
has nothing to look back on in October). `checkInDue(plan, today)` is the Dashboard's check-in row: the first ten days,
accounts on file, last month not reviewed, and `firstDay` before the 1st of this month. `defaultMonth(today, plan)` opens
on this month for a plan with nothing older, so a plan made on November 2 is not handed an "October 2026 review"; its
first check-in comes in early December.

## Data
New plan section `reviews: [{ month, at, note }]` (`core/schema/migrate.js`; `migrate()` adds it to older plans, no version bump; `docs/DATA_MODEL.md`).

## Tests
`module.test.mjs`: the month chosen for a date, the section added to old plans, the family's steps, a month with transactions, marking reviewed (replacing, the streak, a gap). The files step on the sample family back after three months (`qa/fixtures/card-gap-plan.mjs`): October names the Visa and $2,610 and opens its import, August adds Chase's hole, and with the Visa's lines in October is done while August still names the hole; a 4-day hole inside October is todo, one within 3 days is done (2026-11-02). Re-check: finding 3 (no button for the Visa's days with a payment in them, August $6,074.38; the Visa file with a gap around 9/14 likewise), finding 4 (a quiet savings account and no card: August to October done), the files step's links, the comparison words (August, September) and "before its file starts on 8/20". Re-check 4: money 1 and 3 (one file a month, quarterly savings files: done), money 4 (the sentence and a link per card; the spending step's words), pages 4 (July's files and spending steps), and the hole's links with `need` and `add`.

## Review fixes 2026-11-02
The goals step counts with alerts' `goalsBehind`, the same as Goals, the Dashboard and Needs attention; goals waiting their turn are named apart ("Japan trip starts in December 2027, its turn on Next best action").

## Ideas / not yet
- A short monthly report to keep (the review's figures frozen with the note); reminders on the Dashboard when the month is not reviewed by the 10th; the Annual review pack built from these.
