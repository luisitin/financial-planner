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

## View: the household's view and the build view
`core/view.js` holds two things pages may read through `ctx`: `ctx.view.build` (false by default: the household's view) and `ctx.live` (`{ pc, ai }`: the PC server answers; the AI helper answers through it). `ctx.shown(m)` says whether a page is offered.
- User view (default): a page is offered when it is ready, not `builderOnly`, and its `requires` ("pc" or "ai", a manifest field) answers. No "soon", phases, ready counts, "PC", "server", "sync" or "AI helper isn't answering" on screen. A page that is not ready still opens by its address (a plain placeholder) but is never linked.
- Build view: everything as before. Set with Settings > Advanced (folded, last) or `?view=build` / `?view=user` in the address; remembered in `localStorage` "planner.view" (try/catch; with storage unavailable the user view shows).
- A page that mentions the PC or the AI helper (or links to a page that needs them) checks `ctx.live` / `ctx.shown`. Manifest fields: `builderOnly: true`, `requires: "pc" | "ai"` (tests/user-view.test.mjs).
- The single-file build: `node tools/build.mjs --demo qa/fixtures/demo-household.mjs --out <file>` (see tools/build.mjs); it works from file:// and in a frame sandboxed with only allow-scripts (plan kept in memory; submit buttons are mended by `mendBlockedForms` in core/app.js). `node qa/user-view.mjs` checks both views on a phone.

## Shell hook: frame
A manifest may export `frame(ctx, page) -> { before, after } | null`. The shell calls it only on `overview/guide`
(the step-by-step guides), for every page it renders, and draws `before` above the page and `after` below it. The page
itself renders into its own plain `<div data-page="group/id">` (`page` above) inside `#content`, so a page that clears
and redraws its root never wipes them, and pages never need to know.

`guide/compute.js barFor` decides which one of these the page gets (the first that applies):
1. **guide**: the address names a guide (`?guide=<id>&step=<key>`, any of the seven and the path, followed or not, finished
   or gone quiet). The bar says what to do here; the card at the bottom has Next. In the path (`plan`, "Your plan", `path:
   true`) the bar is smaller (one line "Your plan · Step 4 of 7", the step's ask, "Show me where", "Done? Go to Next ↓" on a long
   page, no Next of its own) and the card has the page's one Next: the next step in order, "Still to do: ..." for one skipped
   earlier, or "Finish: see your plan"; it ticks the step as passed (`passStep`) in one `store.update`. A path step may export `waits(plan, { today }) -> { what, href } | null` (retirement: Social Security; cushion: any account): the card says "This step needs <what> first. Add it › Or go on and come back to it." with a 44 px link; it never blocks. The bar's fill is the step you are on (a full bar on the last step), not the steps done.
2. **review**: `?from=review`: "‹ Back to the October 2026 check-in".
3. **quick**: `?from=quick`: "‹ Quick answers" above, "Another question?" below.
4. **plan**: a result page that is a row of Your plan (`resultOrder`), opened from it (`?from=plan`) or after the path is
   complete: "‹ Your plan" above, "Next result: ..." below.
5. **compact**: a page that is a step of another guide being followed (not the path), reached another way: one line above.
6. **continue**: one quiet 44 px row at the bottom of every other page: "Continue your plan: step 4 of 7 ›", "This is step 4 of 7
   of your plan ›" (this page is the next step: the link draws the bar), "See your plan ›" (complete) or "Start your plan: a
   few easy questions ›" (never started). `review` and `compact` carry the same row at their bottom.

So every page ends with a way on, except the pages that lead the way themselves: `OWN_PAGES` (`overview/start`,
`overview/guide`, `overview/quick`), `SELF_LED` (`overview/setup`, `overview/plan`) and the Dashboard. The one-page "‹ Back to
..." trails (sessionStorage) are kept beside the continue row; in path mode the trail reads "‹ Back to your plan".
**The path is the one journey whose steps come and go with the household** (`pathVariant`, cached by `partsFor`); its
progress is `guide.journeys.plan`, and "done" for the whole path is `pathSummary().complete`, never `finishedAt`.
**Two filled buttons**: on a read-only step page Next is the only filled button; a few step pages draw a filled button of their
own that is not the step's action (Pay off debts' "Add the rates and payments", Emergency fund's "I moved it"), so they show
two. The path walk (`qa/flows/path-walk.js`) reports them and does not fail on them. A step with an `ownAction` ("Save plan",
"Work it out") draws Next outlined until it is done.

## Input schemas (ui.form)
```js
[{ key, label, type, options?, help?, required?, missing?, placeholder?, step?, whole?, min?, max?, rows?, more? }]
type: "text" | "number" | "money" | "percent" | "date" | "select" | "checkbox" | "textarea" | "tel" | "email"
```
`percent` fields are typed as 7 and stored as 0.07. `money` and `number` return numbers or
`null` when blank. `select` options are strings or `{ value, label }`. How the kit checks, answers and walks these
boxes is in "Forms: asking, checking, answering" below.

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

## Forms: asking, checking, answering
The form kit (`core/ui/dom.js`, its words and decisions pure in `core/ui/checks.js`, the change-and-take-back in
`core/ui/undo.js`; tests in `tests/ui-checks.test.mjs`, `tests/ui-undo.test.mjs` and, for `ui.reveal`, `ui.spanOf`,
`ui.openUnder`, `ui.fieldError` and `ui.numberBox`, `tests/ui-kit-helpers.test.mjs`) answers every form the same way,
`ui.form` ones and hand-built ones, with no code in the page:
- **A box that cannot go through says why at the box.** A held Save (a tap, Return, `reportValidity()`) never shows the
  browser's grey bubble: the words go right under the box in red ("Fill this in first.", "Type an amount first.",
  "Use a number from 0% to 100%.", "Pick a date that is not in the future."), the box gets a red edge
  (`aria-invalid`, the words are its `aria-describedby`), the first wrong box comes up under the top bar with its label and
  gets the cursor (a fold it sits in opens). Two or more wrong boxes in a `ui.form` add one line above the buttons:
  "2 boxes need a fix: A; B.", counted again as each is fixed. The words go the moment the box is right.
- **Leaving a box** that holds something unusable says so once the tap that left it has landed (nothing is drawn while a
  finger is down, and the box the person moved to stays still). An empty box says nothing until Save.
- **`checkValidity()` is silent; `reportValidity()` and a held submit speak.** Call `checkValidity()` to ask quietly
  (live previews), `reportValidity()` to tell the person.
- **A page's own "no"**: a `.notice.error` its `onSubmit` adds anywhere is moved by the kit right above the buttons, once
  (a second refusal replaces it in place; no timer removes it; the buttons stay under the thumb). For a "no" about one
  box, `return ui.fieldError(box, "Words.")`: the same words at that box, the cursor in it, the form kept. A page's own
  `setCustomValidity(words)` + `reportValidity()` is spoken the same way. Never disable Save to say "not yet".
- **Number boxes are text boxes the kit reads** (`type: "number" | "percent"` and `ui.numberBox({ name, value, min, max,
  whole, percent, required, missing })`): "1,200", " 300 ", "2.555" and "7%" are taken (`ui.readNumber`), a percent box
  shows its "%" inside, "12..5" is held with words, leaving the box writes the plain number back ("5,000" -> "5000", so
  `Number(box.value)` works after a change and at submit). `whole: true`, or a `step` of 1 or more, means whole
  numbers; any other step is a hint, never a refusal. No arrow-key stepping on a desktop.
- **Field options**: `required`, `missing: "Type the amount of the gift."` (the words for an empty required box), `min`,
  `max` (a date's `max: "today"`; dates start at 1900-01-01 unless `min` says otherwise, so a year typed as 0026 is
  held), `whole`, `type: "tel" | "email"` (the phone's own keyboard). A money box refuses a billion or more ("That is more
  than a billion: check for an extra digit.") unless the field or `ui.moneyBox` says `max: null`.
- **Less first: optional boxes wait under one line.** `more: true` on a field puts its box under one quiet line right
  above the buttons, "More details (optional)" (`opts.moreLabel` names it), so a long form opens short and the extra
  detail is one tap away, in place (nothing above the line moves). The line is open by itself only when it should be:
  one of its boxes already holds something (`holdsSomething` in `core/ui/checks.js`: a typed box that is not blank, an
  amount, number or percent that is not 0, a choice that is not the list's first; a tick box never by itself), one of
  them is held back at Save (the fold opens and the words are at the box), or the person opened this form's line
  earlier on this visit (their choice is kept until they shut it again). `opts.moreOpen: true | false` lets the page
  decide instead (`moreOpen: !!editing`). A `required` box is never folded away (`more` is ignored on it), Return
  walks only the boxes on screen, and a folded box is read and saved like any other. Mark the boxes most people leave
  blank (a raise, an end date, notes); keep in the short form what every answer needs. Nothing changes for a form
  with no `more` field. For someone who wants every box on screen, `ui.setMoreOpen(true)` opens every such line from
  the start (the shell is to call it from a device setting, as it calls `ui.setMoneySign`; no setting exists yet).
- **Return** in a box goes to the next box a person types in (a notes box too) and only the last one saves; choice lists
  and tick boxes are skipped (they hold a value; Return would open a picker wheel or do nothing). The key reads "next",
  then "done". A box in no form: Return checks it, then goes to the next box of its card, or puts the keyboard away (the
  page's `change` runs); a page's own Enter handler runs first and is left alone. Return twice saves once (800 ms).
- **Opened from the keyboard**, a new form gets the cursor in its first box; a touch opens no keyboard by itself.
  `ui.form(..., { opener })` names the opener when the page knows it better than the tap.
- **Cancel** goes back to what opened the form (mid-screen if it was off it, the focus on it) only when the kit knows it
  for sure: the same node, the one row with the same `data-key`, or the same place in a list that reads the same row for
  row. Otherwise nothing moves. Rows that can be edited carry `data-key="<record id>"`.
- **A row's edit form under its row**: `const close = ui.openUnder(rowEl, (holder) => drawEditForm(holder))`, called from
  the tap's handler (never while the page draws: a redraw would scroll to it after every save). The holder is the
  form's own (`li.rec-form`, `tr.rec-form`, `div.rec-form`), so a half-typed add form elsewhere keeps its typing; the row
  and the first box are brought on screen together; `close()` removes it and puts the focus back on the opener. A Save
  in it that goes through brings the row back on screen (the least scroll) before the page redraws, so a Save made far
  down a tall form leaves the person at the row with its new figure, with no code in the page. With the shell's layers, `const release = ctx.layer(() => { editing = null; close(); })`; Save and Cancel call
  `release(); close();`.
- **An answer brought into view**: `ui.reveal(el, { block: "start" | "center" | "nearest" })` does nothing when `el` is
  wholly on screen (under the top bar, above the keyboard), scrolls at once otherwise, waits for an element still being
  drawn, and tells the shell first (window event `planner:reveal`). Call it only on the draw that answers the person's
  own act (its `pending`), never on every draw. `ui.spanOf(a, b)` reveals a stretch (a row and its form).
- **A one-tap change that is not a Remove offers Undo where the control was**:
  `pending = { text, undo: ui.undoable(ctx.store, (d) => { ... }), undoText: "Back to $7,000 a month, as before." }`;
  on the next render draw `ui.notice("ok", pending.text, { undo: pending.undo, undone: (r) => { pending = ui.undoneWords(r, undoText); } })`
  in the slot of the tapped control and clear `pending` (it is drawn once). `ui.undoable` makes the change in one
  `store.update` and returns `null` when nothing changed; its Undo puts back only what that tap wrote and nothing changed
  since (another tab, a later edit), works once and only on the same page. The notice's outlined 44 px button sits on a
  line of its own and brings itself into view; it lives until the page is drawn again or the person leaves (no timer).
  `ui.notice(kind, text, { action: { label, run } })` is the same for any one button.
- **Every Remove asks first**, naming what goes (`ui.confirm("Remove Helper A?")`).
- **A way on is a 44 px button that names its place** ("Update balances on Net worth"), never a link inside a sentence.
- **Read out**: the kit's lines above the buttons are `role="alert"`; the words at a box are its description (read with
  the box when the cursor goes in), and are `role="alert"` only when they are drawn after the person left the box;
  `ui.notice("error", ...)` is read the first time its words are drawn on a visit to a page, not again on every redraw.
- A number, percent or money box carries its `min` and `max` as attributes for tools and tests to read (a text box does
  not check them: the kit does), and `data-kind="number" | "percent" | "money"`.
- **Never ask a form element for a property or a method by name** in shell or kit code (`form.contains`, `.elements`,
  `.name`, `.reset`, `.noValidate`...): a box named `name`, `target` or `contains` stands in for it. Go through the
  prototypes (`Element.prototype.querySelector.call(f, s)`, the `HTMLFormElement.prototype` getter for `elements`).
- Every node the kit draws carries `data-kit`; a page notice it moved carries `data-moved="kit"`.

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
  entry, in tier order, is re-estimated and written when it moved (when only its spread moved, a spending row now read
  from the bank files at the survey's own figure, the entry's `s` is refreshed and the field is not touched); a typed-over entry is dropped (`"typed"`), one whose
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

**Believable for the household.** A guess or a default must be one a layperson believes for their own household (age,
couple or single, children, owner or renter, pay, state, what they typed). The rules are in `qa/guess-sanity-rules.json`
(what is checked, the line, why, the source and its date); `node qa/guess-sanity.mjs` builds a grid of households
through Get started's own apply functions, adds the qa plans, and writes `qa/results/sweep.md`; `tests/guess-sanity.test.mjs`
runs the hard rules in `npm test`. A new estimator or default adds its rule there.

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
