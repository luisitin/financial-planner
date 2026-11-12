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

## Round 6 (0701b19): N21 closed, N20 partly

| id | verdict | what was seen |
|---|---|---|
| N21 | closed | On a blank plan, "Set up my plan ›" on Your plan lands on "Let's build your plan". Back returns. Seen in 4 runs at 390 and 320, light and dark. |
| N20 at 320, thumb resting after the keeps | closed | Sampled every 25 ms through a 4 s rest, 4 runs: nothing moved, and the text under both tap points stayed the same. |
| N20 at 390 | **not changed** | At about 1.93 s, scrollY goes from 572 to 156. Everything above "Matters less" jumps down 170 to 400 px, and the link "Open Will the money last? ›" lands where Insurance was tapped. A re-tap there opens Will the money last? (2 of 2 runs). Same as round 5. |
| N20 at 320, after the first swipe | **new form of the same jump** | Six 150 px swipes with a 3 s rest after each, 2 of 2 runs. 1.75 s after the first swipe's finger lifts, scrollY goes from 799 to 319 and everything above the summary slides down about 330 px. The line under the resting finger changes from Spending to Rent. No control landed under the finger in these runs. |
| N16 | still holds | Next-row taps at 600, 800, 1000, 1200 and 2000 ms keep the row every time. |

The 10-page sweep (6 households, 390 light and 320 dark, run twice) found no errors, no overflow, never two filled buttons, and the same figures as before.

### Round 6, re-checked on 096ccb6 (f8b4081)
- After a swipe at 320 and at 390: **closed**. Nothing moves in any rest after a finger lifts. During the first swipe at 320, the space is let go in one frame while the line under the finger stays with it; that is by design and leaves no control under the finger.
- With the thumb resting at 390: **not changed** (4 of 4 runs, light and dark). At about 1.93 s everything above "Matters less" moves down 170 to 415 px. "Open Will the money last? ›" lands where Insurance was tapped, and a re-tap there opens that page. The cause is now `modules/overview/guesses/view.js:51`: a free control below the last tap ("Matters less") skips the `waitScroll` path. The timer at `:70` (`STILL_MS`, `:29`) calls `release()`, and `scrollBy` at `:59` holds only that control still. Should: with no scroll from the person, do not let go on the timer. Wait for their scroll, as 320 now does, or hold still the line under the last tap (`underThumb()`). Severity 2, and the last open item in this lane.

**What is left of N20 (severity 2):** (as seen on 0701b19; see the re-check above)
- The held space is let go on a timer. The let-go-on-scroll branch never runs for a touch swipe: `modules/overview/guesses/view.js:60` sets `waitScroll = false` on the swipe's own `touchstart`, so `:64` is skipped.
- The timer at `:65` then calls `release()`. It keeps one control still (`:47`), and `scrollBy(0, -moved)` at `:56` moves everything above that control.
- Should: let the space go only during the person's own scroll, after `touchend` and in the direction of travel. Or never let it go before the next render.

## Round 5 (40030a9 on 63df567): N17, N18 and N19 closed; one older point confirmed; one small link

| id | verdict | what was seen |
|---|---|---|
| N17 | closed | Benchmarks' bar reads "you 5.7 months" at 5.8 months, "6.4" at 6.42 and "6.1" at 6.07. It matches the sentence, the Dashboard, Your plan and Health score, in light and dark mode. |
| N18 | closed (one link left: N21) | On a blank plan, Next best action, Health score and the check-in fill "Set up my plan ›", their quiet rows say the same, and every one lands on "Let's build your plan". |
| N19 | closed | Pay-only plan: the check-in shows the empty-plan hero with "Set up my plan ›". |

**Across the lanes (63df567):**
- The question numbers and the step names agree for all 12 households.
- The months and left-over figures are the same on every page.
- What differs is by design: the check-in's own monthly step, the page-specific advice on Next best action and Health score, and the skipper's "Add what comes in".
- The 10-page sweep at 390, and at 320 in dark mode, ran twice with identical results: no errors, no overflow, and never two filled buttons on a first screen.

### Problems left (confirmed by a second agent)

**N20 (severity 3 at 320, severity 2 at 390): Our guesses lets the held space go about 2 s after the last keep, and at 320 everything below rises about 400 px under a resting thumb**
- Steps: open Our guesses on the skipper's plan. Keep Rent, keep Insurance and health, keep Spending. Then rest without touching.
- Seen at 320 (4 runs, light and dark mode): no control is on screen after the third keep, so nothing is held still. At about 2.08 s the content below rises about 400 px:
  - "Matters less" moves to y 151 and "These look fine" to y 292.
  - The "Where our guesses come from" summary ends up under the resting thumb, and a re-tap there opens it.
  - "These look fine" ends up where Insurance was tapped, and a tap there writes `guessesLookedAt`.
- Seen at 390 (6 runs): the controls below stay put. Everything above jumps down 170 to 270 px, and "Open Will the money last? ›" lands where the Insurance tap was.
- Should: with no control on screen, keep the last kept line (the one under the thumb) still and scroll by the height let go. Or do not let go until the person scrolls.
- Cause: `modules/overview/guesses/view.js:46-49`. With no free control on screen, `anchor` is null and the function returns without scrolling. At `:52`, `scrollBy(0, -moved)` holds only the anchor still.

**N21 (severity 2): Your plan's "Set up my plan ›" skips the intro**
- Steps: blank plan, overview/plan, then the filled button.
- Seen: it lands on "Question 1 of 7". Every other page's "Set up my plan ›" lands on "Let's build your plan" (`#/overview/setup`).
- Cause: `modules/overview/plan/view.js:77` links `#/overview/setup/you`. The Dashboard and `firstStep()` use `#/overview/setup`.

A note, not a finding: on the blank and pay-only plans, the filled "Set up my plan ›" and the quiet row under it say the same words and go to the same place. The page would read cleaner if the quiet row were left off when it repeats the filled button.

## Round 4 (02be24c, a026463, 917cc9c on 930666f; N16's 6c8faa2 and 01ad1cd on a02d326)

### Closures: 9 checked, 8 closed, 1 partly

| id / claim | verdict | what was seen |
|---|---|---|
| N4, N15 (two question numbers) | closed | In 13 households, the quiet row and the filled buttons always give the same number, and it matches the heading of the screen they open. ruthMid, and jordanMid after adding the mortgage on Net worth, both show "question 6 of 7". |
| N5 (All steps for plans built on the pages) | closed | freelancer and retiredCouple: All steps fills the same "Continue your plan: …" as every other page. |
| N8, N16 (Our guesses rows under the thumb) | closed | Ten runs, light and dark mode: keep Rent, keep Insurance, then tap where Spending's button is, at 600, 800, 1000, 1200 and 2000 ms. Spending is kept every time, and its button never moves (sampled every 25 ms). A swipe after a keep lets the space go with nothing moving. |
| Get started follows the path | closed | samDone, ruthDone, family, renterDebt and the skipper all show "Continue your plan: Your month". |
| "6.1 months" just over target | closed on the lane's pages | 6.07 months reads "6.1 months, a bit over…" on the Dashboard, Your plan, Next best action, Health score and Benchmarks' sentence. Benchmarks' bar label does not follow (N17). |
| The guardian's own field | closed | "Aunt Kay" saves as `who`, the row reads "Chosen: Aunt Kay", and the one filled button becomes "Put the guardian in your will ›". The name is kept across a reload. |
| Pay but no accounts gets "Set up my plan" everywhere | **partly** | It does on the Dashboard, Your plan, Get started, Next best action, All steps and the quiet row. The check-in does not (N19). |

**Across the lanes (930666f):** the next step and its count agree on every page for blank, pay-only, samMid, jordanMid (before and after the mortgage), ruthMid, the skipper, family, renterDebt, samDone, ruthDone, freelancer and retiredCouple. There are three exceptions: the blank plan's quiet row (N18), pay-only's check-in (N19), and the skipper's Next best action, which is by design. The months and left-over figures are the same on every page. A 10-page sweep at 390, and at 320 in dark mode, found no errors, no overflow and never two filled buttons on a first screen.

### New problems (confirmed by a skeptic on a02d326)

**N17 (severity 3): Benchmarks' bar says "you 6 months" beside "aim 6 months" when the cash covers 5.7 months**
- Steps: family, with checking raised until cash covers 5.8 months (or 6.42). Open overview/benchmarks, Emergency fund.
- Seen: the bar is labelled "you 6 months" and "aim 6 months" with "on par", while the sentence under it says "covers 5.7 months". At 6.42 months it shows "you 6 months" with "ahead", while the sentence says 6.4. The svg's label reads the same.
- Should: the label uses `monthsNear(v, aim)`, as the sentence does.
- Cause: `modules/overview/benchmarks/view.js:35` (`show()` uses `fmt.monthsWords`, which rounds to whole months), used at `:52` and `:59`.

**N18 (severity 2): an empty plan gets three wordings and two places for its one first step**
- Steps: blank plan. Open Next best action, Health score and the check-in.
- Seen: the filled "Set up my plan ›" goes to `#/overview/setup`, while the quiet row under it says "Start your plan: a few easy questions ›" and goes to `#/overview/start`. Health score's filled button says "Answer a few easy questions ›".
- Should: "Set up my plan ›" to the same place, everywhere.
- Cause: `modules/overview/guide/compute.js:250` (the not-started branch returns before `firstStep()`) and `modules/overview/health-score/view.js:54`.

**N19 (severity 2): with pay and no accounts, the check-in asks you to update balances you do not have**
- Steps: blank plan plus one salary, no accounts. Open overview/monthly-review.
- Seen: "One thing left to do: update the balances" with a filled "Next: Update the balances ›", while its step 1 says "No accounts yet: add them on Net worth" and the quiet row says "Set up my plan ›".
- Should: the empty-plan hero with "Set up my plan ›", as every other page does for this plan.
- Cause: `modules/overview/monthly-review/compute.js:220` (`empty` also requires no income).

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
