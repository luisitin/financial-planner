# Year by year  (`retirement/cash-flow`)

**Status:** usable (phase 5)
**Purpose:** Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left.

## Inputs
Everything the projection uses (through `retirement/projection` compute). `compute(plan, { today, real = true })`.

## Outputs
`rows[]` per year: `in` (contributions, income, lines), `out` (spending, taxes), `from` (cash, taxable, deferred, free), `rmd`, `end` buckets and total, `shortfall`; `totals`, `retireYear`, `people`, `verdict`, `shortYear`. Real (today's dollars) by default: nominal values divided by that year's price level.

## Tests
`tests/retirement-pages.test.mjs`: real vs nominal, totals. `module.test.mjs`: the key, moves, "Change this year" (below).
`tests/year-change-invariance.test.mjs`: nothing changed, nothing moves.

## Ideas / not yet
- Export the table to CSV (Reports phase); columns for each income line.

## Independent answer key

`tests/golden/retirement/cash-flow.csv` has 1,000 invented cases across ten rules, replayed
by `tests/golden-retirement.test.mjs`. Its brief is `tests/golden/retirement/briefs/cash-flow.md`.
Nominal ledgers are independently reconciled; every real amount is divided by cumulative
price level. The key includes nonzero contributions, income lines, all four withdrawal
buckets, taxes and required withdrawals. The source for the latter is IRS Publication590-B,
TableIII (age74 factor25.5, age75 factor24.6): https://www.irs.gov/publications/p590b .
The projection README supplies annual timing and flat-tax assumptions, not a tax-law claim.
Expected money is rounded only when writing cents. Every tenth case has another derivation;
the lead separately audits2%. Exact cent inputs are used before deriving the answer;
the covered ledger cases agree with the code within the requested half-cent tolerance.

## Health insurance (2026-11-02)
`out.spending` is all of the year's spending: the plan's spending and its health insurance (the projection's "Health insurance" line, marketplace to 65 then Medicare, the engine's `eventSpending`); `out.health` is that part, and each year's record says it ("$89,805 spent ($5,805 health insurance)"). Buckets reads it, so the years it sets aside include cover.

Review 2026-11-06 (round 7): each year's income lines (named by the projection) say "your Social Security" and "your spouse's Social Security" for the unnamed first adult ("Me") and "My spouse", never "Me's Social Security"; this page says you/your for the unnamed first adult. Test: "Review 2026-11-06 (round 7): the year's income lines say 'your Social Security' ...".

## Stress test 2026-11-11 (claude-e, wave 2)
- Each phone row's bold figure says "left" ("$450,880 left"), and the one-line key is above the list (RB4).

## Change this year (2026-11-16, gap list next 60, item 32; map A10; builder claude-b)

**What a person gets.** Tap a year's row (the whole record is one button, 44 px at least; on a wider screen the year in the
table's first column; each phone record ends in a quiet chevron, and the ledger's first line says "Tap a year to change
it.") and, under it, on a lightly tinted row, "Change this year:" offers four quiet chips: **Spend more**, **Spend less**, **Money
coming in once**, **A big cost once**. A chip opens a short form titled with the year ("In 2060: spend more"): one box for
spending ("How much more a month", "in today's dollars, for each month of 2060. For example, $500."), or "What it is" and
"How much" for money in or out. The chosen chip is outlined in the accent and tinted (not filled: Save is the screen's one
filled button); Cancel and Close are outlined. Close (while no form is open) and Cancel (in a form) both shut the year.
After Save the row shows its new figures, a small "changed" mark and the change in one line ("changed · Spending goes up $500
a month in 2060"), and the green line under it names the new answer with an outlined Undo, without saying the change a second
time: for the invented Ana and Bo, "Saved. Your retirement answer: lasts to the end, with about $12,000 less left at 95
(today's dollars)." Tapping a changed row lists its changes, each with an outlined Remove ("Removed: <the change>. ..." with
Undo; Undo says "Put back. ..."); Undo after a save says "Undone: <the change>. ...". On a wider screen the table shows the
mark beside the year and one line under it, "Your changes: ...".

**First view: nothing new.** The key above the list became "Left: savings at year end." and the ledger's first line "Tap a year
to change it." (11 words together, as many as "Left: every retirement account together at the end of that year."; the
chevrons are CSS, no words): qa/first-view-node.mjs reads 913 words, 212
figures, 2 boxes, 0 filled buttons, 0 parts for the worst household (Ana and Bo) before and after; the records read word for
word as before (`tests/year-change-invariance.test.mjs`). The row button has no fill (the page's own scoped `<style>` under
`.cf-root`; no global CSS).

**One path.** Each change is a thing that will happen (`retirement.happenings`, modules/retirement/happenings.js), one year
long, made and removed by the very functions Will the money last? uses (`clean`, `saveHappening`, `removeHappening`,
`nextId`, `check`, `lineWords`), so that page lists it under "Things that will happen" (where it can be edited) and every page
that starts from the projection's `buildInputs` counts it the same way. No new kind, no new engine path, no new plan field.

| chip | saved as (`yearChange`) |
|---|---|
| Spend more, m a month | `{ id, kind: "spend", year: Y, untilYear: Y, monthly: m }` |
| Spend less, m a month | `{ id, kind: "spend", year: Y, untilYear: Y, monthly: -m }` |
| Money coming in once, A | `{ id, kind: "in", year: Y, name?, amount: A }` |
| A big cost once, A | `{ id, kind: "out", year: Y, name?, amount: A }` |

**Formulas** (the engine's own, as the projection README's "Things that will happen" gives them; all amounts the person's, in
today's dollars; p_Y is the price level of year Y, the plan's inflation compounded from this year):
- spend more or less by m a month in a retired year Y: spending in Y = max($1, S0 + 12 x m) x p_Y, and S0 x p_Y again from
  Y + 1 (`spendingFactors`: (S0 + 12m)/S0 at Y and S0/(S0 + 12m) at Y + 1, which multiply to 1); S0 is `spending.yearly` less
  the loan payments it holds. The difference comes out of (or stays in) savings in the withdrawal order, with its tax.
  Ana and Bo, $500 a month more in 2060: $94,461 to $100,461 spent that year, $94,461 again in 2061.
- money coming in once, A in year Y: A x p_Y into regular (taxable) savings at the start of Y.
- a big cost once, A in year Y: A x p_Y out of savings on top of the year's spending, in the withdrawal order, with the tax
  that withdrawal brings (Ana and Bo, a $40,000 roof in 2060: $32,778 to $79,837 from savings that year, $4,917 to $11,976 of
  tax, about $80,000 less left at 95).
No current figure (a rate, a limit, a price) is introduced, so nothing here needs a source: every amount is the person's.

**What each row offers (`yearOffers`).** Spend more and Spend less only in a year the household is retired and with a way of
taking money out that spends the plan's figure (the same spending every year, or trim after bad years): the engine changes
spending only then (core/math/retirement.js step 3, `spendingChanges`), and a line that changed nothing would mislead. Other
rows offer the two money chips with one line saying why: "Before you retire this plan only follows your savings, so you can
add or take out a one-time amount for this year." or "Your way of taking money out sets each year's spending (How much to take
out), so only money in or out once can change this year." Before retirement the cost's box is "How much comes out of savings",
"in today's dollars (your pay is not counted before you retire)", as Will the money last? notes for such a cost. Money in says
"after any tax, in today's dollars. It goes into savings at the start of the year." (so the row's In column stays as it was
and what is left at year end rises by the amount and a year's growth).

**How far Spend less goes (`spendIn`, `lessRoom`).** A cut is a level change on S0 (happenings.js `spendingFactors`), which
keeps the yearly level at SPEND_FLOOR ($1) or more; a cut past it would be floored while the saved line said the whole
amount. So the box's most is lessRoom(Y) = floor((L(Y) - $1) / 12) a month, whole dollars, where L(Y) is S0 times the plan's
own spending factors up to Y (every thing that will happen counted, from happenings.js `apply()`, so a cut already in force
on Will the money last? is counted first). The kit refuses more with its own words ("Use $6,999 or less."). Ana and Bo:
L(2060) = $84,000 ($94,461 spent less $10,461 of health insurance), so at most $6,999 a month; with $2,000 a month less over
2058 to 2062 already, $4,999. A year whose spending is already at the floor offers no Spend less. A cut made elsewhere that
reaches the floor says so on the row: "... (more than that year's spending, so spending is taken to $0)".

**"changed" or "not counted" (`yearMarks`).** A row says "changed" only for a change the engine counts. One it skips says
"not counted" (the warning pill) and why, one sentence per case:
- refused by happenings.js `check()` (only from a plan typed by hand or imported: an amount under $0, not a number, $0, more
  than the plan can hold, a year outside the plan): `check()`'s own words, as Will the money last? shows them;
- a change in spending in a year before retirement (the engine counts no spending then, `year < retireYear`): "The plan does
  not count spending before you retire.";
- a change in spending with a way of taking money out that sets its own spending: "This is not used with your way of taking
  money out (How much to take out)." (happenings.js `noteWords`' words).
The last two can follow a change of retirement age or of the way after the line was saved. On the table's line:
"... (not counted: <why>)".

**Changes in years with no row.** With Years "from retirement on", a change before retirement has no row; neither does one in
the folded "nothing left" years. Both are still counted, so the ledger says them in one line: "Your changes in years not listed
here: A new roof in 2040: $40,000 out of savings." with "Choose every year under Years to see it." (or "them") when the
filter hides them.

**One line, one id.** Save takes its id from the plan as it is written (`nextId` of the store's draft), so a second tab's new
line is never written over; Remove takes out that one line only (`removeYearChange`: the line itself, else the first with its
id), so two lines sharing an id in a plan typed by hand do not both go.

**Which changes a row shows (`isYearChange`, `yearChanges`).** Money in or out once, and a spending change whose first and
last year are the same, whichever page made it. A change over several years, a home sale, working less, work after
retiring and money moved between accounts stay Will the money last?'s (a move is already said on its year's row).

**Compute API** (`compute()` and its output are untouched, byte for byte: three other invariance tests digest it):
`YEAR_KINDS`, `yearOffers(row, strategy)`, `yearChange(kind, year, { id, amount, name })`, `isYearChange(h)`,
`yearChanges(plan)`, `yearFacts(plan, { today })` (the projection's `buildInputs` without the plan's things that will happen,
then happenings.js `apply()`: first and last year, people, way, the year retirement starts, the accounts, and the spending a
change moves; what `check()` is given, the same as on Will the money last?; worked out only while the plan holds a change of
one year or a row is open), `spendIn(facts, year)`, `lessRoom(facts, year)`, `NOT_COUNTED`, `yearMarks(plan, facts)`,
`removeYearChange(draft, h)`.
View exports for tests: `CHIP`, `BEFORE_WORDS`, `WAY_WORDS`, `TAP_WORDS`, `doneWords(what, said, answer, { onRow })`,
`markSaid(mark, opts)`, `marksSaid(list, opts)`, `hiddenSaid(text, { byFilter, many })`.

**Builder's choices.**
- Spending is asked a month, as on Will the money last? and Expenses, so the line reads the same on both pages; the help says
  "for each month of 2060".
- After Save or Remove the row's panel shuts and the green line stands under the row (the saved change is on the row itself);
  when the year has no row any more (the money now runs out before it), the line goes at the top of the ledger card.
- Remove has the kit's Undo and no dialog, as Remove under "Things that will happen" (the same path); Save has Undo too.
- One row is open at a time; a second tap shuts it; opening or shutting writes nothing; a new visit starts with every row
  shut (the row's state is the page's, never the plan's).
- On a wider screen (720 px and up, base.css `.only-wide`) the panel and the green line go under the table's row instead;
  which one is decided when the page draws (turning a tablet across 720 px while a row is open shuts it from view until the
  next tap).
- Years after the money is gone stay one row ("2068 to 2097: nothing left", design log 2026-09-16): a change in one of those
  years is made on Will the money last?, where the year is typed, and said in the "years not listed here" line.
- Fixes after the two critics (2026-11-16): marks only for what the engine counts (F1); Spend less capped at the year's
  spending (F2); one id per save, one line per Remove (F3); money in says where it goes (F4); the hidden-years line (F5); the
  chosen chip outlined (P1); the tap line first, chevrons, the open row tinted (P2); plainer words before retirement (P3);
  Close, and Cancel shuts the year (P4); the green line does not repeat the row (P5); an example in the help, never grey in
  the box, since grey means our guess (P6).

**Tests** (`module.test.mjs`, "change this year: ..."): each chip's record; one-year changes only; the offers per year and
way; `yearFacts` against `buildInputs`; the figures move as the formulas say (+$6,000 in 2060 only; a cost comes out of
savings with its tax; money in is there at the year's end; the years before are untouched); the walk through the page (tap,
chip, Save, mark, green line, Undo); each of the four chips saved with ids after the plan's; the same change typed on Will the
money last?'s own form gives the same record, plan, answer, years and projection; Remove and Undo put the same line back in
its place; the two notes; a refused amount writes nothing (happenings.js `check()` words); opening and shutting write
nothing; every sentence of the green line and the mark; "critic F1" to "critic P2 and P4": not counted marks against
apply()'s skipped lines, the cap and the floor, one id and one line, the hidden-years line, Close and the styles. `tests/year-change-invariance.test.mjs`: with nothing changed, Year by
year in both units, the projection, the answer and the page's hero and records over 44 invented plans are byte for byte what
they were at dca545e.
