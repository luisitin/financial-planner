# STAGES: depth follows the person. A design for "simple first, detail on request"

Designer's stance: **the journey decides how much is offered.** Every topic has a short page and a deeper page behind
it. Until the big picture (the path to Your plan) is finished, a page shows its short view and one quiet row to the
rest. After it, each result page offers "Go deeper", and a person can keep any part they use at hand on the short page.

Written 2026-11-12 on tip **737fb6a**. `$SP` =
`$SP`. Nothing in
`$REPO` or the read-only copy `$SP/opt/app` was edited. One page was prototyped for real
(Federal estimate, plus the Settings card) in the worktree `$SP/opt/proto-stages`, served on port 9851 (stopped; the
port is free; the worktree is left in place). Inputs read: `census.md`, `inventory.md`, `research.md`, `walks.md`,
`constraints.md`, and the two skeptics' files `verify-code.md` and `verify-web.md`, whose corrections are followed
where they differ from a report (section 8 lists which).

The owner's rule (2026-11-12, verbatim): "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality
of complexity. Default to less is more and allow more complexity or toggles. We want subtle optional complexity". The
day before: "After we finish the initial setup of, okay, we're going to do a big picture. Once we're in the big picture,
you can delve deeper and get better analytics and your results" and "user experience is key, and it should also provide
valuable insights ... It's got to be valuable".

---------------------------------------------------------------------------------------------------------------------

## 0. The design in twelve lines

1. **Two levels per topic, and the level is in the address.** `#/taxes/federal` is the short page: the answer, one
   sentence, one action. `#/taxes/federal?deeper=1` is the deeper page: a way back, the answer again in one line, then
   every other part of the page as a headed section. `?deeper=<part>` lands on one part.
2. **The offer follows the journey.** Before the path to Your plan was finished once, the short page ends with one
   quiet row, "More about this year's tax ›". After it, the row becomes a card, "Go deeper", with up to four rows
   worded as the questions they answer and "All 11 ›". The stage is read from the plan
   (`plan.guide.journeys.plan.finishedAt`, which the path's own Next button writes); it never goes back.
3. **Things a person uses are kept at hand, by their own tick.** Under every part of a deeper page: "Keep this on the
   Federal estimate page". Ticked, that part is drawn on the short page of this device from then on, with the same
   tick to put it back. Nothing is kept or moved by the app on its own.
4. **Nothing is ever out of reach.** In the first stage the one row leads to the whole deeper page. The stage decides
   how much is *offered*, never what can be *opened*.
5. **One helper, two new files, no wave-1 file touched:** `core/depth.js` (the stage and the device's memory, 60
   lines) and `core/ui/deeper.js` (`deeper(ctx, page, parts, opts)`, 183 lines). A view lists its optional parts once;
   the helper draws the row, the card, the kept parts and the deeper page.
6. **Folds are no longer the tool for depth.** A fold stays only where it holds an input the page's own action or a
   guide step names ("Figures the plan cannot see"), in a form ("5 more details"), and for the technical sections.
7. **One device setting, in Settings > "Going deeper":** a tick "List the deeper pages now, before my plan is
   finished", and the list of what this device keeps with "Put them all back". Neither changes a number or the plan.
8. **Measured on the prototype (Federal estimate, the family):** 3.27 screens, 480 words and 45 figures became 1.0
   screen, 62 words and 3 figures; first-screen load 61 to 23 on the census's own score. The deeper page holds
   everything the old page held (5.7 screens), prints whole, and a landing (`?show=charitable`) arrives at the right
   box. The plan was byte-identical after opening, keeping and putting back.
9. **The machine check** is a node test over every rendered short page with KNOWN counts that may only go down: at
   the tip 110 of 153 drawable pages are over the budget (160 words, 8 figures, 5 boxes, 4 tiles, 1 filled button).
10. **What it costs:** a tap that leaves the answer; a long deeper page; find-in-page sees one level; every short page
    needs its one sentence written per case; tests that read "the whole page" must name the level; and a household
    that never finishes the path keeps the one-row offer (none of the eight invented households has finished it).
11. **What it is not:** not a Simple/Detailed mode (both levels exist for everyone, at two addresses), not a dial
    (nothing opens everything), not adaptive (nothing moves because of what was used).
12. **The escape hatch:** the list of parts a view declares is mechanism-neutral. If the owner prefers folds, the same
    list can be drawn as folds in place by changing the helper, not the views.

### Why following the journey beats folds

- **The address is the memory.** Which level a person is on survives a save's redraw, Back, Forward, a reload, a closed
  tab and a link sent to another phone, with no storage at all. A fold needs wave 1's place memory, which lives in
  `sessionStorage`, in one tab, keyed by the fold's title (`w1/plan-place.md`; inventory 2.4), and is gone when the
  tab closes.
- **The short page really is short, and stays measurable.** A shut fold is still on the page: it is a row to read,
  its content is in the document, and a page of six shut cards is a column of chevrons (NN/g's accordion guidance:
  a page of collapsed panels looks empty). The census found 143 folds that open open and 109 shut ones with no status
  line: folds drift. A short page can be counted by a node test with no layout (section 4); "the first 844 px" cannot.
- **The deeper page works in every browser.** A closed `<details>` does not print (measured, research S51). Find-in-page
  opens a closed fold on Chrome and Firefox, but on the owner's iPhone Safari opens it and does not scroll to the match
  (WebKit bug 304174, still open; verify-web 1.1). The app's `summary` has no marker, which O'Hara names as a cause of
  lost "collapsed/expanded" announcements (verify-web section 4). A deeper page is plain headings, links and text.
- **A Save never writes a box the person did not see.** The guesses rule ("Never create, except from a box the person
  saw", constraints F7) is hard to keep when one form's boxes are half folded. Two levels have two forms with two Save
  buttons; each writes only its own boxes.
- **Heavy parts cost nothing until asked for.** A part's `build()` runs only on the deeper page (or when kept).
- **Folds cannot follow the journey.** Every fold is there from the first minute. Dana's eight path steps were 20.6
  screens and 2,755 words (walks, table "The path"); with stages each step page is its answer, its one action and Next.

### Why it beats a switch

- **Nobody has to find a setting or classify themselves.** Fewer than 5% of people change any setting (research S19),
  and "expert mode" asks people what they are (S2). The stage follows what the person has done, in the owner's own
  order: setup, the big picture, then depth.
- **A switch is all or nothing; keeping is per part.** A person who wants "From income to tax" at hand does not want
  the 13 assumptions of Rent vs buy open on every visit. The one field study the research cites (S18) measured exactly
  this: people preferred an interface they filled themselves, with the rest a tap away (13 of 20), over the full and
  the self-adapting menus (verify-web 1.5 corrects how the research read it; this design uses the corrected reading).
  Its warning is taken too: those who disliked it gave up on the set-up work, so keeping is one tick, where the
  person already is, and never required.
- **One version of each level to keep true.** A dial makes every page exist in two states that both have to pass the
  phone rules. Here the short page has one state per stage (a row or a card) and the deeper page has one.

### Why it is not "the app deciding from what you did" (research anti-pattern 2)

Office's menus hid and reordered things by use, silently and continuously. Here the offer changes **once**, at a
moment the person caused (they finished their plan), in one direction, and nothing is hidden: the same deeper page is
one tap away before and after. Rows are never reordered by use. What is kept is kept by a tick.

---------------------------------------------------------------------------------------------------------------------

## 1. The rules

Each rule is checked by the thing named in brackets: **[T]** `tests/short-page.test.mjs` (section 4), **[D]**
`tests/depth.test.mjs` (written, 6 tests, passing in the prototype), **[Q]** a browser flow in `qa/`, **[S]** a
screenshot read by the builder (rule 13).

### 1.1 Levels and stages

- **S1. Every front page has two addresses.** The short page at `#/<group>/<id>` and the deeper page at
  `?deeper=1`; `?deeper=<key>` is the deeper page landed on one part. Other keys in the address (`guide`, `step`,
  `from`) ride along in both directions, so the step bar and the way on are the same on both levels. [D]
- **S2. The short page does the page's job alone.** A first-time person gets a true answer and their next step
  without opening anything: the answer as the headline, one sentence, at most one filled button. [T counts; S]
- **S3. One sentence per case, written for that case.** The sentence under the headline is written out for every
  verdict the page can reach (owe, about right, back, nothing, not known yet), never assembled from clauses of a longer
  paragraph. Each case has a node test that reads it. (The prototype's first try spliced clauses and told a retired
  household with no tax "You have not entered any tax withheld ..., within a few hundred dollars of the $0 of federal
  tax"; section 5.10.) [module test]
- **S4. Two stages, read from the plan.** `stageOf(plan)` is `"first"` until
  `plan.guide.journeys.plan.finishedAt` is set, `"deeper"` after. It is set by the path's last Next
  (`modules/overview/guide/compute.js passStep` calls `finishGuide`), never by opening or closing anything. Once
  reached it stays, also when new data adds a step later. [D]
- **S5. The stage changes the offer and nothing else.** First stage: one row, "More about <subject> ›", to the top of
  the deeper page. Deeper stage: a card headed "Go deeper" with at most four rows and "All N ›". No number, verdict,
  step, menu entry or page differs between the stages. [D; Q: the two stages of one plan differ only inside
  `.dp-root`]
- **S6. Everything is one tap away in both stages.** Every part and every related page is listed on the deeper page;
  the short page links to it in both stages. A part that exists only in one stage fails. [D]
- **S7. A part is offered only when it has something to show.** `when()` false: no row, no section ("Two returns"
  only when filing separately). A row never leads to zeros or an empty table. [D]
- **S8. Two levels, never three.** The deeper page has no folds of its own except a form's "N more details" and
  "Show all N" on a list longer than 12 rows. A third level is another page, reached from "Related pages". [T: no
  `<details>` inside `.dp-page` but `.fm-more`]

### 1.2 What must be on the short page (may never live only on the deeper page)

- **S9. The answer and the reason to doubt it.** The headline; the pair that carries a verdict (what you plan to spend
  beside what the money can pay for); every "our guess", "partly our guesses", "not counted yet" and "does not add
  up" mark about the answer; "no official figures yet". (walks section 5; constraints V1, V8.) [S]
- **S10. Every alarm and every confirmation.** Red and amber notices, errors, the green line after a save, the review
  notice on Assumptions (owner, 2026-09-15 round 17). A row on the door may repeat an alarm ("needs a look"); it never
  replaces the notice. [T: a `.notice.warn`/`.error` is never inside a part]
- **S11. The action a link promised.** Whatever a guide step (`opens`, `target`, the words of `ask`), a Needs
  attention row, the monthly check-in or a notice's link sends a person to do is on the short page: "Figures the plan
  cannot see", "See or change each bill", "Save today's totals", "Retirement settings". (constraints V9, N2.) [T: for
  every step in `journeys.js` the named fold, button or box is found in the short page's drawing]
- **S12. An empty page says what to do first, and an empty list keeps its add form open** (constraints V2, V3). An
  empty page has no door: there is nothing deeper yet. [T]
- **S13. Net worth rows keep Edit and Delete; a zero is said in words; Plan basics stays first in Settings**
  (constraints V4, V5, T1; verify-code W13: the walks' three contrary proposals are not taken). [S]

### 1.3 Budgets (the short page as it opens, no tap, counted by [T])

Counted over the whole short page, outside shut folds, in the phone markup, for the worst of the test households.

| kind of page | words | money and percent figures | boxes | tiles | filled buttons | shut folds | notes |
|---|---|---|---|---|---|---|---|
| answer page (a result, a what-if) | 120 first stage, 160 deeper stage | 8 | 5 | 4 | 1 | 2 | the deeper stage's card is about 35 words; a what-if asks at most five figures first |
| list page (accounts, bills, debts, holdings) | 160 | 8 plus one per row shown | 0 while the list has rows | 4 | 1 | 2 | at most 6 rows, then "All N ›"; never cut a list of 8 or fewer (the tested floor is six, verify-web section 2 item 1) |
| add or edit form (the form's own first view) | - | - | 5 | - | 1 | 1 ("N more details") | Save in sight at 390 x 844 with the keyboard shut: the form's first view is at most 520 px tall |
| settings page | 200 | 0 | 5 | 0 | 1 | as many as it has cards | every list of switches is behind a card's status line |
| deeper page | no limit | no limit | per form 8 | - | 1 per form | 0 | a list over 12 rows shows 12 and "Show all N"; a part over two screens is a candidate for its own page |
| path step (any kind, while the step bar is on it) | as its kind | as its kind | as its kind | as its kind | 1 of its own, Next outlined until done (constraints N9) | as its kind | the frame's Next is on the second screen at the latest: the short page plus the frame is at most 2 screens |

The one number the owner ever chose stays: four tiles and a sentence (2026-09-16).

### 1.4 The door, keeping and forms

- **S14. The door is quiet and last.** It is never filled, never fixed to the screen, never a second menu; it sits
  after the page's own content and before the shell's way on. Rows are 52 px or taller. [T; Q `smallTargets(44)`]
- **S15. A row says what is inside and what of the person's it holds.** The label is the question the part answers.
  Under it one grey line (`status()`): a figure or a count. A part that holds figures the person typed carries a pill
  "2 yours"; a part where something is missing or wrong carries an amber pill "needs a look" and the reason as its
  grey line. Such a row is never cut off behind "All N". In the first stage the one row says so too. [D]
- **S16. Keeping is a tick, on this device, and says so.** "Keep this on the <Page> page" acts at once, confirms in
  green where the thumb is, writes `localStorage["planner.depth"]` and nothing else. A kept part is drawn on the short
  page after the page's own content with the same tick, ticked. With storage erased or blocked, the page is short.
  The short-page budget is measured with nothing kept. [D; Q: the plan is byte-identical after keep and put back]
- **S17. A form asks first only what the answer needs.** At most five boxes; the rest in one fold directly above
  Save, "N more details", with a status that counts ("none filled in", "3 filled in", "1 to fix"). Add and edit open
  the same way; the fold opens by itself only for an error inside it. A box that shows our grey guess is never
  folded: it is in the first view, or on the deeper page's own form (this settles constraints O2: a folded box can
  never write a guess, because no folded box has one). A what-if page's assumptions that all have defaults are a
  separate form on the deeper page with its own Save. [T; module tests]
- **S18. Opening, going deeper, coming back, ticking and unticking never change the plan.** [Q, as the census did:
  storage compared before and after]

### 1.5 Wording (section 3 has the list)

- **S19.** Plain words, the same in both stages; more detail is more figures, never harder words (constraints P6).
  No "Advanced", "Expert", "Simple mode", "Detailed", "Level", "Options" on any row. "Advanced" stays the name of the
  technical fold in Settings and nothing else. [T: a word list over the helper's and the views' part labels]

---------------------------------------------------------------------------------------------------------------------

## 2. The mechanism

### 2.1 Where it lives

Two new files. Neither is one of wave 1's (`core/app.js`, `core/router.js`, `core/search.js`, `index.html`,
`core/ui/dom.js`, `core/ui/base.css`, `modules/overview/guide/frame.js`), and no `ctx` field is added, so the gate
before `main` sees only two new files and the views that import them (they land in the same push, or the files first).

| file | what it is | lines in the prototype |
|---|---|---|
| `core/depth.js` | pure, and guarded device storage: the stage, what this device keeps, what the address asks for. Import-safe in Node. | 60 |
| `core/ui/deeper.js` | DOM only: `deeper(ctx, page, parts, opts)`. Uses `ui.h` and `ui.notice` and nothing else of the kit, so the text-only stand-in that module tests use can run it. | 183 |
| `tests/depth.test.mjs` | six node tests of both | 117 |

A view reaches the helper with `import { deeper } from "../../../core/ui/deeper.js"`, the way 53 views import
`core/words.js`. After wave 1 has landed, one line in `core/ui/dom.js` (`export * from "./deeper.js"`) would make it
`ctx.ui.deeper`; that line is for wave 1's owner.

No global CSS. Everything is drawn with classes that exist (`card`, `accent`, `hero`, `lede`, `page-list`,
`row-link`, `body`, `t`, `d`, `st`, `pill accent`, `pill warn`, `toggle-row`, `toggle-text`, `notice ok`, `muted`,
`small`). Twelve lines of style are scoped under `.dp-root` in a `<style>` the helper appends (95 views do the same).

### 2.2 `core/depth.js`

```js
export const DEPTH_KEY = "planner.depth";          // localStorage: { kept: { "group/id": ["part", ...] }, offer: bool }
export const PATH = "plan";                         // journeys.js PATH_ID; tests/depth.test.mjs holds the two equal
export const depth = {
  init(),                                           // read the device's storage again
  get offer(), setOffer(on),                        // the Settings tick: list the deeper pages before the plan is finished
  kept(page), isKept(page, key), keep(page, key, on = true),   // per page, in the order kept
  all(), clear(),                                   // for Settings: [{ page, key }], and "Put them all back"
};
export function stageOf(plan, { offer = depth.offer } = {})   // "first" | "deeper"
export function partAsked(query)                    // null: the short page; "": the deeper page from its top; "<key>": a part
```

- Storage is read in a try/catch with a copy in memory, like `core/view.js`: a private window, a sandboxed frame and
  the single-file copy keep the choice for the visit. A broken or foreign value is cleaned (`"group/id"` keys,
  string part keys) and anything else reads as nothing kept.
- An empty state removes the key, so an untouched device stores nothing.
- The sandbox shares the key (as `planner.view` does): a check sets the state it tests.
- `docs/DATA_MODEL.md` "Not in the plan" gets `planner.depth` (and, while there, the two it misses today,
  `planner.view` and `planner.nav`).

**Why `finishedAt` and not "the path is complete now".** `pathSummary(plan).complete` goes false again when new
data adds a step (a first loan adds "Your debts"). A page that offered "Go deeper" yesterday and one row today has
changed by itself, which is the unpredictability the research warns about. `finishedAt` is written once.

### 2.3 `core/ui/deeper.js`

```js
export const HEADING = "Go deeper";   // one word to change if the owner prefers "More on this" (open point O1)
export const ROWS = 4;                // rows on the card before "All N ›"

deeper(ctx, page, parts, { title, subject, answer }) -> {
  stage,          // "first" | "deeper"
  at,             // null | "" | "<part>": what the address asks for
  deep,           // true: draw the deeper page and return
  kept(),         // Node | null: the parts this device keeps, for the short page
  door(),         // Node: the one row (first stage) or the card (deeper stage); empty when there is nothing deeper
  page(root),     // draws the deeper page into root; returns the page's cleanup function
}
```

`page` is the page's key (`"taxes/federal"`); `title` its name ("Federal estimate"); `subject` the words after "More
about" ("this year's tax"); `answer` one line the deeper page repeats under its heading.

A part is one of:

```js
{ key, title, ask, build, status?, when?, heavy?, shows?, keep? }     // a part of this page
{ to: "group/id", ask, when? }                                        // another page that goes deeper
```

| field | meaning |
|---|---|
| `key` | kebab-case and stable: it is in addresses and in the device's memory |
| `title` | the section's heading on the deeper page ("From income to tax") |
| `ask` | the row's words on the short page, as the question it answers ("How is this worked out?") |
| `build` | `() => Node \| Node[]`, called only when the part is drawn: on the deeper page, or kept on the short page |
| `status` | `() => string \| { text, yours, alert }`: the grey line under the row; `yours` = how many of the person's own figures it holds; `alert` = words for something that needs a look |
| `when` | `() => boolean`: offered only when it has something to show |
| `heavy` | `true`: built when it comes within 600 px of the screen, when it is the part asked for, or when the page is printed |
| `shows` | the `?show=<key>` landings that live in this part (usually the names of its boxes) |
| `keep` | `false`: cannot be kept on the short page (a long table, small print) |
| `to` | a page key; the row is offered only when that page is ready, switched on and shown in this view (`ctx.modules`, `ctx.isReady`, `ctx.features.enabled`, `ctx.shown`) |

**What it draws.**

- **`door()`, first stage:** `<nav class="dp-root dp-door" aria-label="More about this year's tax">` holding one
  `ul.page-list > li > a.row-link`: "More about this year's tax ›" and under it a grey line that names the first part
  and counts the rest ("The four numbers and 10 more"), plus "2 yours" when parts hold the person's own figures, or in
  place of it the words "One thing in here needs a look" with the amber pill.
- **`door()`, deeper stage:** `<section class="card dp-root dp-go" aria-label="Go deeper">` with an `h2` and a
  `ul.page-list`. The prototype lists the page's own parts first, then the related pages; the build keeps one order, the view's
  (section 5.2 shows why). With more than five in all, four are shown and a last row "All N ›" goes to the top of the deeper page; parts with `alert` or `yours`
  take their place among the four first. A kept part is on the page already, so it has no row.
- **`kept()`:** for each kept part that still applies, a `section.card.dp-part` with the part's heading, its body and
  the tick, ticked. Unticking replaces the section with a green notice ("Put back. "From income to tax" is under Go
  deeper again.") and redraws the door in place. No page redraw, no `store.update`.
- **`page(root)`:** a link back, `<a class="dp-back" href="<the short page>" data-back>‹ Federal estimate</a>`; a
  hero with `h1` "Federal estimate: the detail" and the answer line; each part as
  `<section class="card dp-part" id="dp-<key>" tabindex="-1" data-part="<key>">` with an `h2`, the body and the tick
  "Keep this on the Federal estimate page"; a card "Related pages" with the `to` rows; in the first stage one small
  grey line, "Once your plan is finished, the Federal estimate page lists these one by one under "Go deeper"."

### 2.4 How open state is remembered, with wave 1's place memory

| what | where it is kept | redraw after a save | Back and Forward | reload | closed tab, another device |
|---|---|---|---|---|---|
| which level (short or deeper), and which part was asked for | the address | kept (the shell redraws the same route) | kept (two history entries) | kept | kept (the link is the state) |
| where the screen was on each level | wave 1, per history entry | kept (the shell's `keepScroll` today) | kept by wave 1; **today Back lands at the top of the short page** (measured: `scrollY 0`) | kept by wave 1 | not kept |
| a fold a person opened (input folds, "N more details") | wave 1, per history entry, by the fold's title | kept by wave 1 | kept by wave 1 | kept by wave 1 | not kept |
| a part kept on the short page | `localStorage["planner.depth"]`, this device | kept | kept | kept | kept on this device; gone if Safari erases storage after seven days without a visit in a tab (not for the home-screen app), and then the page is simply short |
| the stage | the plan | kept | kept | kept | follows the plan to every device |

So the helper adds one small store and leans on the address for the rest. It adds no module-level "open" variable.
What wave 1 needs from it: native `<details>` with a fixed title for the folds that remain (unchanged), and the
`data-back` attribute on the link back (wave 1's `a[data-back]` goes Back when the entry behind is that page, else
follows the link; before wave 1 lands it is an ordinary link).

Two seams to check against wave 1's build, neither needing an edit there now:
- `router.sameEntry(want, had)` compares only the keys the link has. A `data-back` link to the short page therefore
  also accepts a deeper-page entry as "the page behind". The helper's own link is never in that position (a landing
  replaces its entry instead of adding one); a later rule "`deeper` must match both ways" would close it for good.
- Typing memory is filed per page. Typing left unsaved in a deeper-page form, then Back: verify that the short page
  shows wave 1's "Not saved yet" note with a way to the form, and does not drop the typing.

### 2.5 An error or a changed figure inside a part that is not on screen

- **A changed figure.** The part's `status()` returns `yours: n`; its row carries the pill "n yours" and is never cut
  off behind "All N"; in the first stage the single row says "… · 2 yours". (Prototype: after two deductions were
  saved, the row read "Would itemizing save tax? itemizing: $38,206 [2 yours]".)
- **Something missing or wrong that persists** (a required figure not given, figures that do not add up):
  `status()` returns `alert: "<words>"`; the row carries the amber pill "needs a look" and the words. If it changes the
  answer it is **also** a notice on the short page (S10); the row is the way to it, not the warning itself.
- **A failed Save.** A form lives wholly on one level, so the failing box is on the screen the person is on. Inside a
  form's "N more details" the failing box opens the fold (the `invalid` listener of `goals/goals`, and wave 1's kit
  opens every shut ancestor of a failing box).
- **Typing not saved** on the deeper page: wave 1's note (2.4).

### 2.6 Landings

- `?deeper=<key>`: after drawing, the part is scrolled to the top (below the top bar, by the `scroll-padding-top` the
  shell already sets) and takes the focus; once per arrival. A `WeakSet` of route objects keeps the redraw after a
  save from scrolling again (found in the prototype: without it a Save on the deeper page jumped back to the part's
  top).
- `?show=<key>` on the short page, when a part lists that key in `shows`: the helper replaces the entry with
  `?deeper=<part>&show=<key>` (`location.replace`, so Back does not bounce), and the deeper page rings the box's
  label for two seconds and focuses the box. Measured: `#/taxes/federal?show=charitable` arrives at "Charitable
  gifts" with the focus in it. A `?show=` key that belongs to the short page is the view's own business, as today.
- `?edit=`, `?add=`, `?type=`: their forms stay on the short page (S11); nothing changes.
- A guide step's `opens: "<fold title>"`: the fold stays on the short page under its pinned title. Measured: the tax
  guide's step still opens "Figures the plan cannot see" (`?guide=taxes&step=estimate`), tip and prototype alike.
- An address that names a part that does not apply (`when()` false) or does not exist draws the deeper page from the
  top.

### 2.7 Heavy parts, printing, find-in-page, screen readers, 44 px

- **Heavy parts.** `build()` is never called on the short page unless the part is kept. On the deeper page light
  parts are built at once; a `heavy` part shows "Working it out…" and is built when it comes within 600 px of the
  screen (`IntersectionObserver`), at once when it is the part asked for, and for all parts on `beforeprint`. Where
  there is no observer (Node, an old browser) everything is built at once. Not exercised by the prototype: Federal
  estimate has no heavy part. The first candidates are the chart on Will the money last? and the year tables.
- **Printing.** The deeper page prints whole: every part is in the document and nothing on it is shut. Measured in
  Chromium: the family's Federal deeper page is a four-page PDF holding the walk, the itemized form and the sources
  (`$SP/opt/proto-stages-shots/11-federal-deeper-print.pdf`). The short page prints short. The few input folds left on
  short pages still print shut; that is today's behavior and FEEDBACK F-035's to settle, and there are far fewer of
  them. Safari and Firefox were not measured.
- **Find-in-page** finds what is on the level on screen. On the deeper page that is everything, in every browser,
  with no reliance on Safari's partial support. On the short page a search for "standard deduction" finds the row
  "Would itemizing save tax? the standard $32,200 is better" and not the walk behind it. This is a cost (section 7).
- **Screen readers.** The door is a `nav` or a `section` with an `aria-label`, holding a list of links whose names are
  the question plus the grey line. The deeper page starts with the link back and an `h1`, each part is a `section`
  with an `h2`, and the part asked for takes the focus. The tick is a real checkbox in a `label`; its confirmation is
  a `role="status"` notice and is also sent through `ctx.announce`. Nothing depends on how a `summary` announces
  itself. Not tested with VoiceOver on a real iPhone.
- **44 px.** Measured with the kit's census at 390 and 320 px: the rows are 52 to 60 px tall and full width, the tick
  row 44, the link back 44; no target under 44 px, nothing off the side, no sideways scroll.

### 2.8 How a view adopts it

```js
import { deeper } from "../../../core/ui/deeper.js";

export function render(root, ctx) {
  // ... compute as before; write `head` and `line`, one sentence per case (S3) ...
  const dp = deeper(ctx, "taxes/federal", [
    { key: "numbers", title: "The four numbers", ask: "The numbers behind it", when: () => hasIncome, status: () => `${rate} of your income overall`, build: () => numbersPart() },
    { key: "how", title: "From income to tax", ask: "How is this worked out?", when: () => hasIncome, status: () => `${steps.length} lines, from income to tax`, build: () => walkPart() },
    { key: "itemized", title: "Itemized deductions", ask: "Would itemizing save tax?", shows: ["mortgageInterest", "charitable", /* ... */],
      status: () => ({ text: itemizing ? `itemizing: ${money(total)}` : `the standard ${money(standard)} is better`, yours: typedCount }), build: () => deductionsPart() },
    { to: "taxes/brackets", ask: "What would more income cost?" },
    { to: "taxes/projection", ask: "What about later years?" },
  ], { title: "Federal estimate", subject: "this year's tax", answer: `${head}. ${line}` });
  if (dp.deep) return dp.page(root);                 // the deeper page; its cleanup is the page's cleanup
  root.append(hero, ...notices, figuresFold);        // the short page: answer, alarms, the input a step asks for
  const kept = dp.kept(); if (kept) root.append(kept);
  root.append(out, dp.door());
}
```

Steps for a page (what the prototype did to Federal estimate):
1. Sort the page's content into: answer and alarms (short), the input the page's action or a step names (short, as it
   is), and parts (everything else). Existing cards and folds become `() => [nodes]` functions; a fold that becomes a
   part loses its `<details>` and keeps its form.
2. Write the headline and the one sentence for every case (S3), with a test per case.
3. Move the page's own "More on this" links into `to:` rows, so there is one card and not two.
4. Give every part its `status()`; give forms' parts their `shows`.
5. In the module's tests, read the level a sentence lives on: `route: { query: { deeper: "1" } }` for text that
   moved (Federal: one helper in `module.test.mjs`, one test in `tests/wording-verify.test.mjs`).
6. `node tools/shot.mjs <group>/<id>` for the short page, and again with `--eval 'location.hash += "?deeper=1"'` for
   the deeper page; read both. Lower the page's KNOWN entry in `tests/short-page.test.mjs`, or delete it.

For add and edit forms (S17) a third export of the same file, designed and not yet built:

```js
shortForm(ui, form, first, { noun = "details" } = {}) -> form
```

`form` is a built `ui.form`; `first` the keys of the boxes that show at once. Every other label moves, in its order,
into one native `<details class="fold fm-more">` placed directly above `.form-actions`, titled "N more details",
with `.fold-status` "none filled in", "3 filled in" or "1 to fix". It is the `goals/goals` recipe (`MORE`,
`foldMore`), made shared: built with `append` only (the stand-in DOM has no `insertBefore`), opened by an `invalid`
event inside it, shut otherwise for add and for edit. It never folds a required box or a box that shows a grey guess:
it leaves such a box in the first view and reports it, and the node test fails. When wave 1's follow-up
(`more: true` inside `ui.form`) exists, `shortForm` becomes a two-line wrapper around it.

### 2.9 The device setting

One card in `modules/system/settings`, "Going deeper", after "Pages" and before "Your data" (Plan basics stays
first, the technical folds stay last; constraints T1, T2). Prototyped
(`$SP/opt/proto-stages-shots/14-settings-going-deeper.png`, `15-settings-ticked.png`).

| control | what it changes, exactly | what it never changes |
|---|---|---|
| tick "List the deeper pages now, before my plan is finished" (shown only while the plan is not finished; after that the card says "Your plan is finished, so each result page lists its deeper pages under "Go deeper".") | `depth.offer`. On this device the short pages draw the "Go deeper" card in place of the one row. Acts at once; green notice "Pages on this device now list their deeper pages under "Go deeper"." | the plan, any number, the path, the menu, which pages exist, what the build view shows, the technical folds |
| "Kept on this device's pages: Federal estimate (1), Net worth (2)." and an outlined "Put them all back" | `depth.clear()`: every short page on this device is short again. Green notice "Put back. Your pages are short again on this device." | the same |

With nothing stored, with storage blocked and after the browser has erased it, the device is in the plain state: one
row before the plan is finished, nothing kept. It is never asked at first open, never on by default, and is not the
only way to anything (constraints 4.3 items 8 and 10). It is a different switch from "Show what is still being built"
and shares no code or wording with it. It redraws only its own card, never through `store.update` (constraints F9).
There is no address switch for the stage: checks use a plan whose path was walked
(`qa/fixtures/finished-plans.mjs`, section 4) and set `planner.depth` themselves.

---------------------------------------------------------------------------------------------------------------------

## 3. The vocabulary

One phrase per job. Words in angle brackets are filled per page.

| where | the words | notes |
|---|---|---|
| the one row, before the plan is finished | **"More about <subject> ›"** ("More about this year's tax ›") | the subject is the page's answer in the person's words, so the first eleven characters carry meaning (verify-web 1.2: never a bare "More…" or "More options") |
| the grey line under it | **"<first part> and N more"**, plus **"· 2 yours"**; or **"One thing in here needs a look"** | |
| the card, after | heading **"Go deeper"** | open point O1 below |
| a row for a part of this page | the question it answers: "How is this worked out?", "Would itemizing save tax?", "Which of my figures does it use?", "What does this leave out?" | a noun phrase where a question would be forced: "The numbers behind it", "Each of your two returns" |
| a row for another page | the question that page answers: "What would more income cost?" (Bracket explorer), "What about later years?" (Tax, year by year), "The money, year by year" | not the page's menu title |
| the last row | **"All N ›"** | N counts parts and pages |
| the deeper page's heading | **"<Page>: the detail"** | a page whose title ends in a question mark passes its own ("Your retirement: the detail"); a build change, the prototype has no such option |
| the link back | **"‹ <Page>"** | |
| the card of `to` rows on the deeper page | **"Related pages"** | |
| the tick | **"Keep this on the <Page> page"** | |
| after ticking | **"Kept. "<Part>" now shows on the <Page> page on this device."** | |
| after unticking | **"Put back. "<Part>" is under Go deeper again."** (before the plan is finished: "... is under More about <subject> again.") | |
| a part's own figures | pill **"1 yours" / "N yours"** (accent) | replaces the eight spellings in inventory 1.2 ("yours", "set by you", "N typed", ...) on rows; the pinned fold line "2 typed" on "Figures the plan cannot see" stays until that fold is next touched |
| a part that needs attention | pill **"needs a look"** (amber) and the reason as the grey line | amber means attention (constraints P4); "yours" uses the accent, never green, amber or red |
| nothing typed | **"not set yet"** | one spelling for the nine in use |
| a form's fold | **"N more details"**, status **"none filled in" / "3 filled in" / "1 to fix"** | never "More options" (verify-web 1.2). The boxes shown first are the needed ones; a shown box that may be skipped says "(optional)" in its label, and the fold's help line says "All of these can be left empty", so both sides of the split are marked (verify-web 1.3) |
| a long list on a deeper page | **"Show all N"** | the three existing "show more" buttons keep their words |
| Settings | card **"Going deeper"**; **"List the deeper pages now, before my plan is finished"**; **"Put them all back"** | |
| kept as they are | "Figures the plan cannot see", "See or change each bill", "Set your month in one number", "Retirement settings", "Show details", "+ Add another <thing>", "Advanced" (Settings) | pinned by tests and guide steps (inventory section 6) |
| never on a row or a tick | Advanced, Expert, Pro, Simple, Detailed, Level, Mode, Options, a bare More | |

**Open point O1, for the owner** (constraints 1.11): the design log of 2026-11-06 named a page's own links card
"More on this" (37 views say it); the entry of 2026-11-12 says deeper pages are reached by "Go deeper" links. This
design merges the two cards into one and heads it "Go deeper", the owner's own verb ("delve deeper"). It is one
constant (`HEADING`). Options: A) "Go deeper" everywhere the helper draws the card; B) keep "More on this" as the
heading and use the question rows under it. Until the owner picks, pages that have not adopted the helper keep "More
on this", and no page is ever headed "Next".

---------------------------------------------------------------------------------------------------------------------

## 4. The machine check

Three node tests and one browser flow. All of them read the app as a person meets it; none reads a design's own
classes except to find the helper's own nodes.

### 4.1 `tests/short-page.test.mjs`: the budget, with KNOWN counts that may only go down

Prototyped as `$SP/opt/stages-work/short-page.mjs` (the counter and the run; 47 s for 159 pages x 7 households on
this machine, so the test uses four households: about 27 s; the full sweep stays a script).

- Draws every usable view's **short page** (`route.query = {}`) in Node with the repo's stand-in DOM
  (`qa/fixtures/fake-dom.mjs`), for `family`, `familyDone` (the family with the path walked: the deeper stage),
  `retiredCouple` and `empty`. `qa/fixtures/finished-plans.mjs` builds the walked plans by calling the path's own
  `passStep` until `pathSummary().complete` (prototype: `$SP/opt/stages-work/lib.mjs`). None of the repo's fixtures is
  in the deeper stage today, so this fixture is needed by any check of it.
- Counts what a person meets with no tap: everything outside a shut `<details>`, outside `.only-wide`, not hidden:
  words, money and percent figures, boxes, tiles, cards, filled buttons, shut folds.
- **The budget** (S-rules 1.3, one line for all kinds to start with): 160 words, 8 figures, 5 boxes, 4 tiles, 1 filled
  button, for the worst household.
- **KNOWN**: every page over the budget today, with its worst counts. At the tip that is **110 of the 153 pages that
  can be drawn** (99 over on words, 76 on figures, 26 on boxes, 10 with two filled buttons, 4 on tiles). A page may
  not exceed its KNOWN entry; a page not in KNOWN may not exceed the budget; a count that fell is reported as a
  diagnostic line so the entry is lowered, exactly as `tests/guess-sanity.test.mjs` does. The sum of all short
  pages' words for the family (36,113 today) is printed with every run.
- A page that has adopted the helper (its deeper route draws `.dp-page`) may have **no** KNOWN entry: it meets the
  budget of its kind or the test fails.
- claude-a's 13 folders are listed apart (`CLAUDE_A_LANE`, as `tests/wording.test.mjs` does) and reported as to-do,
  never failed: 10 of them are over the budget today.
- Nine pages cannot be drawn in Node for at least one household today (`goals/goals`, `household/calendar`,
  `household/people`, `insurance/health`, `insurance/term-vs-permanent`, `investments/allocation`,
  `investments/crypto`, `investments/employer-stock`, `system/settings`: they use `insertBefore`, a promise from
  `api.ready()`, or data the fixtures lack). They are named in the test as "not counted", a list that may also only
  shrink; the two that matter first (`goals/goals`, `system/settings`) need a three-line stand-in each.

Known counts at the tip for the eight pages of section 5 (worst household; words, figures, boxes, tiles, filled):

| page | today | after (prototype measured, others the target) |
|---|---|---|
| `taxes/federal` | 473, 45, 1, 4, 1 | **93, 5, 1, 0, 1 (measured)** |
| `retirement/projection` | 499, 30, 0, 4, 1 | 150, 6, 0, 0, 1 |
| `system/assumptions` | 284, 11, 10, 2, 1 | 120, 4, 2, 0, 1 |
| `balance/net-worth` | 196, 22, 6, 4, 1 | 150, 12, 5, 1, 1 (a list page: 6 rows) |
| `cashflow/expenses` | 291, 31, 6, 4, 1 | 110, 6, 5, 2, 1 |
| `retirement/contributions` | 220, 15, 5, 0, 2 | 150, 6, 5, 0, 1 |
| `property/rent-vs-buy` | 345, 20, 17, 2, 1 | 130, 4, 5, 0, 1 |
| `retirement/cash-flow` (a deeper page: no budget) | 913, 212, 2, 0, 1 | 12 rows then "Show all 31" |

### 4.2 The same test, three more assertions

- **What a step asks for is on the short page (S11).** For every step in `journeys.js` with `opens`, `target` or a
  label that `guide/compute.js targetsOf` finds in its `ask`: the short page's drawing holds a `summary`, button, link
  or box label with those words. Today's count of misses is the baseline (expected 0); it may not grow.
- **No alarm inside a part (S10).** Drawing each adopted page's deeper page, no `.notice.warn` or `.notice.error`
  is inside a `.dp-part` unless the same words are on the short page.
- **Reachability (S6).** Every page offered in the household's menu is a front page, or is linked from some front
  page's short or deeper page. The count of pages reachable only through the menu is a KNOWN number that may only go
  down (the walks counted about 40 such pages from the 14 pages walked).

### 4.3 `tests/depth.test.mjs` (written; six tests, passing)

The stage is the path's finish mark and never goes back; the device's memory per page, cleaned when broken, absent
when empty; the address names the level; the short page builds no part and shows one row, then the card of four and
"All N" with "yours" and "needs a look" kept in view; the deeper page builds every part that applies and its link
back carries the frame's keys; a kept part is drawn on the short page and leaves the door.

### 4.4 `qa/flows/deeper.js` (the walk the prototype did by hand)

On a phone, in the sandbox, for each adopted page: open the short page; tap the door; Back; tap a row; tick Keep;
Back; untick; open a `?show=` landing; save a form on the deeper page; reload. After each step: the address, the
scroll, the focus, the notices, `qa.smallTargets(44)`, no sideways scroll, and **the saved plan compared byte for
byte** with before (except after the Save). `qa/smoke-all.mjs` gains the deeper page of every adopted page as a
second address to sweep. The census (`$SP/opt/census.mjs --root <worktree> --pages ...` and `cmp.mjs`) stays the
measure of the first screen's load for a before and after.

---------------------------------------------------------------------------------------------------------------------

## 5. Worked examples: eight real pages, redrawn

The eight, chosen from the census's heaviest and the pages the owner's path runs through. "Today" is the tip, the
family household unless said, counted by the node counter of section 4 (worst household for the KNOWN line). The
frames are 390 px wide, about 46 characters a line. `[ ... ]` is a filled button, `( ... )` an outlined one, `›` a row
that goes somewhere. **Only 5.1 and the card in 5.7 were built and measured.** In the other six the figures are the
tip's own where the tip shows them, and `NN` where the redraw needs a figure the tip does not print; their counts are
counted from the frame and are targets.

| # | page | lane | today, worst household (words, figures, boxes, tiles) | short page after |
|---|---|---|---|---|
| 5.1 | Federal estimate `taxes/federal` | free (a path step) | 473, 45, 1, 4 | **93, 5, 1, 0 measured** |
| 5.2 | Will the money last? `retirement/projection` | in flight, the retirement request (L2, L4, L5) | 499, 30, 0, 4 | about 150, 6, 0, 0 |
| 5.3 | Assumptions `system/assumptions` | in flight (L5) | 284, 11, 10, 2 | about 120, 4, 2, 0 |
| 5.4 | Net worth `balance/net-worth` | free (a result row of the path) | 196, 22, 6, 4 | about 150, 12, 5, 1 |
| 5.5 | Expenses `cashflow/expenses` | free (a path step) | 291, 31, 6, 4 | about 110, 6, 5, 2 |
| 5.6 | Retirement contributions `retirement/contributions` | in flight (L3, L6) | 220, 15, 5, 0 and two filled buttons | about 150, 6, 5, 0, one filled |
| 5.7 | Settings `system/settings` | free | 2.3 screens, 22 shut folds (the census; not drawable in Node) | one new card, prototyped; the rest unchanged |
| 5.8 | Rent vs buy `property/rent-vs-buy` (the long form) | free | 345, 20, 17, 2 | about 130, 4, 5, 0 |

### 5.1 Federal estimate (built: `$SP/opt/proto-stages`, patch `$SP/opt/stages-work/proto-stages.patch`)

**Today.** A hero whose paragraph is 60 words, four tiles, the 11-line walk from income to tax, "What the plan
already knows", three shut folds ("Figures the plan cannot see", "Itemized deductions", "Year and people"), the
small print and a links card: 3.27 screens, 480 words and 45 figures for the family.

**The short page, before the plan is finished** (measured: one screen, 62 words, 3 figures; 970 px as a path step
with the step bar above and Next below; shot `01-federal-step-first-stage.png`):

```
+------------------------------------------------+
| You would owe about $5,253 in April            |  h1: one of six cases, each with its own sentence
| Your paychecks take out about $9,470 by        |
| December (estimated from your pay), against    |
| about $14,723 of federal tax for 2026.         |
| [ Fix it in your paychecks ]                   |  the page's one action
| An estimate, not tax advice.                   |
+------------------------------------------------+
| Figures the plan cannot see     none typed   › |  fold, shut: stays, the tax guide's step opens it
+------------------------------------------------+
  More about this year's tax                    ›    the door: one row, 52 px
  The four numbers and 10 more
```

The other cases, as the invented households draw them: "About right: nothing to fix for April" (the renter: "Your
paychecks take out about $2,500 by December (estimated from your pay), within a few hundred dollars of the year's
tax (about $2,500)."; button "Check your paychecks"); "About $1,839 of this year's tax is still to pay" (the retired
couple: "$1,241 is overdue now, $414 is due by 1/15/2027, and the rest when you file."; button "Plan the estimated
payments"); "No federal tax for 2026" ("Your income is under what gets taxed this year, so there is nothing to pay in
April."); a refund ("About $X back in April"; no invented household reaches it); and the empty page ("Federal tax
for 2026", one box "Your pay this year, before tax", "Show my tax"). Two things are left for the build: a node test
per case (rule S3; the prototype's tests read the page's text but not case by case), and the "no tax" case still
offers a button, "See the estimated payments", that has nothing to show.

**The same page after the plan is finished** (measured: 1.26 screens, 97 words, 5 figures; shot
`03-federal-short-deeper-stage.png`). The row becomes:

```
+------------------------------------------------+
| Go deeper                                      |
| The numbers behind it                        › |
|   9.3% of your income overall                  |
| How is this worked out?                      › |
|   11 lines, from income to tax                 |
| Which of my figures does it use?             › |
|   3 figures from your pages                    |
| Would itemizing save tax?                    › |
|   the standard $32,200 is better               |  after two deductions were typed:
| All 11 ›                                       |  "itemizing: $38,206   [2 yours]"
+------------------------------------------------+
```

**The deeper page** `#/taxes/federal?deeper=1` (measured: 5.73 screens, 668 words, 50 figures, 10 boxes; shots
`02b-federal-deeper-page-top.png`, `04b-federal-deeper-page-full.png`):

```
  ‹ Federal estimate                                 the way back, 44 px
+------------------------------------------------+
| Federal estimate: the detail                   |
| You would owe about $5,253 in April. Your      |
| paychecks take out about $9,470 by December... |
+------------------------------------------------+
| The four numbers                               |
| Married filing jointly, $158,780 of income.    |  the old 60-word paragraph lives here
| That is 9.3% of it overall; the next dollar... |
| [$14,723 Federal tax]  [9.3% Of your income]   |
| [23% On the next dollar] [$124,733 Taxable]    |
| [ ] Keep this on the Federal estimate page     |  the tick, 44 px
+------------------------------------------------+
| From income to tax                             |
| Income                               $158,780  |
| Adjustments                             -$509  |
| ...                      (11 lines)            |
| Federal tax                           $14,723  |
| [ ] Keep this on the Federal estimate page     |
+------------------------------------------------+
| What the plan already knows     (3 figures)    |
+------------------------------------------------+
| Itemized deductions   (6 boxes, Save deductions)|  ?show=charitable lands here, box focused
+------------------------------------------------+
| Year and people            (4 boxes, Save)     |
+------------------------------------------------+
| What this estimate leaves out                  |  the small print and the sources; cannot be kept
+------------------------------------------------+
| Related pages                                  |
| What would more income cost?                 › |  Bracket explorer
| What about later years?                      › |  Tax, year by year
| Tax on something you sell                    › |  Capital gains
| What about state tax?                        › |  State
| A tax report to print                        › |  Reports
+------------------------------------------------+
  Once your plan is finished, the Federal estimate    (first stage only)
  page lists these one by one under "Go deeper".
```

**Kept.** Ticking "Keep this" under "From income to tax" answers in green, "Kept. "From income to tax" now shows on
the Federal estimate page on this device."; the short page then carries that card between the fold and the door
(2.34 screens), with the tick ticked; unticking there puts it back in place (shots `05`, `06`, `07`).

**Not done in the prototype, to do in the build:** the empty page still shows the row ("Itemized deductions and 3
more"), which rule S12 forbids; the view should not call `door()` while there is no income. The lazy path (`heavy`)
is not exercised, because nothing on this page is heavy.

### 5.2 Will the money last? (`retirement/projection`; in flight)

**Today.** The verdict, four paragraphs (24, 42, 13 and 16 words), two outlined buttons, four tiles, the chart with a
21-word caption, "What goes into this" (8 rows) and the shut fold "Retirement settings" (7 boxes). The retirement
request is rewriting this view now: it adds the card "What this rests on" under the hero, the page's one filled
button "Check the numbers behind this", and a small "Go deeper" card of three links worded as questions ("What
matters most?", "Try two plans side by side", "What if history repeated?"). **That card is this design's door,
written by hand.** So this page is adopted after the request lands, and what is drawn here is what `deeper()` then
takes over: nothing of L2 to L5 is redone.

```
+------------------------------------------------+
| Your money lasts to the end                    |  h1: the verdict, today's words
| You plan to spend $84,000 a year. Even in a    |  the pair that carries the verdict (S9)
| bad run of years it can pay for $NN,NNN.       |
| Partly our guesses                             |  the mark, when it applies (S9)
| [ Check the numbers behind this ]              |  the retirement request's one filled button
| Retirement starts in 2055 (Ana at 65).         |
| Change the age ›                               |
+------------------------------------------------+
| What this rests on                           › |  the request's card: open when short or tight,
|   7 numbers: 3 yours, 2 our guesses, 2 usual   |  a shut fold with this line when on track
+------------------------------------------------+
| Retirement settings        $7,000 a month    › |  fold, shut; pinned title; levers and steps land here
+------------------------------------------------+
| Go deeper                                      |  (first stage: "More about your retirement ›")
| How sure is this?                            › |  -> Chance the money lasts
| The money, year by year                      › |  -> Year by year
|   60 years, 2026 to 2085                       |
| What matters most?                           › |  -> Sensitivity (the request's words)
| The four numbers behind it                   › |  own part: the four tiles
|   $1,197,177 at retirement, in today's dollars |
| All 10 ›                                       |
+------------------------------------------------+
```

Behind "All 10": the page's own parts "The four numbers" (the tiles), "Money over the years" (the chart;
`heavy: true`, the first user of the lazy path), "What goes into this" (8 rows; "Which of my figures does it use?"),
"If markets do as well as average" (the 24-word paragraph and its $101,203); and the pages Could you stop sooner?
(Goal seek), Try two plans side by side (Scenario compare), What if history repeated? (If history repeated).

The deeper page:

```
  ‹ Will the money last?
+------------------------------------------------+
| Your retirement: the detail                    |  this page passes its own heading (its title
| Your money lasts to the end. You plan to spend |  ends in a question mark)
| $84,000 a year; a bad run can pay for $NN,NNN. |
+------------------------------------------------+
| The four numbers                               |
| [$1,197,177 At retirement] [$NN,NNN Spending   |
|  that lasts] [37% Paid by income] [$871,107    |
|  Left in 2085]                                 |
| [ ] Keep this on the Will the money last? page |
+------------------------------------------------+
| Money over the years                           |  the chart: "Working it out..." until it comes
| [ ] Keep this on the Will the money last? page |  within 600 px of the screen
+------------------------------------------------+
| What goes into this                 (8 rows)   |
+------------------------------------------------+
| If markets do as well as average               |
|   it can pay for $101,203 a year on top of     |
|   health insurance                             |
+------------------------------------------------+
| Related pages                                  |
| How sure is this?                            › |
| The money, year by year                      › |
| What matters most?                           › |
| Could you stop sooner?                       › |
| Try two plans side by side                   › |
| What if history repeated?                    › |
+------------------------------------------------+
```

**What drawing this page changed in the mechanism.** Two things. "Will the money last?: the detail" is not a
heading, so a view may pass the deeper page's heading (`detail`). And the first rows a person wants here are other pages. The
prototype's helper lists a page's own parts before its related pages, so the tiles would have pushed "How sure is
this?" behind "All 10". The build keeps one order, the view's (one line in the helper; `tests/depth.test.mjs` gets a
case).

### 5.3 Assumptions (`system/assumptions`; in flight)

**Today.** A 44-word hero, the amber review notice, two tiles, a form of ten boxes with "Save and mark as reviewed",
a 26-word note, "Reset to defaults", and the shut fold "Where these numbers come from" (ten paragraphs, about 320
words). The retirement request (L5) adds chips above the stock box (Careful 6%, Middle 7% ours, Hopeful 8%) and the
inflation box (2.5%, 3% ours, 4%). Adopted after L5 lands.

```
+------------------------------------------------+
| Assumptions                                    |
| Two numbers move every answer the most: how    |
| fast investments grow and how fast prices      |
| rise. Pick one for each, or leave ours.        |
+------------------------------------------------+
| ! You have not looked these over yet. Saving   |  stays a notice (owner, 2026-09-15 round 17)
|   marks them as reviewed.                      |
+------------------------------------------------+
| Stocks grow each year                          |
| ( Careful 6% ) ( Middle 7%, ours ) ( Hopeful 8% )  chips first (L5), then the exact box
| [ 7        ] %                                 |
| Prices rise each year                          |
| ( 2.5% ) ( 3%, ours ) ( 4% )                   |
| [ 3        ] %                                 |
| [ Save and mark as reviewed ]                  |
+------------------------------------------------+
| Go deeper                                      |  (first stage: "More about these numbers ›
| The other 8 numbers                          › |   The other 8 numbers and 2 more")
|   all as we set them            (or "2 yours") |
| Where do these numbers come from?            › |
|   a source for each of the ten                 |
| What did I change?                           › |  only when something differs from ours
| What would a different number do?            › |  -> Sensitivity
+------------------------------------------------+
```

The deeper page:

```
  ‹ Assumptions
+------------------------------------------------+
| Assumptions: the detail                        |
| Stocks 7% a year and prices 3% a year: ours.   |
+------------------------------------------------+
| The other 8 numbers                            |
| Bonds grow each year               [ 4   ] %   |
| Cash and savings earn each year    [ 2   ] %   |
| How much stocks swing              [ 15  ] %   |
| How much bonds swing               [ 5   ] %   |
| Pay raises each year               [ 3   ] %   |
| Retirement age                     [ 65  ]     |
| Plan the money to last to age      [ 95  ]     |
| Emergency fund, months of bills    [ 6   ]     |
| [ Save ]        ( Reset to defaults )          |
+------------------------------------------------+
| Where these numbers come from                  |
|   ten short paragraphs, one per number         |
| [ ] Keep this on the Assumptions page          |
+------------------------------------------------+
| Related pages                                  |
| What would a different number do?            › |
+------------------------------------------------+
```

- "The other 8 numbers" is a form on the deeper page with its own Save: bonds, cash, the two swings, pay raises,
  retirement age, the age the money must last to, months of cushion. "Reset to defaults" (outlined) sits under it.
  `shows` lists the eight keys, so a link such as `?show=emergencyMonths` lands in that box. Two forms, two Saves:
  neither writes a box the person did not see.
- The two tiles ("0 changed from defaults", "3.9% stocks after inflation") become the status lines of two rows.
- **For the owner (O2 in section 6):** "Save and mark as reviewed" on the short page marks all ten as looked over
  while eight were not on screen. This design keeps it (the eight are usual figures with a source each, one tap
  away, and the review exists so a person looks at the two that move the answer). The other choice: the short form
  says "Save", and the review is marked from the deeper form only.

### 5.4 Net worth (`balance/net-worth`; free; a list page)

**Today.** Four tiles; "Accounts" with ten stacked rows, each with Edit and Delete; "Over time" with a 26-word
paragraph, the filled "Save today's totals" and the history list.

```
+------------------------------------------------+
| [ $287,100   Net worth ]                       |  one tile (ui.stat)
| You own $572,700 and owe $285,600. Up $30,100  |  one sentence in place of three tiles
| since January 1.                               |
+------------------------------------------------+
| Accounts                                       |
| ( Update all balances at once )                |
| House                                $380,000  |
|   Real estate · as of 11/12/2026               |
|   Edit   Delete                                |  rows keep both (owner; constraints V4)
| ... five more rows, in today's order ...       |  rows are never reordered
| All 10 accounts ›                              |  only for a list of more than 8
| ( + Add another account )                      |
+------------------------------------------------+
| [ Save today's totals ]                        |  stays: the monthly check-in sends people here (S11)
|   last saved 1/1/2026: $257,000                |
+------------------------------------------------+
  More about what you own and owe               ›
  Over time and 6 more
```

The form, after "+ Add another account" or Edit, and the deeper page:

```
+------------------------------------------------+
| Account name        [ e.g. Chase checking  ]   |
| Type                [ Checking           v ]   |
| Current balance     [ $                    ]   |
| 3 more details            none filled in     › |  Institution, Balance as of, Whose account
| [ Save ]   ( Cancel )                          |
+------------------------------------------------+

  ‹ Net worth
+------------------------------------------------+
| Net worth: the detail                          |
| $287,100: you own $572,700, you owe $285,600.  |
+------------------------------------------------+
| All your accounts     (10 rows, Edit, Delete)  |
+------------------------------------------------+
| Over time                                      |
| 1/1/2026                            $257,000   |
|   You own $548,000 · you owe $291,000  Remove  |
| [ ] Keep this on the Net worth page            |
+------------------------------------------------+
| Cash or easy to sell                 $33,700   |
+------------------------------------------------+
| Invested for later                  $177,000   |
|   $128,000 pre-tax, $31,000 tax-free ...       |
+------------------------------------------------+
| Related pages                                  |
| Is my cushion big enough?                    › |
| One account in detail                        › |
| Where is it heading?                         › |
| The balance sheet                            › |
+------------------------------------------------+
```

- Own parts: "All your accounts" (the ten rows with Edit and Delete; "All 10 accounts ›" is its link and it has no
  second row on the door), "Over time" ("How has it changed?", status "1 saved total, since 1/1/2026": the history
  rows with Remove, and the chart from two points on), "Cash or easy to sell" ("How much could I get at quickly?",
  status "$33,700"), "Invested for later" (status "$177,000: $128,000 pre-tax, $31,000 tax-free").
- Related pages: "Is my cushion big enough?" (Emergency fund), "One account in detail" (Account detail), and
  claude-a's two, "Where is it heading?" (Net worth projection) and "The balance sheet" (a link is not an edit).
- The add and edit form: Account name, Type, Current balance, then "3 more details" (Institution, Balance as of,
  Whose account). With no accounts the form is open and there is no door (S12).
- A household with eight accounts or fewer sees all its rows: nothing is cut.

### 5.5 Expenses (`cashflow/expenses`; free; a path step)

**Today.** Two tiles and the sentence "Next year about $70,992 once prices rise."; the shut fold "Set your month in
one number"; the fold "See or change each bill", which is **open** for a household that typed most of its bills
(`billsFoldOpen` in the page's compute.js: shut only when there are many bills and most are our guesses) and then
shows two more tiles, 13 rows and "+ Add another expense".

```
+------------------------------------------------+
| [ $5,826  Per month ]   [ $3,884  Left over › ]|  two tiles; the second is a link, as today
|   $69,916 a year          each month, after    |
|                           tax, bills and saving|
| Next year about $70,992 once prices rise.      |  the owner's sentence (2026-09-16) stays
+------------------------------------------------+
| Set your month in one number                 › |  fold, shut, as today
|   leftover or spending                         |
+------------------------------------------------+
| See or change each bill                      › |  fold, shut on arrival (the one change, below)
|   13 bills, all yours                          |
+------------------------------------------------+
  More about your spending                      ›
  What could be cut and 6 more
```

The bill form inside the opened fold, and the deeper page:

```
+------------------------------------------------+
| What is it            [ e.g. Rent          ]   |
| Amount                [ $        ]             |
| How often             [ every month      v ]   |
| [x] I must pay this (not optional)             |
| 4 more details            none filled in     › |  Category, Goes up with prices, Starts, Ends
| [ Save ]   ( Cancel )                          |
+------------------------------------------------+

  ‹ Expenses
+------------------------------------------------+
| Expenses: the detail                           |
| $5,826 a month; $3,884 left over each month.   |
+------------------------------------------------+
| What could be cut                              |
|   $1,058 a month is nice to have: the rows     |
| [ ] Keep this on the Expenses page             |
+------------------------------------------------+
| Next year and one-time costs                   |
|   about $70,992 once prices rise ...           |
+------------------------------------------------+
| Related pages                                  |
| Where does the money really go?              › |
| Bills and regular payments                   › |
| Subscriptions                                › |
| Set a budget                                 › |
| Costs that come once a year                  › |
+------------------------------------------------+
```

- **The one change to an existing rule:** the bill fold is shut on arrival in every state, and its status line says
  what is inside ("13 bills, all yours", "13 bills, 4 are our guesses"). It opens as today for the path step that
  names it, for `?edit=` and `?add=`, and after a save inside it; with wave 1 it is open again when the person comes
  Back. `billsFoldOpen` is a builder's rule from part 3 of the path, not an entry of the design log; it is named
  here so the change is seen. The other choice keeps the fold as it is and cuts the list inside it (6 bills, then
  "All 13 ›"). Opened, the fold is as today: the two tiles "Bills you have to pay" and "Could be cut" (the owner's
  four tiles are kept), the rows, the add button.
- The add and edit form: What is it, Amount, How often, I must pay this; then "4 more details" (Category, Goes up
  with prices, Starts, Ends). "I must pay this" stays in the first four because the cushion and "Could be cut" are
  worked out from it.
- Own parts: "What could I cut?" (status "$1,058 a month is nice to have": the could-cut bills alone), "Next year
  and one-time costs" (the figures behind the sentence).
- Related pages: "Where does the money really go?" (Where the money goes, when bank files are in), "Bills and
  regular payments", "Subscriptions", "Set a budget", "Costs that come once a year" (Irregular expenses).

### 5.6 Retirement contributions (`retirement/contributions`; in flight)

**Today.** The headline "$18,870 a year into retirement accounts", two paragraphs (19 and 26 words), an outlined
link, the card "Does Bo's job add money when Bo saves for retirement?" (34 words, one filled and two outlined
answers, 21 more words), "Against the 2026 limits" (2 rows and 20 words) and the list with its add button. The
retirement request (L3, L6) is changing all four files: landings (`?add=`, `?match=`), the match check, "pay the
tax later or now" per row. Adopted after it lands.

```
+------------------------------------------------+
| $18,870 a year into retirement accounts        |  h1, as today
| That is 11% of your pay, your employers' money |  one sentence (the second paragraph)
| included. At this rate the money lasts to the  |
| end.  See if the money lasts ›                 |
+------------------------------------------------+
| Does Bo's job add money when Bo saves?         |  a question the answer needs: stays (S9)
| [ Yes, it matches ]  ( No match )  ( Old job ) |  the page's one filled button
| Not sure? ›                                    |  the 55 words of help, one tap, in place
+------------------------------------------------+
| Contributions                                  |
| Ana's 401(k)                   $15,270 a year  |
|   $470 every two weeks · employer adds $3,050  |
|   Edit ›                                       |
| (the second row)                $3,600 a year  |
| ( + Add another contribution )                 |
+------------------------------------------------+
  More about your retirement saving             ›
  Against the 2026 limits and 4 more
```

The deeper page:

```
  ‹ Retirement contributions
+------------------------------------------------+
| Retirement contributions: the detail           |
| $18,870 a year, 11% of your pay.               |
+------------------------------------------------+
| Against the 2026 limits                        |
| Ana: 401(k) / 403(b)       $12,220 of $24,500  |
|   $12,280 of room left                         |
| (the second row)                               |
| An employer's 401(k) match does not count ...  |
| [ ] Keep this on the Retirement contributions  |
|     page                                       |
+------------------------------------------------+
| Your money and your employers'                 |
|   $15,820 of your own money and $3,050 from    |
|   employers ...                                |
+------------------------------------------------+
| Related pages                                  |
| What does this do to my paycheck?            › |
| What does my job offer?                      › |
| HSA and FSA                                  › |
+------------------------------------------------+
```

- Own parts: "Against the 2026 limits" ("How much more could go in?", status "Ana has $12,280 of room in the
  401(k)"; it gets `alert` when a row is over a limit, and that case is also a notice on the short page, S10); "Your
  money and your employers'" (the first paragraph); and whatever L6 adds as a summary of tax now or later, with its
  boxes' keys in `shows`.
- Related pages: "What does this do to my paycheck?" (Paycheck), "What does my job offer?" (Work benefits), "HSA and
  FSA".
- The form has five boxes: no fold.
- **For the owner (O3):** a retired household has no contributions, rightly, and the rule "an empty list keeps its
  add form open" gives it an open five-box form. May a page whose list is empty for a good reason say so ("You are
  retired, so nothing needs to go in") with the form behind "+ Add a contribution"?

### 5.7 Settings (`system/settings`; free; the card is built)

**Today.** Plan basics (3 boxes and Save), Pages (18 topic folds of on and off rows), Your data, and three technical
folds (PC connection, AI assistant, Advanced): 2.3 screens, 22 folds, all shut. Settings is not a result page and
gets no door. The design adds one card and proposes nothing else:

```
+------------------------------------------------+
| Plan basics                                    |  first (owner)
|   Plan name [        ]  Currency [ USD ]       |
|   Number and date format [ English (US) ]      |
|   [ Save ]                                     |
+------------------------------------------------+
| Pages                                          |
|   Switch pages on or off for this device.      |
|   Overview                                   › |  18 topic folds, as today
|   ...                                          |
+------------------------------------------------+
| Going deeper                                   |  NEW, built (shots 14 and 15)
|   [ ] List the deeper pages now, before my     |  after the plan is finished this line reads:
|       plan is finished                         |  "Your plan is finished, so each result page
|   Kept on this device's pages: Federal         |  lists its deeper pages under "Go deeper"."
|   estimate (1).                                |
|   ( Put them all back )                        |  with nothing kept: "Nothing is kept on a page
+------------------------------------------------+  yet. On any deeper page, tick "Keep this on the
| Your data                                      |  page" under a part you want at hand."
+------------------------------------------------+
| PC connection          Not connected         › |  technical, last, folded (unchanged)
| AI assistant           Not answering         › |
| Advanced               Not needed day to day › |
+------------------------------------------------+
```

Measured: ticking writes `{"kept":{},"offer":true}` on the device, says "Pages on this device now list their deeper
pages under "Go deeper"." and a family that has not finished the path then sees the card on Federal estimate; "Put
them all back" removes the key and says "Put back. Your pages are short again on this device."; the plan is
untouched and nothing redraws but the card.

**For the owner (O4):** the "Pages" card is the longest thing on Settings. It could be one row, "Pages: N of M on ›", with the 18 topics on a deeper page. The default is to leave it: its folds are shut and have status lines.

### 5.8 Rent vs buy (`property/rent-vs-buy`; free; the long form)

**Today.** A 46-word hero, "After 10 years" with two tiles and two paragraphs (23 and 41 words), "Year by year",
"The first year, a month", and the fold "The figures", **open**, with a form of 18 boxes and "Compare" at its end,
then "More on this" with two links. Seventeen boxes are on the first view; the answer is above a form the person
has not yet filled.

```
+------------------------------------------------+
| Buying comes out $6,970 ahead after 10 years   |  h1: the answer
| It pulls ahead after 9 years; if you leave     |
| sooner, renting wins. These are example        |
| figures until you type yours.                  |
+------------------------------------------------+
| Home price                  [ $400,000 ]       |
| Down payment  ( 5% ) ( 10% ) ( 20% )  [ 20 ] % |  chips, then the exact box
| Mortgage rate a year        [ 6.5 ] %          |
| Rent for a similar home, a month  [ $2,200 ]   |
| Years you would stay  ( 5 ) ( 10 ) ( 15 ) [ 10 ]|
| [ Compare ]                                    |  Save in sight: the form is under 520 px
+------------------------------------------------+
| Go deeper                                      |  (first stage: "More about renting or buying ›
| What owning costs each year                  › |   What owning costs each year and 6 more")
|   7 usual figures             (or "2 yours")   |
| What we assumed about the years ahead        › |
|   6 usual figures                              |
| What rent would make it even?                › |
|   about $2,160 a month                         |
| Year by year                                 › |
|   buying is ahead from year 9                  |
| All 7 ›                                        |
+------------------------------------------------+
```

The deeper page:

```
  ‹ Rent vs buy
+------------------------------------------------+
| Rent vs buy: the detail                        |
| Buying comes out $6,970 ahead after 10 years.  |
+------------------------------------------------+
| What owning costs each year                    |  7 boxes, each with our usual figure in it
| Mortgage length (years)             [ 30  ]    |
| Property tax a year, share of value [ 1.1 ] %  |
| Home insurance, upkeep, HOA a month,           |
| closing costs to buy, costs to sell            |
| [ Save ]                                       |
+------------------------------------------------+
| What we assumed about the years ahead          |  6 boxes
| Home value growth, rent growth, renters        |
| insurance, return on invested money,           |
| [ ] We itemize deductions, our top tax rate    |
| [ Save ]                                       |
+------------------------------------------------+
| What rent would make it even?                  |
|   about $2,160 a month: your rent is higher,   |
|   so buying wins sooner ...                    |
+------------------------------------------------+
| Year by year                    (the table)    |
+------------------------------------------------+
| The first year, a month                        |
+------------------------------------------------+
| Related pages                                  |
| Saving for a home                            › |
| Mortgage                                     › |
+------------------------------------------------+
```

- The 13 assumptions are two forms on the deeper page, each with its own Save and at most eight boxes: what owning
  costs (mortgage length, property tax, insurance, upkeep, HOA, costs to buy, costs to sell) and the years ahead
  (home value growth, rent growth, renters insurance, return on invested money, we itemize, our top tax rate). Every
  one has a default, so none is needed for a first answer (S17). Each row's status counts the ones the person
  changed, and the short page's sentence says "example figures" until the five on it are typed.
- This is the pattern for the other what-if pages with long forms (the node count of section 4 finds 26 pages with more than
  five boxes on the short page): five boxes and the answer on the short page, the assumptions as their own form one level
  down.

### 5.9 A list page that is itself a deeper page: Year by year (`retirement/cash-flow`)

913 words and 212 figures: the heaviest page in the count, and rightly, because it is the table. It is not a front
page. It gets no short version: it shows 12 rows and "Show all 31" (rule S8), and it is reached from "The money,
year by year ›" on Will the money last?. Pages of this kind (year tables, the ledger, comparisons) are where the
detail lives; the design's job is that nobody lands on one before the answer.

### 5.10 What building one taught me

1. **The numbers hold, and the helper is small.** Federal estimate went from 3.27 screens to 1.0 for the family
   (2.43 to 1.0 for the renter, 3.15 to 1.0 for the retired couple and the freelancer, 1.34 to 1.0 empty); the
   census's first-screen load fell from 61 to 23. The whole prototype is +475 and -46 lines in seven files; the
   view's own change is mostly moving cards into functions.
2. **The sentence is the work.** My first short page spliced clauses out of the old 60-word paragraph and told a
   retired household with no tax: "About right ... within a few hundred dollars of the $0 of federal tax". A
   screenshot caught it; no test did. Rule S3 (one written sentence per case, one test per case) comes from that.
   Every adopted page costs this writing; it is the main cost of the design.
3. **Tests that read "the page" must say which level.** Moving text one level down failed seven tests (six in the
   page's own file, one in `tests/wording-verify.test.mjs`); each was fixed by reading the level by name. Ten more
   failed until the helper stopped using `replaceChildren`, which the text-only stand-in in module tests lacks. A
   shared helper has to run under that stand-in, so it uses `append` and `remove` only.
4. **The stage could not be "the path is complete".** None of the eight invented households has a complete path,
   because look-only steps need Next tapped. The stage reads the path's finish mark, the checks need fixtures that
   walk the path, and a real household that skips the path stays in the first stage for good (section 7, risk 1).
5. **A landing must happen once.** The first build scrolled to the part again after "Save deductions"; the scroll
   is now tied to the arrival. The first build also added a scroll margin to the offset the shell already sets and
   landed 140 px low.
6. **The row is what keeps a step page near one screen.** With the row the family's short page fits one screen
   (845 px or less); with the card of four questions it is 1,065 px (1.26 screens), about 220 px more. As a path
   step, with the step bar above and Next below, the first-stage page is 970 px. That is the practical case for the
   stage: one row while there is a Next to reach, the card of questions once there is not. It is not what makes
   the page short; the two levels do that.
7. **The deeper page is long:** 5.7 screens at 390 px and 8.5 at 320. Landing on a part makes that bearable; the
   top of the page is a list of headings only by scrolling. A contents row at the top was not built and may be
   needed (risk 3).
8. **Back lands at the top of the short page today** (measured). Wave 1's place memory is what makes "go deeper,
   come back" feel like one place; without it this design is weaker than a fold on that one point.
9. **Keeping works without touching the plan or redrawing the page.** The device's memory after one tick is
   `{"kept":{"taxes/federal":["how"]},"offer":false}`; the plan was byte-identical after keeping and after putting
   back. A first try at the Settings card redrew itself with an empty `store.update`, which the constraints forbid;
   it now replaces its own nodes.
10. **Three things the prototype leaves open:** the empty page still shows the row; the "no tax" case still shows a
    button; the helper lists own parts before related pages. All three are small and named in C1 and C3 below.
11. **Not tested:** a real iPhone, VoiceOver, Safari's print and find-in-page, a heavy part, and any person.

---------------------------------------------------------------------------------------------------------------------

## 6. The build plan

### 6.1 Where the 110 over-budget pages are (node count at the tip, worst household)

| lane | over the budget | what happens |
|---|---|---|
| free for claude-b now | 84 | adopted in the order below |
| in flight (the retirement request) | 6: `retirement/projection`, `retirement/contributions`, `system/assumptions`, `scenarios/goal-seek`, `scenarios/sensitivity`, `career/benefits` | adopted after each lands; checked, not redone |
| claimed by claude-f | 10: `overview/dashboard`, `plan`, `start`, `guide`, `alerts`, `next-best-action`, `health-score`, `monthly-review`, `taxes/withholding`, `estate/documents` | after the rows go |
| claude-a's | 10: `goals/emergency-fund`, `goals/travel`, `goals/charitable`, `debt/consolidation`, `taxes/state`, `taxes/self-employment`, `taxes/documents`, `balance/projection`, `balance/statement`, `cashflow/statement` | hand-over (6.5); listed apart in the test, never failed |

### 6.2 Commits, in order. Every commit passes `npm test`, `npm run check`, the leak guard and the main gate alone.

| # | commit | files | what a person gets | waits for |
|---|---|---|---|---|
| **C1** | The two levels: helper and stage | new `core/depth.js`, `core/ui/deeper.js`, `tests/depth.test.mjs`; `docs/CONVENTIONS.md` (the part contract, section 2.3), `docs/DATA_MODEL.md` ("Not in the plan": `planner.depth`), `docs/DESIGN_LOG.md` (a builder's entry, marked as such, with O1 open), `CHANGELOG.md` | nothing yet (no view imports it; the gate sees two new files) | nothing. Three changes against the prototype: one order of rows, the view's; no door on an empty page; an option for the deeper page's heading; a test for each |
| **C2** | The ratchet | new `tests/short-page.test.mjs`, `qa/fixtures/finished-plans.mjs` (households with the path walked) | nothing on screen; from here every commit shows its page's counts fall | C1 |
| **C3** | Federal estimate, short and deeper | `modules/taxes/federal/{view.js,README.md,module.test.mjs}`, `tests/wording-verify.test.mjs` (one test reads the deeper page) | the measured result of 5.1 | C1. The patch is `$SP/opt/stages-work/proto-stages.patch`; add a test per case, drop the door when empty, drop the button when there is no tax |
| **C4** | Settings: "Going deeper" | `modules/system/settings/{view.js,README.md,module.test.mjs}` | the tick and "Put them all back" | C1 (in the same patch) |
| **C5** | The browser walk | new `qa/flows/deeper.js`; `qa/smoke-all.mjs` sweeps each adopted page's deeper address | nothing on screen | C3 |
| **C6 to C15** | The path's free pages, one page a commit, in path order | `cashflow/expenses`, `debt/payoff`, `balance/liquidity`, `insurance/life-needs`, `retirement/withdrawal-strategy`, `retirement/rmd` (already within budget: parts only), `goals/house`, `goals/education`, `balance/net-worth`, `goals/goals` | each step of the big picture is its answer, one action and Next | C2. Today: 291, 253, 315, 514, 309, 112, 305, 191, 196 and 171 words on the short page |
| **C16** | `shortForm` | `core/ui/deeper.js` (the third export), `tests/depth.test.mjs`; then one commit per topic folder for the 24 free pages with more than five boxes showing | add and edit forms open with at most five boxes and "N more details" | C1. The 24: `balance/assets`, `balance/net-worth`, `balance/update`, `career/business`, `career/equity`, `career/offer-compare`, `career/side-income`, `cashflow/expenses`, `cashflow/income`, `estate/gifting`, `goals/house`, `household/people`, `insurance/policies`, `investments/holdings`, `property/home`, `property/purchase`, `property/rent-vs-buy`, `property/rental`, `retirement/annuities`, `retirement/pensions`, `scenarios/advisor-plan`, `taxes/capital-gains`, `taxes/estimated`, `taxes/hsa-fsa`. `goals/goals` gives up its own copy of the recipe. `balance/update` is the exception: its boxes are one per account, which is the page's job, so it keeps a KNOWN entry with the reason written beside it |
| **C17** | What-if pages with long forms, as 5.8 | `property/rent-vs-buy` first, then `property/rental` (21 boxes), `career/offer-compare` (18), `scenarios/advisor-plan` (16), `property/purchase` | five boxes and the answer; the assumptions one level down with their own Save | C16 |
| **C18** | The other topic fronts (6.3) and the heaviest free result pages | `cashflow/income`, `investments/holdings`, `property/home`, `household/people`, `estate/beneficiaries`, `retirement/social-security`; then by words: `overview/timeline` (982), `scenarios/stress-tests` (919), `reports/plan-summary` (737), `retirement/medicare` (625), `career/business` (555) | | C2 |
| **later** | List pages that are deeper pages: "Show all N" past 12 rows | `retirement/cash-flow`, `taxes/projection`, the ledger | | C1 |

Each page commit carries: the parts, the one sentence per case with its tests, the README's new section "Short page
and deeper page" (what is on which level and why), both levels read on a screenshot at 390 px (rule 13), the
page's KNOWN entry lowered or removed, one CHANGELOG line.

**What waits, and for what.**
- **For the retirement request to land:** `retirement/projection` (its hand-written "Go deeper" card becomes
  `dp.door()`; the tiles, the chart and "What goes into this" become parts), `system/assumptions` (5.3),
  `retirement/contributions` (5.6), `scenarios/goal-seek`, `scenarios/sensitivity`, `career/benefits`,
  `transactions/import`. Check their fold words against section 3; change nothing they decided.
- **For wave 1 to land:** `data-back` becomes live (no change here); verify the two seams of 2.4; `ui.form`'s
  `more` option, then `shortForm` shrinks to a wrapper; optionally `export * from "./deeper.js"` in `core/ui/dom.js`;
  `overview/pages`.
- **For claude-f's rows to go:** the Dashboard, Your plan, the check-in and the other eight pages of its claim; and
  the words of the path's steps in `journeys.js` where a step's `ask` should name the row ("under More about ...").
  No step needs a change for C3 to C15: every fold a step opens stays on the short page (S11, tested).

### 6.3 The map: which page is a topic's front, and what sits behind its door

A proposal for C18 and for the reachability count of 4.2; "(a)" is claude-a's page and "(f)" is under claude-f's
claim: both can be linked to, neither edited.

| topic | front page (short page and deeper page) | pages behind its door |
|---|---|---|
| spending | `cashflow/expenses` | spending, recurring, subscriptions, budget, budget-percent, sinking-funds, forecast, income-statement, statement (a) |
| income | `cashflow/income` | paycheck, `career/salary`, `career/side-income`, `career/benefits` |
| what you own and owe | `balance/net-worth` | accounts, assets, liabilities, update, projection (a), statement (a) |
| the cushion | `balance/liquidity` | `goals/emergency-fund` (a) |
| debts | `debt/payoff` | credit-cards, mortgage, refinance, ratios, student-loans (a), consolidation (a) |
| retirement | `retirement/projection` | monte-carlo, historical, cash-flow, `scenarios/sensitivity`, `scenarios/compare`, `scenarios/goal-seek`, `scenarios/stress-tests`, sequence-risk, longevity, fire |
| saving for it | `retirement/contributions` | `investments/limits`, `cashflow/paycheck`, `career/benefits`, `taxes/hsa-fsa` |
| taking money out | `retirement/withdrawal-strategy` | withdrawal-order, rmd, roth-conversions, buckets, annuities |
| income in retirement | `retirement/social-security` | pensions, medicare, healthcare |
| tax | `taxes/federal` | brackets, projection, capital-gains, estimated, withholding (f), hsa-fsa, state (a), self-employment (a), filing-status (a), documents (a), `reports/tax` |
| goals | `goals/goals` | house, education, prioritizer, vehicle (a), travel (a), charitable (a) |
| home | `property/home` | rent-vs-buy, renovation, rental, purchase, vehicles, `debt/mortgage` |
| investments | `investments/holdings` | allocation, rebalance, fees, performance, risk, glide-path, asset-location, tax-lots, dividends, backtest, employer-stock, crypto |
| protection | `insurance/life-needs` | policies, disability, health, ltc, property, term-vs-permanent, cash-value |
| family and papers | `household/people` | life-events, calendar, contacts, documents |
| what you leave | `estate/beneficiaries` | documents (f), estate-tax, gifting, inheritance, legacy, digital |
| bank files | `transactions/import` | ledger, categorize, categories, rules, duplicates, transfers, reconcile, statements |
| work | `career/salary` | offer-compare, equity, business, human-capital |
| the whole plan | `overview/plan` (f) | `reports/plan-summary`, annual-review, statements, retirement, export, `scenarios/advisor-plan` |

The menu and search are unchanged: every page keeps its own address and its place in All pages. The map adds a way
in from the answer; it removes none.

### 6.4 Docs that change with C1

`docs/CONVENTIONS.md`: "A page with more than its answer declares its parts with `deeper()`; the short page meets
the budget of its kind". `docs/DATA_MODEL.md`: `planner.depth` under "Not in the plan". `docs/DESIGN_LOG.md`: one
entry, written as a builder's choice until the owner has answered O1 to O4. `AGENTS.md`'s design rule ("Simple
first, detail on request") gets one clause, "for a result page: a short page and a deeper page (`core/ui/deeper.js`)",
through the designer's lane. `docs/TEAM.md` and `docs/WORKBOARD.md`: a claim row per page as usual.

### 6.5 The hand-over for claude-a's 13 pages

One file, `docs/handoffs/<date>-short-pages-claude-a.md`, in the format that exists there ("To see it", "Seen",
"Wanted"), and one workboard line `claude-b -> claude-a`. Per page: today's counts from `tests/short-page.test.mjs`,
the short page proposed (headline, sentence, action), the parts with their questions, and the three lines of code to
adopt. The ten over the budget, with words and figures on the short page today: `balance/statement` (412, 54),
`taxes/documents` (303, 2), `goals/charitable` (270, 18), `balance/projection` (255, 37), `cashflow/statement` (223,
20), `goals/emergency-fund` (210, 7), `taxes/self-employment` (206, 18), `debt/consolidation` (172, 26),
`taxes/state` (143, 9), `goals/travel` (73 words, 9 boxes). Within budget: `debt/student-loans`,
`taxes/filing-status`; `goals/vehicle` drew nothing in Node for the test households and needs a look by its owner.
What reaches these pages with no edit: other pages' doors link to them (6.3), and the test reports them.
claude-a's last workboard message is from 2026-10-30 and five hand-overs wait unanswered, so the plan does not
count on these ten.

### 6.6 Questions for the owner (the build does not wait for them; each has a default)

| # | question | default taken |
|---|---|---|
| O1 | The card's heading: "Go deeper" or "More on this"? | "Go deeper" on adopted pages; the others keep "More on this" |
| O2 | Assumptions: may "Save and mark as reviewed" sit on the short form with two of the ten numbers? | yes |
| O3 | May a list that is empty for a good reason (a retired household's contributions) fold its add form? | no: the rule of 2026-09 stands until the owner says so |
| O4 | Settings: "Pages" as one row with the 18 topics a level down? | no, leave |
| O5 | Should the stage exist at all, or should every short page show the card from the first day? | the stage exists, with the Settings tick; section 7 risk 1 is the case against |
| O6 | Expenses: the bill list shut on arrival for every household (5.5)? | yes |

---------------------------------------------------------------------------------------------------------------------

## 7. The risks, and what would make me drop this design

| # | risk | how likely, from what was seen | what holds it | what it costs if it happens |
|---|---|---|---|---|
| 1 | **The stage is never reached.** A household that skips the path, or stops at step 6, sees one row for good. | High. None of the eight invented households has a finished path; look-only steps need Next tapped. | Everything is one tap behind the row in both stages (S6); the Settings tick; the deeper page says what finishing changes. | The "journey" half of the design does nothing for those people. They still get short pages. |
| 2 | **Leaving the answer to see its working.** A person who wants the four numbers beside the headline now changes screens. | Certain; it is the design. | The row's grey line carries the figure most asked for; "Keep this" puts a part back for good on that device; Back returns to the place (with wave 1). | One tap and one Back per look, until kept. |
| 3 | **The deeper page is long** (5.7 screens for Federal estimate, 8.5 at 320 px). | Certain for big pages. | Rows land on their part; the card is the contents list. A part over two screens becomes its own page (budget table). | If people arrive at the top and scroll, add a contents row under the heading (not built). |
| 4 | **Find-in-page sees one level.** | Certain. | Row labels and grey lines carry the nouns ("itemizing", "standard"); the app's own search finds pages, not text, as today. | A person searching the short page for a figure that is one level down does not find it. A fold has the same gap on the owner's iPhone, where Safari opens the fold and does not scroll to the match. |
| 5 | **Back lands at the top until wave 1 is in.** | Measured. | Wave 1's place memory; `data-back` is already on the link. | Until then, coming back loses the place: do not ship C6 on before wave 1 if this is felt on the phone. |
| 6 | **The writing.** Each page needs a headline and a sentence per case, and a row question and a status per part. | Certain; my first try at one page produced a false sentence. | S3's tests; a screenshot of every case (rule 13); the plain-words tests that exist. | Slower than folding: about a page a commit. For the 84 free pages this is weeks, not days. |
| 7 | **Test churn.** Text that moves a level breaks tests that read "the page". | Seen: 7 of about 190,000. | Tests name the level; `pageText` helpers render both. | Small, per page. |
| 8 | **Kept parts vanish.** Safari erases a site's storage after seven days without a visit in a tab. | Possible on the owner's phone when used in Safari and not from the home screen. | The page falls back to short, never to broken; nothing in the plan depends on it. | A person ticks again. If this annoys, the kept list moves into the plan (a schema change, a version bump, synced across devices): a later decision. |
| 9 | **Two cards of links during the changeover.** Pages not yet adopted keep "More on this"; adopted ones say "Go deeper". | Certain for some weeks. | O1 decides one heading; the helper absorbs the old card page by page. | Inconsistent headings for a while. |
| 10 | **Wave 1's seams.** `sameEntry` accepts a deeper entry for a link to the short page; typing memory is per page. | Read in the code, not exercised. | Two checks listed in 2.4, run when wave 1 lands. | A wrong Back in a rare order of taps; or unsaved typing on the deeper page dropped. |
| 11 | **A second kind of place.** People must learn that a page has a page behind it. | Unknown: no person has used it. | One pattern everywhere: the same row, the same heading, the same way back. | If people do not find the row, the detail is as good as gone. This is the risk only a person on a phone can settle. |
| 12 | **The stage reads as the app changing by itself.** | Low: it happens once, after the person's own tap on the last Next. | Your plan's page can say it in one line when the path is finished ("Each page now lists its deeper pages"); that line is claude-f's file. | Mild surprise. |

**What would make me drop it, or change it.**
- **Drop the stage, keep the levels** (the likely change): if the owner answers O5 with "show the questions from the
  first day", or if a first-stage household is seen not to open the row. `stageOf` then returns "deeper" always and
  the Settings tick goes; nothing else changes. The prototype's own measure argues for the stage only on step pages
  (220 px).
- **Drop the levels, keep the list of parts:** if on the owner's phone the change of screen feels like losing the
  answer (the owner asks "where did my number go", or keeps most parts on most pages), or if wave 1's place memory
  does not land. The helper then draws the same `parts` in place as native folds with their status lines, under the
  same door heading. The views do not change; the budget test, the vocabulary and the "N yours" lines stay. That is
  the fold design with this design's discipline, and it is one file's change.
- **Drop the helper:** if two pages in a row turn out to have nothing that can leave the short page (their detail is
  the answer, as on Year by year). Then the budget of the kind was wrong, and the test's KNOWN entry stays with a
  written reason.
- **Do not start** if the owner reads 5.1's three frames and prefers the old page with its three folds shut. The
  census already says that page was the heaviest step of the path; but the owner's eye on a phone outranks a count.

---------------------------------------------------------------------------------------------------------------------

## 8. The skeptics' corrections this design follows, what is not verified, and the files

**From `verify-code.md`:**
- W2: there are no links worded "go deeper" at the tip, but 44 views end in a card of links (37 "More on this", 7
  "Next"). The door absorbs that card; it does not add a second one (section 3, O1).
- W12: first-screen words for Federal estimate are 154, not 115. All of this file's "today" numbers are the
  census's rerun or my own counter, never the walks' table.
- W13: the three proposals that undo an owner's choice are not taken: Net worth rows keep Edit and Delete (5.4),
  Plan basics stays first in Settings (5.7), the review notice on Assumptions stays a notice (5.3).
- W1, W3 to W11: not relied on; where a count is used (53 views import `core/words.js`) it is the corrected one.

**From `verify-web.md`:**
- 1.1: Safari's find-in-page support for closed folds is partial (it opens the fold and does not scroll to the
  match; WebKit bug 304174). Used as an argument for the deeper page, and admitted as a cost for the short page
  (2.7, risk 4).
- 1.2: "More options" is a label its own source says to avoid. No row or fold says it; labels name their contents
  ("More about this year's tax", "4 more details").
- 1.3: Baymard recommends marking both required and optional boxes. The form rule marks the split on both sides
  (section 3).
- 1.5: the Word field study supports an interface the person fills themselves, not "a quiet switch to everything".
  "Keep this" is that, and it is one tick where the person already is.
- Section 2, item 1: six is the tested floor for cut lists. Lists of eight or fewer are never cut; longer ones show
  six.
- Section 4: the missing marker on `summary` and screen readers. The design depends on headings and links, not on
  how a `summary` announces itself.

**Not verified by me** (treat as open): any real iPhone, VoiceOver, Safari's printing and find-in-page; a heavy
part's lazy path; wave 1's two seams; whether a person finds the row. The six redrawn pages other than Federal
estimate are drawings: their counts are targets, not measurements.

**Files** (all under `$SP/opt/` =
`$SP/opt/`):

| what | where |
|---|---|
| this report | `design-stages.md` |
| the prototype (worktree at 737fb6a, left in place, not committed: 4 files changed, 3 new) | `proto-stages/` |
| the prototype as one patch (+475, -46, 7 files) | `stages-work/proto-stages.patch` |
| the helper and the stage | `proto-stages/core/ui/deeper.js`, `proto-stages/core/depth.js`, `proto-stages/tests/depth.test.mjs` |
| the adopted page and the Settings card | `proto-stages/modules/taxes/federal/view.js`, `proto-stages/modules/system/settings/view.js` |
| screenshots (26 files: both stages, the deeper page, keep and put back, the landing, the print, five households, 320 px, Settings) | `proto-stages-shots/` |
| the node counter and its two runs (tip and prototype) | `stages-work/short-page.mjs`, `stages-work/sp-tip.json`, `stages-work/sp-proto.json` |
| households with the path walked; the page-text and outline scripts | `stages-work/lib.mjs`, `stages-work/text.mjs`, `stages-work/outline.mjs` |
| the browser walks and their logs | `stages-work/shots1.mjs` to `shots4.mjs`, `shots1.log` to `shots3.log` |
| the census of the prototype | `stages-work/census-proto.json` |

Checks run in the prototype worktree: `tests/depth.test.mjs` 6 of 6; the Federal module's tests 61 of 61;
`tests/wording-verify.test.mjs` 9 of 9; the whole `npm test` twice: the first run had one failure (the wording test
that read text now on the deeper page), the last run, on the worktree as it is left, has none (189,413 tests: 188,773
pass, 637 to-do, 3 skipped, 0 fail; log `stages-work/npm-test2.log`); `npm run check` OK; the leak guard OK. The
server on port 9851 is stopped and the port is free. `$REPO` and `$SP/opt/app` were not
edited.
