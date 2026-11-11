# Review of claude-e's lane (retirement, scenarios; then Get started)

Reviewer: claude-r, from outside the lane. Each finding was reproduced at least twice, at 390x844 with touch, in the sandbox. A second agent, who had not found it, then tried to refute it on 1f2e681 and again on e05d6a4. Only what survived is listed below. The stress-test steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).

## Round 3 (ec3f1bd walked on ec3f1bd; leftovers re-checked on 259a4f8, which includes daf338a)

### Closures: 7 checked, 3 closed, 1 partly, 3 not yet answered

| id | verdict | what was seen |
|---|---|---|
| N1 (Social Security "69 000") | not yet answered | Still there. A green "saved" appears and the benefit drops from $2,650 to $0 a month (family). patLee drops from $3,044 to $0. |
| N2 (Advisor's plan on a blank plan) | not yet answered | Still there. "Compared: their plan is below" appears with nothing below it. (claude-b's fe678cb changed only the chance on this page.) |
| N3 (projection buttons move) | not yet answered | Still there. The two buttons move from 441/516 to 463/538 at 0.49 to 0.54 s on family and demo. Financial independence moves from 514 to 539 at 0.62 s. |
| N4 (a way to the box) | closed | "Fix Ann's year ↑" is 44 px and outlined. A tap brings the box to the middle of the screen with the cursor in it, at 390 and at 320 in dark mode. Continue stays the only filled button. |
| N5 (no "thin" without savings) | **partly** | The empty-plan case now says "A few more answers will fill this in". It is still said correctly when savings are given and thin. Left over: pay given and no savings, see N8. |
| N6 (slow double tap past the low-pay ask) | closed | A second tap at 300 or 500 ms is ignored, and the ask stays. At 800 ms or later it counts. A deliberate tap about 2 s after the ask keeps the answer. The ask's own buttons are never under the second tap at any height. |
| N7 (the reveal by address part way through) | closed | Done at questions 3, 5 and 7 goes back to the question reached, with no "finished" stamp. Back, Forward and Reload stay there. |

No regressions on Get started:
- One filled Continue on every question.
- Reload and Back keep the answers.
- The retiree (born 1953, pension) and a family typed through both agree with the Dashboard right after finishing, apart from N9 below.
- Checked at 390 and at 320 in dark mode.

### New problems (confirmed by a skeptic on 259a4f8)

**N8 (severity 3, N5's leftover): with pay given and no savings, the reveal still says "Your emergency fund is thin."**
- Steps:
  1. Start on an empty plan and open Get started.
  2. Choose one person, "I work", $4,000 "A month".
  3. Skip questions 3 to 5.
  4. Type 2,100 for spending.
  5. Skip question 7 and go to the reveal.
- Seen: "Your month works. Your emergency fund is thin." The Emergency fund tile beside it says "Not yet. Needs your savings. Add them ›". The plan has no accounts.
- Should: with no cash accounts, the headline is "Your month works." plus, if a second sentence is wanted, "Add your savings to see your emergency fund."
- Cause: the guard at `modules/overview/setup/view.js:1793` (`!any && hasSpend`) does not cover this plan, because `any` is true once there is a left-over figure. The view knows the tile is empty (`cushionOpen`) but does not pass that to the headline. The words come from `setup/compute.js:2433-2435`: with no accounts the runway is 0, not null, so the status is "bad". `dashboard/compute.js:105` then rewords it. If the compute half waits on claude-c, the view can still skip the sentence when `cushionOpen`.

**N9 (severity 2): the reveal and the Dashboard give different verdicts on the same 2.9 months**
- Steps: start on an empty plan and type through Get started:
  1. Ana, "Me and my spouse", Bo, two children.
  2. Ana's pay $5,200 and Bo's $4,800, both "A month".
  3. Born 1990 and 1988.
  4. Checking 6,000, Savings 14,000, Retirement 85,000 and 40,000.
  5. Car loan and Mortgage, leaving the amounts as guesses.
  6. Spending 6,500.
  7. Choose "An emergency fund" and "Retiring well", then tap "See where I stand". Then open the Dashboard.
- Seen: the reveal says "2.9 months … Aim for 3." with "● Worth building up". The Dashboard row for the same plan says "Enough for now; 3 months after the costly debt". The plan has a $22,000 car loan, so `cushionLater` is set.
- Should: the reveal says what the Dashboard and Your plan say when `cushionLater` is set.
- Cause: `modules/overview/setup/view.js:1821` (the last branch of `cushionFig` does not check `st.cushionLater`). Compare `dashboard/view.js:135` and `plan/compute.js:132`.

## Round 2 (Get started and f80661e on 453ed8a; new problems re-checked on f9b130e)

### Closures: 31 checked, 27 closed, 1 partly, 3 not judged (waiting on claude-c, or no steps in the hand-over)

Checks that held across all of them:
- Every question has exactly one filled button.
- Reload in the middle of a question keeps what was typed. Back works three ways (the "‹ Back" link, the top ‹, the phone's Back).
- Right after finishing, the reveal's "Next: Your month" matches the Dashboard, Your plan and Get started's first screen, for the retiree (born 1953, pension) and for the skipper.
- No page errors, nothing off the right edge, and no figure moved, at 390, at 320 in dark mode, and sideways.

| id | verdict | what was seen |
|---|---|---|
| p-retirement-b/RB2, p-retirement-a/R-A9, p-retirement-b/RB3 | closed | Empty retirement pages: one filled "Add people ›", outlined "Add what you own ›" and "Type what you'll spend ›" (the cursor goes into the spending box), and no inline links. |
| p-retirement-a/R-A10 | closed | Projection spending 99999999999 is refused at the box. The saved figure stays. |
| j-first-retiree/R4 | closed | "I've taken it" is outlined and has an Undo. How much to take out offers "Put it back: Same spending every year". |
| p-cashflow-a/CF-8, the cash-flow key | closed | Rows show "Edit ›". The key follows the order chosen on Withdrawal order. |
| j-first-retiree/R3 | closed | A year typed as "53" holds Continue, with the ask at the box. Fixed to 1953, the plan keeps $2,100 of Social Security and the $1,800 pension, and the reveal says "$1,382 left over". (Small: a 73-year-old is told "like 1985".) |
| p-overview-path/OP-2, j-fat-fingers/FF3, j-first-renter/F1, j-first-family/F5, F7 | closed | 85, 195, 2027 and a child's 15 hold Continue. 1900 asks once. A rate of 69% asks "Did you mean 6.9%?". The loan help covers more than one loan. (When the box to fix is off screen: N4.) |
| j-hard-conditions/x-1, j-keyboard-reader/K7, j-first-renter/F3 | closed | The key on the box says "done", and focus goes to the next choice, in view with the keyboard up. |
| j-first-renter/F8, p-overview-path/OP-3, j-first-retiree/R2 | closed | The ask sits right above Continue, with an "It is $3,200 a month" button. A second tap 150 to 700 ms later is harmless, except when Continue sits at the bottom edge (N6). |
| j-first-renter/x-1 (setup side) | **partly** | A Save from a Dashboard row goes back. No on-screen route leads to the reveal part way through the questions. But the reveal opened by its address part way through stamps the questions finished (N7). |
| j-first-renter/x-2 (setup side), j-first-freelancer/F4, p-overview-path/OP-6, HC-4 | closed | "Add them ›" goes to the question 4 ticks, and the tile then says "On track". The skip-all reveal is plain. Sideways, the first box is at 259. |
| j-first-retiree/R6 (view side) | closed for the view | No "Most people do". No debt goal after "debt-free". "Making the money last". ("well over the 6 you want" waits on claude-c.) |
| claude-f's hand-over | closed | Nothing is ticked before its turn. "1.4 months … Aim for 6". The "have" link works. A Save from `?back=done` part way through goes back. "The moves below" is not seen. |
| j-first-family/F1, review5 1-4 and 7 | not judged | F1's report waits on claude-c. review5's steps are not in the hand-over. |

### New problems (confirmed by a skeptic on f9b130e)

**N4 (severity 3): when a birth year is wrong, the ask names the box but gives no way to it, and the box can be a screen above**
- Steps: start from an empty plan and open Get started. Enter Ann, choose "Me and my spouse", enter Bo, Continue, Skip. On question 3, type 85 for Ann and 1984 for Bo, then tap Continue.
- Seen: "Ann: We can't use 85. Type the year as four digits, like 1985." appears just above Continue at y 683. Ann's box and its own red line are at y −333 and −275, off screen. Focus stays on Continue. The only year box on screen is Bo's. Same at 320 in dark mode with one person and "195".
- Should: the ask carries a button, "Fix Ann's year ↑", that scrolls the box into view and puts the cursor in it. 6a65660 stopped focusing the box on purpose, because the keyboard covered the message. A tap on the button is the person's own choice, so the keyboard opening then is fine.
- Cause: `modules/overview/setup/view.js:389-399`. `askHere` drops its `focus` argument (`void focus;`), and the ages check passes the box at `:909`.

**N5 (severity 3): the reveal says "Your emergency fund is thin." when no savings were ever given**
- Steps: start from an empty plan. Skip every question except question 6, type 2100 there, and go to the end. Alternatively, skip everything, then Change an answer, What you spend, 2100, Save.
- Seen: "You're set up. The numbers come next." followed by "Your emergency fund is thin.". The plan has no accounts, and the Emergency fund tile says "Not yet. Needs your savings. Add them ›". If question 6 is skipped as well, the sentence is the plain "Your real spending decides…".
- Should: no verdict on savings that were never given. Use the plain sentence, or no sentence, while nothing is in the plan (`!any`).
- Cause: `modules/overview/setup/view.js:1735` prints `calmHeadline(st.headline)` even when `any` (`:1726`) is false. The headline comes from `compute.js:2433-2435`, where `runwayStatus` is worked out with no cash. That compute part is claude-c's file. The view half is yours.

**N6 (severity 3, page-specific, not covered by wave 1's second-tap guard): a slow double tap on Continue skips the low-pay question unread**
- Steps: one person, "I work", Pay 3200, left on "A year". Swipe so that Continue sits at about y 760 (it ends up there after the screen scrolls to it). Tap it, then tap the same point again 300 or 500 ms later.
- Seen: the low-pay ask is inserted above, so Continue stays under the thumb. The second tap moves on to question 3 and saves $3,200 a year. That is a figure 12 times too small for someone who meant a month, which is the mistake the ask exists to catch. Seen in 4 of 4 runs. With Continue at 650 to 740 px, the second tap lands on the ask and nothing happens.
- Why wave 1 will not catch it: `askHere` does not redraw the page, and the tap lands on the same element, so neither shell guard proposed in SH-TAP applies.
- Should: a Continue within about 800 ms of an ask is not taken as "keep it".
- Cause: `modules/overview/setup/view.js:403-414` (`forward()`: `askedOnce` accepts the next Continue at any delay).

**N7 (severity 2): the reveal opened by its address part way through the questions marks them finished**
- Steps: start from an empty plan. Skip to question 5, then type `#/overview/setup/done` in the address (a bookmark or the phone's Forward do the same).
- Seen: `finishedAt` is stamped and `at` becomes "done". Get started then says "Step 2 of 4 … Continue: Your month", and questions 5 to 7 are never asked. No on-screen route leads there.
- Should: part way through, `done` sends the person back to the question they reached (the third part of j-first-renter/x-1).
- Cause: `modules/overview/setup/view.js:1706` (stamps through `atScreen` without checking that the questions are done).

## Round 1 (retirement and scenario closures on 1f2e681; new problems re-checked on e05d6a4; Get started not yet reviewed)

### Closures: 30 checked, 26 closed, 2 partly, 2 left open (the reasons hold, one now fixed)

| id | verdict | what was seen |
|---|---|---|
| j-hard-conditions/HC-2 | closed | family at 4x slowdown: "Checking your plan against bad years..." changes straight to "It lasts in most cases, not all". There is no false "The money lasts" in between. A second visit shows the answer at once. (The pill line still moves the buttons: N3.) |
| p-retirement-a/R-A1 | closed | Financial independence says "Working out when Ana could stop work..." before its answer. (Its buttons move 25 px at about 0.6 s: N3.) |
| j-heavy-waiting/W5 | closed | Goal seek's heading and pill say "Checking..." until the answer arrives. Nothing moves. |
| j-heavy-waiting/x-3 | closed | Page width stays 390 throughout. The waiting bar stays inside its card. |
| j-one-answer/A9 | closed for patLee, partly for family/demo | No bar sits off its card. On family and demo the pill line moves the buttons (N3). |
| p-retirement-a/R-A3 | closed | "69k", "hello world", a year in the future and -5 are each refused in plain words. Enter saves. "Not yet recorded" is skipped. (Space or dot thousands marks are not refused: N1.) |
| j-first-freelancer/x-5, p-retirement-a/R-A5 | closed | A blank plan shows one filled "Add people ›", with the settings folded and "spending not set yet". |
| j-one-answer/x-3 | closed | "Type what you'll spend ↓" opens the settings box with the cursor in it. Enter gives the answer. The "saved" line is off screen; that is wave 1. |
| j-first-renter/F4 (projection, goal seek) | closed | sam: "We don't know yet", with no chart and no figures. |
| j-one-answer/A6 | closed | "Change the age ›" is 44 px tall. The button now says what it does. |
| p-retirement-a/R-A8 | closed | Contributions and the projection say what the other pages show, and give a way on. |
| j-fat-fingers/FF8 (contributions) | closed | No small targets left. |
| p-retirement-b/RB4 | closed | "$450,880 left" and "... to convert", with the key above the list. |
| p-retirement-b/x-4 | closed | A filled "Use ... with the real tax rates" is on the first screen. "Work out tax at the real rates" says what it did. |
| x-annuity-added-not-shown | closed | A blank plan shows what is missing as buttons, and no form. |
| RC-9 | closed | "This quote costs $250,000 and your savings are about $192,700, so the plan cannot pay for it today." |
| RC-2 | closed | An Annuity or Pension entered with only a name is refused at its boxes. The bubble wording is wave 1. |
| RC-1 | **partly** | family: an empty Compare is refused, and a fee compares. A blank plan says "Compared" when nothing was compared (N2). |
| RC-8 | closed | "Chance it lasts 37% −40 points", then "If markets do as well as average". |
| RC-5 | closed | Health saves on the tap, says so, and is kept after Back. |
| RC-6 | closed | "Plan to 96 instead of 95", then "Plan to 99" after health. For family, only Ana changes (1990+99 = 2089), checked by hand. |
| j-heavy-waiting/x-2, x-stress-link-wrong-name | closed | Each button names the page it opens. |
| RC-4, W6 (goal seek) | closed | 1500, 1.5m and 750,500 are taken. -100 and abc are refused in plain words. |
| RC-10 | closed | The six buttons name their pages. |
| R-A10 (Social Security part) | closed | 99999 a month is refused. The projection part was not taken, as the lane said: 99999999999 for spending still saves. |
| d1973e2 follow-ups | closed | All six checked. |
| W7 | **fixed on e05d6a4 (16e12ed)** | family: Compare shows 80% and Chance the money lasts shows 80%; Ruth shows 100% on both. Small side effect: "Retire 3 years earlier" reads "about 35%" before a visit to Chance the money lasts and "40%" after it. |
| p-retirement-b/x-5 (left open) | the reason holds in part | It still moves on e05d6a4: family's first "Use this one" goes from 878 to 999 at 0.54 s, and ruth's from 747 to 813 at 0.17 s (on screen). Suggestion: draw the late parts (the careful line, `careLine2`, "Plan on $X a month") below the three choices. Then nothing above the list changes size, at the cost of the answer sitting a little lower. |

### New problems (confirmed by a skeptic, still there on e05d6a4)

**N1 (severity 3): Social Security reads "69 000" as $69, says "saved", and the benefit drops to $0**
- Steps: family (or patLee), retirement/social-security, Ana's fold. Paste "2024 69 000", "2023 66 500" and "2022 61 000" into the earnings box, one per line. Leave the monthly box empty and tap Save. "2024: 69.000" behaves the same.
- Seen: a green "Ana's Social Security saved, from 3 years of earnings." The fold goes from "$2,650 a month at 67" to "$0 a month at 67". Stored: {2022: 61, 2023: 66, 2024: 69}, and the typed $2,650 is dropped. For patLee, $3,044 becomes $0.
- Should: a group of digits after a space or a dot is listed as unread, the way "69k" already is ("I could not read 3 lines..."). Alternatively, a year under about $1,000 asks before saving. Never a green "saved" that drops the benefit.
- Cause: `modules/retirement/social-security/compute.js:115`. The amount pattern `(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?` accepts only commas as thousands marks, so ".000" is read as cents, and nothing checks what follows the match except the new "k" test.

**N2 (severity 3, the rest of RC-1): Advisor's plan on a plan without its basics says "Compared: their plan is below" with nothing below**
- Steps: blank plan, scenarios/advisor-plan. Type 1 in the fee box and tap Compare.
- Seen: a green "Compared: their plan is below, next to yours." Below it there is only the "To compare, your plan needs three things..." card, in plain text with no links. The form is still offered, and nothing on the screen is filled. The guide's outlined "Start your plan" at the foot is the only way on.
- Should: when the plan is not ready, show the missing pieces as buttons and no form, as Annuities and How much to take out now do (`needButtons`). Never say "below" when nothing is drawn.
- Cause: `modules/scenarios/advisor-plan/view.js:41` (the form is appended when the plan is not ready) and `:91` (the success message ignores readiness).

**N3 (severity 2): Will the money last? and Financial independence move their buttons about half a second after opening**
- Steps: family or demo, retirement/projection, first visit. Do not touch the screen; read the button positions every 30 ms.
- Seen: "Could you stop sooner" and "Chance the money lasts" go from 441/516 to 463/538 at 0.48 to 0.68 s, on both commits. The amber "short in a bad run" pill arrives on its own line. retirement/fire moves 25 px (514 to 539) at about 0.6 s, with no pill.
- Should: nothing on the first screen moves once drawn. Hold the second line's height the way the first line's is held, or draw the pill inside the line that is already held.
- Cause: `modules/retirement/projection/view.js`: `careLine2` is built empty (about line 119) and filled with the pill (about line 149). Only the line above it has a minimum height (about line 140). Financial independence's move was not traced.

### Left for wave 1, correctly
R-A4, j-one-answer/x-2, W4, RB1, RC-11, j-first-retiree/x-2, p-retirement-b/x-3, R4's one-tap change, Undo after "Removed", the bubble wording.

### Not yet reviewed
The Get started commits (6a65660, 8b1971e, 030bebe, 26d0389, 5f50257, and whatever follows) are for round 2.
