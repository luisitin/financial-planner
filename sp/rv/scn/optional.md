# Track scn (L1): the simple-first pass, screen by screen (2026-11-13)

The owner's rule (2026-11-12 and 2026-11-13) as the workflow read it: the first view of a card or form shows the answer, at most
three rows or boxes and one action; everything else one quiet tap away in plain words, never a second filled button; chips or
presets first, "Type my own" opens the exact box; a fold that holds something the person changed, or an error, says so and an
error opens it; opening or closing never changes the plan; deeper pages by "Go deeper" links; a hint worth money is never folded;
plain `<details class="fold">` and existing classes. No ability removed.

How counted: `fix2/walk.mjs` opens each screen in the sandbox (Chromium, iPhone user agent) and counts only what is visible before
any tap (anything inside a closed fold is not counted). Before = 707b12e (`fix2/before/measure.json`), after = a8e0763
(`fix2/after/measure.json`); each at 390 and 320 px, light and dark (dark gives the same counts; 68 screens each side). "items" =
change cards (Goal seek), rows (What matters most), listed changes (Legacy goals); "screens" = page height in phone screens.
Pictures of each are next to the counts (`<who>_<page>_<width>[_dark].png`).

| screen | screens | cards | items | chips | boxes | buttons and links | filled | words |
|---|---|---|---|---|---|---|---|---|
| Casey, Goal seek, 390 | 3 / 2.3 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 410 / 308 |
| Casey, Goal seek, 320 | 5.5 / 3.9 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 410 / 308 |
| Jamie, Goal seek, 390 | 3 / 2.3 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 424 / 290 |
| Robin, Goal seek, 390 | 3 / 2.4 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 396 / 312 |
| Dana & Lee, Goal seek, 390 | 3.2 / 2.4 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 416 / 319 |
| Morgan, Goal seek, 390 | 3 / 2.3 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 409 / 289 |
| retired couple, Goal seek, 390 | 2.1 / 1.9 | 3 / 3 | 2 / 2 | 5 / 4 | 1 / 0 | 4 / 3 | 0 / 0 | 257 / 224 |
| family, Goal seek, 390 | 3.1 / 2.4 | 3 / 3 | 5 / 3 | 5 / 4 | 1 / 0 | 7 / 4 | 0 / 0 | 410 / 313 |
| Sam (gated), Goal seek | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 | 54 / 54 |
| Casey, What matters most, 390 | 2 / 1.6 | 2 / 2 | 5 / 3 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 287 / 215 |
| Casey, What matters most, 320 | 3.3 / 2.6 | 2 / 2 | 5 / 3 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 287 / 215 |
| Dana & Lee, What matters most, 390 | 1.9 / 1.5 | 2 / 2 | 5 / 3 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 250 / 201 |
| Morgan, What matters most, 390 | 2 / 1.6 | 2 / 2 | 5 / 3 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 257 / 206 |
| family, What matters most, 390 | 1.9 / 1.5 | 2 / 2 | 5 / 3 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 228 / 178 |
| qa single adult, What matters most, 390 | 2 / 1.4 | 2 / 2 | 5 / 1 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 277 / 194 |
| qa "retires today", What matters most, 390 | 1.9 / 1 | 2 / 2 | 6 / 0 | 2 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 215 / 78 |
| Sam (gated), What matters most | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 | 57 / 57 |
| Jamie leaving $20,000, Legacy goals, 390 | 1.7 / 1.5 | 5 / 5 | 5 / 3 | 0 / 0 | 0 / 0 | 4 / 4 | 0 / 0 | 226 / 151 |
| Jamie leaving $20,000, Legacy goals, 320 | 3 / 2.5 | 5 / 5 | 5 / 3 | 0 / 0 | 0 / 0 | 4 / 4 | 0 / 0 | 226 / 151 |
| family, nothing to leave yet, Legacy goals, 390 | 1.4 / 1.3 | 4 / 4 | 0 / 0 | 0 / 0 | 4 / 3 | 3 / 3 | 1 / 1 | 120 / 124 |

(The 320 px rows not shown move the same way as their 390 px rows: Goal seek 5.4-5.5 screens to 3.8-4.1, What matters most
2.9-3.3 to 1.5-2.6. No screen has a sideways scroll, a page error, a control under 44 px or a builder word, before or after.)

## Goal seek
First view now: the hero (the answer), the goal (one line, four chips, "More options"), "What each change would have to be" with
three cards (each its value, its sentence, its own outlined button to the page that makes the change), "N more changes", the grey
growth line, "What matters most? ›", the folded "How it is worked out". No filled button.
- **Moved behind "N more changes"** (line names them: "2 more changes: retiring, Social Security"): the cards after the first
  three, chosen by `firstLevers` (compute.js, pure, tested). Never folded, because each is worth money to the person (rule 7): the
  Social Security card while that age gets there on its own or adds room, and the saving card that names a 401(k) with nothing
  going in ("Less would do if Casey's job adds some": a match they may be missing) while it gets there. Then the changes that get
  there on their own, those with room, "just right", "not on its own" last.
- **Moved behind "More options"** (line "bad luck, your own amount"; once in use: "room for bad luck is on; leaving $150,000"):
  the "Room for bad luck" chip and its explanation, and the exact box "Or leave at least" with "Use this". The four goal chips
  stay first (rule 3: presets first, the exact box one tap away). A typo opens the fold and says what to do under the box (rule
  4). The fold stays open while the page redraws after a chip or an amount.
- **Moved behind "See each age"** (inside the Social Security card): the nine bars of what the plan can spend at each claiming
  age. The card's sentence still names the best age and its amount.
- **Moved into "How it is worked out"**: the note that another spending rule is in use ("What you can spend and when you can
  retire are worked out spending the same every year; your plan uses another rule ...") with its link.
- On a phone a fold's line sits under its title (the titles were cut in two at 320 px); the card titles keep one line at 320 px
  and the pill goes under them (N4).
- Kept as it was: the hero, every card's own button, the grey line and its detail in "How it is worked out", "What matters most?
  ›" (the Go deeper link), the gate for Sam with its one filled "Add what you own ›".

## What matters most
First view now: the hero (headline, the answer: what the plan can pay against what it plans, or when the money runs out, and the
sentence that says what moves it), "Which numbers matter most" with the caption, the three numbers that move the measure most, "N
more numbers", "Measure it another way", one outlined "What it would take ›" / "How far each change could go ›", then the folded
"How to read this" and "How it is worked out". No filled button.
- **Three rows, not five** (`SHOWN` 3); the rest under "N more numbers", and with them every number that moves nothing, as "6.0%
  or 8.0%: no change here" without a bar (N1). The fold's line says "they move it less", "they change nothing here" or both.
- **Moved behind "Measure it another way"**: the measure chips ("What you can spend", "What is left at the end", "How long it
  lasts"; only those that something moves). Its line names the others, and "showing how long it lasts" once the person picks one
  (rule 4). The caption above the bars always says what they show.
- **Moved into "How to read this"**: "Each of your plan's numbers is nudged down and up, one at a time, with everything else kept
  the same" (it opened the hero). The hero keeps the answer only.
- Kept: each row's "More about this" (now stays open across a switch, N6), "Check the figures we use ›" inside "How to read this",
  the gate.

## Legacy goals
- **"Does the plan leave it?"**: three changes, in Goal seek's first-view order, the rest under "N more changes" with their names.
- **The add form**: three boxes (to whom, who, the amount); the optional note under "Add a note" ("optional"). Changing someone who
  has a note opens it and its line says "has one". The note is saved from inside the fold.
- Kept: the stats, the verdict, "Goal seek", the list, "+ Add someone" once someone is listed, the home tick box, "More on this".

## Opening and closing never change the plan
Tested in each module (`r.saved` stays empty through every open, close, chip and switch) and on the phone (`fix2/after-open/
interact.log`: the sandbox plan is byte-identical after every tap on Goal seek, What matters most and Legacy goals; the only write
is the Legacy note saved with "Add", on purpose).

## Not folded on purpose
- Goal seek's spending card keeps "Even in a bad run of years: about $1,800 a month, $1,290 less than ...": the careful figure is
  what the "tight" pill rests on; folding it would hide why the pill is amber.
- The grey growth line stays open: it is the page's answer to "can a higher return fix it?" (spec D-A7) and is three to five
  lines.
- The goal's four chips stay (rule 3); at 320 px they take three lines. Shorter labels ("$250,000") would save one line at 320 px
  only and make the chips less clear; not done.
