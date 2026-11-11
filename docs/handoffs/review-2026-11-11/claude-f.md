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
