# Conventions: the module contract, the ctx object, input schemas

## Folder = page
```
modules/<group>/<id>/
  module.js         manifest (default export)          required
  compute.js        export compute(plan, params)       required, pure
  view.js           export render(root, ctx)           required, DOM only
  README.md         purpose / inputs / outputs / formulas / edge cases / tests / ideas
  module.test.mjs   node:test tests, run by `npm test`
  (anything else the page needs: data tables as .js, extra views, prompts)
```
`<group>` is one of `core/groups.js`. `<id>` is kebab-case and unique inside its group.
The key `"<group>/<id>"` is how modules refer to each other (`ctx.computeOf("balance/net-worth")`)
and how routes look (`#/balance/net-worth`).

## module.js
```js
export default {
  id, group, title, icon, order, version,
  enabledByDefault,   // default true
  status,             // "planned" | "stub" | "usable" | "complete"  (planned = placeholder, shown with a "soon" tag)
  placeholder,        // true only on generated placeholders (tools/scaffold-from-catalog.mjs)
  purpose, seeds,     // placeholder text from the catalog; optional on real pages
  needs: [...],       // plan sections read   (documentation + future dependency graph)
  writes: [...],      // plan sections written
  heavy,              // true: ctx.computeRemote() sends compute to the PC when connected
  estimators,         // optional: the guesses this page makes, re-exported from compute.js (see "Guesses" below)
  guessTables,        // optional: sourced population tables those estimators cite, by id (overview/guesses ships them)
  restsOn,            // optional: plan sections the page's figures rest on; a big guess in one draws the grey note
  compute,            // (plan, params) => derived
  render,             // (root, ctx) => cleanup | void | Promise<...>
};
```

## compute(plan, params)
Pure. Same file runs in the browser, on the server (`POST /api/compute/<group>/<id>`)
and in tests. `params` is whatever the view or the server passes; the server always adds
`params.maxPaths` (from planner.properties) so heavy simulations can cap themselves.
Return plain JSON-able objects. Throwing is fine; the shell shows the error.

## render(root, ctx)
Build DOM under `root`. Read `ctx.derived` (your compute result) and `ctx.plan`.
Change data with `ctx.store.update(draft => { ... })` -- the shell re-renders the page after
each update, so commit on save/blur, not per keystroke. Return a cleanup function if you
created timers, intervals or listeners outside `root`.

That re-render keeps the screen where it was (it does not jump to the top), and a page that scrolls itself while
drawing still wins. Put the save's green `ui.notice("ok", ...)` where it belongs (top of its card is fine): when it
lands off screen, the shell shows a short copy of it at the bottom of the screen for three seconds. A page that
shows no notice gets no copy, so every save, add and remove still needs its own notice.

## The ctx object
| field | what |
|---|---|
| `route` | `{ group, id, rest[], query{} }` from the hash: `#/group/id[/rest...][?key=value&...]` (the query is optional; step-by-step guides add `?guide=<id>&step=<key>`, quick answers `?from=quick`) |
| `plan` | the current plan (read-only by convention) |
| `derived` | this module's `compute(plan)` result |
| `module` | this module's own manifest (id, group, title, purpose, ...) |
| `store` | `get()`, `update(fn)`, `replace(plan)`, `subscribe(fn)`, `backend()` |
| `api` | PC server client: `ready()`, `config()`, `compute(key, params)`, `aiChat()`, `aiModels()` |
| `ai` | `chat(messages, options)`, `models()`, `settings()`, `status()`, `planSummary(plan)` |
| `ui` | `h, card, row, stat, muted, notice, button, field, input, select, table, form, uid, confirm` (core/ui/dom.js) |
| `fmt` | `money, pct, num, date, today, signed` (core/format.js) |
| `features` | `enabled(m)`, `set(key, bool)`, `sourceOf(m)` |
| `modules` | `Map<"group/id", manifest>` of every loaded module |
| `GROUPS` | the ordered group list |
| `computeOf(key, params)` | run another module's compute() locally |
| `computeRemote(key, params)` | same, but on the PC when the module is `heavy` and a server is connected |
| `go(group, id, rest?, query?)` | navigate (`router.href(group, id, rest, query)` builds the same address as a string) |
| `announce(text)` | read a short confirmation out to screen readers (a live region outside `#content`) |
| `openSearch()` | open the menu with the cursor in its search box (for a "Not here? Search by a word" button) |
| `guess(key, opts?)` | our guess for one field: an Estimate (`value`, `why`, `sharperWith`, `tables`, ...) or `null`; `opts`: `{ path, rec, args }` (see "Guesses") |

## Shell hook: frame
A manifest may export `frame(ctx, page) -> { before, after } | null`. The shell calls it only on `overview/guide`
(the step-by-step guides), for every page it renders, and draws `before` above the page and `after` below it. The page
itself renders into its own plain `<div data-page="group/id">` (`page` above) inside `#content`, so a page that clears
and redraws its root never wipes them, and pages never need to know. It draws the guide bar and the next-step card
while a guide is followed (`?guide=<id>&step=<key>` in the address, or `plan.guide.active`), and "‹ Quick answers"
on a page opened from Quick answers (`?from=quick`).

## Input schemas (ui.form)
```js
[{ key, label, type, options?, help?, required?, placeholder?, step?, min?, max?, rows? }]
type: "text" | "number" | "money" | "percent" | "date" | "select" | "checkbox" | "textarea"
```
`percent` fields are typed as 7 and stored as 0.07. `money` and `number` return numbers or
`null` when blank. `select` options are strings or `{ value, label }`.

A `money` field is a text box with the plan's currency sign in front and the phone's number pad: "4,500",
"$4,500", "4500.50" and "72k" all save as numbers (rounded to cents), commas come back when you leave the box, and
anything else (or outside `min`/`max`) holds the form with a plain message. `step` does not apply to it. A money box
built by hand outside `ui.form` should use `ui.moneyBox({ name, value, min, max })` (put `.box` on the page, read
`ui.moneyValue(.input)`) rather than `type: "number"`, which refuses a comma and on an iPhone silently saves nothing.
Every box is at least 16px: an iPhone zooms the whole page into a box with smaller text, so never set a box's
font-size below 16px in a module style.

Guesses in a form (the form kit, arriving with the smart-guesses commit C6; until then a page draws its own grey
figure, as overview/guesses does): a field gains `guess?: Estimate | null` (its placeholder is the guess, `required`
is ignored, the help starts "Our guess: ...") and `zeroOk?: boolean` (the help adds "Type 0 if you have none."), and
the submit callback becomes `onSubmit(values, meta)` with `meta = { guessed: Set<key>, guess: { [key]: Estimate } }`:
a blank box with a guess gives `values[key] === null` and `meta.guessed.has(key)`. Pages that ignore `meta` save null,
as today.

## Guesses
When a box is left empty, the plan may fill in a typical figure (a guess) worked out from what it already knows, or the
most likely figure for the population when it knows nothing. Everything lives in `core/estimate/` (pure; pages import
only `core/estimate/index.js`), the statistics in `core/math/estimate.js`, the tables and the core estimators in
`modules/overview/guesses/` (its README has every formula and source), and the page "Our guesses for you" lists them.

**A guess is an ordinary value plus a ledger entry.** The field holds a normal number every page reads; the entry
`plan.guesses[path] = { k, v, u, s, at, d }` (docs/DATA_MODEL.md `guesses`) says it is a guess, and it is one only
while the field still equals `v` (`same(value, v, unit)`: rates within 1e-9, money within half a cent, ages exact).
- **Never create, except from a box the person saw.** Only a save of a box shown blank with our grey figure writes a
  guess (`markGuess`, or `saveField` with `guessed: true`). Nothing else creates an entry: not settle, not load, not a
  compute, not the server.
- **Typed wins.** Any figure the person types, equal to ours or not, ends the guess (`saveField` with
  `guessed: false` clears the entry); nothing moves a typed figure ever again. "That's about right" is `confirmGuess`:
  the value stays and becomes theirs.
- **Settle follows the answers.** `store.update` runs `settle` on the draft after the page's change: each untouched
  entry, in tier order, is re-estimated and written when it moved; a typed-over entry is dropped (`"typed"`), one whose
  record is gone too (`"gone"`), and one that is not an entry at all (`null`, a string, no `k`, a `v` that is not a
  number or a list: an import or a hand edit) first (`"bad"`), so one bad entry never stops the rest; a `guesses` that is
  not an object goes whole. Estimator keys are looked up as own keys only (`constructor` names none). It never creates, is idempotent, skips the older Get started flags (frozen), keeps an
  entry whose estimator no module has any more, and never writes back figures older than the entry's `d`. `load`,
  `adopt`, `replace`, `resolve`, `resync` and another tab's save never settle; scenario copies and the PC server
  never settle.
- **Older flags are read, not moved.** `debts[].rateGuessed` / `paymentGuessed`, `guide.setup.ssWrote`, `retireAuto`,
  `cushionTarget` / `cushionFunds` read as guesses (`LEGACY` adapters in core/estimate/ledger.js) and are mirrored when
  the ledger writes the same path.
- **The gate.** `estimate()` returns `null` for a plan whose currency is not USD, that holds a bank file in another
  currency (`imports[].currency`, from the file's Currency column) or whose person lives outside the U.S.
  (`guide.setup.outsideUS`). A blank state uses the national figure and adds "your state" to `sharperWith`.

**Paths** (core/estimate/paths.js): `segment ("." segment)*`, `segment := name | name "[" id "]"`; `name[id]` is the
item of list `name` with that `id` (`accounts[a1].balance`, `debts[d3].rate`, `retirement.spendingMonthly`,
`retirement.socialSecurity.<pid>.monthlyAtFRA`). `parsePath` throws on an id with `.`, `[` or `]` and on the names
`__proto__`, `constructor` and `prototype`; `getAt` gives `undefined` when anything is missing; `setAt` never creates a
record or key, the last one included (returns false: a page that fills an optional field creates it, null, with its
record first); `canonical` rewrites
`debts[<accountId>]` to `debts[<debt row id>]` before it is stored; `pathOf(list, id, field)` builds one.

**The API** (`core/estimate/index.js`):
```js
same(a, b, unit); guessAt(plan, path) /* entry or null */; isGuess(plan, path)
guessesInUse(plan)                      // ledger + legacy (legacy: true); the ledger wins on a shared path
guessesTouching(plan, sections, { weights })
markGuess(draft, path, est, today)      // write field + entry; idempotent (`at` kept); mirrors a legacy flag
clearGuess(draft, path); confirmGuess   // drop the entry (and the flag); the value stays
saveField(draft, path, { value, guessed }, est, today)   // the one call a page makes when it saves a box
applies(plan); estimate(plan, key, { estimators, tables, today, path?, rec?, args?, memo? })   // -> Estimate | null
settle(draft, { estimators, tables, today })             // -> { changed: [{ path, k, from, to }], dropped: [{ path, k, why }] }
mergeEstimators([{ from, estimators, tables }]); checkEstimators(registry or [registries])   // -> problems
```

**An estimator** (in a module's `compute.js`, re-exported by its manifest; or in `modules/overview/guesses/estimators/`):
```js
export const estimators = {
  "<group>/<id>:<name>": {            // or "<topic>.<name>" in overview/guesses
    tier: 1-4, order, label, unit,    // unit: month | year | total | rate | age | year-date | list
    weight: "big" | "small",          // big: can move a headline figure by $100 a month or a verdict
    basis?: "yours",                  // worked out from the plan's own answers: cites no population table
    page: () => "#/where/it-is-typed",
    reads: ["earlier.key"],           // earlier (tier, order) keys only; tools/check.mjs checks it
    fn(plan, { today, path, rec, args }, lib) { return { value, sigma, measured, why, uses, sharperWith, tables, dataAsOf? } | null; },
  },
};
```
`why` is the words after "Our guess: " (at most 70 characters, plain, no publisher or year on screen); `tables` are
bundled table ids (each must exist in a manifest's `guessTables`; at least one unless `basis: "yours"`); `dataAsOf`
defaults to their newest read date; the value is rounded (`roundGuess`) unless the estimator returns `rounded: true`.
`core/app.js` merges every loaded manifest's `estimators` and `guessTables` at boot (page toggles ignored); a key
defined twice is reported and `npm run check` fails.

**Adopting a guess on a page** (the recipe; boxes in the form kit arrive with C6):
```js
const path = pathOf("debts", d.id, "rate");
const g = ctx.guess(`debt.${kind}.rate`, { path });
const fields = [{ key: "rate", label: "Interest rate a year", type: "percent", guess: g }];
ui.form(fields, { rate: isGuess(ctx.plan, path) ? null : d.rate }, (values, meta) => {
  pending = [{ kind: "ok", text: "Saved." }];
  ctx.store.update((draft) => saveField(draft, path, { value: values.rate, guessed: meta.guessed.has("rate") }, g, ctx.fmt.today()));
});
```
A page whose figures rest on guessed sections opts in to the grey note with `restsOn: ["expenses", "accounts"]` in its
manifest; the shell then draws one muted row ("Some of this uses our guesses: ... ›") linking to the guesses page.
When a save moves guesses, the shell adds " N of our guesses moved with it." to the page's green notice.
`npm run check` also greps `core/estimate`, `core/math` and every `estimators/` folder for purity, checks the merged
registry, and validates `modules/overview/guesses/coverage.js` (every input a layperson may not know, and how a blank
is handled).

## Ids and dates
Every list item in the plan has `id` from `ui.uid()`. Dates are ISO `YYYY-MM-DD` strings.
Money is a plain number in the plan's currency (`plan.meta.currency`); rates are fractions.

## Naming
Files: kebab-case. Exports: camelCase. Plan sections: camelCase plural for lists
(`accounts`, `goals`). Group and module ids: kebab-case. CSS classes: the ones in base.css.

## Where things go
| thing | place |
|---|---|
| a formula used by more than one module | `core/math/<topic>.js` + `tests/<topic>.test.mjs` |
| a formula used by one module | its `compute.js` |
| a lookup table (tax brackets, life table) | `modules/<group>/<id>/data/<name>.js` exporting a constant, with the source year in the file |
| a population table a guess reads (spending, balances, pay, rates by state...) | `modules/overview/guesses/data/<topic>.js`, generated by `tools/build-guess-data.mjs` from the research files, each table with `{ table, publisher, title, url, vintage, readOn }`; never edited by hand |
| a guess for a field (an estimator) | the topic file in `modules/overview/guesses/estimators/`, or a module's own `compute.js` `estimators` (keyed `"<group>/<id>:<name>"`) |
| a prompt for the model | the module's `compute.js` (so it is testable and visible) |
| a server setting | `planner.properties.example` + `server/server.mjs` |
| a device setting | `modules/system/settings` |
| a third-party library | `vendor/` (git-ignored) or a pinned CDN `<script>`; documented in the module README |
