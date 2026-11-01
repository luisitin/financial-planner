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
| a prompt for the model | the module's `compute.js` (so it is testable and visible) |
| a server setting | `planner.properties.example` + `server/server.mjs` |
| a device setting | `modules/system/settings` |
| a third-party library | `vendor/` (git-ignored) or a pinned CDN `<script>`; documented in the module README |
