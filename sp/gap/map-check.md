# Skeptic's check of gap/map.md (2026-11-13)

Checked against the shared tip 707355c. I served it from my own worktree (`gap/v-map`, ports 9881 and 9882, sandbox,
phone, the family fixture, plus an empty plan for Quick answers) and read the code. The worktree is removed and both servers
are stopped. Page texts and screenshots for the 16 pages I opened are in `gap/chk/out/` (`<tag>.txt` and `<tag>.png`).
My working notes are in `gap/chk/notes.txt`.

The sample:
- 43 HAVE or PARTIAL lines (16 of them opened in the app).
- 47 MISSING lines, searched in code and READMEs under other names.
- 12 OUT lines, checked for a fitting version the mapper missed.

Where I could not confirm a claim, I counted the map as wrong.

## Verdict in one paragraph

The map mostly holds up. Most of its cells match the code, its counts add up (315 lines: HAVE 142, PARTIAL 102,
MISSING 50, OUT 21), and every PARTIAL and MISSING id appears in the gap list. Every Pl, In and Li research row is cited
somewhere. I found:
- 6 wrong verdicts: 2 HAVE that should be PARTIAL, 4 MISSING that should be PARTIAL.
- 12 cells whose verdict stands but whose description is false or incomplete. Two of these matter for planning: C6 and J8.
- 1 false summary claim about OUT lines.
- 3 HAVE lines that contradict the map's own definition of HAVE.

With the verdict fixes the counts become HAVE 140, PARTIAL 108, MISSING 46, OUT 21.

## 1. Verdicts that are wrong

| Line | Map says | Should be | Evidence |
|---|---|---|---|
| **C2** Percent of savings, with a floor (Pl50) | HAVE ("Share-of-savings rule; guardrails floor") | **PARTIAL**: the share-of-savings rule exists, but no rule has a floor. | `core/math/retirement.js` l.161: `draw = Math.max(0, total * wr)`, with no minimum. Guardrails cuts the target by a tenth again and again (l.253 `guardSpend *= 0.9`). Its only bound is a ceiling, the plan's own figure (l.254, l.260 `Math.min(guardSpend, baseSpend * priceLevel)`). The word "floor" in the code is the name of the target, not a minimum. The app's own words agree: How much to take out says of the share rule "a bad year cuts spending at once" (`chk/out/wstrategy.txt`). Gap to add: "a lowest spending I accept" on the share and guardrails rules, size S, Depth: Will the money last? settings. |
| **G12** Retire in each year of a range (Pl103, FIRECalc's "delayed-retirement window test") | HAVE (Goal seek; Scenario compare) | **PARTIAL**: the app finds the earliest age that works, but never shows a table of each retirement year with its result. | Goal seek's README l.17 says it rebuilds the plan at each age only to return "the earliest age". FIRE's `carefulAgeSteps` (`retirement/fire/compute.js` l.328-337) also returns one age. Scenario compare needs a copy made by hand for each age. Gap to add: "a row per retirement age: lasts or not, what it could spend", size S to M, Depth: Goal seek. |
| **R2** What moves a score; disputes; freeze and fraud-alert steps (Li52 Li55 Li57) | MISSING | **PARTIAL**: the biggest lever on a score is already worked out and explained; disputes and the freeze checklist are missing. | Credit cards `underLines` (`debt/credit-cards/compute.js` l.77-90) gives how much less on the cards gets the share of limits in use under 30% ("what lenders like") and under 10% ("best for the credit score"), and when. The Glossary has "Credit score" (what it is based on: paying on time, what you owe, the share of card limits used) and "Credit utilization" (`ai/glossary/data/terms.js` l.145-146). The High gap row "Credit: ... what moves it" should say that the utilization part is there. |
| **I12** Returns and reimbursements linked to the purchase (Ca30) | MISSING | **PARTIAL**: a refund filed under a spending category already nets against it; nothing links it to the purchase. | `cashflow/spending/compute.js` l.73: "a refund filed under a spending category reduces it". The README l.93 says category totals are net of refunds. The Ledger also recognises refund words (`transactions/ledger/compute.js` l.284 `REFUND_WORDS`). |
| **D17** Other countries (Pl78 lists "currency choice") | MISSING ("US only") | **PARTIAL**: a currency can be chosen; nothing else for another country exists. | Settings > Plan basics has Currency USD / EUR / MXN / GBP / CAD and Number and date format English (US) / Español (México) / Español (España) (`system/settings/view.js` l.55; seen in the app, `chk/out/settings.txt`). The U.S. guesses switch off for a non-USD plan (`core/estimate/engine.js` l.5). No foreign tax, pension or market data. The money sign changes; nothing is converted. |
| **D3** Early access: Roth conversion ladder, 72(t) (Pl64) | MISSING ("Only the age-55 rule is noted (Will the money last? README)") | **PARTIAL** (medium confidence): the conversion half of a ladder and the age-55 rule are both modelled; 72(t) is missing. | The engine converts in every retired year before required withdrawals, early retirement included (`core/math/retirement.js` l.268). Roth conversions says "Five years: under 59½, each conversion must sit in the Roth five years before it comes out without a penalty" (`retirement/roth-conversions/view.js` l.234) and is found by the alias "conversion ladder" (`module.js` l.18). The age-55 rule is applied in the Federal estimate's extra-10% charge (`taxes/federal/known.js` l.142-150 `leftWorkAt55`, l.199-234), not only noted. 72(t) payments: nothing. |

## 2. Verdict right, cell wrong or incomplete

These matter when a builder sizes the gap rows.

| Line | What the map says | What is true | Evidence |
|---|---|---|---|
| **C6** One-offs (sell the home, a big purchase, an inheritance) | "the main projection drops one-offs and **the person cannot add one**" | A person can add one to a what-if copy today. Scenario compare's "Make your own" has "A one-time sum (+ in, − out)" with "Year of the one-time sum", run through the engine's events. Only the main plan cannot take one. | `scenarios/compare/compute.js` l.27-28 (`lumpSum`, `lumpYear` push to `I.events`); README "Levers". The High gap row "Things that will happen" (A7, C6, E7, G9) is smaller than stated: the input and the engine hook already exist, so what is left is putting it in the main plan. A13's "no lever for selling the house" is likewise half covered by this lever. |
| **J8** Undo | "Change log, Backups; one-tap Undo **(soon, wave 1)**" | One-tap Undo already ships at the tip on 9 places: Our guesses, guide steps, Monthly check-in, Import, Statement reader, Update my balances, Emergency fund, People, Required withdrawals. A Backups restore can itself be undone. Wave 1 adds something else: "Undo my typing" for boxes not yet saved. Nothing gives a general Undo of any saved change. | `overview/guesses/view.js` l.154; `overview/guide/frame.js` l.261, 345; `overview/monthly-review/view.js` l.82; `transactions/import/view.js` l.213; `transactions/statements/view.js` l.112; `balance/update/view.js` l.49; `balance/liquidity/view.js` l.58; `household/people/view.js` l.33; `retirement/rmd/view.js` l.145; `system/backups/README.md` l.41; wave 1 `w1/integ/core/place.js` l.313-358. |
| **D9** The 10% early-withdrawal penalty | "on the balance sheet's cashed-in value **only**; the projection does not charge it" | The Federal estimate also charges it on this year's draw from someone under 59½, by each adult's share and part of the year, with the age-55 exception for a 401(k). The projection does not charge it, as the map says. | `taxes/federal/known.js` l.199-234 (early tax), l.700-701 (the "Extra 10% on early withdrawals" row); `core/math/retirement.js` has no 59½ rule. |
| **E3** Social Security special cases | "**Earnings test**, ex-spouse and **child benefits** are missing" | Both are modelled, on Life insurance needs: 75% of the full benefit for each child under 18, 75% for a parent caring for a child under 16, the family maximum, and the earnings test on the survivor's benefit. They are missing on the Social Security page and in the retirement projection, which is what the row should say. | `insurance/life-needs/compute.js` l.33-45 (`CHILD_SHARE`, `PARENT_SHARE`, `FAMILY_MAX_*`, `EARNINGS_TEST_BY_YEAR`), l.103. |
| **A20 / A33** | "Export (any table to CSV)", "CSV of any table" | Export offers 11 tables: accounts, transactions, income, expenses, debts, goals, holdings, net-worth history, retirement year by year, tax year by year, life timeline. The page's own headline says "Any table", but its README lists Monte Carlo bands and stress tests as not yet. The payoff schedule, mortgage schedule, Chance bands, If-history-repeated rows and lots cannot be exported. The verdicts hold; the wording overstates. | `reports/export/compute.js` dataset ids; README "Ideas / not yet"; `chk/out/export.txt`. |
| **A18** AI drafts changes for me to approve | names only the Document reader and Voice notes | Categorizer also proposes categories that are applied only after a tap. Ask the plan, Explain and Plan critic never write, as the map says. | `modules/ai/categorizer/view.js` writes through `store.update`; `assistant`, `explain` and `critic` views have no `update(`. |
| **A35** Reminders and a money to-do list | Voice notes reminders, Needs attention, Monthly check-in | Missing from the cell: Money calendar's own "Your reminders" (a date, once, every month or every year, an amount, a note), saved into the calendar file. | `chk/out/calendar.txt`; `household/calendar/view.js` l.121. |
| **I8** Tags | "no filter, report or rule uses them" | Export's transactions CSV carries a tags column; Ledger search does not match tags. PARTIAL holds. | `reports/export/compute.js` l.24 headers; `transactions/ledger/compute.js` l.752 (payee, raw payee, note only). |
| **D12** Inherited IRA ten-year rule | MISSING; "the spread of its tax is an idea" | Not modelled, so MISSING holds. The rule is already told to the person: Life events' inheritance walk says to empty it by December 31 of the 10th year, and Roth conversions says so of heirs. | `household/life-events/data/events.js` l.13, l.86; `life-events/view.js` l.85; `retirement/roth-conversions/view.js` l.66, l.196. |
| **Q5** One-time extra debt payments | MISSING | MISSING holds for Pay off debts. Mortgage already takes a one-time lump sum, but as a recast (lower payment, same end date), not as a snowflake that brings the debt-free date closer. | `debt/mortgage/compute.js` l.114, l.131-132; `debt/payoff/README.md` l.81 lists "one-off lump sums" as an idea. |
| **A14** Pretend family | "the invented households in `qa/` are for builders" | Also for builders: `tools/build.mjs --demo <plan>` makes a single-file app that opens on a pretend household (the "phone demo"). Nothing in the app offers it to a household, so PARTIAL holds. The gap row's size could reuse this path. | `tools/build.mjs` l.6-8, l.52; `core/store.js` l.93 `startingPlan()`. |
| **N7** (OUT, FEED) Home and car values filled in | "Fit, and the app has it: a typed value with its date" | The fit the app has is better than the map says, and needs no feed. Our guesses estimates the home's value as the price paid grown by the state's FHFA house price index (bundled to 2025). Without that, it uses the state's median from the Census survey. The car's value comes from the Survey of Consumer Finances. | `overview/guesses/estimators/home.js` l.4-6, l.25; `overview/guesses/estimators/saving.js` l.10, l.359. |

## 3. A summary claim that is false

- Map, last line: "Everything else marked OUT already has its fitting version (file import, typed values, typed quotes,
  lists of what to do)."
- The map's own method says "Each OUT cell says the version that fits the promise, and whether the app has it."
- Eight OUT cells name no fit at all: **K6** (only "A company haggling for a fee"), **K7**, **O8**, **O13**, **O17**,
  **O25**, **O40**, **V2** (empty cells).
- Fits exist for some of them and should be named: K7 has due dates on Money calendar and Bills; O13 has Performance against an
  index (O11); V2 has rent typed on Rental analysis.
- **K6 has a buildable fit that is not built**: plain steps for asking a company to lower a bill (call, ask for the
  retention offer, name a rival's price), size S. Add it to "OUT lines with a fitting version not built yet".
- K5 (cancelling): Subscriptions already carries one line, "You cancel with the company itself, not here; once the charges
  stop, the item drops off this list on its own" (`cashflow/subscriptions/view.js` l.41). The "how to cancel" fit is that one
  line, not nothing.

## 4. Lines that break the map's own definitions

The map defines HAVE as "the app does it" and PARTIAL as "some of it is there". These HAVE cells name parts that are missing:
- **O20**: "A calendar schedule and whole-share rounding are not there". The gap list even puts O20 in a row.
- **J5**: "No 'off' switch; 'keep both' is not remembered".
- **L7**: "percentiles are an idea".

By the map's rule they are PARTIAL. If the mapper meant "the core asked for is there", the legend should say so. I did not
move them in the counts above.

## 5. Claims I checked and found true

HAVE and PARTIAL lines (the app or the code shows it as the cell says):
- **A2**: Quick answers lists 8 + 3 = 11 calculators that answer on an empty plan. "Will my money last?" sends you to the
  guide (about 20 minutes). Seen in the app.
- **A5**: Plan health score has 7 parts with points to gain. Seen.
- **A7**: Life events covers marriage, baby, job, move, inheritance and divorce. The engine takes `events` and
  `spendingChanges`.
- **A30**: the Dashboard's cards are fixed. Seen.
- **A31**: Settings has page switches and "Show what is still being built". Seen.
- **B1**: 2,000 paths, seed 1.
- **B2**: the history data runs 1928-2025, and Backtest from 1871.
- **B3**: bootstrap and random inflation are README ideas.
- **B9**: `CAREFUL_CHANCE = 0.9`.
- **B10**: 0.85 and 0.7 at `monte-carlo/compute.js` l.188.
- **B13**: Stress tests has 9 shocks (2008, the 2000s, the 1970s, 1929, 6 months out of work, never working again, a death
  for each partner, living to 100) plus a care home. Seen.
- **B17**: Docs is `builderOnly`.
- **C3**: four rules. Seen.
- **C5**: a tenth at 1.2× and 0.8× the rate. The rate can be set on Will the money last?; the bands cannot. Seen.
- **C4**: `spendingChanges` is used only by the stress tests' survivor.
- **C8**: four orders; proportional is a README idea.
- **D1**: `FILL_RATES` 10/12/22/24.
- **D2**: IRMAA is shown as a warning only.
- **D5**: "State tax is not included" (`taxes/projection` README l.16).
- **D6**: a flat rate on pre-tax withdrawals, or the brackets. Seen.
- **D15**: Document reader kinds are pay stub, statement, Social Security and advisor's plan; W-2 and 1099 are ideas.
- **E1**: claim ages 62-70 in whole years. Seen.
- **E2**: no search over the couple's pair of ages.
- **E5**: lump sum, survivor option, COLA.
- **F5**: sex, health shift, Gompertz fit to SSA tables.
- **G1**: one inflation figure.
- **G2**: Backtest presets are 100/0 to 0/100.
- **H2 / H8**: rollover only, overspending not carried (Budget README l.15); "money to assign" is an idea (l.71).
- **H4**: 50/30/20 plus 60/20/20, 70/20/10 and your own split.
- **I1**: Categories can rename, hide and add. Seen.
- **K4**: `toIcs`, "Save to your phone's calendar". Seen.
- **N2**: Update my balances flags after 31 days; Needs attention after 90.
- **O5**: Modified Dietz time-weighted return plus XIRR.
- **O6**: periods run between saved points.
- **O29**: sell-first is lowest gain per share; no method choice.
- **P2**: two earners and the W-4 Step 2 note.
- **P6**: Needs attention speaks only once a payment is past due.
- **P7**: no penalty amount.
- **Q2**: three orders. Seen.
- **Q14**: IBR, RAP and PSLF.
- **W1**: `hsaEligible` and `HDHP_BY_YEAR`.
- **X6**: no theme or text-size setting; only the `prefers-color-scheme` meta tags. Seen.
- **X7**: the Assistant select offers "Off". Seen.

MISSING lines (nothing under any name I tried):
- **A8, A10, A21, A24**: no query-string inputs on any calculator (the only query keys are back, edit, month, q, more, from
  and hops); no plan-versus-actual path.
- **B14**: accounts count by type only (`BUCKET_OF`).
- **C11**: no Sankey.
- **D16**: no move between accounts.
- **H1, H9, H10, H14, H16**
- **I6**: splitting is an idea in the Ledger README (l.267).
- **I7, I11, J4, K8**: amount drift is an idea in the Bills README (l.31).
- **N3**: one currency per plan.
- **N5, N17**
- **O2, O7, O23**: Backtest rebalances yearly only.
- **O27, O32, Q7, Q9, Q13**: Voice notes kinds are spend, income, reminder, balance and note.
- **T6, T7**
- **U4, U7**: mentioned, not modelled.
- **U5, U9**: UTMA is only in the Glossary and in beneficiary advice.
- **U10, X4**: encryption appears only in the phase 10 blurb.
- **X8**

OUT lines whose fit is as stated:
- **A16**: `transactions/connect` is planned, SimpleFIN or Plaid.
- **A29**
- **M2**: no "set it up at your bank" note anywhere.
- **N19**: the printable packet is only README ideas in four modules.
- **R1**: no credit-score field anywhere.
- **S3**
- **T1**: the worksheet for a lawyer is not built.
- **O3**

## 6. What this changes in the gap list

- **Add C2**: a lowest spending I accept on the share and guardrails rules. Medium value, S, Depth.
- **Add G12**: a row per retirement age on Goal seek. Low to Medium value, S to M, Depth.
- **High row "Things that will happen"**: the person can already add a one-time sum to a what-if copy. Building it into the
  main plan's projection is the remaining work, so the size is closer to S to M than M.
- **High row "Credit"**: what moves a score is partly there (the utilization amounts and dates on Credit cards); what is
  left is the typed score, disputes and the freeze or fraud-alert steps.
- **Medium row "Early access"**: conversions in early retirement, the five-year rule and the age-55 rule exist. What is left
  is 72(t) payments and the 10% charge inside the projection.
- **Medium row "Returns and reimbursements"**: netting by category exists. What is left is linking a refund to its purchase
  and marking a reimbursement as not income.
- **Low row "Other countries"**: currency sign choice exists.
- **OUT list**: add K6's script. Name the fits for K7, O13 and V2. Drop the sentence that every other OUT line has its fit.
