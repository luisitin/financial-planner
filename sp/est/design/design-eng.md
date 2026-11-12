# Smart guesses: the engineering design (fitting the existing code with the least risk)

Status: proposal for the builder, 2026-11-02. Angle: where guesses live, how they stay fresh without ever
overwriting what the person typed, how every compute (phone, PC server, tests, another builder's page) sees the same
number, the core API, the in-repo data format, tests, migration, performance and the commit order.

Read with the two sibling designs in this folder: `design-stats.md` (which statistic, how tables combine, the
catalogue G01-G40 with formulas and persona answer keys) and `design-ux.md` (the box, the why-line, the screens, the
"Our guesses for you" page, wording). This document does not repeat their formulas or wording; it gives them a
spine that fits `core/store.js`, `core/schema/migrate.js`, `core/ui/dom.js`, the module contract and the setup's
existing `rateGuessed` / `paymentGuessed` / `ssWrote` pattern. Where the three disagree, section 14 says which way
and why.

Facts about the code this rests on (counted on HEAD, 2026-11-02): 271 `import { compute as X }` lines between modules;
157 `view.js` files read `plan`; 145 views import helpers from their own `compute.js` and call them with `ctx.plan`;
the shell loads every manifest at boot (`core/app.js` line 30, `Promise.all(registry.map(...load()))`) before
`store.load()`; manifests import `view.js`, so Node tests import `compute.js`, never `module.js`; the server's
`POST /api/compute/<g>/<id>` imports the module's `compute.js` and runs it on the plan the device sends.

---

## 0. The decisions in one screen

1. **A guess is an ordinary value in the plan plus one ledger entry.** The number goes where the typed number would
   go (`accounts[...].balance`, `debts[...].rate`, `expenses[...].amount`). A new optional section
   `plan.guesses = { [path]: { k, v, s, at, d } }` says which estimator wrote it. The field counts as a guess only
   while it still equals `v`: the rule `rateIsGuess` / `paymentIsGuess` / `ssWrote` already follow, generalised.
   Consequence: every compute everywhere reads one number with no change to any of the 271 cross-module imports, the
   PC server needs no change, and another builder's compute benefits without an edit.
2. **Fresh on write, never on read.** `core/store.js` gets one optional hook, `store.settleWith(fn)`, run inside
   `update()` right after the page's mutator, on the same draft, before the change is kept and sent. The shell
   registers `settle` from `core/estimate`. It re-runs each guess's estimator in tier order: still equal to `v` ->
   moved to the new estimate; different -> the person typed it, entry dropped; field gone -> entry dropped. It never
   creates a guess. It does not run on load, adopt, replace, resolve or another tab's save, so opening the app writes
   nothing and two devices cannot ping-pong.
3. **Three homes for an unknown, picked per field.** K1 stored guesses (above) for every box a page saves. K2 the
   compute-time fallbacks that exist today (`null` = from the plan) stay exactly as they are. K3 placeholder-only
   previews (calculator inputs in `whatIfs`, pay) are computed at render time and never stored. A read-time overlay
   of the whole plan was rejected (section 2.1).
4. **Layering.** Generic machinery in `core/estimate/` (paths, ledger, legacy adapters, the settle driver, the
   estimate driver; no data, no module imports) and the shared numeric helpers in `core/math/estimate.js`. Estimators,
   the household profile, the sourced tables and the page live in a new module, `modules/overview/guesses/`, because
   estimators need module data (the federal tables for take-home pay, the SSA wage index, Education's costs) and
   `core/` must never import `modules/`. Any module can add estimators by exporting `estimators` from its own
   `compute.js` and listing it in its manifest; the shell merges them at boot (same pattern as the guide's `frame`).
5. **Legacy flags stay where they are.** `debts[].rateGuessed` / `paymentGuessed`, `guide.setup.ssWrote`,
   `retireAuto`, `cushionTarget` / `cushionFunds` keep being written and read; `core/estimate` reads them through
   adapters as if they were ledger entries, and writing a debt rate or payment guess mirrors into the old flag. No
   `migrate()` change, no `SCHEMA_VERSION` bump. Folding them into the ledger is an optional last commit.
6. **A plan with no guesses is untouched.** `guesses` is not in `emptyPlan()` (read as `plan.guesses ?? {}`, deleted
   when it empties), `settle` returns at once when there is no ledger and no legacy flag, and nothing creates an entry
   except a page saving a box the person left blank. Every golden suite and every qa fixture runs exactly as today;
   a test proves it (section 9.5).
7. **Every number has a source and a date.** Tables are reduced at build time (`tools/build-guess-data.mjs`) to the
   cells estimators read, written to `modules/overview/guesses/data/<topic>.js` with publisher, table, URL, vintage
   and `readOn: "2026-11-02"`; derived constants (the CE income curves) are re-derived from those cells in the tests.
   An estimator that cannot cite a table returns `null`, and the box keeps a labelled example instead.
8. **Order of work**, ten small commits: plumbing (no behaviour change), the page and data (old guesses start to
   follow new answers), then by the walks' worst wrong figures: debts dropped when the balance is blank, spending
   blank = $0, retirement saving blank = $0, then the reveal and Dashboard, then the form kit and the pages outside
   the setup, then verdict ranges.

---

## 1. What the code does today, and what has to change

| failure in the walks | where in the code | change |
|---|---|---|
| A picked debt with its payment typed but "Still owed" blank is dropped, payment and all: Pat/Lee "owe $0", net worth $978,000, "Debt-free now"; Jordan's mortgage; Sam's car loan | `applyOweAmounts`: `const owed = ... pos(x.owed); if (!owed) { gone.push(id); continue; }` | a picked kind is a fact: blanks are guessed and marked (G21, G25 in design-stats) |
| A picked retirement tile with blank boxes makes no account, so the match step vanishes; a typed 0 brings it back | `applyHaveAmounts`: `if (amount === null && !mine && !match) { gone.push(id); continue; }` | balance, contribution and match guessed (G12-G14) |
| Blank spending is $0 and is counted: "about $86 a month", "Your month works", "$5,776 left over" | `applySpend` saves only `pos()` rows; Expenses, Next best action, Liquidity read the rows | blank rows written as guessed `setup-x-*` rows (G01-G10) |
| The mortgage guess is a new-loan rate (7.24% PMMS) on an old loan | `TYPICAL_RATES.mortgage` | existing-loan rate by state, FHFA NMDB (G20) |
| Boxes say one thing, the plan counts another: "e.g. 24.9" over "a typical 22.4%", "$ 0" over a guessed payment, a grey "3,500" that counts as $0 | setup `moneyIn`/`pctIn` placeholders; `ui.form` ignores `fd.placeholder` for `number` and `percent` | placeholder = the guess that will be written (design-ux 3) |
| Outside the setup nothing is guessed: Liabilities requires rate and payment (`required: true`), Net worth requires a balance, Contributions refuses "6%" | `modules/balance/liabilities/view.js` FIELDS; net-worth form; contributions form | the same estimators through `ui.form` field `guess` (commit 7) |
| Old guesses go stale: the Social Security estimate is redone only when the ages screen is saved again; retirement spending follows the bills only on the spend screen | `applyAges` `ssWrote`, `applySpend` `retireAuto` | `settle` refreshes every guess on every change |
| The reveal says "Not counted yet" for figures that are counted, lists market assumptions as "the plan's guesses", and misses the guessed zeros | setup `standing().later`, `guessed`, view `drawDone` | one list from `guessesInUse(plan)` (commit 6) |

---

## 2. Where guesses live

### 2.1 The options weighed

| | A. Read-time overlay (`withGuesses(plan)` before every compute) | B. Stored, never refreshed (today's setup pattern) | **C. Stored + ledger + settle on write (chosen)** |
|---|---|---|---|
| Same number in every compute | only if every entry point applies it: `safeCompute`, `computeOf`, `computeRemote`, the server route, and the 271 direct cross-module calls inside computes (a setup compute calling `computeExpenses(plan)` passes whatever plan it holds). Views that call their own helpers with `ctx.plan` (145) would see the raw plan: two answers on one screen | yes | yes |
| PC server, Node tests | server and tests must apply it too, or they compute a different plan | yes | yes |
| Stale guesses | never | yes (the walks' SS and retirement-spending staleness) | refreshed on every change |
| Forms | a form built from `ctx.plan` shows blanks (good) but a page that copies derived figures back saves the overlay as typed | the guess is shown as if typed unless the page checks a flag | blank + placeholder from the ledger; `saveField` keeps provenance |
| Writes and sync | none | none extra | a refresh rides inside a change the person made: no extra revision, no extra send |
| Golden tests | untouched only because tests skip the overlay, so they stop testing what the app shows | untouched | untouched (no fixture has a ledger) |
| Other builders' pages | must call the overlay in their computes and views | free | free (their computes read real numbers) |
| Export, backup, restore | figures can change on restore (new tables) | travel with the file | travel with the file |

A is the cleanest idea and the riskiest change: the plan object is read directly in hundreds of places by design
(PLAN.md principle 3, "Modules talk through the plan"). C is the setup's proven pattern made general, plus one hook.

### 2.2 The three homes (and one left for later)

| kind | what | stored? | examples |
|---|---|---|---|
| **K1 stored guess** | a box a page saves, left blank by the person | value in the field + ledger entry | debt owed / rate / payment, account balances, contribution and match, spending rows and the rough total, home and car value, retirement spending, the cushion target, Social Security from pay |
| **K2 compute-time fallback** (exists) | a field whose `null` already means "worked out from the plan" | nothing new | `taxes.thisYear.wages` (from Income), `taxes.dependentsUnder17` (from People), `goals[].rate` (plan default), `investments.target` (from `stocksNow`), `retirement.spendingMonthly` in the projection (today's expenses), every `whatIfs` "blank = from the plan" |
| **K3 preview only** | a box whose blank already has a meaning, or whose guess the person must accept by typing | nothing; `ctx.guess()` at render | calculator inputs (`whatIfs.*`), pay (design-ux open question 2), a stop-work age suggestion, children's ages chips |
| K4 stand-in plan (not proposed now) | a read-only overlay for whole sections never reached (the parent walk's skip path) | nothing | left for the owner (section 15) |

K2 fallbacks are not rewired in this work: some golden answer keys depend on them (the retirement golden plans
without `spendingMonthly`). When one is later pointed at an estimator ("one unknown, one answer"), its golden owner
signs off in the same commit.

### 2.3 The rule in one sentence

**A field is a guess while its value equals the value our estimator last wrote there; only a page that saved a
blank box writes one; every change re-estimates the untouched ones; typing, confirming or removing ends one.**

---

## 3. Data model

### 3.1 `plan.guesses`

```js
guesses: {
  "accounts[setup-owe-mortgage].balance": { k: "debt.mortgage.owed", v: 127000, s: 0.42, at: "2026-11-02", d: "2026-11-02" },
  "debts[setup-debt-mortgage].rate":       { k: "debt.mortgage.rate", v: 0.046,  s: null, at: "2026-11-02", d: "2026-11-02" },
  "expenses[setup-x-groceries].amount":    { k: "spend.groceries",    v: 480,    s: 0.25, at: "2026-11-02", d: "2026-11-02" },
}
```

| key | meaning |
|---|---|
| `k` | estimator key (`"<topic>.<name>"` for overview/guesses; `"<group>/<id>:<name>"` for one a module adds) |
| `v` | the value written, already rounded (number, string or array; compared by `same()`, 3.4) |
| `s` | spread on the log scale, `null` when the source does not measure one (design-stats 4.1); stored so verdict ranges need no re-estimate |
| `at` | the day `v` was last written (changes only when `v` changes, so a Continue that writes the same guess is no change, and setup's `wouldChange` stays false) |
| `d` | the read date of the tables behind it (`READ_ON` of the data files), the "older app" guard (5.4) |

Optional: not in `emptyPlan()`, read as `plan.guesses ?? {}`, and deleted when the last entry goes, so a plan whose
guesses were all typed over is byte-identical in shape to one that never had any.

### 3.2 Paths

Grammar (adopted from design-stats 5.1, tightened):

```
path    := segment ("." segment)*
segment := name | name "[" id "]"
```

* `name[id]` finds the item of the array `name` whose `id === id`. Exactly `id`: no alias on read except the one in
  3.2.1. ids are `ui.uid()` (UUID or base36) or setup ids (`setup-...`); neither contains `.`, `[` or `]`, and
  `parsePath` throws on one that does.
* A plain `name` walks an object key: `retirement.spendingMonthly`, `retirement.socialSecurity.setup-self.monthlyAtFRA`,
  `whatIfs.vehicle.price`.
* `getAt(plan, path)` returns `undefined` when anything on the way is missing; that is how "the record is gone" is
  detected. `setAt(draft, path, value)` never creates a missing record (it returns `false`).

#### 3.2.1 One canonical spelling

`debts[...]` may be written with the debt row's `accountId` by a caller that only knows the account (Liabilities
does): `canonical(plan, path)` rewrites it to the row's own id before anything is stored, so one field never has two
ledger keys. Reads accept both.

### 3.3 Legacy fields, read through adapters

| where it is today | read as | estimator key | mirrored on write |
|---|---|---|---|
| `debts[i].rateGuessed` | `debts[<id>].rate` | `debt.<kind>.rate` (kind from the setup id, else from the account type) | `markGuess` on a debt rate also sets `rateGuessed`; `clearGuess` deletes it |
| `debts[i].paymentGuessed` | `debts[<id>].minPayment` | `debt.<kind>.payment` | same, `paymentGuessed` |
| `guide.setup.ssWrote[pid]` | `retirement.socialSecurity.<pid>.monthlyAtFRA` | `overview/setup:ss` | settle updates `ssWrote[pid]` with the field |
| `guide.setup.retireAuto === true` | `retirement.spendingMonthly` | `overview/setup:retireSpend` | settle keeps `retireAuto` true |
| `guide.setup.cushionTarget`, `cushionFunds` | `goals[setup-goal-cushion].target`, `.fundedBy` | `overview/setup:cushionTarget`, `:cushionFunds` | settle updates both |

`guessesInUse(plan)` returns the ledger plus these synthetic entries (the ledger wins on a shared path). The readers
that exist (`journeys.js detailed()`, `standing().guessed`, `revealWords`, `household/people` person removal) keep
working untouched. The three setup keys are registered by the setup's own `compute.js` (`estimators`), because their
formulas (`estimateSocialSecurity`, `retireDefault`, `cushion`) import other modules' computes and the guesses module
must not import the setup (the setup imports it).

### 3.4 Equality

`same(a, b)`: numbers equal within `max(0.005, 1e-9 * |a|)` (a rate stored to 0.001% and a payment to cents both
compare as the setup compares them now); strings exact; arrays and objects by `JSON.stringify`.

### 3.5 What `migrate()` does

Nothing. `emptyPlan()` is unchanged, the back-fill loop does not add `guesses`, and `ownersToIds` is untouched. A
person removed on People leaves ledger paths that no longer resolve; the settle that runs inside that same update
drops them (household/people needs no edit).

### 3.6 `docs/DATA_MODEL.md` row (same commit as the code)

> | `guesses` | `{ [path]: { k, v, s, at, d } }` -- figures the plan filled in where a box was left blank. `path` names
> the field (`accounts[<id>].balance`, `debts[<id>].rate`, `retirement.spendingMonthly`; grammar in
> core/estimate/paths.js), `k` the estimator (modules/overview/guesses README), `v` the value written (rounded), `s` its
> spread on the log scale (null = not measured), `at` the day it was last written, `d` the read date of the tables
> behind it. The field itself holds an ordinary value every page reads; it is a guess only while it still equals `v`.
> Written only where a person left a box blank (`markGuess` / `saveField`); refreshed on every change while untouched
> (`settle`, core/store.js); dropped when typed over, confirmed ("That's about right") or when its record is removed.
> Older guesses stay where they were and are read the same way: `debts[].rateGuessed` / `paymentGuessed`,
> `guide.setup.ssWrote`, `retireAuto`, `cushionTarget` / `cushionFunds`. Optional (not in `emptyPlan()`, read as
> `plan.guesses ?? {}`, removed when empty); added 2026-11-xx | overview/guesses |

---

## 4. The core API

### 4.1 Files

| file | what | imports |
|---|---|---|
| `core/estimate/paths.js` | `parsePath`, `getAt`, `setAt`, `canonical`, `pathsOfRecord(listName, id)` | nothing |
| `core/estimate/ledger.js` | `same`, `isGuess`, `guessAt`, `markGuess`, `clearGuess`, `saveField`, `guessesInUse`, `guessesTouching`, `LEGACY` adapters | paths.js |
| `core/estimate/engine.js` | `estimate`, `settle`, `checkEstimators` | ledger.js, paths.js |
| `core/estimate/index.js` | re-exports; the only import path for pages | the three above |
| `core/math/estimate.js` | `interpLinear`, `interpLog`, `combineLog`, `propagate`, `elasticity`, `strengthOf`, `middleHalf`, `roundGuess`, `typoCheck`, `rangeOf` (formulas: design-stats 3 and 4) + `tests/estimate-math.test.mjs` | nothing |
| `core/store.js` | `settleWith(fn)`, `takeSettled()`; one call in `update()` | unchanged imports |
| `core/app.js` | merge manifests' `estimators`; register settle; `ctx.guess` | core/estimate |

Everything in `core/estimate` and `core/math/estimate.js` is pure and dependency-free (no `document`, `window`,
`fetch`, `localStorage`, timers) and imports cleanly in Node; `npm run check` already enforces this for modules and a
new line in `tools/check.mjs` extends the purity grep to `core/estimate/*.js` and `core/math/*.js`.

### 4.2 Signatures

```js
// core/estimate/paths.js
export function parsePath(path)               // -> [{ name, id? }]; throws on a malformed path
export function getAt(plan, path)             // -> value | undefined
export function setAt(draft, path, value)     // -> true | false (false: a record on the way is missing; nothing created)
export function canonical(plan, path)         // debts[<accountId>] -> debts[<debt id>]; otherwise the same string
export const pathOf = (list, id, field) => `${list}[${id}].${field}`

// core/estimate/ledger.js
export function same(a, b)                    // 3.4
export function guessAt(plan, path)           // -> { path, k, v, s, at, d, legacy?: true } | null, only while same(getAt, v)
export function isGuess(plan, path)           // -> boolean
export function guessesInUse(plan)            // -> entries (ledger + legacy), only those still in use
export function guessesTouching(plan, sections)   // entries whose first segment is in sections (a manifest's `needs`)
/** Write a guess: the field and its entry. Idempotent: same k and v -> no change at all (at stays). */
export function markGuess(draft, path, guess, today)          // guess: Estimate (design-stats 2.1); -> boolean changed
/** The person typed it, confirmed it, or cleared it: drop the entry (and the legacy flag); the value stays. */
export function clearGuess(draft, path)                        // -> boolean changed
/** The one call a page makes when it saves a box that may hold a guess. */
export function saveField(draft, path, read, guess, today)
//   read = { value, guessed } from ui.form meta or a guessBox:
//   guessed && guess  -> markGuess(draft, path, guess, today)       (left blank: our figure, marked)
//   !guessed && value !== null -> setAt(draft, path, value); clearGuess(draft, path)   (typed: theirs, even if equal)
//   !guessed && value === null -> setAt(draft, path, null); clearGuess(draft, path)    (cleared and no guess: as today)

// core/estimate/engine.js
/**
 * One estimate. estimators: the merged registry. opts: { today, path?, rec?, args? } (args = what is on the screen and
 * not saved yet, so a preview equals what saving the blank box would write). Validates the result: finite value,
 * at least one table id in `tables`, `dataAsOf` present; otherwise null.
 */
export function estimate(plan, key, { estimators, today, ...opts })   // -> Estimate | null
/**
 * Refresh the guesses in a draft (inside store.update). Tier order (T1 pay, T2 owned and owed, T3 spending, T4 saving
 * and retirement; inside a tier the order of the registry). Never creates an entry.
 */
export function settle(draft, { estimators, today, dataAsOf })
//   -> { changed: [{ path, k, from, to }], dropped: [{ path, k, why: "typed" | "gone" }] }
/** For tests and check.mjs: every estimator has tier, order, label, unit; `reads` names only earlier keys; no key twice. */
export function checkEstimators(estimators)   // -> [problem strings]
```

### 4.3 The estimator contract (what a module exports)

```js
// in any module's compute.js (pure), and listed in its manifest as `estimators`
export const estimators = {
  "debt.mortgage.owed": {
    tier: 2, order: 21,                       // settle order; T2 before T3 before T4
    label: "Mortgage still owed",             // the guesses page and the reveal list
    unit: "total",                            // month | year | total | rate | age | year-date
    page: (path) => "#/balance/liabilities",  // where the real figure is typed
    reads: ["home.value", "home.yearBought", "debt.mortgage.rate"],   // earlier estimators it may call (checked)
    fn(plan, opts, lib) { /* -> Estimate | null */ },
  },
};
// lib = { estimate(key, opts) (earlier keys only), profile() (memoised for this pass, see 5.3), today, data }
```

The returned `Estimate` is design-stats 2.1 (`key, value, unit, sigma, low, high, strength, basis, uses, tables,
dataAsOf`), plus `why` (design-ux 4.1's words after "Our guess:") and `sharperWith` (design-ux 4.3).

### 4.4 The store hook

```js
// core/store.js
let settleFn = null, settled = null;
export const store = {
  ...
  /** Register the function that refreshes guesses inside every update (core/app.js does it at boot). */
  settleWith(fn) { settleFn = typeof fn === "function" ? fn : null; },
  /** What the last update's settle changed, once: { changed, dropped } | null (the shell adds "2 guesses moved with it"). */
  takeSettled() { const s = settled; settled = null; return s; },
  update(mutator) {
    otherTab();
    const next = structuredClone(plan);
    mutator(next);
    if (settleFn) { try { settled = settleFn(next); } catch (e) { settled = null; console.error("[store] settle failed", e); } }
    plan = touch(next);
    keepHere(plan);
    notify();
    this.scheduleSave();
  },
};
```

Five lines, no new import in `store.js`. A throwing settle never loses the person's change (the mutator's draft is
kept as it is). `load`, `adopt`, `replace`, `resolve`, `resync` and `otherTab` do not call it: an open never writes,
a restored file is kept exactly as it was, and a change made on another device is never re-guessed by this one until
this one's person changes something.

### 4.5 The shell

```js
// core/app.js, after the manifests load
const ESTIMATORS = {};
for (const m of modules.values()) for (const [k, e] of Object.entries(m.estimators ?? {})) {
  if (ESTIMATORS[k]) { console.error(`[planner] estimator ${k} is defined twice (${m.group}/${m.id})`); continue; }
  ESTIMATORS[k] = e;
}
store.settleWith((d) => settle(d, { estimators: ESTIMATORS, today: fmt.today(), dataAsOf: GUESS_DATA_AS_OF }));
// makeCtx: one new field
guess: (key, opts = {}) => estimate(store.get(), key, { estimators: ESTIMATORS, today: fmt.today(), ...opts }),
```

Estimators of a page switched off in Settings stay in the registry: guesses are plan data, not page UI. A duplicate
key is a test failure (`tests/modules.test.mjs` gains the check by importing every `compute.js` and reading its
`estimators` export, the Node-safe way).

`GUESS_DATA_AS_OF` comes from `modules/overview/guesses/data/index.js` through the guesses manifest
(`dataAsOf` field), so `core/app.js` still imports no module directly.

### 4.6 Nothing changes on the PC server

The server never edits the plan (it stores what devices send) and its compute route runs `compute(plan, params)`
on that plan, which already holds the guessed values. `settle` is not run there. `POST /api/compute/overview/guesses`
works like any other module (the ranking on the guesses page is `heavy: true`, design-ux 7).

---

## 5. The guesses module: `modules/overview/guesses/`

### 5.1 Files

| file | contents |
|---|---|
| `module.js` | manifest: `id: "guesses"`, group overview, title and purpose from design-ux 7, `status: "usable"`, `heavy: true`, `needs`: every section that can hold a guess, `writes`: the same + `guesses`, `estimators`, `dataAsOf` |
| `compute.js` | `estimators` (the core set, design-stats 6 G01-G40 in tier order), `profileOf(plan, today)`, `compute(plan, params)` for the page (rows, ranking, sources), `listWords(entry, estimate)` |
| `estimators/spend.js`, `saving.js`, `home.js`, `debts.js`, `pay.js` | the estimator objects by topic, so `compute.js` stays readable (CONVENTIONS: "anything else the page needs") |
| `data/index.js`, `data/spend.js`, `data/balances.js`, `data/debts.js`, `data/home.js`, `data/pay.js`, `data/health.js`, `data/states.js` | the compact tables (section 6) |
| `view.js` | the page (design-ux 7.1) |
| `README.md` | purpose; every estimator's formula, tables and conditioning order with its source (AGENTS rule 3); the tiers; the ledger rules; the data build; sources table with read dates; which are industry sources |
| `module.test.mjs` | section 9 |

Import rule for `compute.js` and `estimators/*.js` (checked by a test that reads their import lines): only `core/*`,
its own `data/`, and other modules' `data/*.js` files (`modules/taxes/federal/data/federal.js`,
`modules/retirement/social-security/data/ssa.js`), never another module's `compute.js`. That keeps it free of import
cycles: setup, liabilities, net worth, expenses and contributions import it; it imports none of them.

### 5.2 Why a module, not `core/estimate/data`

* The estimators need module tables (take-home pay for the spending cap uses `FEDERAL` and the payroll rates; the
  Social Security estimate uses `WAGE_INDICES`); `core/` must not import `modules/`.
* AGENTS rule 3 puts every formula in a README with its source; `core/` has no README per file, a module does.
* CONVENTIONS "Where things go" already says a lookup table lives in `modules/<group>/<id>/data/<name>.js` with its
  source year; the guesses module is that place for population tables.
* The page that lists and edits every guess has to exist anyway (design-ux 7).

### 5.3 The profile

```js
/** What the estimators condition on, from the plan as it is now (typed values marked as such, guesses with their spread). */
export function profileOf(plan, today) -> {
  today, year,
  adults: [{ id, role, age, ageKnown, pay, payHow: "typed" | "guess" | null, paySigma, works, retired, byOwnBusiness }],
  kids: [{ id, age }], size, householdType: "single" | "couple" | "couple-kids-under6" | "couple-kids-6to17" | "one-parent" | "other",
  state, region, tenure: "rent" | "own-mortgage" | "own" | null,
  householdPay, takeHomeMonthly,               // federal tables + payroll + the state's flat rate when known
  has: { checking, savings, retire, invest, home, car }, owes: { credit, car-loan, student, mortgage, loan },
}
```

Built in one pass over people, income, accounts and debts (no transactions), memoised per settle tier (`lib.profile()`
recomputes after each tier so T3 spending sees the T2 values just written). `payHow` follows design-stats 4.3: a
guessed predictor is passed on with its spread and named in the basis ("your pay is our guess too"), never as typed.

### 5.4 Settle, step by step

```
settle(draft, { estimators, today, dataAsOf }):
  if no draft.guesses and no legacy flag in draft: return { changed: [], dropped: [] }      // O(1) for most plans today
  entries = guessesInUse-like walk over ledger + legacy (ledger wins), each with its estimator or none
  for tier in 1..4, for entry in that tier by registry order:
    cur = getAt(draft, path)
    if cur === undefined                -> drop (why "gone")
    else if !same(cur, entry.v)         -> drop (why "typed")
    else if !estimators[entry.k]        -> keep, frozen (the code that made it is gone; the page says "type the real figure")
    else if entry.d > dataAsOf          -> keep (this app is older than the tables that wrote it: never downgrade)
    else est = estimate(draft, k, { path, rec, today, estimators })
         if est && !same(est.value, entry.v): setAt; entry.v = est.value; entry.s = est.sigma; entry.at = today;
                                              entry.d = est.dataAsOf; mirror legacy flag; changed.push(...)
  delete draft.guesses when empty
```

Properties (each a test, 9.3): never creates an entry; never writes a field whose value differs from its entry's
`v`; idempotent (`settle` twice = once); a single pass reaches the fixed point (no estimator reads a same-or-later
tier, `checkEstimators`); returns the same draft object it was given (no clone).

### 5.5 How a guess becomes stale, and what happens

| what changed | what settle does |
|---|---|
| an answer it depends on (pay, age, state, a typed balance, a typed payment) | re-estimates on that same save; the page's green notice adds "2 of our guesses moved with it" (`takeSettled`) |
| the person typed the field | entry dropped; the field is theirs for good, even if they typed the same figure (`saveField` clears it) |
| the record was removed (a debt deleted, a person removed) | entry dropped |
| a birthday or a new year (age-based guesses) | re-estimated at the next change, never on open |
| new tables shipped (a newer `READ_ON`) | re-estimated at the next change; an older app on another phone never puts the old figure back (`d` guard) |
| the estimator was removed from the code | kept as a frozen guess, still labelled "our guess", listed first on the guesses page with "type the real figure" |
| a page that knows nothing about guesses saves the field with a new value | dropped at the next settle (value differs). Saved with the *same* value: stays a guess (harmless: the number is the same; rounding to 2-3 significant figures makes an accidental match rare; see risk R2) |

---

## 6. The data files

### 6.1 Format

```js
// modules/overview/guesses/data/spend.js
// GENERATED by tools/build-guess-data.mjs from vendor/guess-data/spend.json (read 2026-11-02). Edit the build's
// SELECT list or its inputs and rebuild; never this file. Formulas that use these cells: ../README.md.
export const READ_ON = "2026-11-02";
export const T = {
  ce2025_spend_by_incomeQuintile: {
    title: "Average yearly spending by category, by income fifth",
    publisher: "U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys",
    table: "Table 1101. Quintiles of income before taxes, 2025",
    url: "https://www.bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/cu-income-quintiles-before-taxes-2025.xlsx",
    vintage: "2025 data, released October 2026", readOn: "2026-11-02",
    stat: "mean", unit: "dollars a year per household", dollarsOf: 2025, industry: false,
    by: "incomeQuintile",
    cols: ["all", "lowest20", "second20", "third20", "fourth20", "highest20"],
    rows: {
      totalExpenditures: [81905, 37935, 51405, 68983, 92250, 159512],
      foodAtHome:        [6491, 3600, 5079, 6002, 7504, 10308],
      // ... only the items an estimator reads
    },
  },
  // ...
};
```

* Columnar: one `cols` list, then one array per row in the same order (a state table's `cols` is `STATES` from
  `data/states.js`, shared). Values exactly as published, never rounded or inflated at build time.
* Table keys are the research ids (`ce2025_spend_by_incomeQuintile`, `vanguard_has2026_401k_balance_by_age`,
  `mortgage_outstanding_fhfa_by_state_2026q2`, `acs2025_median_home_value_by_state`, `scf2025_median_value_if_held`
  ...), so an estimator's `tables` list, the README and the raw files all use one name.
* Derived constants (the CE income curves, design-stats R2; band middles; the Vanguard median/average ratio) are
  computed by the build and written in a separate `DERIVED` export with the cells they came from; `module.test.mjs`
  recomputes each from `T` and compares, so a hand edit cannot drift.
* `data/index.js` exports `GUESS_DATA_AS_OF` = the oldest `READ_ON` of the files, used by settle's `d` guard.

### 6.2 Size and what is kept

The research files total 4.9 MB (insurance-health 2.4 MB alone). The SELECT list keeps only what design-stats
section 6 reads: about 30 tables, about 4,000 numbers, roughly 35-45 KB of JS before gzip (the server gzips; about
10 KB on the wire). Tables cited by design-stats but not yet in `est/data/*.json` (`naic2023_homeowners_premium_by_state`
in `est/part_naic.json`, the CCAoA childcare prices in `est/part_ccaoa.json`) are optional inputs: the build skips
them with a warning, and their estimators (G24 home insurance, the childcare row's local price) fall back to the CE
item until those tables are merged into the research files with their sources.

### 6.3 Where the raw files live

`vendor/guess-data/*.json` (git-ignored like the rest of `vendor/`, listed in `vendor/sources.json` with every source
URL so `tools/fetch-vendor.mjs` documents them). The compact files are committed and are the source of truth for the
app; every value in them carries its URL, so a reviewer can check a cell against the publisher without the raw
files. US government tables are public domain; Vanguard, KFF, Experian, NAR and LIMRA figures are facts quoted with
their source (AGENTS rule 11: facts, not code), and `industry: true` marks them so an estimator prefers a government
table when both exist.

### 6.4 Refreshing the tables

Each file's header names the next release ("CE 2026 comes out in September 2027"). A yearly data commit rebuilds
them; `settle` then moves untouched guesses at each person's next change, and the README's "last checked" line
moves. A test fails when any `readOn` is later than the test's fixed `today`, never on age (tests stay deterministic).

---

## 7. How a page uses it

### 7.1 The setup (overview/setup), which shows the pattern

`valuesFor(plan, screen)`: a field that `isGuess` comes back as `""` (as debts already do for a guessed rate or
payment), so the box shows the grey guess, never the guess as if typed.

The view computes each box's placeholder with the same call the save will make, passing what is on the screen:

```js
const g = ctx.guess("debt.mortgage.owed", { path: pathOf("accounts", oweId("mortgage"), "balance"), args: { payment: x.payment, rate: x.rate } });
// box placeholder = g.value (formatted), help = "Our guess: " + g.why (design-ux 4)
// re-run on input of payment or rate (one estimate per keystroke, well under a millisecond)
```

The apply functions take one new argument, the estimate driver, so they stay pure and testable without the shell:

```js
export function applyOweAmounts(draft, v, today, { guess } = {})   // guess(key, opts) -> Estimate | null
  // owed blank and the kind picked: const g = guess(`debt.${o.key}.owed`, { path, args: { payment, rate } });
  //   put the account with balance g.value, then markGuess(draft, path, g, today). Never `gone.push` for a picked kind.
  // rate and payment: as today, through markGuess (which also mirrors rateGuessed / paymentGuessed)
```

The view passes `guess: ctx.guess`; tests pass `guess: (k, o) => estimate(plan, k, { estimators: ALL, today, ...o })`.
The README rule "a blank box saves nothing" becomes "a blank box saves our guess, marked as one, for anything you said
you have; a blank box with no estimator saves nothing". `wouldChange` keeps working because `markGuess` is
idempotent.

**Preview equals written** (design-ux rule 1) is a test: for every setup screen and every guessable box, the
placeholder computed from `valuesFor` + the screen's args equals the value the apply function writes when the box is
left blank, and stays equal after the settle that follows.

### 7.2 A page built on `ui.form`

`ui.form` field schema gains `guess` (design-ux 3.6, the designer's lane). The page:

```js
const path = pathOf("debts", d.id, "rate");
const fields = [{ key: "rate", label: "Interest rate a year", type: "percent", guess: ctx.guess(`debt.${kind}.rate`, { path }), ... }];
ui.form(fields, { rate: isGuess(plan, path) ? null : d.rate }, (values, meta) => {
  pending = [{ kind: "ok", text: "Saved." }];
  ctx.store.update((draft) => {
    saveField(draft, path, { value: values.rate, guessed: meta.guessed.has("rate") }, fields[0].guess, today);
  });
});
```

`required` is dropped by the kit when a field has a `guess` (blank is an answer). After the update, the shell's
`takeSettled()` lets the page's notice add "2 of our guesses moved with it" (design-ux wording).

### 7.3 Showing that a figure rests on guesses

| need | call |
|---|---|
| is this one field a guess? | `isGuess(ctx.plan, path)` / `guessAt(...)` for its `k`, spread, date |
| which guesses does this page's figure rest on? | `guessesTouching(ctx.plan, ctx.module.needs)` (the shell's grey note, design-ux 6.1) |
| a compute output that says so | additive keys in the module's own output, e.g. Expenses `guessedMonthly`, Liabilities `rows[].guessed = { owed, rate, payment }`, Next best action `spare.guessedShare`; never a changed meaning of an existing key (golden keys stay) |
| a verdict that a guess could flip | `rangeOf(fn, plan, paths)` (design-stats 4.6), run only when `params.ranges` is set and memoised by `plan.meta.rev` in the view (8.3) |
| the assistant | `core/ai.js planSummary` tags guessed figures "(our guess)" so the model never presents them as the person's numbers (one line, commit 6) |

### 7.4 What scenarios do

`scenarios/compare` applies levers to a copy of the plan and does not settle it: a "what if I earned 10% more"
keeps today's guessed spending (a what-if changes only what it names). The guessed values are inputs like any other
there.

---

## 8. Performance

### 8.1 Budget

| work | when | budget (phone) | how it stays there |
|---|---|---|---|
| `settle` on a plan with no guesses | every change | ~0 | returns before any work (no ledger, no legacy flag) |
| `settle` with ~30 guesses | every change | < 3 ms | profile once per tier (no transactions read), estimators are table lookups and a few `exp`/`log`; the T4 setup estimators (`estimateSocialSecurity`, `retireDefault`) are the slowest at well under 1 ms each |
| a placeholder | each guessable box per render, each keystroke on the boxes it reads | < 0.2 ms | one estimator call |
| loading the tables | once per code version | ~10 KB gzipped | the server's hashed, immutable import map (PLAN 11) |
| the guesses page ranking (design-ux 7.2) | that page, the done screen | 0.3-1 s on a phone for 25 guesses x 2 x three headline computes | `heavy: true` (PC when connected); only the top 8 by static `weight` go through the expensive pass; memoised by `plan.meta.rev` in the view; the Dashboard uses the memo when it matches and the static weight otherwise |
| verdict ranges (design-stats 4.6) | tiles that show a verdict | < 30 ms | guessed spending moved as one group (one low and one high run, not one per row), memoised by `meta.rev` |

### 8.2 Test

`tests/estimate-perf.test.mjs`: `settle` on the largest qa plan with 40 marks, 200 times, under 400 ms total in Node
(2 ms each, generous so a busy machine does not fail it); the no-guess early exit 10,000 times under 50 ms.

### 8.3 Memo, not state in compute

`compute.js` stays free of caches (it must be pure and deterministic); the memo for ranking and ranges is a
module-level `Map` in `view.js` keyed by `plan.meta.rev`, cleared when the rev changes.

---

## 9. Tests

### 9.1 Plumbing, hand-worked (no tables)

`tests/estimate-paths.test.mjs`
* `getAt` on `accounts[a1].balance`, on `retirement.socialSecurity.p1.monthlyAtFRA`, on a missing id -> `undefined`.
* `setAt` on a missing record returns `false` and creates nothing; `parsePath` throws on `accounts[a.b].balance`.
* `canonical(plan, "debts[acct-9].rate")` -> `"debts[d-3].rate"` when the row `d-3` has `accountId: "acct-9"`.

`tests/estimate-ledger.test.mjs`
* `markGuess` writes field and entry; a second call with the same estimate changes nothing (`at` kept,
  `wouldChange` false); a new value updates `v` and `at`.
* `isGuess` true while equal; false after the field changes; legacy `rateGuessed: 0.2236` on a row with
  `rate: 0.2236` reads as `debts[<id>].rate`, `k: "debt.credit.rate"`.
* `saveField` typed 450 with the guess at 450 -> entry gone (typed equal still counts as typed); blank with guess ->
  marked; blank without guess -> field null, no entry (today's behaviour).
* The last `clearGuess` deletes `plan.guesses`; `JSON.stringify` of the plan equals the plan before the first mark.

`tests/estimate-settle.test.mjs`, with stub estimators (numbers by hand):
* `x.double` (tier 1) = 2 x typed `meta.n`: mark it at 2 x 5 = 10; set `meta.n = 7`; settle -> field 14,
  `changed: [{ from: 10, to: 14 }]`.
* the person types 11 over it; settle -> 11 kept, `dropped: [{ why: "typed" }]`; change `meta.n` again -> 11 stays.
* a tier-3 stub reading the tier-1 one sees the new 14 in the same pass.
* the record removed -> `dropped: [{ why: "gone" }]`; `plan.guesses` deleted when empty.
* settle twice: second result `{ changed: [], dropped: [] }`, same JSON.
* an entry with `d: "2027-11-01"` and `dataAsOf: "2026-11-02"` -> untouched.
* an entry with an unknown `k` -> untouched, still `isGuess`.
* `checkEstimators` reports a `reads` of a later tier, a duplicate key, a missing `label`.
* fuzz: 500 random sequences of {type a field, blank a field, change a predictor, remove a record, settle} over three
  stub fields; invariant after each step: every field last typed holds its typed value.

`tests/store-settle.test.mjs` (alongside `tests/store-sync.test.mjs`, same harness)
* a registered settle runs once per `update`, on the draft, before the change is kept; `load`, `adopt`, `replace`,
  `resolve` and another tab's save do not call it; a throwing settle keeps the mutator's change and logs; with no
  settle registered every existing store test passes unchanged.

### 9.2 Math (`tests/estimate-math.test.mjs`)

One test per helper with the numbers from design-stats: `combineLog` ($12,170 s 0.70 with $12,840 s 0.78 -> about
$12,464, s 0.521, shown $12,500); `propagate` (0.25 own, elasticity 0.39 x 0.61 -> 0.35); `strengthOf` thresholds;
`interpLog` across Vanguard income buckets (no jump at a bucket edge: `f(49,999)` and `f(50,000)` within 0.1%);
`roundGuess` by strength (design-stats 2.5); `typoCheck` (5 against $265, s 0.6 -> asks).

### 9.3 Estimators (`modules/overview/guesses/module.test.mjs`)

* Data: every table has publisher, url, vintage, `readOn`; `cols.length` equals every row's length; spot values equal
  the published ones (CE all-households spending $81,905; Vanguard 35-44 median $46,919; FHFA Ohio average rate 4.6%,
  Arizona 4.3%; ACS Ohio median home value $254,100; ACS Texas median gross rent $1,515); `DERIVED` recomputed from
  `T` matches.
* Contract: every estimator in the registry returns `null` or an Estimate whose `tables` all resolve to a `T` entry,
  `low <= value <= high` when present, `dataAsOf` set; `checkEstimators(ALL)` is empty; the import-rule check (5.1).
* Answer keys, from design-stats 6 (the formulas' own hand-worked persona numbers): Sam's car loan from a $420
  payment about $12,500 (G25); Jordan's mortgage rate 4.6% and still owed about $127,000 from a $1,100 payment (G20,
  G21); Pat and Lee's mortgage about $170,000 from $1,600 (G21); Sam's 401(k) about $3,100 and Jordan's about $26,000
  (G12); Jordan's contribution about $270 and match about $180 (G13, G14); the spending rows and the capped total of
  section A. Each test writes its arithmetic in a comment, as `modules/overview/setup/module.test.mjs` does for the
  30-year payment.
* Monotonicity: typing pay never widens a spending range; a higher typed pay never lowers a balance guess (design-stats
  4.3 rule 3).
* Personas live in qa (the tester's lane): ask the tester to add the three walk households under `qa/households/`
  (invented, as AGENTS rule 15 requires); the answer keys reference them by folder.

### 9.4 The setup (`modules/overview/setup/module.test.mjs`)

* With every box typed: no `guesses` key, and the records equal today's (the existing tests stay as they are).
* Changed on purpose, listed in the commit messages: a picked debt with only a payment is kept (owed and rate
  marked); a picked retirement tile with blank boxes makes the account with three marks; blank spending rows are saved
  as marked rows and the "Got it" line counts them; the mortgage's guessed rate is the state's existing-loan rate
  (the mortgage test at lines 444-453, which works the 30-year payment at 7.24% by hand, moves to the state rate; the
  card, car and student rates and their test at line 211 are unchanged). `TYPICAL_RATES` stays exported from the setup
  (re-exported from the guesses data), so the README check at line 375 and `journeys.js` keep working; the README
  gains the FHFA line for an existing mortgage.
* Preview equals written (7.1), for every guessable box on every screen.
* Walk replays: the three walks' answers through the apply functions; the reveal's figures fall in the ranges the
  walks called realistic (Sam's left over between -$700 and +$300 with "depends on our guesses"; Pat and Lee owe
  more than $100,000; Jordan's match step is open).

### 9.5 A plan with no guesses behaves exactly as today (`tests/guesses-invariance.test.mjs`)

* For every plan in `qa/fixtures/*-plan.mjs`, every `qa/households/*` and every plan the golden suites build: `settle`
  returns no change and the plan's JSON is identical; `migrate()` of it adds no `guesses` key.
* For the same plans, every module's `compute()` gives deep-equal output with and without the settle hook registered
  (the hook is a no-op on them; this pins that no estimator ever creates).
* Every `tests/golden-*.test.mjs` suite runs unchanged in `npm test` (they never mark a guess).

---

## 10. Migration and documentation

* **Schema:** no version bump. `guesses` is optional; legacy flags keep their meaning and shape.
* **`docs/DATA_MODEL.md`:** the `guesses` row (3.6); in the `debts` row and the `guide` row, one clause each: "read as
  guesses by core/estimate (`guessAt`)".
* **`docs/CONVENTIONS.md`:** a new section "Guesses (a box left blank)" with the rule (2.3), the path grammar, the
  API table (4.2), the recipe (7.2) and the never-create / typed-wins rules; `module.js` gains `estimators` and
  `dataAsOf` (overview/guesses only); "Input schemas" gains `guess` and `onSubmit(values, meta)`; the ctx table gains
  `guess(key, opts)`; "Where things go" gains "a population figure that guesses a blank box |
  `modules/overview/guesses/data/<topic>.js` with its source and read date; its estimator in that module, or in your
  own module's `compute.js` `estimators`".
* **`docs/PLAN.md`** section 6 one bullet and the decision log one row: "Guesses stored in the plan with one ledger,
  refreshed inside each change | every compute on every device and on the PC reads the same number; the person's
  typing always wins; no read-time overlay to forget | a guess needs information that is not in the plan at read
  time".
* **`docs/MODULE_CATALOG.md`:** the `overview/guesses` row. **`CHANGELOG.md`:** one line per commit.
* **Optional last commit (v2):** `SCHEMA_VERSION = 2`, `migrations[2]` moves `rateGuessed` / `paymentGuessed` /
  `ssWrote` / `retireAuto` / `cushionTarget` / `cushionFunds` into the ledger; readers switch to `isGuess`; adapters
  stay one release, then go. Only worth doing once nothing else touches those readers.

---

## 11. Rollout: ten commits, in order of impact

Each commit: tests green (`npm test && npm run check`), the touched pages screenshotted at 390 px (`node tools/shot.mjs
<group>/<id>`, AGENTS rule 13), one CHANGELOG line, the docs it changes in the same commit, and a `Prompt: <id>` line
when it carries out a prompt from `prompts/`. View changes on usable pages are claimed in `docs/TEAM.md` "Now
editing" first (the designer's lane when three roles are running).

| # | commit | files | what the person sees | fixes |
|---|---|---|---|---|
| 1 | **Plumbing** | `core/estimate/*`, `core/math/estimate.js`, `core/store.js` (hook, unregistered), `tools/check.mjs` (purity grep), tests 9.1, 9.2, store test, CONVENTIONS / DATA_MODEL / PLAN text | nothing | - |
| 2 | **The page and the tables; old guesses follow new answers** | `modules/overview/guesses/*` (page lists the guesses that exist today through the adapters), `tools/build-guess-data.mjs`, `data/*.js`, setup `estimators` export (ss, retireSpend, cushion), `core/app.js` (merge + register settle + `ctx.guess`), catalog row, invariance test | "Our guesses for you" lists the typical debt rates and payments, Social Security from pay, retirement spending and the cushion; the SS estimate now moves when pay changes on Income | stale SS and retirement spending |
| 3 | **Debts are never dropped** | setup compute (`applyOweAmounts`, `valuesFor`), setup view Q5 (placeholders = guesses), `estimators/debts.js` (G20-G22, G25-G32), mortgage rate from FHFA by state | a picked debt keeps its payment; "Still owed" shows "about $127,000" in grey; the mortgage rate box says 4.6% for Ohio | near #1, #9; young #5; parent mortgage |
| 4 | **Spending is never $0** | setup Q6 apply/view (rows and the rough total as the sum of the rows, design-stats R8; cap at take-home), `estimators/spend.js` (G01-G10), Expenses: "our guess" on guessed rows (existing `.pill`, no new CSS) and `guessedMonthly` in its compute | eight grey figures that add up to the total; the reveal's "Got it" counts them; Expenses marks them | young #1, #2; near #2, #3; parent spending |
| 5 | **Retirement saving is never $0** | setup Q4b apply/view (balance, "% of pay" or "$ a month", match, cash, home and car value), `estimators/saving.js`, `home.js` (G11-G19), typo check (R9) | the 401(k) and its match step stay; "Did you mean 5% of your pay?" | young #3, #4; parent 401(k), match; near #6 |
| 6 | **The reveal and the Dashboard tell the truth** | setup `standing()` (one list from `guessesInUse`; the tiles' "Needs ..." from what is really missing), view `drawDone` (design-ux 5.1), guide `detailed()`, `core/ai.js planSummary` tags | "Guessed for now" replaces "Not counted yet"; market assumptions move to the guesses page, folded last | young #7; parent reveal words |
| 7 | **The form kit and the pages outside the setup** | `core/ui/dom.js` (`guessBox`, `guessLine`, `guessNote`, `ui.form` `guess`, `meta`), one placeholder rule in `core/ui/base.css` (designer's lane, design-ux 3.2), the shell's grey note; adopt on Liabilities (no `required` on rate and payment), Net worth (balance), Contributions ("6%" accepted), Expenses form | Net worth and Debts save with blank boxes; every page resting on guesses says so in one grey line | young #6; near #8 |
| 8 | **Verdicts that a guess could flip** | `rangeOf` adopted in Next best action, Liquidity and the projection behind `params.ranges`; tiles show the range and the deciding guess (design-stats 4.6, design-ux 6.3) | "somewhere between $670 short and $300 spare: your rent decides it" instead of a confident verdict | young top #1, #8 |
| 9 | **Previews in calculators (K3)** | goals/house, goals/education targets through `ctx.guess`, property and car pages' prefilled DEFAULTS turned into previews (they are saved as typed figures today) | grey figures in calculators; nothing saved until typed | parent education goal at $0 |
| 10 | (optional) **One ledger** | `migrate.js` v2, readers to `isGuess` | nothing | - |

Commits 3, 4 and 5 can go in any order after 2; 3 first because a dropped mortgage is the largest single wrong figure
(about $200,000 of net worth for Pat and Lee) and touches the fewest files.

---

## 12. How the other builder's pages adopt it, without anyone editing their files

The pages `goals/emergency-fund`, `goals/vehicle`, `goals/travel`, `goals/charitable`, `debt/student-loans`,
`debt/consolidation`, `taxes/state`, `taxes/self-employment`, `taxes/filing-status`, `taxes/documents`,
`balance/projection`, `balance/statement`, `cashflow/statement` belong to another builder.

1. **Free, the day commit 2 lands:** their computes read the plan, and the plan now holds guessed numbers instead of
   zeros and dropped records. Emergency fund counts guessed spending; Consolidation compares guessed card rates;
   Projection grows guessed balances; the statements include guessed debts. Their output keys do not change.
2. **Free, with commit 7:** the shell's grey note above their page names the guesses their manifest `needs` touch,
   and the guesses page lists and edits every guess whatever page made it.
3. **When they choose, in their own files only:** add `guess: ctx.guess("<key>", { path })` to a field in their
   `ui.form` schema and call `saveField` in their `store.update` (7.2). To add a guess of their own (a state's tax
   rate on taxes/state, a vehicle price on goals/vehicle), export `estimators` from their `compute.js` with keys
   `"<group>/<id>:<name>"` and list it in their `module.js`; the shell merges it, settle refreshes it, the guesses
   page lists it. Their data stays in their own `data/` folder.
4. **What they must not do:** write `plan.guesses` by hand (use `markGuess` / `saveField`), or save a box's guess as a
   typed value. A page that does not adopt simply saves what is typed, as today; the ledger drops the entry when the
   value changes.

Their pages' verdicts may now rest partly on guesses; until they adopt ranges, the shell's note says so in grey. A
`docs/WORKBOARD.md` message tells them the API exists and points at the CONVENTIONS section.

---

## 13. Risks and how the design contains them

| risk | containment |
|---|---|
| R1 settle overwrites something the person typed | it writes only a field equal to its entry's `v`; `saveField` clears the entry on any typed value, equal or not; fuzz test 9.1 |
| R2 a page unaware of guesses saves the exact guessed figure, which then keeps moving | values are rounded to 2-3 significant figures, so an exact real figure rarely matches; the save's notice says when guesses moved; the guesses page shows it as ours with "That's about right"; adoption (12.3) closes it page by page |
| R3 two devices fight over a guess | settle runs only inside a person's own change; same plan and date give the same result; the `d` guard stops an older app putting old figures back |
| R4 import cycles | the guesses module imports no module `compute.js` (checked); setup's own estimators stay in the setup |
| R5 the store, which holds the sync guarantees (38 scenarios), breaks | five lines inside `update()`, wrapped; the hook is not on any other path; the existing store tests run with and without it registered |
| R6 a guess stated as fact by another page or the assistant | additive `guessed` keys in outputs, the shell's grey note, `planSummary` tags; verdict ranges in commit 8 |
| R7 a red or amber verdict caused only by guesses | design-ux rule 7 and design-stats 4.6: the tile shows a range and the deciding guess instead; spending guesses are capped at take-home minus the payments on file |
| R8 tables go out of date | `readOn` and vintage on every table and every Estimate; the yearly data commit; settle moves untouched guesses at the next change |
| R9 the walks' personas leak into the public repo as if real | they are invented; tests use them only through qa households (the tester's lane), AGENTS rule 15 |
| R10 scenarios confusingly move guessed spending | scenarios do not settle (7.4) |

---

## 14. Where the three designs differed, and the choice made here

| point | design-stats | design-ux | here, and why |
|---|---|---|---|
| path grammar | `section[id].field`, `debts[X]` also matches the account id | `section#<id>.field` | stats' grammar; the account-id spelling accepted on read and rewritten to the row id on write (3.2.1), so one field has one ledger key |
| where tables live | `modules/overview/guesses/` | `core/estimate/data/` | the module (5.2): estimators need module tables and READMEs; `core/` stays plumbing |
| legacy debt flags | mirror on write, keep reading them | `migrate()` copies them into the ledger once | mirror + adapters, no `migrate()` change: nothing on the load path changes, existing readers untouched; a v2 migration is optional and last |
| `ui.form` when a guessed box is left blank | - | `values[key]` = the guess's value, `meta.guessed` has the key | `values[key] = null` and `meta.guessed` has the key, `meta.guess[key]` the Estimate: a page that adds `guess:` but forgets `saveField` then behaves as today (blank) instead of silently saving our figure as the person's; the kit test covers both |
| refresh name and order | `settle`, by tier | `refreshGuesses` after the change | `settle`, by tier, registered through `store.settleWith` so `store.js` imports nothing new |
| combining one-way tables | anchor x income-adjusted ratios, one per independent axis (validated) | geometric mean of the cells (Jordan's 401(k) $36,900) | design-stats' rules; the answer keys in tests are design-stats' figures (Jordan's 401(k) about $26,000), and design-ux's example figure is superseded |
| ranking cost on the guesses page | - | `heavy: true`, recomputes headline answers per guess | kept, with the top-8 pre-filter and the `meta.rev` memo (8.1) so the Dashboard never pays for it |
| creating guesses for a screen the person skipped | rule: only a screen where the person saw the box | spending is always guessed | only where the person sees it: the done screen lists the guessed month with "Change ›" when spending was skipped, and that tap (or Continue past it) is what writes it |

---

## 15. The other two angles, briefly

**The person on the phone (design-ux).** One rule: the grey figure in an empty box is exactly what the plan counts if
the box is left empty (here: the preview-equals-written test). "Our guess" is the only label; one why-line per guess
("Our guess: typical 1-bedroom rent in Texas"); sources in one fold at the end of the guesses page. Blank never means
zero and never drops what the person said they have. Pages resting on guesses say so in one calm grey line, never in
amber or red. "Not sure" is the empty box; one-tap chips only where a choice blocks Continue. One page, "Our guesses
for you", ranks every guess by how much it can move what is left each month or what retirement can pay, with a box to
type the real figure and "That's about right" to keep ours. Fewer questions: no retirement-spending question under
50, debts ask the payment first, saving at work as "% of pay".

**The statistics (design-stats).** Money amounts take the median of the narrowest published cell for what is known;
choices take the mode; spending categories take means of narrow cells so they add up; existence is never invented
(the hurdle rule). Tables are combined as an anchor times one income-adjusted ratio per independent axis, validated
against published crossed cells (3.0% median error for place x age). Bins are interpolated so a $1 change never jumps
a guess. Every guess carries a spread when its table measures one, chains carry it forward through tiers T1-T4, and
a verdict whose range crosses its line waits and names the guess that decides it. A typed figure far outside the
population's middle 98% gets one question when a common slip explains it.

---

## 16. For the owner to decide (engineering consequences only)

1. **Skipped screens** (the parent walk's skip path): keep "Not yet" tiles (this design), or let the done screen
   offer a typical household for what was skipped (a K4 stand-in, read-only, or written on one tap).
2. **Pay left blank after "I work"**: keep it unguessed (K3 preview only, this design) or store a guess (then
   everything downstream carries "your pay is our guess too", and the spending cap uses a guessed take-home).
3. **The optional v2 migration** (commit 10): worth it only to simplify readers; nothing the person sees changes.
