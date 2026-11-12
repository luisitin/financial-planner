# ONE QUIET DIAL: a design for "simple first, detail on request"

Designer's stance: inline opt-ins on every page, PLUS one device setting ("How much detail": the short view / everything
open) and one per-page control ("Show everything on this page"), so a person who likes detail switches once.
Tip 737fb6a. Nothing in the repository or in `opt/app` was edited. `$SP` =
`$SP`.

| what | where |
|---|---|
| the prototype (worktree, left in place, uncommitted) | `$SP/opt/proto-dial` |
| its changes as one patch (2 new files, 3 views) | `$SP/opt/dial-work/proto-dial.patch` |
| screenshots (16, all read) | `$SP/opt/proto-dial-shots/` |
| scripts and data (walks `p1.mjs` to `p5.mjs`, the node counter `feas.mjs`, `feas-family.json`, `feas-proto.json`) | `$SP/opt/dial-work/` |
| server | port 9841, started and stopped by each script; nothing answers there now |

Corrections taken from the skeptics (they override the reports): "More options" is not a label (verify-web 1.2); mark
the split between needed and optional boxes unmistakably, not "(optional)" alone (1.3); a cut list shows six rows, not
five (2.1); find-in-page on an iPhone opens a fold and does not scroll to it (1.1); the Word study does not prove
people like a switch (1.5), so this design does not lean on it; `localStorage` can be erased by Safari after seven
days (4.1); Net worth keeps Edit and Delete, Plan basics stays first in Settings, the Assumptions review notice stays a
notice (verify-code W13).

---------------------------------------------------------------------------------------------------------------------

## 0. The design in twelve lines

1. **One markup.** A page draws each optional part once, as a native `<details>`, through one helper, `part()`. There
   is no second version of any page, sentence or figure.
2. **The short view is the default** and has to be right by itself: the answer, a few rows, one action. Rules 1 to 12
   below hold with the dial off, because off is what a new phone, a private window, an erased phone and claude-a's 13
   pages will always show.
3. **The dial decides one thing: whether the optional parts of a page START open.** It has two places: a card in
   Settings for the device, and one tick-box row on a page for that page. Nothing else reads it.
4. **A reason beats the dial.** An error, a part just saved, a landing that names a part: these open it in either
   state. The person's own tap during a visit beats both (wave 1's place memory keeps it; this design adds no memory of
   single folds).
5. **The dial never touches the plan, a number, a word, the menu, the path or what Save writes.** `compute.js` cannot
   see it. A view cannot read it. A node test proves the two states draw the same page.
6. **What it opens:** extra numbers, the working, the figures behind an answer, optional boxes of a form, the rest of a
   list, exact boxes behind presets. **What it never opens:** technical parts, "Show details" under an error, one
   fold per item (a person, a month, a Settings topic), add forms, the menu.
7. **Stored on the device only**, key `planner.detail`, absent by default. Lost storage means the short view again:
   the cost is one tap.
8. **Words:** "How much detail", "The short view", "Everything open", "Show everything on this page". Never
   "advanced", "expert", "simple mode".
9. **A check keeps it true:** a node test over 141 rendered views with known counts that may only go down, and a
   phone script for the real first screen in both states.
10. **Prototyped on Federal estimate** (and the helper on one real form, and the Settings card):

| Federal estimate, family, 390 x 844 | today | prototype, short view | prototype, everything open |
|---|---|---|---|
| screens | 3.27 | **1.25** | 6.29 |
| first screen: words / money and percent figures | 154 / 14 | **97 / 3** | 120 / 12 |
| whole page as it opens: words / figures / boxes | 480 / 45 / 0 | **109 / 3 / 0** | 819 / 46 / 19 |
| filled buttons on the first screen | 1 | 1 | 1 |
| headline | "About $14,723 of federal tax for 2026" (April is in sentence three) | "You'd owe about $5,253 in April" | the same |
| draw time, five visits (ms) | - | 33 to 61 | 34 to 42 |
| the page's markup with every `open` removed | - | A | **identical to A** |

11. One tap on the row opened six parts in 218 ms with no scroll jump, wrote nothing to the plan, and was still there
    after a reload. Unticking shut them and removed the key.
12. **It can be dropped without touching a page**: the dial is one line inside `part()` and one card in Settings.
    Section 7 says what would make me drop it.

### Why laypeople are not harmed

- **They never meet a choice.** Off by default on every device, never asked in Get started, never switched on by
  screen size. Fewer than 5% of people change any setting (research [S19]); so simplicity is delivered by the first
  view (rules 1 to 12), and the dial is a relief valve for the few.
- **What it adds to their screen is one line.** A tick-box row, the quietest control the kit has (`.toggle-row`, used
  only in Settings today), inside the card of optional parts, after them, and only on a page with two or more. A page
  with nothing or one thing to open shows no row. Settings gets one card of two rows. No bar, no tabs, nothing pinned,
  no second filled button (constraints N1, N3, N4; 4.2 item 7 allows "a text row of 44 px ... once").
- **A slip costs nothing.** Ticking the row by accident opens parts; the row stays ticked where the eye is, and one
  tap undoes it. No number moved, nothing was saved, no page was added or removed. By NN/g's own test this is not a
  mode: the same tap does the same thing in both states, and "different ways of looking at the same data" are not
  modes ([S7], verify-web 2.5).
- **It is the known "show all sections" pattern**, not an invention: NN/g asks for Expand All on accordions ([S4]) and
  GOV.UK's accordion ships "Show all sections". What people complain about is view choices that are forgotten
  (verify-web 1.7: 13 Fidelity reviews about settings that "do not persist"); here an explicit choice is kept.
- **Honest counter-evidence.** The research report looked at a per-page control and did not recommend it ("it adds a
  control to every page"). I keep it because without it the only way to "everything" on one page is a trip to
  Settings or one tap per fold (six on Federal estimate), and because it is the place a detail lover finds the device
  setting ("To open every page like this: Settings"). If a design review finds the row is noise, it goes and the rest
  stands (section 7).

### How the two never drift apart

| what could drift | why it cannot | the check |
|---|---|---|
| words or figures that exist in one state only | a view never reads the dial: only `core/ui/more.js` and the Settings view import `core/detail.js` | a static test: no other file under `modules/` or `core/` imports it; no `compute.js` at all |
| a part that exists in one state only | `part()` draws the same element either way and sets only its `open` attribute | the node test draws every adopted page twice and compares the markup with `open` removed: equal (proved in the browser on the prototype, three states) |
| what Save writes | optional boxes stay inside the same `<form>`; a form never looks at whether a part is open | prototype: the same bill saved with the part shut, opened by hand, and opened by the dial: identical objects |
| numbers | `compute.js` takes the plan only; the dial is not in the plan, not on `ctx` | rule 3 of AGENTS.md already; plus the import test above |
| phone rules holding in the short view only | the phone script runs both states | overflow, targets under 44 px, filled buttons on the first screen, draw time |

---------------------------------------------------------------------------------------------------------------------

## 1. The rules (each one testable)

"Part" = an optional part drawn by `part()`. "First view" = the page as it opens for a household with a plan, nothing
tapped, the dial off, on a 390 x 844 phone. "First screen" = what lies above 844 px.

**The first view**

1. **The answer leads.** An answer page's first element is its answer: a sentence in the `h1` of the hero or a
   `ui.stat`. Test: the first card holds the page's verdict or headline figure; the phone script's "leads with" is
   never the page title for a household with data.
2. **The headline says what happens to the person, and the sentence under it is one sentence.** "You'd owe about
   $5,253 in April", not "About $14,723 of federal tax". At most 30 words and 3 figures in the hero text. A sentence
   that needs more is two parts: the answer, and a part.
3. **One filled button on the first screen, at most** (the page's own action; the shell's Next is drawn outlined when
   a page has its own, as today). Test: `filledFirst <= 1` in both states.
4. **Budgets, by kind of page.** Counted outside every shut part, the way the census counts (words; money and
   percent figures; boxes and pickers; tiles; filled buttons).

| kind of page | first screen (phone script) | the whole page as it opens (node test) | height as it opens |
|---|---|---|---|
| **answer page** (leads with a result) | 120 words, 8 figures, 4 tiles, 2 boxes, 1 filled button | 260 words, 16 figures, 4 tiles, 2 boxes | 2 screens |
| **list page** (what you entered) | the total, then at most 6 rows; 120 words, 8 figures | 260 words, 16 figures; rows beyond six are a part | 2 screens |
| **form** (an add or edit form, or a what-if page before its first answer) | 5 boxes and pickers, the button in sight (the form is at most 700 px tall) | 5 boxes outside parts; every must-fill box outside | 1.5 screens |
| **settings page** | 3 boxes, 1 filled button, no figure | 200 words outside parts; technical parts last and shut | 2.5 screens |
| report sheets and All pages | exempt, named in the test with the reason | - | - |

   Where the numbers come from: four tiles is the owner's own number (log 2026-09-16); the Dashboard, the app's model
   first view, holds 103 words and 8 figures; the family's median first screen today is 113 words and 4 figures; six
   rows is Baymard's tested floor for a cut list. Today 83 of the 141 pages the node test can draw are over a budget
   for the family (59 on words, 52 on figures, 23 on boxes, 4 on tiles; 9 of the 83 are claude-a's). They start in
   `KNOWN` and may only go down (section 4).
5. **An empty page says what to do first** and shows no part and no row (unchanged rule 14 of AGENTS.md).

**What goes in a part, and what never does**

6. **Never in a part:** the answer and its one action; a red or amber notice, an error, a confirmation; every "our
   guess" mark and every "does not add up" warning; a missing figure the answer waits on; the pair that carries a
   verdict (what you plan to spend beside what the money pays for); a must-fill box; the action a link or a guide step
   promised (unless every such address opens the part, rule 15); a debt's end date and the debt-free month; Net worth
   rows' Edit and Delete (owner, 2026-09-15); a zero said in words; the shell's way on.
7. **Two levels.** The first view, then one part. Never a part inside a part; the third level is a page, linked from
   the "More on this" card. A form the person opened by a tap (Add, Edit) is a first view of its own, so it may hold
   its one "Optional details" wherever it opens (the bill form of Expenses opens inside the bill list). A form that
   sits in a `figures` part holds no part: that part is the opt-in. (Standing exception, not extended: Settings'
   technical card.) Test: no `details[data-more]` inside another, except `data-more="options"` inside a `<form>`.
8. **A part opens to at most about a screen and a half** (1,200 px at 390). Longer is a page. Test: the phone script
   measures each part open.
9. **Parts sit together.** A page's parts are rows of one card (`parts()`), after the answer and before "More on
   this". Not a column of folded cards. A part that belongs to one card (the rest of that card's list, the optional
   boxes of that form) stays in it.
10. **A list shows six rows, then "N more <things>".** Never a cut that hides one row (seven rows show all seven).

**Forms**

11. **A form's first view is what the answer needs: at most five boxes, every must-fill box among them, the button in
    sight.** Everything else is one part directly above the button, titled "Optional details" (or "N more numbers" on
    a what-if page), one per form. A what-if page keeps its defaults in a sibling part, never nested.
12. **What Save writes does not depend on what is open.** A box in a part keeps its stored value when untouched, takes
    the typed value when typed, and a blank one writes "not set", never a guess (this settles open point O2: a box in
    a part was "not seen"; it is written into `docs/CONVENTIONS.md`, Guesses). No must-fill box in a part
    (`optional()` throws). Test: the same typing saved with the part shut and open gives the same plan.

**How a part behaves**

13. **Looking is free.** Opening or shutting a part, ticking the row, or changing the device setting never calls
    `store.update`, never changes `localStorage["planner.plan"]`, never asks to save. Test: the plan's bytes before
    and after, in the node test (no update recorded) and in the phone script.
14. **A shut part never hides the person's own state.** Its status says, in one spelling each: "needs a look" (it
    holds an error: and it is open), "2 to fill in", "3 set by you", "our guess". Test: a part given `set`, `missing`
    or `error` shows those words; a part with `error` is open in both states.
15. **A landing opens its part.** `?show=<key>` opens the part that holds that box; a guide step's `opens: "<title>"`
    keeps working because titles are fixed. Test: for every `holds` key, the address opens exactly that part.
16. **No save opens a different part, and the part just saved stays open.** (Today saving "my month in one number"
    opens the bill list and the page grows by about 1,200 px.) Test: after a save, the set of open parts is the set
    before it.
17. **The title is fixed; what changes goes in the status.** No count that changes, no figure in the title except the
    "N" of "N more ...". This is also what lets wave 1 find the part again.
18. **One look.** The whole row is the control, at least 44 px, title left, status right, marker last and
    `aria-hidden`. No link or button inside the summary. It opens in place; the page does not scroll; nothing else
    shuts.

**The dial**

19. **Off unless chosen.** With nothing stored, storage blocked or storage erased, every page shows the short view.
    Never asked during setup. Test: `detail.wants(key)` is false with no storage.
20. **Presentation only.** Rules 1 to 18 and every phone rule (390 px, records for tables, 44 px, no sideways scroll,
    `ui.stat`) hold in both states; the menu, the path, Next, the household's view and the build view are the same in
    both. "More detail" and "what is still being built" stay two switches in two cards.
21. **It opens what its words promise and no more**: the kinds `numbers`, `how`, `figures`, `options`, `rows`, `own`.
    Never `tech`, `item`, `note`, an add form or the menu.
22. **Its state is on the screen.** The row is ticked whenever this page opens with everything; Settings shows which
    of the two is chosen and confirms a change in green. Changing the device setting clears every page's own choice,
    so one switch sets every page.

**Words**

23. **A title says what is inside**, in plain words, and survives on its first two words: "3 more numbers", "How
    this is worked out", "Optional details", "Itemized deductions". Never a bare "More", "Details", "Other",
    "Advanced" (that word exists once, on Settings' technical card), never "More options". Detail means more figures
    and more choices, never harder words: rule 14 of AGENTS.md holds inside every part.
24. **One name per job** (section 3). Test: the node test lists every part title and status; a status outside the
    vocabulary fails.

---------------------------------------------------------------------------------------------------------------------

## 2. The mechanism

### 2.1 Two new files, no wave-1 file touched

| file | what | who imports it |
|---|---|---|
| `core/detail.js` (new, 43 lines in the prototype) | the device's choice and each page's own choice; `localStorage["planner.detail"]`; safe to import in Node | `core/ui/more.js` and `modules/system/settings/view.js`, nothing else |
| `core/ui/more.js` (new, 135 lines) | `part`, `parts`, `pageRow`, `optional`, `moreRows`, `statusWords`; uses only `ctx.ui.h` and classes that exist in `core/ui/base.css` | any `view.js`: `import { part, parts } from "../../../core/ui/more.js"` (53 views already import `core/words.js` this way) |

Not touched: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
`modules/overview/guide/frame.js`, `core/view.js`, `core/place.js`. No new global CSS: the helper uses `.fold`,
`.folds`, `.fold-card`, `.fold-title`, `.fold-status`, `.fold-chev`, `.fold-body`, `.toggle-row`, `.card`, `.records`,
and four inline styles. The service worker keeps no file list, so the two files need no registration; they land in
the same push as (or before) the first view that imports them, through `tools/main-gate.mjs`.

### 2.2 `core/detail.js`

```js
export const DETAIL_KEY = "planner.detail";          // absent = the short view
export function parseDetail(search)                  // "?detail=all" | "?detail=short" -> "all" | "short" | null
export const detail = {
  get all(),                 // the device's choice: true = everything open
  wants(pageKey),            // this page starts open? the page's own choice if it has one, else the device's
  setAll(on),                // Settings. Clears every page's own choice. Stores { all: true, pages: {} } or removes the key
  setPage(pageKey, on),      // the row. Stored only where it differs from the device's choice. No event, no redraw
  forget(),                  // tests: drop the memory copy
};
```

- Stored shape: `{ "all": true, "pages": { "taxes/federal": true } }`. A page's choice can be `false` on a device set
  to everything (that page stays short). Read lazily at the first call, in a try/catch; with storage blocked the
  choice lives for the visit; anything unreadable reads as the short view.
- `?detail=all` or `?detail=short` in the address sets the device choice (as `?view=build` does for the build view),
  so `tools/shot.mjs`, `qa/smoke-all.mjs` and the checks can draw either state. The sandbox shares the key, as it
  shares `planner.view`; a check sets the state it tests.
- Nothing is dispatched to the shell. The device setting is changed only on Settings, which holds no part the dial
  opens, so no page needs a redraw; the row opens its page's parts in place. (The prototype first sent
  `planner:view`; the radio box that had the focus made the shell's "someone is typing" guard skip the redraw and the
  confirmation was lost. Saying it in place is simpler and correct.)
- Docs in the same commit: `docs/DATA_MODEL.md` "Not in the plan" gets `planner.detail` (and the missing
  `planner.view` and `planner.nav`); `docs/CONVENTIONS.md` gets a section "Optional parts".

### 2.3 `core/ui/more.js`

```js
part(ctx, kind, title, body, opts) -> <details>
  kind   "numbers" | "how" | "figures" | "options" | "rows" | "own"     the dial opens these
         "item" | "tech" | "note"                                        never opened by the dial
  title  fixed words (rule 17)
  body   nodes, or () => nodes for a part that costs work (built the first time it opens)
  opts   { status,            // short words for the right of the row
           set,               // how many figures inside are the person's own -> "3 set by you" (true -> "set by you")
           guess,             // the figure inside is ours -> "our guess"
           missing,           // n -> "2 to fill in"
           error,             // truthy -> "needs a look", and the part is open
           open,              // a reason: "saved" | "landing" | "empty" (falsy = no reason)
           id, holds: [keys], // ?show=<id or a key> opens it
           card }             // true: a folded card of its own (class "card fold fold-card"); default: a row ("fold")

parts(ctx, ...parts) -> <section class="card">     the page's parts as rows (.folds), and pageRow(ctx) at the foot
                                                    when two or more of them are kinds the dial opens
pageRow(ctx) -> <div data-more-row>                 "Show everything on this page" (for a page whose parts sit in
                                                    several cards: append it once, after the last)
optional(ctx, form, keys, { title = "Optional details", names }) -> form
                                                    moves the named boxes of a built ui.form into one part above the
                                                    button; throws on a must-fill box
moreRows(ctx, items, draw, { first = 6, noun }) -> first six rows, then a part "N more <noun>" (all rows when <= 7)
statusWords({ error, missing, set, guess, status }) -> the status line, one spelling each (pure; node-tested)
```

What `part()` renders (existing classes only):

```html
<details class="fold" data-more="how" data-more-id="how" [open] [data-why="saved"]>
  <summary style="display:block">
    <span style="display:flex;align-items:center;gap:10px;min-height:32px">
      <span class="fold-title">How this is worked out</span>
      <span class="fold-status">11 lines</span>
      <span class="fold-chev" aria-hidden="true">›</span>
    </span>
  </summary>
  <div class="fold-body">...</div>
</details>
```

`pageRow()` renders `<label class="toggle-row"><input type="checkbox"><span class="toggle-text">Show everything on
this page</span></label>` and, only while it is ticked and the device setting is the short view, one 44 px link under
it: "On this phone only. To open every page like this: Settings ›".

### 2.4 What starts open: one order, decided in one place

| # | the part starts open when | written as | in both states? |
|---|---|---|---|
| 1 | it holds an error | `opts.error` (status "needs a look") | yes |
| 2 | the page gives a reason: it was just saved, the list is empty, a landing | `opts.open: "saved" \| "empty" \| "landing"` | yes |
| 3 | the address names it | `?show=<id>` or `?show=<a key in holds>` | yes |
| 4 | the dial: this page's own choice, else the device's | `detail.wants("group/id")`, only for the six kinds | that is the dial |
| 5 | otherwise | shut | - |

After that, the person's hand: a tap on a summary opens or shuts one part, and the row opens or shuts them all. The
row never shuts a part that holds an error or typing that is not saved (it compares each box with its drawn value).

### 2.5 What is remembered, and by whom (with wave 1's place memory)

Wave 1 (`core/place.js`) keeps, per history entry of this tab, the folds a person opened or shut **by tapping their
summary**, each with how the page had drawn it, and puts one back only "where the page drew that fold as it did
before". It reads the drawn state from the element at the moment of the tap (`foldBy`, `applyFolds`). That is exactly
the seam this design needs, and it needs no change:

| the person | kept by | across a save's redraw | Back, Forward, reload | a new visit by a link or the menu | next week |
|---|---|---|---|---|---|
| taps one part open (dial off) | wave 1 | open | open | shut (the page's default) | shut |
| ticks "Show everything on this page" | `planner.detail` | all open | all open | all open | all open (until storage is erased) |
| then shuts one part by hand | wave 1 (drawn open, set shut) | that one shut, the rest open | the same | all open again | all open |
| chooses "Everything open" in Settings | `planner.detail` | open | open | open | open |
| chooses "The short view" again | key removed | shut; a part opened by hand under the old state is no longer "as drawn before", so the page wins | shut | shut | shut |
| is sent to a part by a link | the address | open while the address says so | open | - | - |
| has an error in a part | the page | open | open | - | - |

So the two never fight: **the dial sets how the page draws a part; wave 1 keeps what the hand changed from that
draw.** This file keeps nothing about single folds, and no view gets a new module-level "open" variable. Until wave 1
lands, a part opened by hand shuts on the redraw after a save, as every fold does today; the few views that keep "the
one just saved" in a variable (`figsOpen` on Federal estimate) pass it as `opts.open: "saved"` and drop the variable
when wave 1 is in. The composition was argued from wave 1's code (`$SP/w1/build-place/core/place.js` lines 190 to
245 and 437 to 445); it was not run, because the prototype stands on the tip without wave 1. The first build step
after wave 1 lands is the six rows of this table as a touch test.

### 2.6 An error or a changed figure inside a shut part

- A view that knows a part holds an error passes `error`: the status reads "needs a look" and the part is open in
  both states; the row cannot shut it.
- A box that fails the browser's own check inside a shut part: `part()` listens for `invalid` in the capture phase and
  opens itself, so the browser can put the focus and its message on the box. Measured on the bill form: the part
  opened, the focus was on the box, nothing was saved (`12-expenses-error-opens-part.png`). Wave 1's form kit does
  the same for every shut ancestor; the two agree.
- A changed figure: the view passes `set` (a count) or `guess`. The part may stay shut, because its row says "3 set
  by you" or "our guess". `optional()` counts the boxes that hold something: "1 filled in".

### 2.7 Landings

`part()` reads `ctx.route.query.show`. `?show=withheld` opened "Figures the plan cannot see" (`holds` lists its box
keys) and nothing else. The guide's `opens: "Figures the plan cannot see"` still matches, because `frame.js` looks
for the title inside the summary's text. Existing keys (`?edit=`, `?add=`, `?type=spending`, `?check=1`) stay the
pages' own; where they open a fold they pass `opts.open: "landing"`.

### 2.8 Heavy parts

`body` may be a function. Shut: nothing is built until the part opens (a `toggle` listener). Opened by a reason: built
at once. Opened by the dial: the part shows "Working this out…" (`aria-busy`) and builds after the first paint
(`setTimeout`, never `requestIdleCallback`, which Safari lacks), so the answer is on the screen first in both states.
Text a person might search for (the working, sources) is built eagerly: only a part that costs real work is lazy.
The phone script times every page in both states and fails a page whose "everything" draw is more than 1.5 times its
short draw plus 50 ms. On Federal estimate (three forms, 19 boxes, 11 walk rows, no lazy part) the two states drew in
the same time.

### 2.9 Printing

A shut `<details>` prints nothing (measured by the research, Chromium 153). `core/ui/more.js` listens for
`beforeprint`: it builds every lazy body (directly, not through `toggle`, which is queued too late), opens every shut
`<details>` under `#content`, and shuts the same ones on `afterprint`. In the prototype six parts were open for the
print and none after it, and `planner.detail` was untouched. Wave 1 records taps on a summary, not `toggle`, so the
print is not mistaken for the person's hand. After wave 1 lands, one rule in `base.css`
(`@media print { details::details-content { content-visibility: visible; display: block } }`) can replace the
listener. Report sheets hold no part. Safari's print is not measured.

### 2.10 Find in page

A part is a native `<details>`, so the browser's own find opens it (Chrome 97, Firefox 148). On an iPhone (Safari
26.2 and later) the part opens and the page does not scroll to the match (WebKit bug 304174, open): half a gain, and
no loss against today. A lazy body is not in the page until built, which is the other reason to keep explanations
eager.

### 2.11 Screen readers

- Native `<details>` and `<summary>`: no `role`, no `aria-expanded` to keep in step.
- The summary is `display: block` and an inner `<span>` is the flex row: the shape GOV.UK shipped after VoiceOver on
  an iPhone lost "collapsed" on other displays. The title is a `<span>`, not a heading; the marker is `aria-hidden`
  (107 of 143 are not today).
- The row is a real checkbox with its words as its label; ticking it calls `ctx.announce` ("Everything on this page
  is open." / "This page shows the short view again."). Settings uses two radio boxes in a `radiogroup`.
- Not tested: VoiceOver on a real iPhone (the marker is hidden by the kit's CSS, which one 2022 survey names as a
  cause of lost state). It is on the list for the first build step, with the same test on a hand-written fold.

### 2.12 44 px

The summary keeps `.fold > summary`'s `min-height: 44px`. The row is a `.toggle-row` (44 px). The link under a ticked
row is 44 px tall. The phone script found no target under 44 px on the prototype page at 390 or 320 px in either
state, and no sideways scroll.

### 2.13 How a view adopts it (Federal estimate, as done in the prototype)

1. Rewrite the hero to rule 2: the headline is what happens; one sentence under it; the long sentence moves, word for
   word, into the working.
2. Collect what is not the answer into parts: `part(ctx, "numbers", "3 more numbers", ui.row(tiles))`,
   `part(ctx, "how", "How this is worked out", walk, { status: "11 lines" })`.
3. Replace each hand-written `ui.h("details", ...)` by `part(ctx, "figures", "<the same title>", body, { set, status,
   holds, open })`. Titles that a test or a guide step names stay as they are.
4. Put them in `parts(ctx, ...)` after the answer; keep notices and warnings outside.
5. For a form: `optional(ctx, form, ["startDate", "endDate", ...], { names: "must-pay, prices, dates" })`.
6. Update the page's README and tests (words the hero no longer says), lower its `KNOWN` entry, shoot it at 390 px in
   both states (`?detail=all`), and read both pictures.

A view never writes `if (detail...)`. If it wants to, the thing it is about to hide belongs in a part.

### 2.14 The device setting

**Where:** `modules/system/settings/view.js`, a card "How much detail", second on the page: after "Plan basics" (the
owner chose that first, 2026-09-15) and before "Pages", which is the other per-device choice. Not inside "Advanced":
it is not technical. The technical card stays last and folded in both states.

```
┌ How much detail ───────────────────┐
│ (•) The short view                 │   two radio rows (.toggle-row), not chips: a filled chip
│     the answer first, the rest one │   beside the filled Save read as two actions
│     tap away                       │
│ ( ) Everything open                │
│     every page opens with all of   │
│     it showing                     │
│ On this phone only. Your plan and  │
│ your numbers stay the same.        │
│ [green] Every page on this phone   │   said in place, at once; no Save button
│ now opens with everything showing. │
└────────────────────────────────────┘
```

**It changes exactly this:** on every page, parts of the six kinds are drawn open; a page's own row is cleared.
**It changes none of this:** any number, verdict, alert, score or sentence; the plan file; what is sent to the
computer; the status pill; the menu, search, All pages; which pages exist; the path, Next, "Next result"; the
household's view or the build view; technical parts; "Show details"; add forms; per-item folds; Get started; what
Save writes; the other phone of the household.

---------------------------------------------------------------------------------------------------------------------

## 3. The vocabulary

**Titles (fixed words)**

| # | title | kind | holds | replaces |
|---|---|---|---|---|
| 1 | **"N more numbers"** | `numbers` | tiles and figures beyond the answer (never the reason to doubt one) | the fifth tile onward, the long row sentences; the owner's own example |
| 2 | **"How this is worked out"** | `how` | the sum with the person's own numbers, what it leaves out, sources last | the 8 titles of this kind in 16 views, the foot-of-page source lines |
| 3 | **"The figures"** (or the page's own noun where a test or a guide step names it: "Retirement settings", "Itemized deductions", "Figures the plan cannot see") | `figures` | the inputs behind an answer, each with its own Save | "<X>: the figures", "... settings", "Assumptions" as inputs |
| 4 | **"Optional details"** | `options` | the boxes of a form few entries need; status names them ("must-pay, prices, dates") | "More details (optional)", "Split it up (optional)", about 500 unmarked optional boxes. Not "More options": the label's own source rules that phrase out |
| 5 | **"N more <things>"** ("25 more years", "4 more accounts") | `rows` | the rest of a list after six | "Show all N", "Show more (N left)", "Matters less", "Years ahead" |
| 6 | **"Set my own numbers"**; one box: **"Type my own"** | `own` | exact boxes after chips or after our guess | "Type my own amount", "Or type your own numbers", "Correct these figures" |
| 7 | "+ Add another <thing>" | not a part | the add form of a list that has rows (settled 2026-09-15) | - |
| 8 | "Show details" | `note` | technical text under a notice (settled) | - |
| 9 | the item's own name (a person, a month, a topic) | `item` | one fold per item | - |
| 10 | "Advanced" and its three | `tech` | Settings' technical card only | - |

**Status (one spelling each, right of the title, never wraps)**

| says | words | today |
|---|---|---|
| it holds an error | **"needs a look"** (and it is open) | none says it |
| something is missing | **"2 to fill in"** | 4 spellings |
| the person's own figures | **"3 set by you"**, one figure: **"set by you"**; in a form: **"1 filled in"** | 8 spellings ("yours", "N typed", ...) |
| the figure is ours | **"our guess"** | "examples", "national estimate", ... |
| nothing there | **"not set yet"** (a single setting); a group of optional boxes says what it holds instead | 9 spellings |
| how much | "11 lines", "13 bills, $N a month", "2026" | fine as they are |

**The dial:** "How much detail" · "The short view" · "Everything open" · "Show everything on this page" · "On this
phone only. To open every page like this: Settings ›".

**The links card stays "More on this"** (the owner's words of 2026-11-06; 37 views say it), with at most four links,
each worded as the question it answers ("What more income would cost", "The tax in later years"). "Go deeper" in the
2026-11-12 entry is the builder's reading and names the pattern, not a heading. If the retirement request ships a
card headed "Go deeper", ask the owner once which name stays and rename the other by script. Owner question 3.

---------------------------------------------------------------------------------------------------------------------

## 4. The machine check

Three layers, cheapest first. All three read `qa/first-view.known.json`.

**A. `tests/first-view.test.mjs` (in `npm test`, no browser, about 10 seconds for one household).** Built from `$SP/opt/dial-work/feas.mjs`,
which already runs: it draws every usable page's `view.js` in the node stand-in DOM (`qa/fixtures/fake-dom.mjs`) for
the invented households, and counts **outside every shut `<details>` and outside `.only-wide`**: words, money and
percent figures, boxes and pickers, tiles, filled buttons.
- Today **141 of the 150 offered pages draw** for the family with a generic `ctx`; 9 throw on gaps of the stand-in
  (`household/calendar`, `household/people`, `insurance/health`, `insurance/term-vs-permanent`,
  `investments/allocation`, `investments/crypto`, `investments/employer-stock`, `overview/guesses`,
  `system/settings`). They are listed in `cannot` with the reason; the list may only get shorter.
- The counts agree with the phone census where it matters (Federal estimate 476 words and 45 figures against 480
  and 45; Net worth 211 and 22 against 203 and 22; Year by year 212 figures against 212).
- **Budget** per kind of page (rule 4; the kind is a table in the json, default "answer"). A page over a budget must
  be in `known` with its counts; a count above its `known` fails; a count below it is reported ("lower
  KNOWN["taxes/federal"].words to 101"), never failed: the pattern of `tests/guess-sanity.test.mjs`. A page not in
  `known` that goes over fails. Start: 83 entries for the family. Examples, measured:

```json
"known": {
  "taxes/federal":        { "words": 476,  "figures": 45,  "boxes": 0,  "tiles": 4 },
  "retirement/cash-flow": { "words": 1037, "figures": 212, "boxes": 2,  "tiles": 0 },
  "property/rent-vs-buy": { "words": 350,  "figures": 20,  "boxes": 17, "tiles": 2 },
  "property/rental":      { "words": 235,  "figures": 0,   "boxes": 21, "tiles": 0 },
  "balance/net-worth":    { "words": 211,  "figures": 22,  "boxes": 0,  "tiles": 4 }
}
```
  After the prototype, Federal estimate measures 101 words, 3 figures, 0 boxes, 0 tiles: its entry is deleted.
- claude-a's 13 folders are a separate list `laneA` (9 of them are over today): reported as to-do, never failing,
  the way `tests/wording.test.mjs` treats `CLAUDE_A_LANE`.
- **The no-drift test.** Every page that imports `core/ui/more.js` is drawn twice, `detail` off and on: the two
  trees, serialized with `open` and the row's `checked` removed, must be equal; no store update is recorded in
  either; every part of the six kinds is open in the second; every `tech`, `item` and `note` part is as in the first.
- **Static rules** (greps in the same test): only `core/ui/more.js` and `modules/system/settings/view.js` import
  `core/detail.js`; no `compute.js` imports either file; a view that calls `part(` does not also write
  `h("details"` for a new fold (old ones are counted in `handWritten`, which may only go down: 153 today); no
  `details[data-more]` inside another (but a form's `options` part); every status is in the vocabulary; a title in `pinned` (the 14 that tests and
  guide steps name) is unchanged.

**B. `tests/more.test.mjs` (in `npm test`).** The helper itself: the order of 2.4, `statusWords`, `optional()` throws
on a must-fill box and leaves every control inside the form, `moreRows` shows 7 of 7 and 6 of 8, `detail` with no
storage, with broken JSON, with `?detail=all`, `setAll` clears pages.

**C. `qa/first-view.mjs` (a browser, run with `qa/smoke-all.mjs` at the start of a phase and before a batch is
pushed; about 2 minutes for four households).** The census's own counters on a real 390 x 844 screen, and at 320 x
568, in both states (`?detail=short`, `?detail=all`): the first-screen budgets of rule 4; the height budgets; one
filled button on the first screen; no sideways scroll; no target under 44 px; each part open is at most 1,200 px;
the draw time of "everything" against "short"; the plan's bytes unchanged after opening every part and ticking the
row. Same `known` file, same "may only go down".

---------------------------------------------------------------------------------------------------------------------

## 5. Worked examples: eight pages redrawn

Each wireframe is the first view at 390 px (about 38 characters across). `›` ends a row that opens in place (a
part); `[ ... ]` is the filled button; `( ... )` is outlined or a chip; `☐` is the row. Figures in the family's
pages are the family fixture's where I measured them, and `$N` where I did not. "Today" numbers are the census's
(family, 390 x 844) unless a household is named.

### 5.1 Federal estimate (`taxes/federal`) — PROTOTYPED. Free page, a step of the path.

Today: 3.27 screens; first screen 154 words and 14 figures; a 60-word paragraph with seven figures; four tiles; the
11-row walk and "What the plan already knows" always open; three folded cards with three habits after a save.

```
┌──────────────────────────────────────┐
│ You'd owe about $5,253 in April      │  h1: what happens (rule 2)
│ The tax for the year is about        │  one sentence, 2 figures
│ $14,723. Your paychecks take out     │
│ about $9,470 by December (estimated  │
│ from your pay).                      │
│ [ Fix it in your paychecks ]         │  the one filled button
│ An estimate, not tax advice.         │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ 3 more numbers                     › │  numbers: of your income, on the next dollar, taxable income
│ How this is worked out    11 lines › │  how: the old paragraph, the walk, what it leaves out, the tables
│ What the plan already     3 from     │  how: wages, business profit, child care; "2 set by you" once typed
│ knows                 your pages   › │
│ Figures the plan cannot   none       │  figures: 9 boxes, "Federal tax withheld so far" first; the guide
│ see                      typed     › │           step and ?show=withheld open it
│ Itemized deductions    standard is   │  figures: "4 set by you · standard is better" once typed
│                           better   › │
│ Year and people             2026   › │  figures
│──────────────────────────────────────│
│ ☐ Show everything on this page       │  the row
└──────────────────────────────────────┘
┌ More on this ────────────────────────┐
│ (What more income would cost)        │  Bracket explorer
│ (The tax in later years) (State tax) │  Tax, year by year; State (claude-a's page: a link needs no edit there)
│ (A page to print)                    │  Tax report
└──────────────────────────────────────┘
  Continue your plan: step 2 of 8 ›       the shell's way on (unchanged)
```

Other households, measured: the renter reads "Your 2026 federal tax looks about right" (96 words, 2 figures, 1.28
screens); the retired couple "About $1,839 of federal tax still to pay for 2026" with "Plan the estimated payments";
the freelancer "About $11,898 of federal tax still to pay for 2026" with what is overdue and due next in the one
sentence; the empty plan is unchanged (one box, one button, no part, no row). One miss against rule 2, seen on the
freelancer's picture: that sentence runs to 34 words and 4 figures (the year's tax, what was paid, what is overdue,
what is due next). In the real commit the overdue and the next amount stay (they are the alarm) and the year's tax
and what was paid move into "3 more numbers". Kept visible: the "Two returns" card
for people filing separately, every notice, and the child-care hint when a credit is there to be had.
Pictures: `01-federal-short-first.png`, `02-federal-short-full.png`, `03`/`04` (the row ticked), `07` (the device
setting), `08` (320 px), `09` (`?show=withheld`), `10-*` (four other households), `13` (the ticked row and its link).

### 5.2 Will the money last? (`retirement/projection`) — in flight (L2, L4, L5): adopt after it lands.

Today: 3.3 screens; first screen 145 words and 8 figures; three sentences of figures under the verdict; four tiles;
a chart; the nine-row "What goes into this" list open (about 1,180 px); none of Year by year, If history repeated,
Sensitivity, How much to take out or Stress tests is linked.

```
┌──────────────────────────────────────┐
│ It lasts in most cases, not all      │  the verdict (the retirement work's words)
│ You plan to spend $84,000 a year;    │  the pair that carries the verdict: never in a part
│ in a bad run the money pays for      │
│ about $79,700.                       │
│ Spending is set to what you spend    │
│ today.                               │
│ [ What would change it ]             │  (no "Could you stop sooner?" for someone who has stopped)
└──────────────────────────────────────┘
┌ What this rests on ──────────────────┐  L2 builds this card: five rows, each with its effect
│ Stop work at            65  Change › │
│ ... four more rows                   │
│ 4 more numbers                     › │  rows (L2's own fold, drawn by part())
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ How sure is this?    N of 100 runs › │  how: the average-market sentence, the pretend futures, the chart
│ 3 more numbers                     › │  numbers: the other three tiles
│ Retirement settings  $7,000 a month, │  figures: title pinned by a test and a guide step; ?type=spending
│                    2 set by you    › │
│ ☐ Show everything on this page       │
└──────────────────────────────────────┘
┌ More on this ────────────────────────┐
│ (Year by year) (If history repeated) │  four links, as questions
│ (Chance the money lasts)             │
│ (How much to take out)               │
└──────────────────────────────────────┘
```

### 5.3 Assumptions (`system/assumptions`) — in flight (L5): adopt after it lands.

Today: 2.63 screens, ten boxes at once, Save at y = 1,830, a "0 Changed from defaults" tile. Kept: the amber "You
have not looked these over yet" as a notice and the one filled "Save and mark as reviewed" (owner, 2026-09-15).

```
  [amber] You have not looked these over yet.
┌ The two that move your plan most ────┐
│ How fast stocks grow                 │
│ (Careful 6%) (Middle ●) (Hopeful)    │  L5's chips; the plan's value is always the lit one
│ Type my own                        › │  own: one box
│ How fast prices rise                 │
│ (2%) (3% ●) (4%)   Type my own     › │  (the chips are L5's to choose)
│ 8 more numbers    all as we set      │  optional(form, [8 keys], { title: "8 more numbers" }):
│                           them     › │  "2 set by you" when changed; ?show=<key> opens it
│ [ Save and mark as reviewed ]        │
└──────────────────────────────────────┘
│ Where these numbers come from      › │  how (exists)
│ ☐ Show everything on this page       │
```

### 5.4 Net worth (`balance/net-worth`) — free (a landed claude-c row to clear).

Today: 2.5 screens; four tiles; ten rows with Edit and Delete each and "as of" ten times; "Over time" as a list.

```
┌──────────────────────────────────────┐
│ $N                                   │  ui.stat: what you own minus what you owe
│ up $N since October · partly our     │  the guess mark stays here
│ guesses                              │
│ [ Update all balances at once ]      │
└──────────────────────────────────────┘
┌ What you own and owe ────────────────┐
│ 3 more numbers                     › │  numbers: you own, you owe, invested for later
│ Checking                        $N   │  six rows; Edit and Delete stay on each (owner, 2026-09-15);
│                    (Edit) (Delete)   │  "as of" only on a balance older than a month
│ ... five more rows                   │
│ 4 more accounts                    › │  rows (moreRows, first six)
│ (+ Add another account)              │
└──────────────────────────────────────┘
│ Over time           12 saved totals› │  rows
│ ☐ Show everything on this page       │
┌ More on this ┐ (One account up close) (Balance sheet) (Net worth in later years)
```
The add form: Name, Type, Balance; "Optional details · bank, date, whose" holds the other three. The row sits after
"Over time", once, because the parts are in two cards (`pageRow(ctx)`).

### 5.5 Expenses (`cashflow/expenses`) — free (a landed claude-c row to clear). The bill form is PROTOTYPED.

Today: a fresh plan opens right (1 screen, 53 words for the renter). In use it opens 2.27 screens because the
13-bill list stands open, and saving "my month in one number" opens the bill list (the page grows by about 1,200
px). The bill form shows 8 boxes for 2 must-fill ones.

```
┌─────────────────┬────────────────────┐
│ $N              │ $N                 │  two tiles (unchanged)
│ a month         │ left over          │
└─────────────────┴────────────────────┘
┌──────────────────────────────────────┐
│ See or change each bill   13 bills › │  rows: shut unless the person opened it; no save opens it (rule 16)
│ Set your month in one     $N, set    │  own
│ number                    by you   › │
│ How "left over" is worked out      › │  how (new: pay, tax, bills, saving, with the figures)
│ ☐ Show everything on this page       │
└──────────────────────────────────────┘
```
The bill form, as measured in the prototype (450 px with the part shut, 755 px open):
```
│ What is it        [ e.g. Rent      ] │
│ Category          [ Rent or mort ▾ ] │  stays: a hidden default would file every bill under one heading
│ Amount            [ $              ] │
│ How often         [ Every month  ▾ ] │
│ Optional details   must-pay, prices, │  options: "I must pay this", "Goes up with prices", Starts, Ends;
│                           dates    › │  "1 filled in" on a bill that has an end date
│ [ Add expense ] ( Cancel )           │
```

### 5.6 Retirement contributions (`retirement/contributions`) — in flight (L3, L6): adopt after it lands.

Today: no part at all; "Against the 2026 limits" always open; a retired person gets a five-box "each paycheck" form.

```
┌──────────────────────────────────────┐
│ $N a year into retirement            │
│ About 11% of your pay: on track.     │
│ Does your employer add money?        │
│ (Yes) (No) (Not sure)                │  the match question as three buttons (exists)
└──────────────────────────────────────┘
┌ What goes in ────────────────────────┐
│ Ana's 401(k)     $N a paycheck Edit ›│  (our guess) stays on a guessed row
│ ...                                  │
│ (+ Add another contribution)         │
└──────────────────────────────────────┘
│ Room left this year          $N    › │  numbers: against the 2026 limits
│ How "on track" is worked out       › │  how
│ ☐ Show everything on this page       │
```
The form: account, amount, pay the tax later or now (L6); "Optional details · whose, how often". Retired with no pay:
one card, "Nothing goes in now", and a quiet "+ Add a contribution".

### 5.7 Settings (`system/settings`) — free. The card is PROTOTYPED.

Today: 2.28 screens, 19 folds, 158 switches, 10,639 px with all open, nothing about detail.

```
┌ Plan basics ─────────────────────────┐  stays first (owner, 2026-09-15)
│ Plan name [ ... ] Currency [ USD ▾ ] │
│ Number and date format [ English ▾ ] │
│ [ Save ]                             │
└──────────────────────────────────────┘
┌ How much detail ─────────────────────┐  NEW (2.14); two radio rows, said in place
│ (•) The short view                   │
│ ( ) Everything open                  │
│ On this phone only. Your plan and    │
│ your numbers stay the same.          │
└──────────────────────────────────────┘
┌ Pages ───────────────────────────────┐  unchanged: 18 topics, each an `item` part the dial never opens
│ Overview            14 of 14 on    › │
│ ...                                  │
└──────────────────────────────────────┘
┌ Your data ┐ ... ┌ Advanced  Not needed day to day › ┐   unchanged, last, `tech`
```
With the card the page is 2.53 screens, a hair over its budget. A separate proposal for a design review, not part
of the dial: draw "Pages" as one row, "Pages on this phone · all 150 on ›", which is what F-010 asked for in its own
words ("collapse the full page on/off list"); Settings would then open at about 1.4 screens.
Pictures: `05-settings-short-first.png`, `06-settings-everything-chosen.png`.

### 5.8 One long form: Rent vs buy (`property/rent-vs-buy`) — free.

Today: 3.86 screens; 17 boxes and a tick on the first view, 16 of them already filled with defaults, none must-fill.

```
before the first answer                    after it has answered
┌ Rent or buy? ──────────────────────┐    ┌──────────────────────────────────┐
│ Home price          [ $ 400,000  ] │    │ Buying comes out ahead after N   │  the answer
│ Rent now, a month   [ $   2,000  ] │    │ years                            │
│ Years you would stay[     7      ] │    │ ... one sentence, one chart      │
│ Down payment        [    20 %    ] │    └──────────────────────────────────┘
│ Mortgage rate       [   6.5 %    ] │    │ The figures   $400,000, 20%    › │  figures: the five boxes
│ [ Work it out ]                    │    │ 12 more numbers  all our guesses›│  figures: the twelve
└────────────────────────────────────┘    │ How this is worked out         › │  how
│ 12 more numbers   all our guesses › │    │ ☐ Show everything on this page   │
```
The twelve (property tax, insurance, upkeep, closing and selling costs, growth of the home and of rent, the return on
invested money, the tax rate, the loan's length, HOA, renters insurance, "We itemize") are a sibling part with their
own Save, never nested in the form (rule 7), each showing "our guess" until typed; its status counts "2 set by you".
The same shape serves House down payment (12 boxes), Rental analysis (21), Vehicles (10), Big purchase (8), Home (10).

### 5.9 What the prototype taught me

1. **The short view is mostly a writing job.** The fold did not make Federal estimate simple; rewriting the hero
   did. The page's answer ("owe about $5,253") was in the third sentence. Rule 2 came out of this, and it is why
   adoption is a page-by-page pass, not a script.
2. **The dial costs the page almost nothing once parts exist**: one line in `part()` and a 40-line row. The same
   markup in three states was byte-equal with `open` removed, which is a property a test can hold for ever.
3. **One card of rows reads as one thing; six folded cards would have been a column of chevrons.** `parts()` and
   the row at its foot came from looking at `02-federal-short-full.png`.
4. **Chips were wrong for the Settings card.** A lit chip beside the filled Save looked like two actions; two radio
   rows are quieter and match the row on the page. And a redraw is not needed there at all: the first version asked
   the shell for one and lost its own confirmation, because the radio had the focus.
5. **Nesting shows up by itself.** "Optional details" in the bill form was drawn in the accent colour because that
   form lives inside the page's own bill-list fold, whose scoped style colours titles. That is how I found that an
   edit form inside a list part is the normal case, and wrote rule 7's "a form the person opened is a first view of
   its own". The helper should set the title's colour itself.
6. **Save is safe because the boxes never leave the form**: the same bill in three states. And an error in the shut
   part opened it with the focus on the box.
7. **Everything open is long, and that is honest**: 6.3 screens at 390 px, 10.6 at 320. The row to go back is at the
   foot of the parts. A detail lover can shut single parts; if a review wants it, the row can be drawn a second time
   above the first part while it is ticked.
8. **With everything open a page with three forms holds four filled buttons** (the hero's and three Saves), as it
   does today when a person opens all three. The first screen still holds one. The check counts the first screen.
9. **A shut `<details>` still has layout boxes in Chromium** (its content is hidden, not removed), so a checker must
   read the `open` attribute, never `getClientRects`. My first count of "boxes shown" was wrong this way.
10. **Pinned words move.** Three test files and the Quick answers and Needs attention computes quote Federal's
    sentences or its view; the real commit changes them together (the tax figures are untouched).
11. **Not exercised:** wave 1's place memory (not on this tip), a lazy part (this page has none), VoiceOver, Safari.

---------------------------------------------------------------------------------------------------------------------

## 6. The build plan

Before anything: add claim rows in `docs/TEAM.md` for the views of each batch (and delete the four landed claude-c
rows that still name these pages); one line on `docs/WORKBOARD.md`. Every commit: `npm run registry`, `npm test`,
`npm run check`, `node tools/leak-guard.mjs --worktree`, one CHANGELOG line, the page's README, shots at 390 px in
both states (`?detail=short`, `?detail=all`) read before it is called done.

### 6.1 Commits, in order (all in claude-b's reach today)

| # | commit | files | lands on `main` |
|---|---|---|---|
| 1 | **The helper and the device choice** | new `core/detail.js`, `core/ui/more.js`, `tests/more.test.mjs`; `docs/CONVENTIONS.md` (a section "Optional parts": rules 1 to 24, the vocabulary, the Save rule that settles O2), `docs/DATA_MODEL.md` ("Not in the plan": `planner.detail`, and the missing `planner.view`, `planner.nav`), `docs/PLAN.md` decision log (these are the builder's choices; `docs/DESIGN_LOG.md` gets only what the owner answers in 6.4), one line added to the "Simple first" bullet of AGENTS.md | with 2 and 3, one push; no view imports the files yet, so old and new cannot mix |
| 2 | **Settings: How much detail** | `modules/system/settings/view.js`, its README; `qa/user-view.mjs` and `tests/user-view.test.mjs` untouched (the Advanced card and its switch keep their words) | same push |
| 3 | **The first-view check** | new `tests/first-view.test.mjs`, `qa/first-view.known.json` (83 known pages, 9 that cannot be drawn, claude-a's as `laneA`, 153 hand-written folds, 14 pinned titles), `qa/first-view.mjs` | same push |
| 4 | **Federal estimate** (the prototype made real) | view, README, `module.test.mjs`; the tests and computes that quote its sentences (`tests/pages-followup-b`, `tests/wording-left`, `tests/wording-review`, Quick answers, Needs attention where they read the page); `qa/flows/tax-figures.js` unchanged (same title) | batch A |
| 5 | **Expenses** | bill form through `optional()`; no save opens the bill list (its module test 361 to 379 changes with it); the "left over" working; links | batch A |
| 6 | **Net worth** | 5.4; the add form through `optional()` | batch A |
| 7 to 12 | the other free pages of the path: `debt/payoff` ("Change the order" and "Compare the three orders" as parts), `balance/liquidity` (the tiers), `insurance/life-needs`, `retirement/withdrawal-strategy` and `retirement/rmd` (they already split "outside" from "How this is worked out": a swap), `goals/house` and `goals/education` (the shape of 5.8), `goals/goals` (its own `foldMore` becomes `optional()`) | one commit a page | batch A, two pushes |
| 13+ | **Forms, by use** (the inventory's list of 30): Income, Debts' edit, Holdings (the file first, three boxes to type one), Policies, People, Pensions, Belongings, Home | one commit a page | batch B |
| | **What-if pages** (5.8): Rent vs buy, Rental analysis, Vehicles, Big purchase, Renovation, Job offer compare, Term vs permanent, Annuities, Health plan compare, Long-term care, Cash-value | | batch C |
| | **Answer pages heaviest in figures** (census table 2, not yet done): Budget (50/30/20), Credit cards, Debts, Disability, Roth conversions, Contribution limits, Risk, Capital gains, Bracket explorer, Estimated payments, Medicare, Social Security, Paycheck, Estate tax, HSA and FSA, Mortgage, Performance, Chance the money lasts, Small business, Equity, Employer stock, Crypto | | batch D |
| | **Long lists**: Year by year and Tax, year by year (six years, then "N more years"), Life timeline, Money calendar, Bills | | batch E |
| | **One name**: the eight "how it is worked out" titles become "How this is worked out", with the three test files that read them; no guide step names one | one commit | batch F |

Order inside a batch is by `KNOWN` (heaviest first). Each push to `main` goes through the gate and waits its 11
minutes, so pages travel four to six a push.

### 6.2 Waiting on work in flight (do not duplicate)

| after | then |
|---|---|
| **wave 1 lands** | (a) the six rows of table 2.5 as a touch test on the combined tree, before any more pages; (b) small changes in wave 1's files, by its owner: `export * from "./more.js"` in `core/ui/dom.js` (so `ctx.ui.part`), the print rule in `base.css` (the listener goes), `.fold > summary` as a block for every fold, a `more: true` flag on a `ui.form` field that calls `optional()`; (c) delete the "just saved" variables wave 1 makes needless; (d) `overview/pages` |
| **the retirement request lands** | its ten pages keep their words; their hand-written folds become `part()` calls and their forms `optional()` (5.2, 5.3, 5.6; Goal seek, Sensitivity, Work benefits, Legacy goals, Import, Document reader). A check, not a redo |
| **claude-f's claim rows go** (stale from 2026-11-13 02:46 UTC; write on the workboard first) | the eleven: Your plan (its last three headings as one part), Monthly check-in ("3 optional steps" as rows), Withholding check (the answer, then "6 more numbers"), Our guesses (already the model: a swap), Needs attention, Next best action, Plan health score, Estate documents, Step by step, Get started, Dashboard (nothing to fold) |

### 6.3 Hand-overs

- **claude-a, 13 folders** (`goals/emergency-fund`, `goals/vehicle`, `goals/travel`, `goals/charitable`,
  `debt/student-loans`, `debt/consolidation`, `taxes/state`, `taxes/self-employment`, `taxes/filing-status`,
  `taxes/documents`, `balance/projection`, `balance/statement`, `cashflow/statement`): one file,
  `docs/handoffs/2026-11-12-optional-claude-a.md`, in the format of `2026-11-11-touch-claude-a.md` (per page: to see
  it, seen, should, cause with file and line, a proposed fix as `part()` calls), with each page's `laneA` counts,
  and one workboard line. Nine of the thirteen are over a budget today; Consolidation is the heaviest first screen in
  the app (167 words, 26 figures). Say to the owner plainly: claude-a has not answered five hand-overs since
  2026-10-30, so on these pages the dial has nothing to open and the short view is whatever they show now, until
  someone adopts the helper there. They are reported by the check and never fail it.
- **claude-f, `modules/overview/guide/journeys.js`**: nothing. No pinned title is renamed (rule 17, the `pinned`
  list), so no guide step changes.
- **the designer** (design review): the four questions of 6.4, and the two open items the dial touches, F-027 (the
  row and the link under it are 44 px, not prose links) and F-035 (printing: 2.9).

### 6.4 Four questions for the owner (one line each, options ready)

1. The words: "How much detail" with "The short view" and "Everything open", and "Show everything on this page".
2. "Optional details" for a form's rarely needed boxes, in place of the entry's example "More options".
3. The links card: keep "More on this" everywhere, or "Go deeper".
4. The fold's mark: keep "›" turning down when open, or a down caret (a `base.css` change after wave 1).

---------------------------------------------------------------------------------------------------------------------

## 7. Risks, and what would make me drop this design

| # | risk | how likely, how bad | what catches or limits it |
|---|---|---|---|
| 1 | **The row is one more line on many pages**: the research's own objection to a per-page control | certain, small | only on a page with two or more parts; inside their card; a tick box, not a button. A design review on the phone decides |
| 2 | **Few will ever use the dial** (under 5% change a setting) | likely | it costs two small files; nothing depends on it; the rules deliver the simplicity |
| 3 | **Someone writes `if (detail.all)` in a view** and the two states drift | possible over months, bad | the import test (only two files may import `core/detail.js`) and the same-markup test |
| 4 | **Wave 1 and the dial give a state a person cannot predict** (a part that reopens by itself) | unknown: argued from code, not run | the touch test of 2.5 before any page after wave 1 lands |
| 5 | **Safari erases `localStorage` after seven days away** (not for an app on the Home Screen) | real on the owner's phone link | the page falls back to the short view; the row and Settings show the truth; one tap. Never store anything else there |
| 6 | **"Everything open" is slow or breaks a phone rule** on some page (a heavy part, a wide table) | possible | lazy bodies after the first paint; the phone script runs both states: time, overflow, 44 px |
| 7 | **A hero rewritten to rule 2 loses a fact** someone needed | possible, page by page | nothing is deleted: the old sentence moves into a part word for word; rule 6's never-fold list; the tester's pass per batch |
| 8 | **VoiceOver does not say "collapsed"** on a part | unknown | a real iPhone test in commit 1; the block summary is the shape known to work |
| 9 | **Find-in-page on an iPhone opens a part and does not move to it** | certain until WebKit fixes it | no worse than today's folds; explanations are built eagerly |
| 10 | **The node counts are not the phone's** (no layout: the first screen is the script's job) | certain | two layers: the node test ratchets the whole page, the phone script measures the first screen |
| 11 | **Four filled buttons on a long page with everything open** | certain on pages with several forms | the first screen keeps one in both states; a form's Save stays filled inside its own part |
| 12 | **Half the app is in other hands for now** (13 of claude-a, 11 of claude-f, 10 in flight) | certain | the plan's order; the check reports them apart; the dial does nothing on a page without parts, so nothing breaks |

**I would drop the per-page row** (and keep parts plus the device setting) if a design review with the owner on the
phone reads it as noise, or if the tester sees it ticked by accident more than once in a pass. It is one call in
`parts()`.

**I would drop the device setting too** (and keep parts) if the owner says it is not what "toggles" meant, if it
reads as a mode to a layperson ("which one am I in?"), or if the composition with wave 1 cannot be made predictable
without changing wave 1. It is one line in `part()` and one card.

**I would drop the whole design for inline-only** if, after batch A (twelve pages), `KNOWN` has not fallen by those
twelve pages' counts with the dial off, because then the parts are not carrying the simplicity and no dial can; or if
"everything open" fails a phone rule on more than one page in ten, because then the pages are not one markup in
practice.

What stays in every case: rules 1 to 18, the helper, the vocabulary and the check. The dial is the removable part,
which is the point of keeping it to one quiet line.
