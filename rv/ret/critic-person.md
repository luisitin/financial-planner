# Person critic, track "ret" (L2-L6): three people with thumbs

Track HEAD 71ff05a (L2 4284fd5, L3 be77621, L4 d5b9e86, L5 0bd4a09, L6 71ff05a) against fa2026e.

**Setup**
- Two detached worktrees: `rv/v-ret-person` (71ff05a) served on 127.0.0.1:9751, and `rv/v-ret-person-base` (fa2026e) on 9752.
  Both were removed at the end and both servers stopped.
- Every walk used the kit (`ux/kit.mjs`): Chromium with iPhone emulation, touch, sandbox only. Typing was key by key
  (`pressSequentially`, 60-120 ms a key), taps were real touch taps, and Back was `history.back()`.
- Scripts are in `rv/ret/person/w*.mjs`, logs in `rv/ret/person/w*.log`, screenshots in `rv/ret/person/shots/`.
- Households were phone-built in Get started: Jamie (`noMatch`), Casey (`noContrib`), Dana & Lee (`couple2k`). Sam came from the kit.
- Only Chromium is installed, so nothing was walked in Safari (list at the end).

**Severity** (used in the structured findings): 3 = a person loses a save or the plan records a figure they never gave;
2 = the person cannot see or trust what changed; 1 = a wording or number slip that slows them down.

---

## What works (checked, no finding)

- **Nothing on the first screen moves once drawn.** Each page was opened from the Dashboard by a hash change, and every
  heading, paragraph, button, list item and section in `#content` was sampled every 20 ms for 5 s from the first frame.
  Result: 0 moves for Jamie at 390, Jamie at 320 dark, Casey at 390 and Dana & Lee at 390 (`w1`, `w4`, `w6`, `w9` logs).
  The gray placeholders hold their height.
- **No sideways scroll.** `overflowX` was false on every screen walked at 390 and 320, in light and dark.
- **Tap targets.** The census found no small targets and no unnamed controls on Will the money last?, Contributions or
  Assumptions.
- **One filled button in the hero.** It is "Check the numbers behind this ↓" for Jamie, Casey and Dana & Lee. Sam keeps the
  filled "Add what you own ›", and his check button is outlined (`w10-sam-proj-head.png`).
- **Selected chips are filled** in the app's standard `.chip.on` accent ("Pay the tax later", "Invested for later",
  "Middle 7% (ours)"). So a form has a filled-looking chip next to its filled Save. This is the app-wide chip style, not a
  second button, so it is not listed as a finding.
- **The card tells a person whose each number is.** Tags: "Yours", "Our guess", "Usual figure", "Not counted". Each row has
  one effect line in the hero's unit and one next step.
- **The growth row never offers a raise.** It reads "Careful 6%: runs out at 69. Hopeful 8%: runs out at 71. Nobody can
  choose this…" with "Check ›" (`w2-noMatch-390-more.png`).
- **Said = done** on every save walked:

  | person | change | the card said | after Save |
  |---|---|---|---|
  | Jamie | match | about $2,040 a year: runs out at 74 | "now runs out at 74 (was 70)" |
  | Jamie | Careful 6% | runs out at 69 | "now runs out at 69 (was 70)" |
  | Casey | 6% typed (the card tried 6.6% plus match → 88) | | "now runs out at 87 (was 67)" |
  | Jamie | $400 of $567 in the bank (the card: all of it → 81) | | "now runs out at 78 (was 70)" |

- **Dana & Lee, leftover answered in place.**
  - Answer → Invested for later → $1,820 (prefilled) → Save my answer.
  - The notice is in view at 390, and the row turns to "Yours".
  - The Dashboard shows "Left over each month $8" and "Retirement: The money lasts · On track" (it was $1,828, "Tight")
    (`w6-dl-390-dash.png`).
- **Dana's split, Some of each, 4% later and 2% now** (when Save is not the very next tap; see F1).
  - It gives two rows, with the match on the later row (`w7-dl-390-saved.png`).
  - Back shows the honest line "This answer does not count the tax that paying later saves you each year…"
    (`w7-dl-390-back.png`).
- **Compared with fa2026e.**
  - On fa2026e the same Jamie page has no line about what the answer rests on, no card and no filled button.
  - It is 2,682 px tall against 4,250 px now (`w1-noMatch-390-base-top.png` vs `-head-top.png`).
  - Contributions' first screen is the same on both for Jamie and Casey (`w10-*-contrib-{head,base}.png`).

---

## Findings (confirmed on screen or by running code), most severe first

### F1 (3) Dana's "Some of each": tapping Save straight from the Roth box saves nothing; the button jumps 43 px under the thumb
**Steps** (Dana & Lee, 390 x 844; `w8.mjs`)
1. Contributions → tap the row "Dana's plan at work" → "Some of each".
2. Type `4%` in "Pay the tax later: your own money", then tap the "Pay the tax now" box and type `2%`.
3. With the keyboard still on that box, tap "Save changes" where it is drawn.

**Evidence**
- Save was at y 606 before the tap and y 649 after it. No notice, no new row, and the form is still open.
- The run was repeated 3 times at 390 with the same result (`w8.log`).
- Before the tap there is no tax line (`shots/w8-dl-390-before-save-tap.png`). After the tap the line "Paying it all later
  would lower this year's federal tax by about $190." has appeared above the boxes and the form is unsaved
  (`shots/w8-dl-390-after-save-tap.png`).
- Cause: `taxLine` in `contributions/view.js:488` starts empty and is filled on the box's `change` (`:501`, `:520`). The
  blur caused by the Save tap fires `change`, which inserts a 2-line paragraph above the boxes, so the tap lands on empty
  card.
- At 320 the same tap saved, because the inserted line was above the screen and scroll anchoring hid the move. The loss
  depends on the scroll position, which makes it worse: the person cannot learn a rule from it.
- New in L6: fa2026e has no split and no tax line.

**Fix**
- Never insert text above the boxes on `change`. Give the tax line its place from the first draw, with a fixed
  `min-height` of 2 lines and a resting sentence such as "This year's tax: we work it out when you leave a box". Or move it
  under the Save row.
- Add a kit check: type in the last box, tap Save at its pre-blur centre, expect the notice.

### F2 (3) Casey's "Type what goes in ›": our usual 6.6% and our usual $2,880 match are saved as Casey's own with one tap, and the words that say so are off the screen
**Steps** (Casey at 320 x 568; `w15.mjs`, `w16.mjs`)
1. Will the money last? → "Check the numbers behind this ↓" → row "What goes into Casey's 401(k) · Yours · nothing (you
   said so)" → "Type what goes in ›".
2. Casey lands with "396" selected, and "$ 2,880" in "Employer adds, a year".
3. Tap "Save changes".

**Evidence**
- At landing the note "Filled in with the change we tried on your retirement answer: 6.6% of pay ($396 a month) … and the
  usual match, about $2,880 a year. Change both to Casey's own figures…" sits at top −152 to −15 at 320, wholly above the
  screen (`shots/w16-casey-320-land.png`).
- At 390 the note is at top 26 to 143, and its first lines are under the 56 px top bar (`shots/w15-casey-390-typeland.png`).
- L6's tax block ("When do you pay the tax on it?", the chips and the rule of thumb) is now inserted between the note and
  the box (`amountLab.before(block)`). The L3 log had the note right over the box.
- After one tap on Save, the plan holds `{"amount":396,"employerMatch":2880}`.
- The guess-ledger entry `retirement.contributions[setup-contrib-setup-self].employerMatch` is gone (`w16.log`), so the
  $2,880 is now treated as Casey's own.
- The answer reads "now runs out at 88 (was 67)". Casey never said the job matches, and Casey's Contributions page still
  asks "Does Casey's job add money…?" on fa2026e and here.

**Fix**
- Put the prefill note directly above the amount box, after the tax block, so it is on screen with the selected box at 320.
- Leave the match box empty, with "Does Casey's job match? Most add about $2,880 a year at 6%" and Yes / No / Not sure.
- If a prefilled match is saved untouched, keep it as our guess in the ledger: tag "Our guess", not "Yours".

### F3 (2) "Before your change … Now …" is drawn only in the hero; on three of the card's four ways back the person is not looking there
**Steps and evidence** (each starts from the card)

| route | where Back or Save lands | where the line is | what is on screen |
|---|---|---|---|
| Jamie 390: "Check the match ›" → type 2040 → Save → Back (`w3.log`) | scrollY 686 | top −560, out of view | the card. The match row has gone from the visible rows into "Also counted, each moving the answer by less than a year: … the match at Jamie's job ($2,040 a year)" at the card's foot. Nothing on screen says the answer moved 70 → 74 (`shots/w3-noMatch-390-back-asland.png`). |
| Jamie 320 dark: "4 more numbers" → growth "Check ›" → "Careful 6%" → Save → Back (`w9.log`) | scrollY 2344 | top −2218 | the four stat tiles, below the card (`shots/w9-noMatch-320-dark-back.png`) |
| Jamie 390: spending "Change ›" → type 2898 → "Save settings" (`w14.log`) | scrollY 4492 | top −4366 ("Now: runs out at 73") | only the toast "Retirement settings saved." (`shots/w14-noMatch-390-spending-saved.png`). This is walk.md's gap 3, still open for the card's own lever. |
| Contributions opened from the menu → Back | scrollY 0 | in view | the line (the only route where it is seen) |

**Fix**
- When `before` is set, also put the sentence first in the "What this answer rests on" card as `ui.notice("ok", …)`, and
  bring it into view and focus it after paint, as the left-over notice already does.
- For a save in the settings fold, say it in that fold's own notice: "Retirement settings saved. Your retirement answer:
  now runs out at 73 (was 70)". Use `answerChangeWords`, which Contributions and Assumptions already use.
- Keep the row that just changed in the visible five, with the before and after value, as the left-over row already is.

### F4 (2) After fixing the match from the card, Contributions says "No match at Jamie's job" above "employer adds $2,040 a year"
**Steps.** Jamie at 390: card → "Check the match ›" → type 2040 → Save changes (`w3.mjs`). Or on Contributions, tap the
row and type the match (`w3b.mjs`).

**Evidence**
- After the save the page reads "Contribution saved. Your retirement answer: now runs out at 74 (was 70)", then the card
  "No match at Jamie's job · Edit", then the row "Jamie · $250 every month · employer adds $2,040 a year"
  (`shots/w3-noMatch-390-saved.png`, `w3b.log`).
- This already happens on fa2026e (`shots/w3b-noMatch-390-base-saved.png`). L3 now sends every person who checks the match
  down this path, and the spec's point (L3) is to fix "didn't input the match correctly" in one tap.

**Fix.** In the same `store.update` that saves a match above 0 for a person whose `workPlans[pid].match === false`, set it to
`true` (or delete it). Hide the "No match at …" card while any of that person's rows carries a match.

### F5 (2) For a tight plan, the before-and-after line contradicts the headline, and the left-over notice hides the verdict change
**Steps.** Dana & Lee at 390 (`w6.mjs`, `w7.mjs`).
- (a) Contributions → Dana's row → Some of each 4% / 2% → Save → Back.
- (b) Card → Answer → Invested for later → Save my answer.

**Evidence**
- (a) The headline "It lasts in most cases, not all" is followed by the bold line "Before your change: lasts to the end
  (age 97), about $261,000 left … Now: lasts to the end (age 97), about $265,000 left…" (`shots/w7-dl-390-back.png`).
  - Read as written, the headline says not always and the next line says to the end.
  - The words "if markets do as well as average" are in the card's intro but not in this line.
- (b) The notice says "Your retirement answer: still lasts to the end, with about $1,165,000 more left at 97", but:
  - the headline turned from "It lasts in most cases, not all" to "The money lasts";
  - the Dashboard went from "Tight" to "On track" (`w6.log`, `shots/w6-dl-390-saved.png`, `-dash.png`);
  - the spec's acceptance B3 example says it plainly: "Before: lasts in most cases. Now: lasts to the end."
- "Still" tells the person nothing changed, at the most valuable moment of the track.

**Fix**
- Start the hero line with "If markets do as well as average:" (D-A1's own condition).
- When the hero's verdict words differ between the two drawings, put them first, in the hero's own words: "Before your
  change: It lasts in most cases, not all. Now: The money lasts." Do the same in the notice from `answerChangeWords`.

### F6 (2) At 320 the left-over answer's notice shows twice, and the toast covers the row just answered
**Steps.** Jamie at 320 dark: card → Answer → "It stays in the bank" → type 400 → Save my answer (`w11.mjs`).

**Evidence**
- Two copies on screen at once: "Saved: $400 a month into Savings. Your retirement answer: now runs out at 78 (was 70)."
  appears in the card (in view), and the shell's toast shows the same words at the foot. The toast hides the row's "Yours"
  tag and its lines for about 4 s (`shots/w11-noMatch-320-dark-saved.png`; `notices` in `w11.log` lists both, both
  `inView: true`).
- Cause: the shell (core/app.js:258-263) echoes the first new notice when none is in view at the end of render. The card
  scrolls its notice into view only in `afterPaint`, after that check.
- At 390 for Dana & Lee the notice was already in view, so no toast showed.

**Fix.** In `leversCard`, scroll the notice into view synchronously in `render` once the card is attached (the shell then
sees it in view and does not echo). Keep the `afterPaint` focus.

### F7 (1) "You changed … the money left over each month", a change the person did not make
**Evidence.** Casey saves 6% → Back: "You changed what goes into Casey's 401(k) (nothing → $360 a month) and the money left
over each month ($573 a month → $303 a month)." (`w4.log`). Dana's split gives "… and the money left over each month
($1,828 a month → $1,816 a month)" (`w7.log`).

**Fix.** Name only the lever the person touched. Say the leftover as a result: "The money left over each month moves with
it: $573 → $303."

### F8 (1) A couple reads "lasts to the end (age 97)" when they planned to 95 and 95
**Evidence.** Dana & Lee's card: "As it is, counted as spent: lasts to the end (age 97)" and "… more left at 97", while the
same card says "how long the plan runs (95 and 95)" (`w6.log`, `shots/w6-dl-390-invest.png`). The 97 is Dana's age in 2076.
Nothing says whose.

**Fix.** For two adults, say "lasts to the end of the plan (2076)" or "to the end (Dana 97, Lee 95)".

### F9 (1) "Claimed at 70: runs out at 68": waiting looks harmful, with no reason given
**Evidence.** Jamie's card: "Jamie's Social Security · Our guess · $2,484 a month from 67 · Claimed at 70: runs out at 68."
The answer is runs out at 70 (`w2.log`). Casey's: "Claimed at 70: runs out at 67" (no gain). Common advice says waiting
helps, and the line gives no why.

**Fix.** When the claim-at-70 alternative is worse, add the reason: "(waiting means 5 years on savings alone, 65 to 70)".

### F10 (1) Two figures for the same money in adjacent lines
**Evidence.** After Jamie keeps $400 in the bank: "$400 a month into Savings, kept in the bank (you said so); $167 a month
more is left over" and on the next line "If the other $160 a month were invested too: runs out at 84." (`w11.log`).

**Fix.** Use one figure, $167, in both lines (round the amount tried, not the words), or write "about $170" in both.

### F11 (1) Sam's "Go deeper › What matters most?" opens a page of $0s right under "We don't know yet"
**Evidence.** Sam (kit): Will the money last? says "We don't know yet". Tapping "What matters most? ›" (new in L2) opens
Sensitivity: "When Sam retires moves your plan the most … can pay for about $0 a month … age 63 instead of age 65 raises it
by $0 a month", with every bar at $0 (`shots/w12-sam-390-sensitivity.png`, `w12.log`). This is ux F3, which L1 (another
track) fixes.

**Fix.** Leave out the "Go deeper" card (or at least the Sensitivity link) when `unknownYet` until L1's gate has landed.

### F12 (1) "Read it from a pay stub ›" (L2) leads, in this track, to a reader that drops the Roth 401(k) and the match
**Evidence**
- Casey: card → "Read it from a pay stub ›" → `#/ai/reader?kind=paystub`, the generic "Read a document" page with focus on
  nothing.
- Pasting the invented stub (lines "401K 180.00", "ROTH 401K 60.00", "Employer match 120.00") found only "401(k)
  contribution $180" and proposed "401(k) per paycheck … $180, twice a month". The Roth $60 and the match $120 were not read
  (`shots/w5-casey-390-stub-read.png`, `w5.log`).

**Fix.** Land the link together with L7 (the doc track), or after it. Until then leave the link out of `leverList`.

### F13 (1) Back from the card's other links lands at the top of the page, not on the card
**Evidence.** On Jamie at 390 (`w12.log`, `w13.log`, finger-scrolled with the wheel too):

| link | where it was | Back lands at |
|---|---|---|
| "What matters most? ›" | y 1491-1600 | scrollY 0 |
| "Try two plans side by side ›" | y 1547 | scrollY 0 |
| "What if history repeated? ›" | y 1603 | scrollY 0 |
| spending "Change ›" | card at 686 | scrollY 0 |

The spec's acceptance (D) 2 hands this to wave 1. It is listed so nobody marks D2 as passed on this track alone.

**Fix.** Wave 1's place memory. If it slips, have the view remember the card's scroll on leaving and restore it once per
arrival, as `?check=1` does.

### F14 (1) Saving Assumptions turns figures the person never typed into "Yours"
**Evidence.** Jamie at 320 dark: card → growth "Check ›" → tap only "Careful 6%" → "Save and mark as reviewed" → Back. The
card's inflation row now reads "How fast prices rise · Yours · 3% a year" (`w9.log`, ON SCREEN line). Before, it was "Usual
figure". This follows D-A3 (a reviewed default counts as confirmed), but the person only touched stocks.

**Fix.** Tag a reviewed default "Checked by you" (or "Usual figure, checked"), and keep "Yours" for figures the person typed
or picked.

---

## Try on a real iPhone (Safari was not walked)

- **F1 on Safari.** Safari fires `change` on blur, as Chromium does. Type in the Roth box, then tap Save once with the
  keyboard up. Does the save land?
- **"Check the numbers behind this ↓".** The smooth scroll, and the heading focus with `preventScroll`. Does the page jump
  when the focus ring draws?
- **"Check the match ›" and "Type what goes in ›".** On arrival the box is focused with no tap. Safari will not open the
  keyboard then. Does `select()` still highlight the "0" or "396"?
- **"It matches" (the L3 check) focuses inside the tap.** The keyboard should open, and the box should stay in view above it.
- **The answer panel's chips.** "Answer" focuses the first chip and scrolls "nearest" smoothly. Check the chips wrap at
  320, and that the $ box is 16 px with no zoom on focus.
- **Assumptions chips.** "Careful 6%" fills the box without opening the keyboard. VoiceOver reads "Stocks grow each year"
  for the box (`for`/`id`) and each chip by its text and pressed state.
- **The tax chips on Contributions.** Showing and hiding the second box should not open the keyboard. Typing "4%" on the
  text keyboard.
- **The mix row's "Change ›".** It opens the settings fold 4,700 px down and focuses "Share in stocks once retired" inside
  the tap. The keyboard opens. Check the page does not jump twice.
- **Safari's 7-day storage limit.** A left-over answer saved on a phone that is not on the Home Screen can vanish with the
  plan (docs/PLAN.md:159).

## Clean-up
- Both servers were started by `rv/ret/person/srv.mjs` (pids in `srv.pids`) and were stopped by that pid, not by pattern.
- `rv/v-ret-person` and `rv/v-ret-person-base` were removed with `git worktree remove`.
- Nothing in `$REPO` or in `rv/b-ret` was edited.
