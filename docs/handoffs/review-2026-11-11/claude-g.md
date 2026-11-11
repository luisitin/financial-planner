# Review of claude-g's lane (balance, cash flow, goals, debt, property, household)

Reviewer: claude-r, from outside the lane. Every finding was reproduced at least twice at 390x844 with touch in the
sandbox. A second agent who had not found it then tried to refute it, on 1f2e681 and again on e05d6a4. Only what
survived is listed. The stress-test steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).

## Round 3 (bf230aa on 735fa4e; 01719f3 read): clean

| id | verdict | what was seen |
|---|---|---|
| N4 (an old payday blocks the save) | closed | Ana's 2025-09-05 is left alone and only Bo's is changed: it saves with "paydays now counted from 10/30/2026". Changing Ana's to a date over a year back is refused in plain words. Nothing changed says "Nothing changed.". Ana's old payday still gives 26 paydays of $3,900. |
| N5 (a pension's days "your employer's") | closed | Pensions and Social Security say "the payer's" on screen and in the calendar file. A salary still says "your employer's". |
| claude-d's N3 hand-off (the spending link) | closed | "Uncategorized · 2 transactions" opens the Ledger with exactly those 2 rows, "Showing money out only". "Show money in and out" shows 3. |

Regression sweep on calendar and spending: blank, family, ruth, samDone and retiredCouple, at 390, at 320 and in dark mode. No errors, nothing off the edge, and one filled button per screen. The calendar's dates and amounts were compared with the code before bf230aa for 9 households over a month, 3 months and a year: identical apart from the pension wording.

A stored payday dated after today used to block saving another one, but 01719f3 already fixed that (the `max` limit is now set only on a box whose stored date is today or earlier; view.js:86). A future date typed in a box is still refused in the browser's own words. That is the bubble wording of UI-ERR, which belongs to wave 1.
**Nothing open in claude-g's lane.** One aside for whoever owns the Ledger's filter: the category menu reads "Uncategorized (10)", counting every month, while 2 rows are listed.

## Round 2 (e4bc7af on 453ed8a; the round 1 fixes a624d22 and 45534e7 on f9b130e)

### Closures and claims: 15 checked, 12 closed, 1 not closed, 2 closed with small points

| id / claim | verdict | what was seen |
|---|---|---|
| N1 (a yearly salary as one payday) | closed | Each amount checked by hand, in the list and in the calendar file. Sam: 48,000 / 26 = $1,846.15 every two weeks. Jordan: $2,230.77. patLee: $3,269.23 and $1,538.46. Ruth: pension $1,200 and Social Security $1,900 monthly. The edge cases in node also hold: 52, 12 and quarterly paychecks, a yearly Social Security amount, a salary that ends. No pay line is over $15,000 anywhere. |
| N2 (an ended salary asked for) | closed | retiredCouple is asked only about Ruth's Social Security. An income that ended yesterday is not asked. |
| N3 (two filled buttons after an add on Net worth) | closed | sam's mortgage and renterDebt's card: one filled button in view, at 390 and at 320. |
| People keeps typing across a tax save (p-career-household-system/x-1) | closed | "59" and "91" stay after State changes, and they save. The draft does not leak to another person or survive Cancel. |
| A payday can be changed | closed | It can, unless another payday is over a year old: N4. |
| A future or year-old payday is refused | closed (wording) | Refused at the box by the browser's own date message (wave 1's bubble wording). |
| goals "More details" at 320, recurring income rows, Expenses' way back after Cancel, an unknown `?edit=` said, a 33.3 split, the prioritizer putting a blank back | closed | Each checked twice, at 390 and at 320, and in dark mode where it applies. |
| claude-d's N3 hand-off: `cashflow/spending` link | **not done yet** | `modules/cashflow/spending/view.js:68` sends `{ category }` with no `dir: "out"`, so "Uncategorized · 2 transactions" still opens 3 lines. The Ledger now explains this in words, but the rows do not match. |

No regressions on household/calendar (blank, empty, family, ruth, samDone, retiredCouple, at 320 and at 390 in dark mode).

### New problems (confirmed by a skeptic)

**N4 (severity 4): a payday that is over a year old blocks changing any other payday**
- Steps: family, with Ana's payday stored as 2025-09-05 (typed a year ago) and Bo's as 2026-10-31. Open household/calendar, then "Change a payday". Change only Bo's to 10/30/2026 and tap Save.
- Seen (4 runs, two agents): the browser's "Value must be 11/10/2025 or later." appears on Ana's box, which was not touched. Nothing is saved and no notice is shown. Every stored payday ages past a year, so in time the whole form locks for everyone who typed one.
- Should: save the box that changed. An untouched stored payday passes, and the "last year" limit applies only to a box the person edited.
- Cause: `modules/household/calendar/view.js:79` sets `inp.min = oldest` on every prefilled box. Without that line, `:72-73` would still refuse Ana's box with "Type a payday from the last year…", because `old` is tested over all typed rows before `changed` is worked out at `:74`.

**N5 (severity 2, from 45534e7): a pension paid twice a month is a guess about "your employer's" days**
- Steps: retiredCouple, household/calendar.
- Seen: "Sam's pension +$750.00 the 15th and the last day of the month (a guess: your employer's days may differ)", three times, and the same words in the calendar file.
- Should: "the payer's days may differ", or name the pension or Social Security.
- Cause: `modules/household/calendar/compute.js:121` (the `semi` string) and the copy of it at `:126`, used for every kind of income.

## Round 1 (closures on 1f2e681; new problems re-checked on e05d6a4, which includes e4bc7af)

### Closures: 45 checked, 41 closed, 3 partly or worse, 1 closed for its own part

| id | verdict | what was seen |
|---|---|---|
| j-debt-fixer/D1 | closed | "+ Add a loan or card" opens Net worth with Credit card chosen and the cursor in the name. "Next: its rate and payment ›" leads to the rate form. "Add Capital One's rate and payment ›" on Pay off debts is a 44 px button and leads back. |
| j-debt-fixer/D2 | closed | 50.., abc and -50 are refused at the box. The saved extra stays put, and an empty box previews as $0. |
| j-debt-fixer/D3 | closed | A card has 4 boxes and a loan has 6. Focus goes to the form's heading. |
| j-debt-fixer/D5 | closed | Compare scrolls to "What this offer does" and the green line says "$1,022 a month, $478 less than now". A rate typed but not yet compared is said to be not yet compared. |
| j-debt-fixer/D7 | closed | One amber notice with one filled "See my payoff plan". $219.75 checked by hand. |
| j-debt-fixer/D8 | closed | "Tap Up to move a debt earlier." gives a "moved" pill and a green line. Two quick Ups move the same debt twice, as intended (README). |
| j-debt-fixer/x-1 | closed | My own order and 200 are kept through Up. Plan saved. |
| j-debt-fixer/x-4 | closed | The tiles follow each key. Both boxes are money boxes. |
| p-debt-property/DP-2 (vehicles, rental) | closed | The message is at the box, which is focused and in view. (Home's year is still a prepend, which is wave 1.) |
| p-debt-property/DP-3 | closed | "Add the mortgage" opens Net worth with Mortgage chosen. "Back to Mortgage ›" returns. Small: on an empty plan the form opens with no focus and Add sits at 888-932, below the screen. |
| p-debt-property/DP-4 | closed | 600 months is refused at the box. An empty months box gets a plain sentence. |
| p-debt-property/DP-7 | closed | An empty plan shows the hero, a filled "Add your income" and an outlined "Add your debts", and no $0 tiles. |
| p-debt-property/DP-8 | closed | "Extra each month, on top of the $2,790 you pay now". |
| p-debt-property/x-1, j-keyboard-reader/x-redraw-on-change (Mortgage) | closed | After typing 250, a touch on the lump-sum box takes the focus, in 3 runs on 2 households. |
| p-debt-property/x-2 | closed | An empty amount is refused at the box on Renovation and Purchase. |
| p-debt-property/x-5 | closed | "3 years 8 months sooner", "ends May 2042". |
| p-balance/B4 | closed | Every button opens the form it names. "Back to your account ›" returns. |
| p-balance/B8 | closed | "See my payoff plan" is 173x44. |
| p-balance/x-4 | closed | Done carries Undo, and Undo restores the goal. |
| j-fat-fingers/FF8 (lane's links) | closed | No small targets on Debts, Mortgage or What lenders see. |
| p-cashflow-a/CF-1 (this side) | **partly** | The `?from=import` code on Net worth works when opened by hand. Import's button does not send it yet; that is claude-d's link, reported to claude-d as N4. |
| p-cashflow-a/CF-4 | closed | 60/30/30 is refused at the form. Open sections stay open after a Save. |
| p-cashflow-a/CF-5, p-cashflow-b-goals/F2 | closed | Typed rows open `expenses?edit=…&back=…` with the form at the top. "Back to <page> ›" returns. |
| p-cashflow-a/CF-6 | closed | The sentence names Withholding check and links there. |
| p-cashflow-a/CF-8 | closed | All 12 envelopes show "Edit ›". |
| p-cashflow-a/x-3 | closed | "take-home is now $2,832 a paycheck (was $2,888)". |
| p-cashflow-b-goals/F3 | closed | The page asks first, says what was hidden, and "Put back" works. |
| p-cashflow-b-goals/F4 | closed | A tap anywhere on a goal row opens its Edit. |
| p-cashflow-b-goals/F5 | closed | Three boxes, and Add is on the first screen. A wrong growth figure opens More details and shows the message at the box. |
| p-cashflow-b-goals/F6 | **partly** | House is closed: the fold stays open and the echo says the answer. Rent or buy and Renovation still shut their fold and leave the answer off screen (scrollY 648 and 873). The lane left these for wave 1 (SH-REDRAW / UI-RESULT), which is right. |
| p-cashflow-b-goals/F10 (Education) | closed | The cost box shows only for "A cost I enter". |
| p-cashflow-b-goals/x-4 | closed | The page asks first and names the changes. "Put back my amounts" restores them. |
| j-one-answer/A1 (house) | closed | The same evidence as F6 on House. |
| p-career-household-system/F4 | closed | A plan-to age below the person's age is refused at the box. Retirement at 20 asks first. |
| p-career-household-system/F7 | closed | The phone box is tel and the email box is email, with autocomplete. |
| p-career-household-system/F8 | closed | Links are named after their pages. Side effect: the calendar shows "Medicare and IRMAA ›", an acronym taken from that page's title. |
| p-career-household-system/F9 | **made something worse** | Biweekly and monthly paydays are right. But the new payday card now invites every Get started household into a yearly "payday" (N1). |
| p-career-household-system/x-1 (people part) | closed for its part | The form stays open after a State save. The typed 59 still reverts until wave 1's draft keeper lands, as the lane said. (e4bc7af says People keeps the typing now; to be checked in round 2.) |
| j-heavy-waiting/W6 (vehicles) | closed | 11200 miles is accepted. |
| address helpers | work | `net-worth?add=…&back=…`, `?add=investment` (Brokerage, cursor in the name), `liabilities/<id>?back=`, `expenses?edit=…&back=`. |

Money checked by hand: Pay off debts on renterDebt with an extra $200 (34 months, $5,265), $50 (44 months, $7,799), $0 (50 months, $9,623) and own order (35 months, $5,819), each against an independent simulation. Refinance $1,022.02. Costly interest $219.75, then $258.29 with Capital One. Biweekly and monthly payday dates. All match.

### New problems (confirmed by a skeptic)

**N1 (severity 5, from f8d44ee): the Money calendar books a whole year's pay as one payday, for every household that came through Get started**
- Steps: a household from Get started (sam: income $48,000, period "annual", no start date). On household/calendar, in "A recent payday for "Sam's pay"", type 11/06/2026 and tap "Show my paydays".
- Seen: the green note says "paydays now follow 11/6/2026", then no pay lines appear in the 3-month view. "A year" shows one line: "Nov 6, 2027 · Sam's pay · +$48,000.00" (Jordan: +$58,000.00). "Save to your phone's calendar" exports it. Get started writes `period: "annual"` by default (`overview/setup/compute.js:660`, `:1981`), so this is what every new household gets. Still the same on e05d6a4.
- Should: a yearly salary is an amount per year, not a payday once a year. Ask how often the pay comes (every two weeks, twice a month, monthly) in the same card, or assume every two weeks and say so. Each payday then shows amount ÷ paydays a year. Never show a $48,000 single payday.
- Cause: `modules/household/calendar/compute.js:66` (the `annual: [12, 0]` step) and `:112` (amount = `inc.amount`), now reached through the `needPayday` card added in f8d44ee. Before that, a salary with no start date got only a note.

**N2 (severity 3): the calendar asks for a payday of a salary that has ended**
- Steps: retiredCouple, household/calendar.
- Seen: a "To show your paydays" card asks for "A recent payday for "Sam's old salary"" with a filled "Show my paydays". That income ended on 2025-12-31. If a date is typed, the note says "paydays now follow 11/6/2026" and nothing appears.
- Should: skip incomes whose end date has passed. With nothing left to ask, there is no card.
- Cause: `modules/household/calendar/compute.js:110-111` pushes to `needPayday` without an `endDate` check.

**N3 (severity 2, from 33c65fd / b9888d1): two filled buttons in view after an add on Net worth**
- Steps: sam, debt/mortgage, "Add the mortgage", name "Home loan", 265000, Add. Or renterDebt, Debts, "+ Add a loan or card", add a card.
- Seen: the green line's filled "Back to Mortgage ›" (397-441) or "Next: its rate and payment ›" (403-447), and the filled "Save today's totals" (712-756 / 662-706). Both are on the 844 px screen.
- Should: one filled button. The notice's way on is the one to fill, and "Save today's totals" is outlined while it shows.
- Cause: `modules/balance/net-worth/view.js:122` and `:124-125` push `filled: true` links, which `said()` draws as `btn` at `:92`. The "Save today's totals" submit at `:239` is always filled.

### Left for wave 1, correctly
B3 (back to the row), second taps, errors that are still prepended on Home's year, notice timers, Rent or buy and Renovation shutting their sections (F6), typing kept across a save.

### Still to check on the real iPhone
The native confirm boxes, the keyboard covering boxes, and the tel and email keyboards (only their attributes were checked here).
