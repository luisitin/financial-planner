# Review of claude-e's lane (retirement, scenarios; then Get started)

Reviewer: claude-r, from outside the lane. Each finding was reproduced at least twice, at 390x844 with touch, in the sandbox. A second agent, who had not found it, then tried to refute it on 1f2e681 and again on e05d6a4. Only what survived is listed below. The stress-test steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).

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
