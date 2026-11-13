# Track ret: the final skeptic (2026-11-13)

Track HEAD 96682da on 707355c (L2 c42c2e5, L3 b19ebe9, L4 b8aeefe, L5 310f16f, L6 96682da). My copy: `rv/v-ret-fin` (detached at
96682da, clean), served on 127.0.0.1:9711 with the kit, always the sandbox, real touch taps (Playwright touchscreen), Chromium
with phone emulation at 390x844 (light) and 320x568 (dark), plus 390 dark / 320 light where named. Scripts and logs:
`rv/ret/final/` (`w1`..`w9` are the walk scripts of the run before mine on this same HEAD; I reran every one I rely on and kept
my own logs as `me-*.log`; `me1`..`me6` and `me/*.mjs` are mine). Pictures: `rv/ret/final/shots/`.

Severity: 5 money wrong where it matters most ... 1 polish. Only what I saw myself is below.

## Findings

### F1 (sev 3, L6 96682da): the word "null" on every row at work, under the tax answers
- Steps: Contributions, tap any 401(k) row (Dana's plan at work; Jamie's; Robin's; Casey's `?add=` landing), tap "Change ›" on
  "Tax on this money: paid later, the usual." 390 light and 320 dark.
- Seen: under "Pay the tax later / Pay the tax now / Some of each" and the rule of thumb, a line that reads `null`
  (`shots/null-dana-390.png`, `null-dana-320d.png`, `null-casey-390.png`; the part's nodes are `DIV, P, TEXT:null`). Every person
  under 50 or paid $150,000 or less gets it, so nearly everyone.
- Cause: `modules/retirement/contributions/view.js:777`
  `more.append(chips, ui.h("p", ...TAX_RULE_OF_THUMB), catchUp ? ui.h("p", ..., catchUp) : null)`: the DOM's own `append` writes
  `null` as text. The fake DOM (`qa/fixtures/fake-dom.mjs:17`) skips nulls, so no test can see it. (The projection view already
  guards the same trap at `projection/view.js:671`.)
- Fix: `more.append(chips, rule, ...(catchUp ? [ui.h("p", ...)] : []))`; and a test that opens "Change ›" and asserts the part's
  text has no "null" (or make the fake DOM's `append` write `String(n)` for null as the browser does, so the whole suite catches it).

### F2 (sev 3, L6 N1 not closed by its own steps): "over the 2026 limit of 24,500" right after the app's own "Use 31.4%"
- Steps (N1's): Dana & Lee, Contributions, Dana's row, Change ›, Some of each, 4% and 2%, Save; Work benefits, "Use 31.4%";
  back to Contributions. 390 light and 320 dark (`me1.mjs N1-limit`).
- Seen: rows $1,911.67 + $130 a month = $24,500.04 a year. Amber notice "Dana: 401(k) / 403(b) contributions of 24,500 are over
  the 2026 limit of 24,500." and the limit row "$24,500 of $24,500", red bar, "$0 over the limit" (`shots/N1-limit-390.png`).
  Pure check `me/n1lim.mjs`: `over: 0.04`, the same warning.
- Cause: `career/benefits/view.js` `use401k` rounds each payment to the nearest cent (22,940 / 12 = 1,911.6667 -> 1,911.67);
  `contributions/compute.js:213` flags any `used - limit > 0`. The N1 test allows a dollar over (`tests/tax-split.test.mjs:398`,
  `own <= limit + 1`), so it passes. (The same rounding pre-dates the track for a plain "Use the most" without a split; N1's fix is
  where it now shows.)
- Fix: round the pay-the-tax-later part down to the cent when the choice is at the limit (`Math.floor(x * 100) / 100`), or let the
  limit check ignore less than $1 (`over: used - limit > 0.5 ? ... : 0`, the warning likewise); tighten the test to `own <= limit`.

### F3 (sev 2, L2 c42c2e5 fold + L5 310f16f fold): a fold that holds a figure just typed says nothing, and Save saves it
- Steps A (Retirement settings): Jamie, Will the money last?, card, spending "Change ›"; open "More settings (stocks, tax, how much to
  take out)", type 85 in "Share in stocks now", close the fold. Summary still "as usual" (`shots/S-settings-closed-changed-390.png`);
  Save saves `stocksNow` 0.85 under "Retirement settings saved." Only after the save does it read "1 changed".
- Steps B (Assumptions, the card's growth "Check ›" = `?show=returnStocks`): open "All the numbers", tap the inflation chip "4%" (or
  type 4), close it. Summary still "9 more" (`shots/CHIP-assump-closed-390.png`, `-320d.png`); the line under it says "Save keeps this
  number."; Save (labelled "Save") saves inflation 0.04 too, and the notice says only "Saved. Your retirement answer: now runs out at 68
  (was 70)." while the box on screen still says 7: nothing on screen says what moved the answer.
- Both 390 light and 320 dark; the plan is unchanged until Save (opening and closing are clean).
- Contributions' "More options" does this right: its line turns to "changed" on `change` (`contributions/view.js:544-552`).
- Owner's rule (4) and said = done ("Save keeps this number").
- Fix: recount the fold line on `input`/`change` against the values drawn (`projection/view.js:505`, `assumptions/view.js:117`):
  "1 changed" / "9 more, 1 changed"; on Assumptions word the line "Save keeps this number and what you changed under All the numbers"
  when there is such a change, and name it in the notice ("Saved: prices rising 3% -> 4%. Your retirement answer: ...").

### F4 (sev 2, L2 c42c2e5): the card's "N more numbers" fold holds the person's own changed figures and says only "6 more numbers"
- Steps: Jamie with growth 6% and prices 3.5% saved on Assumptions earlier (a later visit), Will the money last?, "Check the numbers
  behind this ↓" (`me5.mjs`, 390).
- Seen: shown rows: the left-over, the match, spending; fold "6 more numbers ›" holds "How fast investments grow Yours stocks 6%" and
  "How fast prices rise Yours 3.5%" (the two the owner named) with nothing in its line. The hero counts them ("4 you gave us") but
  the fold does not say which. (Right after the change they are shown, "You just changed this"; on any later visit they fold.)
- Owner's rule (4).
- The same on a plan that is on track (the family, `me-w7-390.log`): the whole card is the fold "What this answer rests on 12 numbers ›"
  and holds the Not counted left-over row ("If it's invested: lasts to the end, with about $4,455,000 more left") with its Answer;
  the line says "12 numbers", not "1 not counted" (the hero above does name the $3,884, so the hint itself is on the screen).
- Fix: the fold line counts the rows whose figure the person set away from the usual one: "6 more numbers, 2 you changed"
  (`projection/view.js:639`), or keep such a growth/prices row out of the fold as the "just changed" ones are; the folded card's
  line (`projection/view.js:613`, now "N numbers") adds "1 not counted" when it holds one.

### F5 (sev 2, L6 96682da): on a row that has a pay-the-tax-now partner, every save speaks of the tax and drops the answer
- Steps 1 (B5's): Jamie (match never asked), Contributions, row, Change ›, Pay the tax now, Save; Will the money last?, match row
  "Check the match ›" (said: "about $2,040 a year: runs out at 75"), type 2040, Save.
  Seen: "Saved: $250 a month goes into Roth 401(k) at work, paying the tax now; the match stays pay-the-tax-later." Nothing about the
  $2,040 just typed, no "Your retirement answer: now runs out at 75 (was 71)" (the projection then shows 71 -> 75, so the money is
  right). The same check on a plain row says "Saved: Jamie's employer adds $2,040 a year. Your retirement answer: now runs out at 74
  (was 70)." (`me-w5-390.log`, `me-w2-390.log` P5).
- Steps 2: Dana after a split ($270 later + $130 now), open the later row, raise it to 470, Save (`me6.mjs`).
  Seen: "Saved: $470 a month paying the tax later (with the match), $130 a month paying it now." No answer, though $2,400 a year more
  goes in, and the answer moved: "lasts to the end, with about $112,000 more left at 97" (`me/f5.mjs`, `answerOf` before and after).
- Cause: `contributions/view.js` sends every save of a paired row through the tax path (`pending.tax`), and `moved` is skipped for
  `pending.tax` (line ~200, by design for a change of *when* the tax is paid, D-C3).
- Fix: skip the answer only when the tax answer itself changed; when it did not (same choice as the row had), say what changed
  (the amount, the match) and add `moved` as every other save does; after a landing from "Check the match ›" lead with "Saved: Jamie's
  employer adds $2,040 a year (on the pay-the-tax-later row)."

### F6 (sev 2, L5, owner's rule): Assumptions opened from the menu is still all ten boxes
- Steps: menu, Assumptions (Jamie), 390 (`me1.mjs FV-assump-menu`, `shots/FV-assump-menu-390.png`, `-full`).
- Seen: 10 boxes and their chips in one form, "Save and mark as reviewed" at the foot of a 2,468 px page. The simple-first shape
  exists on this page (`?show=`: one number, Save, "All the numbers 9 more") but the plain page does not use it. The README says it
  is on purpose ("its job is to look them all over"); the owner's rule of 2026-11-13 says simple by default with the depth one tap away.
- Fix: open plainly on the two the owner named (stocks growth and prices, with their chips) and "Save", the other eight under
  "8 more numbers"; opening them turns Save into "Save and mark as reviewed" exactly as `?show=` does. No ability lost.

### F7 (sev 1, L2, owner's rule): "Go deeper" is five buttons
- Seen at 320 (`me4.mjs`, `shots/DEEPER-320.png`): five outlined links stacked, 399 px. The rule's first view is at most three and
  one action. Fix: the two that answer the hero's question ("Could you stop sooner? What would change it ›", "Chance the money lasts ›"
  or "How much to take out ›"), the other three under "3 more ways to look at it".

### F8 (sev 1, L6, M2's "said before saving"): Some of each, both parts typed, Save tapped from the box: the new total is never said
- Steps (P1's): Dana, row, Change ›, Some of each, type 4% in the later box and 2% in the now box, tap Save with the keyboard up.
- Seen: at the tap the line still reads "Now $400 a month in all. Type the part that pays the tax now; the rest stays
  pay-the-tax-later." (`shots/P1-both-before-390.png`); saved $260 + $130 = $390 a month; the notice "Saved: $260 a month paying the
  tax later (with the match), $130 a month paying it now." never says it is $10 a month less than before.
- Cause: `saySum` runs on `change` only (`contributions/view.js:769-770`), and the tap on Save is what fires that change.
- Fix: run `saySum` on `input` as well (it only writes the reserved line, nothing moves), and when the saved total differs from the
  one before, add it to the notice ("$390 a month in all, $10 less than before").

## (a) fix-2.md's findings, by their original steps
Closed, seen on the screen (390 light and 320 dark unless named), my reruns matching the run before mine line for line:
- P1: Save tapped from the now box with the keyboard up saves 260 + 130 (both typed) or 270 + 130 (now only); no echo (`me-w2-*.log`).
- P2: Casey's landing: empty box with 396 grey, "Use the usual 6.6% ($396 a month)"; one tap on Save saves nothing and the refusal is
  in view (`shots/P2-refused-320d.png`). P8: a 0 typed: "Noted: no match at Casey's job ... now runs out at 79 (was 67)".
- P5: "It matches" leaves the page where it was (scroll 0 -> 0 at 390, 369 -> 369 at 320); "Save the match" saved 2,040; P9: no
  "No match" card after.
- P7: one box and Save on the first screen (y 654 / 468); after Save "now runs out at 73 (was 70)", still there after 7 s.
- N4: a second tap 200 or 400 ms after "Change ›" keeps the route, the spending box focused.
- N3: an emptied box is refused in words, in view; rows unchanged. B2: taking a split back gives one row of $390 (4% + $130).
- N5: an account changed with the tax answer moves the row and says so.
- F6/P13: no echo over the answered row at 0.7 s; the notice is in the card.
- M1 (family-shaped `02-couple-no-kids/base`), M3 (bank row not counted as retirement saving on Dashboard, Contributions, Benchmarks),
  M7 (Sam: no "was"), B3 (Lower it to $1,120 / Stop counting it, the bill added on the Expenses page itself, `w3b.mjs` rerun:
  the row's "$445,000 less" = the notice's), B7 (account deleted:
  "Stop counting it"), M8 (all Roth: "your take-home pay drops by the same $180"), M5 (Robin: "6% ... enough for the whole usual
  match", the match left blank stays our guess, "now runs out at 93 (was 91)" = the card's 93), B1 (two jobs, each its own pair),
  B5 (the match lands on a pay-the-tax-later row; but see F5 for its notice), P6 (no "still" when the verdict turns; Remove under
  "More options" says "Before: ... Now: ...", `w6.mjs` rerun), P3 (one
  sentence; "When the tax is paid" open under the rows with the tax and the mix), P4 (`?show=` Save at y 623 at 390), P10 (Save at
  y 662 of 844), M4/M6 (words and the 7.5% J.P. Morgan October 2026 line on screen), recheck M2 ($2,040 / $2,880 from the same table).
- N1: NOT closed on the screen: F2.
- Not walked, closed by their tests only (they fail on the pre-round tree per fix-2 and pass here): M2's sum line before saving (on
  the phone a Save tapped from the box saves before the sum line has moved: 4% + 2% saved $390 against $400 before, the person's own
  two shares, the line still reading "Now $400 a month in all" at the tap, `shots/P1-both-before-390.png`), N2, N6.

## (b) the owner's rule, screen by screen
- Will the money last? hero: answer, one line of what it rests on, one filled button; Sam keeps "Add what you own ›". OK.
- The card: three rows, the rest under "N more numbers"; Not counted rows and just-changed rows never folded. F4.
- Left-over answer: three chips, two prefilled boxes, one "Save my answer". OK.
- Retirement settings from the spending row: one box, Save, "More settings ..." with "as usual"/"N changed"; an out-of-range box
  opens it (`w1b.mjs` I-settings, rerun). F3.
- Contributions: a row opens on three boxes, Save on the first screen; tax behind "Change ›"; "More options" (account, whose,
  Remove) says "changed" live; the match question and "Does Casey's job add money" never folded. F1, F5.
- Assumptions `?show=`: one number, Save right under, "All the numbers 9 more"; out of range opens it (`w1b.mjs` I-assump, rerun). F3, F6.
- Work benefits, Paycheck: words only; Paycheck's Roth 401(k) line reads the rows ($60 a paycheck for $130 a month, `me/pc.mjs`). F2.
- Opening and closing every fold on the projection (Jamie, Dana, Casey), Contributions (a row open, "Change ›" and "More options"),
  Assumptions (both folds), and a chip tapped inside a fold then closed: the saved plan byte-identical before and after (`me-w1T-390.log`,
  `me1 CHIP`).
- Wording of the opt-ins: plain ("N more numbers", "More settings (stocks, tax, how much to take out)", "All the numbers", "More
  options", "When the tax is paid", "What changed", "Change ›"). No builder, PC, AI or sync words in any new string.

## (c) as a layperson
- Jamie: "Check the numbers behind this ↓", "Check the match ›", type 2,040, Save: "now runs out at 74 (was 70)" = the card's 74.
  No fold needed. Investing the left-over: prefilled $560, "now runs out at 89 (was 70)" = the card's 89 (`me3.mjs`).
- Casey: "Type what goes in ›", "Use the usual 6.6% ($396 a month)", Save, match left blank: "now runs out at 88 (was 67)" = the
  card's 88, the match saved as our guess and said so. No fold needed.
- Dana & Lee: Answer, Invested for later, $1,820, Save: "lasts to the end, with about $1,165,000 more left" = the card. The Roth
  split is one quiet tap ("Change ›"), no fold. A change of a growth number from the card: "Check ›", Careful 6%, Save, Back: "before
  your change: runs out at 70. Now: runs out at 69. You changed how fast investments grow (7% -> 6%)" = the card's 69 (`me2.mjs`).
- A curious person finds: every number's source under the card's rows and "Where these numbers come from"; the tax and the mix under
  "When the tax is paid"; the six other settings under "More settings"; Go deeper's five pages.

## (d) regressions
- `npm run registry`: no change. Whole `npm test` (`npm-test-2.txt`): 189,479 tests, 188,837 pass, 2 fail, 3 skipped, 637 todo; the
  two are the named speed tests ("takes well under 1.5 s", "200 times in under 600 ms"), run while my phone walks loaded the machine
  (load 15-20 on 4 cores); rerun alone (`node --test --test-name-pattern ...`): 2 of 2 pass.
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,887 files. `git diff 707355c HEAD -- tests/golden`: empty.
- Commit trailers: each of the five ends with exactly Agent / Co-Authored-By ([model]) / Claude-Session.
- Pure functions over every qa fixture and household: `sweep2.mjs` (1,446 plans: every qa fixture, archetype and pack, the phone
  households; 11,032 rows, 825 left-over rows, 15,946 change sentences) 0 problems; `sweep3.mjs` (59 base households x rows at work in
  ten shapes: 684 variants, 918 pairs, 2,754 splits, 403 two-job pairs, lever rows on all) 0 problems: nothing throws, every figure
  finite, no NaN / Infinity / undefined / null in any sentence (`me-sweep2.json`, `me-sweep3.json`).
- On the phone, every track screen with every fold opened and every chip tried, for Jamie, Jamie never asked, Dana & Lee, Sam
  (`me-w9-390.log`): the only bad text is F1's "null". No sideways scroll and no page or console error in any walk.
- said = done: every effect I walked equals the saved answer (Jamie 74, 89, 73, 69, 68; Casey 88; Robin 93; Dana's $1,165,000).

## Only Chromium: try on the real iPhone (Safari)
1. Contributions, a row, "Change ›": the line under the rule of thumb (F1) and the three chips wrapping at 320.
2. Some of each: tap Save straight from the "Pay the tax now" box with the keyboard up (P1): Save must not jump.
3. "It matches" (P5) and "Check the match ›" landings: no scroll under the thumb; the box in view above the keyboard.
4. A quick double tap on the card's spending "Change ›" (N4): no reload, the box keeps the focus.
5. Assumptions `?show=`: chips with the keyboard open, Save under the box, and the fold line after a chip inside the fold (F3).
6. The folds' summaries as tap targets (44 px) and their chevrons in Safari's own `<details>` styling.
7. Notices after Save on Assumptions at 320 (off the top; the shell's echo shows instead) and on Contributions (scrolled to centre).
8. Work benefits "Use 31.4%" then Contributions' limit line (F2).

## Clean-up
- The server on 9711 stopped by its pid (wrapper and child); no other process touched. The scratch worktree `rv/v-ret-fin` removed
  (`git worktree remove`; it held only the kit's git-ignored `planner.properties`). The track's worktree `rv/b-ret` was only read.
