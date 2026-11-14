# How we work out the answers  (`system/methods`)

**Status:** usable (phase 10; gap design #28)
**Purpose:** How each kind of answer is worked out, in plain words, with its sources and the day each was read.

A layperson who wonders "where does this number come from?" gets one page that answers it for the whole app, without
opening a builder document. It is linked from Help (under "How are the numbers worked out?") and from the last line of
every "How this is worked out" part ("All our methods and sources ›", drawn by `core/ui/more.js`).

## Inputs
Plan sections read (`needs`): none. Writes: none. The page is the same for every household.
`data/methods.js`: the hand-written list `METHODS`, one entry per topic:
`{ id, topic, status, says: [sentence, ...], sources: [{ name, url?, read, readme, cited }], pages: ["group/id", ...] }`.

## Outputs
`compute()` -> `{ intro, promise, topics: [{ id, topic, status, says[], sources: [{ name, url | null, read, readWords }], pages[] }], sourceCount, newest }`.
`sourceCount` is the number of different sources; `newest` the latest read date. A source without a read date would be
left out (there is none: a test refuses one).

## Formulas
There is no money math on this page. The only rules:
- `dayWords("2026-11-13")` = "November 13, 2026" (month name, day without a leading zero, year); anything that is not
  a real `YYYY-MM-DD` gives "".
- `readWords(iso)` = "Read " + `dayWords(iso)`; `sourcesWords(n)` = "1 source" / "N sources".

## Sources: nothing new is claimed here
Every source on the page is one a module README already cites, with the read date that README gives. Nothing was
looked up or re-verified for this page. `readme` names the README and `cited` the words (or the address) it uses; the
module test opens that README and finds the citation with the date beside it, and the address when one is given.

| topic | source (as the page names it) | read | cited in the README of |
|---|---|---|---|
| Retirement, Investments | Yearly returns of stocks, bonds and cash, 1928 to 2025 (Aswath Damodaran, NYU Stern) | 2026-11-13 | `overview/quick` |
| Retirement | The IRS's table for the withdrawals the law requires, by age (Publication 590-B, Table III) | 2026-10-26 | `retirement/rmd` |
| Retirement | Social Security's yearly limits on pay while you collect | 2026-10-31 | `retirement/social-security` |
| Taxes | The IRS's tax tables and amounts for 2026 (Revenue Procedure 2025-32) | 2026-11-06 | `taxes/federal` |
| Taxes | The tax law passed in 2025 (Public Law 119-21) | 2026-11-02 | `taxes/federal` |
| Debt | The government consumer bureau's worksheet for how much of your income goes to debt (Consumer Financial Protection Bureau) | 2026-11-06 | `debt/ratios` |
| Debt | Fannie Mae's rules for lenders on how much of your income may go to debt (Selling Guide B3-6-02) | 2026-11-06 | `debt/ratios` |
| Debt | The federal law on when mortgage insurance ends (Homeowners Protection Act of 1998) | 2026-11-07 | `debt/mortgage` |
| Debt | The rule for the minimum payment warning on a card statement (Consumer Financial Protection Bureau) | 2026-11-06 | `debt/credit-cards` |
| Cash and budget | The IRS's rates for Social Security and Medicare tax (Topic no. 751) | 2026-10-31 | `cashflow/paycheck` |
| Cash and budget | The IRS's worksheet for what an employer holds back for income tax (Publication 15-T, 2026) [no address in the README: no link] | 2026-10-30 | `cashflow/paycheck` |
| Investments | Vanguard's 10-year return forecasts, as of September 30, 2026 [no address in the README: no link] | 2026-11-11 | `system/assumptions` |
| Investments | The rule on telling savers what a plan at work charges (U.S. Department of Labor, 29 CFR 2550.404a-5) | 2026-11-13 | `investments/fees` |
| Investments | The IRS's limits on how much you may put in for 2026 (Notice 2025-67) | 2026-11-06 | `retirement/contributions` |
| Insurance | The most Social Security pays one family on one person's record (Social Security Administration) | 2026-10-31 | `insurance/life-needs` |
| Insurance | A national survey of what care costs (CareScout / Genworth Cost of Care Survey 2025) [no address in the README: no link] | 2026-10-31 | `insurance/ltc` |
| Insurance | The IRS's 2026 rules for health plans that allow a health savings account (Revenue Procedure 2025-19) [no address in the README: no link] | 2026-10-31 | `insurance/health` |
| Our guesses | What Social Security pays on average, by age (Annual Statistical Supplement 2026, Table 5.B9) | 2026-11-07 | `overview/guesses` |
| Our guesses | What households own and owe (Federal Reserve Board, Survey of Consumer Finances 2025) | 2026-11-11 | `overview/guesses` |
| Our guesses | What people are paid, by state (U.S. Census Bureau, American Community Survey 2025) [no address in the README: no link] | 2026-11-02 | `overview/guesses` |
| Our guesses | What health coverage through work costs (KFF Employer Health Benefits Survey 2026) [no address in the README: no link] | 2026-11-02 | `overview/guesses` |

To add or change a source: cite it in the page's own README first, with its read date; then add it to
`data/methods.js`. When a README's read date moves, move it here too (the test fails until both agree).

## First view and parts
Simple first (`docs/OPTIONAL.md`). The first view (90 words): the heading, one sentence (`INTRO`), one small line
(`PROMISE`), the card "Pick a topic" with seven shut rows, and "More on this". No box, no button, no figure of the plan.

| part | kind and title | holds | status |
|---|---|---|---|
| `retirement` | item, "Retirement" | the method, 3 sources, 6 pages | "history since 1928" |
| `taxes` | item, "Taxes" | the method, 2 sources, 5 pages | "IRS tables for 2026" |
| `debt` | item, "Debt" | the method, 4 sources, 4 pages | "lenders' own rules" |
| `cash` | item, "Cash and budget" | the method, 2 sources, 5 pages | "your own numbers" |
| `investments` | item, "Investments" | the method, 4 sources, 6 pages | "history, forecasts" |
| `insurance` | item, "Insurance" | the method, 3 sources, 5 pages | "published costs" |
| `guesses` | item, "Our guesses" | the method, 4 sources, 2 pages | "public surveys" |

Each row opens where it is to: two or three short paragraphs; "Where the figures come from" (each source's name, a
link when the README gives a full address, and under it "Read November 13, 2026", followed by "Opens in a new tab."
when it is a link); "Pages that
use it" (a chip per page, by the page's own title, only pages this household is offered: built, switched on, shown).
Rows are kind `item`, so their open or shut is kept for the visit only and no switch opens them.

"More on this": "Which figures are guesses?" (Our guesses for you), "What does the plan assume?" (Assumptions), "What
does a word mean?" (Glossary); each only while that page is offered.

The line in the helper: `part()` appends "All our methods and sources ›" (a link to `#/system/methods`, 44 px tall) as
the last line of every part of kind `how`, when the body is built, and only when `ctx.modules` holds this page built,
switched on and shown. A drawing without `ctx.modules` (most module tests) is unchanged.

Help: the question "How are the numbers worked out?" has one chip under its answer, "How we work out the answers",
drawn only while this page is offered (`FAQ[].link` in `modules/system/help/compute.js`).

Builder's choices (the spec left these open, or the code had moved on):
- **Kind `settings`, not `report`** in `tests/first-view.kinds.mjs`. The spec said report-kind structure checks, but a
  report may hold five sections that open and this page is seven topic rows; "things to look up" (Help, Glossary) is
  the settings kind, whose budget is 200 words, and the page opens at 90.
- **Statuses of at most 20 characters** (R25). The spec's "history since 1928, government life tables" is 43; the row
  says "history since 1928" and the life tables are in the words inside.
- **Every topic has a status**, also the five the spec left bare, so the list reads evenly.
- **`url` is optional.** Seven sources have no full address in their README; they are shown by name with the read
  date, never with an address made up here.
- **Social Security's life table is not listed as a source**: the Longevity README gives no read date for it, and says
  the curve only comes close to it. The words say so ("a curve fitted to come close to Social Security's life tables").
- **The 50/30/20 book is not listed**: a book has no read date.
- **A source is named in plain words first** ("The IRS's tax tables and amounts for 2026 (Revenue Procedure
  2025-32)"): what it is, then the publisher's own name or number in one bracket at the end, so a person can still
  look it up. Review 2026-11-14: the names used to lead with the law's number.
- **The day shown is the latest day any README says it read the source.** The tax tables are cited twice in
  `taxes/federal` (2026-11-02 and 2026-11-06 at the same address): the page says November 6 (review 2026-11-14).
- **A link says "Opens in a new tab."** after its day; a source without an address in its README stays plain text.
- **The page's title is in the top bar and in the hero**, as on every page of the app (Help, Assumptions, Our
  guesses for you); a review asked to drop one on a small phone, which would be a change to the shell for all pages.
- **A topic lists at most six pages, all shown**: six is the app's own number of rows before "N more"
  (`FIRST_ROWS` in `core/ui/more.js`), and a fold inside an open row would be a row inside a row.
- **Read dates are said in words** ("Read November 13, 2026"), not as 11/13/2026.
- **No sentence about the AI helper** on the page: a household without one would meet a word it does not need, and
  Help already says that numbers never come from it.
- **The helper line shows only where the page is offered**, so no link leads to a page that is switched off.
- **Help's link is under the question it answers**, not a new card.

## Edge cases
- A page in a topic's list that is not built, switched off or hidden from this household: no chip; with none left the
  "Pages that use it" heading goes too.
- No page list at all (`ctx.modules` missing): the page still draws, with no chips and no "More on this".
- Opening or shutting a row changes nothing in the plan (there is nothing to save).

## Tests
`module.test.mjs` (21): the seven topics in order with statuses of at most 20 characters; every linked page is in the
registry, built and offered to every household; every quoted page name is a real page title and is linked; every
source has a name and a real read date, and an https address when it has one; the day is the latest one the README
gives right at the citation; a name starts in plain words with the publisher's name or number in a bracket at the end; every source is cited in the README it
names with that date beside it; `dayWords`, `readWords`, `sourcesWords`; the page's sentence; `compute`; invariance
(byte-identical output for the empty plan, no plan, every fixture plan and the 14 households, no plan touched); the
first view; what a row holds; pages not offered; "More on this"; no builder words on screen; S11 (nothing is saved);
the helper's line (present under `how`, last, once, 44 px, built with a lazy body, absent for other kinds and where
the page is not offered); Help's link.

## Ideas / not yet
- A search box, once there are more topics (goals, property, estate and career have none yet).
- A link from a source to the exact place on the page that uses it.
- The read dates could be checked against the READMEs by `npm run check`, not only by this module's test.
