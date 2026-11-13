# Track ret: the simple-first pass on every screen of L2-L6 (round 2, 2026-11-13, builder claude-b)

The owner's rule (2026-11-12, 2026-11-13; DESIGN_LOG "Simple first"): the first view shows the answer, at most three rows or
boxes and one action; everything else one quiet tap away, in plain words; chips first; a fold that holds a changed figure or an
error says so (an error opens it); opening or closing never changes the plan; deeper pages by "Go deeper" links; a hint worth
money is never folded; plain `<details class="fold">`.

**How it was counted.** `rv/ret/fix3/firstview.mjs` (kit, sandbox, Chromium with phone emulation) opens each screen as a person
reaches it and counts what is on the first screen before any further tap: words, rows (records), boxes, actions, filled buttons;
and the same for the whole measured part (folded content not counted). 18 screens x 390 light, 320 light, 320 dark.
Before = the pre-round tip d4f8a01 (`rv/ret/fix3/fv-before/`, `fv-before-summary.txt`); after = the new tip
(`rv/ret/fix3/fv-after2/`, `fv-compare2.txt`, pictures beside each). No screen scrolls sideways, no page or console error, before
or after. The counter takes Contributions' red outlined "Remove this contribution" for a filled button (its background is the
panel colour); it is outlined.

## Will the money last? (L2): the hero

| household | first screen before (390 / 320) | after (390 / 320) |
|---|---|---|
| Jamie | 202 words, 3 actions / 138 words, the filled button below the screen | 209 words, 1 action / 123 words, the filled button on screen |
| Casey | 189, 3 actions / 136, button off screen | 207, 1 action / 123, on screen |
| Dana & Lee | 194, 3 actions / 130, off screen | 209, 1 action / 115, on screen |
| the family (on track) | 151, 4 actions / 121, off screen | 158, 3 / 111, on screen |
| Sam (nothing saved) | 173, 3 / 120, 1 | 173, 3 / 121, 2 (unchanged on purpose) |

- The answer, the line of what it rests on and **one action** ("Check the numbers behind this ↓", filled), then the bad-run lines
  and when retirement starts (P21: those came first and pushed the button off the 320 px screen).
- Moved: "Could you stop sooner? What would change it ›" and "Chance the money lasts ›" (or "How much to take out ›") from beside
  the filled button to the top of the **Go deeper** card under "What this answer rests on" (rule 6). Nothing removed.
- Sam keeps "Add what you own ›" (filled) and the outlined check: with nothing saved, seeing what is not counted is the answer.
- Go deeper is left out while the answer is "We don't know yet" (P19).
- Whole page: 730 → 671 words (Jamie), 905 → 813 (Dana & Lee); 4,193 → 3,853 px tall (Jamie, 390).

## What this answer rests on (L2, the card)

| | rows shown before → after | card height 390 / 320 |
|---|---|---|
| Jamie | 5 → 3 (+ "N more numbers") | 1,061 → 729 / 1,237 → 820 px |
| Dana & Lee | 5 → 3 | 1,280 → 866 / 1,507 → 1,054 px |
| Sam | 2 → 2 | 435 / 500 (unchanged) |

- Three rows, the rest under "N more numbers"; the intro is one sentence (was three).
- Never folded (rules 4, 7): a number not counted yet (the money left over, a match never asked: worth money), a row the person
  just changed, the left-over row right after it is answered.
- "Before your change" in the hero is one sentence; what was changed and the tax note are under "What changed" (P12, L6).

## The left-over answer (L4)
- 2 boxes (into which account, how much a month) under three chips, one filled "Save my answer". Within the rule: unchanged
  (46 words at 390). The chips come first; the amount is filled in and the person's to change.

## Retirement settings from the spending row (L2 fold, L6 notice)

| | before | after |
|---|---|---|
| boxes on the first screen, 390 | 5 of 7, Save below the screen (y 979) | 1 (the spending figure), Save at y 654 |
| whole fold | 7 boxes, 178 words, 980 px | 1 box, 63 words, 395 px |

- Moved under **"More settings (stocks, tax, how much to take out)"**: share in stocks now and once retired, how tax is worked
  out, the flat rate, how much to take out, the starting rate. Its line says "as usual" or "N changed"; a box the browser
  refuses opens it. All six stay in the form and Save saves them as before.
- After Save the notice stays and says "now runs out at 73 (was 70)" (P7).

## Retirement contributions (L3 landings, L6 form)

| screen | before (390) | after (390) |
|---|---|---|
| a row at work opened (Dana) | 5 boxes, 101 words, Save at y 830 of 844 | 3 boxes, 66 words, Save at y 606 |
| "Type what goes in ›" (Casey) | 4 boxes, our 396 and $2,880 typed in, 2 red/filled buttons on screen | 3 boxes, empty with 396 grey, chip "Use the usual 6.6% ($396 a month)", Save the one filled |
| "Check the match ›" (Jamie) | 3 boxes, Remove on the first screen | 3 boxes, Remove folded |
| the match check (Jamie, never asked) | "It matches" scrolled 1,381 px into the whole form | "It matches" opens one box and "Save the match" in the card |

- **"Tax on this money: paid later, the usual. Change ›"**: one quiet line where the three chips, the rule of thumb and a
  citation were (P10). "Change ›" shows the chips, the rule of thumb and the catch-up line; the line says "paid now (Roth)" or
  "some paid later, some now" when that is the answer. The citation is in the README only.
- **"More options"** (was "Account and whose"): which account, whose, and now "Remove this contribution" at its end. Its line
  names the account, or says "changed"; a refused box opens it.
- **"When the tax is paid"** under the rows (only when someone pays the tax now): this year's tax and the mix at retirement,
  worked out when opened; open right after a tax answer is saved, whose one-sentence notice is in view (P3).
- Some of each: "Now $400 a month in all." and the tax line have their room from the first draw (P1, M2).
- Never folded: the "No match on file. Is that right?" question and "Does Casey's job add money (a match)? Most that match add
  about $2,880 a year" (worth money).
- A refused save is brought into view (it was drawn above the screen).

## Assumptions (L5)

| | before | after |
|---|---|---|
| from the card (?show=returnStocks), 390 | 4 boxes on screen, 10 in the form, "Save and mark as reviewed" at y 1,562 | 1 box with its chips and the forecast line, "Save" at y 623; 1,397 px instead of 2,411 |
| opened from the menu | 10 boxes (the review of all ten) | the same: this page is the review |

- Moved under **"All the numbers"** (its line: "9 more", or "9 more, N changed"): the other nine. Opening it turns Save into
  "Save and mark as reviewed"; a Save with it closed keeps the one number and leaves the review date alone.

## Work benefits (L6) and Paycheck (L6)
- Words only (M8) and the "Use N%" sums (N1); no new box or button. 165 words on the first screen at 390, unchanged.

## Not done, and why
- The landing note on "Type what goes in ›" is about 60 words; the tests read its words and it is what the card tried. It sits
  right over the box. A shorter note is a wording change for the next round.
- A shared helper that remembers which folds a person opened comes later (task rule 8); the markup is plain `<details class="fold">`.
