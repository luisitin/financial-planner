# Spec: check the numbers, count the leftover, split Roth and traditional, then go deeper (for claude-b)

Owner's request of 2026-11-11 (relayed verbatim in the workflow). Written from walk.md, engine.md, pages.md, connect.md and
ux.md, with the corrections in verify-code.md and verify-web.md applied (a corrected claim wins). You (claude-b) decide every
open point below without asking the owner; the "Decision" lines are the ones to copy into the READMEs named.

**Base.** The reports read fe678cb. The branch has moved: local tip c6fb730, origin de4aa0c (14 more commits, nearly all
reviews and Get started). Line numbers below are at fe678cb unless marked "HEAD". Several have drifted a few lines, so grep
by name before you edit. Re-checked at HEAD for this spec:
- `retirement/projection/view.js`: hero buttons at :187-188; "Two more pages, Chance the money lasts and If history
  repeated" plain text at :204; "What goes into this" at :234-235; `?type=spending` landing at :241-245.
- `projection/compute.js`: contributions mapping at :932-940; `compute` at :1071 (verdict from `ratio` at :1084-1085);
  `saveSpendingFigure` at :1282; `savingVerdict` at :1312; `savingsUnknown` at :1353.
- `overview/next-best-action/compute.js` imports `savingVerdict` (:16) and works out `spare` inline (:149-164).

**Households for every check.** All are invented.
- Phone-built at fe678cb by tapping through Get started: `scratchpad/rv/walk/out/gs/{couple2k,noMatch,noContrib,nearRetiree,renter}.real.plan.json`.
  These are Dana & Lee, Jamie, Casey, Robin and Morgan.
- From the kit: `households(root)` gives `sam` and `renterDebt`.
- `qa/fixtures/family-plan.mjs`.
- Do not use pages.md's "Casey" for acceptance: it is the builder variant, whose spending comes from Expenses (verify-code,
  correction 3). Its figures differ from a person who taps through Get started.

---

## 1. What the owner asked, in five parts

- **(A) When the plan falls short, show what drives the answer and let the person check and change it.**
  - Show the assumptions and defaults, and say which figures are the person's own and which are ours.
  - Let the person change each one, and show what the change does to the answer.
  - The owner's examples: a 401(k) contribution not entered, a wrong match, inflation, investment returns.
  - The point: "sometimes it may just be a bad sequence of inputs".
- **(B) The money left over each month.** Is it invested? Let the person say, and count it the way they say.
- **(C) Roth vs traditional.** Let the person split saving between the two, per person and per account ("different
  accounts with different people").
- **(D) Big picture first, then deeper.** After setup and the big picture, a person can dig into better analysis of their
  own result.
- **(E) Connecting accounts or uploading statements**, built only if it is possible, easy and well documented. If it is,
  build the smallest thing that is worth having.

The owner's standard for all five: "user experience is key … it's got to be valuable".

---

## 2. Part by part

### (A) Show what drives the answer, let the person check it, show the effect

**What exists today**

*Will the money last?* (`retirement/projection`)
- The hero gives the answer first. Both of its buttons are outlined (HEAD :187-188).
- "What goes into this" lists every input, linked to its page (`view.js:205-224` at fe678cb, HEAD :234). It starts about
  two screens below the verdict.
- A "Retirement settings" fold (spending, stock share now and once retired, tax, withdrawal way and rate) sits about
  2,700 px down. After Save, the new verdict is off screen and only a toast shows (walk, levers-ui).
- The word "guess" never appears on the page. The guessed spending reads "the figure from Set up my plan" (walk, gap 2;
  verify-code confirms).

*Goal seek* (`scenarios/goal-seek/compute.js:110-240`)
- Solves six levers, one at a time: spending, retirement age, saving, return, lump sum, claim age.
- Takes every input as true. For Jamie it lists "The return it needs: 10.4%" as a fix, with an Assumptions button (ux F4).
- The claim-age card says "room to spare" whenever the best age differs from the one on file, whatever the verdict
  (`compute.js:233`, pill at `view.js:31`).
- The saving card says "You save nothing toward this today" about a 401(k) that holds money (`compute.js:176`).

*Sensitivity* (`scenarios/sensitivity/compute.js`)
- A tornado chart of 9 to 11 inputs.
- The saving row exists only when some saving is already on file (`:69`), so it is missing exactly for Morgan and Casey.
- It has no gate. For Sam it shows "$0 / $0" rows while the other two pages say "We don't know yet" (ux F3).
- No page links to it. The Glossary shows only the first 3 pages of each list (`ai/glossary/view.js:70`).
- Its title is jargon.

*Assumptions* (`system/assumptions/compute.js:9-50`, `view.js:58-71`)
- Ten fields, each with "Default: X" and its source, and `?show=<key>` landings.
- One `reviewedAt` date covers all ten. Save shows only "Saved and marked as reviewed": no effect on the answer.

*Your plan*
- "Make it fit you better" lists up to 3 guesses.
- "What we're counting on" is a fold with 4 assumptions.
- "These sound fine" only stamps `reviewedAt` (`setup/compute.js:2043`).

*Our guesses* (`overview/guesses`)
- Lists every guess in the ledger (`plan.guesses`, `isGuess`).
- Leaves out market figures on purpose ("planning choices, not guesses").
- Does not list a blank box. Casey's empty 401(k) is not there.

*Contributions* (`retirement/contributions/view.js`)
- Saving at work and the match, per person and per account.
- After a save, the hero shows the new verdict but not the old one (`:76-78`).
- With a 401(k) on file and nothing going in, it asks "Does Casey's job add money …?" (`:250-253`; verify-code,
  correction 2).

*Engines.* Four "one input at a time" engines with four lever lists (Sensitivity, Goal seek, Compare `LEVERS` :14-29,
Advisor's plan). None has the match, the leftover or the Roth split (pages §3).

*Needs attention* says "Nothing needs your attention right now" for Jamie (short at 70), Casey (short at 67) and Robin
(short at 94). Confirmed: `alerts.allClear` (verify-code, item 7).

**The gap**
- No page shows the person, where the verdict is, which numbers the answer rests on, whose each one is, and what one sensible
  change would do.
- Changing a lever means leaving the page and remembering the old answer.
- "Raise the return" is offered as a fix.

**Option A1: a "What this rests on" card on Will the money last?, built on one new shared lever list (recommended)**
- New pure `modules/retirement/levers.js` (like `careful.js` and `needs.js`):
  `leverRows(plan, { today })` and a generator `leverSteps(plan, { today })` for `careful.js`'s `whenWorked`.
- The card goes directly under the hero. It is open when the verdict is short or tight, and a closed fold when the plan is
  on track.
- The hero gains one plain line and the page's one filled button, "Check the numbers behind this ↓".
- Each row is a record:
  - the label;
  - the value now;
  - a tag: **Yours**, **Our guess**, **Usual figure** or **Not counted**;
  - one or two effect lines in the hero's own unit;
  - one action.

**Option A2: upgrade Sensitivity into "What changes your answer" and link to it from the hero**
- Pros: the page is free, and the machinery exists.
- Cons:
  - It is one more page away from the verdict, which the owner asked for in place.
  - Its unit (steady spending a month) is not the headline's (the run-out age).
  - It is heavy: about 2 s on the PC with brackets and Roth conversions.
  - It would be a fifth lever list unless rebuilt.

**Recommendation.** A1 now, with Sensitivity as the "go deeper" page behind it (small fixes in L1, regrouping later).
- The owner asked for the levers where the person is.
- A1 needs one new free file plus views that are free of other builders' claims.
- One projection per alternative is cheap: 0.1 to 0.8 ms each plus `buildInputs` at 2 to 5 ms (engine §5).

**Decisions for A1** (copy into `modules/retirement/projection/README.md` and the README section of `levers.js`)
- **D-A1. Unit.** The age the money runs out, or "lasts to the end (age N)", at average markets, from one `project()` of the
  changed copy.
  - When both runs last, compare the money left at the end in today's dollars.
  - Never use "the most it can pay for" (`affordable`) in a lever line. It compares different loan bases (pages §6).
  - The effect lines never print a verdict word (tight, on track, short). Those stay the hero's, so this does not become the
    twelfth way the verdict is said.
- **D-A2. Size and order.**
  - score = (alt lasts ? endAge + 1 : altAge) − (base lasts ? endAge + 1 : baseAge).
  - When both last: Δ(end money in today's dollars) ÷ yearly spending in today's dollars.
  - Order:
    1. Not counted;
    2. Our guess;
    3. Usual figure;
    4. Yours.
  - Within each group, sort by |score|.
  - Show 5 rows and fold the rest under "N more numbers".
  - Hide a Yours or Usual row whose |score| < 1 year, except the growth and rising-prices rows: the owner named them, so
    they are always listed, in the fold if need be.
- **D-A3. Tags.**
  - Our guess = `isGuess(plan, path)`, the ledger or the older flags.
  - Usual figure = an Assumptions field equal to its default while `reviewedAt` is absent or stale (the page's own 365-day
    rule).
  - Yours = typed, or confirmed.
  - Not counted = a blank the plan treats as zero.
  - No colour on any tag. A guess never colours anything (guesses README).
- **D-A4. The "usual" alternatives come from sourced tables only.**
  - Saving at work: `usualShare(plan, pid, today)` (Vanguard *How America Saves*, `guesses/estimators/saving.js:179`).
  - The match: the `contrib.match` estimator / `matchTerms()` (median value 4% of pay, earned in full at 6% put in; :174).
  - This is the figure behind Get started's "Not sure (about 4%)" chip.
  - The 50%-up-to-6% tiers (`career/benefits/compute.js:24`) are a second, older convention. Note it in the README and do
    not use it on the card (verify-code, correction 1).
- **D-A5. The match with nothing going in.**
  - A match alone adds $0 when nothing goes in, so the two are one row: "6% of pay plus the usual match".
  - pages.md's "81 from the match alone" was really "6% in plus the match" (verify-code).
- **D-A6. Writes from the card.**
  - The card writes only the leftover answer (L4). Every other row links to the page that owns the figure, landing on the
    box.
  - The before-and-after is shown when the person comes back. The projection view remembers the last answer it drew on this
    visit (a module-level Map, as `careful.js` does).
  - When the plan's key changed, the hero adds: "Before your change: runs out at 70. Now: runs out at 75." It names the
    lever whose value differs between the old and new `leverRows`.
  - No schema change.
- **D-A7. Returns are not a fix.**
  - The growth row's action is "Check ›", never "Raise".
  - Its effect line shows both directions ("Careful 6%: runs out at 66. Hopeful 8%: at 72").
  - Under it: "Nobody can choose this. Fix the plan with what you control: saving, when you stop, spending." See section 5.

**Rows of the lever list** (each skipped when it does not apply; formulas go in the README)

| key | when shown | value and tag | alternative(s) run | action |
|---|---|---|---|---|
| `work-saving:<pid>` | the adult has pay and a plan at work (`retirement.workPlans[pid].plan`, or a `401k` account they own) | own money a year. Nothing going in: Not counted, or Yours if they tapped "None". Else Yours / Our guess (`retirement.contributions[id].amount`) | nothing in: `usualShare` × pay plus the usual match at that share. Below the full match: up to the full match. Else +1% of pay | "Type what goes in ›" (Contributions `?add=<pid>`, L3); "Read it from a pay stub ›" (Document reader `?kind=paystub`, L7) |
| `match:<rowId>` | a work row with own money above 0 | `employerMatch`. Our guess (ledger), Yours (typed, or `workPlans[pid].match === false`), Not counted (0, never asked) | the usual match at the person's share (`matchTerms`) | "Check the match ›" (Contributions `?match=<rowId>`, L3) |
| `leftover` | `leftOverOf(spare)` ≥ $50 a month and someone still works | $X a month. Not counted unless answered (L4) | invested: a monthly row with no account, so it lands in taxable (Compare's "save more" pattern). In the bank: a row into a synthetic savings account (cash rate) | before L4, "Count it ›" (Contributions `?add=leftover`); from L4, "Answer" in place |
| `spending` | always | monthly figure and source. Our guess (ledger `retirement.spendingMonthly`, legacy `retireAuto`), "from your bills" (Expenses), Yours | 10% less, applied with `saveSpendingFigure` on the copy | "Change ›" (`?type=spending`, which exists) |
| `stop:<pid>` | the adult still works | `people[].retirementAge`. Yours, or Usual (the 65 fallback) | +2 years, at most 75 | "Change ›" (the projection's existing "Change the age" target) |
| `ss:<pid>` | always | monthly amount at the claim age. Our guess (`guide.setup.ssWrote`), Yours (typed or record) | claim at 70 when the claim age is below it | "Type yours ›" / "When ›" (Social Security) |
| `growth` | always | stocks 7% (bonds 4%). Usual or Yours | Careful 6% and Hopeful 8% for stocks (L5's presets) | "Check ›" (`#/system/assumptions?show=returnStocks`) |
| `prices` | always | inflation 3%. Usual or Yours | 2.5% and 4% | "Check ›" (`?show=inflation`) |
| `plan-to` | always | plan-to age (`lifeExpectancy` / `planEndAge`). Usual or Yours | +5 years | "Check ›" (How long to plan for) |
| `mix` | in the fold only | stocks now 70% / once retired 50%. Usual | ±20 points (Sensitivity's `NUDGE.mix`) | "Change ›" (the settings fold) |

**Hero line (worked out at once, no projections)**
- "This answer rests on N numbers: 3 you gave us, 2 our guesses, 2 usual figures."
- Plus, when there is one: "1 thing is not counted yet: the $567 left over each month."
- A plan with `savingsUnknown` (Sam) keeps its filled "Add what you own ›". Its card shows only the Not counted rows, worded
  as questions:
  - "Nothing is saved for retirement yet, and nothing goes in."
  - "If the $746 left over each month were invested, the money would last to the end."

**Go deeper (D).** A small card after the levers card links to the three pages the hero does not:
- "What matters most? ›" (Sensitivity);
- "Try two plans side by side ›" (Compare);
- "What if history repeated? ›" (Historical).

Replace the plain-text sentence at HEAD :204 with links to Chance and Historical. These are outlined links, never a second
filled button.

**Files**
- New: `modules/retirement/levers.js`, `tests/levers.test.mjs`.
- `modules/retirement/projection/view.js` and `README.md`.
- `modules/scenarios/{goal-seek,sensitivity}/*` (L1).
- `modules/retirement/contributions/view.js` (landings, L3).
- `modules/system/assumptions/*` (L5).
- `CHANGELOG.md`, `docs/TEAM.md` (claim rows).
- **Read-only imports, no edits:** `retirement/projection/compute.js` (`buildInputs`, `saveSpendingFigure`, `savingsUnknown`),
  `core/math/retirement.js` (`project`), `scenarios/compare/compute.js` (`applyChanges`, `LEVERS`),
  `overview/guesses/estimators/saving.js`, `core/estimate`, `core/math/leftover.js`, `overview/next-best-action/compute.js`.
  The view imports NBA's `compute` to get `spare`; `levers.js` must not import NBA (see B).

**Lane and claim conflicts**
- `retirement/projection/compute.js` is claude-c's until left2 lands. A1 does not edit it.
- `projection/view.js` is the designer's lane. Take a claim row in `docs/TEAM.md`.
- claude-e has one open review item on that view: `careLine2`, "nothing on the first screen moves once drawn"
  (`docs/handoffs/review-2026-11-11/claude-e.md:155-157`). Post on WORKBOARD before editing. The card must not reopen it
  (see the acceptance list).
- Delete or update your own stale TEAM rows that name these views (rows 64-66 and 71-74: projection, goal-seek,
  sensitivity, contributions and reader views; verify-code §4) in the same change.
- Wave 1 files: none touched. Use wave 1's place memory for `?check=1` when it has landed, else the view's own once-per-route
  scroll, as `?type=spending` does.
- claude-a's folders: none touched.

**Schema.** None for A1.

**Tests, one per formula** (`tests/levers.test.mjs`)
- Each row's tag on fixtures where it is known:
  - Jamie's "No match": Yours;
  - Robin's match: Our guess;
  - Casey's "None": Yours, with a work-saving row present;
  - Morgan, renter with an IRA and nothing going in: no work row (no plan at work).
- Each effect equals a hand-built copy run through `buildInputs` and `project` with the same change (said = done).
- Score and order (D-A2); the hide rule; the cap of 5 and the fold.
- `usualShare` and `matchTerms` figures equal the estimators'.
- The work row with nothing in uses saving plus match, never the match alone.
- `leverRows` never mutates the plan (deep-freeze the input).
- No row's action raises a return.
- On a `savingsUnknown` plan only Not counted rows appear.
- Every qa fixture and `qa/households` plan: `leverRows` does not throw, and every effect is finite.
- `tests/golden/retirement` is unchanged (no engine change).

**Acceptance (phone walk, 390 px and 320 px, light and dark, sandbox)**
1. Jamie, Will the money last?:
   - the hero line and the filled "Check the numbers behind this ↓";
   - one tap and the card is in view;
   - the first row is the match ("No match on file · Yours") with "If Jamie's job matched like most: lasts to 75" (or
     whatever the engine says at build time; record it).
2. Nothing on the first screen moves once drawn. Measure every 20 ms, as claude-e's N3 did. The effects fill gray
   placeholders of fixed height.
3. Casey (phone-built):
   - the first row is "What goes into Casey's 401(k): nothing (you said so)";
   - the effect is "6% of pay plus the usual match: …";
   - "Read it from a pay stub ›" opens the Document reader.
4. Sam: "Add what you own ›" stays the one filled button, and the card asks two questions with no "$0 / $0".
5. The growth row reads "Usual figure" and never offers to raise it.
6. Assumptions → 6% → Save → Back:
   - the hero says "Before your change: runs out at 70. Now: runs out at 66.";
   - the line names "how fast investments grow (7% → 6%)".
7. No horizontal scroll. Every tap target is 44 px. The tags wrap under the label at 320 px.

---

### (B) The money left over each month: is it invested?

**What exists today**
- The engine adds only typed contribution rows while working (`core/math/retirement.js:129-139`).
- Cash on hand sits in the cash bucket at `returnCash` 2% (`:309`) and is spent first (`:101`).
- The future leftover is added to **no** bucket, cash included (verify-code, gap 9).
- `buildInputs` never reads `spare` (`projection/compute.js:1008-1019`).
- The reveal, Dashboard and Your plan say "About $X a year builds up in checking and savings" (`core/math/leftover.js:65`).
  The reveal labels it "● Money to put to work".
- Financial independence counts it before tax (`retirement/fire/compute.js:72-73`). left2 fixes that page's display.
- claude-c's pending left2 (`origin/wip/fu-left2`, not landed) adds a projection note: "You said about $X a month is left
  over. That stays in checking and savings and is not added to your retirement savings here." Its handoff says:
  - the projection cannot read the month itself, because NBA imports `savingVerdict`, a loop;
  - counting by default would move the frozen retirement golden key;
  - "a household that wants it counted types it as a contribution".

**What it is worth** (re-run by verify-code at fe678cb)

| household | now | all of the leftover invested |
|---|---|---|
| Dana & Lee | tight (1.08) | on track (1.46) |
| Jamie | short at 70 | short at 90 |
| Casey | short at 67 | short at 90 |
| Morgan | short at 65 | short at 77 |
| Robin | short at 94 | lasts |
| Sam | "don't know yet" | lasts (1.64) |

Inflation −0.5 point or stocks +1 point moves the ratio by only 0.01 to 0.04. For most households, the leftover is the
biggest lever.

**Option B1: the person answers, and "invested" becomes an ordinary contribution row (recommended)**
- Three answers:
  - **"Invested for later"** writes a monthly row into a brokerage account: an existing one the person picks, or a new $0
    one, "Investments for later".
  - **"It stays in the bank"** writes a row into a savings account: an existing one, or a new "Savings for later". The engine
    grows it at the cash rate.
  - **"It gets spent / not sure"** writes only the answer.
- The amount is prefilled with the leftover, rounded down to $10, and the person confirms it.
- **Why:**
  - No engine change, and no held file.
  - All 11 pages that state the verdict follow at once, because they all read contribution rows.
  - The golden keys do not move.
  - Next best action's `spare` already subtracts `con.yearly` (all rows, brokerage included; `next-best-action/compute.js:150`),
    so the leftover shown drops by the amount invested. Nothing is counted twice, and if spending later rises the existing
    "checking going down" warnings fire.
  - The person sees and edits it as a normal row on "What you save for retirement".
  - It matches left2's own stated route.

**Option B2: an optional `retirement.leftover.use` read by `buildInputs`, which adds the leftover each year**
- `buildInputs` (claude-c's file) would need the leftover figure. It cannot get it without the NBA loop: either the caller
  passes a snapshot, or `spare` is pulled out into a new module, which duplicates claude-f's NBA code.
- NBA's leftover would still show the full figure as "builds up in checking" while the projection invests it: two stories.
- A snapshot goes stale silently.

**Recommendation: B1.**

**Decisions** (copy into `modules/retirement/projection/README.md`, `levers.js`, `contributions/README.md`)
- **D-B1. Default unchanged.** Not counted until the person answers. No silent change to anyone's answer, the same choice as
  left2.
- **D-B2. Until answered, show both effects.** For example: "If it's invested: lasts to 90. If it piles up in the bank:
  lasts to 79. As it is, counted as spent: runs out at 70."
- **D-B3. Whose row.**
  - The row's `personId` is the lead earner (goal-seek's `leadAdult`), so it stops at that person's retirement age.
  - It grows with pay raises, as every row does (`retirement.js:136`). The README says so.
- **D-B4. The cushion first.** If the emergency fund is below its target (`balance/liquidity`), the answer screen adds:
  "Your emergency fund is $G short. Many people fill that first; count only what goes into investments." It is advice, not a
  formula, and the person sets the amount.
- **D-B5. When it rests on our guesses.** If the leftover rests on guessed spending (`guessesTouching(plan, "expenses")`),
  the row says "worked out from bills that are partly our guesses".
- **D-B6. Asking again.**
  - Ask again when the answer is more than a year old, or when the leftover has moved more than 25% from the amount
    answered.
  - The wording: "You said in March that $500 a month is invested. Left over now: $900. Still right?"
- **D-B7. Contributions' account list.** "Into which account" also lists a checking or savings account that a row already
  uses, so a "stays in the bank" row can be edited. New rows into cash accounts are made only by this answer.

**Files**
- `retirement/projection/view.js` (the in-place answer, with `pending` for the notice).
- `retirement/contributions/view.js` (D-B7) and `README.md`.
- `retirement/levers.js` (reads the answer).
- `docs/DATA_MODEL.md`, `CHANGELOG.md`.

**Lane and claim conflicts**
- Designer-lane views: take claim rows.
- Do not touch `projection/compute.js`.
- Tell claude-a on WORKBOARD: `balance/projection` (net worth over time) reads the retirement projection, so it follows the
  new rows with no edit.
- Tell claude-c: left2's note "a typed leftover is not added" must not show once a leftover row exists. Detect it by
  `retirement.leftover.rowId`.

**Schema.** Optional `retirement.leftover?: { answer: "invest" | "bank" | "spend", on: "YYYY-MM-DD", monthly: number, rowId?: string }`.
- No version bump: absence means "not asked", which is today's behaviour.
- Add a DATA_MODEL line in the same commit.
- The rows it writes are ordinary contribution rows: `id: "leftover-<n>"`, `period: "monthly"`, `employerMatch: 0`.
- A new account record is an ordinary account: `{ id, name, type: "brokerage" | "savings", balance: 0, asOf: today, ownerId, history: [] }`.

**Tests**
- The written row equals the confirmed amount. NBA `spare.monthly` after = before − amount.
- The verdict after the save equals the card's predicted effect for that amount (said = done).
- "Stays in the bank" lands in the cash bucket and grows at `returnCash`.
- The row stops at the lead earner's retirement age.
- The "spend" answer writes no row.
- Asking again: more than 365 days, or more than 25% drift.
- Invariance: every qa fixture and household without `retirement.leftover` gives identical compute output for every module.
  Copy the `tests/guesses-invariance.test.mjs` pattern.
- Golden keys unchanged.

**Acceptance (Dana & Lee)**
1. Card row "Money left over each month: $1,828 · Not counted", with both effects.
2. Answer → "Invested for later" → amount $1,820 → Save.
3. The notice says what was written and the before and after, for example "Saved: $1,820 a month into Investments for later.
   Before: lasts in most cases. Now: lasts to the end."
4. The Dashboard's leftover now reads about $8. The Retirement row has changed.
5. Contributions lists the row. Remove it, and everything returns to the earlier figures.

---

### (C) Roth vs traditional, per person and per account

**What exists today**
- The account type alone decides the tax treatment (`projection/compute.js:37,934`). `roth` is labelled "Roth IRA / 401(k)"
  (`net-worth/compute.js:15`).
- A row names one account and one person (`contributions/view.js:93-100`), so per person and per account already work.
- A 60/40 split at one job takes two accounts and two rows: 13 taps, with nothing pointing the way (walk).
- **The employer match goes wherever the row goes** (`:939`), so a match typed on a Roth row grows tax-free. By law, the
  default is pre-tax (IRC 402(a)/402A). SECURE 2.0 §604 lets a plan offer a Roth match, which is then taxed as pay that year.
- `limitKind` (`contributions/compute.js:20-21`) treats a `roth` row as a 401(k) when it carries a match or its name says
  401(k), 403(b), 457, TSP or thrift.
- Paycheck's "Roth 401(k), after tax" line reads only the typed what-if (`cashflow/paycheck/compute.js:187`).
- Work benefits' `isK` replaces the person's `401k` rows with one pre-tax row (`career/benefits/compute.js:159-166`).
- Get started's "Through work" always saves a `401k` (`setup/compute.js:94`).
- **Engine bias:** working-year tax is not modelled, so the tax a pre-tax contribution saves today is never credited.
  - Family fixture: retyping Ana's 401(k) as Roth raises "the most it could spend" by $485 a month.
  - The same change raises this year's federal tax by $2,778, which the projection never sees.
  - So any "Roth vs traditional: lasts to X vs Y" from today's engine favours Roth.

**Option C1: two rows, with a guided split (recommended now)**
- Each work row on Contributions gets "When do you pay the tax on it?" with **Later / Now / Some of each**.
- "Some of each" shows two boxes (% of pay or $) and writes two rows:
  - the original row keeps the "later" part **and the whole match**;
  - a new row goes into the person's Roth account at work. If they have none, the split creates `type: "roth"` named
    "Roth 401(k) at <employer or work>". The "401(k)" in the name makes `limitKind` count it against the 401(k) limit.
- "Now" alone moves the row to the Roth account and leaves the match on a $0 later row. An IRA cannot be split: by law,
  traditional and Roth IRAs are separate accounts.
- No schema change. The pages that read rows (federal tax, limits, NBA, setup) already treat a `roth` 401(k) row correctly.
- Pay stubs and statements list "401K" and "ROTH 401K" as separate lines, so two rows match what the person sees.

**Option C2: an optional share on one row (`roth: 0..1`, `matchRoth`)**
- The cleanest data, but 11 readers must follow it (engine §3). Three are held:
  - `projection/compute.js` (claude-c);
  - `overview/setup/compute.js` (claude-c);
  - `guesses/estimators/spend.js` (claude-c).
- Two more are claude-f's: `next-best-action`, and `guesses` via the estimators.
- Balances still need two accounts.

**Recommendation.** C1 now (L6). Add the match rule after left2 (L9). Do not build C2.

**Decisions** (copy into `contributions/README.md`)
- **D-C1. Words.** "Pay the tax later" and "pay the tax now". Never "deferred", "free" or "bucket" on screen (ux 4.10).
- **D-C2. The match is "later".**
  - After L9, a match on a Roth row counts as pay-the-tax-later unless `matchRoth: true`. Ask "Your plan puts the employer's
    money in as Roth (it is then taxed as pay this year)" only if the person says so.
  - Until L9, the split never puts a match on a Roth row.
  - A match typed by hand on a Roth row shows one line: "Most plans add the employer's money as pay-the-tax-later."
- **D-C3. No "which is better" verdict from the engine** (the bias above). Show instead:
  - (a) this year's federal tax difference: `taxes/federal` `compute` on the plan and on a copy with the split, the
    difference rounded to $10, "Later lowers this year's tax by about $X";
  - (b) the rule of thumb: "If you expect a lower tax rate in retirement, later usually wins; higher, now wins. Not sure?
    Some of each is a sound choice." Source: Brown, Cederburg and O'Doherty, *JFE* 2017, a mix under tax uncertainty.
    Do **not** cite Vanguard's BETR page for this (verify-web M10).
- **D-C4. The mix at retirement.**
  - One line from the projection's retirement-year row `balances`: "Your money at 65: 68% pay-tax-later, 22% already taxed
    (Roth), 10% regular savings."
  - It is read-only, from `projection/compute.js`'s `compute` output.
- **D-C5. Catch-up after 50.**
  - When the person is 50 or over and this job's pay is over $150,000, one line: "From 2026, catch-up money above the usual
    limit must go in as Roth if last year's pay from this job was over $150,000."
  - Source: Vanguard *How America Saves 2026*; the threshold is confirmed there. Word it as "applies from 2026" and leave out
    the regulation date (verify-web M11).
  - It is said, not asked.
- **D-C6. Paycheck.** Paycheck's Roth 401(k) line reads the person's Roth 401(k) rows per paycheck when no what-if is
  typed.
- **D-C7. Work benefits.** "Put in X% to get the full match" counts the person's own money on both rows at that job.

**Files**
- `retirement/contributions/{compute,view,README,module.test}.js`.
- `cashflow/paycheck/compute.js` (+ test).
- `career/benefits/compute.js` (your own lane) and its test.
- `docs/DATA_MODEL.md`: no change in L6. L9 adds `matchRoth?`.

**Lane and claim conflicts**
- Designer-lane views: take claim rows.
- `cashflow/**` is free (claude-g released).
- L9's `projection/compute.js:939` waits for claude-c.

**Schema**
- L6: none.
- L9: optional `retirement.contributions[].matchRoth?: true`.
  - It changes the meaning of a match on a Roth row: only computed figures move, which is DATA_MODEL's precedent.
  - Run `tests/golden/retirement`. If a row moves, explain it in `tests/golden/retirement/QUALITY.md`, as 5b did.
  - Fixtures with a Roth row: `qa/fixtures/family-plan.mjs:26,68` and `retirement-plan.mjs:23`.

**Tests**
- After a split, the person's own money is unchanged in total, and the match is only on the later row.
- The new Roth row's `limitKind` is `401k`.
- Federal tax: pre-tax drops by the Roth part, and the tax line's $X equals the federal difference.
- Paycheck's Roth line equals the Roth row per paycheck.
- Benefits' `matchAt` counts both rows.
- The mix percentages sum to 100% and come from `balances`.
- Catch-up line: the age and pay boundaries.
- L9: a match on a Roth row lands in the deferred bucket; with `matchRoth` it lands in the Roth bucket and federal income
  rises by the match.

**Acceptance (Dana & Lee)**
1. Contributions → Dana's row → "Some of each" → 4% later, 2% now → Save.
2. Two rows. The match is on "later".
3. The notice states the federal tax this year and the mix.
4. Net worth lists the new "Roth 401(k) at work" at $0.
5. At 320 px the three chips wrap and nothing scrolls sideways.

---

### (D) Big picture first, then deeper

**What exists today.** One path:
1. Get started.
2. Seven questions.
3. The reveal.
4. The step pages:
   - Your retirement = Will the money last?
   - What would help = Goal seek, only when tight or short.
5. Your plan.
6. Dashboard.

Details:
- `PATH_STEPS` are at `overview/guide/journeys.js:195-208`. DESIGN_LOG 2026-11-06: "a new step is a step of the path", and
  no new walk.
- "Deeper" today means the menu.
- Sensitivity and Compare cannot be reached from the result.
- Your plan's "What would help" is one generic sentence (`plan/compute.js:163-167`).
- Needs attention is silent on a short plan.

**Option D1: the card and "Go deeper" on Will the money last?, no new step (recommended)**
- The "Your retirement" step already opens that page, and the card is the first thing under the answer.
- Later, when claude-f releases, change only words and links:
  - the step's `ask`: "Read the answer at the top, then check the numbers it rests on, just under it";
  - Your plan's "What would help" row → `#/retirement/projection?check=1`, check before fix;
  - a Needs attention item when the verdict is short: "Your retirement money runs out at 70. Check the N numbers it rests
    on ›";
  - "Small changes help" only when the ratio is ≥ 0.85, else "Check the numbers first". Morgan, at 0.24, now reads "Small
    changes help" (walk, gap 6).

**Option D2: a new path step `check-retire` between `retire` and `fix-retire`**
- It needs claude-f's `journeys.js` and `guide/compute.js`, plus a DESIGN_LOG entry (the designer's lane).
- It lengthens the path for exactly the households already told to change things.

**Recommendation.** D1. Decision D-D1 (projection README): "No new step. The check lives on the page the retirement step
opens. Going deeper is one card of questions, two levels at most (Nielsen 2006)."

**Files**
- Now: `projection/view.js` (the Go deeper card and the `?check=1` landing).
- Sensitivity's `module.js` title "What changes your answer" (designer field) and the catalog row.
- Later (L12): `overview/{guide,plan,alerts,dashboard}` (claude-f), and the `setup/view.js` reveal tile link (your own claim;
  coordinate with claude-e's Get started review).

**Lane and claim conflicts**
- claude-f holds `overview/{dashboard,plan,start,next-best-action,monthly-review,alerts,health-score,guesses}/**` and
  `overview/guide/**` (TEAM row 78, review rounds still running at origin).
- Post the L12 asks to claude-f on WORKBOARD now. Do not edit those files.

**Schema.** None.

**Tests**
- A `?check=1` landing test (it scrolls to and focuses the card heading once per arrival).
- The catalog/check test passes with the new title.

**Acceptance**
1. From the reveal's retirement tile → Will the money last? → the card is one tap away.
2. "Go deeper" lists three questions. Each opens its page and Back returns to the card (wave 1).

---

### (E) Connecting accounts, uploading statements

See section 3 for the verdicts. What exists:
- `transactions/import` reads CSV only. The README says "OFX/QFX/JSON are not read yet" (`README.md:3`), and the file
  picker accepts `.csv,.txt,.tsv` (HEAD `view.js:41`).
- Holdings reads Fidelity, Schwab and Vanguard position CSVs.
- The Statement reader reads PDFs, but only on the PC (`requires: "pc"`).
- The Document reader reads pasted text or `.txt` on the phone, PDF only through the PC.
  - A pay stub's 401(k) proposal needs an existing `401k` row (`ai/reader/compute.js:166-168`).
  - Its label regex `/40[13]\s*\(?[kb]\)?/i` (`:22`) would also catch a "ROTH 401K" line and read it as pre-tax.
- `transactions/connect` is a placeholder in codex's lane.
- The SimpleFIN proposal of 2026-10-31 (WORKBOARD) waits for the owner.
- The start and setup screens promise "No bank logins or account numbers, ever" (`start/view.js:96,146`,
  `setup/view.js:269`).

---

## 3. (E) Verdicts, with sources (read 2026-11-11; verify-web corrections applied)

| way in | verdict | why, with sources |
|---|---|---|
| **Pay stub, pasted, into the Document reader: Roth vs pre-tax 401(k) lines, the match, and creating the missing row** | **Build now (L7)** | It works on the phone with no AI and no PC (existing). No aggregator returns a deferral rate or a match formula (connect §7). The pay stub is the dependable source for exactly the inputs the owner named. No new parser library. |
| **OFX / QFX / QBO bank and card files in Import** | **Build now (L8)**, `Prompt: quick-ofx-import` | Open format. MIT parsers exist: ofx-js 1.1.2 (2026-09-30, MIT, "Copyright 2012-2017 Apps Attic Ltd.", credit both; verify-web M5) and ofx-data-extractor 1.5.0. A 32-line pure prototype read SGML 1.x and XML 2.x correctly (`scratchpad/rv/ofxproto/ofx.mjs`, `sample.qfx`, `sample2.ofx`). Runs in the browser. Never copy ofxtools (GPL-3). |
| Positions from OFX (`INVPOSLIST`) in Holdings | **Later**, after claude-h's review rounds on `investments/holdings` close (`docs/handoffs/review-2026-11-11/claude-h.md`) | Same parser. Useful where a 401(k) provider offers a QFX download. Fidelity NetBenefits' file route is uncertain (verify-web W6). |
| PDF statements on the phone (pdf.js in the browser) + a "retirement statement" kind (vested balance, contributions by source) | **Later** | pdfjs-dist 6.5.438 is Apache-2.0 (verify-web). About 1.7 MB the first time (measured 6.3.289: 458,705 + 1,265,413 bytes). Holdings tables are less reliable than label lines. Contributions by source are common but not required by 29 U.S.C. 1025. Check the pinned build on iOS Safari first, and use pdf.js's `legacy/` build if the modern one fails. |
| SimpleFIN Bridge through the PC server | **Later, only on the owner's explicit yes** | Documented: protocol v2.0.0-draft and a developer guide. One secret, kept in `planner.properties` (rule 10 allows it). Actual Budget's `app-simplefin.js` (MIT) is the pattern. **But:** it costs the owner $15 a year (beta-bridge.simplefin.org); it breaks the on-screen promise "No bank logins or account numbers, ever"; it works only when the app is opened from the PC, not from the GitHub Pages copy (the secret must not sit in shared `github.io` storage; iPhone mixed-content, verify-web W3); 401(k) coverage through MX is anecdotal; and it brings in balances and spending, not deferral rates or matches. Spending the owner's money and changing the promise are not the builder's call. Ask once, in the closing report. |
| Plaid | **Not** | A server-held secret and Link flow. The Trial is 10 Items for life (plaid.com/docs/account/billing). There is no CORS, so a browser cannot call it (measured). It does reach Fidelity by OAuth (verify-web W2), but a hobby app cannot easily get there. |
| Teller | **Not** | mTLS client certificate on a server. Account types are depository and credit only: no IRA or 401(k) (teller.io docs). |
| MX, Finicity / Mastercard, Akoya, Yodlee | **Not** | Business contracts and reviews. Finicity requires an executed contract (developer.mastercard.com onboarding). |
| OFX Direct Connect (live) | **Not** | Effectively dead in the US: GnuCash list 2025-12-02; BofA ended 2025-09-30; Amex 2023-08-30; Merrill stopped 2025-11. |
| CFPB §1033 open banking | **Nothing to build against** | The rule is enjoined (*Forcht Bank v. CFPB*, E.D. Ky., 2025-10-29). The rewrite has been at OIRA since 2026-08-04. No NPRM in the Federal Register as of 2026-11-11. |

**Smallest valuable thing now: L7 (pay stub) and L8 (OFX/QFX/QBO).**

L7 serves the owner's retirement worry directly ("maybe they didn't input how much they contributed … the match"):
- From the card, "Read it from a pay stub ›" → `#/ai/reader?kind=paystub`.
- Paste the stub, and the reader proposes:
  - "Add: Casey puts $X a paycheck into the 401(k) at work" (a new row when none exists);
  - "Roth 401(k) $Y a paycheck" as its own row, or the split (C1);
  - "Employer match $Z" when printed.
- Each proposal is applied only on "Use it" (rule 5).
- Keep the reader's "Account numbers are not read or kept".

L8 gives the "upload statements" half of the ask on every bank that offers a Quicken or QuickBooks download:
- A pure parser, `core/ofx.js` (the prompt's path, our own code, no dependency), returning
  `{ accounts: [{ kind, last4, currency, balance, balanceDate, rows: [{ date, amount, payee, memo, fitid }] }] }`.
- Detect by content (`OFXHEADER` or `<OFX>`), not by extension.
- Decode by the header's `CHARSET` (1252 via `TextDecoder("windows-1252")`).
- Dates: `YYYYMMDD[HHMMSS][.XXX][[-5:EST]]`, zone ignored.
- Decode `&amp;` and the other entities.
- `TRNAMT` keeps its sign.
- Feed `prepareRows` and the existing gap check.
- Offer "Update the balance to $X as of <date>?" from `LEDGERBAL` (one tap).
- **Never store the account number.** `last4` is shown once to help pick the account and is not saved, which keeps the
  on-screen promise.
- Duplicates: an optional `transactions[].extId` (the bank's FITID), checked before `key`. DATA_MODEL line, no bump.
- Fix `docs/RESOURCES.md`:
  - Plaid's "free development tier" ended 2024-06-20;
  - ofx-js is `bradenmacdonald/ofx-js`;
  - `transactions/connect`'s purpose drops "or Plaid".

**L8 tests** (`tests/ofx.test.mjs`, invented files inline)
- An SGML checking export, an XML card export with negative charges, a file with two accounts, a CHARSET 1252 file and a
  timezone date.
- Duplicate checks by FITID, and by `key` with no FITID.
- The plan JSON after import contains no ACCTID digits.
- The leak guard passes.

**L8 acceptance**
1. Import → pick the invented `.qfx` (the kit uses `setInputFiles`).
2. The preview shows the lines and the account guessed, with no column-mapping step and the balance offer.
3. Importing the same file twice adds 0.
4. Keep the picker's `accept` broad (`.csv,.txt,.tsv,.ofx,.qfx,.qbo,text/plain,application/x-ofx,application/vnd.intu.qfx`).
   iOS can grey out unknown extensions, so the parser decides by content.

---

## 4. Build order: small commits, each shippable alone

**Before L1 (no code).**
- Do AGENTS' start-of-phase checks: `docs/FEEDBACK.md` builder items, new DESIGN_LOG entries, `node qa/smoke-all.mjs`.
- `git pull`.
- Add claim rows in `docs/TEAM.md`, and delete your stale rows 64-66 and 71-74 for the files this touches.
- Post on WORKBOARD:
  - **to claude-c:**
    - gap 8 repro. On an Expenses-based plan, typing the same $6,430 flips tight to short at 77, because `retireHeld` is set
      only when `retireAuto` (`projection/compute.js` :1286-1288 and :987-989 at HEAD). The help line at `view.js:331` is
      then untrue.
    - defect A. Pay or pension before the household's retirement year is dropped, and in brackets mode its tax comes out of
      savings: $3,992 in 2026 on the family fixture with Bo at 75 (engine §1).
    - the leftover route (B1), and the left2 note to hide once a leftover row exists.
    - L9's match rule.
  - **to claude-f:** the L12 asks.
  - **to claude-e:** the `careLine2` item and your card on the same view.
  - **to claude-a:** `balance/projection` follows leftover rows.
  - **to claude-h:** OFX positions wait for your rounds.

| # | commit | files (lane) | value to the person |
|---|---|---|---|
| **L1** | Goal seek and Sensitivity stop treating a higher return as a fix | `scenarios/goal-seek/*`, `scenarios/sensitivity/*` incl. the `module.js` title, catalog row (free; views need a claim) | **Goal seek:** "the return it needs" becomes one gray line under the cards ("…most forecasts for the next 10 years are lower (U.S. stocks 4.8%-6.8%, Vanguard, as of 2026-09-30). That isn't a choice you can make; the cards above are.") with no Assumptions button; the claim-age pill says "helps", not "room to spare", when the plan is short; the saving card names a 401(k) that holds money with nothing going in. **Sensitivity:** gated with "We don't know yet" as the other two pages are; the saving row appears when nothing goes in (high end = `usualShare`); title "What changes your answer". Kills the "raise the return" trap and the contradictory $0/$0 page. |
| **L2** | "What this rests on" on Will the money last? | new `retirement/levers.js`, `tests/levers.test.mjs`; `retirement/projection/view.js` + README (claim; coordinate claude-e) | Part A where the person is: the numbers the answer rests on, whose each is, what one sensible change does, the filled "Check the numbers behind this ↓", the "Before your change / Now" line, the Go deeper links, `?check=1`. The leftover row is read-only here ("Count it ›" → Contributions). |
| **L3** | Contributions: landings, the match check, before and after | `retirement/contributions/{view,compute,README,module.test}` (claim) | `?add=<pid>` and `?match=<rowId>` land on the right box. A single row with a $0 match that was never asked gets "No match on file. Is that right?" [That's right] [It matches] [Not sure], from `workPlans[pid].match`. After a save: "Now runs out at 76 (was 66)". The match card's "common match" words use `matchTerms` (D-A4). Fixes the owner's "didn't input the match correctly" in one tap from the card. |
| **L4** | Count the leftover the way the person says | `projection/view.js`, `contributions/view.js`, `levers.js`, `DATA_MODEL.md` (`retirement.leftover`) | Part B: the biggest lever for most households, answered in place. "Invested" or "in the bank" becomes a visible row, with no double counting. |
| **L5** | Assumptions: careful / middle / hopeful, the range, and the effect | `system/assumptions/{compute,view,README,module.test}` (free; view claim); `projection/view.js` (the hero tag) | Presets as outlined chips above the stock box: Careful 6%, Middle 7% (ours), Hopeful 8%. Inflation chips: 2.5%, 3% (ours), 4%. One line "Most forecasts for the next 10 years: 4.8%-6.8% for U.S. stocks (Vanguard, as of 2026-09-30); 6.7% (J.P. Morgan 2026)" with sources in the existing fold. After Save, the notice adds "Your retirement answer: was runs out at 70, now runs out at 66" (from `projection/compute.js` `compute`, read-only). A typed stock return above 8% gives an amber notice ("Higher than any forecast we know; plan on it only if you have a reason") and the projection hero's tag "on your hopeful return". Keeps round 17's single filled "Save and mark as reviewed" (DESIGN_LOG 2026-09-15). The person checks inflation and returns with context and sees the effect. |
| **L6** | Pay the tax later or now, per row | `retirement/contributions/*`, `cashflow/paycheck/compute.js`, `career/benefits/compute.js` + tests | Part C: Later / Now / Some of each per person and per account, the match kept pay-the-tax-later, this year's tax difference, the rule of thumb, the mix at retirement, the catch-up line. |
| **L7** | The pay stub fills and checks the 401(k) | `ai/reader/{compute,view,README,module.test}` (free; view claim) | Part E, smallest valuable: a Roth 401(k) line read apart from pre-tax; the match when printed; the missing row created as a proposal; `?kind=paystub`; "Read it from a pay stub ›" on the card. |
| **L8** | OFX / QFX / QBO bank and card files | new `core/ofx.js`, `transactions/import/*`, `tests/ofx.test.mjs`, `DATA_MODEL.md` (`transactions[].extId`), `docs/RESOURCES.md`; `Prompt: quick-ofx-import` | Part E: no column mapping for most banks' "Quicken / QuickBooks" downloads, the balance kept current, no account number kept. |
| **L9** *(after left2 lands)* | A match on a Roth row counts as pay-the-tax-later | `projection/compute.js:939`, `taxes/federal/compute.js:305-307`, `DATA_MODEL.md` (`matchRoth?`), golden check | Correct tax treatment of the match by default. |
| **L10** *(after left2)* | A hopeful return never turns an answer green | `projection/compute.js` `savingVerdict` (all 11 pages follow) | Guardrail everywhere, not only on the hero. |
| **L11** *(after left2, if claude-c has not)* | Gap 8 and defect A | `projection/compute.js` and `core/math/retirement.js` (unclaimed), golden check | Typing a lower spending figure never makes the answer worse; a partner's pay before the household retires is not lost, and in brackets mode its tax no longer comes out of savings. |
| **L12** *(after claude-f releases)* | Check before fix, along the path | `overview/{guide,plan,alerts,dashboard}`, `setup/view.js` tile link | The words of D1, the Needs attention item, and "Small changes help" only when it is true. |

**Later, not in this batch:**
- OFX positions in Holdings (after claude-h).
- pdf.js in the browser and the retirement statement kind.
- "Check the leftover against the bank". Only with 3 or more months of cash-account `history`: "Your plan says $3,880 is
  left over each month, but your savings grew about $1,200 a month over the last 3 months. Some spending may be missing.
  Check Expenses ›". Never as a verdict.
- Balances after tax on Net worth ("about $73,000 after tax if the tax later is about 15%").
- Sensitivity regrouped into "Things you decide" / "Things nobody knows", 5 rows.
- SimpleFIN, on the owner's yes.

**Every commit:**
- `npm run registry`, `npm test && npm run check`, `node tools/leak-guard.mjs`.
- `tests/golden/retirement` unchanged, except L9 to L11, which explain any moved row in QUALITY.md.
- `node tools/shot.mjs <group>/<id>` at phone and desktop widths, plus `--dark`, and Read the PNGs.
- One CHANGELOG line; DATA_MODEL in the same change as any field.
- Never push to `main` with `--no-verify`.

---

## 5. Risks and how each is held

1. **A person "fixing" the plan by raising returns.** Investors expect 10.7% above inflation (Natixis 2025). The app's 7% is
   already at or above most 10-year forecasts (Vanguard 4.8-6.8%, J.P. Morgan 6.7%). FP Canada: "not prudent to increase
   return assumptions to 'force' a projection".
   - **Hold:**
     - Goal seek shows the needed return only as gray information (L1).
     - The lever row says "Check", shows both directions, and carries the "Nobody can choose this" line (D-A7).
     - Presets have sources; above 8% gives an amber notice plus the hero tag "on your hopeful return" (L5).
     - After left2, a hopeful return can never turn an answer green on any page (L10).
     - Effects are shown at average markets and labelled so. The careful hero line stays the headline.
   - **Do not** change the 7% default. It would move every answer and the golden keys, and it is the owner's standing
     choice.
2. **Guesses shown as facts.**
   - Every value carries Yours / Our guess / Usual figure / Not counted, with no colour.
   - "Usual" figures are labelled with what they are ("people with pay like Casey's usually put in about 6.6%") and their
     source sits in a fold.
   - A leftover worked out from guessed bills says so (D-B5).
   - The Social Security estimate says "our estimate from your pay; your real figure is on ssa.gov/myaccount".
   - No Roth vs traditional effect comes from the biased engine (D-C3).
   - Reader and OFX figures are proposals until "Use it".
   - Cite only what you opened. verify-web could not open these, so do not cite them on screen until you have:
     - the SSA Trustees 2.4% inflation figure (403);
     - Financial Engines' "1 in 4 miss the match" (403).
   - Never use "Even Boldin lists account linking as coming soon": it is wrong (verify-web W1).
3. **Money moving on typed figures (invariance).**
   - Nothing writes without a tap, and the person confirms every amount (rule 5).
   - Said = done: each effect the card shows equals the verdict after the matching save (tests in L2 and L4).
   - Plans without the new optional fields give identical compute output for every module on every qa fixture and household
     (an invariance test like `tests/guesses-invariance.test.mjs`), and the golden keys stay put.
   - The leftover row lowers the leftover shown by the same amount, so nothing is counted twice.
   - A split keeps the person's total own money.
   - Gap 8 (retyping the same spending changes the answer) is real at HEAD. Until claude-c or L11 fixes it, the spending
     row's effect is worked out with `saveSpendingFigure` on the copy. If that says less spending is worse, the row shows
     only "Change ›" with no effect line, and the case is reported on WORKBOARD.
   - `levers.js` must not import Next best action: NBA imports `savingVerdict`, so the import would loop. The view hands in
     `spare`.
4. **Phone width (390 px, and 320 px since wave 1).**
   - Records, never tables. Tags wrap under the label. Effect lines are sentences.
   - One filled button per page. 44 px targets. 16 px boxes (no iOS zoom).
   - No new global CSS: use `card`, `records`, `rec-foot`, `pill` with no colour class, `fold`, `chips`, `notice`.
   - The card fills after the first paint in 24 ms slices (`careful.js` `whenWorked` with `leverSteps`), with gray
     placeholders of fixed height, so nothing on the first screen moves. Measure every 20 ms (claude-e N3).
   - Five rows visible, the rest folded. Check dark mode.
5. **Safari.** The kit is Chromium with an iPhone UA, and no WebKit is installed here (`/opt/pw-browsers` has only
   chromium), so hold the line by construction:
   - no `requestIdleCallback`, which Safari lacks; `careful.js` already uses `requestAnimationFrame` + `setTimeout`;
   - nothing newer than what the app already uses (`Array.prototype.at`, `structuredClone` are in use; avoid
     `Promise.withResolvers`, `Array.fromAsync`, `Set` methods);
   - `TextDecoder("windows-1252")` is fine;
   - the file picker decides by content, not `accept`;
   - pdf.js (later) must be tried on iOS, with the `legacy/` build as a fallback;
   - Safari deletes `github.io` storage after 7 days without a visit (docs/PLAN.md:159), so a leftover answer can vanish with
     the plan on a phone that is not on the Home Screen. Nothing new to do, but do not promise it is kept.
   - If `npx playwright install webkit` works through the proxy, walk L2 and L4 in WebKit once. Otherwise say plainly in
     the closing report that Safari was not walked.
6. **Claims (the most likely way this goes wrong).**
   - `projection/compute.js`, `overview/setup/compute.js` and `guesses/estimators/*` stay claude-c's until left2 lands.
   - claude-f's overview folders and guide files are off limits until their row goes.
   - Wave 1's shell files are off limits.
   - claude-a's 13 folders are off limits (`balance/projection` needs no edit).
   - Holdings waits for claude-h's rounds.
   - `transactions/connect` is codex's idle lane: a Claims line and a message first, and only after the owner's yes.
7. **Cost on the phone.**
   - L2: about 12-16 projections. 50-130 ms on the PC in flat mode, more in brackets mode with Roth conversions (up to
     3.4 ms a run). Phones are 3-5 times slower.
   - Sliced, never blocking. Do not run Monte Carlo or `affordableSpending` per lever.
