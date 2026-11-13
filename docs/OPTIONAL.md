# Optional parts: simple first, more on request

The rule book for whoever builds or changes a page. The owner, 2026-11-12: "Default to less is more and allow more
complexity or toggles. We want subtle optional complexity". 2026-11-13: "it should stay simple by default. There should
be ways for you to upgrade the complexity and the depth of it, and it should also flow fluid and easy to understand for
a human user." The design log entry of 2026-11-12 is the rule; this file is how it is built.

**In one paragraph.** Every page opens with its answer and one action. Everything else (more figures, how the answer is
worked out, the person's own boxes) sits in quiet rows right under the answer, each a *part* that opens where it is
with one tap and shuts the same way. A reading part stays the way the person left it on this phone. Settings will hold
one card, "How much to show", with two switches, both off: "Show how answers are worked out" and "Show every box in
forms". Deeper pages are rows of "More on this" at the foot, each row the question it answers.

The helper is `core/ui/more.js` (imports nothing; safe in Node). Its tests are `tests/more.test.mjs`; how its memory
meets wave 1's record of each screen is tested in `tests/place.test.mjs` (the cases named "agree:").

## The checks named below

| letter | check | where | today |
|---|---|---|---|
| **H** | the helper's own tests | `tests/more.test.mjs` | built |
| **P** | the helper and wave 1's place memory agree | `tests/place.test.mjs` ("agree:") | built |
| **M** | the page's own tests | `modules/<group>/<id>/module.test.mjs` | each page, as it adopts the helper |
| **N** | every rendered view counted in Node, counts that may only go down | `tests/first-view/` (in `npm test`), `node qa/first-view-node.mjs` | built (section 13) |
| **B** | the first screen in a browser, 390 x 844 and 320 x 568, sandbox, touch | `node qa/first-view.mjs` | built, outside `npm test` (section 13) |
| **S** | the 390 px screenshot, read before a page is called done (AGENTS.md rule 13), light and dark, and at 320 px; once more with `--more` | `node tools/shot.mjs <group>/<id>` | every page |

## 1. Words used

- **First view**: the page as it opens for someone who has opened nothing: everything outside a shut part, in the phone
  markup (`.only-wide` skipped), with nothing kept on the phone.
- **First screen**: what of it lies above 844 px at 390 px wide (above 568 px at 320).
- **Part**: an optional piece of a page drawn by `part()`: a native `<details>` with a fixed title, a short status and
  a body that opens in place. Kinds: `more`, `how`, `own`, `figures`, `item`, `tech`, `links`.
- **Reading part**: kind `more` or `how`: figures and words, no box.
- **Kind of page**: **answer** (a verdict worked out from the plan), **list** (things the person keeps), **form** (a
  page whose job is to ask; every add or edit form once opened), **settings** (Settings, Help, Get started, Our guesses,
  Step by step, Quick answers), **report** (made to be read whole or printed: the reports, the long year tables, All
  pages, Glossary, Docs, Diagnostics). Each usable page's kind lives in the check's own list, not in the manifest.

## 2. First-view budgets

**R1. Every page's first view stays inside its kind's budget**, counted on the unopened page for the worst of the three
invented households with a plan (`family`, `renterDebt`, `retiredCouple`), and separately on the empty plan. **N**

| kind | words | money and % figures | boxes | tiles | filled buttons | parts (rows) | first screen at 390 x 844 (**B**) |
|---|---|---|---|---|---|---|---|
| answer | 160 | 8 | 1 (the one box that changes the answer; usually 0) | 4 | 1 | 5 | at most 110 words and 8 figures; the headline and the filled button wholly above 844 px |
| list | 240 | 16 | 0 while the list has rows; 5 while it is empty (its add form, owner 2026-09-15) | 4 | 1 | 5 | the headline figure and the first rows |
| form | 200 | 4 | 5, every required box among them | 0 | 1 | 1 "More details (optional)" per form | Save wholly above 844 px with the keyboard shut |
| settings | 200 | 2 | 3 | 0 | 1 | one per card; technical last | the first card whole |
| report | no limit | no limit | 2 | 4 | 1 | 5 | structure checks only |
| any kind, on the empty plan | 100 | 1 | 5 | 0 | 1 | - | one sentence on what to do first and one filled way to start |

Four tiles and "one sentence" are the owner's (log 2026-09-16); 160 words and 8 figures is the Dashboard's first view;
five boxes fit one phone screen with Save in sight. The rest are the builder's sizes, in one table; tightening one is a
one-line change.

**R2. A page over its budget today has its counts written down** (rounded up to the next ten words), and a count may
only go down. A redraw lowers the entry in the same commit. **N**

## 3. Answer pages

**R3. The headline says what happens to the person**, as a sentence in the hero's `h1` or one `ui.stat` with its
words: "You would owe about $5,253 in April", not "About $14,723 of federal tax for 2026" and not a bare "$8,450". When
there is an alarm, the alarm is the headline ("$1,241 of tax is overdue now"). A zero is said in words ("No federal tax
to pay for 2026"; owner, 2026-09-15). **M** per case; **S**

**R4. An answer page reads in this order**, top to bottom: (1) the headline; (2) at most two sentences, at most three
figures; (3) the one filled button; (4) alarms, guess marks, a hint worth money; (5) at most four tiles or six rows a
person would act on; (6) the parts card; (7) the "More on this" card; (8) the shell's way on. **N** for 6 to 8; **S**

**R5. One written sentence per case.** The sentence under the headline is written out for every verdict the page can
reach (owe, about right, back, nothing, not known yet, alarm), never assembled from clauses, and each case has a module
test that reads it. **M**

**R6. On a step of the path, the way on is near the top.** While the step bar shows (`?guide=plan`), "More on this" is
one shut row (`links()` does it) and the shell's Next lies within 2 screens (1,688 px at 390) of the top. **B**; **N**;
**H** (`links()` on a step)

**R7. After a save, the green line names the new answer** whenever the headline changed: "Saved. You would now owe
about $1,730 in April." **M** for each answer page that has a form.

**R8. A what-if page asks first, then answers.** With nothing entered it shows its five boxes and "More details
(optional)"; once it has an answer, its inputs fold into "The figures" with their headline values as the status
("$400,000, $2,200 rent"), and the answer is the first view. **M**

## 4. Never folded

**R9. None of these is ever inside a shut part.** A redraw that folds one is wrong, however calm it looks.

| # | never folded | check |
|---|---|---|
| 1 | the answer, and the pair that gives it meaning (what you plan to spend beside what the money can pay for; the debt-free month with its monthly amount; what happens in April) | **S** |
| 2 | the one filled action, and the action a link or a guide step promised; a part may hold a promised action only if every address that lands on it opens that part | **N**, **M** |
| 3 | every alarm: red and amber notices, overdue amounts, deadlines, "does not add up" | **N** |
| 4 | every error: a `.notice.error`; a box held back at Save opens the part that holds it and takes the focus | **N**, **H** |
| 5 | every reason to doubt a figure: "our guess", "partly our guesses", "not counted yet", the shell's gray guesses row | **N**, **S** |
| 6 | a hint worth money: a notice or line naming money the person could claim or keep by doing something (a credit, an employer match not taken, a cheaper way to pay), with its link; a line that is not a notice carries `data-worth` | **N** |
| 7 | a guide step's box: on arrival by that step its part is open, the box is the first box in it, and its Save is within 700 px below it | **N**, **B** |
| 8 | every confirmation after a save, add or remove (owner, 2026-09-15) | **M** |
| 9 | a required box; a box that shows our gray guess (a guess is written only from a box the person saw, `docs/CONVENTIONS.md` "Guesses") | **N** |
| 10 | what the owner already chose to keep in sight: Edit and Delete on Net worth rows; a zero said in words; Your plan's gaps; the Dashboard's rows; the Assumptions review notice; Settings' order; the first person's Social Security fold open; Forecast's first month open | **S**, **M** |
| 11 | builder details: not folded, not on screen at all (owner, 2026-09-15) | `tests/user-view.test.mjs` |

## 5. Parts

**R10. One helper, one markup.** Every new or touched optional piece is drawn by `part()`, `parts()`, `rest()` or
`links()`; a touched view writes no `<details>` by hand. Wave 1's form fold (`details.form-more`, "More details
(optional)") is the one other kind allowed. **N**; **H** (the markup)

**R11. Parts never nest.** A part holds no part. Two exceptions: a form inside a part may hold its one "More details
(optional)"; a part may hold a list whose rows open (Settings' page topics, the glossary). A third level is a page,
reached from "More on this". **N**

**R12. At most five parts on a page, as rows of one card** after the answer, in the order `more`, then `own` and
`figures`, then `how` (`parts()` sorts them and refuses a sixth in a test). One or two parts may sit in the card they
belong to (`card: true`). No folded card stands in a column of folded cards. **N**; **H**

**R13. The box a guide step or a landing asks for is the first box of its part**, and the part's Save is on the same
screen. **N**, **B**

**R14. A part is worth a tap**: it holds at least two figures, three rows or forty words. Less than that is shown. **N**

**R15. An open part is at most a screen and a half** (1,300 px at 390). Longer belongs on a deeper page, linked. One
exception: a part that is the page's own list ("See or change each bill"). **B**

**R16. Opening or shutting changes nothing in the plan**, asks for no save, loses no typing, and moves the page by
0 px. **N**, **B**; **H** (no plan, no box of its own)

**R17. After a save, the part that was saved stays open and no other part opens or shuts.** The page keeps the saved
part's `id` in its module-level `pending` and passes `open: pending?.part === id`; wave 1 puts back the rest. **M**; **P**

**R18. No second filled button, no bar, no tab.** A part's row is never styled as a button; nothing new is fixed to the
bottom of the screen; chips wrap and never scroll sideways. A filled button inside a part is only that part's own
form's Save. **N**, **B**

## 6. Lists

**R19. A list shows six rows, then "N more <things>"** (the first four of each group when it is in groups). A cut never
hides fewer than three rows (a list of eight shows eight), and never hides a row with a guess mark, a warning or an
overdue date (`keep`). `rest()` is the only way to cut. **N**; **H**

**R20. A list with rows folds its add form behind an outlined "+ Add another <thing>"**; an empty list keeps the form
open at its first five boxes (owner, 2026-09-15). **N**

## 7. Forms

**R21. A form asks first for at most five boxes**: every required box, and the boxes most entries need. The rest are
`more: true` fields under wave 1's "More details (optional)", directly above the buttons. A box whose hidden default
would mislead stays out of the fold (a bill's category). A page passes the kit's `moreOpen` as `true` or not at all,
never `false` (`moreOpen: editing || undefined`, not `!!editing`): a `false` would beat the forms switch and a box that
already holds something. **N**

**R22. What Save writes does not depend on whether "More details (optional)" is open.** A folded box is read and saved
like any other (wave 1). A field with `guess` or `required` is never folded. **N**

**R23. A simple choice before an exact figure.** Three or four chips from real reference points, low to high, each
saying what it is; the chip that is on comes from the plan, also when it is none of ours ("Yours: 5.5%"); "Type my own"
shows one box in place (not a part). Drawn by `choice()`. **S**, **H**

## 8. Words

**R24. A part's title is one of the vocabulary phrases** (section 10), or a title a test, a guide step or an owner
decision pins ("Figures the plan cannot see", "Retirement settings", "The split to aim for", "What a paycheck
withholds", "See or change each bill", "Where these numbers come from", "Advanced", "What is still being built",
"Show details"), or, on a page with several `own` parts, two to four words that say what is inside ("Itemized
deductions"). Never a bare "More", "Details", "Other", "Advanced" (outside Settings), "More options", "Expert",
"Simple mode", and never "Go deeper" as a heading. A title a guide step names (`opens:`) is never renamed without the
guide's file. A builder may pin one more kind of title, and only with a reason a reviewer can check: an `own` part that
holds no figure to type (only ticks, or a pick from a list), where "Set my own numbers" would be untrue, is named in two to
four words for what it holds ("Which costs are shared": a tick per cost and its Save). Each such title is in the check's
list (`PINNED_TITLES` in `qa/first-view-lib.mjs`) with its page and reason, the page's module test shows the part holds
no number box, and the owner may rename it. **N**

**R25. The title is fixed; the status changes.** The status is at most 20 characters, never cut with an ellipsis, and
the person's own state comes first: "4 set by you" replaces "standard is better" when both do not fit, and when both
fit it reads "1 set by you · 2026". **N**; **H** (`statusOf`)

**R26. Four spellings for the person's state**: "N set by you" ("set by you" for a part with one figure; "N filled in"
in a form's "More details (optional)"), "our guess" ("N our guesses"), "not set yet", "N to fix". **N**; **H**

## 9. Memory and the switches

**R27. Only the person's own tap on a reading part is remembered across visits** (`kept`, per part, this phone, a
trusted click on the summary, read one tick later). A part opened by an error, a save, a landing, a guide step, the
printer, find-in-page or wave 1 putting typing back is not. Parts with boxes, items and technical parts are kept for
the visit by wave 1 only, and come back shut saying "1 set by you". **H**, **P**, **B**

**R28. A remembered part not drawn for 90 days is forgotten**; Settings will show the count ("You keep N parts open on
this phone") and "Shut them all". **H**, **P**

**R29. The two switches are off unless the person checks them**, on this phone only, never asked during setup, never
on by screen width, never set by an address that is stored (`?more=` counts for one visit). **H**

**R30. A switch opens only what its words promise**: "Show how answers are worked out" opens kinds `more` and `how`;
"Show every box in forms" opens wave 1's "More details (optional)". Neither opens `own`, `figures`, `item`, `tech`,
`links`, an add form or the menu. **H**, **N**

**R31. Nothing about parts or switches is ever written to the plan**, sent to the computer, or put in a downloaded
copy. The key holds page and part names only: never a figure, a name or anything from an account. **H**, **B**

**R32. No device control inside a page.** The helper draws no `input`, `select` or `textarea` of its own (a choice's one
box is the kit's box for a figure of the plan, shown only after "Type my own"); the only place a switch lives is
Settings, a System page, where wave 1 never keeps typing. **N**; **H**

## 10. The vocabulary

Eight phrases, one job each, all fitting a 320 px row.

| # | phrase | used for | status says |
|---|---|---|---|
| 1 | **"N more <things>"** ("4 more numbers", "3 more accounts", "25 more years") | the rest of the figures, or of a list after six rows (kind `more`) | nothing, or "2 set by you" |
| 2 | **"How this is worked out"** | the sum with the person's own numbers, what it leaves out, where the tables come from, with dates (kind `how`); source-only parts keep their owner-chosen titles ("Where these numbers come from") | "11 steps", "sources" |
| 3 | **"Set my own numbers"**; for one box, the chip **"Type my own"** | exact boxes behind chips or behind our guess (kind `own`) | "our guess", "2 set by you" |
| 4 | **"The figures"** | the inputs of a what-if page once it has answered (kind `figures`) | the headline inputs ("$400,000, $2,200 rent") |
| 5 | **"More details (optional)"** | a form's optional boxes, above its buttons (wave 1's words) | what is inside ("category, dates"), then "2 filled in" |
| 6 | **"More on this"** | the links card at the foot of a page, each row the question it answers with its answer under it (owner, 2026-11-06) | - |
| 7 | **"How much to show"** | the Settings card, with **"Show how answers are worked out"** and **"Show every box in forms"** | the check boxes |
| 8 | **"Shut them all"** | forgets every part this phone keeps open | "You keep N parts open on this phone" |

Kept as they are: "+ Add another <thing>" (2026-09-15), "Show details", "Advanced" (Settings' technical card only), and
every title a test, a guide step or the owner pins (R24). Replaced over time, as pages are touched: "Matters less",
"Show all N", "Show more (N left)", "Years ahead", "Type my own amount", "Or type your own numbers", "Correct these
figures", "Change what you typed" (one test pins it: change the test in the same commit), and the old "Next" cards (to
"More on this").

## 11. The helper

```js
import { part, parts, rest, choice, links, statusOf, detail, kept } from "../../../core/ui/more.js";
```

| export | signature | what it is for |
|---|---|---|
| `part` | `part(ctx, { id, kind, title?, n?, noun?, one?, says?, set?, guess?, missing?, fix?, open?, holds?, card?, lazy?, body })` -> `<details>` | one optional part |
| `parts` | `parts(ctx, ...list)` -> `<section class="card" data-parts>` or `null` | the page's parts as rows of one card, in the fixed order (R12); falsy entries skipped; refuses a sixth in a test |
| `rest` | `rest(ctx, { id, items, row, first = 6, noun, one?, keep?, list = "records" })` -> `[ul]` or `[ul, part]` | the first six rows, then "N more <noun>" (R19); `keep(item)` keeps a row among those shown; built when opened above 40 hidden rows |
| `choice` | `choice(ctx, { id, label, presets: [{ value, label }], value, own: { type, label, min?, max?, whole?, show? }, onPick })` -> node | chips, then "Type my own" showing one box (R23); `onPick(value)` on a chip tap or the box's change, never per keystroke; the page commits it with `store.update` |
| `links` | `links(ctx, [{ href, ask, says? }])` -> the "More on this" card, one shut row on a guide's step, or `null` | the deeper pages, each row the question it answers with its answer under it; at most five |
| `statusOf` | `statusOf({ says, set, guess, missing, fix })` -> string | the one status line (R25, R26); pure |
| `detail` | `detail.init(ui)`, `detail.working`, `detail.boxes`, `detail.chosen`, `detail.forVisit`, `detail.set({ working?, boxes? })` | the two switches |
| `kept` | `kept.get(page, id)`, `kept.set(page, id, open, designed)`, `kept.count()`, `kept.clear("open" \| "shut" \| "all")` | the per-part memory |
| `forgetAll`, `openAll` | `forgetAll()`; `openAll(root)` -> `shutAgain()` | erase this phone's key; open every section under `root` (printing, the same-markup check) |
| constants | `MORE_KEY`, `KEEP_DAYS = 90`, `KEPT_KINDS`, `WORKING_KINDS` (both `["more", "how"]`), `KINDS`, `TITLES`, `STATUS_MAX = 20`, `MAX_PARTS = 5`, `MAX_LINKS = 5`, `FIRST_ROWS = 6`, `MAX_ENTRIES = 300` | |

`part()`'s fields:

| field | meaning |
|---|---|
| `id` | the part's stable name on its page ("numbers", "how", "figures", "itemized"): the memory's key and the landing's name. Never built from a title or a count |
| `kind` | `more` (title "N more <noun>" from `n` and `noun`; `one` is the word for one), `how` ("How this is worked out", or a pinned title), `own` ("Set my own numbers", or a named title), `figures` ("The figures"), `item` (named for its item: a person, a month, a card), `tech` ("Show details", "Advanced"), `links` ("More on this": only `links()` on a step) |
| `title` | only for `item`, `tech`, a pinned title, or an `own` part on a page with several |
| `says` | the status in plain words: a count or the figure inside ("11 steps", "$400,000", "2026") |
| `set`, `guess`, `missing`, `fix` | the person's state inside: figures they set (`true` for a part with one figure), figures that are our guess, a figure still wanted, things to fix (`fix > 0` also opens the part) |
| `open` | `true` when the page needs it open on this draw for a reason (just saved, an empty list's add form, a what-if page with no answer yet). Never remembered |
| `holds` | the box names inside, so `?show=<box>` finds the part |
| `card` | `true`: a folded card of its own; default: a row (inside `parts()`, or a card's `.folds`) |
| `lazy` | `true`: the body is built when first opened. Only for a body of more than 40 rows (`rest()` sets it) or one that needs `ctx.computeRemote`; everything else stays in the page, so find-in-page and the Node tests read it |
| `body` | nodes, or a function returning them (called at once unless `lazy`) |

**What it draws.** Only classes `core/ui/base.css` has; the few inline styles sit on the helper's own elements:

```html
<section class="card" data-parts>
  <div class="folds">
    <details class="fold" data-part="numbers" data-kind="more">
      <summary style="display:block">
        <span style="display:flex;align-items:center;gap:10px;min-height:32px">
          <span class="fold-title">4 more numbers</span> <span class="fold-status">2 set by you</span>
          <span class="fold-chev" aria-hidden="true">›</span>
        </span>
      </summary>
      <div class="fold-body" style="display:grid;gap:12px">...</div>
    </details>
  </div>
</section>
```

The title in `.fold-title` is how wave 1's place memory names a section (it drops `.fold-status`), so a part keeps its
identity when its status changes. The summary stays a block with a flex row inside (the shape GOV.UK shipped after
VoiceOver lost "collapsed" on other displays). No heading, link or button inside the summary.

**Open or shut, in one order** (`part()`, the first that applies):

1. **A reason, now** (never remembered): `fix > 0`; a box inside held back at Save (a capture-phase `invalid` listener
   that counts only a check the form kit answers, so a silent `checkValidity()` opens nothing; the kit also opens every
   shut section around the box); `open: true`; the address's `?show=` names the part's `id` or a box in its `holds`
   (once per arrival: a redraw after a save is the same arrival); a guide step's `opens:` (the guide frame opens the
   section by its title after the draw); wave 1 putting typing back inside it.
2. **The person's own last tap on this part, on this phone**, for kinds `more` and `how`, if drawn in the last 90 days.
3. **The switch**: "Show how answers are worked out" on: kinds `more` and `how` open.
4. **Shut.**

The hand beats the switch: `kept` stores a shut (`0`) as well as an open (`1`), only while it differs from how the
page draws the part by default. Checking or unchecking "Show how answers are worked out" forgets the `0` marks; "Shut
them all" forgets the `1` marks. Forms keep wave 1's kit: when a page passes `moreOpen`, that decides; otherwise "More
details (optional)" is open when one of its boxes holds something, when the person opened this form's line earlier on
this visit, or when "Show every box in forms" is on.

**Storage: one key.** `localStorage["planner.more"]` (`planner.more.sandbox` with `?sandbox` in the address):
`{ "fmt": 1, "working": 1, "boxes": 1, "parts": { "taxes/federal#how": [1, <day>] } }`. A switch is stored only when
on; a part only while it differs from how the page draws it, with the day number it was last drawn (refreshed at most
once a day). At most 300 parts, oldest first out; an entry not drawn for 90 days is dropped on the next read; anything
that does not read as `fmt: 1` is nothing stored and is overwritten on the next write; the key goes when it holds
nothing. A private window or a sandboxed frame keeps a copy in memory for the visit. `?more=all`, `?more=working`,
`?more=boxes` in the address (before the `#`) turn the switches on for that visit only, never stored (screenshots and
checks). Safari may delete a site's storage after seven days without a visit: pages then open short and Settings shows
both switches off, which is the safe side.

**The two switches** (the Settings card is built after the free pages' working folds use `part()`, so its words are
true wherever it opens anything):

| | "Show how answers are worked out" (`detail.working`) | "Show every box in forms" (`detail.boxes`) |
|---|---|---|
| the owner's word | depth | complexity |
| opens | every part of kind `more` and `how` | every `ui.form` line "More details (optional)" (the kit's `setMoreOpen`) |
| never opens | `own`, `figures` (they hold a Save), `item`, `tech`, `links`, add forms, Settings' topics, the menu | parts; add forms stay behind "+ Add another" |
| applied | at each draw, in `part()` step 3 | `detail.init(ui)` at boot calls `ui.setMoreOpen(detail.boxes)`; `detail.set({ boxes })` calls it again |
| confirmation | "Done. Pages on this phone now open with how each answer is worked out." / "Done. Pages on this phone open short again." | "Done. Forms on this phone now show every box." / "Done. Forms on this phone open short again." |

**Landings.** `#/taxes/federal?show=itemized` (a part's `id`) or `?show=withheld` (a box in its `holds`) opens that
part once per arrival, brings it under the top bar (`ui.reveal`, block start) and puts the focus on its summary, on a
new arrival only (the page at its top): on Back, Forward or a reload the part is open and wave 1 puts back the spot.
Not remembered. `show` is one of wave 1's presentation keys, so typing kept on the page is found at the landing.
`?edit=`, `?add=` and the pages' other words stay theirs and pass `open: true` to the part they need.

**Redraw after a save.** The shell draws the page again after every `store.update`. The page keeps the saved part's
`id` in its module-level `pending` and passes `open: true` for it on the next draw (R17), then clears it. Wave 1 puts
back the parts the person opened or shut by hand since the last draw, where the page drew them as before, keeps the
tapped button under the thumb and the focus in its box. A part that a landing opened is not forced open again on that
redraw: if the save was inside it, `pending` keeps it open. A page that redraws its own state calls `ctx.redraw()`.

**Back, Forward, reload: two memories, neither writes the other's store** (**P**: each row is a case).

| the person | this phone (`kept`) | this tab's history (wave 1) | Back, Forward or a reload of that entry | a new visit | next week |
|---|---|---|---|---|---|
| opens a reading part | stores `1` | notes `{ by: open, drew: shut }` | open | open | open (until 90 days unseen) |
| shuts a reading part the switch opened | stores `0` | notes `{ by: shut, drew: open }` | shut | shut | shut |
| opens a part with boxes (`own`, `figures`) or an item | nothing | notes it | open | shut, "1 set by you" if they saved | shut |
| opens "More details (optional)" | nothing | notes it; the kit keeps it for the visit | open | open until the app is opened again | shut (open with the forms switch) |
| lands by `?show=` | nothing | nothing | open | as the page draws it | as the page draws it |
| goes Back to an older entry after shutting the part later | nothing | puts back what that entry showed | as they left that screen | the newer choice | the newer choice |
| types in a box inside a shut part, leaves, comes back | nothing | opens the part holding the typing | open | open while the typing is kept | - |

**Print.** A shut `<details>` does not print. On `beforeprint` the helper builds every lazy body and opens every shut
section under `#content` (wave 1's form folds and pages not yet adopted included), and shuts the same ones on
`afterprint`. Nothing is remembered.

**Find-in-page.** A part is a native `<details>`: Chrome and Firefox open a shut one when find hits text inside; Safari
26.2 opens it but does not scroll to the match; an older iPhone finds nothing inside. Opening by find is not a tap:
never remembered.

**Screen readers, 44 px, dark mode.** The browser gives the role and the state; the helper adds no `role` or
`aria-expanded`, and its marker is `aria-hidden`. A landing moves the focus to the summary. `.fold > summary` is at least
44 px tall; a status over 20 characters would wrap the title (R25). The helper has no color of its own. VoiceOver on a
real iPhone is not yet tested.

**In tests.** Outside a browser a broken rule throws (a part without an id or with an unknown kind, "1 more ..."
without `one`, a sixth part, a sixth link); a person's page never breaks for it (a warning, and it draws). The helper
builds every node with `ctx.ui.h` and fills it with `append` only; every other DOM call is optional, so the text-only
stand-ins of the module tests draw it too.

## 12. How a view adopts it

```js
import { part, parts, rest, links } from "../../../core/ui/more.js";

root.append(hero(answerFor(d)));                                    // R3 to R5: the case's own sentence
root.append(...alarms, ...worthMoney);                              // R9: outside the parts
root.append(ui.h("div", {}, parts(ctx,                              // ui.h skips a null; root.append would print "null"
  { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", body: () => ui.row(tiles) },
  { id: "figures", kind: "own", title: "Figures the plan cannot see", holds: ["withheld", "otherIncome"],
    set: typed, says: typed ? "" : "none typed", open: pending?.part === "figures", body: [help, figuresForm] },
  { id: "how", kind: "how", says: `${steps.length} steps`, body: () => [walk, leftOut, sources] })));
root.append(ui.h("div", {}, links(ctx, [
  { href: "#/taxes/brackets", ask: "What would more income cost?", says: "22% on the next dollar" },
  { href: "#/taxes/projection", ask: "What is the tax in later years?" }])));
```

A form: `ui.form([{ key: "name", ... }, { key: "category", ... }, { key: "essential", more: true, ... }, { key:
"startDate", more: true, ... }], values, save, { submitLabel: "Save" })`. A list: `card.append(...rest(ctx, { id:
"accounts", items, row: accountRow, noun: "accounts", keep: (a) => a.guessed }))`. A choice: `choice(ctx, { id:
"return", label: "Return a year", presets: [{ value: 0.04, label: "Careful 4%" }, { value: 0.06, label: "Middle 6%" },
{ value: 0.08, label: "Hopeful 8%" }], value: plan.assumptions.return, own: { type: "percent", label: "Your own
return" }, onPick: (v) => ctx.store.update((d) => { d.assumptions.return = v; }) })`.

Eight steps for one page:

1. Read its README, its design log rows and its tests.
2. Decide the answer and write its sentence per case (R3 to R5), with a module test per case.
3. Move, never delete: every sentence and figure that leaves the first view goes into a named part or a deeper page.
4. Replace module-level "open" variables with `open: pending?.part === id`.
5. The module tests read "outside the parts" and "inside part X".
6. Lower the page's written-down counts (R2): `node qa/first-view-node.mjs <group>/<id>` prints "lower me", and
   `--write` rewrites `tests/first-view.known.json`; the same for the browser's `qa/first-view.known.json`.
7. `node tools/shot.mjs <group>/<id>` at 390 and 320, light and dark, and with `--more` (both switches on for the visit
   and every section opened), and read the pictures.
8. README (what is on the first view, what each part holds, the builder's choices), CHANGELOG line, claim row in
   `docs/TEAM.md`.

## 13. The check

Two checks hold every usable page to sections 2 to 9, for the invented households `family`, `renterDebt`,
`retiredCouple` (qa/fixtures) and the empty plan, with nothing kept on the phone and the clock held at 2026-11-13.

**N, in Node, in `npm test`.** `qa/first-view-lib.mjs` draws every page's `view.js` with the real UI kit on the stand-in
DOM (`qa/fixtures/fake-dom.mjs`, with real selectors) and counts what lies outside every shut section in the phone
markup: words, money and % figures, boxes, tiles, filled buttons (the accent's fill once `base.css` and the page's own
style apply; a chip is not one), sections that open, list rows, and the words behind shut sections (reported only).
`tests/first-view/1.test.mjs` to `6.test.mjs` are six shards that `node --test` runs side by side (each prints its time;
at most 15 s on the builders' 4-core machine, else split it in the kinds file). `tests/first-view.kinds.mjs` gives every
usable page its kind and shard, and holds the budgets; a usable page without a kind fails. `node qa/first-view-node.mjs`
runs everything in one process with a table and the totals.

**B, in a browser, outside `npm test`.** `node qa/first-view.mjs` (the app running, or `--url`) opens every page in each
household's menu on a phone, in the sandbox: the first screen at 390 x 844 (an answer page at most 110 words and 8
figures; the headline, and on an answer or form page the first filled button, wholly above the edge; a settings page's
first card whole; on the empty plan a filled way to start); every shut section opened and shut by a real tap (0 px moved,
a row at least 44 px, an open part at most 1,300 px, the plan and every stored key outside `planner.more`,
`planner.place`, `planner.trail` and `planner.nav` unchanged); one reading part's round trip of the memory (open, reload,
open; shut, reload, shut; nothing kept); the path's Next within 1,688 px; nothing off the side at 320 px; and with
`?more=all` nothing off the side, no target under 44 px, at most one filled button.

**The rule, both.** A page over a budget today has its counts in a known file (`tests/first-view.known.json` for N,
`qa/first-view.known.json` for B): the worst of the three plan households, and the empty plan apart, words rounded up to
ten. A count may only go down; one below its entry prints "lower me" and never fails; lower it in the same commit.
`--write` rewrites the file from what is measured now; read its diff like code. claude-a's 13 folders print to-do lines
and are kept out of both files. A household a page cannot be drawn for in Node is listed as `cannotDraw` in its entry, a
list that may only shrink (today it is empty: every usable page draws for all four).

**The structure checks**, on the same drawings (N): S1 no part inside a part (a form's "More details (optional)" and an
item part excepted); S2 at most five parts, three or more in one `[data-parts]` card, in the order more, own/figures,
how; S3 a status of at most 20 characters, never cut, in the four spellings; S4 a title from the vocabulary or pinned
(section 8); S5 no notice, guess mark, `[data-worth]` line or required box inside a shut section (a page may keep one
there by name in `MOVED_NOTICES`, with its reason); S6 inside a part a filled button only as its form's Save; S7 a part
holds two figures, three rows or forty words; S8 opening and shutting every section saves nothing; S9 a form with a folded
box writes the same plan with "More details (optional)" shut and open, never folds a required box or a guess, and no view
passes `moreOpen: false` or `!!`; S10 a view that imports the helper writes no `<details>` by hand; S12 no text reads
"null", "undefined", "NaN" or "[object Object]"; S13 an adopted view says the same words, figures and box names with every
part and form line open; S14 every section a guide step opens is drawn, holds a box, and the box the step names is its
first; S15 no box inside the parts card outside a form; S16 on a step of the path "More on this" is one shut row. A check
that finds something fails, unless the page's entry counts it (`checks`), and then it may only go down. S11 (after a save
only the saved part changes) lives in each adopted page's own module test, in a test whose name holds "S11"; the check
fails a page that uses the helper without one.

**What the checks cannot see.** Meaning: a page can meet every number and still fold the wrong thing, or use a word a
layperson does not know. The never-folded list (section 4) is read by eye on the 390 px screenshot, and the cheap test
stays: can a first-time person do the page's job without opening anything? N cannot see layout (where a figure lands,
what is wide, what a tap moves); B sees layout but only for the four households and only in Chromium (Safari, VoiceOver
and a real thumb are not measured).
