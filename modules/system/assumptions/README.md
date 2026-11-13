# Assumptions  (`system/assumptions`)

**Status:** usable (phase 2)
**Purpose:** Lets you edit every global assumption, see where each default came from and stamp it as reviewed.

## Inputs
Plan sections read (`needs`): `assumptions`. `compute(plan, { today })`: `today` for days since the review.

## Outputs
`rows[]` (`key`, `label`, `kind`, `def`, `value`, `changed`, `source`), `reviewedAt`, `daysSinceReview`, `stale`, `changedCount`, `realStocks`, `realBonds`, `realCash`, `warnings[]`.

## The ten assumptions and their sources
| key | default | source (also shown on screen) |
|---|---|---|
| inflation | 3% | BLS CPI-U long-run average about 3%; Fed target 2% |
| returnStocks | 7% | long-run US large-cap about 10% nominal (Damodaran 1928-, Shiller 1871-); 7% is a common conservative planning figure |
| returnBonds | 4% | 10-year Treasuries about 4.5-5% long run (Damodaran); bond funds 4-5% mid-2020s |
| returnCash | 2% | savings/MMF 4-5% in 2023-2025, near 0 in 2010-2021; long run about inflation |
| stdevStocks | 15% | yearly stdev of US stocks about 15-20% (Damodaran) |
| stdevBonds | 5% | 10-year Treasuries about 5-8% |
| salaryGrowth | 3% | BLS employment cost index roughly 3-4% in the 2010s-2020s |
| retirementAge | 65 | Medicare at 65; full Social Security age 67 for 1960+ births |
| planEndAge | 95 | SSA life tables: about 1 in 5 65-year-olds live past 90 |
| emergencyMonths | 6 | common advice 3-6 months of essential expenses |

The reference data behind Damodaran and Shiller is vendored (see `docs/RESOURCES.md`); the phase 5 historical pages will compute from it directly.

## Formulas
- Real return = (1 + nominal) / (1 + inflation) - 1 (`core/math/finance.js` `realRate`).
- Stale = never reviewed, or reviewed more than 365 days before `today`.
- Warnings: stocks below bonds; stocks more than 8 points above inflation; retirement age at or past the plan end age.

## Edge cases
Missing keys fall back to defaults (older plans). Reset keeps the review date. Percent fields are typed as whole numbers (7) and stored as fractions (0.07) by `ui.form`.

## Tests
`module.test.mjs`: defaults, real returns, changed count and fallback, review staleness, warnings.

## Ideas / not yet
- Per-scenario assumptions (phase 9) instead of one global set.
- A "what my advisor used" column filled by `ai/reader` from the advisor's plan (phase 8).

## Open at one box (2026-11-11)
`#/system/assumptions?show=<key>` (for example `emergencyMonths`) brings that box to the middle of the screen and outlines it
for two seconds, once per arrival. The link on the Emergency fund page is not in this lane (stress test p-balance/x-2).

## Careful, middle and hopeful (2026-11-11, owner's request; spec rv/spec.md L5; tests `module.test.mjs` "L5 ...", `tests/levers.test.mjs` "L5 said = done")
The owner asked to see what drives the retirement answer, inflation and returns among it, with the effect of a change. A
higher return must not read as a fix (spec risk 1: the app's 7% already sits at or above most 10-year forecasts).
- **Chips above the stock box:** Careful 6%, Middle 7% (ours), Hopeful 8%; **above the inflation box:** 2.5%, 3% (ours), 4%.
  Outlined `chips`; the one the box holds is marked (`.on`, `aria-pressed`). A tap fills the box only; nothing is saved until
  the page's one filled button, "Save and mark as reviewed" (design log 2026-09-15, round 17, kept). The label is tied to its
  box by `id`/`for`, so the chips sit between the label and the box without becoming the label's control.
- **One line under the stock chips:** "Forecasts for the next 10 years or so differ: 4.8%-6.8% a year for U.S. stocks (Vanguard,
  as of 2026-09-30); 7.5% (J.P. Morgan, October 2026)." Built from one constant, `FORECASTS` (each figure with its date, the
  edition, and `readOn`, the day the pages were last opened), so the next edition is one edit. Review 2026-11-12, M6: the line
  said "Most forecasts ... 6.7% (J.P. Morgan 2026)" three weeks after J.P. Morgan's 2027 edition put U.S. large companies at
  7.5%, above the plan's middle 7%; "most forecasts" was no longer true, so the line now says they differ. 7.5% is under the
  Hopeful 8%, so "higher than any forecast we know" above 8% still holds, and the chips stay. Each chip's reason is in the fold
  "Where these numbers come from".
- **Above 8% (`HOPEFUL_MAX`, the Hopeful preset):** an amber line under the stock box as it is typed and after a save, "Higher than
  any forecast we know; plan on it only if you have a reason."; `compute` returns `hopeful: true` and the warning "Stocks are set to
  grow 9% a year. Higher than any forecast we know; ..." (one line: history's "beating prices by more than 8% a year is
  optimistic" is added to it when that is also true, instead of a second amber line). Needs attention reads `warnings` as before.
  Will the money last? shows the amber tag **"on your hopeful return"** under its headline, with "Check it ›" to this box.
- **The effect after Save:** a save that changes a figure keeps the retirement answer before it (`retirement/levers.js`
  `answerOf`: one projection at average markets, the verdict Will the money last? shows) and the notice says "Saved and marked as
  reviewed. Your retirement answer: now runs out at 69 (was 70)." (`answerChangeWords`, the words Contributions uses). That notice
  stays; a plain one goes after 4 seconds. Right after a save the separate "Reviewed on ..." notice is left out, so the shell's
  echo at the foot of the screen repeats the save's own notice (it repeats the first new green one).
- **Said = done:** the page's Save is `saveAssumptions(draft, values, today)` in `compute.js`; the test saves each chip's figure
  with every other figure as the page shows it and compares the answer with Will the money last?'s growth and prices rows
  (Jamie: careful 6% runs out at 69, as it is 70, hopeful 8% 71; walked on the phone: 69, and 9% typed: 72).

**Sources (opened 2026-11-11, verify-web.md):**
- Vanguard, VCMM 10-year return forecasts as of 2026-09-30 (page of 2026-10-21): U.S. equities 4.8%-6.8%
  (corporate.vanguard.com, "vemo-return-forecasts").
- J.P. Morgan Asset Management, press release "J.P. Morgan releases 2027 Long-Term Capital Market Assumptions" (2026-10-19,
  am.jpmorgan.com; opened 2026-11-12 by the money critic and again 2026-11-13): U.S. large cap equities 7.5% over 10 to 15 years,
  "increasing from 6.7%" (the 2026 edition, release of 2025-10-20); a 60/40 portfolio 7.0%.
- FP Canada and IQPF, Projection Assumption Guidelines (in force 2026-04-30): equities 6.4% and inflation 2.1%, with a 0.5% safety
  margin already taken off (deliberately careful), and "not prudent to increase return assumptions to 'force' a projection".
- Damodaran, historical returns table (updated 2026-01-05): U.S. large stocks roughly 10% a year since 1928.
- Bureau of Labor Statistics, CPI-U: about 3% a year over the last century; 7.0%, 6.5% and 3.4% in 2021, 2022 and 2023.
- Not cited on screen (not opened by the verifier): the Social Security Trustees' 2.4% inflation figure.

**Decisions.** The default stays 7% (it would move every answer and the golden keys, and it is the owner's standing choice). A
hopeful return never turning an answer green on every page waits for L10 (after claude-c's left2).

## One number at a time (2026-11-13; review 2026-11-12, P4; simple first, owner 2026-11-12; test `module.test.mjs` "P4 ...")
A link that names one number (`?show=returnStocks` from Will the money last?'s growth row "Check ›", `?show=inflation`, and the
other pages' `?show=` links) opens that number alone: its chips, its box, its line, and the page's one filled button right under
it, "Save". The other nine are one quiet tap away under "All the numbers" ("9 more", or "9 more, 2 changed" when some are not the
usual figure); opened, they are all in the same form and Save becomes "Save and mark as reviewed". Saving with the fold closed
saves the figures and leaves the review date alone (the other nine were not looked over; DESIGN_LOG 2026-09-15 "saving is
reviewing" holds when they were). Before, a tapped chip looked applied, nothing said it was not saved, Save was a screen and a
half down, and Back lost it without a word. A box in the closed fold that the browser will not take opens it.

## Simple by default from the menu too (the final review, 2026-11-13: F6, F3; tests `module.test.mjs` "P4 ...", "F3 ...")
- **Two numbers first (F6).** Opened plainly (from the menu, Your plan's "Change them ›" and the other plain links), the page
  shows the two the owner named, how fast prices rise and how fast stocks grow, each with its chips and line, and one filled
  "Save" right under them; the other eight are under the same fold as a `?show=` link's, "All the numbers · 8 more". Opening it
  changes nothing but what Save says: "Save and mark as reviewed", round 17's single filled button, saving being reviewing when
  all ten are in view. The not-reviewed notice says where the rest are ("They are under "All the numbers"; saving with that open
  marks them as reviewed"), and so does the year-old one. Before, ten boxes and their chips made a page 2,468 px tall with one
  box on the first screen; "its job is to look them all over" stays one tap away. (Owner, 2026-11-13: "it should stay simple by
  default"; DESIGN_LOG 2026-11-12 names Assumptions among the pages that follow it. Round 17's plain lines, sources fold, review
  notice and one filled button are kept.)
- **A change under the closed fold is said (F3).** The fold's line counts the boxes under it that differ from what the page drew
  ("9 more, 1 to save"), recounted as a box is typed in or a chip tapped, and back to "9 more" when the figure is put back. The
  line under Save follows: "Save keeps this number and what you changed under "All the numbers"." (or "these two numbers"); with
  the fold open, round 17's line. The notice after a save names every figure that moved: "Saved: prices rising 3% → 4%. Your
  retirement answer: now runs out at 68 (was 70)." (It said "Saved." while the box on screen still read 7.)

## Plain words (spec 13.1, C10, 2026-11-13)
Words only: the keys, defaults, limits and saved values are as before.
- The lede: "What the plan assumes about prices and markets. The defaults are middle-of-the-road; change any that your advisor
  set differently." It said "Ten numbers drive every projection: how fast prices rise, how much investments grow, when you
  retire, how long the money must last." The two numbers on the first screen are prices and markets; the other eight stay
  under "All the numbers", as before.
- The swing: "How bumpy stocks are, in a typical year" and "How bumpy bonds are, in a typical year" (was "How much stocks swing
  (a typical year)"); the save notice says "how bumpy stocks are 15% → 18%". The sources in the fold are untouched (design log
  2026-09-15, round 17: "compute.js sources are untouched and shown in the fold").
- Left for their own lanes: Needs attention's "Look over the assumptions" alert still says "Ten numbers drive every
  projection" (overview/alerts/compute.js, held by another run; the spec's "Look over what the plan assumes"), and Our
  guesses' coverage list and System > Audit say "how much stocks swing" (overview/guesses/coverage.js, system/audit).
Test: `module.test.mjs` ("C10 plain words").


## Health costs that rise faster than prices (2026-11-13, gap design #10; tests `module.test.mjs` "#10 ...", `tests/health-growth-invariance.test.mjs`)
One quiet row after the numbers, "Health costs rise · with prices". Opened, it holds one choice (`choice()`): **With prices**
(the default, and what every plan did before), **1 point faster**, **2 points faster**, or **Type my own** (the box says "0 to
10"; a figure outside it is held at the box with "Use a number from 0% to 10%." and nothing is saved). A typed rate above 5
points (`HEALTH_GROWTH_HIGH`) is kept, and the open row says in amber that it is far above what the actuaries expect and is a
bad case to try, not a plan (`healthHighWords`; on the invented family 10 points turns about $324,000 of health insurance
after work into about $27.6 million). A chip saves at once; the green line names what it did to the retirement answer ("Saved: health costs now rise 1 point a year
faster than prices. Your retirement answer: lasts to the end, with about $288,000 less left at 95 (today's dollars)."), and the
row stays open on that draw. "Reset to defaults" takes the choice away with the rest. It is not one of the ten numbers: it
does not count in "Changed from defaults", is not part of the form's Save, and choosing it does not mark the ten as reviewed.

- **Field.** `assumptions.healthGrowth?`: a fraction above prices (0.01 = one point). Absent = with prices. "With prices"
  removes the field, so the plan is byte for byte what it was. Read only through `healthGrowthOf(plan)` (compute.js): absent,
  blank, zero, negative or not a number is 0; only a number or a number typed as text counts (`true`, a list or an object is
  0, never 1); anything above 0.10 is held to 0.10 (`HEALTH_GROWTH_MAX`). `saveHealthGrowth` reads a figure the same way.
- **Formula.** A health cost in year t, in today's dollars = cost today x (1 + h)^(t - this year) (`healthFactor(h, year,
  nowYear)`; exactly 1 for h = 0, this year and earlier years). Example: a $500 premium, one point faster, ten years on:
  500 x 1.01^10 = $552.31.
- **Where it applies** (each page's README has its own section):
  - Before Medicare (`retirement/healthcare`): the marketplace benchmark premium, before the credit. The credit is then
    worked out on the grown premium, so in a year with a credit the credit takes up the rise.
  - Medicare at 65 (`retirement/medicare`): Part B, the drug plan and the supplement, with the income surcharges (they are set
    as shares of the premiums' cost). The income lines for the surcharge are not changed.
  - Will the money last? (`retirement/projection`, the health line): it adds those two pages' years, so it grows with them;
    a premium at work that is put back while someone still works grows the same way.
- **Where it does not apply** (decisions): a health or Medicare line the household typed on Expenses stays as typed (it is
  their own figure, and the plan carries it as spending); the Part B deductible and what is paid at the pharmacy are not in
  the plan at all ("Not counted" on Medicare at 65), so the spec's "out-of-pocket costs" has nothing to grow yet; Insurance >
  Health, long-term care and the health savings account pages keep their own figures.
- **What the row says about this plan** (`health.js`, `healthEffect` / `healthEffectWords`; one written sentence per case,
  each with a test): not yet (the plan cannot work out a retirement); with prices ("On your plan, health insurance after you
  stop work comes to about $324,000 in all, in today's dollars."); faster (the same with "Rising with prices it would be
  about ..."); the spending figure already includes health insurance; the plan adds no health line of its own ("Your plan
  does not add health insurance of its own right now (a plan at work or a line on Expenses covers it), so this only changes
  the pages Before Medicare and Medicare at 65."). No sentence starts with a page's title. The totals
  are the projection's own health line (`buildInputs().health.total`), rounded to $1,000.
- **The source, and what it is not.** The chips are choices, not facts. The one published figure beside them: CMS Office of
  the Actuary, *National Health Expenditure Projections, 2025-34* (Health Affairs, July 2026 issue, online June 2026): national
  health spending grows 5.4% a year on average over 2025-34 against 4.1% for the economy, and goes from 18.0% of the economy
  in 2024 to 20.6% in 2034. The row says "about 1.3 points a year faster than the economy": the published pair's difference,
  5.4 - 4.1 (`HEALTH_SOURCE.gap`, tested). The two shares give much the same, (20.6 / 18.0)^(1/10) - 1 = 1.36%, and the
  sources part quotes them beside the pair. **Read 2026-11-13 and again 2026-11-14** through search results: the paper's own
  projection table (5.4%; the shares 18.0%, 18.4%, 18.7% ... 20.6%; the economy's dollars for 2025 and 2034, which work out
  to about 4.0% a year, in line with the 4.1% average) and reports on it that state the 4.1%. cms.gov and healthaffairs.org
  could not be opened in full from the build machine, so re-read the paper itself when they can be. The same reports give
  Medicare 7.7% a year, which includes more people joining, so it is not shown as a premium figure. The figure is the whole
  country's spending (more people, more care) against the economy, not one household's premiums against prices; the row and
  the sources part say so in plain words ("this is your choice, not a forecast").
- **Nothing changes until it is chosen.** `tests/health-growth-invariance.test.mjs`: no invented plan has the field and
  migrate adds none; the four readers give byte-identical output with it absent, 0, null or blank over every fixture plan,
  household and phone-built plan; every module that can reach a reader gives the same output on the four fixture plans. At
  build, every module's `compute()` (166) was also run over all 33 invented plans on the tree before this change and on this
  one: 5,511 outputs, all identical once the wall-clock `savedAt` of three System pages is set aside.
- **The page's parts.** The new row and "Where these numbers come from" (the owner's title, pinned; same words, last on the
  page, shut) are drawn by `core/ui/more.js`. "All the numbers" stays the form's own hand-written line: opening it is what
  turns Save into "Save and mark as reviewed" (owner, round 17 and the review of 2026-11-13), which neither a part nor the
  form kit's "More details (optional)" line may do (a Save that depends on an open line is the first-view check's S9), and
  its title is the owner's. So the first-view counts file records that one fold for this page (`"checks": {"S10": 4}`, once
  per invented household; the fold itself is not new). "Health costs rise" is a pinned title in `qa/first-view-lib.mjs`.
  Test "S11": after a chip only that row is open; the form's Save opens no part. The design said to put the
  choice under "Set my own numbers"; this page has no such part (the whole page is the household's own numbers), so the row
  carries the choice's own name, which reads as a sentence with its status: "Health costs rise · 1 point faster".
