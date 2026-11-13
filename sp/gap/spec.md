# Gap spec: what other money apps do that this app does not yet, designed simple first (for claude-b)

Written 2026-11-13 by the gap spec writer, for claude-b. claude-b builds it and decides every open point without asking
the owner; a visible choice is written down as "Builder chose" in the page README and, for a new pattern, in one
`docs/DESIGN_LOG.md` entry (never "Owner chose").

- **Base.** The shared branch at `707355c` (the local clone is at `f513aa2`, which is `707355c` plus one claims commit).
- **Built on.** Wave 1 of the touch stress test, as integrated in `$SP/w1/integ`. It adds `core/place.js`, the
  `ui.form` field option `more: true` ("More details (optional)"), `ui.setMoreOpen`, `ctx.redraw` and `ui.reveal`.
- **In flight first.** The retirement request (`$SP/rv/spec.md`, steps L1 to L8) and the simple-first spec
  (`$SP/opt/spec.md`, commits C1 to C21).
- **Read for this spec.**
  - `$SP/gap/map.md`, with its corrections in `$SP/gap/map-check.md`; a correction overrides the map.
  - The five research files `$SP/gap/research-{plan,cash,invest,life,ux}.md`.
  - `$SP/opt/spec.md` and `$SP/rv/spec.md`.
  - From the repo: `AGENTS.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_LOG.md`,
    `docs/MODULE_CATALOG.md` and `core/groups.js`.
  - The code named in each design: `core/math/retirement.js` (its `events`, `spendingChanges`, `incomes[].fromYear`
    and `untilYear`, and `contributions[].skipYears` hooks), `core/math/payoff.js`, `core/format.js`,
    `core/ui/base.css`, `modules/retirement/{historical,longevity,monte-carlo,healthcare,medicare,social-security}`,
    `modules/insurance/life-needs/compute.js`, `modules/scenarios/compare/compute.js`,
    `modules/property/home/compute.js` and `tools/build.mjs`.
- **Edits and servers.** Nothing in `$REPO`, in `w1/integ` or in any other worktree was
  edited, and no server was started.
- **Web checks.** Every current figure a design uses was checked on 2026-11-13. Section 9 lists each with its
  source; a figure that could not be checked became an input with a labelled example.

`$SP` = `$SP`.

The owner, verbatim, 2026-11-13: "Continue. I want you to make sure that there is no stone left unturned. There should
be complete optionality, and there should not exist a single other application in the entire internet, that doesn't
have the functionality or optionality of this application. Now, it is extremely important to keep in mind that it
should stay simple by default. There should be ways for you to upgrade the complexity and the depth of it, and it
should also flow fluid and easy to understand for a human user." 2026-11-12: "Default to less is more and allow more
complexity or toggles. We want subtle optional complexity". 2026-11-11: "user experience is key, and it should also
provide valuable insights, right? It's got to be valuable." Standing: "Public repo: no real names or data, no secrets,
no GPL code." "Verify every current figure (tax limits, prices, rules) with a source and a date." On screen: "No bank
logins or account numbers, ever".

---------------------------------------------------------------------------------------------------------------------

## 0. The spec in fifteen lines

1. **The pool.** It holds 160 gap lines: the map's 152 PARTIAL and MISSING lines, map-check's two new gaps (C2 and
   G12) and six fitting versions of OUT lines that are not built yet (R1 typed score, N19 packet, T1 worksheet, K6
   script, M2 note, K5 note). Related lines on the same page are merged, which leaves 100 gaps. 29 map lines are
   dropped in whole or in part because the promise, the platform or a repo rule forbids them: the map's 21 OUT lines,
   the OUT halves of three HAVE / OUT lines, and five more (section 8).
2. **The ranking.** Value is 1 to 10: how many households, how much money or worry, how often. Priority = value ÷
   √size, where S = 1, S–M = 1.5, M = 2 and L = 4. The top 40 get a design (section 4) and the next 60 one line each
   (section 7).
3. **The top five.**
   1. **#1 Things that will happen** in the plan: sell or downsize the home, part-time years or a break, money in or
      out once, spending that changes for some years, goals paid from savings.
   2. **#2 "Will my savings last?"** in three boxes, with nothing set up.
   3. **#3 One-time extra debt payments.**
   4. **#4 Spending that eases with age**, with a lowest spending and the guardrail settings.
   5. **#5 Safe to spend this week.**
4. **Simple by default, everywhere.** Most designs add nothing to a first view until the person asks. Each design is
   one quiet row in the page's parts card, a "More on this" row or a "More details (optional)" box, built with the
   simple-first helper (`part`, `parts`, `rest`, `choice`, `links`) under its budgets and its never-folded list.
5. **Seven new pages and one shared table.** The pages are all in existing groups:
   - `retirement/claiming` "When to start Social Security"
   - `reports/if-something-happens` "If something happens to us"
   - `debt/credit-score` "Your credit score"
   - `estate/will-worksheet` "Choices to take to a lawyer"
   - `cashflow/shared-costs` "Sharing costs as a couple"
   - `system/methods` "How we work out the answers"
   - `retirement/early-access` "Money before 59½"
   - `core/math/state-tax.js` (a shared table, not a page)
6. **No schema version bump.** Every new field is optional and read with a default. Four new optional top-level
   sections (`credit`, `pathSnapshots`, `budgetPlan`, `spendingWatch`) need no migration; the `docs/DATA_MODEL.md`
   text is given per design.
7. **Money math stays out of the AI** (rule 5). The two AI designs (#23 tax forms, #39 Ask proposes a change) propose
   fields from a whitelist; the app computes every effect itself and applies a change only on a tap.
8. **The promise holds.** Nothing logs into a bank, a bureau or a broker. The credit page takes a typed score. The
   tax-form reader drops every identifier. The family packet shows only the last four digits the plan already keeps.
9. **Seven build batches** of 3 to 6 commits each. Commits in one batch touch no common file except the append-only
   shared docs (`CHANGELOG.md`, `docs/DATA_MODEL.md`, `docs/MODULE_CATALOG.md`, `docs/TEAM.md`,
   `docs/WORKBOARD.md`, the generated registry), so they can be built in parallel worktrees.
10. **Gates.** Wave 1 and the simple-first helper (opt C1, C2) land first. The retirement-request steps L1, L2, L5, L7
    and L8 gate the commits on their pages. A gated commit that is not ready slides one batch, together with any
    commit that shares its files.
11. **Who.** claude-b builds all 40, each under its own claim row in `docs/TEAM.md`. claude-a gets one hand-over file
    with three items, because its 13 folders are never edited. claude-f's stale overview claim gets a workboard line
    with five suggestions before anything there is touched. Section 6 has both.
12. **Figures are sourced and dated.** Section 9 lists 23 checks, all made 2026-11-13. A figure not published yet
    (the IRS rate for 2027 Q1) or read only from secondary pages (YNAB and Monarch headers, the 2026 W-4 Step 3
    amount) is marked "check at build".
13. **Tests.** Every formula gets a module test, plus an invariance test: with the new field absent, every compute
    over the qa households is byte-identical to before. Pages are screenshotted at 390 and 320 px, light and dark,
    and with `--more`.
14. **Drops.** Bank linking, trading, licensed advice, paid feeds and vendor services are dropped (section 8). For each
    one the version that fits the promise is named, and section 7 says whether it is built or listed.
15. **What the owner sees.** Batch 1 gives the plan your real life (#1), a one-minute retirement answer (#2), a faster
    debt-free date (#3), safe-to-spend money (#5), bill rises caught (#6), and the best claiming ages for a couple
    (#7).

---------------------------------------------------------------------------------------------------------------------

## 1. How the gaps were ranked

**The pool.**
- The map's section 2 (152 PARTIAL and MISSING lines).
- Map-check's verdict fixes:
  - C2 is PARTIAL: no rule has a floor.
  - G12 is PARTIAL: no table per retirement age.
  - R2, I12, D17 and D3 are PARTIAL. Their gaps get smaller.
  - C6's input and engine hook already exist (Scenario compare's one-time sum), so #1 is S–M.
  - D9: the 10% charge is already in the Federal estimate; it is missing only in the projection.
  - E3: the earnings test and child benefits exist on Life insurance needs; they are missing on Social Security.
- The fitting versions of OUT lines that are not built: R1 (a typed score), N19 (a printable packet), T1 (a
  worksheet), K6 (plain steps to ask for a lower price), M2 (a "set it up at your bank" note) and K5 (one line exists).

**Merging.** Lines that land on the same page and the same data are one gap. For example, C4 + C2 + C5 are "how
spending changes in retirement", and I6 + I8 are "split and tags". That gives 100 gaps.

**Value (1 to 10)** is judged from three things:
- **Reach**: how many households have the need. Almost all, many, or some.
- **Stake**: how much money or worry the gap costs them.
- **How often**: weekly, monthly, yearly or once.

The table in section 2 gives a short reason for each value. Examples:
- **#7 couple's claiming ages, 9.** It reaches married households near 62, and the stake is often the largest
  single money decision they make.
- **#34 401(k) fees, 4.** It reaches many households, but the stake is a small share of a balance and the figure has
  to be typed from a notice.

**Size points.** S = 1, S–M = 1.5, M = 2, L = 4. These are the map's sizes, corrected by map-check and by what the code
already has. Two examples:
- #1 reuses the engine's hooks.
- #27 reuses Life insurance needs' family maximum and earnings-test table.

**Priority** = value ÷ √size. The square root keeps a valuable medium gap (#7, M, 9 → 6.4) above a small low one
(#34, S, 4 → 4.0). Ties go first to wider reach, then to fewer gates.

**Not ranked because work in flight covers them:**

| what | covered by |
|---|---|
| B15 and B16 | L1 |
| G3 | L5 |
| G5 and O39 per row | L6 |
| J3 OFX/QFX/QBO | L8 |
| P2 pay stub | L7 |
| A4 and the form fold | opt spec and wave 1 |
| J8 typing undo | wave 1 |
| B17's per-page "How this is worked out" | opt spec R4, kind `how` |

Only B17's household methodology page remains open (#28).

---------------------------------------------------------------------------------------------------------------------

## 2. The top 40

V = value, Sz = size, P = priority, B = build batch (section 5). "Lane" = who may edit (section 6 for hand-overs).

| # | gap (plain words) | map lines | V | Sz | P | where | lane | B |
|---|---|---|---|---|---|---|---|---|
| 1 | Things that will happen, in the plan: sell or downsize the home, part-time years or a break, work after retiring, money in or out once, spending that changes for some years, goals paid from savings | A7 C6 E7 G9 G10 | 10 | S–M | 8.2 | Will the money last?, an `own` part | claude-b (its retirement claim) | 1 |
| 2 | "Will my savings last?" in three boxes, nothing set up | A2 | 8 | S | 8.0 | Quick answers, answered in place | claude-b | 1 |
| 3 | One-time extra debt payments and months you can't pay extra | Q5 Q8 | 8 | S | 8.0 | Pay off debts, an `own` part | claude-b | 1 |
| 4 | Spending in retirement: eases with age, a lowest spending, guardrail settings | C4 C2 C5 | 8 | S | 8.0 | Retirement settings; How much to take out | claude-b | 2 |
| 5 | Safe to spend this week | H7 | 8 | S | 8.0 | Budget, first line when there is data | claude-b | 1 |
| 6 | A bill went up, a new regular charge, one tap to Expenses, how to ask for a lower price | K8 K3 K6-fit | 7 | S | 7.0 | Bills and regular payments; Subscriptions | claude-b | 1 |
| 7 | The best pair of claiming ages for a couple (and the best age for one) | E2 | 9 | M | 6.4 | new page `retirement/claiming`, linked from Social Security | claude-b | 1 |
| 8 | Hide the amounts on screen | N17 | 6 | S | 6.0 | Settings card "How this phone looks"; the menu's foot | claude-b (after wave 1) | 2 |
| 9 | Text size and light or dark by choice | X6 | 6 | S | 6.0 | same card | claude-b (after wave 1) | 2 |
| 10 | Health costs that rise faster than prices | G1 | 6 | S | 6.0 | Assumptions, `choice()` | claude-b (after L5) | 3 |
| 11 | "If something happens to us": one printable packet, with final wishes | N19-fit T8 | 8 | M | 5.7 | new page `reports/if-something-happens` | claude-b | 2 |
| 12 | What is already set aside for each yearly bill | H13 H12 | 5 | S | 5.0 | Irregular expenses | claude-b | 2 |
| 13 | A category over twelve months; watch one shop | L3 L5 | 5 | S | 5.0 | Where the money goes | claude-b | 2 |
| 14 | Choices to take to a lawyer (a will worksheet) | T1-fit | 5 | S | 5.0 | new page `estate/will-worksheet` | claude-b | 2 |
| 15 | The next estimated payment: a reminder a week before, and what paying late costs | P6 P7 | 5 | S | 5.0 | Estimated payments; Money calendar's file | claude-b | 3 |
| 16 | HSA receipts to pay yourself back later | W2 | 5 | S | 5.0 | HSA and FSA | claude-b | 3 |
| 17 | Choose how careful the answer is; my own "good" | B9 B10 | 5 | S | 5.0 | Chance the money lasts | claude-b | 3 |
| 18 | Your credit score: typed, what moves it, freeze, fraud alert, fixing a mistake | R1-fit R2 | 7 | M | 4.95 | new page `debt/credit-score` | claude-b | 3 |
| 19 | Try a change and see the answer before saving | A3 | 7 | M | 4.95 | "What this rests on" (L2) | claude-b (after L2) | 3 |
| 20 | Look around with a pretend family | A14 | 6 | S–M | 4.9 | Get started row → sandbox | claude-b; claude-f line | 4 |
| 21 | A row for each retirement age | G12 | 6 | S–M | 4.9 | Goal seek | claude-b (after L1) | 4 |
| 22 | Sharing costs fairly as a couple | H16 | 6 | S–M | 4.9 | new page `cashflow/shared-costs` | claude-b | 4 |
| 23 | Read a W-2, a 1099 or last year's return | D15 P16 | 6 | M | 4.24 | Document reader, new kinds | claude-b (after L7) | 4 |
| 24 | Split a purchase across categories; tags that do something | I6 I8 | 6 | M | 4.24 | Ledger and every category reader | claude-b | 4 |
| 25 | Make a what-if version my plan; more levers | A13 | 6 | M | 4.24 | Scenario compare | claude-b | 4 |
| 26 | Roth conversions that stop at Medicare's surcharge line or the marketplace credit line | D2 | 6 | M | 4.24 | Roth conversions › Conversion settings | claude-b | 5 |
| 27 | Social Security when divorced, still working, or with young children | E3 | 6 | M | 4.24 | Social Security, per person | claude-b | 5 |
| 28 | How we work out the answers (methods and sources, for the household) | B17 | 5 | S–M | 4.08 | new page `system/methods` | claude-b | 5 |
| 29 | Payments made against the debt plan | Q7 | 5 | S–M | 4.08 | Pay off debts, a `more` part | claude-b | 5 |
| 30 | What to write on your W-4 (and W-4P for a pension) | P4 P3 | 5 | S–M | 4.08 | Withholding check, a print sheet | claude-b | 5 |
| 31 | A nudge when the guardrail is crossed | G14 | 4 | S | 4.0 | How much to take out | claude-b | 5 |
| 32 | Paid back later, leave out, flag, link a refund | I12 I13 I10 | 4 | S | 4.0 | Ledger's edit form | claude-b | 6 |
| 33 | Bring the history from YNAB, Monarch or Mint | J9 | 4 | S | 4.0 | Import (after L8) | claude-b | 6 |
| 34 | A 401(k)'s own fees and what trading cost | O26 O27 | 4 | S | 4.0 | Fees › Set my own numbers | claude-b | 6 |
| 35 | Ahead or behind the path you drew last year | A24 | 5 | M | 3.54 | Net worth; Annual review pack | claude-b | 6 |
| 36 | An inherited IRA: the ten-year rule and its tax | D12 | 5 | M | 3.54 | Expected inheritance | claude-b | 6 |
| 37 | Budget your way: every dollar a job, move money, overspending, hold for next month, three-number view | H1 H2 H9 H10 H5 | 5 | M | 3.54 | Budget › Set my own numbers | claude-b | 7 |
| 38 | Money before 59½: the 10% in the plan, the age-55 rule, conversion ladder, 72(t) payments | D3 D9 | 5 | M | 3.54 | new page `retirement/early-access` + engine | claude-b | 7 |
| 39 | Ask the plan proposes a change you can apply | A18 | 5 | M | 3.54 | Ask the plan | claude-b | 6 |
| 40 | State income tax by brackets, now and in retirement | P13 D5 | 7 | L | 3.5 | `core/math/state-tax.js`; Tax year by year; State (hand-over) | claude-b + claude-a hand-over | 7 |

Reasons for the values, one line each:
- #1: every plan has a known change ahead.
- #2: the first answer, and the one that earns trust.
- #3: most households with debt; the debt-free date is the motivation.
- #4: retirees over-save when spending is planned flat (Blanchett; Tharp).
- #5: a weekly question.
- #6: monthly; catches money that is otherwise lost.
- #7: largest single decision for a couple.
- #8 and #9: on every screen, for everyone.
- #10: a real cost in every retirement plan; S.
- #11: a large worry, made once.
- #12 and #13: monthly, budgeters.
- #14: about two adults in three have no will.
- #15: freelancers and retirees who pay estimates.
- #16: HSA holders.
- #17: anyone with a strong feeling about risk.
- #18: every adult.
- #19: understanding the answer.
- #20: first visit.
- #21: near-retirees.
- #22: couples.
- #23: households whose own computer runs the app with the helper on.
- #24: ledger users.
- #25: what-if users.
- #26: pre-retirees with pre-tax money near the Medicare or marketplace lines.
- #27: divorced, still working or late parents.
- #28: trust.
- #29: motivation.
- #30: two-earner households and pensioners.
- #31: retirees on the guardrails rule.
- #32 and #33: ledger users.
- #34: 401(k) holders.
- #35: yearly.
- #36: heirs.
- #37: budgeters.
- #38: early retirees.
- #39: helper users.
- #40: residents of graduated-tax states.

---------------------------------------------------------------------------------------------------------------------

## 3. What every design follows

1. **The simple-first rules, as written** in `$SP/opt/spec.md` sections 2 to 4:
   - the budgets (answer 160 words and 8 figures; list 240 and 16; form 5 boxes)
   - the never-folded list (R9)
   - one filled button
   - one written sentence per case (R5), each with a test
   - the green line naming the new answer after a save (R7)
   - the saved part staying open (R17)
   - the vocabulary: "N more ...", "How this is worked out", "Set my own numbers", "The figures",
     "More details (optional)", "More on this"
   - `part()`, `parts()`, `rest()`, `choice()` and `links()` from `core/ui/more.js`, and no hand-written `<details>`

   A new page is born adopted. A design on a page whose opt-spec commit has not landed does that page's conversion in
   the same commit, following the opt spec's eight steps, and the opt commit then skips the page. Each design names its
   page's opt commit.
2. **Default first.** What the person sees by default is written first in each design, and is often nothing new. Depth
   is one tap away. Nothing asks "beginner or expert?". Opening or closing never changes the plan.
3. **Data.** New fields are optional and read with a default; no version bump. Each design's `docs/DATA_MODEL.md` text
   is given. Calculator-only inputs go in `whatIfs.<page>` (never counted in the plan). Device-only choices go in a
   `localStorage` key named in "Not in the plan", with a `.sandbox` twin.
4. **Math.**
   - Pure, in `compute.js` or `core/math/`, with every formula and its source with a read date in the README.
   - A shared helper lives next to its owner (`modules/retirement/happenings.js`, like L2's `levers.js`).
   - No figure from the AI reaches the plan without a tap (rule 5).
5. **Invariance.** Each design adds a test that, with its new fields absent, every `compute()` it touches gives
   byte-identical output over `qa/households` and the four fixture plans. This follows the pattern of the left2 and
   ssg lanes.
6. **Every commit.**
   - A claim row in `docs/TEAM.md` for the files it touches, removed when it lands.
   - `npm run registry`, `npm test`, `npm run check` and `node tools/leak-guard.mjs --worktree` all pass.
   - `node tools/shot.mjs <group>/<id>` at 390 and 320 px, light and dark, and with `--more`, then read.
   - One sandbox walk: open the new part, save inside it, reload, Back.
   - The README section, a catalog row for a new page, and one `CHANGELOG.md` line `- [builder] ...`.
   - `main` moves only by `git push` through the main gate.
7. **Public repo.** Examples use the invented households in `qa/`. No GPL or AGPL code is pasted; Firefly III,
   Ghostfolio and GnuCash are references only. Open Social Security's licence could not be confirmed this session, so
   it is a reference only.
8. **Words on screen.** Plain words, as in AGENTS.md rule 14. Spell out every term (IRMAA → "Medicare's income
   surcharge", RMD → "required withdrawal", SAI → "expected aid"). Builder details stay in the README.

---------------------------------------------------------------------------------------------------------------------

## 4. The designs

Each design follows the same template:
- **Where**: where it lives.
- **By default**: what a person sees with nothing opened.
- **On request**: the deeper option.
- **Inputs**: plan fields, with the `docs/DATA_MODEL.md` text.
- **Formulas**: the math, with sources and dates.
- **Tests**: what `module.test.mjs` adds.
- **Who**: the lane, the gates, and the page's opt commit.

### #1 Things that will happen, in the plan (A7, C6, E7, G9, G10)

**Where.** Will the money last? (`retirement/projection`).
- One `own` part in the page's parts card, titled **"Things that will happen"**. The title is four words naming the
  content, as R24 allows for an `own` part.
- The shared math goes in a new pure file, `modules/retirement/happenings.js`, next to L2's `levers.js`.
- Life timeline (`overview/timeline`) lists each item on its year, in a second, smaller commit in the same lane.

**By default.** Nothing new on the first view; the parts card gets one row.
- With nothing set: "Things that will happen · none yet".
- Once something is set: "Things that will happen · 2 set by you", and the headline already counts them.
- After a save, the green line names the new answer (R7): "Saved. The money now lasts to 93 (was 88)."

**On request.** The part opens on two things.

1. **One line per item, with its own effect:**
   - "Sell the home in 2041: about $212,000 after the mortgage and costs · lasts to 93 (88 without it)"
   - "Bo works half-time 2030–2034 · lasts to 86 (88 without it)"
   - Edit and Remove on each line, both outlined.
   - The list is cut by `rest()` after six lines.
2. **"Add one:"** with five outlined chips. Each chip opens a form of at most five boxes, with the rest under "More
   details (optional)":

| chip | boxes shown | "More details (optional)" |
|---|---|---|
| "Sell or move to a smaller home" (only when the plan has a home) | the year; "Buy a home for" ($0 = rent) | "Rent a month"; "Selling costs" (6%, the usual figure); "What the home is worth today" (from the home or its account) |
| "Work less or take a break" | who; from year; until year; "Pay while you do": chips "None (a break)" / "Half" / "Type my own %" | "Taken from savings each year of a break" ($) |
| "Work after you retire" | who; from year; until year; pay a month | - |
| "Money coming in once" / "A big cost once" | what; the year; how much ("after any tax" on money in) | - |
| "Spending changes for some years" | from year; until year (blank = for good); the change a month (+ or −) | - |

Under the chips is one more `choice()` row: **"Goals with a date"**: "Leave them out" (the default) / "Take them from
savings when due · 3 goals".

**Inputs.** All optional, no version bump. `docs/DATA_MODEL.md`, `retirement` row:
- `happenings?: [{ id, kind: "home"|"less"|"after"|"in"|"out"|"spend", name?, personId?, year, untilYear?, amount?,
  monthly?, share?, buyFor?, rentMonthly?, sellCosts?, value?, fromSavings? }]`. These are things that will happen,
  set on Will the money last? (#1), in today's dollars; optional, no version bump, 2026-11.
- `countGoals?: boolean`.

**Formulas.** In `happenings.js`, `toEngine(plan, inputs, { nowYear })` returns a copy of the engine inputs. It uses
only hooks the engine already has (`core/math/retirement.js` header):
- **in / out:** `events.push({ year, amount: out ? A : −A, label })`. A positive amount comes out of savings in the
  withdrawal order; a negative one goes into the taxable bucket. The amount is in today's dollars and is grown by the
  engine's price level.
- **spend:** Δ = 12 × the monthly change. Let S be the spending level in force that year (the base `spending.yearly`,
  after earlier changes in year order). Push `{ fromYear: year, factor: (S + Δ) / S }`. When `untilYear` is set, also
  push `{ fromYear: untilYear + 1, factor: S / (S + Δ) }`. The engine applies these to fixed-real and guardrail
  spending only. With a share-of-savings or years-left rule, the line says "not used with your way of taking money
  out (How much to take out)".
- **less** (before that person retires), for the years in [from, until]:
  - Each of that person's contributions gets those years added to `skipYears`.
  - When the share σ > 0, the contribution is also pushed again as `{ ...c, yearly: c.yearly × σ, skipYears: every
    year outside [from, until] }`.
  - `fromSavings` > 0 adds `events` out each year of the range.
  - The engine does not model pay in working years, only saving. "How this is worked out" says so.
- **after:** `incomes.push({ name, yearly: 12 × monthly, personIndex, startAge: 0, fromYear: year, untilYear,
  cola: true, taxable: true })`.
- **home:** let g be the home's growth (`appreciation`, else `property/home` `DEFAULTS.appreciation`) and i the plan's
  inflation.
  - Today's value: V₀.
  - Value in year Y, in today's dollars: V = V₀ × ((1+g)/(1+i))^(Y−now).
  - The mortgage linked to the home: its balance at Y from the amortization in `core/math/finance.js`, deflated by
    (1+i)^(Y−now).
  - Selling costs: c (the `sellCosts` default of 0.06 in `property/home`).
  - Gain over the tax-free amount: max(0, V_nominal − basis − costs − `EXCLUSION[filing]`), where basis = purchase
    price + improvements. It is taxed at 15%, the middle long-term rate (IRC §1(h)). This is a stated simplification,
    and the line says "Your gain is over the tax-free amount; a tax preparer can say exactly".
  - Net = V × (1 − c) − balance − tax − buyFor, pushed as `events` with amount −net.
  - The mortgage's `loans` entry gets `untilYear = Y − 1`.
  - Running costs move as a "spend" change from Y. The old costs are property tax + insurance + upkeep + HOA, from the
    home's fields or our guesses. The new costs are the old costs × buyFor ÷ V, or the rent × 12.
- **goals (countGoals):** for each goal dated within the plan, push `events` out in its year of max(0, target −
  saved). Goal targets are already today's money (DATA_MODEL `goals`). "How this is worked out" says it assumes the
  goal's monthly saving is not also in retirement saving.
- **Effect per item:** two deterministic `project()` runs, all items against all items minus this one. It is reported
  as the age the money lasts to, or as the end balance in today's dollars when it lasts either way.
- **Validation:**
  - A year before this one or after the plan's end is refused with words.
  - Amounts must be ≥ 0, with the sign given by the chip.
  - The share is 0–100%.

Sources:
- The engine's hooks (its header comment).
- `property/home` `DEFAULTS` and `EXCLUSION`, with that README's sources (IRC §121).
- IRC §1(h) for the 15% rate.

Monte Carlo, If history repeated and Goal seek build their inputs through `buildInputs`, so they pick the happenings up
with no edit of their own.

**Tests** (`retirement/projection/module.test.mjs`, a new `describe("happenings")`):
1. Invariance: no `happenings` gives identical inputs and an identical answer for every qa household.
2. "in" $100,000 in 2035 gives the event `{year:2035, amount:-100000}`, and the end balance rises.
3. "out" does the reverse.
4. A home sale with V₀ 400,000, growth 3.5%, inflation 2.5%, Y = now + 10, a 6% cost and a hand-computed mortgage
   balance: net to the dollar; `loans` `untilYear`; the spending factor.
5. "less" at 0.5 for 2030–2034: the contributions are halved in those years only.
6. A break with σ = 0 gives `skipYears` only.
7. "after" gives an income with `fromYear`, `untilYear` and `taxable`.
8. A temporary "spend": the two factors multiply to 1.
9. `countGoals` off gives no events; on gives one event per dated goal.
10. Removing the only item gives the base answer.
11. A year past the plan is refused.
12. Chance the money lasts changes when a $500,000 "out" is set (through `buildInputs`).

**Who.** claude-b. `retirement/projection` view and compute are in its retirement-request claim.
- **Gate:** the request's projection steps (L2 card, L4 leftover, L5 presets) have landed.
- **Opt commit:** the projection is in opt 6.2 (C19 checks it).
- A workboard line to claude-e first, because claude-e's careLine item touches this view.
- `balance/projection` (claude-a) should read the same happenings for Net worth ahead: hand-over item A1.

### #2 "Will my savings last?" in three boxes, with nothing set up (A2)

**Where.** Quick answers (`overview/quick`). It is the first question row and is answered in place, as a what-if page
(R8) inside a card.

**By default.**
- Three boxes:
  - "Saved for retirement" ($)
  - "To take out each month" ($, in today's money)
  - "For how many years": `choice()` chips 20 / 25 / 30 / 35, with "Type my own"
- One filled button: "See the answer".
- Once answered, the boxes fold into "The figures · $1,000,000, $4,000, 30 years" (kind `figures`). The answer leads,
  with one sentence per case (R5):
  - All lasted: "In every 30-year stretch since 1928, $4,000 a month from $1,000,000 lasted."
  - At least 90%: "In 64 of 69 stretches of 30 years since 1928, $4,000 a month from $1,000,000 lasted."
  - 50 to 90%: "It lasted in 48 of 69 stretches since 1928; in the rest it ran out early."
  - Under 50%: "In most stretches since 1928, $4,000 a month ran out before 30 years."
  - None: "In every stretch since 1928, $4,000 a month ran out before 30 years."
- A second line:
  - "The hardest start was 1966: it ran out after 24 years.", or
  - "Even starting in 1966, the hardest year, $310,000 was left."
- Never folded (R9 item 5): "This leaves out Social Security, pensions and taxes. Your plan counts them: Set up my
  plan ›".

**On request.**
- "More details (optional)" in the form:
  - "Share in stocks": chips 40% / 60% / 80%, default 60%.
  - "Fees a year": chips 0% / 0.25% / 1%, default 0%.
- "3 more numbers" (kind `more`):
  - "Up to $3,650 a month lasted in every stretch."
  - The median left at the end, in today's money.
  - The number of stretches.
- "How this is worked out" (kind `how`): the loop below, the data and its years, and what it leaves out.

**Inputs.** `whatIfs.quickLast?: { saved, monthly, years, stocks, fee }`. These are Quick answers' "Will my savings
last?" (#2); a what-if, never counted in the plan; optional. They are inside the page's `ALLOWED_WRITES`.

**Formulas.** The history is `RETURNS`, already bundled at `modules/retirement/historical/data/returns.js` (Damodaran,
NYU Stern: S&P 500 with dividends, 10-year Treasury, T-bill, CPI; 1928–2025; 98 years).

For each start index s with s + N ≤ 98 there is one window, so there are 98 − N + 1 windows (69 for N = 30):

```
B = saved; W = 12 × monthly
for k in 0..N-1:
  B = B - W                      # taken at the start of the year
  if B < 0: fails in year k+1; stop
  r = st × stocks[s+k] + (1-st) × bonds[s+k] - fee
  B = B × (1 + r) / (1 + inflation[s+k])   # today's money
lasts if it never failed
```

- "Up to X a month lasted in every stretch": bisection on W down to $10 a month (B is decreasing in W).
- Timing (the start of the year) is this page's choice and is stated in "How this is worked out".
- FIRECalc is the design reference only; no code is taken (FIRECalc is not open source).

**Tests:**
1. A 2-window hand example (N = 97).
2. The window count is 98 − N + 1.
3. W = 0 always lasts.
4. W > saved fails in year 1.
5. The safe amount lasts every window, and the safe amount + $10 fails one.
6. A higher fee never raises the count.
7. Each case sentence is read by a test.
8. Empty boxes show the form and no answer.
9. Only `whatIfs` is written (the existing `ALLOWED_WRITES` test).

**Who.** claude-b (`overview/quick` is in opt 6.1, class B). It does the opt conversion (opt C19) in the same commit.

### #3 One-time extra debt payments (Q5; Q8's print)

**Where.** Pay off debts (`debt/payoff`): an `own` part, "One-time payments". The math is in `core/math/payoff.js`.

**By default.**
- The first view is unchanged: "Debt-free by March 2029" and its line.
- The parts card gets "One-time payments · none yet", then "2 set by you".

**On request.**
- "Put a lump sum on a debt":
  - the amount
  - the month: `choice()` "Next month" / "April (a tax refund)" / "December (a bonus)" / "Type my own"
  - "More details (optional)": which debt, default "The next one in your order"
- "A month you can't pay the extra": a month and how much less.
- Saved lines, each with its effect: "$2,500 in April 2027: debt-free January 2029 instead of June 2029, about $410
  less interest".
- In "How this is worked out": "Print the month-by-month plan" (outlined), a sheet from `modules/reports/report-kit.js`
  (Q8).

**Inputs.** `debtPlan.lumps?: [{ id, month: "YYYY-MM", amount (> 0 paid on top that month; < 0 extra not paid that
month), debtId? ("" = the next debt in the order) }]` (Pay off debts, #3; optional).

**Formulas.** `payoffPlan(debts, { …, lumps = [] })`. In the monthly loop, after the minimums and the extra, in month
m:
- **amount > 0:** pay it to `debtId` if that debt still owes, else to the first debt in the chosen order (the
  avalanche or snowball target). What is left over rolls on to the next debt, as the extra already does.
- **amount < 0:** extra_m = max(0, extra − |amount|). Minimums are always paid.

Interest is unchanged (balance × rate ÷ 12). The result gains `lumpEffect: { monthsSooner, interestSaved }` against
the same plan with `lumps = []`. Undebt.it's "snowflakes" are the design reference only.

**One date across pages (R4-18).**
- Every page that shows the payoff date reads Pay off debts' compute, which carries `debtPlan.lumps`.
- `insurance/life-needs/compute.js` (line 491) calls `payoffPlan` with `pay.extra`, `pay.order` and
  `pay.customOrder`; it also passes `pay.lumps`, a one-line change in this commit.
- `balance/projection` (claude-a) needs the same line: hand-over item A1.

**Tests:**
1. `lumps = []` is identical for every fixture.
2. $5,000 at 20% APR with $200 a month and a $1,000 lump in month 3: months sooner and interest saved match a
   hand-computed schedule.
3. A lump on a debt already paid off rolls to the next.
4. A lump larger than all debts ends them that month.
5. A negative lump delays the date.
6. A month before today is ignored, with a note.
7. A bigger lump is never later.
8. The date agrees on Pay off debts, Debts and Life insurance needs.

**Who.** claude-b (`debt/payoff`, opt C9; `core/math/payoff.js`; one line in `insurance/life-needs/compute.js`).

### #4 Spending in retirement: eases with age, a lowest figure, guardrail settings (C4, C2, C5)

**Where.**
- Will the money last? › "Retirement settings" (a pinned title) gets one `choice()` row, **"Spending as you age"**.
- How much to take out (`retirement/withdrawal-strategy`) › "Set my own numbers" gets:
  - "Lowest spending you'd accept", for the share-of-savings, years-left and guardrails rules
  - "Trim after bad years", for guardrails only

**By default.** The row reads "Stays the same", and the parts stay shut; every answer is unchanged.

**On request.**
- "Spending as you age": "Stays the same" / "1% less each year" / "2% less each year" / "Type my own". Under "More
  details (optional)": "Starting at age", defaulting to the start of retirement.
- "Lowest spending you'd accept" ($ a month, today's money).
- "Trim after bad years" chips: "by 5%" / "by 10% (usual)" / "by 15%".
- "When" (more details): a fifth above or below the starting rate, the usual bands, with two boxes for my own.

**Inputs.** On the `retirement` row:
- `spendingEase?` (a fraction a year; 0 or absent means the same)
- `easeFromAge?`
- `spendingFloor?` (a month, today's dollars)
- `guard?: { cut, raise, upper, lower }`

All are optional, and the defaults give today's answers.

**Formulas.**
- **Eases:** for each retired year y after the start (or from `easeFromAge`), `spendingChanges.push({ fromYear: y,
  factor: 1 − d })`. Year k of retirement spends base × (1−d)^k in today's money.
- **Floor** (`core/math/retirement.js`, the percent/vpw and guardrails branches; map-check found `draw = Math.max(0,
  total * wr)` with no minimum):
  - percent and vpw: draw = max(draw, max(0, floor × P + healthCover + tax − income)).
  - guardrails: guardSpend = max(guardSpend after its trim, floor × P).
  - Both are bounded by what savings hold.
- **Guardrail knobs:** the constants `0.9`, `1.1`, `1.2` and `0.8` become `1 − cut`, `1 + raise`, `upper` and `lower`
  from `I.guard`, defaulting to the same values.

Sources (read 2026-11-13):
- Blanchett, "Exploring the Retirement Consumption Puzzle", *Journal of Financial Planning* 27(5):34–42, May 2014.
  Real spending falls about 1% a year on average in retirement.
- Tharp, "The Retirement Spending Smile Revisited", SocArXiv ctu3g, 2026. A constant real decline of about 1% a year,
  with sensitivity 0 to 2%, is the more defensible default. That is why the chips are 1% and 2% and no "smile" mode is
  offered.
- The guardrail rule's source stays as its README cites it.

**Tests:**
1. d = 0, floor = 0 and the default guard are identical for every strategy and every fixture.
2. d = 0.01 gives fixed-real spending in year k = base × 0.99^k.
3. The ease row is hidden for share rules (their spending is set by the share).
4. The floor is never broken while savings last.
5. cut = 0.05 trims by 5%.
6. Monte Carlo and history read the same inputs.
7. The green line names the new answer.

**Who.** claude-b (projection view and compute in its claim; `retirement/withdrawal-strategy`, opt C10;
`core/math/retirement.js`). It comes after #1, which touches the same files.

### #5 Safe to spend this week (H7)

**Where.** Budget (`cashflow/budget`), as the first line.
- It is drawn only when there is something to measure: envelopes exist, or this month's bank lines cover the month so
  far (the ledger's `monthCover`).
- It is not on the Dashboard: its greeting, three verdict rows and one button are the owner's (N8).

**By default.** Nothing new for a household with no envelopes and no bank lines this month. With data, the headline has
one sentence per case:
- "About $310 is free to spend until Sunday." / "That keeps your bills and saving covered to the end of November."
- At or past zero, it is an alarm and never folded: "Spending is $140 past this month's plan." / "The bills still to
  come need what is left."

**On request.**
- `choice()` chips under the line: "Today" / "This week" / "Until payday". The last one shows only when a payday is
  known (`income[].payday`).
- "How this is worked out" (kind `how`) shows the sum with each figure linked.

**Inputs.** `whatIfs.safeSpend?: { span: "today"|"week"|"payday" }` (Budget, #5; a choice of view, never counted in
the plan).

**Formulas.**
- **Planned flexible money this month:**
  - With envelopes: Σ budget + rollover for categories that are not bills (`essential` expense categories count as
    bills).
  - Without envelopes: the app's one after-tax month (the same take-home the Dashboard and Next best action use,
    through `cashflow/budget-percent` `yearTaxes`) − must-pay bills this month (Expenses with `essential`) − saving
    this month (retirement contributions from pay, goals' `monthly`, Irregular expenses' monthly set-asides).
- **Spent so far:** ledger outflows this month in flexible categories, leaving out transfers and lines already counted
  as bills.
- **Left this month** = planned − spent.
- **Safe(span)** = max(0, left) × days(span) ÷ days left in the month, counting today.
  - days(today) = 1.
  - days(week) = the days through Sunday.
  - days(payday) = the days through the day before the next payday, capped at month end.

PocketGuard's "In My Pocket" and Simplifi's spending plan are design references only.

**Tests:**
1. On the first day of a 30-day month, the week figure = left × 7 ÷ 30.
2. A bill already paid in the ledger is not taken twice.
3. Transfers are ignored.
4. A negative left gives the alarm sentence (R5).
5. No data gives nothing drawn.
6. The payday span uses the next payday and stops at month end.
7. Each case sentence is read by a test.

**Who.** claude-b (`cashflow/budget`, class C in opt 6.1; it does C19's conversion in this commit). The Monthly
check-in may link to it: suggestion F1 for claude-f.

### #6 A bill went up, a new regular charge, one tap to Expenses, how to ask for a lower price (K8, K3, K6-fit)

**Where.**
- Bills and regular payments (`cashflow/recurring`).
- Subscriptions (`cashflow/subscriptions`) gets a `how` part for the script.

**By default.** Lines appear only when something changed. They are amber and never folded (R9 item 3):
- "Netflix went up from $15.49 to $17.99 in October."
- "New: Gym Co, $39 a month since October 3. A new bill?", with two outlined buttons: "Add to Expenses" and "Not a
  bill".

After three lines comes "N more changes" (`rest`).

**On request.**
- Every found payment not yet in Expenses has "Add to Expenses" (outlined) in its row.
- Subscriptions gets "How to ask for a lower price" (kind `how`), in plain steps:
  - Know your price and a rival's.
  - Ask for the department that keeps customers.
  - Ask what they can do to lower the bill.
  - Be ready to cancel.
  - Write down the new price and when it ends.
  - Add a reminder on the Money calendar for that day.
- No company calls for you: that is K6, OUT (SERVICE).

**Inputs.** `expenses[].payeeKey?`: the found payment's key (`accountId|normalised payee`) it was added from, so the
button does not show twice (Bills, #6; optional). "Not a bill" uses the existing `recurringIgnored`.

**Formulas.** These run on `detectRecurring()`'s series (same payee, a regular rhythm).
- **Went up:** let a be the newest amount and m the median of up to three before it. Flag when a − m ≥ max($1,
  0.05 × m).
- **New:** a series with at least two charges whose first charge is within the last 70 days, not in Expenses and not
  ignored.
- **"Add to Expenses":** writes `{ name: payee, amount: median, period: cadence → period, category: the lines'
  category, essential: false, payeeKey }` through `store.update`, with a green line and Undo.

**Tests:**
1. A 2% rise is not flagged; 5% and $1 or more is flagged.
2. A one-off higher charge between two normal ones is not flagged (it compares the newest only).
3. New-series detection.
4. "Add to Expenses" writes one row and hides its button.
5. "Not a bill" hides the line.
6. No bank lines gives nothing drawn.

**Who.** claude-b (`cashflow/recurring`, class C, with C19's conversion; `cashflow/subscriptions`, A). A quiet Needs
attention item "A bill went up" is suggestion F2 for claude-f.

### #7 When to start Social Security: the best pair of ages for a couple (E2)

**Where.** A new page, `retirement/claiming`, "When to start Social Security". It is reached from one "More on this"
row on Social Security, with the answer under it: "When should each of us start? › Ana at 70, Bo at 67: about
$38,000 more over your lives". For one person: "When should I start?".

**By default** (the new page): the headline has one sentence per case.
- Couple: "Starting Ana at 70 and Bo at 67 pays the most over your lives: about $38,000 more than the ages in your
  plan (67 and 67)."
- One person: "Starting at 70 pays the most over your life: about $21,000 more than at 67."
- Already the best: "The ages in your plan already pay the most."
- Close call (the top pairs within 2%): "Several pairs come within 2% of each other; any of them is a sound choice."

There is one sentence on the survivor: "If Bo outlives Ana, Bo keeps Ana's larger check." The page has one filled
button, "Use these ages". It writes both claim ages, gives a green line naming the new retirement answer, and offers
Undo.

**On request.**
- "8 more pairs" (`rest` over all 81 pairs, lazy): each pair with its total.
- "Set my own numbers" (own):
  - how to weigh later years: chips "Count every year the same (0%)" / "1% a year" / "2% a year" / "Type my own"
  - each person's health: "Average" / "Better" / "Worse", as Longevity keeps it
- "How this is worked out" (how): the rules, the odds of living, and today's dollars.

**Inputs.** `retirement.claimingRate?` (a real rate; default 0; optional). It writes only the existing
`retirement.socialSecurity[personId].claimAge`.

**Formulas.** These reuse `retirement/social-security/compute.js`: `claimFactor`, `spousalFactor`,
`spousalEarlyFactor`, `survivorAmount`, `fullRetirementAge` and the page's PIAs. Its SSA and POMS citations stand.
- For a pair (a₁, a₂) ∈ {62..70}², year by year from now to age 110, in today's dollars (benefits rise with prices):
  - **Both alive:** each own benefit is PIA × claimFactor(birth, a) once claimed. The spousal top-up is max(0, ½ ×
    PIA_other − PIA_own) × the spousal factor at the age the top-up starts, and it starts once both have filed.
  - **One alive:** the survivor gets the larger of their own benefit and `survivorAmount(PIA_dead, the dead's benefit,
    claimedEarly)`.
  - **Weights:** P(both) = S₁S₂, P(only 1) = S₁(1−S₂), P(only 2) = S₂(1−S₁). Survival S comes from
    `retirement/longevity` `survival(age, toAge, { sex, health })` and the two lives are taken as independent.
  - **Value** = Σ weight × benefit ÷ (1 + rate)^(t − now).
- The best pair is the arg-max over the 81 pairs (brute force; fast). A person already collecting keeps their age;
  only the other varies.
- If the page does not expose a pair's yearly amounts as one function, extract `pairYears(people, ages)` inside
  `social-security/compute.js` in this commit (the same lane).
- Open Social Security (Mike Piper) is the design reference only. Its licence could not be read this session (no
  GitHub access), so no code is taken.

**Tests:**
1. One person at 0% with long life picks 70; with "worse" health and 2%, picks 62 or near it.
2. The brute-force arg-max equals an independent loop.
3. Survivor: the higher earner delaying raises the survivor's benefit.
4. A spouse with PIA under half of the other gets a top-up; one above does not.
5. "Use these ages" writes two `claimAge` values and nothing else.
6. No Social Security figures gives the empty state "Add your Social Security first ›".
7. Someone already collecting has a fixed age.
8. Today's dollars: the total is unchanged by inflation.

**Who.** claude-b. It is a new page (catalog row, retirement group) plus one `links()` row in
`retirement/social-security/view.js`. That page's opt commit is C14; this commit takes only the row.

### #8 Hide the amounts on screen (N17)

**Where.**
- A new Settings card, **"How this phone looks"**, third after Plan basics and "How much to show" (opt C7). It holds
  #8 and #9.
- A row at the foot of the menu drawer, "Hide amounts" / "Show amounts", so it is two taps from any page.

**By default.** Off. Nothing changes.

**On request.** Once on:
- Every money amount on screen reads "$•••". The sign is kept, and percentages and dates stay.
- Charts keep their shapes; their money labels are hidden.
- A form the person opens on purpose shows its own boxes.
- A printout shows amounts, because printing is deliberate. "How this phone looks" says so.
- Turning it on or off gives a green line where the tick is.

**Inputs.** No plan field. Device only: `localStorage["planner.look"]` = `{ fmt: 1, hide?: 1, text?: "larger" |
"largest", theme?: "light" | "dark" }`, with `planner.look.sandbox` in the sandbox. It goes in DATA_MODEL's "Not in
the plan", and "Erase the copy on this device" clears it.

**Mechanism.**
- `core/format.js` gains `setHidden(on)`. `money()` and `signed()` return `${sign}•••` while it is on. The default is
  off, and Node tests never turn it on unless a test does.
- Strings built on the computer for heavy pages bypass that flag. So after each render, the shell masks text nodes and
  SVG `<text>` under `#content` that match `/[$€£]\s?\d[\d,]*(\.\d+)?[kKmM]?/`. Inputs are skipped.
- The drawer row and the Settings tick call `setHidden` and redraw.

**Tests:**
1. `money()` is masked while hidden and plain otherwise.
2. `pct()` is never masked.
3. The DOM pass masks "$1,234", "€12.50" and "$2.4M" but not "2026" or "45%".
4. The plan's bytes are identical after toggling.
5. The key never appears in an export.
6. The sandbox key is separate.

**Who.** claude-b, after wave 1 lands. `core/app.js`, `index.html` and `core/ui/base.css` were wave 1's files, and
`core/format.js` is the builder's.
- The Settings view comes after opt C7, which is where the card order is set.
- A `docs/DESIGN_LOG.md` entry, "Builder chose", for the drawer row; the designer reviews it in the next design
  review.

### #9 Text size and light or dark by choice (X6)

**Where.** The same card, "How this phone looks", with two `choice()` rows:
- **"Text size":** "Usual" (15 px, today) / "Larger" (17 px) / "Largest" (19 px).
- **"Light or dark":** "Like the phone" (today) / "Light" / "Dark".

**By default.** "Usual" and "Like the phone": the app looks exactly as now.

**Mechanism.**
- `document.documentElement.dataset.text` and `.theme` are set from `planner.look` by a small inline script in
  `index.html`'s head, before first paint, inside try/catch.
- `core/ui/base.css`:
  - `:root[data-text="larger"] { --fs: 17px; --fs-sm: 15px; }` and the same for "largest"; the scale is checked
    against every `--fs-*` token.
  - The dark tokens are repeated under `:root[data-theme="dark"]`, and the media block becomes
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`.
  - The `color-scheme` meta follows the choice.
- The 44 px taps and 16 px boxes (no iPhone zoom) stay.

WCAG 2.2 SC 1.4.4 "Resize text" is the reason (W3C Recommendation, 5 October 2023).

**Tests:**
1. `base.css` holds both selectors (a text test).
2. A choice sets the dataset.
3. `qa/first-view.mjs` with the visit-only key `?look=largest` at 320 px finds no sideways scroll and no tap under
   44 px on the path pages.
4. Dark contrast is read on two screenshots.

**Who.** claude-b, in the same worktree as #8, as a second commit. The visible change gets a "Builder chose" entry in
`docs/DESIGN_LOG.md`.

### #10 Health costs that rise faster than prices (G1)

**Where.** Assumptions (`system/assumptions`, after L5) › "Set my own numbers", one `choice()` row:
- **"Health costs rise"**: "With prices" (today) / "1 point faster" / "2 points faster" / "Type my own".

It is used by Healthcare before 65, Medicare and income surcharge, and the projection's health line.

**By default.** "With prices": every answer is unchanged.

**Inputs.** `assumptions.healthGrowth?`: growth of health costs above inflation, a fraction; 0 = with prices
(Assumptions, #10; optional).

**Formulas.**
- A health cost in year t, in today's dollars = cost today × (1 + h)^(t − now).
- It applies to:
  - the marketplace benchmark premium, before the credit (the credit is then worked out on the grown premium)
  - Medicare Part B, Part D and supplement premiums (the income-surcharge thresholds keep their own indexing)
  - out-of-pocket costs
  - the projection's health events (`kind: "health"`, built around line 790 of `projection/compute.js`)

Source: CMS Office of the Actuary, National Health Expenditure Projections 2025–34 (*Health Affairs*, June 24, 2026).
Health spending is projected to grow 5.4% a year on average against 4.1% for GDP, about 1.3 points faster, and
Medicare 7.7% (enrollment growth included). Read 2026-11-13 through secondary reports of the release. "1 point faster"
is labelled "close to what the government's actuaries project". Re-read the Health Affairs paper at build.

**Tests:**
1. h = 0 is identical everywhere.
2. h = 0.01 gives a year-10 premium of base × 1.01^10.
3. The credit is on the grown benchmark.
4. Income-surcharge thresholds are unchanged.
5. The projection's end balance falls monotonically as h rises.

**Who.** claude-b. Assumptions and projection compute are in its claim; healthcare and medicare compute are free.
Gate: L5.

### #11 "If something happens to us": one printable packet (N19-fit, T8)

**Where.** A new page, `reports/if-something-happens`, "If something happens to us". It is listed under Reports and
linked by one "More on this" row from:
- Document vault index (`household/documents`)
- Beneficiary audit (`estate/beneficiaries`)
- Contacts
- Digital assets

Estate documents is suggestion F3 for claude-f.

**By default.**
- Hero: "One packet your family can use if something happens to you."
- One line: "Ready to print: 5 of 7 parts filled in".
- One filled button: "Print the packet".
- Seven rows (`item` parts), each with a count and what is missing:
  - "Who to call · 3 people"
  - "Where the papers are · 12 of 20 found"
  - "Accounts and policies · 14, 2 with no one named"
  - "Online accounts · 6"
  - "Bills that pay themselves · 5"
  - "Final wishes · not set yet"
  - "First steps for your family"

**On request.**
- Each row opens to its list.
- "Final wishes" (own) is a five-box form:
  - funeral or burial wishes
  - where they are written
  - pets and who takes them
  - who to tell first
  - where a letter is kept
- The print sheet (`report-kit`) holds every part.

**"First steps for your family"** (fixed words, sources read 2026-11-13):
1. Ask the funeral home for several certified copies of the death certificate.
2. Tell Social Security. The funeral home usually does; call [number removed] to check. Ask about survivor benefits and
   the one-time $255 payment.
3. Ask one credit bureau for a deceased alert; it tells the other two.
4. Find the will and the executor (Contacts).
5. Tell the employer, the insurers and the banks on this list.
6. Keep paying the bills on this list that matter.

**Never in it:**
- passwords (Digital assets keeps none)
- full account numbers (the plan keeps only the last four digits in Contacts, shown as "ending 1234")
- Social Security numbers

**Inputs.** `estate.wishes?: { funeral, written, pets, tell, letterWhere, updatedAt }` (text; If something happens to
us, #11; optional). Everything else is read:
- accounts (name, institution, type, owner)
- `contacts` (with `last4`)
- `papers`
- `estate.documents`
- `estate.beneficiaries`
- `insurance.policies` (insurer, kind, benefit, through work)
- `debts`
- the regular payments `cashflow/recurring` found
- `estate.digital` (kind, name, access, contact)

**Formulas.** Counts only. A "part filled in" is a list with at least one row, or wishes with any text.

**Tests:**
1. An empty plan gives one sentence and "Start with who to call ›".
2. The counts per part.
3. Only whitelisted keys are read (no field named like a password or a number beyond `last4` reaches the sheet).
4. "ending 1234" formatting.
5. Wishes are saved through `store.update` with a green line.
6. The print sheet has seven sections.
7. The leak guard passes on the fixtures.

**Who.** claude-b: a new page (catalog row; reports are claude-b's in opt 6.1) plus one `links()` row each in four
views (household documents, beneficiaries, contacts, digital).

### #12 What is already set aside for each yearly bill (H13, H12)

**Where.** Irregular expenses (`cashflow/sinking-funds`), on each yearly or quarterly bill's line.

**By default.** Unchanged until a figure is set. With one:
- "Car insurance: $640 of $1,200 set aside · due in March · on track", or
- amber: "short $210 by March".

**On request.** In the bill's edit form (opened by its line):
- "Already set aside" ($), dated today on save.
- "More details (optional)": "Next due".

**Inputs.** On `expenses[]`: `setAside?` ($), `setAsideAt?` (date) and `nextDue?` (YYYY-MM-DD; else from `startDate`
and `period`). For Irregular expenses, #12; optional.

**Formulas.**
- For amount A, cycle L months (from the period) and n months until due:
  - needed by now = A × (L − n) ÷ L
  - short = max(0, needed − setAside)
  - each month to finish = (A − setAside) ÷ max(1, n)
- Yearly envelopes (H12) are this, for bills that come yearly.

**Tests:**
1. On track, short and over.
2. The catch-up amount.
3. No `setAside` gives today's view.
4. A quarterly cycle.

**Who.** claude-b (`cashflow/sinking-funds`, A).

### #13 A category over twelve months; watch one shop (L3, L5)

**Where.** Where the money goes (`cashflow/spending`).

**By default.**
- With twelve months of bank lines, one line per category that jumped (amber, at most two): "Eating out: $410 a month
  lately, $320 over the year (up 28%)".
- A shop or category the person watches shows as one line with this month's total.

**On request.**
- "N more categories over 12 months" (kind `more`, lazy): each category's average month and the last three months'
  average.
- "Watch a shop or category" (own): pick a payee or a category.

**Inputs.** `spendingWatch?: [{ kind: "payee"|"category", key }]` (Where the money goes, #13; optional; a top-level
section, documented).

**Formulas.**
- Monthly totals per category over the last 12 complete months (partly covered months are left out with the ledger's
  `monthCover`).
- trend = mean(last 3) ÷ mean(the 9 before) − 1.
- A category is flagged when trend ≥ 0.20 and the rise is ≥ $50 a month.
- From #24 on, totals read `linesOf(t)`.

**Tests:**
1. Partial months are excluded.
2. The trend arithmetic.
3. The flag thresholds.
4. A watched payee's month total.
5. No lines gives nothing.

**Who.** claude-b (`cashflow/spending`, A).

### #14 Choices to take to a lawyer (T1-fit)

**Where.** A new page, `estate/will-worksheet`, "Choices to take to a lawyer". It is reached by "More on this" from
Legacy goals; Estate documents is suggestion F3 for claude-f.

**By default.**
- One sentence: "Write down your choices first; a lawyer turns them into a will."
- Seven rows, each with its status:
  - who would raise the children (it reuses `estate.documents` guardian `who`)
  - who carries out your wishes
  - who gets what
  - special gifts
  - money for children and the age they get it
  - pets
  - your two powers of attorney
- One filled "Print my choices".
- Never folded (R9): "This is not a will. State laws differ; a lawyer (Contacts ›) makes it valid."

**On request.** Each row opens its small form (`item`).

**Inputs.** `estate.worksheet?: { executor, executorBackup, guardianBackup, childrenAge, specific: [{ what, to }],
rest: [{ name, share }], pets, notes }` (Choices to take to a lawyer, #14; text; optional).

**Formulas.** The rest's shares must add to 100%; the form refuses otherwise, in words.

**Tests:**
1. The shares check.
2. The guardian is read from the documents.
3. The print sheet holds every row.
4. The empty state.

**Who.** claude-b: a new page plus one `links()` row in `estate/legacy/view.js`, after the retirement request releases
`estate/legacy/**`.

### #15 The next estimated payment: a reminder a week before, and what paying late costs (P6, P7)

**Where.**
- Estimated payments (`taxes/estimated`).
- Money calendar's file (`household/calendar` `toIcs`).
- Needs attention a week before is suggestion F2 for claude-f.

**By default.** Unchanged: the next payment's date and amount. A deadline is never folded.

**On request.**
- "What paying late costs" (kind `how`): "Paying the $2,100 due January 15 one month late costs about $12."
- The calendar file's tax dates gain a reminder a week before (`VALARM`, `TRIGGER:-P7D`).

**Inputs.** None.

**Formulas.**
- Penalty ≈ underpayment × rate × days late ÷ 365, quarter by quarter (the Form 2210 regular method's per-period
  arithmetic).
- The rate is the federal short-term rate + 3 points, set each quarter (IRC 6621(a)(2)).
- New `taxes/estimated/data/rates.js`: `{ "2026Q4": 0.07 }`. Source: Rev. Rul. 2026-15, IRS newsroom "Interest rates
  remain the same for the fourth quarter of 2026", read 2026-11-13. 7% also held through 2026 Q1, with 6% in Q2 and
  7% in Q3.
- 2027 Q1 was not published on 2026-11-13. The page uses the newest known rate and says "7%, the rate through
  December 31, 2026".

**Tests:**
1. $2,100 × 0.07 × 31 ÷ 365 = $12.48, shown as "about $12".
2. No payment due gives no part.
3. The rate lookup takes the newest ≤ date.
4. Safe harbor met gives "No penalty: you paid enough last year's way."
5. The `.ics` holds `TRIGGER:-P7D` on tax events only.

**Who.** claude-b (`taxes/estimated`, B, opt C12; `household/calendar`, B).

### #16 HSA receipts to pay yourself back later (W2)

**Where.** HSA and FSA (`taxes/hsa-fsa`). One `own` part, "Receipts to pay back later", shown when the household has
an HSA.

**By default.** One row: "Receipts to pay back later · none yet". Once there are receipts: "· $1,240".

**On request.**
- A list (`rest`) and an add form: date, amount, what, where the receipt is kept.
- A "Paid back" tick per receipt.
- One line: "Left invested 20 years at your plan's return, $1,240 grows to about $X, tax-free when you pay yourself
  back."

**Inputs.** On `taxes.hsa`:
- `receipts?: [{ id, date, amount, what, proof, reimbursedOn? }]`
- `openedOn?` (date)

For HSA and FSA, #16; optional.

**Formulas.**
- Can pay back = Σ amounts not reimbursed, dated on or after `openedOn`. When that is blank, the line says "if paid
  after you opened the HSA".
- Grows to = amount × (1 + the plan's real return)^20.

Source: IRS Publication 969 (for 2025 returns). There is no deadline to pay yourself back. The expense must come after
the HSA was set up and must not be deducted or repaid elsewhere. Keep records. Read 2026-11-13 through summaries that
cite it; quote Pub. 969's own words at build.

**Tests:**
1. The sum.
2. Receipts before `openedOn` are excluded, with words.
3. Paid-back receipts are excluded.
4. The growth formula.
5. No HSA gives no part.

**Who.** claude-b (`taxes/hsa-fsa`, C; does C12's conversion if not landed).

### #17 Choose how careful the answer is; my own "good" (B9, B10)

**Where.** Chance the money lasts (`retirement/monte-carlo`) › "Set my own numbers".

**By default.** "9 in 10 markets" (`CAREFUL_CHANCE = 0.9`): unchanged.

**On request.**
- "How careful": chips "3 in 4" / "9 in 10 (usual)" / "19 in 20".
- "More details (optional)": "When we call it good" (85%) and "When we call it close" (70%).

**Inputs.** On `assumptions`: `carefulChance?`, `goodChance?`, `okChance?` (Chance the money lasts, #17; optional).

**Formulas.**
- `carefulSteps(inputs, { chance })` already takes the chance. Every reader takes it from
  `plan.assumptions.carefulChance ?? CAREFUL_CHANCE` through `careful.js`, and `carefulKey` includes it in the cache
  key.
- `BAD_RUN_NOTE` becomes "(only 1 in 20 is worse)" and so on, built from the chance.

**Tests:**
1. Defaults are identical.
2. The careful spending at 0.95 ≤ at 0.9 ≤ at 0.75.
3. The thresholds move the verdict words.
4. The note words per chance.
5. Every page that shows the careful figure shows the same one.

**Who.** claude-b (`retirement/monte-carlo`, C, opt C14; `retirement/careful.js`).

### #18 Your credit score (R1-fit, R2)

**Where.** A new page, `debt/credit-score`, "Your credit score". It is reached by "More on this" from What lenders see
(`debt/ratios`) and Credit cards.

**By default.**
- Empty: "Type your score and the date you saw it. Your bank or card app often shows it for free." The form has three
  boxes: score, date, whose.
- With a score:
  - "Your score: 712 on November 2, 2026 · good on FICO's scale (670 to 739)."
  - The one lever that matters most, taken from Credit cards' `underLines`: "Paying $1,800 off your cards would bring
    the share of your limits in use under 30%."
  - "+ Add a newer score", outlined.

**On request.**
- "N more scores" (`rest`), with a small line when there are three or more.
- **"Keep your credit safe"** (how), with ticks per person and bureau:
  - a freeze at Equifax, Experian and TransUnion: free since September 21, 2018, and it lasts until you lift it
  - a fraud alert: one year; an extended one lasts seven years with an identity theft report
  - free reports every week at AnnualCreditReport.com, permanent since September 2023
- **"Fix a mistake on your report"** (how): dispute with the bureau. It has 30 days to investigate (45 if you send
  more information during the 30 days, or dispute after getting your free annual report) and five business days after
  that to tell you.
- Bands (FICO, 300 to 850): under 580 poor; 580–669 fair; 670–739 good; 740–799 very good; 800+ exceptional.
  VantageScore bands differ, so the score's model is asked ("FICO / VantageScore / Not sure"). With "Not sure", no
  band words are shown.

**Inputs.** A new optional section, read with defaults (no migration):
`credit?: { scores: [{ id, personId, date, score, model }], freeze: { [personId]: { equifax?, experian?, transunion? } },
alertUntil?: { [personId]: date } }`. It is set on Your credit score (#18), never from a bureau, and holds no numbers
beyond the score.

**Formulas.** The band by score; the history sorted by date. The lever is Credit cards' existing figure.

**Tests:**
1. Band edges at 579, 580, 669, 670, 739, 740, 799 and 800.
2. "Not sure" gives no band words.
3. The lever equals Credit cards' figure.
4. Freeze ticks are saved per bureau.
5. The empty state.

**Who.** claude-b: a new page (catalog row) plus one `links()` row each in `debt/ratios` and `debt/credit-cards` views
(opt C13 pages; rows only).

### #19 Try a change and see the answer before saving (A3)

**Where.** Will the money last? › L2's card "What this rests on".

**By default.** Unchanged (L2's card as it lands). Each lever row gains a quiet "Try" in its row.

**On request.**
- "Try" shows that lever's chips in place:
  - inflation: 2.5 / 3 / 4%
  - retirement age: −2 / −1 / +1 / +2
  - spending: −10% / −5% / +5%
  - saving: +$100 / +$250 / +$500 a month
- Under the card, one line updates at once: "With 4% inflation: lasts to 84 instead of 88".
- "Keep this" (outlined) saves through `store.update`. The green line names the new answer and the card stays open
  (R17).
- "Back to my plan" drops the trial.
- The chance from simulated markets is not redrawn live; the line says "the chance updates when you keep it".

**Inputs.** None. The trial lives in the view's memory and is never stored.

**Formulas.** `applyChanges(plan, { [lever]: value })` from `scenarios/compare` on a copy, then a deterministic
`project()`, then the projection's own verdict words. It runs on a chip tap, never per keystroke.

**Tests:**
1. Trying never changes the plan's bytes.
2. The trial answer equals Scenario compare's result for the same change.
3. A second lever resets the first.
4. "Keep this" writes exactly that lever's field.
5. The card stays open after the save.

**Who.** claude-b (`retirement/levers.js`, projection view), after L2 and after #1 and #4.

### #20 Look around with a pretend family (A14)

**Where.**
- One quiet row on Get started: "Just looking? See a pretend family's plan ›". `overview/start` is under claude-f's
  stale claim: suggestion F4, posted first, per opt C20's method.
- One answer in Help: "Can I try it without my numbers?".

**By default.** Nothing else.

**On request.**
- The row opens the sandbox with `?sandbox=1&demo=<name>`, with chips "A family with children" / "A couple near
  retirement" / "Someone starting out".
- The status pill says "Sandbox" as today.
- A line under the top bar: "A pretend family. Nothing here touches your plan. Leave ›".

**Mechanism.**
- `core/store.js`: with `demo` in the address and an empty sandbox plan, the sandbox starts from a bundled pretend plan.
  It reuses `startingPlan()`, the path `tools/build.mjs --demo` already uses.
- The three plans are copied from the invented households in `qa/` into `core/demo/*.js` and made for today's date, as
  `--demo` does.
- "Leave" drops the sandbox flag. The real plan was never read or written.

**Inputs.** None in the plan.

**Tests:**
1. `planner.plan` bytes are identical after a demo visit.
2. The sandbox key holds the demo.
3. Each demo plan passes `migrate()` and every page's `compute`.
4. The leak guard passes on `core/demo/`.
5. The static site's manifest lists `core/demo/*` (the main gate).

**Who.** claude-b (`core/store.js`, `core/demo/`, `system/help`). The Get started row is claude-f's (F4).

### #21 A row for each retirement age (G12)

**Where.** Goal seek (`scenarios/goal-seek`), after L1. One `more` part: "10 more ages".

**By default.** Unchanged: "The earliest age that works: 64."

**On request.**
- One line per age from today's age, or 55, up to 70: "62: runs out at 81" / "64: lasts to 92 · could spend $6,100 a
  month" / ...
- The part is lazy and runs on the computer when it is connected.

**Inputs.** None.

**Formulas.**
- For each age a, Scenario compare's `retireAge` lever is set on the first adult. A partner keeps their own age, and
  the part says so.
- Then a deterministic `project()`, plus `affordableSpending` (exported by `core/math/retirement.js`) for "could
  spend".

**Tests:**
1. The first age that lasts equals Goal seek's answer.
2. The row count.
3. A couple: only the first adult's age moves.
4. Lazy: built on open and on print.

**Who.** claude-b (`scenarios/goal-seek` in its retirement claim). Gate: L1.

### #22 Sharing costs fairly as a couple (H16)

**Where.** A new page, `cashflow/shared-costs`, "Sharing costs as a couple". It is reached by "More on this" from
Budget (50/30/20) (`cashflow/budget-percent`, one row). A single adult sees one sentence: "This is for two people who
share costs."

**By default.**
- Headline: "Splitting by income: Ana puts in $2,340 a month, Bo $1,560."
- Then: "That is 60% and 40%, the same shares as your take-home pay."
- `choice()`: "By income" (default) / "Half each" / "Our own split".

**On request.**
- "Which costs are shared" (own): ticks on Expenses rows; all are ticked by default.
- "What each keeps for themselves": take-home − share.
- "How this is worked out".

**Inputs.** `whatIfs.shareCosts?: { method: "income"|"equal"|"own", own: { [personId]: fraction }, leaveOut:
[expenseId] }` (Sharing costs as a couple, #22; a what-if, never counted in the plan).

**Formulas.**
- shared = Σ the ticked monthly expenses (`core/math/periods.js` to monthly).
- By income: shareᵢ = take-homeᵢ ÷ Σ take-home. Take-home per person comes from `cashflow/budget-percent` per-person
  taxes where it splits them, else gross pay. "How this is worked out" says which was used.
- Each person's part = shareᵢ × shared.

**Tests:**
1. The shares add to 1.
2. With one earner: "Bo has no pay on Income, so Ana covers it all. Or pick Half each."
3. `leaveOut` is excluded.
4. A single adult gives the empty state.

**Who.** claude-b: a new page plus one `links()` row in `cashflow/budget-percent/view.js` (opt C19 page, row only).

### #23 Read a W-2, a 1099 or last year's return (D15, P16)

**Where.** Document reader (`ai/reader`), after L7's pay stub. It adds three kind chips: "W-2", "1099" and "Last year's
tax return".

**By default.** Only the chips. A read gives proposed entries, each applied by its own tap (rule 5), as the reader
already does.

**On request.** What each form proposes:

| form | read by label words | proposes |
|---|---|---|
| W-2 (last year) | box 1 wages, box 2 federal tax withheld, box 12 codes D/E/G (pre-tax 401(k)/403(b)/457), AA/BB (Roth 401(k)/403(b)), W (employer HSA) | last year's pay check against Income; the yearly saving per plan on Contributions; the employer HSA on HSA and FSA |
| 1099-INT, -DIV, -B, -R | interest (box 1); ordinary and qualified dividends (1a, 1b), capital gain distributions (2a); proceeds, basis, short or long; retirement gross (1) and taxable (2a) | Federal estimate's interest and dividends; Capital gains' sales; `iraWithdrawals` for this year only |
| Form 1040 (last year) | "adjusted gross income", "taxable income", "total tax" | `taxes.priorYear { agi, tax }` (Estimated payments' safe harbor, State's "last year's return") |

- **Label words, not line numbers.** The 2025 Form 1040 renumbered its lines: the IRS test returns show "11a" for
  adjusted gross income and line 15 subtracting line 14 from "11b"; total tax is line 24. Read 2026-11-13.
- **Identifiers are dropped.** The proposal object has a fixed key whitelist, so SSN, EIN, account and control numbers
  can never be proposed or kept. The reader keeps nothing (its own rule).
- **Last year's W-2** never overwrites this year's `withheld`.

**Inputs.** None new; it writes existing fields.

**Sources** (read 2026-11-13; quote the final forms at build):
- IRS General Instructions for Forms W-2 and W-3, box 12 codes.
- IRS 2025 Form 1040 and its instructions (lines 11a/11b, 15, 24) and the MeF test scenarios that show them.

**Tests:**
1. Invented text fixtures per kind give the expected proposals.
2. An SSN-shaped or EIN-shaped string never appears in the output.
3. A W-2 dated last year leaves this year's figures alone.
4. A 1040 gives `priorYear`.
5. Apply writes one field.
6. With the helper off, the reader's plain-rules path reads the boxed numbers by label.

**Who.** claude-b (`ai/reader` in its retirement claim). Gate: L7.

### #24 Split a purchase across categories; tags that do something (I6, I8)

**Where.**
- Ledger (`transactions/ledger`), in the transaction's edit form under "More details (optional) · split, tags, note".
- Where the money goes gets a "Tags" part.
- Rules can add a tag.

**By default.** Nothing new. The edit form's first boxes are unchanged.

**On request.**
- "Split this": add lines (category + amount); the last line takes the rest.
- Ledger search matches "#trip".
- Where the money goes › "Tags · 3" (more): the total per tag ("#trip: $2,140 in July").
- Rules: "then add the tag".

**Inputs** (optional):
- `transactions[].splits?: [{ category, amount, note? }]`. Amounts add to `amount`, with the same sign. A split line's
  `category` is "" and the readers use `splits`.
- `rules[].tag?`.
- No meaning changes for existing rows, so no version bump.

**Formulas.**
- `linesOf(t)` is exported from `transactions/ledger/compute.js`: `t.splits?.length ? t.splits.map(s => ({ ...t,
  category: s.category, amount: s.amount, splitOf: t.id })) : [t]`.
- Every category total reads lines:
  - `cashflow/spending`
  - `cashflow/budget` (envelopes)
  - `cashflow/income-statement` (`bankVsPlan`)
  - `cashflow/budget-percent` where it sums by category
  - `transactions/categories` counts
  - `reports/annual-review` "where it went"
  - `reports/export`: one row per line with a "part of" column
- The duplicate key (`txKey`) stays on the whole transaction. Transfers are never split.
- #32 later filters inside `linesOf`, so the readers need no second edit.

**Tests:**
1. Parts must add to the total; the form refuses in words otherwise.
2. A category total with a split = Σ parts.
3. Export rows.
4. A tag search.
5. A rule adds a tag on import.
6. Removing the split restores one category.
7. Invariance with no splits.

**Who.** claude-b (all those files are in opt 6.1). Monthly check-in (`overview/monthly-review`, claude-f) reads
category sums only through Where the money goes; verify with grep at build. If it sums by itself, that is suggestion
F5.

### #25 Make a what-if version my plan; more levers (A13)

**Where.** Scenario compare (`scenarios/compare`): in each saved version's `item` part.

**By default.** Unchanged.

**On request.**
- **"Make this my plan"** (outlined) asks in words: "This changes 3 things in your plan: retire at 63, spend $5,500 a
  month, Social Security at 68. You can undo it." Then a green line naming the new answer, and Undo.
- **New levers**, under the version form's "More details (optional)":
  - "Sell or downsize the home in" (#1's `home`)
  - "Work less" (#1's `less`)
  - "How money is taken out" (the strategy)
  - "Spending as you age" (#4)

**Inputs.** None new. It uses #1's and #4's fields.

**Formulas.**
- `store.update(d => applyChanges(d, changes))` for the plan levers.
- Input-only levers become plan fields where one exists: `lumpSum` and `lumpYear` → a #1 "in" or "out" item.
- The fee lever has none; it is listed as "not carried: fees are set on Fees", in words.

**Tests:**
1. It writes exactly the lever fields.
2. Undo restores the bytes.
3. The input-only list is shown.
4. A new lever's result equals #1's for the same item.

**Who.** claude-b (`scenarios/compare`, A). It comes after #1 and #4.

### #26 Roth conversions that stop at Medicare's income surcharge or the marketplace credit line (D2)

**Where.** Roth conversions (`retirement/roth-conversions`) › "Conversion settings" (named `own`).

**By default.** Unchanged: fill the 10, 12, 22 or 24% bracket.

**On request.** "Stop sooner" chips, each shown only when it applies:
- "Under Medicare's income surcharge" (someone reaches 65 within the plan)
- "Under the marketplace credit line" (there are marketplace years)

Each shows its lifetime tax and premiums beside the bracket fill.

**Inputs.** `retirement.conversionCeiling?: "bracket"|"medicare"|"marketplace"` (Roth conversions, #26; optional).

**Formulas.**
- The engine's conversion step (`core/math/retirement.js`, which fills a bracket before required withdrawals) gains
  `I.conversionCeiling(year) → dollars | Infinity`.
- conversion_t = max(0, min(room in the bracket, ceiling_t − income_t without the conversion)).
- **Medicare:** the surcharge uses the return from two years before (42 USC 1395r(i)), so for anyone who will be 65 or
  older in t + 2, ceiling_t = the first surcharge tier for t + 2. The figure is the 2026 tier from
  `retirement/medicare/data/medicare.js` (CMS fact sheet, read 2026-10-31), indexed as that file indexes it, in today's
  dollars.
- **Marketplace:** in marketplace years, ceiling_t = `cliff` from `retirement/healthcare` compute for that year
  (400% of the poverty line under "As the law stands", `data/aca.js`, Rev. Proc. 2025-25).
  - Under "If the larger 2021–2025 credits come back" there is no cliff. The chip then says: "No cliff under these
    rules; each extra $1 costs up to 8.5¢ of credit." That is the top applicable percentage in that schedule, and the
    chip caps nothing.
  - Re-checked 2026-11-13: on December 11, 2025 the Senate failed to extend the larger credits (51–48 on both bills),
    and the House passed a three-year extension on January 8, 2026 (230–196). No enacted law was found, so "As the law
    stands" holds.

**Tests:**
1. "bracket" is identical to today.
2. "medicare": t + 2 income ≤ the tier for a person 63+.
3. "marketplace": income ≤ the cliff in marketplace years.
4. Lifetime tax and premiums are shown for each.
5. The "larger credits" rules do not cap.

**Who.** claude-b (`retirement/roth-conversions`, C, opt C14; `core/math/retirement.js`). It is not in the same batch
as #4 or #38 (engine).

### #27 Social Security when divorced, still working, or with young children (E3)

**Where.** Social Security (`retirement/social-security`), in each person's form under "More details (optional)".
Results go in that person's `item` part.

**By default.** Unchanged.

**On request.**
- "Married 10 years or more before a divorce?" → the ex's full benefit at full retirement age (typed from their
  statement or a letter), and the years married.
- "Still working after you start?" → earnings a year.
- Children under 18 come from People (no box).

Result lines:
- "As a divorced spouse you could get up to $1,100 a month, more than your own $900."
- "Working while you collect: about $3,900 held back in 2027; it comes back as a higher check from full retirement
  age."
- "Your two children could each get up to half your full benefit while under 18, within the family limit."

**Inputs.** On `retirement.socialSecurity[personId]`: `exPia?`, `exMarriedYears?`, `exDivorcedOn?`,
`workingEarnings?` (Social Security, #27; optional).

**Formulas.**
- **Earnings test.** Withheld = max(0, earnings − exempt) ÷ 2 for a year wholly under full retirement age. In the year
  of reaching it, ÷ 3 over the higher limit, counting the months before only.
  - Lower limits: 2026 $24,480, 2027 $25,560. These are already `EARNINGS_TEST_BY_YEAR` in
    `insurance/life-needs/compute.js`.
  - Higher limits: 2026 $65,160, 2027 $67,920. They are added to the same table, as a second export.
  - Source: SSA "2027 Social Security Changes" fact sheet (October 2026), read 2026-11-13.
- **Divorced spouse.** Eligible when:
  - the marriage lasted ≥ 10 years before the divorce
  - the person is unmarried now and 62 or older
  - the ex is 62 or older
  - if the ex has not filed: divorced ≥ 2 continuous years

  Amount = max(0, ½ × exPia × spousal factor at the claim age − own). Source: POMS RS 00202.005, TN 50 (10-26),
  effective 2026-10-21, read 2026-11-13.
- **Children of a retired worker.** Up to ½ of PIA each while under 18 (19 in high school), limited by the family
  maximum − the worker's PIA. This reuses `familyMaximum()` in `insurance/life-needs` (POMS RS 00615.736, already
  cited there). The "half" rule was read 2026-11-13 from AARP and Kiplinger summaries of SSA rules; quote SSA's
  "Benefits for Children" at build.
- These lines are on this page only. The projection keeps its claim ages, and "How this is worked out" says so.

**Tests:**
1. Each formula.
2. Each ineligible case says why (married 9 years; remarried; ex under 62).
3. The earnings-test year of reaching full retirement age uses ÷ 3 and the higher limit.
4. The family maximum caps the children.

**Who.** claude-b (`retirement/social-security`, B, opt C14). It comes after #7, which touches the same view.

### #28 How we work out the answers (B17)

**Where.** A new page, `system/methods`, "How we work out the answers". It is linked from Help, and from the last line
of every "How this is worked out" part ("All our methods and sources ›"), added by the helper's `part()` for kind
`how`.

**By default.** One sentence, then topic rows (`item`), each with a status naming the main source:
- Retirement · "history since 1928, government life tables"
- Taxes · "IRS tables for 2026"
- Debt
- Cash and budget
- Investments
- Insurance
- Our guesses

**On request.** Each row opens to:
- the method in plain words
- the main sources, each with its read date
- the pages that use it

**Inputs.** None. Data: `modules/system/methods/data/methods.js`, a hand-written list `{ topic, says, sources: [{
name, url, read }], pages: [] }`.

**Tests:**
1. Every linked page exists in the registry.
2. Every source has a read date.
3. No builder words on screen (`tests/user-view.test.mjs`).
4. Report-kind structure checks.

**Who.** claude-b: a new page. The "All our methods" line goes in `core/ui/more.js` (claude-b's file from opt C1).
Docs stays builder-only.

### #29 Payments made against the debt plan (Q7)

**Where.** Pay off debts: one `more` part, "Against your plan · 2 months ahead".

**By default.** Unchanged. The part's row shows only once a plan start date and newer balances exist.

**On request.** Per debt: "Owed now $8,200; your plan said $8,900 by now (about 2 months ahead)".

**Inputs.** `debtPlan.startedAt?` (date). It is set the first time the plan is saved, or by "Start counting from
today" (Pay off debts, #29; optional).

**Formulas.**
- The planned balance at month m comes from `payoffPlan` run from the balances on `startedAt`, read from
  `accounts[].history` at the nearest point on or before it.
- Ahead in months = the months between today and the month the plan reaches today's actual balance.

**Tests:**
1. Exactly on plan gives "on track".
2. Ahead and behind.
3. No history gives "Update your balances to see this ›".
4. A lump (#3) counts in the plan path.

**Who.** claude-b (`debt/payoff`). It comes after #3.

### #30 What to write on your W-4, and the W-4P for a pension (P4, P3)

**Where.** Withholding check (`taxes/withholding`). Under the existing advice ("Step 4(c): $85 more per paycheck"),
an outlined **"Print what to write"** button.

**By default.** Unchanged, apart from that one button.

**On request.** A one-page sheet per earner (`report-kit`):
- Step 1(c), the filing status.
- Step 2, the box ticked only for two jobs (the app's two-earner rule).
- Step 3: children under 17 × the child amount, plus other dependents × $500.
- Step 4(a), other income.
- Step 4(b), deductions over the standard, with "if you have them" for tips, overtime, car-loan interest and the
  deduction at 65 or older (the 2026 worksheet's new lines).
- Step 4(c), the extra per paycheck.

For a pension (`income.type` "pension"), the same sheet is titled **Form W-4P**. It has one form per pension and the
2026 "no withholding" box.

**Inputs.** None.

**Formulas.**
- `withholdingEstimate` as today.
- The Step 3 child amount comes from the app's tax tables for the year. The 2026 W-4 prints $2,200 per child under 17;
  read 2026-11-13 from employer and payroll publishers, so check the IRS form at build.

Sources (read 2026-11-13):
- The 2026 W-4 has a 15-line Step 4(b) worksheet with the P.L. 119-21 deductions, and Step 4(b) left blank means the
  standard deduction (Experian employer blog; Patriot Software).
- The 2026 W-4P gained a "no withholding" box and the same deductions (APA PayNews; Bloomberg Tax).

**Tests:**
1. The sheet's Step 4(c) equals the page's figure.
2. Step 2 is ticked only for two jobs.
3. W-4P wording for pension income.
4. No SSN line is ever filled (none is stored).

**Who.** claude-b (`taxes/withholding`, B, opt C12).

### #31 A nudge when the guardrail is crossed (G14)

**Where.** How much to take out (`retirement/withdrawal-strategy`). It shows when the household is retired and uses
guardrails. Needs attention is suggestion F2 for claude-f.

**By default.** It shows only when the rule says to act. It is amber and never folded:
- "Markets fell: your rule says trim spending by 10%, about $450 a month."
- Green: "Your rule says you could raise spending by 10%."

**Inputs.** `retirement.guardStart?: { year, rate }`: the withdrawal rate in the first retired year, set the first
time it is shown (How much to take out, #31; optional).

**Formulas.**
- rateNow = this year's need from savings ÷ savings today.
- Act when rateNow > upper × the starting rate or rateNow < lower × the starting rate (#4's `guard`, defaults 1.2 and
  0.8).

**Tests:**
1. Each band.
2. Not shown for other rules or working households.
3. Each case sentence.

**Who.** claude-b. It comes after #4.

### #32 Paid back later, leave out, flag, link a refund (I12, I13, I10)

**Where.** Ledger's edit form › "More details (optional)".

**By default.** Unchanged.

**On request.**
- **"This will be paid back"** (work, a friend): the line is left out of spending until money comes in. "That's the
  money back" then links the two, and both stay out.
- **"Leave out of reports"** (a one-off).
- **"Flag to look at later"**: Categorize's inbox lists flagged lines.
- **"This is a refund of…"**: a picker of recent spending at the same payee.

**Inputs.** On `transactions[]`: `reimb?` (true, or the id of the money back), `exclude?`, `flag?`, `refundOf?` (Ledger,
#32; optional).

**Formulas.**
- `linesOf(t)` returns `[]` for `exclude`, and for `reimb` lines and their money back.
- Refunds already net in their category (`cashflow/spending` line 73). `refundOf` is for display.

**Tests:**
1. An excluded line is in no total.
2. A paid-back pair is out of both money in and money out.
3. A flag shows in the inbox.
4. The refund link shows.
5. Invariance.

**Who.** claude-b (`transactions/ledger`, `transactions/categorize`). It comes after #24.

### #33 Bring the history from YNAB, Monarch or Mint (J9)

**Where.** Import (`transactions/import`), after L8.

**By default.** Unchanged. When a file's header matches, it says "This looks like a YNAB file. Columns worked out for
you."

**On request.** The column step as today ("Change them ›"). The file's own categories are offered as new categories or
mapped by name.

**Inputs.** None new. These are three built-in entries beside `importProfiles`, keyed by the header fingerprint.

Header sets (from third-party converters and parsers, read 2026-11-13; check them against a real export at build):
- **YNAB register:** Account, Flag, Date, Payee, Category Group/Category, Category Group, Category, Memo, Outflow,
  Inflow, Cleared. Amount = Inflow − Outflow; both columns hold "$0.00" when unused.
- **Monarch:** Date, Merchant, Category, Account, Original Statement, Notes, Amount, Tags. Merchant → payee; Original
  Statement → `rawPayee`; Tags → `tags`.
- **Mint** (closed in 2024; old exports): Date, Description, Original Description, Amount, Transaction Type
  (debit/credit sets the sign), Category, Account Name, Labels, Notes.

An "Account" column becomes one import per account name; the person picks or adds each account.

**Tests:**
1. An invented fixture per format gives rows, signs, payees and tags.
2. Several accounts in one file.
3. The duplicate key.
4. An unknown header falls back to today's mapping.

**Who.** claude-b (`transactions/import` in its retirement claim). Gate: L8.

### #34 A 401(k)'s own fees and what trading cost (O26, O27)

**Where.** Fees (`investments/fees`) › "Set my own numbers".

**By default.** Unchanged.

**On request.**
- Per workplace account: "Plan fee: $ a year or % (from your plan's fee notice)".
- "Trading and crypto fees this year" ($).

Both join the yearly cost and the lifetime cost.

**Inputs.** On `investments`: `planFees?: { [accountId]: { pct?, dollars? } }` and `tradingFees?: { year, amount }`
(Fees, #34; optional).

**Formulas.**
- Yearly cost = balance × (the fund's ratio + plan %) + plan dollars + trading.
- The lifetime cost uses the page's existing method.
- Source: the participant fee disclosure rule, 29 CFR 2550.404a-5. Plans must tell participants the fees, and the
  quarterly statement shows the dollars charged. It is cited for "where to find it"; there is no figure.

**Tests:**
1. Zero is identical.
2. A percent and a dollar fee.
3. Lifetime cost monotonic.

**Who.** claude-b (`investments/fees`, A).

### #35 Ahead or behind the path you drew last year (A24)

**Where.**
- Net worth (`balance/net-worth`): one `more` part, "Against last year's plan · ahead by $12,400".
- Annual review pack (`reports/annual-review`): one section.

**By default.** Unchanged until a snapshot is six months old.

**On request.** "Your savings are $12,400 ahead of where last November's plan put them, about 3 months of saving." It
is in today's money.

**Inputs.** A new optional top-level section: `pathSnapshots?: [{ at, points: { [year]: savingsReal }, lastsTo? }]`. It
is written by Net worth's "Save today's totals" at most once a month and keeps at most 24 snapshots (#35).

**Formulas.**
- The points are the retirement projection's `rows[].totalReal` (investable savings), so the page says "savings",
  never "net worth".
- Expected now = linear interpolation between the snapshot's points for this year and next. It is re-expressed in
  today's money with the plan's inflation over the time since the snapshot.
- Ahead = savings today in the same buckets − expected.
- Months of saving = ahead ÷ the plan's monthly saving.

**Tests:**
1. At most one write per month.
2. The interpolation.
3. The inflation re-expression.
4. A snapshot younger than six months gives no part.
5. The plan changes only on "Save today's totals".

**Who.** claude-b (`balance/net-worth`, B, opt C8; `reports/annual-review`, A).

### #36 An inherited IRA: the ten-year rule and its tax (D12)

**Where.** Expected inheritance (`estate/inheritance`). An item of kind "ira" gets one part: "Emptying it within 10
years".

**By default.** Unchanged (Life events and Roth conversions already state the rule).

**On request.** Chips, each showing its tax:
- "Evenly over 10 years" ("about $4,100 of tax a year")
- "As required, the rest in year 10"
- "All in year 10" ("about $58,000 in one year")

- "More details (optional)":
  - "Was the person who died already taking required withdrawals?" (Yes / No / Not sure)
  - the person's birth year
  - which of you inherits
- A line for an eligible heir: "A spouse, a minor child, someone disabled or chronically ill, or someone not more than
  10 years younger has other choices; a spouse can treat it as their own."
- A Roth IRA: no tax and no yearly draws, emptied within 10 years.

**Inputs.** On `estate.inheritance.items[]`: `pastRbd?: "yes"|"no"|"unsure"`, `heirId?` (personId), `fromBirthYear?`
(Expected inheritance, #36; optional).

**Formulas.** Balance B, growing at the plan's real return g; years k = 1..10 after the year of death.
- **Even:** wₖ = Bₖ ÷ (11 − k).
- **As required** (decedent past the required beginning date): wₖ = Bₖ ÷ Lₖ. L₁ is the Single Life Table factor at the
  heir's age in the year after the death, less 1 each later year. Year 10 takes the rest.
- **All in year 10:** w₁₀ = B₁₀.
- **Tax:** the year's federal tax with the withdrawal minus without (`core/math/tax.js` `federalTax`, with the
  household's other income from the tax projection).
- **New table:** the Single Life Table (Reg. 1.401(a)(9)-9(b)), copied at build from IRS Publication 590-B, Appendix B,
  Table I, into `core/math/rmd.js` as `SINGLE_LIFE`. This is a US government work and a public fact.

Sources (read 2026-11-13): T.D. 10001 (final regulations, July 2024; applies from 2025). Beneficiaries of an owner who
had begun required withdrawals take yearly withdrawals in years 1–9 and empty the account by year 10. Penalty relief
covered 2021–2024. Read from summaries (Kiplinger, Grant Thornton); cite the Federal Register text at build.

**Tests:**
1. The even plan empties exactly in year 10.
2. The required plan uses the table and ends in year 10.
3. The tax differences.
4. Roth gives tax 0.
5. The eligible-heir note.
6. Invariance for other kinds.

**Who.** claude-b (`estate/inheritance`, B, opt C18; `core/math/rmd.js`).

### #37 Budget your way (H1, H2, H9, H10, H5)

**Where.** Budget (`cashflow/budget`) › "Set my own numbers" › "How you budget": "Envelopes" (today) / "Every dollar a
job" / "Three numbers".

**By default.** "Envelopes", unchanged.

**On request.**
- **Every dollar a job:** the headline is "$240 still to give a job this month" (one sentence per case: to give,
  all given, given more than you have).
- **Envelopes options:**
  - "Overspending comes out of next month" (tick)
  - "Move money" on each envelope (outlined; from, to, amount)
  - "Hold for next month" ($)
- **Three numbers** (Monarch's "flex" view as the reference): fixed, flexible and once-a-year, as three tiles, each
  against its plan.

**Inputs.** A new optional section, `budgetPlan?: { method: "envelopes"|"zero"|"three", carryOver?: true, moves: [{
id, month, from, to, amount }], hold: { "YYYY-MM": amount } }` (Budget, #37).

**Formulas.**
- To assign = take-home this month + held from last month − Σ envelopes.
- An envelope's money this month = budget + rollover + moves in − moves out − (carryOver ? last month's overspend : 0).
- Three numbers: fixed = Σ `essential` expenses; once a year = Irregular expenses' monthly; flexible = the rest.

**Tests:**
1. Each formula.
2. Moves add to zero.
3. The carry.
4. The default is identical.
5. The case sentences.

**Who.** claude-b (`cashflow/budget`). It comes after #5 and #24, which touch the same files.

### #38 Money before 59½ (D3, D9)

**Where.** A new page, `retirement/early-access`, "Money before 59½". It is linked by "More on this" from Will the
money last? only when someone retires before 59½. The engine charges the 10% in the projection.

**By default.** One sentence per case:
- "You retire at 52. Until 59½ the plan uses cash and taxable savings: enough for 7 years."
- "The plan takes $90,000 from your 401(k) before 59½; the extra 10% tax costs about $9,000."

Three rows of ways around it:
- "Leave your job in or after the year you turn 55 (that job's 401(k) only)"
- "A Roth conversion ladder (each conversion waits five years)"
- "Equal yearly payments from an IRA (72(t)): about $28,000 a year"

**On request.** The 72(t) part (own):
- the account
- the method chips: "Same each year" (amortization) / "Recalculated each year" (the required-withdrawal method)
- "The rate": up to 5%

It then shows the yearly payment and the rule that it must run to the later of five years or 59½.

**Inputs.** `retirement.early?: { sepp?: { accountId, startYear, method: "amortization"|"rmd", rate } }` (Money before
59½, #38; optional).

**Formulas.**
- **Engine** (`core/math/retirement.js`): a deferred-bucket withdrawal in a year when its owner is under 59½ adds
  10% × that amount to the year's tax. The exceptions:
  - the owner left the job at 55 or later, for that job's 401(k) (the Federal estimate's `leftWorkAt55` rule in
    `taxes/federal/known.js` decides it)
  - 72(t) payments
- **72(t) amortization:** P = B × r ÷ (1 − (1 + r)^(−n)), with n = the Single Life Table factor at the starting age
  (#36's table).
- **The "rmd" method:** Bₜ ÷ factorₜ, recomputed each year.
- **The rate:** at most the greater of 5% and 120% of the federal mid-term rate for either of the two months before the
  first payment.
- **Changing the payments early** (before the later of five years and 59½) brings back the 10% on every earlier
  payment, plus interest.

Sources: IRS "Substantially equal periodic payments" FAQ (updated 2026-07-23) and Notice 2022-6, read 2026-11-13.

**Tests:**
1. 10% only on deferred draws under 59½.
2. The age-55 exception.
3. $500,000 at 5% with n from the table gives the hand-computed P.
4. The rmd method recomputes.
5. The continuation rule's words.
6. Invariance: no one under 59½ drawing means identical.

**Who.** claude-b: a new page plus the engine and `projection/compute.js` (`buildInputs` passes the age-55 flag and
`sepp`). It comes after #36 (table) and is not in #26's batch.

### #39 Ask the plan proposes a change you can apply (A18)

**Where.** Ask the plan (`ai/assistant`). It shows only while the helper answers, as the page does today.

**By default.** Unchanged.

**On request.** When a reply implies a change ("what if we spend $6,000 a month?"), a proposal card follows it:
"Change: retirement spending $6,500 → $6,000 a month. With it, the money lasts to 91 (now 87). [Apply] [No thanks]".
Apply is outlined, then a green line and Undo.

**Formulas.**
- The model returns `{ lever, value, personId? }` only from a whitelist: Scenario compare's `LEVERS` keys plus #1's
  kinds.
- The app checks the range, then computes the effect itself (`applyChanges` + `project()`). The model's own figures are
  never shown as the effect (rule 5).

**Tests:**
1. An unknown lever is refused.
2. An out-of-range value is refused.
3. The effect equals Scenario compare's.
4. Apply writes one field.
5. With the helper off, there are no cards.

**Who.** claude-b (`ai/assistant`, B, opt C19).

### #40 State income tax by brackets, now and in retirement (P13, D5)

**Where.**
- A new shared table, `core/math/state-tax.js`.
- Tax year by year (`taxes/projection`) gains a state line in retirement years.
- `cashflow/budget-percent` `yearTaxes` uses brackets when no state figure is typed.
- State (`taxes/state`, claude-a's folder) gets the choice "Work it out from my state's brackets": hand-over item A2.

**By default.**
- Unchanged where a figure is typed or last year's return is used.
- Where the state figure is our guess, a state in the table is worked out from its brackets, and the guess mark stays.

**On request.** "How this is worked out" on Tax year by year names the state rules used, for example "New York: pension
exclusion of $20,000 a person; Social Security not taxed".

**Inputs.** None new.

**Data.**
- Stage 1: the ten most populous states with an income tax (California, New York, Pennsylvania, Illinois, Ohio,
  Georgia, North Carolina, Michigan, New Jersey, Virginia).
- For each state:
  - the 2026 brackets per filing status
  - the standard deduction or exemption
  - whether Social Security is taxed
  - the main retirement-income exclusion
  - the source URL and the read date
- Flat-rate states are one rate.
- Index: Tax Foundation, "State Individual Income Tax Rates and Brackets, 2026", read 2026-11-13: seven states have no
  income tax, and New Hampshire and Washington tax only investment income; top rates are CA 13.3%, HI 11%, NY 10.9%,
  NJ 10.75%; eight states cut rates on January 1, 2026. Each state's
  figures come from its own revenue department at build.

**Formulas.** Graduated tax = Σ over brackets of rate × (min(income, top) − bottom), on state taxable income =
federal AGI ± that state's main adjustments (stated per state).

**Tests:**
1. Per state, one worked example from that state's own instructions.
2. Flat states.
3. No-tax states give 0.
4. Social Security exempt where stated.
5. A state outside the table falls back to today's flat guess (identical).

**Who.** claude-b (`core/math/state-tax.js`, `taxes/projection` (B, opt C12), `cashflow/budget-percent`).
`taxes/state` is claude-a's: hand-over item A2. Size L, in stages, ten states first.

---------------------------------------------------------------------------------------------------------------------

## 5. Build batches

**Before batch 1:**
- Wave 1 is on the shared branch and through the main gate.
- Opt C1 (`core/ui/more.js`, `docs/OPTIONAL.md`) and C2 (the first-view check) have landed.

**Every batch:**
- Each commit gets its own worktree, branched from the branch tip at the batch's start.
- No two commits in a batch touch the same file, except the append-only shared docs (`CHANGELOG.md`,
  `docs/DATA_MODEL.md`, `docs/MODULE_CATALOG.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`) and the generated
  `modules/registry.js`. Those are merged by the workboard's conflict table: keep both lines, then
  `npm run registry`.
- Commits land one by one with `git pull --rebase` and the full checks. `main` moves after each batch through the
  main gate.

**The sliding rule.** A gated commit whose gate is still closed when its batch starts moves to the next batch. Any
later commit that shares its files moves with it, in order. The rest of the batch goes ahead.

**Batch 1: the plan your real life, a first answer, faster debt, money this week, bills, claiming (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 1.1 | #1 Things that will happen | new `modules/retirement/happenings.js`; `modules/retirement/projection/{compute.js,view.js,README.md,module.test.mjs}` | L2, L4, L5 landed; a line to claude-e |
| 1.2 | #2 Three boxes | `modules/overview/quick/*` | - |
| 1.3 | #3 One-time debt payments | `core/math/payoff.js`; `modules/debt/payoff/*`; one line in `modules/insurance/life-needs/compute.js` | - |
| 1.4 | #5 Safe to spend | `modules/cashflow/budget/*` | - |
| 1.5 | #6 Bill changes | `modules/cashflow/recurring/*`; `modules/cashflow/subscriptions/{view.js,README.md,module.test.mjs}` | - |
| 1.6 | #7 Claiming ages | new `modules/retirement/claiming/*`; `modules/retirement/social-security/{view.js,compute.js}` (one links row; `pairYears` if needed) | - |

**Batch 2: retirement spending, this phone, the family packet, yearly bills, trends, the will worksheet (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 2.1 | #4 Spending in retirement | `core/math/retirement.js`; `modules/retirement/projection/*`; `modules/retirement/withdrawal-strategy/*` | after 1.1 |
| 2.2 | #8 then #9 (two commits, one worktree) | `core/format.js`; `core/app.js`; `index.html`; `core/ui/base.css`; `modules/system/settings/*`; `docs/DESIGN_LOG.md` | wave 1; opt C7 |
| 2.3 | #11 Family packet | new `modules/reports/if-something-happens/*`; one links row each in `household/documents`, `household/contacts`, `estate/beneficiaries`, `estate/digital` views | - |
| 2.4 | #12 Set aside per bill | `modules/cashflow/sinking-funds/*` | - |
| 2.5 | #13 Twelve months, watch a shop | `modules/cashflow/spending/*` | - |
| 2.6 | #14 Will worksheet | new `modules/estate/will-worksheet/*`; one links row in `modules/estate/legacy/view.js` | the request's `estate/legacy` part landed (else the row waits) |

**Batch 3: health costs, estimated tax, HSA, caution, credit, try before saving (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 3.1 | #10 Health costs grow | `modules/system/assumptions/*`; `modules/retirement/healthcare/compute.js`; `modules/retirement/medicare/compute.js`; `modules/retirement/projection/compute.js` (health line) | L5 |
| 3.2 | #15 Estimated payments | `modules/taxes/estimated/*` (new `data/rates.js`); `modules/household/calendar/{compute.js,module.test.mjs}` | - |
| 3.3 | #16 HSA receipts | `modules/taxes/hsa-fsa/*` | - |
| 3.4 | #17 How careful | `modules/retirement/careful.js`; `modules/retirement/monte-carlo/*` | - |
| 3.5 | #18 Credit score | new `modules/debt/credit-score/*`; one links row in `debt/ratios/view.js` and `debt/credit-cards/view.js` | - |
| 3.6 | #19 Try before saving | `modules/retirement/levers.js`; `modules/retirement/projection/view.js` | L2; after 2.1 |

Check: 3.1 edits projection `compute.js`, 3.6 edits projection `view.js` and `levers.js`, and 3.4 edits `careful.js`
(the projection view imports it but is not edited by 3.4). There is no shared file.

**Batch 4: pretend family, ages, couples, tax forms, split, versions (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 4.1 | #20 Pretend family | `core/store.js`; new `core/demo/*`; `modules/system/help/*` | - |
| 4.2 | #21 A row per age | `modules/scenarios/goal-seek/*` | L1 |
| 4.3 | #22 Sharing costs | new `modules/cashflow/shared-costs/*`; one links row in `cashflow/budget-percent/view.js` | - |
| 4.4 | #23 Tax forms reader | `modules/ai/reader/*` | L7 |
| 4.5 | #24 Split and tags | `transactions/ledger/*`; `transactions/rules/*`; `transactions/categories/compute.js`; `cashflow/spending/compute.js`; `cashflow/budget/compute.js`; `cashflow/income-statement/compute.js`; `cashflow/budget-percent/compute.js` (if it sums by category); `reports/annual-review/compute.js`; `reports/export/compute.js`; their tests | - |
| 4.6 | #25 Make it my plan | `modules/scenarios/compare/*` | after 1.1, 2.1 |

Check: 4.3 touches the budget-percent view and 4.5 its compute. That is the only near-miss, and they are different
files.

**Batch 5: conversion lines, Social Security cases, methods, debt progress, W-4, guardrail nudge (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 5.1 | #26 Conversion ceilings | `core/math/retirement.js`; `modules/retirement/roth-conversions/*` | after 2.1 |
| 5.2 | #27 Social Security cases | `modules/retirement/social-security/*`; `modules/insurance/life-needs/compute.js` (the higher earnings-test limits) | after 1.6 |
| 5.3 | #28 Methods page | new `modules/system/methods/*`; `core/ui/more.js` (the "All our methods" line) | - |
| 5.4 | #29 Against the debt plan | `modules/debt/payoff/*` | after 1.3 |
| 5.5 | #30 W-4 sheet | `modules/taxes/withholding/*` | - |
| 5.6 | #31 Guardrail nudge | `modules/retirement/withdrawal-strategy/*` | after 2.1 |

**Batch 6: line options, imports, fees, path, inherited IRA, Ask proposes (6 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 6.1 | #32 Line options | `transactions/ledger/*`; `transactions/categorize/*` | after 4.5 |
| 6.2 | #33 Other apps' files | `modules/transactions/import/*` | L8 |
| 6.3 | #34 Plan and trading fees | `modules/investments/fees/*` | - |
| 6.4 | #35 Against last year's path | `modules/balance/net-worth/*`; `modules/reports/annual-review/{view.js,compute.js}` | after 4.5 (annual-review compute) |
| 6.5 | #36 Inherited IRA | `modules/estate/inheritance/*`; `core/math/rmd.js` | - |
| 6.6 | #39 Ask proposes | `modules/ai/assistant/*` | after 1.1 (its kinds) |

**Batch 7: budget styles, money before 59½, state brackets (3 commits)**

| commit | design | files | gate |
|---|---|---|---|
| 7.1 | #37 Budget your way | `modules/cashflow/budget/*` | after 1.4, 4.5 |
| 7.2 | #38 Money before 59½ | new `modules/retirement/early-access/*`; `core/math/retirement.js`; `modules/retirement/projection/compute.js` | after 5.1, 6.5 |
| 7.3 | #40 State brackets, stage 1 | new `core/math/state-tax.js`; `modules/taxes/projection/*`; `modules/cashflow/budget-percent/compute.js` | - |

Every batch's last step: a sandbox walk of the batch's pages at 390 px (the opt spec's acceptance-walk style, the
invented households), one `CHANGELOG.md` summary check, and a workboard status line.

---------------------------------------------------------------------------------------------------------------------

## 6. Hand-overs and messages

### claude-a: one file, `docs/handoffs/2026-11-13-gaps-claude-a.md`

claude-a's 13 folders are never edited. The file uses the form of `docs/handoffs/2026-11-11-touch-claude-a.md`: "How
to work through it" on top, then per item "To see it", "Should", "Where" with file and line. A workboard line
`claude-b -> claude-a` points to it.

| item | folder | should | after |
|---|---|---|---|
| A1 | `balance/projection` | (1) pass `pay.lumps` to `payoffPlan` (`compute.js` line 39) so the debt-free date agrees with Pay off debts (#3, R4-18); (2) read `retirement.happenings` through `modules/retirement/happenings.js` so Net worth ahead shows a home sale, money in or out and goals in their years (#1, and map G10) | 1.1, 1.3 |
| A2 | `taxes/state` | a `choice()` "Work it out from my state's brackets" beside last year's return and the flat rate, reading `core/math/state-tax.js`, with its "How this is worked out" naming the state rules | 7.3 |
| A3 | `goals/charitable` | nothing to change; the list of gifts (map W5) and a donor-advised fund (D11) are in section 7, rows 41 and 27, for whenever claude-a returns | - |

### claude-f: a workboard line first

claude-f's overview claim of 2026-11-11 is older than a day and its session is stopped. claude-b uses opt C20's
method:
- It posts one line `claude-b -> claude-f, claude-r` with the suggestions below.
- If nobody answers within a day and the claim is still stale, claude-b claims the named files in `docs/TEAM.md` and
  builds them in batch 7 or later.
- No Dashboard row is added: its rows are the owner's (N8).

| item | page | suggestion |
|---|---|---|
| F1 | `overview/monthly-review` | a row "Safe to spend this week: about $310 ›" linking to Budget (#5) |
| F2 | `overview/alerts` | quiet items: "A bill went up" (#6), "An estimated payment is due in 7 days" (#15), "Your guardrail says trim spending" (#31) |
| F3 | `estate/documents` | "More on this" rows: "If something happens to us ›" (#11), "Choices to take to a lawyer ›" (#14) |
| F4 | `overview/start` | one quiet row "Just looking? See a pretend family's plan ›" (#20) |
| F5 | `overview/monthly-review` (only if it sums categories itself) | read `linesOf` (#24) |

### Others

- **claude-e:** a workboard line before 1.1, 2.1 and 3.6 touch `retirement/projection/view.js` (its careLine item, per
  claude-b's message of 2026-11-11 22:20).
- **claude-h:** none. No design edits `investments/holdings` or `tax-lots`.
- **codex:** none. `transactions/connect` and `system/devices` are untouched.
- **The designer:** the drawer row (#8), the text and theme tokens (#9) and every new page are reviewed in the next
  design review. Each gets a "Builder chose" entry, and none overrides a DESIGN_LOG decision.

---------------------------------------------------------------------------------------------------------------------

## 7. The next 60 (one line each: the gap, map lines, where, size)

1. Refinance: points against a lower rate, costs rolled in, lender credits, two offers side by side (V7). Refinance,
   M.
2. Lock the copy on this phone with a passphrase (WebCrypto AES-GCM, a key from the passphrase), with plain words on
   what is lost if it is forgotten (X4). Settings and `core/store.js`, M.
3. Your state's 529 tax break as a box with a labelled example and the state rate (U4). Education (529), S.
4. Save for college or borrow; saving for school before college (U5, U6). Education (529), M.
5. Expected college aid from the federal formula for 2027–28, sourced each year (U7). Education (529), M.
6. A self-employed write-off checklist; business costs from the ledger's tagged lines (P10, P11). Small business, S–M.
7. This year's realized gains from the lots; one page for the accountant (O9, O28). Tax lots and Tax report, M.
8. Dividends actually received, a month-by-month calendar, yield on cost (O24). Dividends, M.
9. Mine, yours, ours: a person filter on spending and accounts; a read-only device (A22, A23, L2). Ledger, Net worth;
   Devices is codex's placeholder, M.
10. Choose and order what the Dashboard shows, within the owner's rows (A30). claude-f's lane, M.
11. One figure or itemized, per section of Income and Net worth (A32). S–M.
12. A chance of reaching each goal on time (map G7). Goals, M.
13. A two-minute lesson behind each Glossary word (A27). Glossary, M.
14. A five-question risk check that suggests a stock share, labelled "information, not advice" (map G4). Stocks by age,
    S–M.
15. Who gets what, as one picture (T6). Legacy goals, M.
16. Sub-categories, and merging two categories (I1). Categories and every reader, M.
17. Split a bill with other people; who owes whom (I7). Ledger or a new page, M.
18. Several currencies with one total in yours, and currency gains (N3). L.
19. A part share of an account (owned 50/50 with a sibling); a trust as owner (N4). Every balance reader, M.
20. Rental books from the ledger and a Schedule E layout (V1). Rental analysis, M–L.
21. More named withdrawal rules (endowment, 95% rule, CAPE-based), one plain line each (C3). How much to take out and
    the engine, M.
22. Take from every account in proportion (C8). Withdrawal order and the engine, S.
23. One search over withdrawal order, conversions and gain harvesting together (C9). L.
24. A flow picture of where each year's money goes (C11). Cash-flow statement, M.
25. Gains taken at 0% across several low-income years (D10). Tax year by year, M.
26. Moving money between accounts in the plan, as a kind of #1 (D16). S.
27. A donor-advised fund: the deduction now, the gifts later (D11). Giving (claude-a), S.
28. After-tax 401(k) money into Roth (the "mega backdoor") (D4). Contribution limits, S.
29. The alternative minimum tax in the Federal estimate beyond stock options (D8). M.
30. Deferred compensation plans and the years they pay out (D14). Equity compensation, M.
31. Retire when savings reach a figure, not at an age (A8). Goal seek, M.
32. Shape a single year by hand (A10). Year by year, M–L.
33. Share a calculator's inputs by a link that sends nothing anywhere (the address only) (A21). Calculator pages, M.
34. Edit a list like a spreadsheet (A33). L.
35. Resampled history and random inflation in the simulated markets (B3). Chance the money lasts, M.
36. A picture of the spread of outcomes; every run as a file (B6, B7). Chance the money lasts and Export, S.
37. Money and the odds of living, in one view; which accounts count toward the answer (B8, B14). S–M.
38. More ready-made mixes (three-fund, golden butterfly), once the asset-class history has a free licence (map G2).
    Backtest, M.
39. Your own charts and saved reports (map G15). L.
40. A budget per paycheck; start the budget over and keep the history (H14, H15). Budget, M.
41. A list of gifts to charity for tax time, with the receipts rule (W5). Giving or Gifting, S.
42. Rules on amounts and patterns, several actions, an order; merging payee names (I4, I5). Rules, S–M.
43. QIF files and European CAMT.053 files (J3, J4). Import, S each.
44. Your own labels on accounts and holdings ("kids", "retirement") (N5). S.
45. Private investments with their own return and capital calls; gold by weight; staking income (N9, N10, N15). S–M.
46. A crypto lot method and a Form 8949 file (N16). Crypto, M.
47. Buy and sell history from the broker's file (O2). Holdings (claude-h's review lane first), M.
48. Period chips, my own dates and my own benchmark for returns; which holdings drove the result (O6, O12, O7).
    Performance, M.
49. Region, sector and fund look-through, typed in (O15, O16). Allocation, M.
50. Try a trade and see the new mix; rebalancing against buy-and-hold in history (O22, O23). Rebalance, Backtest, S.
51. A file for tax software (O32). Export, M.
52. A backtest with money added and taken out; rolling returns, Sharpe ratio, correlation (O34, O35, O36). Backtest,
    Risk, M.
53. The rate that never touches the starting money; years to independence at each saving rate (O37, O38). If history
    repeated, Financial independence, S each.
54. Choose which shares to sell first (oldest, costliest, specific) (O29). Tax lots, S.
55. Long-term care costs by state, sourced and dated (F4). Long-term care, S.
56. A dated home maintenance log; electric against gas for your miles (check whether any federal credit remains) (V3,
    V9). Home, Vehicles, S each.
57. Children's allowance and their own money (U10). New page, M.
58. The helper's tone (gentle, plain, blunt); a partner's comment on a transaction (X8, X9). Settings, Ledger, S each.
59. Velocity banking explained (why it rarely helps); a debt plan from a spoken description (Q9, Q13). Glossary, Voice
    notes, S each.
60. Other countries' taxes and pensions; a documented household API on the PC; the AI reading a will as a checklist
    against the plan, labelled "not legal advice" (D17, X2, T7). L, M, M.

---------------------------------------------------------------------------------------------------------------------

## 8. Dropped: what the promise or the repo rules forbid

The promise is "No bank logins or account numbers, ever". Each line below says why it is dropped and what fits
instead.

| map line | what | why dropped | the fit, and whether it exists |
|---|---|---|---|
| A16 | link a bank or broker for balances, transactions, holdings, bill and pay detection | BANK | have: CSV import, Statement reader, Update my balances, the positions file; soon: OFX/QFX/QBO (L8), pay stub (L7). `transactions/connect` (SimpleFIN) stays a placeholder until the owner says yes |
| N15 | wallet and exchange sync, DeFi, NFTs | BANK, FEED | have: typed coins |
| V2 | rent collection, rental bank feeds | BANK, TRADE | have: rent typed on Rental analysis |
| K7 | pay bills from the app | TRADE | have: due dates on Money calendar and Bills |
| M2 | round-ups, automatic transfers | TRADE | have: the monthly amount on Goals; a one-line "set this up at your bank on payday" note can ride with any Goals commit |
| O21 | done-for-you investing (rebalancing, harvesting, direct indexing, bond ladders, credit lines) | TRADE, ADVICE | have: the lists of what to do (Rebalance, Tax lots, Asset location, Giving) |
| A29, T4, O40 | a planner, CPA or attorney acting for you; advisor tools | ADVICE | have: Advisor's plan, Contacts; new: #14 worksheet |
| T1 | a will or trust written for you | ADVICE (a legal document service) | new: #14 "Choices to take to a lawyer" |
| S3 | live quotes from insurers | FEED, ADVICE (licensed agents) | have: typed quotes compared |
| S2 | a rough premium from a quote engine | FEED (proprietary rate tables) | have: typed prices; dropped until a free, citable rate table exists |
| R1 | bureau scores, monitoring, simulator, offers | FEED | new: #18 typed score |
| O3, O8, O13, O17, O25 | live prices, why it moved today, trades against indexing, style box, ratings and screeners | FEED | have: a typed price with its date; Performance against an index (O11) |
| N7 | home and car values filled in | FEED | have: a typed value; Our guesses grows the price paid with the state's house price index |
| U2 | look up a school's cost | FEED | have: a typed yearly cost per child |
| K5 | cancel subscriptions for me | SERVICE | have: Subscriptions' line "You cancel with the company itself" |
| K6 | a company negotiates bills | SERVICE | new: #6 "How to ask for a lower price" |
| A34 (email part) | an emailed recap | SERVICE | have: Monthly check-in |
| N19 | a "dead man's switch" that emails the family | SERVICE | new: #11 printable packet |
| N20 | a public portfolio page | SERVICE (a public server against the private design) | none, by design |
| X1 | push notifications | SERVICE (a browser vendor's push service; the phone copy on GitHub Pages has no server of its own) | have: Needs attention and the calendar file; new: #15's reminder in the file |
| X5 | home-screen widgets | not possible for a web app | the app installs to the home screen |
| A19, I11 | the actual files (statements, receipts) kept with the plan | the Document vault's own rule ("never the paper or its numbers") and the readers that keep nothing | have: where each paper is kept |
| any | pasting GPL or AGPL code (Firefly III, Ghostfolio, GnuCash) | the repo is MIT and public | references and facts only, as AGENTS.md rule 11 says |
| any | real names, balances, account numbers in fixtures or docs | the public repo and the leak guard | invented households in `qa/` |

---------------------------------------------------------------------------------------------------------------------

## 9. Figures checked on the web (2026-11-13)

"Primary" means the publisher's own page. "Secondary" means a summary that cites it; those are re-checked at build.

| # | figure or rule | used in | value | source | kind |
|---|---|---|---|---|---|
| 1 | retirement spending falls with age | #4 | about 1% a year real on average | Blanchett, JFP 27(5) May 2014 | secondary summaries (retirementresearcher.com) |
| 2 | default and range for that decline | #4 | ~1% a year, sensitivity 0–2% | Tharp, SocArXiv ctu3g (2026), abstract | primary (RePEc listing) |
| 3 | 72(t) methods, rate, continuation, recapture | #38 | greater of 5% or 120% of the federal mid-term rate; to the later of 5 years and 59½ | IRS "Substantially equal periodic payments" FAQ, updated 2026-07-23; Notice 2022-6 | primary |
| 4 | inherited IRA yearly withdrawals in the ten years | #36 | yes when the owner had begun; applies from 2025; relief 2021–2024 | T.D. 10001 (July 2024) | secondary (Kiplinger, Grant Thornton, Voya) |
| 5 | credit freeze free, fraud alert lengths | #18 | free since 2018-09-21; 1 year; extended 7 years | FTC consumer alert "Free credit freezes are here" (Sept 2018) | primary |
| 6 | free weekly credit reports | #18 | permanent since Sept 2023 | FTC consumer alert (Oct 2023); CDIA release 2023-09-18 | primary |
| 7 | dispute timing | #18 | 30 days; 45 with more information or after the free annual report; 5 business days to report | CFPB "How long does it take to get a response to a dispute" | primary |
| 8 | FICO bands | #18 | 300–850; <580, 580–669, 670–739, 740–799, 800+ | myFICO "Understanding FICO Scores" | primary |
| 9 | earnings test limits | #27 | 2026 $24,480 / $65,160; 2027 $25,560 / $67,920 | SSA "2027 Social Security Changes" fact sheet (Oct 2026) | primary via search; the lower two already in the code |
| 10 | 2027 COLA (context) | #7, #27 | 3.6% | same | primary |
| 11 | divorced-spouse conditions | #27 | 10 years married; unmarried; 62; divorced 2 years if the ex has not filed | POMS RS 00202.005, TN 50 (10-26), effective 2026-10-21 | primary |
| 12 | children of a retired worker | #27 | up to ½ of PIA each, within the family maximum | AARP, Kiplinger summaries of SSA | secondary |
| 13 | IRS underpayment rate | #15 | 7% for Oct 1–Dec 31, 2026; 2027 Q1 not yet published | IRS newsroom; Rev. Rul. 2026-15 | primary |
| 14 | 2026 W-4 | #30 | Step 4(b) worksheet of 15 lines with P.L. 119-21 deductions; Step 3 $2,200 a child | Experian employer blog, Patriot Software | secondary |
| 15 | 2026 W-4P | #30 | "no withholding" box; same new deductions | APA PayNews, Bloomberg Tax, payer copies | secondary |
| 16 | 2025 Form 1040 lines | #23 | AGI 11a/11b; taxable income 15; total tax 24 | IRS MeF test scenarios for tax year 2025 | primary |
| 17 | HSA pay-back rule | #16 | no deadline; expense after the HSA was set up; keep records | IRS Pub. 969 | secondary |
| 18 | health spending growth | #10 | 5.4% a year 2025–34 against 4.1% GDP; Medicare 7.7% | CMS OACT, Health Affairs 2026-06-24 | secondary reports of the release |
| 19 | larger marketplace credits | #26 | expired end of 2025; Senate extensions failed 2025-12-11; House 3-year extension passed 2026-01-08; no law found | Healthcare Dive, Ballotpedia, Becker's, Health Affairs Forefront | secondary |
| 20 | state income tax index | #40 | 7 states no income tax (NH and WA tax only investment income); CA 13.3%, HI 11%, NY 10.9%, NJ 10.75% top rates; 8 states cut 2026-01-01 | Tax Foundation, State Individual Income Tax Rates and Brackets, 2026 | primary index; per-state figures at build |
| 21 | YNAB and Monarch export columns | #33 | as listed in #33 | npm parse-ynab-export; beancount.io converters | secondary |
| 22 | first steps after a death | #11 | SSA reporting, $255 payment, one bureau tells the others | Experian checklist, Iowa Attorney General, SSA contact numbers in several checklists | secondary |
| 23 | Open Social Security's licence | #7 | could not be read (no GitHub access this session) | - | reference only, no code |

Figures already in the code and reused as they are, with their own read dates:
- the IRMAA 2026 tiers (CMS, read 2026-10-31)
- the ACA 2026 table (Rev. Proc. 2025-25, read 2026-10-31)
- the Social Security factors and family maximum (POMS, read 2026-10-31)
- the home sale defaults and the §121 exclusion
- Damodaran's 1928–2025 history

---------------------------------------------------------------------------------------------------------------------

## 10. Risks

| # | risk | what limits it |
|---|---|---|
| 1 | The retirement request's L steps land late, holding #1, #4, #19 and #10 | the sliding rule (section 5); batch 1's other five commits do not depend on them |
| 2 | #1 changes the main answer for households that type a happening, and other pages must agree | one path: `buildInputs` carries them, so Chance, History, Goal seek and the reports agree; A1 covers Net worth ahead; the invariance test proves no change without happenings |
| 3 | #3's lumps change the debt-free date on pages outside Pay off debts | all pages read the payoff compute; life-needs passes `pay.lumps` in the same commit; A1 for claude-a |
| 4 | #8's text-node mask hides a figure that is not money, or misses one | the pattern needs a currency sign; tests for years and percents; the format flag covers everything drawn on the phone |
| 5 | #9's larger text breaks layouts | the browser check at 320 px with "Largest" before landing; 44 px taps checked |
| 6 | #7 gives a confident pair the person reads as advice | the close-call sentence, "How this is worked out" with the odds of living, and the person's own discount and health choices |
| 7 | AI designs (#23, #39) let a model's number into the plan | whitelists, ranges, the effect computed by the app, a tap to apply, Undo |
| 8 | The state table (#40) goes stale each year | read dates per state; a test that fails when the newest year is older than the current tax year; the fallback is today's flat guess |
| 9 | Secondary sources were wrong (section 9, "secondary") | each is marked; the build step re-reads the primary page and records its date in the README |
| 10 | Several batches touch `core/math/retirement.js` | it is touched only in 2.1, 5.1 and 7.2, in three different batches, each with the invariance test |
| 11 | Pages grow past the opt spec's budgets | every addition sits behind a row or a "More details (optional)"; the first-view check's only-down counts catch it |
| 12 | claude-f never answers | opt C20's stale-claim rule; no Dashboard change either way |

---------------------------------------------------------------------------------------------------------------------

## 11. Files

| what | where |
|---|---|
| this spec | `$SP/gap/spec.md` |
| the map and its corrections | `$SP/gap/map.md`, `$SP/gap/map-check.md` |
| the research | `$SP/gap/research-plan.md`, `research-cash.md`, `research-invest.md`, `research-life.md`, `research-ux.md` |
| the simple-first spec this follows | `$SP/opt/spec.md` |
| the retirement request (gates L1–L8) | `$SP/rv/spec.md` |
| wave 1 (gate) | `$SP/w1/integ` |
