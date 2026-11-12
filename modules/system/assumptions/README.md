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

