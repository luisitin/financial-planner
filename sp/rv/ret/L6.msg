Pay the tax later or now, per row at work: the split, this year's tax, the mix at retirement

What the person sees: tapping a 401(k) or Roth 401(k) row on
Retirement contributions opens its form with "When do you pay the tax
on it?" [Pay the tax later] [Pay the tax now] [Some of each], the rule
of thumb "If you expect a lower tax rate in retirement, later usually
wins; higher, now wins. Not sure? Some of each is a sound choice.
(Brown, Cederburg and O'Doherty, 2017)", and, when it applies, "From
2026, catch-up money above the usual limit must go in as Roth if last
year's pay from this job was over $150,000." Some of each shows a
second box; Dana typing 4% later and 2% now reads "Paying it all later
would lower this year's federal tax by about $190." and Save writes two
rows: $260 a month into Dana's plan at work with the whole $2,400
match, $130 a month into a new $0 "Dana's Roth 401(k) at work" (listed
on Net worth). The notice: "Saved: ... This year's federal tax: about
$200 more than before. Your money when retirement starts (2044): 88%
pay-the-tax-later, 9% already taxed (Roth), 3% regular savings." It
gives no retirement answer for this change; Will the money last?'s
"Before your change" line says the answer leaves out the tax paying
later saves each year. Paycheck shows "Roth 401(k), after tax" from the
rows; Work benefits counts both rows ("on $3,120 put in before tax").
Why: owner's request 2026-11-11 (split Roth and traditional per person
and per account).

Formulas and decisions:
- Spec option C1, two ordinary rows, no schema change:
  contributions/compute.js taxPairOf (the person's pay-the-tax-later
  and Roth 401(k) rows read as one), applyTaxChoice (later / now /
  some; the match only ever on the later row, a $0 later row keeps it
  under "now"; a Roth 401(k) made $0 when none, named so limitKind
  counts it against the 401(k) limit; shares typed kept as pctOfPay),
  catchUpRothWords (50+, pay over BENEFITS rothCatchUpWages, from 2026),
  TAX_RULE_OF_THUMB, ROTH_MATCH_WORDS. An IRA row is never split.
- This year's federal tax: the Federal estimate's compute on copies,
  rounded to $10 (the form: split against all later; the notice: after
  against before). No "which is better" from the engine (D-C3).
- The mix: levers.js mixAtRetirement on the projection's retirement-year
  balances (deferred / free / taxable + cash), largest remainder to 100.
- D-C6 Paycheck: the Roth 401(k) line reads the rows a paycheck when no
  what-if is typed. D-C7 Work benefits: nowYearly, nowPct and nowMatch
  count both rows; each choice keeps the Roth dollars after tax
  (total.rothYearly), and a choice's paycheck replaces both rows.
- The card and the match check read the rows as one job: one match row
  on the row that holds the match; no "No match on file" on a Roth 401(k)
  row beside a later row; a usual match tried goes on the match's row.
- D-C1 to D-C7 copied into contributions/README.md.
- Tests: tests/tax-split.test.mjs (10): total own money kept, match on
  later only, limitKind 401k, now / later, pre-tax drops by the Roth
  part and the tax line equals the Federal estimate's difference,
  Paycheck's line, Work benefits both rows, the mix sums to 100 from
  balances, the catch-up boundaries, the card after a split, and the
  form end to end in the fake DOM (which gains Element.before/after).
- Also: Assumptions' chips read data-v with getAttribute (works in the
  fake DOM as in a browser).

Review round 1 (2026-11-12), kept in this commit because it reads the
left-over row and the tax line the steps before it built:
- "Before your change" on Will the money last? is drawn only after a
  change: the answer's words moved, the headline turned, a number the
  person sets changed, or the tax on money at work moved. A balance
  update or a renamed account draws none; the money left over, while
  not answered, is a result and never "You changed" (levers.js valuesOf
  with a compare value, changedKeys).
- The line says what it is: "If markets do as well as average, before
  your change: runs out at 70. Now: runs out at 74." A headline that
  turned is said first in its own words; while the new one is checked
  against bad years a grey bar holds its place.
- Back from a change made elsewhere, the same sentence is first in the
  card as a green notice, in view, and the changed row is listed first
  with "You just changed this: none → $2,040 a year."
- For one second after "Check the numbers behind this ↓" scrolls the
  card under the finger (and while the page glides, plus 0.4 s) a tap
  on the page is let go, so a double tap follows no link.
- "Read it from a pay stub ›" is left off the 401(k) row until the
  reader reads a Roth 401(k) line apart from the pre-tax one (L7).
- Tests: tests/levers-before.test.mjs; the decisions are in
  projection/README.md, "Review fixes (2026-11-12, round 1)".

view.js touched: modules/retirement/contributions/view.js,
modules/retirement/projection/view.js, modules/career/benefits/view.js,
modules/system/assumptions/view.js

Review round 2 and simple first (2026-11-13), in this commit because
it rewrote the Contributions form and its save for the tax question,
and holds round 1's "Before your change" lines:
- Contributions' landings and match check: nothing of ours is typed
  in (P2), the usual match counted is asked and stays our guess (M5),
  "It matches" is answered in place (P5), a 0 typed where it was asked
  is "no match" (P8), a match saved takes back "no match" (P9), the
  verdict's turn is said first (P6). A refused save is brought into
  view.
- The tax answer: one quiet line "Tax on this money: paid later, the
  usual. Change ›" (P10); Some of each keeps the total (M2); this
  year's tax as a year and a month, state included (M4); the lines
  under the boxes keep their room, so Save does not move (P1); one
  sentence after a save, the tax and the mix in a fold under the rows
  (P3); one job, one pair (B1); a split taken back keeps both parts
  (B2); a match for a Roth 401(k) row goes on a pay-the-tax-later row
  (B5); a Roth 401(k) known by its match is renamed to stay one (N2);
  an empty box is refused, a typed 0 keeps the row (N3); the account
  changed with the answer moves the row or is refused (N5). Account,
  whose and "Remove this contribution" fold under "More options".
- Work benefits: the true reason for Roth money (M8); "Use N%" after
  a split stays within the limit (N1).
- Will the money last?: "Before your change" is one sentence, the rest
  under "What changed" (P12); the spending "Change ›" opens the
  settings in place (N4); taps held only at the spot (N7); the settings'
  save says what it did to the answer (P7); a number not counted yet
  or just changed is never folded; nothing "changed" that reads the
  same (N6).
- Tests: tests/tax-split.test.mjs, tests/levers-review2.test.mjs,
  tests/levers-before.test.mjs, the contributions and benefits module
  tests.

The final review (2026-11-13): no "null" under the tax answers (F1;
the test fake DOM now writes a null as the word, as a browser does,
and its text reader refuses it); "Use 31.4%" on Work benefits lands on
the limit, not 4 cents over: the payments go down to the cent (the
limit check itself stays exact, as the answer key says) (F2); a save
on a row with a pay-the-tax-now partner that keeps the tax answer says
what changed and what it did to the retirement answer: "Saved: Jamie's
employer adds $2,040 a year (on the pay-the-tax-later row). Your
retirement answer: now runs out at 75 (was 71)." (F5); Retirement
settings' notice names the settings it changed under "More settings"
(F3). Tests: tests/tax-split.test.mjs "F1", "F2", "F5" and N1
tightened; tests/levers-before.test.mjs P7.

Agent: claude-b
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS

