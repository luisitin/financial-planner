# Review of claude-f's lane (Dashboard, Your plan, guides, check-in and the overview pages)

Reviewer: claude-r, from outside the lane. Every finding below was reproduced at least twice at 390x844 with touch in the
sandbox. A second agent that had not found it then tried to refute it on e05d6a4, which includes 629983e. Only what
survived is listed. The stress-test steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).

**Households.** The kit's sam, jordan, ruth and patLee (and their ...MidSetup versions) carry setup answers but no
`guide.setup.startedAt`. Nobody reaches that state by using the app. The households here were rebuilt the way the
question screens record them (`markAt` and `startGuide` on each screen). The skeptic checked this against
`overview/setup/view.js:34`. The households are named samMid (stopped at question 5), samDone, ruthDone, patLeeDone and
renterDebt, plus Dana (the j-first-family household, built with Get started's own apply functions) and a skipper
(freelance, every question skipped, driven through the real screens).

## Round 3 (6a29d2a..7051bc2 checked on 7051bc2; a026463 and 02be24c read but not walked yet)

### Closures: 14 checked, 10 closed, 2 partly, 1 made something worse, 1 passed on to a026463

| id | verdict | what was seen |
|---|---|---|
| N1 | closed | samMid and ruthMid: every row reads "needs your spending". Nothing that is on file is called missing. |
| N2 | closed | "1 of 6 steps done". Step 2 is not ticked and reads "Next step.". renterDebt agrees with the Dashboard (step 2 of 6). |
| N3 | closed | 5.7 months on the Dashboard, Your plan and Needs attention. Left over is $3,884 everywhere. |
| N4 | **partly** | The quiet row now says "question N of 7". When the reached screen resolves past a skipped one, the quiet row and the filled button give different numbers: N15. |
| N5 | **partly → a026463** | Dashboard, Your plan and Get started agree for freelancer and retiredCouple. On 7051bc2, "All steps" still filled "Do step 1: The questions" (`guide/view.js:104` built from `s.next`, not `firstStep()`). a026463 says All steps now asks `firstStep()`; round 4 walks it. |
| N6 | closed | Blank plan: Next best action and the check-in both fill "Set up my plan ›". |
| N7 | closed | October opens with a filled "Next: Save the month's net worth ›" at y 320. Finish is outlined. |
| N8 | **made something worse** | The gaps are gone, but the height is now let go on a timer, under a moving thumb: N16. |
| N9, N10, N12 | closed | One chevron per row. At 320 the filled button sits at 457-520, on the first screen. The tile and the guide share one name. |
| N11 | closed | Undo and "Open this month again" keep the note and say so ("Your note is kept."). Finishing again restores it. |
| N13, N14 | closed | One filled button after "Start here". "Name a guardian in your will ›" opens on "Who would raise the children?". |

Swept 10 pages for 7 households at 390, and for 5 households at 320 in dark mode. No errors, nothing off the edge, never two filled buttons on a first screen, and the money figures were identical on every page.

### Across the lanes (7051bc2): the next step now agrees in every row except these
- A plan whose reached question resolves past a skipped screen (ruthMid without doing anything; jordanMid after adding the mortgage on Net worth) shows "question 6 of 7" on the filled buttons and "question 5 of 7" on the quiet row (N15).
- freelancer and retiredCouple on "All steps": fixed by a026463, per its message; round 4 checks it.
- Skipper on Next best action: the filled button is "Add what comes in", while the other pages show "Your month". This is by design: the page is not ready without income (README line 111), and the path's own "Your month" step waits on pay. Not a finding.

### New problems (confirmed by a skeptic)

**N15 (severity 3): one plan, two question numbers, "question 6 of 7" filled and "question 5 of 7" in the quiet row**
- Steps: jordanMid (stopped at question 5, each debt, with a mortgage picked). On Net worth add Mortgage "Home loan", 210000. Then open Your plan, Next best action, Health score and the check-in. ruthMid shows the same split with nothing done.
- Seen: the filled buttons say "Continue your plan: question 6 of 7". The quiet row says "question 5 of 7", and it opens `setup/spend`, which is headed "Question 6 of 7".
- Should: one number, the one the screen it opens shows.
- Cause: `modules/overview/dashboard/compute.js:78` (`firstStep` takes `sp.q`). `overview/setup/compute.js:2529` (`progress()` returns `q` for the stored screen but `at` for the resolved one). `setupCard` (`start/compute.js:82`) looks `q` up from `sp.at`, so `firstStep` should do the same. The quiet row reaches it through `guide/compute.js:255-256`. Still the same on a026463.

**N16 (severity 3, from 3309ee4): Our guesses lets go of the held height 0.7 s after a tap, so the next row jumps 124 px and the next tap opens "Matters less"**
- Steps: the skipper's plan, overview/guesses. Tap "That's about right" on Rent. Scroll so Insurance and health's button is at about y 300, then tap it. Tap Spending's "That's about right" where it is shown (y 516) 800 to 1200 ms later.
- Seen (4 of 4 runs, light and dark mode, two agents): the button stays at 516 until about 650 ms, then moves to 392. A tap at 800, 1000, 1200 or 1600 ms lands on the "Matters less" summary and opens it, and Spending is not kept. A tap at 600 ms works. Before 3309ee4, a tap at 1000 ms worked. Going down a list at 0.8 to 1.1 s a tap is a person's pace, and the jump comes while the thumb is moving. Nothing is lost; the fold opens by mistake.
- Should: the row under the thumb stays put. Let the height go only when the person scrolls or taps elsewhere, or when the page has been still for about 2 s. Or let it go and scroll by the same amount, so that the content under the thumb does not move.
- Cause: `modules/overview/guesses/view.js:27-34` (`HOLD_MS = 700`, and `holdHeight`'s timer), used at `:297`, `:320` and `:432`.

## Round 2 (629983e checked on 453ed8a, MR-7's pages 277855f and 2603b46 on a1eeaba; the new problems were re-checked by a skeptic on a1eeaba)

### Claims: 12 checked. 8 closed, 2 made something worse, 1 partly, 1 not tested

| claim | verdict | what was seen |
|---|---|---|
| A late check-in can finish the net worth step | closed | family and demo on Nov 11, October: "$287,100 saved on 11/11/2026, after the month ended: up $30,100". |
| A finished month can be undone, or opened again | **made something worse** | Both work, but both delete the month's note: N11. |
| Our guesses: kept lines in row order; "All looked over" after the last; a figure far off the guess asked about once | closed | 8 keeps in mixed order come out in row order. The far-off rent gets a red line in view and the cursor stays put. The blank gaps of round 1 N8 now fill the whole card (about 8 × 165 px). |
| Our guesses: the Better guesses card keeps its place | not tested | No household with upgrade offers was built. |
| Health score: no grade part way through the questions; a finished setup opens the missing page | closed | samMid: "No score yet", one filled "Continue your plan: question 5 of 7". The skipper: "Add what you own ›" goes to Net worth. |
| Needs attention: "Add it on Expenses" when there are no expenses | closed | (On a blank plan this is still round 1's N6.) |
| Get started tiles named as the guides name themselves | **partly** | 5 of 6 match. "Spend less, save more" (`overview/start/compute.js:59`) against the guide's "Spend less and save more" (`overview/guide/journeys.js:241`), although the comment at `start/compute.js:54-55` says they match. |
| MR-7, taxes/withholding | closed | Opened from Needs attention on family, demo and patLee: one filled "Get a new W-4 form ›" on the first screen (y 574). It opens the IRS form. On a blank plan: "Add your income". At 320 px the button is below the first screen, which is expected. |
| MR-7, estate/documents | closed | "Name a guardian ›" opens that row's form in place, in the middle of the screen, with focus on Status. On a blank plan: "Start here: Will for you ›". (Two small points: N13, N14.) |
| Regressions on health score, alerts, start, dashboard, next best action | none new | Checked blank, samMid, samDone, ruthDone, family, retiredCouple and freelancer at 390 px, and at 320 px in dark mode. Round 1's N4, N5 and N6 are still there. |

### New problems (confirmed by a skeptic)

**N11 (severity 4, from 629983e): Undo, or "Open this month again", on the check-in deletes the month's note without a word**
- Steps: family, overview/monthly-review (October). Do step 2 and come back. Type "Car repair this month" in "A note for the month". Tap "Finish the October 2026 check-in", then Undo in the green line. Or finish it with the note and later tap "Open this month again".
- Seen (4 of 4 runs): `plan.reviews` goes from `[{month: "2026-10", note: "Car repair this month"}]` to `[]`. The box is empty and the note is gone from "Months checked in". The notice says only "Undone: October 2026 is open again.". A note on any older month that is opened again is lost the same way.
- Should: the note survives. Keep the entry with a reopened mark, or hold the note and put it back in the box so that finishing again keeps it. The comment at `compute.js:244` already says "its note kept in the view".
- Cause: `modules/overview/monthly-review/compute.js:244-248` (`unmarkReviewed` drops the whole entry), `view.js:65` (`reopen`), and `view.js:92` (the box fills from the entry that is gone).

**N12 (severity 2): "Spend less, save more" on Get started, "Spend less and save more" in the guide**
- This is the "partly" row above. Use one name on both.

**N13 (severity 2, from 277855f): Estate documents on an empty plan shows two filled buttons after "Start here"**
- Steps: blank plan, estate/documents. Tap "Start here: Will for you ›".
- Seen (4 runs, two agents): the page scrolls 343 px. The hero's filled "Start here: Will for you ›" stays readable just under the top bar (y 49), and the row form's filled "Save" sits at y 681. Tapping the hero button again only reopens the same form.
- Should: one filled button. Outline the hero button while its row is open, or scroll the row to the top of the screen.
- Cause: `modules/estate/documents/view.js:95` (`scrollIntoView({ block: "center" })`) and `:37` (the button stays `btn`).

**N14 (severity 2): "Name a guardian ›" opens a status form**
- Steps: family, estate/documents (or the Needs attention row), "Name a guardian ›".
- Seen: the form shows Status ("Not yet"), a date, "Where the original is kept" and Notes. The guardian's name goes only in Notes, and only the small help text under it says so.
- Should: the wording the app uses elsewhere, "Name a guardian in your will" (`household/life-events/data/events.js:45`, `insurance/life-needs/view.js:597`). Or a Notes label that asks "Who is the guardian?".
- Cause: `modules/estate/documents/compute.js:71` and `modules/overview/alerts/compute.js:105`.

## Round 1 (closures on 1f2e681; new problems re-checked on e05d6a4)

### Closures: 33 checked, 29 closed, 4 partly

| id | verdict | what was seen |
|---|---|---|
| p-overview-home/x-1 | closed | Freelancer: the filled button is "Add what goes out ›". Mid-setup: "Continue your plan: question 5 of 7". |
| j-first-freelancer/F12 | closed | "Type what you really spend · next" comes first. |
| j-monthly-return/MR-9, j-navigator/N7 | closed | Rows start at 1. Left over: $3,884 on Next best action, the Dashboard and Emergency fund. |
| p-overview-home/OV-5 | closed | Rows read "Open Emergency fund ›" and similar. (Health score has a double chevron, N9.) |
| j-first-freelancer/x-4 | closed | Skip-all: "Next: Your month, step 2 of 4"; the tile says "Change an answer". |
| j-first-renter/F5 | closed | "Continue your plan: question 3 of 7 ›" at y 303, with "What you have answered is kept." |
| p-overview-home/OV-7 | closed | Blank plan: a filled "Set up my plan ›", and no Start here tile. |
| j-first-freelancer/F3, p-overview-home/OV-2 | closed | "What's in your plan: 4 of 6 basics" is folded while the path is under way. This matches the design log: 2026-09-15 pass 2 put "Do step N" under the list only because the page had no filled button, and 2026-11-06 made "Continue your plan" that button. |
| j-debt-fixer/D4 | closed | "Your month works. Your emergency fund is thin." |
| j-monthly-return/MR-2, MR-3, p-overview-home/OV-3 | closed | Checked with the clock set to Nov 11, Nov 28 and Dec 3. The counts say what they count. |
| j-monthly-return/MR-8 | closed | After Finish, the heading is at 87 px, under the top bar, and the notice is in view. |
| j-monthly-return/MR-7 (lane half) | closed | Each row names its action. (Claimed by claude-f for the two destination pages on 342185b; round 2.) |
| p-overview-home/OV-4 | closed | "No score yet", one sentence, one filled button. |
| j-first-freelancer/x-3, F1, F2 | closed | Undo works. The page says where each figure lives now. A count is shown. No filled button competes. A second tap lands on the kept line. (The kept line leaves a blank gap, N8.) |
| j-first-freelancer/F11 (lane half) | closed | "in the U.S." has one period on the guesses page. "6 of our guesses moved" is core/app.js (wave 1). |
| j-hard-conditions/HC-3 | **partly** | At 320x568 the family's only filled button sits at y 532-595, cut by the screen: N10. |
| j-first-family/F4 (lane half) | closed | Dana's Dashboard has no "below" and no second "first". |
| j-first-family/x-2 (lane half) | **partly** | The Dashboard says 5.7 months. Your plan and Needs attention round it up to 6: N3. |
| j-first-renter/x-1 (lane half) | **partly** | The Dashboard rows say what is needed. Your plan still lists things that are on file as missing: N1. |
| j-first-renter/x-2 (lane half) | closed | Retirement's "Not known yet" opens question 4. |
| j-first-retiree/x-3 (lane half) | **partly** | Your plan says "step 2 of 6". The "All steps" page still ticks step 2 and calls it done: N2. |
| j-monthly-return/MR-5 (lane half) | closed | Step 2 names "Save today's totals" at the bottom of Net worth. |
| p-overview-path/OP-7, j-one-answer/A2, A4 (list), p-overview-home/x-2 | closed | "Do step N" is on the first screen in all 12 openings. The tiles show minutes. Two new Quick answers are answered from the plan. All pages keeps its search after Back. |
| j-first-renter/F4 (path), j-first-freelancer/F5, j-first-family/F9, j-first-renter/F9 | closed | The step card names its step and says what it waits for. |

### New problems (confirmed by a skeptic; all still there on e05d6a4)

**N1 (severity 4): Your plan says your pay, savings, Social Security or ages are missing when they are on file**
- Steps: samMid (pay $48,000, $2,000 in accounts, a Social Security estimate, stopped at question 5). Open overview/plan. Repeat with Ruth, also stopped mid-way.
- Seen: "Your month: needs your pay and spending", "Emergency fund: needs your spending and savings", "Your retirement: needs your Social Security". Ruth's row reads "Where to take money from: needs your ages and savings", although her birth date and $429k are on file. The Dashboard beside it says only "Needs what you spend each month", which is the one thing missing.
- Should: name only what is missing, and link there, as the Dashboard now does.
- Cause: fixed fallback words in `open(...)` at `modules/overview/plan/compute.js:80`, `:100`, `:127` and `:146`. At `:127`, `retirementGap()` returns null when Social Security and the birth date are known, so the default "your Social Security" shows. `:80` also links to the pay question instead of spending.

**N2 (severity 3): "All steps" ticks and strikes through the step it then asks you to do**
- Steps: samDone, family or renterDebt. Dashboard, then "Continue your plan", then "All steps ›" (overview/guide/plan).
- Seen: "2 of 6 steps done", then the filled "Do step 2: See your month", and step 2 is ticked and struck through. renterDebt says "3 of 6 steps done" while the Dashboard and Your plan say step 2 of 6.
- Should: count and tick only steps that were passed (the j-first-retiree/x-3 rule). The step the button names is shown as next. The page uses the same step name as the other pages ("Your month").
- Cause: `modules/overview/guide/compute.js:116` counts `doneCount` by data, while `:122` takes next as the first step not passed. `guide/view.js:92-117` draws the count and the tick from the first and the button from the second.

**N3 (severity 3, j-first-family/x-2 left): 5.7 months is said as "6 months" next to "build it to 6 months"**
- Steps: family with 23,300 added to checking. Open the Dashboard, then Your plan, then Needs attention (Housekeeping fold).
- Seen: the Dashboard says "5.7 months". Your plan says "6 months" beside "build it to 6 months once the costly debt is paid". Needs attention says "Usable cash covers 6 months … builds this to 6 months".
- Should: `monthsNear(m, target)` (core/words.js), as the Dashboard does.
- Cause: `modules/overview/plan/compute.js:36` (`monthsOf`) and `modules/overview/alerts/compute.js:210-212` (`wholeMonths`). The same file's "bad" line already uses `monthsNear`.

**N4 (severity 3): part way through the questions, Next best action shows two counts for one next step**
- Steps: samMid (or jordan or ruth, stopped mid-way). Open overview/next-best-action.
- Seen: a filled "Continue your plan: question 5 of 7 ›" at y 331, and just under it the quiet "Continue your plan: step 1 of 5 ›". The quiet row says the same on the check-in, Our guesses and every page that carries it.
- Should: while the questions are under way, the quiet row says "question N of 7", as `homeNext` does.
- Cause: `modules/overview/guide/compute.js:244-251` (`continueFor` numbers path steps, not questions).

**N5 (severity 3): a plan built on the pages, without Get started, gets three different next steps**
- Steps: freelancer, then retiredCouple. Open the Dashboard, Your plan and Get started.
- Seen: the Dashboard says "Continue your plan: Enter what goes out ›" (retiredCouple: "Set your first goal ›"), with no count. Your plan says "You're on step 1 of 5" with a filled "Continue: The questions ›". Get started says "Build my plan · Let's go", as if nothing were there.
- Should: one next step and one count on all three pages.
- Cause: the Dashboard's "basics" branch (`modules/overview/dashboard/compute.js:52-55`) is not shared by `overview/plan/view.js:89`, `:183` or `overview/start/view.js:78`.

**N6 (severity 2): an empty plan gets its own first step from Next best action and from the check-in**
- Steps: blank plan. Open overview/next-best-action, then overview/monthly-review.
- Seen: Next best action has a filled "Add what comes in ›" (Income). The check-in says "One thing left to do: update the balances" with a filled "Next: Update the balances ›", while its step 1 reads "No accounts yet". The Dashboard, Your plan, Get started and Health score all point to the questions.
- Should: the questions on all of them, until there is a plan to check in on.
- Cause: next-best-action's missing-pages button when the setup state is "new". monthly-review/compute.js has no guard for a plan with nothing in it.

**N7 (severity 2): the check-in on the month to close names its one thing left but gives no button for it on the first screen**
- Steps: family, overview/monthly-review (it opens on October).
- Seen: "One thing left to do: save the month's net worth." Nothing filled is on the first screen. The only filled button, "Finish the October 2026 check-in", is at y 1420. November's view has "Next: Save the month's net worth ›".
- Cause: `modules/overview/monthly-review/view.js:59` draws the "Next: …" button only when `!d.ended`.

**N8 (severity 2): kept guesses leave tall blank gaps**
- Steps: skipper plan, Our guesses for you. Tap "That's about right" on three rows.
- Seen: each kept line keeps its old row's 194-215 px height around 22-45 px of text, leaving over 500 px blank after three. The emptied "Better guesses" card keeps about 330 px.
- Should: hold the height only for the moment a second tap could land (about 700 ms), then let it go. Alternatively, shrink it with the thumb's row kept in place.
- Cause: `modules/overview/guesses/view.js:308`, `:417` (`minHeight`) and `:286` (`visit.upH`). The double full stop is fixed on 629983e.

**N9 (severity 2): Health score rows show "Open <page> ›" followed by a second "›"**
- Steps: family, overview/health-score, "Where the points are".
- Cause: `modules/overview/health-score/view.js:75` (`opens(p)` with a `span.chev`).

**N10 (severity 2, HC-3 left): on a 320 px phone the Dashboard's one filled button is cut off at the bottom of the first screen**
- Steps: family, 320x568, Dashboard.
- Seen: "Continue your plan: Your month ›" spans y 532-595 on two lines, so the 568 px screen shows only the top of its first line. The new "Your October check-in" row pushed it down. A real browser bar hides more.
- Should: the filled button is fully visible on the first screen at 320x568. Either put it above the summary rows, or fold the check-in row into the summary.
- Cause: the layout in `modules/overview/dashboard/view.js:31-34`.

## Across the lanes: one next step per household (e05d6a4)

| household | Dashboard | Your plan | Get started | Next best action | Monthly check-in |
|---|---|---|---|---|---|
| empty / blank | Set up my plan | Let's go | Let's go | **Add what comes in** (N6) | **Update the balances** (N6) |
| samMid / jordanMid / ruthMid | question 5 of 7 | question 5 of 7 | question 5 of 7 | question 5 of 7 + **"step 1 of 5"** (N4) | own step + **"step 1 of 5"** (N4) |
| skipper | Your month, step 2 of 4 | step 2 of 4 | not run | not run | not run |
| family / demo | Your month, step 2 of 8 | step 2 of 8 | step 2 of 8 | the spare-money step (by design) | October, Finish |
| renterDebt | step 2 of 6 | step 2 of 6 | step 2 of 6 | agrees | agrees; "All steps" says **3 of 6** (N2) |
| samDone / ruthDone / patLeeDone | Your month, step 2 of 6 | step 2 of 6 | step 2 of 6 | agrees | agrees |
| freelancer (no Get started) | **Enter what goes out** | **step 1 of 5, The questions** | **Let's go** | Add what goes out | step 1 of 5 (N5) |
| retiredCouple (no Get started) | **Set your first goal** | **step 1 of 7, The questions** | **Let's go** | none filled | step 1 of 7 (N5) |

### For the Get started lane (claude-e now holds overview/setup), seen in passing
The reveal still says "The moves below start there" and ticks "✓ Your month" before "Next: Your month". The setup spend screen shows "U.S.." with a double full stop. claude-f asked for these on 2026-11-11 21:30. Round 2 will check them on the Get started commits.

### Left for wave 1, correctly
"6 of our guesses moved" naming nothing (core/app.js), the keep-place half of F2, MR-4, A3, x-backlink-history.
