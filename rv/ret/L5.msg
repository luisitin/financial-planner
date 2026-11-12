Assumptions: careful, middle and hopeful, and what a change does to the retirement answer

What the person sees: on Assumptions, above the stock box, three
outlined chips, "Careful 6%", "Middle 7% (ours)", "Hopeful 8%", and one
line "Most forecasts for the next 10 years: 4.8%-6.8% a year for U.S.
stocks (Vanguard, as of 2026-09-30); 6.7% (J.P. Morgan 2026)."; above
the inflation box "2.5%", "3% (ours)", "4%". A chip fills the box; the
page's one filled "Save and mark as reviewed" saves, and its notice now
says "Saved and marked as reviewed. Your retirement answer: now runs out
at 69 (was 70)." (repeated at the foot of the screen by the shell, in
view). Back on Will the money last?: "Before your change: runs out at
70. Now: runs out at 69. You changed how fast investments grow (7% →
6%)." A stock return typed above 8% shows, under the box as it is typed,
the amber "Higher than any forecast we know; plan on it only if you have
a reason.", and Will the money last?'s hero then carries the amber tag
"on your hopeful return" with "Check it ›". Why: owner's request
2026-11-11 (check inflation and returns with context and see the effect;
a higher return must not read as a fix).

Formulas and decisions:
- system/assumptions/compute.js: RETURN_PRESETS (0.06, 0.07 ours, 0.08)
  and INFLATION_PRESETS (0.025, 0.03 ours, 0.04), each with its reason
  and source (README); HOPEFUL_MAX = 0.08; hopefulReturn(plan);
  compute() returns `hopeful` and one amber warning above 8% (history's
  "optimistic" joins it instead of a second line); saveAssumptions(),
  the page's Save, used by the test.
- Said = done, tested: the growth and prices rows on Will the money
  last? (levers.js now reads these presets) equal the answer after
  Assumptions' Save of that chip with every other figure as shown
  (Jamie, Casey, Dana & Lee; Jamie 70: careful 69, hopeful 71).
- The answer before and after a save: levers.js answerOf (one
  projection) and answerChangeWords, the words Contributions uses;
  only when a figure changed; that notice stays. Right after a save the
  "Reviewed on" notice is left out, so the shell's echo repeats the
  save's own notice (it echoes the first new green one).
- Chips sit between the label and its box; the label is tied to the box
  by id/for so the chips do not become the label's control.
- Default stays 7%; tests/golden/retirement unchanged. "Never green on a
  hopeful return" on every page is L10 (after left2).
- Kept round 17's single filled "Save and mark as reviewed" (design log
  2026-09-15); the help for the stock box no longer calls 7% "cautious".

view.js touched: modules/system/assumptions/view.js,
modules/retirement/projection/view.js

Agent: claude-b
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS
