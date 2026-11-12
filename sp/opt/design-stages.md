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
  tax"; section 5.9.) [module test]
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
  `ul.page-list`. Rows in the order the view gave them: its own parts, then the related pages. With more than five
  in all, four are shown and a last row "All N ›" goes to the top of the deeper page; parts with `alert` or `yours`
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
| the deeper page's heading | **"<Page>: the detail"** | |
| the link back | **"‹ <Page>"** | |
| the card of `to` rows on the deeper page | **"Related pages"** | |
| the tick | **"Keep this on the <Page> page"** | |
| after ticking | **"Kept. "<Part>" now shows on the <Page> page on this device."** | |
| after unticking | **"Put back. "<Part>" is under Go deeper again."** | |
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
- Six pages cannot be drawn in Node for some household today (`goals/goals`, `household/calendar`,
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
| `property/rent-vs-buy` | 345, 20, 17, 2, 1 | 120, 4, 4, 0, 1 |
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
