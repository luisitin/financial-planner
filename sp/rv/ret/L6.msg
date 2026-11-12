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

view.js touched: modules/retirement/contributions/view.js,
modules/retirement/projection/view.js, modules/career/benefits/view.js,
modules/system/assumptions/view.js

Agent: claude-b
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS
