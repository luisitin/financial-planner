# Pages report: "here are the numbers that drive this; check them, change them, see what changes"

Repo `$REPO`, branch `claude/creative-build-b531q0`, tip `fe678cb`. Read only, nothing in the repo was
edited. Each claim gives its file:line.

How the evidence was gathered:
- I read the code and READMEs of every page named in the task.
- I walked one short household on a 390 px phone, in the sandbox, against a read-only copy of the tip
  (`scratchpad/rv/pages-app`, served on port 9637 and then stopped). Script: `scratchpad/rv/pages-walk/walk.mjs`.
  Log and screenshots: `scratchpad/rv/pages-walk/out/`.
- I reused the page texts from the sibling walk (`scratchpad/rv/walk/out/walk-*.json`, same tip). Its households are the
  invented ones in `scratchpad/rv/walk/build.mjs`.
- I worked out each lever's effect with the existing pure computes only (`scratchpad/rv/pages-walk/levers.mjs`) and timed it.

The household used throughout is **noContrib**: "Casey". Casey is 47, earns $72,000, has one child and a 401(k) at work with
$48,000 in it. The Get started box for "what goes in" was left empty. The plan **runs out in 2046 (age 66)**.

---

## 1. Short answers

1. **Several pages already do part of the owner's ask, but no page does all of it, and none sits where the verdict is.**
   - *Will the money last?* lists every input under "What goes into this", each with a link to its page. That list starts
     about two screens below the verdict (page y 1550 on an 844 px screen).
   - *Goal seek* says what each lever would have to be.
   - *Sensitivity* ranks inputs by how much a nudge moves the answer. No page links to it (the Glossary lists it but never
     shows it).
   - *Assumptions* shows each default and "Changed from defaults: 0". It does not show any effect.
   - *Your plan* has "What we're counting on": 4 of the assumptions, folded, with no effect shown.
   - *Retirement contributions* shows the new verdict after a save, but not the old one.
   - *Document reader* turns a pasted pay stub or statement into "before and after" proposals.

   **No page asks "is this figure right?"** before it tells a person what to change. **No page marks an input as yours, our
   estimate, or the usual figure** in one list.
2. **The lever logic is written four times over.** Sensitivity, Goal seek, Compare and Advisor's plan each change one input
   at a time on the same engine, each with its own list of inputs. None of the four lists has the employer match, the money
   left over each month, or the Roth vs pre-tax split. The assumptions are shown in five places, and "is this ours" is
   tracked by two separate systems.
3. **Where a short household is sent today.** Every home tile and row sends it to *Will the money last?*. That page's "what
   would change it" button and the path's next step both go to **Goal seek**. Goal seek takes every input as true: Casey
   reads **"Save about $850 a month. You save nothing toward this today."** about a 401(k) that holds $48,000. The only
   place that notices the empty contribution is the "Plan my retirement" guide (move 2 on Your plan). It never checks the
   match, the assumptions or the left-over money.
4. **Big picture, then deeper, today.** Get started → 7 questions → the reveal → one page per step → *Your plan* →
   Dashboard. It breaks the owner's intent in five ways (section 5):
   - The inputs are never checked before the fixes.
   - Changing a lever means leaving the page, with no before and after.
   - The left-over money is shown as "builds up" on three home pages while the forecast ignores it.
   - The analysis pages (Sensitivity, Compare) cannot be reached from the result.
   - "Deeper" means the menu.
5. **Recommended shape: A ("Check the numbers behind this" card on *Will the money last?*), with C's one-line wording
   change.**
   - A needs one new pure file and one view, and needs **no file that someone is holding now**.
   - The live effects cost about 100-300 ms in Node for 9-10 levers, so the card is filled in after the page is drawn, as
     the careful line already is.
   - B (upgrade Sensitivity) is the "go deeper" page that the card links to.
   - C (a path step) is best kept to new words on the existing "Your retirement" step: a new step means a claude-f
     file and a DESIGN_LOG entry.

---

## 2. What the existing pages already do of the ask

The ask, split into parts: (a) say which numbers drive the answer; (b) say whose each figure is (theirs, our estimate, the
usual figure); (c) ask "can you check these?" when the answer is short; (d) let them change it; (e) show what changes.

| Page | Does today | Missing |
|---|---|---|
| **Will the money last?** (`retirement/projection/view.js`) | (a) "What goes into this" (`:205-224`): People, money today, "Added each year until retirement", income, spending, health insurance, growth and prices, taxes, each linked to its page (`linked`, `:72-76`). (c) in small print, once: "You have not entered any retirement saving (… What you save for retirement page), so the plan adds nothing" (compute `:1030`). (d) "Retirement settings" fold (`:316-357`): spending, stock share now and once retired, tax, withdrawal way, rate. | (b) none: the defaults are shown as values ("70", "50", "15"). The **spending box is empty** while the plan spends $4,400 a month, against the guesses rule "a gray figure in an empty box is what the plan counts" (`overview/guesses/README.md`). (e) none on the page. The list starts at y 1550 and the settings fold at y 2629. The hero's two buttons are outlined; there is no filled button once the verdict is known (`:176-177`). |
| **Goal seek** (`scenarios/goal-seek`) | (a)+(d) six levers, each solved alone (spending, retirement age, saving, return, lump sum, claiming age), each with a link to its home (`view.js` `GO_WORDS`, `:20`). "Room for bad luck"; how much to leave. | Takes every input as true. Saving lever: `"Save about … You save nothing toward this today."` (`compute.js:176`). No match, no left-over money, no Roth split, no check of inputs, no ours vs yours. |
| **Sensitivity** (`scenarios/sensitivity`) | (a)+(e) tornado: 9-11 inputs nudged down and up, ranked by swing in "what you can spend a month" (`compute.js:59-117`). Says "Some you choose …; some you only guess" (`view.js:66`). | **No page links to it.** The only mentions are `registry.js` and four Glossary page lists. The Glossary shows only the first 3 pages of a list (`ai/glossary/view.js:70`), and Sensitivity is 6th to 33rd in those lists, so it is never shown. The "How much you save" row exists only when some saving is already on file (`compute.js:69`), so for Casey **the one lever that matters is missing**. No match, no left-over money, no spending row (spending is the measure). Read-only (d is missing). The title "Sensitivity" is jargon (AGENTS rule 14). Heavy: 112 ms flat, 2.2 s with brackets and Roth on the PC (engine report). |
| **Scenario compare** (`scenarios/compare`) | (d)+(e) in a copy: 11 levers (`compute.js:13-26`), five starters ("Save $500 more a month", "Retire 3 years earlier", …), side by side, "Your plan itself never changes". | A copy is never made into the plan (README "Ideas: make a scenario the plan"). No ours vs yours. Linked only from Advisor's plan and Healthcare before 65. |
| **Advisor's plan** | (e) for an advisor's figures, one at a time (`effects[]`, `compute.js:37-44`), reusing Compare's levers. | Only for an advisor's figures. |
| **Assumptions** (`system/assumptions`) | (a)+(b) for 10 plan-wide numbers: value, "Default: 3.0%", "Changed from defaults: 0", a warning when a number is unusual, sources in a fold. (d) one form, "Save and mark as reviewed". | (e) none: no line on what a change does to retirement. Mixes in numbers that are not retirement levers (emergency months). "Retirement age" here is only the fallback (People holds each person's own). Every invented household has `reviewedAt` unset ("You have not looked these over yet"). |
| **Your plan** (`overview/plan`) | (a)+(b): "Make it fit you better" (3 of our guesses), "What we're counting on" fold (`view.js:153-166`: inflation, stock and bond returns, plan end age, emergency months; "These sound fine" → `applyGuesses`, which only stamps `assumptions.reviewedAt`, `setup/compute.js:2043`). Row "What would help" → Goal seek with no figure (`compute.js:163-167`). | (c) and (e) none. The fold is shut, at the end of the page, with 4 of the numbers and no effect. Has no contribution or match line. |
| **Our guesses for you** (`overview/guesses`) | (b) every ledger guess, "the ones that matter most first", a box to type the real one. | "Matter most" is a fixed `weight: "big" or "small"` label (`compute.js:704`), not measured against the retirement answer. Market figures are kept out on purpose ("planning choices, not guesses about you", README; fold `view.js:461`). A box left empty is not a guess, so Casey's empty 401(k) contribution is not listed (Casey has 1 guess: Social Security). |
| **Retirement contributions** | (d) per person, per account rows. Match question card (`view.js:146-226`). After a save the hero says the new verdict: "At this rate the money runs out at about 76: saving more is the surest fix" (`view.js:76-78`). | The old verdict is not shown (66). With one row on file it never asks about the match: Jamie (noMatch) reads "$3,000 of your own money and $0 from employers" with no "is that right?". The split between Roth and pre-tax is not explained (it takes two accounts and two rows). |
| **Document reader** (`ai/reader`) | (c)+(d)+(e) for documents: pasted pay stub, statement, Social Security statement or advisor's plan → each figure as a proposal with "before" and "after", applied one by one with "Use it". **Works with no AI** and, for pasted text, no PC. | A pay stub's 401(k) proposal needs a 401(k) contribution row to exist already (README "Edge cases"), so **it cannot fill Casey's missing contribution**. |
| **Reveal, Dashboard, Your plan rows** | Verdict tile "Short at 66 · Small changes help" → `#/retirement/projection` (`setup/view.js:1798`, `dashboard/view.js:143-144`); "Partly our guesses of …" when the verdict rests on our guesses (`setup/compute.js:505-510`). | Only one "guessed" reason is named (balance, saving or spending), and it never covers assumptions, match or the left-over money. |
| **"Plan my retirement" guide** (`overview/guide/journeys.js:283-306`) | Re-asks the inputs: birth dates, savings, spending, Social Security, **saving** (with "I'm not saving for retirement now"), pension, chance. For Casey the next step is `saving` (checked with `journeyStatus`). | Marks saving "done" as soon as one row exists (noMatch, couple2k: the next step is `pension`). No match, returns, inflation or left-over money. No effect shown. It is a separate "walk", reached as move 2 on Your plan and the Dashboard. |

The cost of one lever change today, from the phone walk (`out/walk.log`):

- From *Will the money last?*, tap the link inside the small print, fill 2 boxes on Contributions, tap Add, then Back. That
  is **5 taps and 2 pages**.
- The verdict moves from "Runs out in 2046" to "Runs out in 2056", but neither page shows the two side by side. The person
  has to remember the old one.
- The Contributions notice reads only "Contribution added."

---

## 3. What is duplicated

1. **Four "one input at a time" engines with four different lists.**

   | page | file | inputs it changes |
   |---|---|---|
   | Sensitivity | `scenarios/sensitivity/compute.js:41-42` (its own `fromInputs`/`fromPlan`) | stocks, bonds, inflation, retirement age, plan end, saving ±25%, raises, claiming age, 77% Social Security, stock share once retired, flat tax |
   | Goal seek | `scenarios/goal-seek/compute.js:110-240` (its own solvers) | spending, retirement age, saving, return, lump sum, claiming age |
   | Compare | `compare/compute.js:13-26` (`LEVERS` and `applyChanges`) | retirement age, claiming age, spending, extra saving, stock share now and once retired, stocks, bonds, inflation, fee, lump sum |
   | Advisor's plan | (reuses Compare's levers) | Compare's levers |

   Other pages reuse Goal seek's `earliestRetireAge`: the Health score (with its 115% spending) and Financial independence.

   WORKBOARD's "Shared pieces worth reusing" names Compare's `LEVERS` and `applyChanges` "for any what-if". Sensitivity does
   not use them.

   **None of the four has the employer match, the money left over each month, the Roth or pre-tax split, the cash rate, or
   health insurance.**
2. **The assumptions are shown in five places.**
   - *Assumptions*: 10 rows.
   - *Your plan*: "What we're counting on", 4 rows.
   - *Will the money last?*: the "Growth and rising prices" line, plus the settings fold. The fold holds the stock share,
     tax, withdrawal way and rate, which are retirement assumptions that are not on the Assumptions page.
   - *Sensitivity*: "now 7.0%" on each row.
   - *Our guesses*: a fold that points to Assumptions.

   Two numbers have more than one home:
   - The retirement age: Assumptions (fallback 65), People (per person) and Get started (stop age).
   - The plan end age: Assumptions, People and *How long to plan for*.
3. **"Is this ours?" is tracked twice.**
   - The guess ledger (`core/estimate`, `isGuess(path)`) feeds Our guesses, Your plan's "Make it fit you better", the
     Dashboard guess cards, the "Partly our guesses of …" tile, and the gray hints on Contributions.
   - Assumptions has its own "changed from default" count and `reviewedAt` stamp.
   - Older flags sit outside both: `guide.setup.ssWrote` and `retireAuto`.

   No list puts both side by side for the retirement answer.
4. **Six ways into "what would change it", all ending on Goal seek or the forecast:**
   - *Will the money last?*: "Could you stop sooner? What would change it ›" (`view.js:176`).
   - *Your plan*: the "What would help" row (`plan/compute.js:163-167`).
   - The path step `fix-retire` (`journeys.js:202`).
   - The reveal and Dashboard: "Small changes help" (→ the forecast).
   - The Health score hints (`goal-seek?target=last|badluck`).
   - The Contributions hero: "saving more is the surest fix".
5. **The retirement verdict is written out on 11 pages:**
   - the forecast (*Will the money last?*)
   - the Contributions hero
   - the reveal
   - the Dashboard
   - Your plan
   - Quick answers
   - the Timeline
   - the Health score
   - Goal seek's hero
   - Sensitivity's lede ("can pay for about $3,450 a month … against the $4,400 it plans")
   - Plan summary and the retirement report

   They agree. The lever card must use the same words, so it does not become a twelfth way of saying it.

---

## 4. Where a short-on-retirement person is sent today

This is noContrib, part way along the path at step 2 of 7. After the path is finished, the Dashboard's filled button becomes
`standing().moves[0]`.

| Home page | What it says about retirement | Where it sends them |
|---|---|---|
| Get started (`overview/start`) | follows the path | filled "Continue your plan: Your month" |
| The reveal (`overview/setup/done`) | tile "Short at 66 · If nothing changes · ● Small changes help" | tile → *Will the money last?*. Filled "Next: Your month ›". "What's next" lists step 5 "Your retirement" and step 6 "What would help" |
| Dashboard | row "Retirement · Small changes help · Short at 66" (`dashboard/view.js:144`) | row → *Will the money last?*. Filled "Continue your plan: Your month". Once the path is done: "Your next move: Get life insurance on Casey" (moves come from the Next best action ladder, `setup/compute.js:2390`). **Retirement is never the next move.** |
| Your plan | "In short: the money runs out at 66 …". Rows "Your retirement: Runs out at 66" and "What would help: … See them." | rows → *Will the money last?* and → *Goal seek*. "What to do next" #2: "Check your retirement step by step" (`FOCUS_GUIDE.retire`, `setup/compute.js:2199`) |
| Next best action | the usual ladder (match, debt, emergency fund, IRA, 401(k) …) | "Optional: your plan already lasts" appears only when on track (`compute.js:543`). There is no step for "you are short". |
| Will the money last? | "Runs out in 2046" + careful line + small-print note about no saving | both hero buttons outlined: "Could you stop sooner? What would change it ›" → Goal seek, and "Chance the money lasts ›". Path Next → "What would help" (Goal seek), present only when tight or short and savings are known (`journeys.js:133-145`) |
| Goal seek | "What it would take" → six cards | each card links to that lever's home page; Next → the next path step |

**The pattern.** Every road ends at the forecast, and then at "what each change would have to be". None of them asks
"did we get your numbers right?" first. The one place that would ask about Casey's saving (the retirement guide's `saving`
step) is a separate walk, second in a list behind life insurance.

---

## 5. The "big picture, then deeper" flow today, and where it breaks the owner's intent

**Today.**

1. *Get started*: "Let's build your plan", Let's go.
2. *Set up my plan*: 7 questions.
3. **The reveal** (the big picture: net worth, left over, emergency fund, retirement tiles) and "What's next".
4. The path, one page per step, each with Next at the bottom (`overview/guide/frame.js`, path mode):
   - Your month
   - Your debts
   - Emergency fund
   - Life insurance
   - **Your retirement** (*Will the money last?*)
   - **What would help** (*Goal seek*, only if tight or short)
   - Where to take money from, and The yearly amount the law requires (retired households only)
   - Home, College (only with those goals)
   - This year's tax
5. **Your plan**: the big picture again, one row per answer, then "Go to my dashboard".
6. **Dashboard**: "Your next move".
7. "Deeper" means the menu (150 pages), Quick answers, seven guides, and the "More on this" cards.

The DESIGN_LOG of 2026-11-06 fixed this as **one** path. A new step is a step of the path; no new walk.

**Where it breaks the owner's intent.**

1. **No "check these numbers" before "change your plan".** The path goes from the verdict straight to Goal seek's "what each
   change would have to be", on inputs that may be wrong.
   - Casey is told to "Save about $850 a month. You save nothing toward this today."
   - The figures the owner named (contributions, match, left-over money invested, inflation, returns) are never put in
     front of the person as "please check".
2. **Left-over money: shown as building up, counted as nothing.**
   - The reveal, the Dashboard and Your plan all say "About $9,100 a year builds up in checking and savings" (reveal pill
     "● Money to put to work").
   - The forecast's "Retirement money today" counts only the $19,000 of cash on hand, which grows at 2%. The $761 a month
     is never added (engine report `rv/engine.md`, section 1).
   - The page never says it is left out. This is the owner's "maybe we're not assuming the extra money … is invested",
     answered silently with "no".
   - Effect for Casey if it were saved until retiring: **runs out at 91 instead of 66** (`levers.mjs`).
3. **Every change happens somewhere else, and nothing shows before and after.** The levers live on 11 pages:
   - People
   - Net worth
   - Contributions
   - Work benefits
   - Social Security
   - Assumptions
   - the settings fold of *Will the money last?*
   - Expenses
   - Pensions
   - Income
   - How long to plan for

   After a change the person must go back and compare from memory (section 2: 5 taps, 2 pages). Assumptions shows no
   effect at all.
4. **The analysis pages are not part of "deeper".**
   - Sensitivity can be reached only through the menu or search.
   - Compare is linked from two side pages.
   - The forecast names "Chance the money lasts and If history repeated" as plain text with no link (`view.js:193`).
   - The retirement guide's "more" list leaves out Sensitivity and Compare.
5. **"Deeper" is not tied to what the big picture said.**
   - A Your plan row opens the same page the path showed. There is no "go deeper on this result".
   - After Your plan, the only way on is the Dashboard and the menu.
   - The owner's "once we're in the big picture, you can delve deeper and get better analytics" has no door from the
     retirement row.

---

## 6. Rules any shape must keep

**From `docs/DESIGN_LOG.md`:**
- **2026-11-06, one path:**
  - Exactly one way on per page.
  - No Next bar fixed to the bottom.
  - No second menu, no stepper beyond the bar's track.
  - **No new "walk": a new step is a step of the path.**
- **2026-11-06, the household's view:**
  - Never build, PC, AI or sync wording.
  - So a heavy card must work on the phone's static copy (GitHub Pages: no server, no AI) and must not say "worked out on
    your computer".
- **2026-09-15, Assumptions round 17:**
  - One plain line plus "Default: X" for each field.
  - Sources in one fold.
  - One filled "Save and mark as reviewed".

**From `AGENTS.md`:**
- `compute.js` is pure.
- `view.js` writes only through `store.update`, on save.
- One filled button per page.
- Records, not tables, at 390 px.
- `ui.notice` keeps `pending` to confirm on the next draw.
- No new global CSS.
- Technical parts last, folded.
- Plain words (rule 14).
- Any AI figure is applied only after a tap (rule 5).

**From the pages themselves:**
- **A verdict is never shown before it is known** (stress test HC-2, `projection/view.js:132-142`). Effects must wait the
  same way: a gray bar, then the figure (`retirement/careful.js` `whenWorked`).
- **A guess never turns anything green, amber or red by itself** (`overview/guesses/README.md`). So a lever row says
  "our estimate" in plain gray, never amber.
- **Market figures are "planning choices", not guesses about you** (same README). So a row has three kinds of figure:
  - "you said so"
  - "our estimate (we filled it in)": the guess ledger
  - "the usual figure, not looked at yet": an assumption at its default, `reviewedAt` unset

  Plus "not in the plan" for missing ones.

**Measure effects in the headline's own terms.** Use the run-out year and age, or "lasts to the end". Do not use "the most
it can pay for":
- A figure from Expenses with a loan that ends counts that loan in its "affordable" amount.
- A typed figure drops the loan schedule. In Casey's run it went from 1 loan to 0 after `saveSpendingFigure`, and
  "affordable" went from $3,445 to $2,336 a month for the same $4,400.
- So "affordable" compares two different bases.
- Any spending lever must write through `saveSpendingFigure`. claude-c (loans lane) should confirm that the box's help line
  "A loan payment in this figure still stops when the loan is paid off, whatever you type" (`view.js:331`) is true for
  Expenses-based figures.

---

## 7. Three shapes that reuse what exists

### Shape A (recommended). A "Check the numbers behind this" card on *Will the money last?*

**What the phone shows.** The card sits right under the hero when the verdict is short or tight. When the verdict is on
track it is a fold, "What drives this answer", in place of the long "What goes into this" list; the health and tax details
stay in a fold below it.

The card opens with: "A short answer often comes from a figure that is missing or rough. Check these first. Each line says
what happens if it changes (if markets do as well as average)."

It has one record per lever. Inputs that are missing come first, then the rest by size of effect. The figures below are
Casey's, worked out by `levers.mjs` with today's pure code only.

1. **What goes into Casey's 401(k): nothing on file** · *not in the plan*
   - Text: "The 401(k) at work holds $48,000 but nothing goes in. People with pay like Casey's usually put in about 6.6%
     ($396 a month): then the money lasts to **75** instead of 66."
   - Buttons: **[Type what goes in ›]** (this is the page's one filled button), [Nothing goes in], [Read it from a pay
     stub ›].
2. **The employer's match: not on file** · *not in the plan*
   - Text: "The usual match, 50 cents a dollar up to 6% of pay (about $2,880 a year), would make it last to **81**."
   - Button: [Type the match ›] (Work benefits).
3. **The $761 left over each month: not counted as saving** · *not in the plan*
   - Text: "If it went into savings until you retire, the money would last to **91**."
   - Button: [Save it each month ›]. The owner decides first; see the open questions.
4. **When Casey stops work: 65** · *you said so*
   - Text: "At 67: lasts to 74."
   - Button: [Change ›] (People).
5. **Investment growth: 7% a year** · *the usual figure, not looked at yet*
   - Text: "At 6%: runs out at 66. At 8%: at 67."
   - Button: [Check ›] (`#/system/assumptions?show=returnStocks`, which already works).
6. **Rising prices: 3% a year** · *the usual figure*
   - Text: "At 2%: 68. At 4%: 66."
7. **Social Security: $2,697 a month from 67** · *our estimate*
   - Text: "Your real figure is on ssa.gov/myaccount."
   - Button: [Type yours ›].
8. **Spending: $4,400 a month, today's bills** · *from your bills*
   - Text: one line with the run-out age at 10% less (through `saveSpendingFigure` rules).
   - Button: [Change ›] (opens the settings fold at the box; `?type=spending` already does this).

The card ends with: "Go deeper: Which numbers matter most › · Try a different plan side by side › · What if markets fall? ›"
(Sensitivity, Compare, Stress tests). These are secondary links, not a second "Next".

When the person comes back after changing a figure on another page in the same visit, the hero adds one line: "Since you
changed what goes into the 401(k): 2046 → 2056." The previous answer is kept in memory for the visit, the way
`careful.js` keeps its answers. No schema change.

**Reuses (read-only imports):**
- `buildInputs` (`retirement/projection/compute.js`)
- `project` and `copyInputs` (`core/math/retirement.js`)
- `applyChanges` and `LEVERS` (`scenarios/compare/compute.js`), for plan-level changes
- `isGuess` (`core/estimate`)
- `ASSUMPTIONS` and its defaults (`system/assumptions/compute.js`)
- The sourced "usual" figures, from Vanguard *How America Saves*: `usualShare`, `jobPayOf` and `matchTerms`
  (`overview/guesses/estimators/saving.js`)
- `matchDollars` (`career/benefits/compute.js`)
- The left-over figure: Next best action's `spare` (`overview/next-best-action/compute.js`)
- `whenWorked` and `afterPaint` (`retirement/careful.js`)
- The `?show=` and `?type=spending` landings that already exist
- The "Nothing goes in" answer: the retirement guide's `none` mark for the `saving` step ("I'm not saving for retirement
  now", `guide/compute.js` `markNone`), or `retirement.workPlans[pid]`

**Files:**

| file | holder now | what changes |
|---|---|---|
| NEW `modules/retirement/levers.js` (pure, shared like `careful.js` and `needs.js`); or a `leverRows` export in `scenarios/sensitivity/compute.js` | free | `leverRows(plan, { today })` → `[{ key, label, value, whose: "yours" \| "estimate" \| "usual" \| "missing", effect: { lo, hi, alt }, href, act }]`; formulas and sources in a README |
| `modules/retirement/projection/view.js` | free of builder claims (claude-e released 2026-11-12 02:30; claude-c's loans row says "Released when merged", and it merged in 658c5b8). It is a usable view, so it is in the **designer's lane** under `docs/TEAM.md`: take a claim row and say so | the card, the "Since you changed" line, and the gray figure in the spending box |
| `modules/retirement/projection/module.test.mjs` or `tests/levers.test.mjs` | free | one test per lever and per kind of figure |
| `modules/retirement/projection/README.md`, `CHANGELOG.md`, catalog purpose (one sentence) | shared, append-only | |
| `modules/ai/reader/compute.js` (optional) | free (claude-d released) | let a pay stub create the 401(k) contribution row when none exists, so "Read it from a pay stub" works for Casey |

**Does not touch:** `retirement/projection/compute.js`, `overview/setup/compute.js` or `guesses/estimators/*` (claude-c holds
these until left2 lands; A only imports from them), the wave 1 shell files, or claude-f's overview files.

**Cost.**
- Measured in Node on this machine (`levers.mjs`): 10 levers in **113-281 ms**, including `buildInputs` for each
  plan-level lever.
- The engine report times brackets mode at about 25 ms per lever with an affordable-spending search. A card that reports
  only the run-out age needs one projection per lever: 0.1-0.8 ms each plus `buildInputs`.
- On a phone, figure 3-5 times that, so the card is filled after the first paint, a slice at a time (`careful.js`).
- The card must show a gray placeholder, then the figures, and never change a verdict word.

**What A does not do on its own.** It does not count the left-over money. Row 3 can only say "not counted" and offer to add a
saving line. Counting it by default is an engine change (`core/math/retirement.js` plus `buildInputs`, held by claude-c),
and it is the owner's call.

### Shape B. Upgrade *Sensitivity* into "What changes your answer" (the "deeper" page)

**What the phone shows.**
- The same tornado, renamed in plain words.
- A chip on every row: yours, estimate, usual.
- The missing levers as rows: saving when none is on file (the usual share as the high end), the match, the left-over money.
- Tap "Try" chips on a row (6%, 7%, 8%) to re-run it live.
- "Use this in my plan" writes through `store.update` with a green notice. Levers whose home is elsewhere get
  "Change on <page> ›" instead.

**Links in:** the hero of *Will the money last?* ("What changes the answer ›"), Your plan's "What would help" row, and Goal
seek's foot. It would no longer be an orphan.

**Files:**
- `modules/scenarios/sensitivity/{compute,view,README,module.test}.js`: free.
- `module.js` `title` and `purpose`: designer's lane (title, icon, purpose and order only).
- The catalog row.
- `retirement/projection/view.js`: one button.
- The Your plan row's link (`overview/plan/compute.js`): claude-f.

**Pros:**
- The page is free.
- The heavy machinery and the "can still choose" claiming logic already exist.
- The most-viewed page (*Will the money last?*) gets only one button, so less design risk there.

**Cons:**
- One more page away from the verdict; the owner asked for the list in the flow.
- The tornado's measure (steady spending a month) is not the headline's (the run-out year), so there are two vocabularies.
- Heavy: about 2 s on the PC with brackets and Roth conversions, more on a phone.
- It does not use Compare's `LEVERS`, so it would be a fifth lever list unless it is rebuilt on them.

**Best use:** the "go deeper" page that A links to. Fix its missing saving row whatever shape is chosen.

### Shape C. A "Check the numbers" step on the path

**Option C1: a new step.**
- Add a key to `PATH_STEPS` between "Your retirement" and "What would help" (`journeys.js:196-208`). It applies only when
  `fix-retire` does.
- Its page is `retirement/projection?check=1` (it opens and scrolls to A's card) or Sensitivity (B).
- Your plan gets a row "The numbers behind it: 3 not in the plan, 2 usual figures, 2 estimates" (`overview/plan/compute.js`
  `ROWS`, `words.js`).
- The reveal's "What's next" list grows by one step.

**Option C2: no new step.**
- Change the words of the existing "Your retirement" step to: "Read the answer at the top, then check the numbers under it:
  anything not in the plan or still our estimate."
- Have Your plan's "What would help" row name the count of figures to check first.
- Open "What we're counting on" when the verdict is short.

**Files:**
- `modules/overview/guide/journeys.js` and `guide/compute.js` (`resultOrder`): **claude-f** (TEAM row "claude-r's review
  rounds 1-2"). Its round 2 fixes are on the branch (`a64d852`…`5429c09`), but the row is not removed yet.
- `modules/overview/plan/{compute,view,words}.js`: claude-f.
- `overview/guide/frame.js` needs **no** change; it draws any step. It is claude-b's wave 1 file in any case.
- C1 also needs a DESIGN_LOG entry (the designer's lane), since it adds a step.

**Conflicts.** Wait for claude-f's claim to be released, or ask on WORKBOARD.

**Pros:** it makes "check before you change" part of the one path.

**Cons:**
- It needs A or B to exist first.
- C1 lengthens the path for exactly the households already told to change things.
- C2 gets most of the benefit with words only.

### Recommendation and order

1. **Quick wins first.** These are in free files and are useful under any shape.
   - **Goal seek:** when a 401(k) at work has money in it and nothing goes in, say so instead of "You save nothing toward
     this today" (`scenarios/goal-seek/compute.js:176`).
   - **Sensitivity:** add the saving row when none is on file (`compute.js:69`).
   - **Contributions:** after a save, show the old verdict next to the new one ("now lasts to 76, was 66").
   - **Will the money last?:**
     - Give the spending box a gray figure.
     - Mark the defaults as "usual".
     - Make "Chance the money lasts" and "If history repeated" links.
2. **Then A**, the card and the shared `leverRows`. It is the owner's ask where the person already is. One new pure file and
   one view, outside every held file.
3. **Then C2's wording** (claude-f's files, after their review round closes), and **B** as the "deeper" page behind the
   card.
4. **Wait for the owner's decisions** before counting the left-over money in the engine (claude-c's held file, after left2)
   and before a Roth or pre-tax split field.

---

## 8. Who holds what now

| Files | Holder at `fe678cb` | Source |
|---|---|---|
| `modules/retirement/projection/compute.js`, `modules/overview/setup/compute.js`, `modules/overview/guesses/estimators/*` | **claude-c**, until the left2 commit lands (ssg and left2 have not landed; loans did, `658c5b8`) | WORKBOARD 2026-11-11 14:40, 18:30 |
| `modules/overview/{dashboard,plan,start,next-best-action,monthly-review,alerts,health-score,guesses}/**`, `modules/overview/guide/**` except `frame.js` | **claude-f** (claude-r's review rounds 1-2) | docs/TEAM.md row "builder (claude-f) 2026-11-11 claude-r's review rounds 1-2" |
| `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`, `modules/overview/guide/frame.js` | **claude-b**, wave 1 | docs/TEAM.md, WORKBOARD 17:30 |
| `modules/retirement/**` (except projection compute), `modules/scenarios/**` | free (claude-e released 2026-11-12 02:30) | WORKBOARD |
| `modules/system/assumptions/**`, `modules/ai/reader/**` | free (claude-d released) | WORKBOARD 22:15 |
| `view.js` of usable pages | the designer's lane by the TEAM table; builders take a claim row | docs/TEAM.md |
| claude-a's 13 folders | none of the pages in this report. `balance/projection` (net worth over time) would need to agree if the left-over money is ever counted as invested | WORKBOARD Lanes |

---

## 9. Related pages the owner's other points touch

**The Roth / pre-tax split, per person and per account.**
- The pages already allow it, but nothing says how. *Net worth* has one type, "Roth IRA / 401(k)". *Contributions* puts one
  account on each row. A 60/40 split at one job takes two accounts and two rows.
- "Employer adds, a year" can be typed on the Roth row. The engine then grows the match tax-free (engine report, section 1).
- A's card could carry a row "Where your saving goes: all into accounts you pay tax on later" → [Split it ›] on
  Contributions. Contributions and Net worth are free files.

**Statements and account connection.** What already exists:
- *Document reader*: paste a pay stub, statement or Social Security statement. It works with no AI and, for pasted text,
  no PC.
- *Statement reader*: PDF or picture. It has `requires: "pc"`, so it is hidden on the phone's static copy.
- *Import*: bank CSV.
- *Holdings*: positions CSVs from Fidelity, Schwab and Vanguard.
- *Update my balances*: all balances on one screen.

Points for the owner:
- *Bank connections* (`transactions/connect`) is still **planned**. The SimpleFIN proposal of 2026-10-31 is waiting for the
  owner's yes: it needs the PC server and a secret in `planner.properties` (rule 10).
- Get started and the questions promise on screen: **"No bank logins or account numbers, ever."**
  (`overview/start/view.js:96,146`, `overview/setup/view.js:269`). Connecting accounts would break that promise unless
  the owner changes it.

---

## 10. Questions for the owner (the shapes above depend on them)

1. **Should the money left over each month count as saved?**
   - **As it is today:** it is not counted, and the card says so plainly.
   - **Count it as saved:** where it goes: cash at 2%, or invested?
   - **Ask each household:** each one picks one of these.

   For Casey this alone moves "runs out at 66" to "lasts to 91".
2. **May the card offer "the usual figure" as the alternative?** For example, "people with pay like yours put in about
   6.6%", sourced from Vanguard *How America Saves*. Or only a 1-point move each way?
3. **Should "check the numbers" be:**
   - (a) a card on *Will the money last?* (A);
   - (b) that card plus new words on the existing step (A + C2);
   - (c) a new step on the path (C1, which needs a DESIGN_LOG entry)?
4. **Should Sensitivity become the "go deeper" page,** with a plain title such as "What changes your answer", linked from
   the card?
