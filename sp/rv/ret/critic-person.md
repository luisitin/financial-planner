# Person critic, track "ret" (L2-L6), round 2: three people with thumbs

Track HEAD **1942862** (L2 4284fd5, L3 be77621, L4 d5b9e86, L5 0bd4a09, L6 71ff05a, plus the fixup 1942862 on L2)
against fa2026e. The round-1 report is kept beside this one as `critic-person-round1.md`.

## Read this first: the builder's worktree holds fixes that are not committed

`rv/b-ret` is at 1942862 with **5 changed files and 1 new test that are not in any commit** (written 02:49-02:54):
`modules/retirement/contributions/view.js`, `contributions/module.test.mjs`, `modules/retirement/levers.js`,
`modules/retirement/projection/view.js`, `tests/levers.test.mjs`, new `tests/levers-saves.test.mjs`.

I walked HEAD, as told. I also walked a third copy, HEAD plus that uncommitted diff ("work copy" below), so each finding
says whether the uncommitted work already fixes it. The diff I applied is saved as
`$SP/rv/ret/person2-wip.diff`.

| round-1 finding | at HEAD 1942862 | in the uncommitted work copy |
|---|---|---|
| F1 Save tapped from the Roth box saves nothing | **still there** (P1) | still there |
| F2 Casey's one-tap save stores our figures as hers | **still there** (P2) | match kept as our guess; the note is still off screen and the $396 is still "Yours" |
| F3 before-and-after only in the hero | fixed for the card's links; **not** for the spending save (P7) | spending save fixed too |
| F4 "No match at Jamie's job" over "employer adds $2,040" | **still there** (P9) | fixed |
| F5 line contradicts the headline; "still" hides the turn | hero fixed; the card's notice still says "still" (P6) | same as HEAD |
| F6 notice shown twice, toast covers the row | **still there** (P13) | still there |
| F7 "You changed … the money left over" | fixed | fixed |
| F8 "(age 97)" for a couple planning to 95 and 95 | still there (P18) | still there |
| F9 "Claimed at 70: runs out at 68", no reason | still there (P18) | still there |
| F10 $167 next to $160 | still there (P16) | still there |
| F11 Sam's "What matters most?" opens $0 rows | still there (P19) | still there |
| F12 pay stub link to a reader that drops Roth | fixed (link removed) | fixed |
| F13 Back lands at the top | in place from Social Security, People, Assumptions and the three Go deeper links; not from the two Contributions links (P17) | same as HEAD |
| F14 untouched figures turn into "Yours" | still there (P14) | still there |

## Setup

- Three detached worktrees: `rv/v-ret-person` (1942862) on 127.0.0.1:9751, `rv/v-ret-person-base` (fa2026e) on 9752,
  `rv/v-ret-person-wip` (1942862 plus the uncommitted diff) on 9753. All three were removed at the end and the servers
  were stopped by pid.
- Every walk used the kit (`ux/kit.mjs`): Chromium with iPhone emulation, touch, sandbox only. Typing was key by key
  (60-150 ms a key), taps were real touch taps at the control's centre, Back was `history.back()`.
- People: Jamie (`noMatch`), Casey (`noContrib`), Dana & Lee (`couple2k`), all phone-built; Sam from the kit; the family
  fixture for an on-track plan. Widths 390 x 844 and 320 x 568, light and dark.
- Scripts and logs: `rv/ret/person2/*.mjs`, `*.log`. Screenshots (184):
  `$SP/rv/ret/person2/shots/`
  (file names below are in that folder).
- Only Chromium is installed, so nothing was walked in Safari (list at the end).

**Severity.** 3 = a person loses a save, or the plan records a figure they never gave. 2 = the person cannot see or trust
what changed, something lands under the thumb that undoes their step, or the one action they came for is off the screen.
1 = a wording or number slip, or more on the screen than the person needs.

---

## What works (checked, no finding)

- **Nothing on the first screen moves once drawn.** Opened from the Dashboard by a hash change and sampled every 20 ms for
  5 s: 0 moves for Jamie at 390, and for Jamie, Casey and Dana & Lee at 320 dark; 0 moves on the `?check=1` landing at 390
  and 320 (`a1-*.log`, `s1.mjs`).
- **No sideways scroll** on any screen walked at 390 and 320, light and dark. The three tax chips wrap at 320 (left edges 31,
  31 and 168 px, right edge at most 284 of 320).
- **One filled button in the hero**: "Check the numbers behind this ↓" for Jamie, Casey, Dana & Lee and the family; Sam keeps
  the filled "Add what you own ›" and his check button is outlined.
- **The filled button** lands the card heading at y 85 with the focus on it, at 390 and 320. A tap 0.7 s after it is let go
  (the double-tap guard); taps from 1.0 s on work, also right after a thumb scroll (`e1-noMatch-390.log`).
- **Back from a change made through the card now lands on the card**, with the sentence in a green notice and the changed
  row first:
  - Jamie, match 2040: "If markets do as well as average, before your change: runs out at 70. Now: runs out at 74. You
    changed the match at Jamie's job (none → $2,040 a year)." and the row "You just changed this: none → $2,040 a year."
    (`b3-noMatch-390-head-back.png`).
  - Jamie, Careful 6%: "… runs out at 70. Now: runs out at 69. You changed how fast investments grow (7% → 6%)."
    (`h9-noMatch-390-head-back.png`).
  - Casey, 6% typed: "… runs out at 67. Now: runs out at 77. You changed what goes into Casey's 401(k) (nothing → $360 a
    month)." No "and the money left over" clause any more.
- **Said = done** on every save walked: Jamie's match 70 → 74 (card said 74); Careful 6% → 69 (card said 69); spending
  $2,898 → 73 (card said 73); Casey's one-tap 6.6% plus match → 88 (card said 88).
- **Back from the Go deeper links, Social Security, People and both Assumptions links** returns to the same scroll position
  (1,282 or 1,491 before and after; `n1-noMatch-390.log`, `j12-*.log`).
- **Dana & Lee, leftover invested**: Dashboard "Left over each month $8", "Retirement: The money lasts · On track" (was
  $1,828, "Tight"); Contributions lists "Investments for later · Dana · $1,820 every month"; the hero says "Before your
  change: It lasts in most cases, not all. Now: The money lasts." (`f6-dl-390-head-saved-top.png`, `-dash.png`).
- **The hopeful return**: typing 9 shows "Higher than any forecast we know; plan on it only if you have a reason." under the
  box at once; the hero then carries "on your hopeful return · Stocks grow 9% a year in this answer: higher than any
  forecast we know. Check it ›" (`p5-jamie-320-dark-typed9.png`, `-hero9.png`).
- **"Not sure" and "That's right"** on the match check both answer in place and say what happens next (`u1.log`).
- **Dark mode** reads well on every new screen (`r1-dl-320-dark-card.png`, `g11-noMatch-320-dark-head-bank.png`).
- **Compared with fa2026e**: the same page for Jamie has no line about what the answer rests on, no card and no filled
  button; the only link to Contributions is the plain "What you save for retirement" 1,651 px down. After typing the match
  there, the page says only "Contribution saved." and Back shows the new headline with no before
  (`a1-noMatch-390-base-top.png`, `v1-base-noMatch-390-saved.png`, `-back.png`). The page grew from 2,682 to 4,250 px
  (Jamie, 390) and from 3,198 to 5,232 px (Dana & Lee, 320); see P11.

---

## Findings at HEAD 1942862 (confirmed on screen or by running code), most severe first

### P1 (3) Dana's "Some of each": tapping Save straight from the Roth box saves nothing; Save jumps 43 px under the thumb
*L6, 71ff05a. Round-1 F1, not fixed at HEAD and not in the work copy.*

**Steps** (Dana & Lee, 390 x 844; `c8.mjs`)
1. Contributions → the row "Dana's plan at work" → "Some of each".
2. Type `4%` in "Pay the tax later: your own money", tap the "Pay the tax now" box, type `2%`.
3. With the keyboard still on that box, tap "Save changes" where it is drawn.

**Evidence**
- Save was at y 606 before the tap and y 649 after it; no notice; the plan still holds `amount: 400` and no Roth row.
  Three runs out of three at HEAD, one of one on the work copy (`c8-390-head.log`, `c8-390-wip.log`).
- The line "Paying it all later would lower this year's federal tax by about $190." appears above the boxes on the box's
  `change`, which the Save tap itself fires (`c8-dl-390-head-before-save-tap.png`, `-after-save-tap.png`).
- At 320 the same tap saves (`c8-320-dark-head.log`), because the inserted line is above the screen. So the loss depends on
  the scroll position.

**Fix.** Give the tax line its place from the first draw (a fixed two-line `min-height` with a resting sentence), or put it
under the Save row. Add a kit check: type in the last box, tap Save at its pre-blur centre, expect the notice.

### P2 (3) Casey's "Type what goes in ›": one tap on Save records our usual 6.6% and our usual $2,880 match as Casey's own
*L3, be77621. Round-1 F2. Half fixed in the work copy only.*

**Steps** (Casey, 320 x 568; `d16.mjs`)
1. Will the money last? → "Check the numbers behind this ↓" → row "What goes into Casey's 401(k) · Yours · nothing (you said
   so)" → "Type what goes in ›".
2. Tap "Save changes".

**Evidence**
- On landing the first thing on screen is the tax chips at y 33, then the rule of thumb, then the box with "396" selected and
  "$ 2,880" under it. The note "Filled in with the change we tried … Change both to Casey's own figures" is above the screen
  at 320 and starts at y 26, under the 56 px top bar, at 390 (`d16-casey-320-head-land.png`, `o4-casey-390-head-land.png`).
- After one tap: `{"amount":396,"employerMatch":2880}`, no guess entry for the match, "Casey · $396 every month · employer
  adds $2,880 a year", "now runs out at 88 (was 67)" (`d16-320-head.log`).
- By code (`t1.mjs`): 396 a month with no match runs out at 79; with the $2,880 it is 88. Nine of the 21 years come from a
  match Casey never said she has.
- Work copy: the match box opens empty with "left blank, $2,880 stays in as our guess", the row reads "(our guess)" and the
  ledger keeps it. The note is still off the screen at 320, and the $396 is still saved as "Yours" in one tap.

**Fix.** Commit the work copy's match guess. Put the prefill note directly above the amount box (after the tax block, or
fold that block, P10). Open the amount box empty with "396" as the grey hint and a chip "Use the usual 6.6% ($396 a
month)", so nothing of ours becomes "Yours" without a tap that says so.

### P3 (2) The split's confirmation is a 50-word toast that leaves after 3.5 s; the page's own notice is off the screen
*L6, 71ff05a. New.*

**Steps.** Dana & Lee: Dana's row → Some of each → 4% and 2% → leave the box → Save changes (`l7.mjs`, `l8.mjs`).

**Evidence**
- The page's notice (60 words) is above the screen: it ends 101 px above the top edge at 390 and 476 px above it at 320
  (scrollY 691 and 1,159).
- The shell's toast repeats 50 of those words at the foot: 206 px tall at 390, 274 px at 320 (almost half of a 568 px
  screen). It appeared at 0.4 s and was gone at 3.8 s (`l7-dl-390-head-saved.png`).
- Its words: "Saved: $260 a month paying the tax later with the match, and $130 a month into Dana's Roth 401(k) at work,
  paying the tax now. This year's federal tax: about $200 more than before. Your money when retirement starts (2044): 88%
  pay-the-tax-later, 9% already taxed (Roth), 3% regular savings." The tax and the mix (the spec's acceptance C3) cannot be
  read in that time.
- The form said "about $190" and the notice says "about $200" for what the person reads as the same thing.

**Fix.** Say one sentence in the notice ("Saved: $260 a month paying the tax later, $130 a month paying it now.") and bring
it into view as the leftover's notice is. Put this year's tax and the mix in a quiet line under Dana's two rows, which
stays. Use one tax figure: the form's.

### P4 (2) Assumptions: a tapped chip looks applied, nothing says it is not saved, and Save is one and a half screens down
*L5, 0bd4a09. New.*

**Steps** (Jamie, 390; `h9.mjs`, `h10.mjs`)
1. Card → "4 more numbers" → "How fast investments grow" → "Check ›".
2. Tap "Careful 6%". The chip fills, the box reads 6.
3. Tap Back.

**Evidence**
- After step 2 no word on the screen mentions saving (`h9-noMatch-390-head-careful.png`). "Save and mark as reviewed" is
  1,231 px below the chip at 390 and 1,342 px below it at 320, past the rest of the form (ten boxes in all).
- After Back: `returnStocks` is still 0.07, the card shows no change and no notice (`h10-390-back-unsaved.png`).
- fa2026e has the same far-away Save, but no chips: a filled chip reads as a choice already made, as the leftover's chips
  are followed by their own Save.

**Fix.** When the page is opened with `?show=<key>`, show that one number alone: its chips, the box, the forecast line and
the filled Save right under it, with the other nine behind a fold "All the numbers ›". Failing that, show an outlined
"Save this ›" under the chips as soon as a value differs from the saved one.

### P5 (2) "It matches" puts "Cancel" under the thumb: a second tap closes the form
*L3, be77621. Held for one second in the work copy only.*

**Steps** (Jamie with the match never asked, 390; `k3.mjs`, `k4.mjs`). Contributions → "No match on file. Is that right?" →
tap "It matches", then tap the same spot again.

**Evidence**
- The page scrolls 1,381 px (0 → 1,381) and the edit form's "Cancel" is then exactly where "It matches" was
  (`k3-390-head-itmatches.log`: "under the thumb now: BUTTON Cancel").
- HEAD: a second tap 0.7 s or 1.2 s later closes the form; the page is left at scrollY 462 (`k4-390-head-700.png`). A tap
  at 0.35 s lands mid-scroll on a label and does nothing.
- Work copy: the tap at 0.7 s is let go; the tap at 1.2 s still closes the form.

**Fix.** Answer in place: "It matches" opens one box, "Employer adds, a year", with its own Save inside the question card
(as the leftover is answered on its card), so nothing scrolls and the full form is not needed. If the form must open,
scroll so the match box, not Cancel, is under the tapped spot.

### P6 (2) The verdict turns, and the notice the person is reading says "still"
*L4, d5b9e86. The rest of round-1 F5; same in the work copy.*

**Steps.** Dana & Lee, 390: card → Answer → "Invested for later" → Save my answer (`f6.mjs`). Then Contributions → the
"Investments for later" row → Remove (`r1.mjs`).

**Evidence**
- In view after the save: "Saved: $1,820 a month into Investments for later (a new account at $0, on Net worth). Your
  retirement answer: still lasts to the end, with about $1,165,000 more left at 97 (today's dollars)."
  (`f6-dl-390-head-saved.png`).
- Above the screen at that moment: the headline went from "It lasts in most cases, not all" to "The money lasts", and the
  Dashboard from "Tight" to "On track".
- On removal: "Contribution removed. Your retirement answer: still lasts to the end, with about $1,165,000 less left at 97",
  while the headline goes back to "It lasts in most cases, not all".

**Fix.** When the hero's verdict words differ before and after, lead the notice with them: "Before: it lasts in most
cases, not all. Now: the money lasts." Drop "still". Use the same words on removal.

### P7 (2) Spending "Change ›": seven technical boxes, Save 950 px under the box, and after Save only "Retirement settings saved."
*L2, 4284fd5. The spending half of round-1 F3; the notice is fixed in the work copy only.*

**Steps** (Jamie, 390; `i14.mjs`). Card → "Spending in retirement" → "Change ›" → type 2898 → Save settings.

**Evidence**
- The landing is the whole settings form: the spending box, then "Share in stocks now", "Share in stocks once retired", "How
  tax is worked out: A flat rate on pre-tax withdrawals (quick)", "Flat rate on money taken from pre-tax accounts", "How
  much to take out each year", "Starting withdrawal rate … 4 is the classic figure" (`i14-jamie-390-head-land.png`).
- The spending box is at page y 4,219; "Save settings" is at about 5,168. With the keyboard up Save is two screens away.
- After Save the page is at scrollY 4,514 of 5,160 and the only words are the toast "Retirement settings saved.", gone 4 s
  later. "Runs out at 73" is 4,400 px above (`i14-jamie-390-head-saved.png`, `-saved-5s.png`).
- Work copy: the toast reads "Retirement settings saved. Your retirement answer: now runs out at 73 (was 70)."

**Fix.** On the `?type=spending` landing show the spending box and Save alone; fold the other six under "More settings
(stocks, tax, how much to take out) ›", saying so when one differs from the usual. Commit the work copy's notice.

### P8 (2) Casey types 0 for the match, as the note tells her, and is asked at once "No match on file. Is that right?"
*L3, be77621. New; same in the work copy.*

**Steps** (Casey, 390; `o4.mjs`). Card → "Type what goes in ›" → type `6%` → type `0` in "Employer adds, a year" → Save.

**Evidence**
- The note said "type 0 for the match if Casey's job adds nothing".
- After the save the page shows the card "No match on file. Is that right? … [That's right] [It matches] [Not sure]"
  (`o4-casey-390-head-saved.png`).
- Back on Will the money last?: "1 thing is not counted yet: the match at Casey's job." and the row "What Casey's job adds
  (the match) · Not counted · No match on file".

**Fix.** A 0 the person types in the match box on a landing that asked for it is the answer: set
`workPlans[pid].match = false` in the same save, so the row reads "Yours · No match on file (you said so)" and the
question does not show.

### P9 (2) After fixing the match from the card, Contributions says "No match at Jamie's job" above "employer adds $2,040 a year"
*L3, be77621. Round-1 F4; fixed in the work copy only.*

**Evidence.** HEAD after "Check the match ›" → 2040 → Save: the card "No match at Jamie's job · Edit" over the row "Jamie ·
$250 every month · employer adds $2,040 a year"; `workPlans` still `{"plan":true,"match":false}`
(`b3-noMatch-390-head-saved.png`, `b3-noMatch-390-head.log`). Work copy: the card is gone and `match` is deleted.

**Fix.** Commit the work copy's `matchTakesBackNo`.

### P10 (2) Every edit of a row at work now opens with the tax question: Save is pushed off the first screen
*L6, 71ff05a. New; the owner's "less is more".*

**Steps.** Contributions → tap any row at work (`c1.mjs`).

**Evidence**

| | fa2026e | HEAD |
|---|---|---|
| form height, 390 | 641 px | 879 px |
| "Save changes", 390 (screen is 844) | y 606 to 650 | y 830 to 874 |
| "Save changes", 320 (screen is 568) | y 591 | y 849 |
| words in the form | 79 | 131 |

- The block is "When do you pay the tax on it?", three chips and "If you expect a lower tax rate in retirement, later
  usually wins; higher, now wins. Not sure? Some of each is a sound choice. (Brown, Cederburg and O'Doherty, 2017)"
  (`c1-couple2k-390-head-form.png` against `c1-couple2k-390-base-form.png`).
- Jamie, who came to check a match, lands with that paragraph as the first thing on the screen
  (`b3-noMatch-390-head-land.png`). Casey lands with the chips cut by the top bar (`d16-casey-320-head-land.png`).
- An academic citation is on the screen; AGENTS rule 14 keeps builder detail in the README.

**Fix.** One quiet line in its place: "Tax on this money: paid later, the usual. Change ›". The tap opens the three chips
and the rule of thumb; the line says "paid now" or "some of each" when that is the choice. Move the citation to the README.

### P11 (1) The card opens at 1,060 to 1,510 px with rows that change nothing, and says the same long sentence up to eight times
*L2, 4284fd5. New; the owner's "less is more".*

**Evidence** (`m1.log`, `q1.mjs`)
- Card height: Jamie 1,061 px (390) and 1,237 px (320); Casey 1,085 and 1,280; Dana & Lee 1,280 and 1,507, with 305 words.
- Casey's fourth row is "Casey's Social Security · Our guess · Claimed at 70: runs out at 67." Her answer is 67: the change
  moves nothing, yet it sits above "When Casey stops work · At 67: runs out at 76".
- For a plan that lasts, each line repeats the unit: the family's first five rows say "lasts to the end, with about $… more
  left at 95 (today's dollars)" eight times (`q1-family-390-card.png`).

**Fix.** Show three rows and fold the rest ("6 more numbers"). Leave out the effect line of a change that moves nothing
(or say "would not change the answer"). Say the unit once in the intro ("the money left at 95, in today's dollars") and
shorten each line to "If it's invested: about $5,541,000 more."

### P12 (1) After a change the hero holds up to five sentences before the answer's own words
*L2 and L6. New.*

**Evidence.** Dana's split, then Back: "If markets do as well as average, before your change: lasts to the end (age 97),
about $261,000 left in today's dollars. Now: lasts to the end (age 97), about $265,000 left in today's dollars. You changed
what goes into Dana's 401(k) ($400 a month → $390 a month). You changed when the tax is paid on money at work. This answer
does not count the tax that paying later saves you each year, so paying now looks better here than it is." That is 233 px
at 390, and the filled button moves from y 555 to y 788 (`l7-dl-390-head-back.png`). The leftover save gives two "before
your change" sentences in one paragraph (`f6-dl-390-head-saved-top.png`).

**Fix.** Keep one sentence in the hero ("Before your change: about $261,000 left at 97. Now: about $265,000.") and put the
rest behind "What changed ›". When the headline turned, say only that.

### P13 (1) The leftover answer's notice shows twice, and the toast covers the row just answered
*L4, d5b9e86. Round-1 F6; same in the work copy.*

**Evidence.** Jamie, 320 dark, $400 in the bank: the card's notice at y 260 and the toast at y 436, both on screen, the
toast over the row's "Yours" tag (`g11-noMatch-320-dark-head-saved-0.7s.png`). Dana & Lee at 320: notice at 226, toast at
369 (`r1-dl-320-dark-saved-0.9s.png`). Casey at 390, "It gets spent / not sure": notice at 410, toast at 735.

**Fix.** Scroll the card's notice into view in `render`, before the shell checks for a notice in view, so it does not echo.

### P14 (1) Saving one assumption turns four untouched figures into "you gave us"
*L5, 0bd4a09. Round-1 F14.*

**Evidence.** Jamie: before, "This answer rests on 9 numbers: 2 you gave us, 2 our guesses, 5 usual figures." After typing
only 9 in the stock box and saving: "9 numbers: 6 you gave us, 2 our guesses, 1 usual figure." (`p5.log`).

**Fix.** Count and tag a reviewed default as "usual figure, checked"; keep "you gave us" and "Yours" for a figure the
person typed or picked.

### P15 (1) "Also counted, each moving the answer by less than a year: … the match at Casey's job ($2,880 a year)"
*L2, 4284fd5. New.*

**Evidence.** The line is on Casey's card after her save (`d16-320-head.log`). By code (`t1.mjs`), that match moves her
answer from 79 to 88. The line means that changing it to the usual figure would move little; it reads as "the match hardly
matters".

**Fix.** "Also counted, already at the usual figure or close to it: …", or only "Also counted: …".

### P16 (1) The leftover row: two figures for the same money, and words for a change that was not one
*L4, d5b9e86. Round-1 F10 plus three new slips.*

**Evidence** (`g11-320-dark-head.log`, `u1.log`, `u2.mjs`)
- "$167 a month more is left over" and, on the next line, "If the other $160 a month were invested too".
- A year on: "You said in March 2025 that $300 a month is invested. Left over each month now: $567. Still right?" The
  Dashboard at that moment says "Left over each month $267".
- After "Still right": "You just changed this: $300 a month → $300 a month invested."
- The notice: "We will ask again in a year, or when the $567 left over changes by more than a quarter."

**Fix.** One figure in both lines ($167). Ask "… $300 a month is invested. $267 more is left over now. Still right?". No
"You just changed this" line when the value is the same. "by more than a quarter" → "by a lot".

### P17 (1) Back from "Check the match ›" or "Type what goes in ›" with nothing changed lands at the top of the page
*L3, be77621. The rest of round-1 F13; same in the work copy. Chromium only.*

**Evidence** (`n2.mjs`). Jamie 390: was at scrollY 686, Back lands at 0, the link is 1,183 px down. Jamie 320: 1,042 → 0.
Casey 390: 753 → 0. After tapping "Cancel" first, Back lands at 686. From Social Security Back lands in place.

**Fix.** Remember the card's scroll on leaving through a card link and restore it once on arrival when nothing changed, as
the page already does after a change.

### P18 (1) Two lines a person reads the wrong way: "(age 97)" for a couple planning to 95, and waiting for Social Security looks harmful
*L2, 4284fd5. Round-1 F8 and F9.*

**Evidence.** Dana & Lee: "lasts to the end (age 97)" and "more left at 97" on a card that says "how long the plan runs (95
and 95)" (`f6-390-head.log`). Jamie: "Claimed at 70: runs out at 68" when the answer is 70, with no reason
(`a1-noMatch-390-head-card.png`).

**Fix.** For two adults say "to the end of the plan (2076)". When claiming at 70 comes out worse, add "(waiting means five
more years on savings alone)".

### P19 (1) Sam's "What matters most? ›" opens a page titled "Sensitivity" that ranks levers under "We don't know yet"
*L2, 4284fd5. Round-1 F11.*

**Evidence.** Sam: Will the money last? says "We don't know yet"; the Go deeper link opens "Sensitivity": "When Sam retires
moves your plan the most" (`j12-sam-390-head-deep-Whatmattersm.png`, `j12-sam-390-head.log`).

**Fix.** Leave the Go deeper card out while the answer is "We don't know yet", until L1 (another track) gates that page.

### P20 (1) Removing the leftover row leaves an empty "Investments for later" account behind
*L4, d5b9e86. New.*

**Evidence.** Dana & Lee: answer "Invested for later", then Contributions → the row → Remove. `retirement.leftover` is
gone; `accounts` still lists "Investments for later" at $0, and it stays in the form's "Into which account" list
(`r1.log`). The spec's acceptance B5 says everything returns to the earlier figures.

**Fix.** In the same update, remove the account the answer made when its balance is $0, it has no history and no other row
uses it; or say "The empty account Investments for later is still on Net worth."

### P21 (1) At 320 the filled button is below the first screen
*L2, 4284fd5. New.*

**Evidence.** "Check the numbers behind this ↓" is at y 593 (Jamie), 679 (Casey) and 600 (Dana & Lee) on a 568 px screen;
148 to 181 words of hero come first (`m1.log`, `m1-noContrib-320-top.png`). At 390 it is on the first screen (y 548 to 615).

**Fix.** Put the "This answer rests on …" line and the button right under the headline's first sentence, and fold "Even in
a bad run …" and "At the $… you plan …" under "More about this answer ›".

---

## Try on a real iPhone (Safari was not walked)

- **P1.** Type in the Roth box, then tap Save once with the keyboard up. Safari fires `change` on blur as Chromium does.
- **P5.** Tap "It matches" twice. Does the second tap reach Cancel?
- **P17.** Back from the two Contributions links. Safari restores scroll differently from Chromium on a hash route; the
  five links that return in place here may not there.
- **The filled button.** Smooth scroll, then focus on the heading with `preventScroll`: no second jump.
- **The landings.** "Check the match ›" and "Type what goes in ›" focus a box with no tap: Safari will not open the
  keyboard. Does `select()` still mark the "0" or "396"?
- **The answer panel.** "Answer" focuses the first chip; the $ box is 16 px (no zoom).
- **Assumptions.** A chip fills the box without opening the keyboard; VoiceOver reads each chip's pressed state.
- **The tax chips.** Showing and hiding the second box must not open the keyboard; typing "4%" on the text keyboard.
- **The toast.** A 206 px toast over the foot of the screen with the home indicator (P3, P13).
- **Storage.** A leftover answer saved on a phone that is not on the Home Screen can vanish with the plan after 7 days
  without a visit (docs/PLAN.md:159).

## Clean-up
- The three servers were started by `rv/ret/person2/srv.mjs` (pids in `srv.pids`) and stopped by pid.
- `rv/v-ret-person`, `rv/v-ret-person-base` and `rv/v-ret-person-wip` were removed with `git worktree remove`.
- Nothing in `$REPO` or in `rv/b-ret` was edited. `rv/b-ret` still holds its uncommitted changes.
