"What this rests on" on Will the money last?

What the person sees: under the answer, one line counts the numbers it
rests on ("This answer rests on 9 numbers: 2 you gave us, 2 our guesses,
5 usual figures. 1 thing is not counted yet: the $567 left over each
month."). The one filled button is now "Check the numbers behind this ↓";
it opens a card that lists each number with its tag (Yours, Our guess,
Usual figure, Not counted) and what one change would do to the answer,
in the same words as the answer ("If it were invested: lasts to the
end (age 95)"). Coming back after a change shows "Before your change:
runs out at 70. Now: runs out at 69. You changed how fast investments
grow (7% → 6%)." A "Go deeper" card links to What matters most, two
plans side by side and history. #/retirement/projection?check=1 opens
the card and moves focus to its heading once. Why: owner's request
2026-11-11 (check and change what drives the retirement answer).

Formulas and decisions:
- new pure modules/retirement/levers.js. Every effect is the projection
  engine run on a copy of the plan with that one change (buildInputs +
  project), so the words equal the verdict after the matching save
  (tests: said = done for every row kind).
- Score per D-A2 (years moved, or $ left at the end over a year's
  spending); order Not counted, Our guess, Yours, Usual figure, then
  score; 5 shown, the rest folded, rows that move the answer by less
  than a year named in one muted line. Builder's reading: a "Yours" of
  nothing (no 401(k) money, no match on file) that moves the answer a
  year or more sorts with Not counted, so Jamie's match and Casey's
  401(k) come first, as the spec's acceptance walks expect.
- What goes into the 401(k): usual share from pay (Vanguard, How America
  Saves 2026, the estimator's own usualShare) plus the usual match
  (matchTerms 4% of pay at 6% put in, the contributions estimator's
  rounding); never a match on a row with no own money.
- The money left over comes in from the next-best-action spare (the
  view hands it in; levers.js does not import that page).
- Growth and prices only offer Careful 6% / Hopeful 8% and 2.5% / 4%,
  with "Nobody can choose this" and a link to Assumptions (D-A7).
- Unknown savings: only the missing rows, said as "If ..., it would ...".
- The card is drawn after first paint with fixed-height rows (no page
  movement, measured every 20 ms on a 390 and 320 px phone).
- tests/golden/retirement unchanged; the five phone-built households are
  in qa/fixtures/phone-households.mjs (invented).

view.js touched: modules/retirement/projection/view.js

Agent: claude-b
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS
