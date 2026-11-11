# FL-CHECKIN: Monthly check-in, Needs attention, Next best action, Our guesses for you, Plan health score

14 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-first-freelancer/x-3 (severity 4, back / input, scope page, owner claude-b, confirmed)
**A guess you kept, or a figure you typed, on Our guesses for you cannot be taken back: the row is gone, there is no Undo and nothing says where the figure lives now**

- pages: overview/guesses
- reach: Every row of Our guesses for you (Keep and Save)
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; open Our guesses for you; in the Rent box type 12500 (a slip for 1,250) and tap Save (or tap 'That's about right' on any row and change your mind).
- saw: 'Saved. Rent is $12,500 a month now. It's yours, so we won't change it. 7 of our guesses moved with it.' The Rent row is gone from the page, there is no Undo (0 Undo buttons) and no link to Rent. 'Insurance and health' changed from $400 to $200 and 'Spending a month once work stops' from $3,730 to $13,740 without being named. The phone's Back leaves the page; it does not undo. 99999999999 is accepted the same way ('Rent is $99,999,999,999 a month now'). The only fix is Expenses, 'See or change each bill', Rent, Edit, which nothing here mentions. The other cards on this same page ('Use these guesses', 'Use the new guesses') do give an Undo.
- should: The green line carries an outlined Undo, as the other cards do, and says where the figure is from now on: 'Saved. Rent is $12,500 a month now. Change it any time on Expenses.'
- why: A layperson who mistypes one zero has changed their whole plan and cannot find where to put it right; someone who tapped 'That's about right' by mistake cannot say 'not sure' again.
- cause: modules/overview/guesses/view.js:293 (keep) and :328 (save) call say("ok", text) without the third argument; the cards pass `undoOf(ctx.plan)` (lines 131, 165, 189, 266) and sayNotice (:54-59) already draws the Undo. The words '7 of our guesses moved with it' come from core/app.js:252.
- fix: Pass `undoOf(ctx.plan)` as the third argument at view.js:293 and :328; end both sentences with where the figure lives, chosen from r.path (expenses: Expenses, debts: Debts, retirement: Will the money last?) as a 44 px link. Optional: at core/app.js:252 name up to two of the guesses that moved (their estimator labels, as guessNote does at :276) instead of a count.
- evidence: $SP/ux/j-first-freelancer/verify/06-saved-typo.png, $SP/ux/j-first-freelancer/verify/06-expenses-after-typo.png, $SP/ux/j-first-freelancer/verify/03-after-keep1.png (scripts v05b, v06)

## j-monthly-return/MR-2 (severity 4, navigate, scope page, owner claude-b pages (overview/dashboard, overview/monthly-review), confirmed)
**From the 11th to the end of the month the Dashboard has no way into the monthly check-in, and says nothing once a month is reviewed**

- pages: overview/dashboard, overview/monthly-review
- reach: every household, about 20 days of every month
- steps: H.family(), Dashboard on 2026-11-11: list every link. Then set the browser's clock (page.clock.setFixedTime) to 2026-11-05, 2026-11-28 and 2026-12-03 and reopen the Dashboard (v1.mjs, v13.mjs). Then mark October reviewed on the check-in and reopen the Dashboard (v12.mjs).
- saw: Nov 11 and Nov 28: 0 of 18 Dashboard links go to #/overview/monthly-review. Nov 5 and Dec 3: the row 'Your October check-in · About ten minutes, once a month · Start ›' is there. The menu's 'Start with' list has no Monthly review (it is under By topic > Overview, 14 pages); search for 'check-in' does find it. After 'October 2026 is done ✓' the Dashboard shows no word about the check-in. Softening fact the walker's fixture hid: with month-old balances the Dashboard does show 'Your balances · The oldest is from 10/9/2026, 33 days ago · Update ›' (v21), so the balances half of the month is reachable; the check-in is not.
- should: While last month has no review, the Dashboard row stays all month ('Your October check-in · not done yet · Start ›'); once it is reviewed the row says 'October check-in done ✓ · next in early December' for the rest of the month.
- why: Ana comes once a month on whatever day she has ten minutes. Two days in three there is no sign that a monthly check-in exists or that October was never closed; the check-in's own page says 'the Dashboard reminds you from the 1st', which is only true for ten days.
- cause: modules/overview/monthly-review/compute.js:57-58 checkInDue() returns null after day LOOK_BACK_DAYS (10); modules/overview/dashboard/view.js:117-118 adds the row only when it is non-null and has no 'done' state.
- fix: checkInDue: drop the day-10 cut-off while plan.reviews has no entry for the month that ended (keep the other guards: accounts on file, something dated before this month); add a 'done' variant of the row. A row only: the one filled button stays the path's (DESIGN_LOG 2026-11-06), and it is the existing row kept longer, not a new walk.
- evidence: $SP/ux/j-monthly-return/verify/v1-dash.png ; $SP/ux/j-monthly-return/verify/v13-dash-nov5.png ; $SP/ux/j-monthly-return/verify/v1-menu.png

## j-first-freelancer/F1 (severity 3, next / focus, scope page, owner claude-b, confirmed)
**Our guesses for you never says how many are left, and every row has its own filled Save beside an empty box (three on the first screen, eight once 'Matters less' is open)**

- pages: overview/guesses
- reach: Every household with two or more guesses (the skipper: 3 + 5; H.sam(): 3 filled Saves plus a filled 'Use the new guesses'; H.patLee(): 2)
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; open Our guesses for you.
- saw: Filled buttons on the first screen: Save, Save, Save (y=417, 611, 827), each beside an empty box; 'That's about right' is outlined. The hero text is the same before and after every Keep; the only count on the page is 'Matters less: 5 guesses' on a folded line. Page 1,513 px (1,935 px with the five open). The way on, one quiet 'Continue your plan: step 2 of 4' row at the end, is the owner's logged rule (2026-11-06) and must stay as it is: the walker's proposed filled 'Done, continue your plan' would be a second way on and should not be built.
- should: One line under the title that counts down in view ('3 to look over', '2 to look over', 'All looked over'); Save outlined until something is typed in its box.
- why: Three identical filled buttons with nothing to save compete for the eye, and a 'not sure' person cannot tell how much of this they are expected to do or how far along they are.
- cause: modules/overview/guesses/view.js:330 (`ui.h("button", { type: "submit" }, "Save")`: no 'secondary' class) and :215-221 (the hero's sentence does not use d.count).
- fix: view.js:330: give Save `class: "secondary"` and drop the class on the box's first input event (or leave it outlined); :217-221: add `${n} to look over` from d.big.length + d.small.length (and 'All looked over' at 0) as the hero's second line. Leave the 'Continue your plan' row alone.
- evidence: $SP/ux/j-first-freelancer/verify/02-guesses-top.png, $SP/ux/j-first-freelancer/verify/02-guesses-full.png, $SP/ux/j-first-freelancer/verify/29-jordan-guesses.png (scripts v02, v03, v29)

## j-first-freelancer/F2 (severity 3, focus / smoothness, scope page, owner claude-b, confirmed)
**After 'That's about right' the row vanishes and the next row slides under the thumb; the third one opens five more guesses with no word that the first group is done**

- pages: overview/guesses
- reach: Every Keep and Save on Our guesses for you
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; open Our guesses for you; tap 'That's about right' on Rent, then Insurance and health, then Spending a month once work stops.
- saw: Each Keep: the row is removed and the green line replaces the one before it ('Kept. Rent stays...' is gone when 'Kept. Insurance...' shows). The next row's box lands where the thumb was: a second tap 120, 350 or 700 ms later focuses the Insurance and health box (3 of 3), which on a phone opens the keyboard. After the third Keep the 'Matters most' card is gone without a word and 'Matters less' is open by itself: page 1,204 px to 1,935 px, five rows, five filled Saves. Narrower than reported on focus: for a thumb nothing is lost (a tapped button does not take focus in Safari, and the app speaks the notice through its live region); the loss matters to a keyboard user only.
- should: The kept row stays for that screen as one line ('Rent: kept at $1,250 a month' with Undo); when the group is finished it says 'Matters most: all looked over' and 'Matters less' stays folded with its count.
- why: 'Did that work? What is this new list?' The person meant to finish three things and is handed five more with no 'done'.
- cause: modules/overview/guesses/view.js:293 (keep, then a full redraw that drops the row), :352 (the 'Matters most' card is drawn only while it has rows) and :360 (`open: big.length ? null : true` opens 'Matters less' as soon as the first group is empty).
- fix: view.js:352: when big is empty but guesses were kept this visit, draw the card with one line 'Matters most: all looked over'; :360: `open: null` unless the page was opened with no big rows at all; show the kept row's result in the row's place for that render (module-level `pending` already carries the text) with the Undo from x-3.
- evidence: $SP/ux/j-first-freelancer/verify/03-after-keep1.png, $SP/ux/j-first-freelancer/verify/03-after-keep3.png, $SP/ux/j-first-freelancer/verify/03-after-keep3-full.png, $SP/ux/j-first-freelancer/verify/23-double-tap.png (scripts v03, v23)

## j-monthly-return/MR-3 (severity 3, next, scope page, owner claude-b pages (overview/monthly-review), confirmed)
**The check-in opens on a month that cannot be finished, and its counts contradict the list under them ('1 of 2 steps' over eight steps; 'Every step so far is done' and a full bar over amber steps; 'is done ✓' over 'All steps (1 of 2 done)')**

- pages: overview/monthly-review
- reach: every household, any day after the 10th; the wording every day
- steps: H.family(): #/overview/monthly-review on 2026-11-11 (v2.mjs). Save the net worth from step 2 and come back (v3.mjs). Tap the 'October 2026' chip, type a note, tap 'Mark October 2026 reviewed' (v12.mjs). H.renterDebt(): the same page (v15.mjs).
- saw: Opens on 'November 2026 review': '1 of 2 steps done: 1 to go' above a list numbered 1 to 8. After the save: 'Every step so far is done.' with the bar full while steps 6 and 7 are amber and 8 is open. November has no Mark button, only the outlined 'Review October 2026 instead' at the very bottom (y 1300); October, never reviewed, is not the month it opens on. After marking October: 'October 2026 is done ✓' and under it 'All steps (1 of 2 done)'. renterDebt: 'All 1 done or on track.' and '1 to fix, 0 to check, 0 to do'. CORRECTIONS to the walker: the October chip is outlined, not filled (the filled chip is the month you are on; the kit's 'filled' flag misreads white chips), and on October there is one filled button, 'Mark October 2026 reviewed'; only the November view has none.
- should: Open on the month that still needs closing (October, until it is reviewed); say what is counted ('1 of 2 things to do done · 3 to look at'); no full bar or 'every step done' while a look step is amber; after marking, no leftover '1 of 2 done'.
- why: She cannot tell which month is 'her' month or how much is left: two steps or eight, done or not. She does get 'Every step so far is done', so she is not stuck, but October is left open unless she notices the outlined button.
- cause: modules/overview/monthly-review/compute.js:30-31 defaultMonth() switches to the current month after day 10 whether or not last month was reviewed; compute.js:195 and :207 count only the chores (status done/todo) as done/todo; view.js:45-47 prints that count and the bar over the full list; view.js:69 'All steps (${d.done} of ${d.todo} done)'; view.js:73-75 the still-going card with the outlined button; step detail strings at compute.js:184 and :187.
- fix: defaultMonth(today, plan): the month that ended while plan.reviews has none for it (and the plan holds something dated before this month), else this month. Hero: '${done} of ${todo} things to do are done' plus 'and ${look} to look at' when look steps are open; bar from the same count but not 100% while a look step is amber. Summary after marking: 'All steps' without the count. Copy: 'All 1 done or on track' -> 'Your goal is on track'; drop zero parts ('1 to fix').
- evidence: $SP/ux/j-monthly-return/verify/v2-mr-nov.png ; $SP/ux/j-monthly-return/verify/v3-mr-after-nw.png ; $SP/ux/j-monthly-return/verify/v12-oct.png ; $SP/ux/j-monthly-return/verify/v12-after-mark.png

## j-monthly-return/MR-7 (severity 3, next, scope several-pages, owner claude-b pages (overview/alerts and the pages its rows open), confirmed)
**Needs attention: every row says only 'Open ›', five of six rows open a page whose first screen has no action, and fixing the worst item leaves '6 things' with a 'to do' that says nothing is to be done**

- pages: overview/alerts, balance/liabilities, balance/liquidity, taxes/withholding, estate/documents, goals/goals
- reach: Needs attention for every household with items
- steps: H.family(): #/overview/alerts; tap each row and note the filled buttons on the first screen (v5.mjs). Tap 'Emergency fund is thin', type 5,400 in Chase checking, save, phone Back (v10.mjs, v11.mjs). Tap 'Visa card is expensive debt'.
- saw: First screen after the tap: no filled action on Emergency fund (its box is at y 847, its Save at y 903, just under the 844 px screen), Withholding check, Debts, Estate documents, Goals; only Life insurance needs has one ('How to get it'). The Visa row opens Debts: an amber note repeats 'Visa card costs about $127 a month…' with no link; 'Open my payoff plan' is outlined at y 936, below the screen. After the fix and Back: heading still '6 things to look at', sub-line '3 to check, 3 to do'; the fixed item is back as 'Emergency fund: enough for now · to do'.
- should: Rows name the action ('Add to your cushion ›', 'Plan the payoff ›', 'Check your paycheck tax ›'); the Visa row opens Pay off debts (or the Debts note carries the link); an item that says 'enough for now' is not counted as a thing to do.
- why: 'Open' does not say what she will do there; on arrival she has to hunt for the action; and after doing the one thing marked 'fix' the count has not moved, with a to-do that says 'enough for now'.
- cause: modules/overview/alerts/view.js:16 hard-codes 'Open ›'; modules/overview/alerts/compute.js:203 sends the expensive-debt alert to balance/liabilities; compute.js:196 adds 'emergency-later' as a counted 'info' (to do) item.
- fix: alerts/compute.js: give each alert a short `act` label and use it in view.js:16 (fallback 'Open ›'); point debt-expensive at debt/payoff (or append a link to the note on balance/liabilities); mark 'emergency-later' as a chore (it then sits in the folded Housekeeping list and is not counted) or reword it as a status line.
- evidence: $SP/ux/j-monthly-return/verify/v5-alerts.png ; $SP/ux/j-monthly-return/verify/v11-visa-dest.png ; $SP/ux/j-monthly-return/verify/v11-alerts-after.png ; $SP/ux/j-monthly-return/verify/v9-liq-landing.png

## p-overview-home/OV-3 (severity 3, understand, scope page, owner claude-b, confirmed)
**Monthly review counts '1 of 2 steps' above a list numbered 1 to 8, and after 'Mark reviewed' the heading sits under the top bar**

- pages: overview/monthly-review
- reach: Monthly review, every household and both months (first-time plan: '0 of 1 step done: 1 to go' above eight numbered steps).
- steps: family household: open Monthly review and read the top. Tap the 'October 2026' chip, type a note, tap 'Mark October 2026 reviewed'. Script: verify/v5-mr.mjs.
- saw: Top: 'November 2026 review. 1 of 2 steps done: 1 to go' and a half-full bar, above steps numbered 2 to 8 (three marked optional, two with orange numbers). On the current month the only filled thing on the page is the selected month chip; there is no filled action. After 'Mark October 2026 reviewed': done in 445 ms, the green 'October 2026 marked reviewed.' is in view and the note is kept (good), but the page got 605 px shorter, the screen was left at scroll 50 and the heading 'October 2026 is done' is cut off under the top bar (its top at 37 px, the bar ends at 56 px). The folded list on the finished month reads 'All steps (1 of 2 done)'. A double tap on the button marks it once (checked at 120, 350 and 700 ms).
- should: Say what the count counts: '1 of 2 must-do steps done. The other six are optional or just a look.' A finished month's fold says 'All 8 steps'. After Mark reviewed the screen goes to the top of the page so 'October 2026 is done' and the green notice are both in view.
- why: All three parts reproduced with my own script and pictures. A person counts eight rows and reads 'two'.
- cause: modules/overview/monthly-review/view.js line 46 ('${d.done} of ${d.todo} steps done', where todo is only the must-do steps) and line 69 ('All steps (${d.done} of ${d.todo} done)') against the list at lines 64-67 that numbers all eight; lines 78-80 mark the month through store.update, and the shell's keepScroll redraw keeps the old scroll position on a page that just lost 605 px.
- fix: Lines 46 and 69: reword as above (no new count needed). Line 49, where the pending notice is drawn: when the notice is the 'marked reviewed' one, call window.scrollTo(0, 0) (the shell lets a page that scrolls itself win). Optional, for the one-filled-button rule: under the hero of an unfinished month, a filled 'Do step N: <title>' linking to the first to-do step.
- evidence: $SP/ux/p-overview-home/verify/mr-nov-full.png, $SP/ux/p-overview-home/verify/mr-after-mark.png

## p-overview-home/OV-4 (severity 3, understand, scope page, owner claude-b, confirmed)
**Plan health score grades a plan that has nothing in it: '15 of 100, Needs work', a full green Debt bar, and no filled way on**

- pages: overview/health-score
- reach: Plan health score for a first-time plan (empty and blank: 15 of 100) and for anyone part-way through the questions (samMidSetup 21 of 100, ruthMidSetup 22 of 100).
- steps: empty household (first open): menu, Plan health score. Script: verify/v6-hs.mjs and v16-final.mjs (hs-mid).
- saw: Ring '15 of 100', heading 'Needs work: 15 out of 100', 'Strong from 85, Good from 70, Fair from 50'. Debt shows 15 / 15 with a full green bar and 'No debt at 10% or more' although nothing was entered. The first row, '+25 Retirement on track', is one link whose text names three pages (People, Net worth, Expenses) and goes to a fourth (Will the money last?). No filled button anywhere on the 2,055 px page; the way on is the quiet 'Start your plan: a few easy questions' row at the very bottom.
- should: Until the basics are in: 'Not scored yet' in place of the ring's grade, one sentence ('Your score appears once we know who you are, what you own and what you spend'), and one filled 'Start your plan: a few easy questions'. No points shown for a part that has nothing to judge. Each row names the one page it opens.
- why: Reproduced for four households. The first thing the eye lands on is a failing grade for a plan the person has not started.
- cause: modules/overview/health-score/view.js draws the ring, the band and the three 'Where the points are' rows (line 44) the same way whether or not compute's 'ready' is true; compute.js line 90 always scores the debt part (no 'unknown' when no debt and no income are on file); each part has one 'go' but a 'fix' sentence built from several pages.
- fix: In view.js: when d.ready is false, draw the hero as 'Not scored yet' with the filled button to #/overview/setup (the same shape as the empty Life timeline, which already does this well) and fold 'All seven parts' below it. In compute.js give the debt part status 'unknown' while the plan has no debts and no income (a scoring-display change, not a formula change; test it). The quiet row from the frame stays (2026-11-06).
- evidence: $SP/ux/p-overview-home/verify/hs-empty-full.png

## p-overview-home/x-1 (severity 3, next, scope page, owner claude-b, confirmed)
**Next best action tells a person with income to add their spending, and its filled button opens Income**

- pages: overview/next-best-action
- reach: Next best action for every household that has income but no spending yet: freelancer and all four stopped part-way through Get started (samMidSetup, jordanMidSetup, patLeeMidSetup, ruthMidSetup): 5 of the 14 households.
- steps: freelancer household: open Next best action, tap the filled button. Script: verify/v16-final.mjs (nba-freelancer), run twice.
- saw: The page says 'It needs: what goes out, on the Expenses page'. Under it the filled button is 'Income' and the outlined one is 'Expenses'. The filled button opens Income, which is already filled in ('$6,500 a month, before tax'); nothing there says what to do next.
- should: One filled button for what is missing, in the person's words: 'Add what goes out ›' (to Expenses). 'Income' appears only when income is missing too. For someone part-way through the questions the filled button picks the questions up where they stopped.
- why: The one filled button on the screen points at the page that is done, and the page that is missing is the quiet one.
- cause: modules/overview/next-best-action/view.js line 42: the two buttons are fixed ('Income' filled, 'Expenses' outlined) whatever d.missing lists on line 42's own <ul>.
- fix: Build the row from d.missing: the first missing page gets the filled button, a second one (if any) the outlined one. No other change.
- evidence: $SP/ux/p-overview-home/verify/nba-freelancer.png

## j-first-freelancer/F12 (severity 2, navigate, scope page, owner claude-b, confirmed)
**Next best action: the row marked 'next' has a pencil and no number, and the row numbered 1 under it is a past-due tax**

- pages: overview/next-best-action, overview/alerts
- reach: Households whose spending is mostly our guesses and who also have something overdue (H.freelancer() after 'Use these guesses')
- steps: H.freelancer(): Dashboard, tap 'Use these guesses', open Next best action.
- saw: Hero 'Your next step: Type what you really spend'. Under 'The order': a pencil row 'Type what you really spend' with a 'next' pill, then '1 Pay the estimated tax that is past due: $6,731 ... since June 15, 2026'. Needs attention lists '2 balances are more than 90 days old' above 'About $6,731 of estimated tax is past due'. Which of the two should come first is a money call for the agents who own that; the navigation part is that the first row has no number and the second is 1.
- should: The first row is numbered like the rest, or the hero adds one line when a later step is overdue: 'Also due now: $6,731 of estimated tax is past due.'
- why: 'Is the tax first or the spending?' A short hesitation; both are plainly on screen.
- cause: modules/overview/next-best-action/view.js:93 (the bills step that waits on guesses gets a pencil in place of its number) and :94 (the 'next' pill).
- fix: view.js:93: keep the number beside the pencil ('1' for bills, the rest follow), or add the one 'Also due now' line under the hero when a step with a due date in the past is not the next one.
- evidence: $SP/ux/j-first-freelancer/verify/11-nba-full.png, $SP/ux/j-first-freelancer/verify/11-alerts-full.png (script v11)

## j-first-freelancer/F11 (severity 2, understand, scope page, owner claude-b, confirmed)
**'in the U.S..' with two periods on four guess rows, and 'N of our guesses moved with it' without saying which**

- pages: overview/guesses
- reach: Rent, Utilities and phone, Car gas and transit, Eating out and fun, for a household with no state; every save that moves other guesses
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; open Our guesses for you and read the rows; type 1 200 in Rent and tap Save.
- saw: 'Our guess: typical rent before utilities for one person in the U.S..' (also on three rows under 'Matters less'). After a save: 'Saved. Rent is $1,200 a month now. It's yours, so we won't change it. 1 of our guesses moved with it.' (7 after 12,500).
- should: One period; name what moved when it is one or two things.
- why: Small, but it is on the first row a new person reads, and 'moved with it' leaves them wondering what changed.
- cause: modules/overview/guesses/view.js:291 adds a period to a `why` that already ends in 'U.S.' (estimators/spend.js:456); core/app.js:252 words the count.
- fix: view.js:291 (and :102, :263): `${String(r.why).replace(/\.$/, "")}.`; core/app.js:252: name up to two moved guesses by their labels (see x-3).
- evidence: $SP/ux/j-first-freelancer/verify/02-guesses-full.png, $SP/ux/j-first-freelancer/verify/06-saved-typo.png (scripts v02, v05, v06)

## j-monthly-return/MR-5 (severity 2, next, scope page, owner claude-b pages (overview/monthly-review, balance/net-worth), confirmed)
**Narrowed: check-in step 2 lands at the top of Net worth with 'Save today's totals' 1,866 px down and nothing pointing to it. The step 1 half is a fixture artifact**

- pages: overview/monthly-review, balance/net-worth
- reach: only when the balances are fresh but no net worth point was saved for the month (for example balances edited one by one on Net worth); the usual visit saves the totals with 'Save all balances'
- steps: H.family(): #/overview/monthly-review > step 2 (v3.mjs). For step 1: the same with every account's asOf set to 2026-10-09 (v21.mjs).
- saw: Step 2 opens #/balance/net-worth?from=review at scrollY 0; the button is at y 1866 of 2,166; no 'Done? Go to …' jump link. Step 1 REFUTED as written: H.family() stamps every balance with today's date, so the step is already ticked and opens Net worth; with month-old balances (what a returning visitor has) step 1 opens #/balance/update?from=review with the back link, and saving there also ticks step 2 ('Every step so far is done').
- should: Step 2 opens Net worth at the Over time card (or its line says 'Save today's totals, at the bottom of Net worth').
- why: In the narrow case she lands on a list of ten accounts with Edit and Delete and has to guess that the step's button is three screens down.
- cause: modules/overview/monthly-review/compute.js:93 (go: update only when balances are stale) and :100 (net-worth step, go: ['balance','net-worth'] with no anchor); modules/balance/net-worth/view.js:151 the button sits in the last card.
- fix: compute.js:100: add query { at: 'history' } to the net-worth step; net-worth/view.js: when ctx.route.query.at === 'history', scrollIntoView the Over time card after render (a page that scrolls itself wins in the shell).
- evidence: $SP/ux/j-monthly-return/verify/v3-step1-landing.png ; $SP/ux/j-monthly-return/verify/v3-nw-before-save.png ; $SP/ux/j-monthly-return/verify/v21-mr-aged.png

## j-monthly-return/MR-8 (severity 2, smoothness, scope page, owner claude-b pages (overview/monthly-review), confirmed)
**Narrowed: after 'Mark October 2026 reviewed' the page shrinks and the 'October 2026 is done ✓' headline ends up cut off under the top bar. The keyboard half is a tooling artifact**

- pages: overview/monthly-review
- reach: the mark-reviewed tap, once a month
- steps: H.family(): #/overview/monthly-review > 'October 2026' chip > drag down to the note, type, tap 'Mark October 2026 reviewed' (v12.mjs).
- saw: Page height 1,499 -> 894, so the screen is pulled from scrollY 655 to 50; the h1 sits at top 37 / bottom 70 with the top bar ending at 56: more than half the headline is hidden. The green 'October 2026 marked reviewed.' is in view. NOT CONFIRMED: 'the note box is hidden when the keyboard is up' (box top 572 of 508): the kit shrinks the window after the box has focus; a real phone scrolls a focused box above its keyboard. Check on an iPhone: tap the note at the bottom of the October check-in and see that the box and the Mark button stay visible.
- should: After marking, the page is at the very top with the whole 'October 2026 is done ✓' card in view.
- why: The one moment that should say 'you are done' shows a clipped headline.
- cause: modules/overview/monthly-review/view.js:79 marks and redraws through store.update; core/app.js:218 keeps the old scroll position, which the shorter page clamps to 50 px.
- fix: monthly-review/view.js: when the pending note is the 'marked reviewed' one, call window.scrollTo(0, 0) at the end of render (the shell lets a page that scrolls itself win, core/app.js:248).
- evidence: $SP/ux/j-monthly-return/verify/v12-after-mark.png ; $SP/ux/j-monthly-return/verify/v12-before-mark.png

## j-monthly-return/MR-9 (severity 2, understand, scope page, owner claude-b pages (overview/next-best-action), confirmed)
**Next best action numbers its steps from zero (a household that overspends sees step '0'), shows '?' in place of a number, and rounds the same figures differently from the Dashboard and Emergency fund**

- pages: overview/next-best-action, overview/monthly-review (step 8 repeats the rounded figures), overview/dashboard, balance/liquidity
- reach: every household on Next best action
- steps: H.family(): #/overview/next-best-action; compare with the Dashboard and #/balance/liquidity (v11.mjs, v8-nba-700.png). Then H.family() with one more expense of $9,000 a month, the same page (v17.mjs).
- saw: The order reads ✓, 1, 2, ?, 4 … 10: the badge is the row's index starting at 0, so the second row is '1' and the fifth is '4'; with spending above income the first row is '0 Spend less than you bring in · next'. Ruth: ✓ ✓ ✓ ✓ then '4 Then: your choice'. Figures: Next best action '$570 more', '($4,770)', 'Left over each month $3,880'; Dashboard '$3,884'; Emergency fund '$568 more', '($4,768)', '$3,884'. Tapping the Dashboard's '$3,884 ›' row opens the page that says $3,880.
- should: Rows numbered 1, 2, 3 … (a 'check' row keeps its number and its pill); one figure, to the dollar, wherever the same amount is shown.
- why: A step called 0, a question mark where 3 should be, and two versions of 'the same' number make her doubt which is right.
- cause: modules/overview/next-best-action/view.js:93 `String(i)` (zero-based) and '?' for status 'check'; modules/overview/next-best-action/compute.js:109 `money = (n) => fmtMoney(Math.round(n / 10) * 10, cur)` rounds to $10 while the Dashboard and Emergency fund show dollars.
- fix: view.js:93: String(i + 1) and drop the '?' (the 'check' pill already says it). compute.js:109: use the exact formatter (line 110) for the left-over figure and the cushion gap, as the other pages do. No DESIGN_LOG entry covers the rounding.
- evidence: $SP/ux/j-monthly-return/verify/v17-nba-zero.png ; $SP/ux/j-monthly-return/verify/v8-nba-700.png ; $SP/ux/j-monthly-return/verify/v10-liq-before-save.png

