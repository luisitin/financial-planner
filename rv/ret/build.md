# Track "ret" build log (claude-b, builder), worktree rv/b-ret on fa2026e

Owner's request 2026-11-11 (spec rv/spec.md, parts A-D). Commits L2-L6, one each, local only.
Scratch scripts: rv/ret/s/ (lv.mjs lever dump, walk.mjs/srv.mjs phone kit wrappers, l2*.mjs walks). Screenshots: rv/ret/shots/.
Server: 127.0.0.1:9711 (srv.mjs, started for the walks, stopped at the end).

## L2 "What this rests on" on Will the money last?
Files:
- new `modules/retirement/levers.js` (pure: leverList, leverSteps, leverRows, answerOf/answerWords/effectWords, scoreOf,
  workAlt/applyWorkAlt, usualMatchAt, assumptionTag, restsOnWords, valuesOf/changedWords)
- new `tests/levers.test.mjs` (12 tests)
- new `qa/fixtures/phone-households.mjs` (the five phone-built households Dana & Lee, Jamie, Casey, Robin, Morgan, as JSON
  literals; named without "-plan" so tests/guesses-invariance.test.mjs, which requires no ledger in *-plan.mjs, does not load them)
- `modules/retirement/projection/view.js` (hero line, filled button, Before/Now line, the card, Go deeper, ?check=1, the
  chart's two links; settings fold gets class pj-settings so the mix row can open it)
- `modules/retirement/projection/README.md` (section "What this rests on", decisions D-A1..D-A7, D-D1 copied)
Commit: 4284fd5 "What this rests on" on Will the money last?
Tests: npm run registry (161), npm run check OK, leak-guard --worktree OK (2870 files); node --test levers, projection module,
withdrawal-strategy, odds-words, pages-followup-b, plain-words-followup, wording*, user-view, guesses-invariance: pass 201, fail 0, todo 12.
Fixed on the way: withdrawal-strategy's minimal fake ui has no addEventListener (now `card.addEventListener?.(...)`); a test that
assumed a match on a $0 row is ignored was wrong (the engine counts it: Casey 67 -> 73), replaced by "no alternative writes a match onto
a row with no own money" and an engine note for claude-c in the README.
Figures (lv.mjs): Jamie runs out at 70; leftover invested 89 / bank 81; usual match about $2,040 a year -> 74; stop at 67 -> 78; stocks 6% / 8% -> 69 / 71.
Casey runs out at 67; 6.6% of pay plus the usual match -> 88. Assumptions 6% -> "Before your change: runs out at 70. Now: runs out at 69."
Phone (kit, sandbox, Chromium): shots in rv/ret/shots/
- L2-noMatch-390-top.png / -full.png / -card.png: Jamie hero line, filled "Check the numbers behind this ↓", card with 5 rows.
- L2-noMatch-320-dark-top.png, -aftertap.png, -card.png: after the tap the heading sits at top 85 px, focused, in view; tags wrap under
  the label at 320.
- L2-noContrib-390-*.png (Casey), L2-sam-390-*.png (Sam, unknown: "Add what you own ›" stays the filled one), L2-couple2k-390-*.png
  (Dana & Lee, tight: open card), L2-family-390-*.png (on track: folded "12 numbers"), L2-noMatch-390-before.png (Before/Now line).
- Movement: positions sampled every 20 ms for 4 s after load: nothing moved (Jamie 390, Jamie 320 dark, Dana & Lee 390, Casey 320).
- census: no problems, no horizontal overflow, no page errors.
Deviations:
- D-A2 order: zero "Yours" rows with a year or more of effect sort with Not counted (see commit). Without it, acceptance 1 and 3 fold.
- Spec walk said Jamie's usual match -> 75 and Assumptions 6% -> 66: the engine with this plan gives 74 (match is 4% of capped pay at the
  usual 6% in, his row puts less in) and 69 (66 was the builder variant's plan). The card and README carry the engine's numbers.
- Couple answers read the first adult's age (the engine's failAge); "lasts to the end (age 97)" for Dana & Lee.
- Claiming Social Security at 70 can read worse (Jamie 68): honest engine result, shown as is.
- leverRows costs 30-650 ms in Node: it runs sliced after first paint (whenWorked), so taps never wait.
- The all-pack sweep (about 500 variants) is not in npm test; the test runs the 14 base households, every *-plan.mjs fixture and the
  five phone households.
Try on a real iPhone: tap "Check the numbers behind this ↓" (smooth scroll + focus with preventScroll), the folded "N more numbers"
details, the "mix" row opening the settings fold and focusing its box (keyboard should not jump the page), VoiceOver reading the tags.

## L3 Contributions: landings, the match check, the answer after a save
Commit: be77621 Contributions: the card's links land on the box, the match check, the answer after a save
Files: `modules/retirement/levers.js` (workLanding, matchLanding, matchChecks, answerChangeWords),
`modules/retirement/contributions/{view.js,README.md,module.test.mjs}`, `modules/retirement/projection/README.md` (pointer),
`tests/levers.test.mjs` (3 new tests).
Tests: registry 161, check OK, leak-guard OK; levers + contributions + projection + followups-fix1 + guesses-saving* +
followups-saving + next-best-action + user-view + plain-words-followup + wording* + guesses-invariance: pass 308, fail 0, todo 12
(the todos are claude-a's wording slips, pre-existing).
Changed an existing test: contributions "round 8 item 1: no match known" asserted the old "common match" figure $1,740 (50% up to
6%); the spec's D-A4 replaces it with matchTerms (4% of pay at 6% in): $2,280.
Phone (Chromium, sandbox; rv/ret/s/l3a.mjs):
- L3-jamie-320-dark-land.png: card -> "Check the match ›" -> Contributions?match=...: the match box at top 288 of 568, focused,
  "0" selected, the note right over it (first walk had the note at the form's top, scrolled out of view: moved it over the box).
- L3-jamie-320-dark-saved.png: typed 2040, Save changes: "Contribution saved. Your retirement answer: now runs out at 74 (was 70)."
  (the notice at the page top was out of view at 320; the shell's echo shows it at the bottom, in view).
- L3-jamie-320-dark-back.png: Back: "Before your change: runs out at 70. Now: runs out at 74. You changed the match at Jamie's job
  (none → $2,040 a year)."
- L3-casey-390-land.png / -form.png: "Type what goes in ›": 396 focused and selected, $2,880 in the match box, the note over the
  amount (first walk: "last?:" punctuation and a grey-guess help line under a filled box: both fixed). L3-casey-390-saved.png:
  "now runs out at 88 (was 67)", in view.
- L3-check-390.png, L3-check-320-dark.png: "No match on file. Is that right?", That's right the only filled button;
  L3-check-390-itmatches.png: the match box focused in the tap, top 509 of 844; L3-check-320-dark-thatsright.png: "Noted: no match
  at Jamie's job." with the next move.
- census: no problems; no horizontal overflow; no page or console errors.
Deviations and notes:
- The after-save words are "Your retirement answer: now runs out at 74 (was 70)." (spec: "Now runs out at 76 (was 66)"; the
  figures are the engine's for Jamie; the same helper is used for L5 so both pages say it one way).
- workPlans[pid].match === true with no match typed is not asked by the check (it says "there is a match"); the card's match row
  shows it Not counted and links to the box.
- The "leftover" row's "Count it ›" still opens Contributions plainly (L4 answers it in place instead).
- Next best action's own "common match" sentence (claude-f's compute.js:736) still says 50% up to 6%: for claude-f.
Try on a real iPhone: the ?match landing focuses with preventScroll after the first paint (no keyboard expected, since no tap);
"It matches" focuses inside the tap (keyboard should open and the box stay in view); the 2 s outline; select() on the box.

## L4 The money left over, answered in place
Commit: d5b9e86 Will the money last?: say what happens to the money left over, and count it that way
Files: `modules/retirement/levers.js` (leftoverAnswer, leftoverStanding, applyLeftover, leftoverAccounts; the leftover row reads
the answer; an answered row is `always`), `modules/retirement/projection/view.js` (leftoverPanel in place, keepLeftover, the
notice in the card, the just-answered row first; fixed a literal "null" from native `li.append`), `modules/retirement/contributions/view.js`
(D-B7 account list; removing the row removes the answer), `docs/DATA_MODEL.md` (`retirement.leftover?`), both READMEs (D-B1..D-B7),
`tests/levers.test.mjs` (5 L4 tests), new `tests/leftover-invariance.test.mjs` (2 tests, 33 plans x 159 modules, ~96 s).
Tests: registry 161; check OK; leak-guard OK (2871 files); levers + contributions + projection + withdrawal-strategy + user-view +
plain-words-followup + wording* + followups-saving + next-best-action: pass 267, fail 0, todo 12 (claude-a's wording slips);
leftover-invariance: pass 2.
Phone (Chromium, sandbox; rv/ret/s/l4a.mjs, mv.mjs):
- L4-dl-390-row.png / -ask.png / -invest.png: Dana & Lee "Money left over each month · Not counted · $1,828 a month", both effects
  plus "As it is, counted as spent: lasts to the end (age 97)"; Answer -> focus on "Invested for later"; the form: "A new account:
  Investments for later", $1,820.
- L4-dl-390-saved.png: "Saved: $1,820 a month into Investments for later (a new account at $0, on Net worth). Your retirement
  answer: still lasts to the end, with about $1,165,000 more left at 97 (today's dollars)." in view, the row under it (Yours,
  "Change my answer"); the hero turned "The money lasts" (was "It lasts in most cases, not all").
- L4-dl-390-dashboard.png: "About $100 a year builds up in checking and savings" (the $8 left a month). L4-dl-390-contrib.png: the row
  "Investments for later · Dana · $1,820 every month"; Edit lists it; Remove -> "Contribution removed. Your retirement answer: still
  lasts to the end, with about $1,165,000 less ..."; back on the card the row is Not counted again, $1,828, the same effects.
- L4-jamie-320-dark-bank.png / -saved.png: chips wrap one per line at 320, no sideways scroll; bank into his existing "Savings":
  "now runs out at 81 (was 70)" = the card's "If it piles up in the bank: runs out at 81". Contributions' edit form lists "Savings" (D-B7).
- Sam: the row as a question ("If it were invested: it would last to the end (age 95)"), "Add what you own ›" the only filled one.
- Movement: none on the first screen (Dana & Lee 390, Jamie 320 dark), sampled every 20 ms for 4 s (L4-dl-390-top.png,
  L4-jamie-320-dark-top.png). No page or console errors; census only "under the top bar" for elements scrolled under it.
Deviations / notes:
- First walk showed the literal "null" in every record (native `append` writes null) and the answered row hidden by D-A2's rule
  (score 0): both fixed (filter; `always`), and the just-answered row is put first under its notice (view only).
- The shell's echo toast repeats the notice at the bottom for 4 s (wave 1's, not touched).
- Not done here (not my files): WORKBOARD notes for claude-c (left2's "a typed leftover is not added" note must hide once
  `retirement.leftover.rowId` names a row) and claude-a (balance/projection follows the rows) are in the README and the report.
Try on a real iPhone: "Answer" focuses the first chip with preventScroll and scrolls the panel "nearest" smoothly; the select and
the $ box (16 px, no zoom); after Save the notice is centred and focused (no keyboard); the chips wrap at 320.

## L5 Assumptions: careful, middle and hopeful, and the effect
Commit: 0bd4a09 Assumptions: careful, middle and hopeful, and what a change does to the retirement answer
Files: `modules/system/assumptions/{compute.js,view.js,README.md,module.test.mjs}` (RETURN_PRESETS, INFLATION_PRESETS, HOPEFUL_MAX,
FORECAST_LINE, HOPEFUL_WORDS, hopefulReturn, saveAssumptions; chips, forecast line, amber line, answer after save),
`modules/retirement/levers.js` (growth / prices alternatives read Assumptions' presets), `modules/retirement/projection/{view.js,README.md}`
(hero tag), `tests/levers.test.mjs` ("L5 said = done").
Tests: registry 161; check OK; leak-guard OK; assumptions module 8/8; levers + projection 108/108; user-view + wording* + plain-words* +
guess-sanity-fixes + alerts + contributions + golden-retirement: pass 12953, fail 0, todo 12.
Phone (rv/ret/s/l5a.mjs):
- L5-jamie-390-land.png: the card's growth row ("Careful 6%: runs out at 69. Hopeful 8%: runs out at 71.") "Check ›" lands on the
  stock box (outlined 2 s), chips "Careful 6% / Middle 7% (ours) [on] / Hopeful 8%", inflation "2.5% / 3% (ours) [on] / 4%".
- L5-jamie-390-careful.png: tap Careful: box 6, chip marked. Save: "Saved and marked as reviewed. Your retirement answer: now runs out
  at 69 (was 70)." echoed at the foot, in view (L5-jamie-390-saved.png). Back: "Before your change: runs out at 70. Now: runs out at
  69. You changed how fast investments grow (7% → 6%)." (L5-jamie-390-back.png).
- L5-jamie-320-dark-land.png / -typed9.png: chips wrap at 320, no sideways scroll; typing 9 shows the amber line under the box at once.
  Save: "now runs out at 72 (was 70)". L5-jamie-320-dark-herotag.png: "on your hopeful return Stocks grow 9% a year in this answer:
  higher than any forecast we know. Check it ›" under "Runs out in 2054".
- L5-dl-390-inflation.png / -fold.png: Dana & Lee 4%: "still lasts to the end, with about $223,000 less left at 97 (today's dollars)";
  the fold lists each chip's reason.
- Movement with a hopeful return: none (L5-jamie-390-hopeful-top.png). No page or console errors.
Deviations / notes:
- First walk: the shell's echo repeated "Reviewed on 11/12/2026." (the first new green notice), not the save's answer: the separate
  review notice is now left out right after a save (the save notice says it).
- After-save words: "now runs out at 69 (was 70)" (the spec's "was runs out at 70, now runs out at 66"): one way of saying it on
  every page (answerChangeWords), and 69 is the engine's figure for Jamie.
- On-screen sources avoid "IQPF" (jargon); the README names it.
Try on a real iPhone: chips fill the box without opening the keyboard; the box's label is tied by for/id (VoiceOver should read
"Stocks grow each year" for the box and each chip by its own text); the amber line appears while typing (no zoom: 16 px box).

## L6 Pay the tax later or now, per row at work
Commit: 71ff05a Pay the tax later or now, per row at work: the split, this year's tax, the mix at retirement
Files: `modules/retirement/contributions/{compute.js,view.js,README.md}` (taxPairOf, applyTaxChoice, catchUpRothWords,
TAX_RULE_OF_THUMB, ROTH_MATCH_WORDS; the "When do you pay the tax on it?" block `.ct-tax` with scoped style; D-C1..D-C7 copied),
`modules/retirement/levers.js` (match row per job, matchRowId, mixAtRetirement, mixWords), `modules/retirement/projection/{view.js,README.md}`
(the honest "Before your change" line), `modules/cashflow/paycheck/{compute.js,README.md}` (D-C6), `modules/career/benefits/{compute.js,
view.js,README.md}` (D-C7), `modules/system/assumptions/view.js` (chips read data-v by getAttribute), `qa/fixtures/fake-dom.mjs`
(Element.before/after), new `tests/tax-split.test.mjs` (10). No schema change.
Tests: tests/tax-split 10/10; contributions, projection, levers, paycheck, benefits, golden career and retirement modules pass;
registry 161; check OK; leak-guard OK (2872 files); whole `npm test` (worktree, all five commits): tests 189303, pass 188661, fail 0, skipped 3, todo 639, 214 s.
Phone (rv/ret/s/l6a.mjs, Dana & Lee, sandbox):
- L6-dl-390-ask.png: tapping "Dana's plan at work" opens the form with "When do you pay the tax on it?" [Pay the tax later (on)]
  [Pay the tax now] [Some of each], the rule of thumb with "(Brown, Cederburg and O'Doherty, 2017)".
- L6-dl-390-some.png: "Some of each" shows the second box; 4% later, 2% now: "Paying it all later would lower this year's federal tax
  by about $190." (on the box's change, not each keystroke).
- L6-dl-390-saved.png: "Saved: ... This year's federal tax: about $200 more than before. Your money when retirement starts (2044): 88%
  pay-the-tax-later, 9% already taxed (Roth), 3% regular savings." No retirement answer (D-C3).
- L6-dl-390-rows.png: $260 a month into Dana's plan at work with the whole match, $130 a month into "Dana's Roth 401(k) at work".
  L6-dl-390-networth.png: the new $0 account listed. Paycheck: "Roth 401(k), after tax" from the rows; Work benefits: "on $3,120 put
  in before tax".
- L6-dl-390-before.png: "Before your change ... You changed what goes into Dana's 401(k) ($400 a month → $390 a month) ... You changed
  when the tax is paid on money at work. This answer does not count the tax that paying later saves you each year, so paying now looks
  better here than it is."
- L6-dl-320-dark-{ask,some,saved,rows}.png: chips wrap, no sideways scroll. No page or console errors.
Deviations / notes:
- The new account is "Dana's Roth 401(k) at work" in a two-adult household (spec: "Roth 401(k) at work"): two adults would get two
  accounts of the same name otherwise.
- The notice's tax line compares after the save against before it ("about $200 more than before"), the form's line compares the
  split against all later ($190): the before here was $400 a month, the split totals $390 (4% + 2% of $78,000).
- The mix is said with the year ("when retirement starts (2044)"), not "at 65": one person's age reads wrong for a couple (D-C4 note).
- The amount boxes stay text boxes (they take "4%"); the census notes "no numeric keyboard" for them, by design.
- `.field { display:flex }` beat `hidden` on the second box: the view also sets style.display.
- Not built (spec): C2 and L9 (the match on a Roth row counted as pay-the-tax-later in the engine waits for claude-c's left2).
Try on a real iPhone: the chips show and hide the second box without opening the keyboard; the tax line updates on blur (Safari fires
change on blur); typing "%" on the text keyboard; VoiceOver reads the chips' pressed state.
