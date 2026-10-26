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

## The ctx object
| field | what |
|---|---|
| `route` | `{ group, id, rest[] }` from the hash |
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
| `go(group, id)` | navigate |

## Input schemas (ui.form)
```js
[{ key, label, type, options?, help?, required?, placeholder?, step?, min?, max?, rows? }]
type: "text" | "number" | "money" | "percent" | "date" | "select" | "checkbox" | "textarea"
```
`percent` fields are typed as 7 and stored as 0.07. `money` and `number` return numbers or
`null` when blank. `select` options are strings or `{ value, label }`.

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
