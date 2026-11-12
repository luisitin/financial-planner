# Optional detail, inline only: quiet opt-ins on every page, remembered per part on the device

Designer's stance: **no modes and no global switch.** Every page gets a first-view budget and a few quiet parts that
open in place; what a person opens stays open on their device, part by part; six phrases name every part.
Written 2026-11-12 on tip `737fb6a`. Nothing in `$REPO` or the read-only copy was edited. One page
was built for real in a worktree of my own and walked by touch; its numbers are in section 5.1 and its files in section 9.
Read before writing: census, inventory, research, walks, constraints, and the two skeptics' corrections (a correction
overrides a report; where I use a corrected claim I say so).

The owner's sentence this serves (2026-11-12): "Continue and be aggressive with OPTIONALITY. Allow a user to have
optionality of complexity. Default to less is more and allow more complexity or toggles. We want subtle optional
complexity". And the day before: "Once we're in the big picture, you can delve deeper and get better analytics and your
results" and "It's got to be valuable".

---------------------------------------------------------------------------------------------------------------------

## 0. The design in fifteen lines

1. **A first-view budget for every page**, by kind of page (answer, list, form, settings): the answer as the headline,
   one sentence, at most four tiles or six rows, one filled button, then the optional parts, then links to deeper
   pages. Numbers in 1.2. At the tip 100 of 151 measurable pages are over their budget (section 4).
2. **A part** is a native `<details>` drawn by one helper, `part()` in a new file `core/ui/more.js`. Parts sit together
   as quiet rows of one card after the answer, in a fixed order: more numbers, the person's own figures, the working.
3. **Six phrases**: "N more <things>", "More options", "Set my own numbers" (one box: "Type my own"), "The figures",
   "How this is worked out", "Show details". Two settled ones stay as they are: "+ Add another <thing>" and the
   links card. A part's title never changes; what changes goes in a status of at most 20 characters.
4. **What a person opens is remembered on their device, per part**, in `localStorage["planner.opened"]`, never in the
   plan. Only their own tap on a part's row is remembered. It holds across a redraw, Back, a reload and other days, and
   is forgotten after 90 days without seeing that part. The app already does this for the menu's topics
   (`planner.nav`): this is the same habit, extended to pages.
5. **A shut part never hides the person's state**: its status says "2 set by you" or "1 to fix"; a box that fails its
   check opens the part and takes the focus; a landing (`?open=<id>`, a guide step's `opens:`) opens the right part.
   None of these is remembered, so the page does not drift open by itself.
6. **Never folded**: the answer, the one action, alarms, every "our guess" mark and "does not add up" warning,
   confirmations, required boxes, and what earlier owner decisions keep on screen (1.3).
7. **One device setting, and it is not a switch**: a line in Settings > Pages that says how many parts stay open on
   this device, with "Shut them all". It appears only when the number is above zero.
8. **No global "show everything" switch.** Reasons in 2.12; the short form: nobody finds a setting, it doubles what
   has to be designed and tested, its grain is wrong (wanting the tax working is not wanting 158 switches open), it
   could only open half of what a detail lover wants, and it can be added later in ten lines if a review asks for it,
   while a shipped switch cannot be taken back.
9. **How a detail lover gets everything**: every part is on every page for everyone; one tap opens it and it stays
   open on that device; every main page ends with links to the deeper pages. Cost: one tap per part, once. On the
   prototype page five taps show everything: 6.41 screens, 839 words, 46 figures and 19 boxes (the page at the tip with
   its three folds open: 6.14 screens, 770 words, 49 figures, 19 boxes; the three figures fewer repeat the headline).
10. **A machine check keeps it true**: a Node test draws every view for four invented households and counts what
    stands outside shut parts, against per-page ceilings that may only go down (the `KNOWN` pattern of
    `tests/guess-sanity.test.mjs`); a browser script measures the first 390 x 844 screen the same way.
11. **Built and measured on one page, Federal estimate** (`taxes/federal`): the family's first screen went from 146
    words and 12 figures to 102 and 3; the unopened page from 3.27 screens, 480 words and 45 figures to 1.30 screens,
    126 words and 3 figures; a retired person at 320 px from 4.85 screens to 1.97. No fact was removed.
12. **It does not touch wave 1's files** (`core/app.js`, `core/ui/dom.js`, `core/ui/base.css`, `frame.js` ...) and does
    not need wave 1 to work; with wave 1's place memory the two agree (2.4).
13. **It does not redo the retirement request's pages**; section 5 says what to check them against when they land.
14. **Build order**: helper and tests, the budget check, Federal estimate, the path's free step pages, the most used
    forms, Settings, then topic by topic; hand-overs for claude-a (13 pages) and claude-f (11 pages) (section 6).
15. **Six decisions are the owner's, the lead's or the designer's, not mine** (section 8): per-part memory in place
    of the device switch the workboard announced, the links card's name ("More on this" or "Go deeper"), the budget
    numbers, whether a page that does not apply to someone may fold its empty add form, folding "Plan basics" on
    Settings, and the part's marker.

---------------------------------------------------------------------------------------------------------------------

## 1. The rules

Each rule has a test. **N** = checked by the Node test of section 4.2; **B** = by the browser script of 4.3; **S** = on
a screenshot in a design review (rule 13 of `AGENTS.md`).

### 1.1 Words used below

- **First view**: the page as it opens for someone who has opened nothing: everything outside a shut part.
- **First screen**: what of it lies above 844 px on a 390 px phone (568 px at 320).
- **Part**: an optional piece of a page drawn by `part()`: a row with a title, a short status and a marker, and a
  body that opens in place.
- **Kind of page**: every usable page has exactly one, listed in `tests/first-view.kinds.mjs` (not in the manifest,
  so no folder of another lane is edited):
  - **answer**: a verdict worked out from the plan (Will the money last?, Federal estimate, Pay off debts, Dashboard);
  - **list**: things the person keeps (accounts, bills, debts, goals, policies, holdings);
  - **form**: a page whose first job is to ask (Get started, Import, Update my balances), and every add or edit form;
  - **settings**: Settings, Glossary, Help, Our guesses for you: lists of things to switch or look up;
  - **report**: pages made to be read whole or printed (`reports/*`, the long year tables): no word budget.

### 1.2 First-view budgets

**R1. The first view of a page stays inside its kind's budget.** Counted on the unopened page in the phone markup,
the worst of the three households with a plan (family, renter, retired couple). **N**

| kind | words | money and percent figures | boxes | tiles | filled buttons | parts |
|---|---|---|---|---|---|---|
| answer | 160 | 8 | 1 (the one box that changes the answer; usually 0) | 4 | 1 | 5 |
| list | 240 | 16 | 0 while the list has rows | 4 | 1 | 5 |
| form | 200 | 4 | 5 | 0 | 1 | 5 |
| settings | 200 | 2 | 3 | 0 | 1 | 5 |
| report | no limit | no limit | 2 | 4 | 1 | 5 |
| any kind, on the empty plan | 100 | 1 | 3 | 0 | 1 | 5 |

Where the numbers come from: four tiles is the owner's own choice (design log 2026-09-16: "four tiles + one sentence",
where a page had six). Five boxes is what fits one phone screen with its button in sight (walks: Goals' three boxes are
0.5 screen, Income's nine are 1.0). 160 words and 8 figures is the Dashboard, the page the walks call the model (103
words and 8 figures on its first screen for the family). The rest are my sizes; the evidence gives the direction, not the
number (research section 6 says the same of its own). The owner can tighten any of them: the check takes them from one table.

**R2. The first screen holds the answer and its action.** On a 390 x 844 screen: at most 110 words, 8 figures and one
filled button; the headline and the page's filled button (when it has one) lie fully above the bottom edge; at 320 px
nothing runs off the side. **B**

**R3. An answer page reads in this order**, top to bottom: (1) the answer as the headline: a sentence in the hero's
`h1` or one `ui.stat`; (2) at most two sentences that make it mean something, with at most three figures; (3) the one
filled button; (4) alarms and "our guess" marks; (5) at most four tiles or six rows that a person would act on;
(6) the parts card; (7) the links card; (8) the shell's way on. **N** for the order of 6, 7, 8; **S** for the rest.

**R4. A list page** shows its headline figure, then at most eight rows (the first six of one list, or the first four
of each group when the list is in groups), then "N more <things>", then its "+ Add another <thing>" button. A cut
never hides fewer than three rows, and never a row that carries a guess mark, a warning or an overdue date. **N**
(Six, not five: Baymard's tested floor for a cut list is six, verify-web section 2 item 1.)

**R5. A form asks first for at most five boxes**: every required box, and the boxes most people fill. The rest sit in
one "More options" part directly above the form's buttons. **N**

**R6. The empty plan gets less, not zeros**: one sentence on what to do first and one filled way to start; an empty
list keeps its add form open (owner, 2026-09-15), inside the five-box rule. **N**

### 1.3 What may never be inside a shut part

**R7.** None of these is ever folded. A redraw that would fold one is wrong, however calm it looks. **N** for a, c, d, f;
**S** for the rest.

- a. The answer, and the pair that gives it meaning (what you plan to spend beside what the money can pay for in a bad
  run; the debt-free month with its monthly amount; what happens in April).
- b. The one action, and the action a link promised: a page opened from Needs attention or a guide step shows that
  action on the first view, or the landing opens the part that holds it (2.6).
- c. Every alarm: red and amber notices, overdue amounts, deadlines, "does not add up" warnings.
- d. Every reason to doubt a figure: "our guess", "Partly our guesses", "not counted yet", the shell's grey guesses row.
- e. Every confirmation after a save, add or remove (owner, 2026-09-15 round 6).
- f. A required box, and any box the page cannot answer without.
- g. What earlier decisions keep on screen: Edit and Delete on Net worth rows; a zero said in words; the gaps on Your
  plan; the Dashboard's three rows; the Assumptions review notice; Settings' order of cards. (These are the three
  things `walks.md` proposes against the log, plus the list in constraints 1.5; none is taken up here.)
- h. Builder details: they are not folded either. They are not on screen at all (owner, 2026-09-15 round 8).

### 1.4 Parts

**R8. One helper, one markup.** Every new or touched optional piece is drawn by `part()`; no view writes
`<details>` by hand any more. Folds named for their item (one person, one month, one card) use it too, with
`kind: "item"`. **N**: a `<details>` in a touched view without `data-part` fails.

**R9. Parts never nest.** A part's body holds no other part. Two exceptions, both narrow: a form may hold its one
"More options" wherever the form is, and a part may hold a list whose rows open (one topic of Settings, one glossary
word). A third level of reading is a page, reached by a link. **N**

**R10. At most five parts on a page, drawn as rows, never as cards of their own**: one or two sit in the card they
belong to; three or more sit together in one card after the answer, in the order: more, the person's own figures,
the working. Five folded cards in a column read as a wall of doors (I built that first; section 5.1). **N**

**R11. An open part is at most a screen and a half** (1,300 px at 390 px wide). Longer content is a deeper page. The
one exception is a part that is the page's own list (the bills on Expenses): a list is as long as it is. **B**

**R12. A part is worth a tap**: it holds at least two figures, three rows or forty words. Less than that is shown. **N**

**R13. Opening or shutting changes nothing in the plan**, asks for no save and loses no typing. **N** (the stand-in
store records every update) and **B** (the saved plan is byte-identical after every part was opened and shut).

**R14. After a save, the part that was saved stays open and no other part opens or shuts.** (Today Federal
estimate's three folds have three habits, and saving the one-number month on Expenses opens the bill list.) **N**

**R15. No second filled button, no bar, no tab.** A part's row is never styled as a button; nothing new is fixed to
the bottom of the screen; chips wrap and never scroll sideways. **N** for filled buttons, **B** for the rest.

### 1.5 Forms and choices

**R16. What Save writes does not depend on whether "More options" is open.** Only boxes whose blank means "none" or
"the usual" may go into it. A box that shows one of our grey guesses stays on the form's first view, because a guess
is written "only from a box the person saw" (`docs/CONVENTIONS.md`, Guesses). **N**: every form that uses
`moreOptions()` is submitted twice, shut and open, and must write the same plan. (This settles the constraints' open
point O2.)

**R17. A simple choice before an exact figure.** Three or four chips taken from real reference points, low to high,
each saying what it is; the plan's value is always the chip that is on, also when it is none of ours ("Yours: 5.5%");
"Type my own" shows one box. The chip that is on comes from the plan, so nothing has to be remembered. **S**

### 1.6 Memory

**R18. Only the person's own tap is remembered**, per part, on the device. A part opened by an error, a save, a
landing, the printer, find-in-page or a guide step is not. **N** and **B**

**R19. Only five kinds are remembered** ("more", "own", "figures", "how", "options"). An item of a list and technical
details are kept for the visit by wave 1 and start shut on a new visit. **N**

**R20. A remembered part that has not been seen for 90 days is forgotten**, and Settings can forget all of them at
once. Nothing about parts is ever written to the plan, sent to the PC or put in a downloaded copy. **N**

### 1.7 Wording

**R21. A part's title is one of the six phrases** (section 3), or, where a page has several parts of the person's own
figures, two to four plain words that say what is inside ("Itemized deductions", "Year and people"). Never a bare
"More", "Details", "Advanced" or "Other" on a page of the household's view. **N**

**R22. The title is fixed; the status changes.** Counts, figures and the person's state go in the status, which is at
most 20 characters and never cut with an ellipsis. Their own state comes first: "4 set by you" replaces "standard is
better" when both do not fit. **N**

**R23. Four status words, one spelling each**: "N set by you", "our guess" (or "N our guesses"), "not set yet",
"N to fix". (Today: eight spellings for the first two, nine for the third, four for the fourth; inventory 1.2.) **N**

**R24. More detail means more figures, never harder words** (owner, 2026-11-06: "a layman can easily understand and
use the page"). Everything inside a part passes the same plain-words rule as the first view. **S**

---------------------------------------------------------------------------------------------------------------------

## 2. The mechanism

### 2.1 The file and its exports

**`core/ui/more.js`**, a new file. It is not one of wave 1's files, imports nothing, and is safe to import in Node.
A view imports it directly, as 53 views already import `core/words.js`:

```js
import { parts, part, rest, moreOptions } from "../../../core/ui/more.js";
```

It exists and runs in the prototype worktree (190 lines; section 9). Everything below marked **built** was walked in a
browser or tested in Node there; **specified** means written here and not yet built.

| export | signature | what it is for | state |
|---|---|---|---|
| `part` | `part(ctx, { id, kind, title?, n?, noun?, says?, set?, guess?, missing?, fix?, open?, card?, lazy?, body })` | one optional part | built |
| `parts` | `parts(ctx, ...list)` | the page's parts as rows of one card, put in the fixed order | built |
| `rest` | `rest(ctx, { id, items, row, first = 6, noun, list = "records", keep? })` | the first rows, then "N more <noun>" | built (`keep` specified) |
| `moreOptions` | `moreOptions(ctx, form, { id = "options", keys, says, blank? })` | move the named boxes of a built `ui.form` into "More options" above its buttons | built |
| `choice` | `choice(ctx, { label, presets: [{ value, label }], value, own: { type, label }, onPick })` | chips first, "Type my own" shows one box | specified (the retirement request already draws this by hand on Assumptions) |
| `statusOf` | `statusOf({ says, set, guess, missing, fix })` | the one status line | built |
| `opened` | `opened.get(page, id)`, `.set(page, id, open)`, `.count()`, `.clear()` | the device's memory | built |
| constants | `OPENED_KEY`, `KEEP_DAYS = 90`, `KEPT`, `TITLES`, `STATUS_MAX = 20` | | built |

The first argument is `ctx`, not `ui` (the report kit's helpers take `ui`): the helper needs the page's key for the
memory (`ctx.module.group` + `/` + `ctx.module.id`, which the shell sets before `render`) and the route for landings.

`part()`'s fields:

| field | meaning |
|---|---|
| `id` | the part's stable name on its page ("numbers", "how", "figures"): the memory's key and the landing's name. Never built from a title or a count. |
| `kind` | `"more"` (title written by the helper from `n` and `noun`: "3 more numbers"), `"own"` ("Set my own numbers"), `"figures"` ("The figures"), `"how"` ("How this is worked out"), `"options"` ("More options"), `"item"` (named for its item), `"tech"` ("Show details") |
| `title` | only for `"item"` and `"tech"`, and for an `"own"` part on a page that has several of them |
| `says` | the status in plain words: a count or the figure inside ("12 steps", "$400,000", "2026") |
| `set`, `guess`, `missing`, `fix` | the person's state inside: how many boxes hold their own figure, how many hold our guess, a figure that is still wanted, how many things need a look |
| `open` | `true` when the page needs the part open on this draw (it was just saved; a landing the page reads). Never remembered. |
| `card` | `false` for a row inside a card (what `parts()` uses), otherwise a whole folded card |
| `lazy` | `true`: the body is built when the part is first opened (2.7) |
| `body` | nodes, or a function that returns them |

### 2.2 What it draws

Only classes that `core/ui/base.css` already has, so no new global CSS (rule 6) and no edit to wave 1's stylesheet:

```html
<section class="card" data-parts>
  <div class="folds">
    <details class="fold" data-part="numbers" data-kind="more">
      <summary style="display:block">
        <span style="display:flex; align-items:center; gap:10px; min-height:32px">
          <span class="fold-title">4 more numbers</span>
          <span class="fold-status">2 set by you</span>
          <span class="fold-chev" aria-hidden="true">›</span>
        </span>
      </summary>
      <div class="fold-body"> ... </div>
    </details>
    ...
  </div>
</section>
```

- The title sits in `.fold-title` and everything that changes in `.fold-status`: that is exactly what wave 1's place
  memory reads to name a section (`foldWords()` in its `core/place.js` drops `.fold-status` and turns figures into `#`).
- `summary` stays `display: block` and an inner `span` is the flex row. `base.css` makes `.fold > summary` a flex box;
  VoiceOver on an iPhone is known to drop "collapsed / expanded" for some displays of `summary` (research 1.6, and
  verify-web 4.2 on the removed marker). The inline style costs nothing and is the shape GOV.UK shipped. Not tested
  on a real iPhone (section 8).
- No heading inside `summary`, the marker is `aria-hidden`, a space sits between title and status so a screen reader
  does not run them together, no link or button inside the row.
- The inline styles are on the helper's own elements only. When wave 1 has landed, its owner can move them into
  `base.css` in one line; nothing depends on that.

### 2.3 Open or shut: one list, in this order

1. **It must be open now**: `fix` is above zero; a box inside failed its check; the page passed `open: true`; the
   address names it (`?open=<id>`, once per arrival); a guide step names its title in `opens:`; wave 1 found unsaved
   typing inside. Not remembered.
2. **The person's last tap on this device** for this part, when its kind is one of the five kept kinds and the part
   was seen in the last 90 days.
3. **Shut.**

There is no fourth rule, no setting and no "opens itself when it holds a value". GOV.UK's own components warn that
remembered sections combined with sections opened by default "could confuse users"; one short list is the answer to that.

### 2.4 The memory

**Where.** `localStorage["planner.opened"]` (`planner.opened.sandbox` under `?sandbox=1`, so a test run never touches
the owner's device), read in a try/catch with an in-memory fallback, the same shape as `core/view.js` and
`core/features.js`. Never in the plan: `compute.js` cannot see it, it does not travel to the PC, it is not in a
downloaded copy.

**Format.** `{ "fmt": 1, "parts": { "taxes/federal#how": [1, 20769] } }`: per part, 1 (the person opened it) or 0 (they
shut one the page keeps open), and the day number it was last seen. Only a choice that differs from "shut" is kept:
opening a part and shutting it again leaves nothing behind (seen in the walk: the store went back to `null`). At most
300 entries; the oldest go first.

**What is written, and when.** A click on the part's `summary` that the browser marks as the person's own
(`event.isTrusted`), read one tick later. Not the `toggle` event: a script, the printer, find-in-page, wave 1 putting a
section back and a failing box all fire `toggle`, and none of them is a choice. The same test wave 1 uses.

**What it survives** (walked on the prototype, tip `737fb6a`, without wave 1): the redraw after a save on the page;
another page and the phone's Back; a reload; a new visit by a link; another day.

**Forgetting.** Each time a remembered part is drawn its day is refreshed (at most one write a day per part). A part
not drawn for 90 days is dropped on the next read, and the page opens as designed again. That is the answer to the
research's worry (its 1.7) that memory without an end would wear the rule away: what a person keeps using stays; what
they opened once and never saw again goes back to short. Safari can also empty a site's storage after seven days
without a visit (verify-web 4.1): the plan on that device goes with it, and the pages go back to short, which is the
safe side. The same loss would silently turn a global switch off.

**With wave 1's place memory** (`core/place.js`, per history entry, this tab, native `<details>` only):

| the person | this helper | wave 1 | on screen |
|---|---|---|---|
| opens a kept part by its row | stores "open" | notes `{ by: open, drew: shut }` for this entry | open |
| the page redraws after a save | draws it open | sees the page drew it differently from before: "the page wins" | open |
| goes to another page and presses Back | draws it open | nothing to put back | open |
| shuts it | forgets the entry | notes `{ by: shut, drew: open }` | shut |
| opens an item row (a person, a month) | nothing (not a kept kind) | keeps it for this entry | open on Back and reload; shut on a new visit |
| presses Back to an entry where the part was open, after shutting it later | draws it shut | puts back what that entry showed | open, as they left that screen; a new visit shows it shut |
| types in a box, leaves, comes back | nothing | opens the section that holds the typing, "Not saved yet" | open; not remembered |

So the helper is "how the page draws the part" and wave 1 is "what this screen looked like when I left it". They do
not write each other's stores and neither needs the other.

### 2.5 The person's figures and errors inside a shut part

- **A figure they set**: the view counts it and passes `set`; the status reads "2 set by you". When a description and
  the count both fit in 20 characters both show ("2026 · 1 set by you"); otherwise the person's state wins.
- **Our guess inside**: `guess` gives "our guess" or "3 our guesses". The mark on the first view (R7d) stays; the
  status repeats it and never replaces it.
- **Something to fix that the page knows at draw time** (a figure the answer still wants, two figures that disagree):
  `fix: n` opens the part and its status reads "1 to fix". If the answer cannot be given without the box, the box
  belongs on the first view (R7f), not in a part.
- **A box that fails its check on Save**: the part listens for `invalid` in the capture phase and opens. Walked: a
  form whose "More options" was shut held a value over its limit; on Save the part opened, the focus went to that box
  and the browser's message showed under it; nothing was saved. Wave 1's form kit opens every shut ancestor of a
  failing box too; the two do the same thing.
- **Typing not saved**: wave 1's job (it opens the section and says "Not saved yet · Undo my typing").

### 2.6 Landings

- **New links use one key**: `#/taxes/federal?open=how` opens that part once per arrival (a `WeakSet` of route
  objects, as Assumptions' `?show=` does), brings it under the top bar (measured: 68 px from the top, below the 56 px
  bar, because `html` already has `scroll-padding-top`) and is not remembered.
- **The landings that exist keep working**, because a part is a native `<details>`: `?show=<key>` on Assumptions and
  `?type=spending` on Will the money last? pass `open: true` for the part that holds the box and then scroll and
  outline it as today; `?edit=<id>` and `?add=<type>` open their forms as today; a guide step's
  `opens: "Figures the plan cannot see"` is found by `frame.js openFold()` through the summary's text (walked: it
  opened the part on a fresh plan and nothing was remembered).
- **Rule R7b follows from this**: a page may put a promised action inside a part only if every address that lands on
  it opens that part. A title a guide step names (`journeys.js`, claude-f's lane) is never renamed without that file.

### 2.7 Heavy parts

A body is in the page from the first draw unless the view says `lazy: true`; then it is built when the part first
opens (or at once when the part is drawn open). Use it only for a body of more than 40 rows or one that needs
`ctx.computeRemote` (`rest()` sets it by itself above 40 hidden rows). The reason to be sparing: text that is not in
the page cannot be found by the browser's find-in-page. Building a shut body costs what the page costs today, since
today everything is drawn.

### 2.8 Printing, find-in-page, screen readers, tap size

- **Printing.** A shut `<details>` does not print (research, measured). The helper opens every shut `<details>` under
  `#content` on `beforeprint` and shuts them on `afterprint`. Measured in Chromium: `page.pdf()` gave four pages that
  hold the walk, the forms and the sources of the shut parts; the memory was untouched. It also helps pages that have
  not adopted the helper. Not measured in Safari. The report sheets print through their own stylesheet and hold no parts.
- **Find-in-page.** A native `<details>` opens itself when the browser's find hits text inside: Chrome and Firefox do
  it and scroll to the match; Safari from 26.2 opens it but does not scroll to it (WebKit bug 304174, still open:
  verify-web 1.1); an older iPhone finds nothing inside. A hand-made "Show more" is never found, which is one more
  reason for R8. Not walked here (a headless browser has no find box).
- **Screen readers.** 2.2. A native `<details>` announces its own state; the helper adds no `role` and no
  `aria-expanded`.
- **Tap size.** `.fold > summary` has `min-height: 44px`. Measured rows: 44 to 57 px at 390 and at 320. A status
  longer than 20 characters wrapped the title and made a 102 px row at 320, which is where R22's limit comes from.

### 2.9 What it does not touch

- No wave 1 file: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`,
  `core/ui/base.css`, `modules/overview/guide/frame.js`, `core/place.js`. Nothing is added to `ctx`.
- No plan field, no migration, no `compute.js`.
- No file list to update for the static site (the service worker keeps none). Rule 16 still applies: the helper lands
  and `main` moves through the gate before, or with, the first page that imports it.
- `ui.form` gets no `more` option here (wave 1 names it as a follow-up). `moreOptions()` works on a built form with
  `append` only, so it runs under the repo's fake DOM, which has no `insertBefore`.
- Three test files draw views with their own text-only stand-in for the kit, whose nodes have no listeners and no
  `firstChild`. The prototype crashed there first. The helper now builds everything with `ui.h` and makes every DOM
  call optional; the Federal estimate's own tests then ran.

### 2.10 How a view adopts it

Before (each fold written by hand, three variables for three habits):

```js
return ui.h("details", { class: "card fold fold-card", open: open ? true : null },
  ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Figures the plan cannot see"),
    ui.h("span", { class: "fold-status" }, typedCount ? `${typedCount} typed` : "none typed"), ui.h("span", { class: "fold-chev" }, "›")),
  ui.h("div", { class: "fold-body" }, help, form));
```

After (the view says what the part is; the helper does the rest):

```js
const optional = [];
optional.push({ id: "numbers", kind: "more", n: tiles.length, noun: "numbers", body: () => ui.row(tiles) });
optional.push({ id: "figures", kind: "own", title: "Figures the plan cannot see", says: typed ? "" : "none typed", set: typed, open: savedPart === "figures", body: [help, form] });
optional.push({ id: "how", kind: "how", says: `${steps.length} steps`, body: () => [walk, leftOut, sources] });
root.append(parts(ctx, optional));
```

A form:

```js
const form = ui.form(FIELDS, values, save, { submitLabel: "Add expense" });
moreOptions(ctx, form, { keys: ["category", "essential", "inflates", "startDate", "endDate"], says: "category, dates" });
```

A list:

```js
card.append(...rest(ctx, { id: "accounts", items: accounts, row: accountRow, noun: "accounts", keep: (a) => a.guessed }));
```

The steps for one page, in order: (1) read its README, its row in the design log and its tests; (2) decide the
answer, the sentence and the action; (3) move, never delete: every sentence and figure that leaves the first view goes
into a named part or onto a deeper page; (4) replace module-level "open" variables with `open: saved === id`;
(5) the module test splits what it reads into "outside the parts" and "inside part X" (the RMD, Roth conversions and
How much to take out tests already do); (6) lower the page's `KNOWN` entry; (7) `node tools/shot.mjs` at 390 and 320,
read the pictures; (8) README, CHANGELOG, the claim row.

### 2.11 The one device setting

**Where**: Settings > Pages, one line under the topics, drawn only when `opened.count()` is above zero:

> Parts you opened stay open on this device: 7 now.   ( Shut them all )

**What the button does**: `opened.clear()`: removes `localStorage["planner.opened"]`. Every page then opens as it is
designed. It confirms with `ui.notice("ok", "Done. Every page opens short again.")` and the line goes. It changes
nothing in the plan, nothing on other devices and no figure anywhere. "Erase the copy on this device" clears it too.
`docs/DATA_MODEL.md` "Not in the plan" lists the key. There is no on/off switch: a person who wants nothing
remembered has nothing to do, because nothing is remembered until they open something.

### 2.12 Why no global switch, and how a detail lover still gets everything

The research recommends inline parts plus one device preference "Open the extra numbers and options on every page".
The workboard line of 2026-11-12 14:55 announces the same ("one device setting for people who always want the
detail"). I argue against it, and section 8 puts the choice where it belongs.

**Unnecessary.**
1. *Every part exists for everyone.* Nothing is in one mode only. The person who wants the detail is one tap from
   it, and after that tap it is simply there, on every later visit, on that device.
2. *The cost is one tap per part, once.* On the prototype page five taps show everything: 6.41 screens, 839 words, 46
   figures and 19 boxes. The page at the tip with its three folds open is 6.14 screens, 770 words, 49 figures and 19
   boxes, so nothing went missing (the three figures fewer repeated the headline; the extra words are the links card).
   On the fourteen pages the walks covered, with at most five parts a page, "everything, for ever" is at most 70
   taps, each made at the moment the person wanted that part anyway.
3. *The walks' two detail lovers asked for this, in their own words*: "keep what I open, open" (Kai); "the walk and
   the cannot-see boxes open by default" (Lee); "every box in every form"; "the tax pages listed at the foot of each
   tax page". Per-part memory, "More options" and the links card are those four things. The fifth, figures to the
   dollar, is a number format and no fold, switch or mode gives it; it belongs with "Number and date format".
4. *The study the research leans on points this way.* The skeptic's correction (verify-web 1.5): in the Word field
   study 13 of 20 people preferred an interface they had **filled themselves**, item by item, with the full one a tap
   away; what they disliked was the time it took to set up. Per-part memory is that interface with the set-up cost
   removed: the person builds their own detailed view by opening what they want, where they want it.
5. *The app already does it.* The menu's topics remember open and shut on the device (`planner.nav`), and nobody
   needed a "show the long menu" switch.

**Risky.**
1. *Its grain is wrong.* One switch for 159 pages treats "I want to see how my tax is worked out" and "I want all 158
   page switches and 21 rental boxes open" as the same wish. Settings with everything open is 10,639 px.
2. *It cannot keep its promise.* To stay safe the research limits what the switch opens: not "How this is worked
   out", not lists, not add forms, not long tables, not anything over a screen and a half. So the first thing the
   detail lovers asked for (the working under every answer) stays a tap away on every page, and the app then has two
   mechanisms to explain instead of one.
3. *It doubles what must be kept true.* Every page in two states at two widths: the budget check "may only go down"
   has no meaning in the open state; every screenshot review and every smoke run happens twice. This repo has several
   builders and a lane that has not answered since 2026-10-30: claude-a's 13 pages would not follow the switch, so
   "on every page" would be false on 13 pages the day it shipped. Inline parts make no promise about other pages.
4. *Three rules would decide what is open*: the page's design, the person's taps (wave 1 keeps them for the visit) and
   the switch. Section 2.3 has one list.
5. *It becomes a mode.* The walks' own "one choice per device" already bundles five different things (the working,
   every box, cents, deeper pages, the long menu). Once a switch exists, the next feature hangs on it, and then
   something exists in one state only: the level-structured trap the research itself describes.
6. *It can turn itself off.* Safari's seven-day storage rule, a private window, a new phone: the whole app changes its
   look at once, which is the "it changed by itself" the research warns about. When per-part memory is lost, pages
   go back to short, one at a time, which is what the owner asked for as the default.
7. *Nobody finds it.* The research's own point: fewer than one in twenty people change a setting. The simple view has
   to carry everyone either way; the switch would be built, tested and documented for the two people who would also
   be served by tapping.

**Not closed.** If a review shows a person opening the same kind of part on page after page as a habit, a device
preference is ten lines: `part()` has one place where "shut by design" is decided, and Settings has the line to put a
tick box beside. Building inline first loses nothing. Shipping a switch first cannot be undone without annoying whoever
turned it on.

**What is honestly against this stance.** (a) The research reads per-part memory across days as a risk (its own
inference, not a study): 2.4's forgetting and Settings' "Shut them all" are my answer, and the walk shows the cost: with
"4 more numbers" left open the family's first screen holds 12 figures again, by their own choice. (b) A person who
wants everything pays up to 70 taps over time where a switch costs one. (c) One Fidelity user in the research's own
sources asks for exactly a simple and an advanced mode.

---------------------------------------------------------------------------------------------------------------------

## 3. The vocabulary

Six phrases for things that open in place. One job each; all fit a 320 px row.

| # | phrase | kind | job | status says | replaces today |
|---|---|---|---|---|---|
| 1 | **"N more <things>"**: "3 more numbers", "4 more accounts", "25 more years" | `more` | the rest of the figures or of a list | nothing, or "2 set by you" | "Matters less", "Other choices ... (N)", "Years ahead", "Show all N", "Show more (N left)", "Everything in this check-in (N)" |
| 2 | **"More options"** | `options` | the rarely needed boxes of a form, above its buttons | what is inside ("category, dates"), or "2 set by you" | "More details (optional)", "Split it up (optional)", and about 500 unmarked optional boxes |
| 3 | **"Set my own numbers"**; for one box, the chip **"Type my own"** | `own` | exact boxes behind a guess, a usual figure or presets | "our guess", "2 set by you" | "Type my own amount", "Or type your own numbers", "Correct these figures", "Change what you typed", "Your figures" |
| 4 | **"The figures"** | `figures` | the inputs of a what-if page, folded once it has answered | the headline inputs ("$400,000, $2,200") | "<X>: the figures", "The project", "The purchase", "Policy terms", "... settings" |
| 5 | **"How this is worked out"** | `how` | the sum with the person's own numbers, what it leaves out, where the tables come from | "12 steps" | 23 titles in 29 folds (8 of the "how it is worked out" kind in 16 views) |
| 6 | **"Show details"** | `tech` | technical text under a notice | nothing | already settled (7) |

Kept as they are, not parts: **"+ Add another <thing>"** (the settled add button; four add forms drawn as folds join it)
and the **links card** at the foot of a page (37 views head it "More on this"; see section 8 for "Go deeper").
Named for their item, not from the list: a person, a month, a card, a topic, and, on a page with several parts of the
person's own figures, the two to four words that say what is inside.

About "More options": the skeptic found that one of the research's own sources says never to label a door "More
options…" and to say what is inside instead (verify-web 1.2). The phrase is in the builder's reading recorded in the
design log and in `AGENTS.md`, so I keep it, with one rule that meets the source's point: it never stands alone. Its
status always names what is inside ("category, dates") until something inside is the person's own.

Titles that tests or guide steps pin stay word for word and are used as the "named" form: "Figures the plan cannot
see", "Retirement settings", "The split to aim for", "What a paycheck withholds", "See or change each bill",
"Advanced", "What is still being built". "How this is worked out" is already pinned by three test files under that
exact name.

---------------------------------------------------------------------------------------------------------------------

## 4. The machine check

Three pieces. The first two run inside `npm test`; the third needs a browser and runs at the start of every phase
and before a push that touches a view, next to `qa/smoke-all.mjs`.

### 4.1 `tests/more.test.mjs`: the helper

Eleven tests exist in the prototype and pass under the repo's fake DOM (section 9): one markup; the memory keeps only
what differs from the design; an item is never kept; a part unseen for 90 days is forgotten; `open: true` and `fix`
open without being remembered; `?open=` works once per arrival; a lazy body is built once; statuses stay inside 20
characters with the person's state first; `rest()` never hides fewer than three rows; `parts()` puts rows in the
fixed order; `moreOptions()` leaves the buttons last and Save reads the same boxes.

### 4.2 `tests/first-view.test.mjs`: the budget, with counts that may only go down

**What it does.** It draws every usable page's `view.js` in Node, with the real UI kit on the repo's fake DOM, for four
invented households (`qa/fixtures/family-plan.mjs`, `renter-debt-plan.mjs`, `retired-couple-plan.mjs`, and the empty
plan), and counts what a person meets before any tap.

**Proved possible at the tip** (`first-view.mjs` in section 9 is the counter): 150 of the 159 usable views draw for
all four households in 33 seconds (20 s of processor time). The other nine need three small additions to the stand-in
(`insertBefore`, `before`, `CSS.escape`, a `select`'s first value) or two more stubs in the test's `ctx` (`api.ready`);
they start in a list `CANNOT_DRAW` that may only shrink.

**What is counted** (everything outside a shut `<details>`; `.only-wide`, `[hidden]`, `aria-hidden`, `option` and
`style` are skipped, so the count is the phone's):

| count | rule |
|---|---|
| words | every run of letters or digits in visible text, labels and buttons included |
| figures | `$1,200`-like and `23.9%`-like tokens in text; not values inside boxes, not years or ages |
| boxes | `input`, `select`, `textarea` a person can type into; not tick boxes, files, buttons |
| tiles | elements with the class `stat` |
| filled buttons | `button` and `a.btn` without `secondary`, `link`, `danger`, `chip`, `small` or `ghost` |
| parts | `<details>` whose summary is visible |
| behind | the words inside shut parts (reported, not limited: it shows nothing was deleted) |

**The rule, as in `tests/guess-sanity.test.mjs`.** `tests/first-view.kinds.mjs` gives every usable page its kind (a
usable page without one fails, so a new page cannot skip it). `tests/first-view.known.json` holds, for each page that
is over its kind's budget today, the counts it is allowed: its measured worst over the three households with a plan,
words rounded up to the next ten.
- A page with no entry must meet its kind's budget (1.2). So must every page on the empty plan, with its own entries.
- A page with an entry fails when any count rises above it. A redraw lowers the entry in the same commit.
- A count that has fallen below its entry prints a line ("lower me"), never a failure, as guess-sanity does.
- claude-a's 13 folders are listed as `CLAUDE_A_LANE` (as `tests/wording.test.mjs` does) and reported as to-do: their
  counts are kept out of every total that "may only go down".
- `node qa/first-view-node.mjs --write` regenerates the file after a deliberate change; the diff is reviewed like code.

**Where it starts.** With a first-cut map of kinds (mine, by hand; to be checked page by page), at the tip:
**100 of 151 pages are over their budget** (answer 69 of 84, list 25 of 37, settings 4 of 6, form 2 of 12; 12 reports
have no word budget), and on the empty plan 54 of 140 are over (45 on words, 23 on boxes, 18 on figures, 6 on filled
buttons). The prototype moves one row: `taxes/federal` from 473 words and 45 figures to 124 and 3, with the words
behind parts going from 290 to 713; on the empty plan from 194 words to 87.

**It is not perfectly still.** One page that finishes drawing late (`scenarios/goal-seek` for the retired couple)
counted 254 words in one run and 250 in the next. That is why the entries are ceilings rounded up, not exact values.

**The same drawn pages are checked for structure** (each is one rule of section 1):

| id | check | rule |
|---|---|---|
| S1 | no part inside a part, except a form's "More options" and a list of rows that open | R9 |
| S2 | at most five parts; three or more share one card; order more, own or figures, how | R10 |
| S3 | a status is at most 20 characters and uses the four spellings | R22, R23 |
| S4 | a title matches its kind's phrase, or is a named part on a page with several | R21 |
| S5 | no `.notice.error` or `.notice.warn` inside a shut part; no `required` box inside a shut part | R7 |
| S6 | at most one filled button outside the parts | R15 |
| S7 | every part has a body worth a tap (two figures, three rows or forty words) | R12 |
| S8 | toggling every part calls `store.update` zero times | R13 |
| S9 | a form with `moreOptions()` saves the same plan with the part shut and open | R16 |
| S10 | a touched view has no hand-written `<details>` (no `data-part`) | R8 |
| S11 | after a save, only the saved part's `open` differs from before | R14 |

### 4.3 `qa/first-view.mjs`: the first screen, in a browser

The census script of this investigation with a budget on top (it took 3 minutes 10 seconds for 954 page views). For
every page in the household's menu and the same households, at 390 x 844 and at 320 x 568:
- the first screen's words, figures and filled buttons against R2, and that the headline and the filled button lie
  above the bottom edge;
- every part opened by a touch tap: the page did not move, the row is at least 44 px tall, the open part is at most
  1,300 px (R11), nothing runs off the side;
- the saved plan and every stored key except `planner.opened` are byte-identical afterwards (R13);
- one round trip of the memory per page: open, reload, still open; shut, reload, shut; the store is empty again (R18).
It writes `qa/first-view.known.json` with the same only-down rule, and a table like the census's so a before and an
after can be compared with one command.

### 4.4 What the checks cannot see

Meaning. A page can meet every number and still fold the wrong thing or use a word a layperson does not know. Rule
13 stays: the screenshot at 390 px is read before a page is called done, and R7's list is checked by eye. The research's
cheap test goes with it: can a first-time person do the page's job without opening anything?

---------------------------------------------------------------------------------------------------------------------

## 5. Worked examples: eight pages redrawn, one of them built

Chosen from the census's heaviest and from the walks: Federal estimate (first views #19; 3.3 screens), Will the money
last? (pages #15), Assumptions (10 boxes), Net worth, Expenses, Retirement contributions, Settings, and the longest
form in the app (Rental analysis, 21 boxes). Two short ones follow for the list rule and the densest first screen.

How to read the drawings: 390 px wide. `[ ... ]` is the filled button, `( ... )` an outlined one, `▸` a part that
opens in place (the app draws "›" there today and turns it down when open), `›` a link to another page. "Today"
figures are from the census as corrected by the skeptic, or from my own counter where it says so.

### 5.1 Federal estimate (`taxes/federal`): answer page, free for claude-b. BUILT.

**Today** (family): the headline is "About $14,723 of federal tax for 2026"; what happens in April is in the third
sentence of a 60-word paragraph with seven figures; a 49-word note; four tiles; an 11-row walk; an 8-row card; three
folds with three habits; one link to another tax page. 3.27 screens. The same page for someone who owes nothing is
2.81 screens (4.85 at 320 px).

**First view, as built:**

```
┌────────────────────────────────────────────┐
│ You would owe about $5,253 in April        │  the answer
│ About $14,723 of federal tax for 2026.     │  one sentence: the tax, then what is
│ Your paychecks take out about $9,470 by    │  already being paid toward it
│ December (estimated from your pay).        │
│ [ Fix it in your paychecks ]               │  the one filled button
│ An estimate, not tax advice.               │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ 4 more numbers                           ▸ │
│ Figures the plan cannot see  none typed  ▸ │
│ Itemized deductions  standard is better  ▸ │
│ Year and people                    2026  ▸ │
│ How this is worked out         11 steps  ▸ │
└────────────────────────────────────────────┘
┌ More on this ──────────────────────────────┐
│ Your tax rates, band by band ›             │
│ Tax, year by year ›                        │
│ Tax on what you sell ›                     │
│ State tax ›                                │
│ Tax report ›                               │
└────────────────────────────────────────────┘
  Continue your plan: step 2 of 8 ›             the shell's way on
```

The headline for the other households: "No federal tax to pay for 2026" (a retired person; was "About $0 of federal
tax for 2026"), "Your tax for 2026 is about right" (a young renter), "$1,241 of tax is overdue now" (a retired couple
who owe estimated payments), "$6,731 of tax is overdue now" (a freelancer), and for two separate returns "Ana would
get about $2,200 back, and Bo would owe about $1,660".

**Each opt-in:**

| part | kind | inside | status | opens by itself when |
|---|---|---|---|---|
| 4 more numbers | more | tiles: share of income, the next dollar, taxable income, self-employment tax; one sentence with filing status, income and why the next dollar costs what it does | none | never |
| Figures the plan cannot see | own, named (a guide step and a qa flow name it) | 9 boxes and "Save figures" | "none typed", then "2 set by you" | just saved; the guide step "Estimate this year's tax" |
| Itemized deductions | own, named | 6 boxes, the comparison with the standard deduction | "standard is better", then "4 set by you" | just saved |
| Year and people | own, named | tax year, dependents, 4 boxes | "2026", then "2026 · 1 set by you" | just saved |
| How this is worked out | how | "From income to tax" (11 rows), "What the plan already knows" (8 rows), "What this leaves out", "Where the tables come from" | "11 steps" | `?open=how` |

**Measured** (my counter, section 9; the census's own counter reads 154 words and 14 figures on the family's first screen):

| household | before: screens · first screen words / figures · unopened page words / figures | after |
|---|---|---|
| family | 3.27 · 146 / 12 · 480 / 45 | 1.30 · 102 / 3 · 126 / 3 |
| a retired person | 2.81 · 149 / 11 · 396 / 28 | 1.27 · 94 / 1 · 116 / 1 |
| a young renter (Get started) | 2.43 · 147 / 13 · 321 / 23 | 1.33 · 102 / 2 · 131 / 2 |
| retired couple | 3.15 · 159 / 14 · 457 / 34 | 1.33 · 101 / 3 · 130 / 3 |
| freelancer | 3.15 · 158 / 15 · 447 / 42 | 1.33 · 105 / 4 · 134 / 4 |
| renter with debts | 2.43 · 148 / 12 · 322 / 22 | 1.33 · 102 / 2 · 131 / 2 |
| a retired person at 320 x 568 | 4.85 · 116 / 5 · 396 / 28 | 1.97 · 52 / 1 · 116 / 1 |

With every part open (five taps) the family's page is 6.41 screens, 839 words, 46 figures, 19 boxes; at the tip with
its three folds open it is 6.14 screens, 770 words, 49 figures, 19 boxes.

**Walked by touch** (family, 390 x 844, sandbox; the log is in section 9):
- opening "4 more numbers" moved the page by 0 px, left the saved plan byte-identical and wrote one entry to the store;
- it was still open after a reload, after going to the Dashboard and pressing Back, and on a new visit by a link;
- "Save figures" with two boxes typed: the part stayed open, read "2 set by you", the headline became "About $720
  would come back in April", the green line said the new tax; shutting it kept "2 set by you" on the shut row;
- "Save deductions" with four boxes: that part stayed open, the others did not move; three parts, one habit;
- shutting everything by hand emptied the store again;
- `#/taxes/federal?open=how` opened the working 68 px under the top of the screen and remembered nothing;
- the guide step "Estimate this year's tax" still opened "Figures the plan cannot see" on a fresh plan, by its title;
- printing: every part open for the printer and shut after; a four-page PDF holds the walk, the forms and the sources;
- a box over its limit inside a shut "More options" (a test form with the real kit): Save opened the part, focused
  the box, showed the browser's message, saved nothing;
- at 320 x 568: rows 44 to 57 px, nothing off the side;
- in dark mode (two screenshots read): the rows, statuses and tiles hold their contrast; the helper has no color of
  its own;
- Chrome's accessibility tree: five disclosures named by title and status ("Itemized deductions standard is better"),
  expanded false, and true after a tap; Enter on a focused row opens it and it is remembered like a tap;
- no page error and no console error in any step.

**The repo's own checks on the prototype**: `npm run check` OK; `npm test` 189,407 tests, 4 fail, all four because
they pin an exact old sentence of this page (two in its module test, two that read `view.js` as text in
`tests/wording-left.test.mjs` and `tests/wording-review.test.mjs`); the facts those sentences carry are still on the
page in new words. 59 of the page's own 61 tests passed untouched.

**What I learned by building it:**
1. *Five folded cards are a wall of doors.* My first build drew each part as its own card: five chevrons in a
   column, 560 px tall, and it looked emptier and busier at once. One card of five rows is 260 px and reads as "there
   is more here if you want it". Hence `parts()` and R10.
2. *A status must be short.* "standard is better · 4 set by you" wrapped the title to two lines at 390, and
   "tax held back, other income" made a 102 px row at 320. Hence 20 characters and "the person's state first".
3. *Moving the headline moves pinned sentences.* Four tests failed on wording. A redraw must move every sentence
   (I first dropped the one about the next dollar; eight of the page's tests said so) and its tests should read
   "outside the parts" and "inside part X", as three retirement pages' tests already do.
4. *Views are drawn by more than one stand-in in tests.* The helper crashed under a text-only kit used by three test
   files. It must build with `ui.h` only and make every DOM call optional.
5. *One catch-all working is too long.* "How this is worked out" is 1,560 px open, over R11. In the build the walk,
   what is left out and the sources stay (about 1,000 px) and "What the plan already knows" becomes the first card of
   the Tax report page, linked from the working. "Figures the plan cannot see" is 1,281 px with 9 boxes: just inside,
   and its first box should be "Federal tax withheld so far", the one the guide asks for (it is the 8th of 9 today).
6. *Memory has a price, and the order rule decides what it is.* With "4 more numbers" left open, the family's first
   screen holds 12 figures again (121 words). That is their choice, and it is why the numbers come first in the fixed
   order and the working last: what a person keeps open pushes down only what is more optional still.
7. *One store ends the three habits.* The module variable `figsOpen` went away; all three forms now stay open after
   their own Save for the same reason, and none opens another.
8. *The memory alone already survives a redraw, Back and a reload on today's tip*, without wave 1.
9. *The page's answer was not its headline.* The biggest gain was not folding; it was saying "You would owe about
   $5,253 in April" first. Optionality starts with deciding what the answer is.
10. *Not done in the prototype, to do in the build*: the child care hint (a credit the person could claim) should
    stay on the first view when it applies; it is still inside the working. The info notices stay where they are.
    And a part's body needs the card's own spacing between its children: in "4 more numbers" the sentence sits
    flush under the tiles (the helper gives a form's "More options" a 12 px gap and should give every body one).

### 5.2 Will the money last? (`retirement/projection`): answer page. IN FLIGHT (the retirement request, L2 and L4).

Not redrawn by this work. This is the first view the rules ask for, and the list to check the landed page against.

**Today** (tip; a retired person): "The money lasts", then three sentences with five figures (the average case, the
bad run, the count of pretend futures), two outlined buttons, four tiles, a chart, an eight-row "What goes into this"
(907 px), "Retirement settings" (7 boxes) at y=2300. 2.97 screens; "today's dollars" five times. The family: 3.3
screens, 145 words and 8 figures on the first screen, 490 words and 30 figures in all.

```
┌────────────────────────────────────────────┐
│ The money lasts                            │
│ You plan to spend $30,600 a year. Even in  │  the pair that carries the verdict:
│ a bad run of years the money can pay for   │  never folded (R7a)
│ about $48,200.                             │
│ ( Check the numbers behind this ↓ )        │  L2's button: filled when short or tight
└────────────────────────────────────────────┘
  Some of this uses our guesses: ... ›          the shell's row
┌ Money over the years ──────────────────────┐
│ [one line, phone size]                     │  the one drawing a first view may hold
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ What this answer rests on  3 our guesses ▸ │  L2's card: a row when on track, drawn
│ 5 more numbers                           ▸ │  open above the chart when short or tight
│ Retirement settings     2 set by you     ▸ │
│ How this is worked out                   ▸ │
└────────────────────────────────────────────┘
┌ More on this ──────────────────────────────┐
│ Year by year ›                             │
│ Chance the money lasts ›                   │
│ If history repeated ›                      │
│ What moves the answer most ›               │
│ How much to take out each year ›           │
└────────────────────────────────────────────┘
```

| part | inside | note |
|---|---|---|
| What this answer rests on | L2's rows: each number, whose it is, what one change would do | open by itself when the verdict is short or tight (that is an alarm, R7c) |
| 5 more numbers | the four tiles; "if markets do as well as average, $53,541"; "it lasts in N of 100 pretend futures" | the average case and the odds leave the hero |
| Retirement settings | the 7 boxes (title pinned by a test and a landing) | `?type=spending` passes `open: true`; status says what was changed, not only the spending figure |
| How this is worked out | today's "What goes into this" list with its links | L2 keeps it as a fold under its old name: one name with the other pages |

**To check when it lands:** (1) the hero holds two sentences and at most three figures; (2) "Could you stop sooner?"
is a link in the links card and is not shown to someone who has stopped working; (3) the links card has the five pages
the walk found missing and one name with the other 37 (the in-flight view heads it "Go deeper": section 8);
(4) when "What this answer rests on" is drawn as a fold, its own "N more numbers" fold would be a part inside a part
(R9): show its rows whole there; (5) its folds go through `part()` so they are remembered like the rest.

### 5.3 Assumptions (`system/assumptions`): form page. IN FLIGHT (L5).

**Today**: ten boxes in one card, Save at y=1830, 2.63 screens for everyone; an amber notice; a tile "0 Changed from
defaults"; one fold of sources at the end.

```
┌────────────────────────────────────────────┐
│ Assumptions                                │
│ What the plan takes for prices and markets.│
│ The usual figures are filled in.           │
└────────────────────────────────────────────┘
  ! You have not looked these over yet.         stays a notice (owner, 2026-09-15
    Saving marks them as reviewed.              round 17): not moved into a status
┌ The numbers ───────────────────────────────┐
│ How fast prices rise                       │
│ (2%) (3% usual) (4%) (Type my own)         │  chips first (L5 ships these)
│ Stocks grow each year                      │
│ (Careful 5%) (Middle 7%) (Hopeful 9%)      │
│ (Type my own)                              │
│ 8 more numbers       the usual figures   ▸ │  bonds, cash, the two swings, raises,
│ [ Save and mark as reviewed ]              │  retirement age, plan-to age, months
│ ( Reset to the usual figures )             │  of emergency fund
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ How this is worked out       10 sources  ▸ │  today's "Where these numbers come from",
└────────────────────────────────────────────┘  plus "stocks after inflation 3.9%"
┌ More on this ──────────────────────────────┐
│ Our guesses for you › · Will the money     │
│ last? › · The pages that use these ›       │
└────────────────────────────────────────────┘
```

| part | inside | status | opens by itself when |
|---|---|---|---|
| 8 more numbers | eight boxes, each with its one plain line and "Usual: 3%" | "the usual figures", then "2 set by you" (this replaces the tile "0 Changed from defaults") | `?show=<key>` names a box inside; a box inside fails its check |
| How this is worked out | the sources, one per number (owner: "all sources in one fold at the end") | "10 sources" | never |

Save writes all ten numbers whether the part is open or shut (the boxes hold values, not grey guesses): R16 holds.
`moreOptions(ctx, form, { keys, noun: "numbers" })` draws the "N more" title where every moved box is a number.

### 5.4 Net worth (`balance/net-worth`): list page, free for claude-b.

**Today** (family): four tiles (12 figures on the first screen), ten rows each with Edit, Delete and "as of
11/12/2026", "Over time" at the foot. 2.5 screens, 203 words, 22 figures, 20 row buttons.

```
┌────────────────────────────────────────────┐
│ $287,100                                   │  one figure as the headline
│ Net worth · +$30,100 since 1/1/2026        │
│ You own $572,700 and owe $285,600.         │  one sentence in place of two tiles
│ 2 more numbers                           ▸ │
└────────────────────────────────────────────┘
┌ Accounts ──────────────────────────────────┐
│ ( Update all balances at once )            │
│ What you own                               │
│ House                     (Edit) (Delete)  │  Edit and Delete stay on every row
│ Real estate                      $380,000  │  (owner, 2026-09-15 pass 2 round 4)
│ Ana's 401(k)              (Edit) (Delete)  │
│ 401(k) · Fidelity                 $86,000  │
│ Bo's old 401(k)           (Edit) (Delete)  │
│ Bo's Roth IRA             (Edit) (Delete)  │
│ 3 more accounts                          ▸ │  Brokerage, Ally savings, Chase checking
│ What you owe                               │
│ Mortgage                  (Edit) (Delete)  │
│ Car loan                  (Edit) (Delete)  │
│ Visa card                 (Edit) (Delete)  │
│ ( + Add another account )                  │
└────────────────────────────────────────────┘
┌ Over time ─────────────────────────────────┐
│ [ Save today's totals ]                    │
│ 1/1/2026                         $257,000  │  later: the first six, then "N more
└────────────────────────────────────────────┘  saved totals"
┌ More on this ──────────────────────────────┐
│ One account in detail › · Balance sheet ›  │
│ · Net worth in the years ahead ›           │
└────────────────────────────────────────────┘
```

| opt-in | inside | status | note |
|---|---|---|---|
| 2 more numbers | "Cash or easy to sell $33,700"; "Invested for later $177,000" with its split | none | a zero is still said in words (owner, round 4) |
| 3 more accounts | the rest of "What you own" | none | a row with "Our guess for now" is never among the hidden ones (`keep`) |
| the add form | Name, Type, Balance; then **More options · bank, date, whose** (Bank or firm, Balance as of, Whose account) | "bank, date, whose" | `?add=<type>` opens the form as today; an empty list keeps it open |

"as of" shows on a row only when its balance is more than a month old: a trim, not a fold. Expected first view: about
110 words and 12 figures in 9 rows (today 203 and 22), about 1.4 screens.

### 5.5 Expenses (`cashflow/expenses`): list page with an answer; a step of the path; free for claude-b.

**Today**: a fresh plan opens at one screen (53 words, 5 figures: the model). The family's opens at 2.27 screens
because the 13-bill list stands open (1,419 px); saving the one-number answer shuts that fold and opens the bill
list by itself (the page grew by 1,160 to 1,235 px in the skeptic's runs); Edit on one bill shows 8 boxes.

```
┌────────────────────────────────────────────┐
│ $5,826               $3,884                │
│ Per month            Left over each month ›│
│ $69,916 a year       after tax, bills and  │
│                      saving                │
│ Next year about $70,992 once prices rise.  │  the owner's one sentence (2026-09-16)
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ Set your month in one number             ▸ │
│ See or change each bill        13 bills  ▸ │
│ How this is worked out                   ▸ │
└────────────────────────────────────────────┘
┌ More on this ──────────────────────────────┐
│ Where the money goes › · Bills and regular │
│ payments › · Subscriptions ›               │
└────────────────────────────────────────────┘
  Next: Your debts ›                            now on the first screen
```

| part | inside | status | opens by itself when |
|---|---|---|---|
| Set your month in one number | the two chips "I know what's left over" / "I know what I spend", one box, "Save my month" | none, then "set by you" | just saved (and it no longer opens the bill list: R14) |
| See or change each bill (title named by a guide step and a test) | the two tiles, every bill with "Edit ›", "+ Add another expense" | "13 bills" | `?edit=<id>`; a save, edit or remove inside it; the guide's "open See or change each bill" |
| How this is worked out | new: the left-over sum with the person's own figures (comes in, tax, bills, saving), each a link | none | never |
| the bill form | What is it, Amount, How often; then **More options · category, dates** (Category, I must pay this, Goes up with prices, Starts, Ends) | "category, dates", then "2 set by you" | a box inside fails |

The change of habit: the list no longer opens because "most bills are typed"; it opens when the person opens it and
then stays open on their device. The existing test stays true (shut for guessed bills, open after a save, shut on a
fresh draw). Expected first view for the family: one screen, about 60 words and 5 figures (today 300 and 31).

### 5.6 Retirement contributions (`retirement/contributions`): list page. IN FLIGHT (L3 and L6).

**Today** (family): hero with 56 words and 4 figures, a match question with three buttons (86 words), "Against the
2026 limits" (6 figures), the list, the add button; 1.86 screens. A retired person gets a five-box form about "each
paycheck" and what "your employer adds".

```
┌────────────────────────────────────────────┐
│ $18,870 a year into retirement accounts    │
│ That is 11% of your pay, your employers'   │
│ money included.                            │
│ [ See if the money lasts › ]               │
└────────────────────────────────────────────┘
┌ Does Bo's job add money when Bo saves? ────┐  a question the plan needs: it stays
│ (Yes, it matches) (No match) (An old job)  │  (L3 rewrites it)
└────────────────────────────────────────────┘
┌ Contributions ─────────────────────────────┐
│ Ana's 401(k)               $15,270 a year  │
│ Ana · $470 every two weeks         Edit ›  │
│ Bo's Roth IRA               $3,600 a year  │
│ Bo · $300 every month              Edit ›  │
│ ( + Add another contribution )             │
│ 2 more numbers                           ▸ │  room left under this year's limits
│ How this is worked out                   ▸ │  how "11% of your pay" and "lasts" are reached
└────────────────────────────────────────────┘
┌ More on this ──────────────────────────────┐
│ Contribution limits › · Paycheck › · Work  │
│ benefits ›                                 │
└────────────────────────────────────────────┘
```

For a retired person with nothing going in: one card, "You're retired, so nothing goes in now", and an outlined
"+ Add a contribution" that opens the form. That narrows "an empty list keeps its add form open" to pages that apply
to the person; it is a reading for the owner to confirm (section 8). The add form has five boxes, which is inside
R5: no "More options" is needed there.

### 5.7 Settings (`system/settings`): settings page, free for claude-b.

**Today**: "Plan basics" (3 boxes and the only filled button on the first screen), "Pages" (18 topic rows, 158
switches inside), "Your data", "Advanced". 1,927 px shut, 10,639 px with everything open. The order is the owner's
(2026-09-15 round 6) and stays; the owner's own request was that "the everyday Settings screen is short".

```
┌────────────────────────────────────────────┐
│ Plan basics          name and currency   ▸ │
└────────────────────────────────────────────┘
┌ Pages ─────────────────────────────────────┐
│ Every page is on.                          │  or "3 pages are off."
│ Switch pages on or off       18 topics   ▸ │
│ Parts you opened stay open on this device: │  only when the number is above zero
│ 7 now.                 ( Shut them all )   │
└────────────────────────────────────────────┘
┌ Your data ─────────────────────────────────┐
│ Last changed 11/12/2026 · 10 accounts ...  │
│ [ Download a copy ] ( Restore from a copy )│
│ ( Erase the copy on this device )          │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ Advanced         Not needed day to day   ▸ │  as today, last
└────────────────────────────────────────────┘
```

| part | kind | inside | status |
|---|---|---|---|
| Plan basics | own, named | plan name, currency, number and date format, Save | "name and currency" |
| Switch pages on or off | own, named | today's 18 topic rows, each still opening to its switches with "8 of 8 on" and the pills (R9's second exception: a list whose rows open) | "18 topics", or "3 pages off" |
| Advanced | tech | as today: connection, helper, "What is still being built" (the qa script taps these words) | "Not needed day to day" |

Expected: about 720 px, under one screen, no box before a tap (today 1,927 px and 3 boxes). Folding "Plan basics"
keeps its place as the first card; it is still a change to a card the owner reviewed, so it goes to a design review
with a screenshot before it lands.

### 5.8 A long form: "Add a rental" on Rental analysis (`property/rental`), free for claude-b.

**Today**: 21 boxes in one form (1,923 px), one of them required, five on the first screen, nothing marked optional.
The page cannot answer without three of them: what it is worth, the rent, and (to be useful) the two big yearly costs.

```
┌ Add a rental ──────────────────────────────┐
│ Name               [ e.g. Duplex on Elm  ] │
│ What it is worth today      [ $          ] │
│ Rent a month                [ $          ] │
│ Property tax a year         [ $          ] │
│ Insurance a year            [ $          ] │
│ More options   other costs, the loan     ▸ │
│ [ Add rental ]                             │
└────────────────────────────────────────────┘
```

Inside "More options" (about 13 boxes, three small headings, no part inside):
- **Other costs**: association dues, utilities you pay, other costs a month.
- **The loan**: "Its mortgage" (pick the one on Net worth, or "not listed"); only "not listed" shows loan owed, rate
  and payment (a box that appears after a choice, as Debts' escrow box does today).
- **What we assume** (the usual figures, already filled in): empty months, repairs and upkeep, a property manager,
  how fast the value grows.
- **For the tax write-off**: which home on Net worth this is, what you paid, when it was first rented out, the
  land's share of the price, cash you put in.

Status: "other costs, the loan" until something inside is the person's, then "3 set by you". A box inside that fails
opens the part (walked on a test form). When editing a rental the part opens only if the person opened it before on
this device: the status tells them what is in it. None of the moved boxes shows a grey guess; the percent boxes hold
the usual figures as values, so Save writes the same with the part open or shut (R16).

The same recipe, in order of use, for the forms the walks counted: a bill (8 boxes, 2 required), income (9, 2), a
holding (9, 3), a policy (12, 1), the home's details (10, 0), an account (6, 2), a pension (9), a person (5).

### 5.9 In short: Year by year (`retirement/cash-flow`), the longest list

Today 5.28 screens, 920 words and 212 figures: 31 year rows of about seven figures. After: the hero's sentence, the
two pickers (they choose a view and never touch the plan: they stay), the first six years, then "25 more years"
(`rest()`), with the owner's one collapsed row for the years with nothing left kept as it is, and a link "Get this
as a table" to Export. The person who always wants all 31 rows taps once and has them from then on.

### 5.10 In short: Debts (`balance/liabilities`), the most figures on a first screen of the walked pages

Today 20 figures on the first screen: four tiles and three rows that each read like "6.3% · paid off by January 2046
if you keep paying $1,980 a month, March 2039 on your payoff plan · $190,195 interest to come". After: the headline
"You owe $285,600" with one sentence, "3 more numbers" (paying each month, interest each month, payments against
income), the amber line about the costly card with its button (an alarm and the action: never folded), each debt as
"Visa card · 23.9% · paid off by July 2028 · $6,400 · Edit ›", and the rest of each row's sentence in "How this is
worked out". About 9 figures.

---------------------------------------------------------------------------------------------------------------------

## 6. The build plan

### 6.1 For every commit

- The builder's start-of-block reading first (`docs/WORKBOARD.md`, `docs/TEAM.md`, `docs/FEEDBACK.md`), then a claim
  row in `docs/TEAM.md` for the pages of that commit, removed when the commit is on the shared branch.
- One page or one small family of pages per commit: `view.js`, the README (what is on the first view, what each part
  holds), the module test (it reads "outside the parts" and "inside part X"), the page's entry in
  `tests/first-view.known.json` lowered, one CHANGELOG line.
- `npm test && npm run check` green; `node tools/shot.mjs <group>/<id>` at 390 and 320, light and dark, and the
  pictures read (rule 13); the page walked once in the sandbox: open a part, reload, Back, save inside a part.
- `main` moves only by `git push` through the gate (rule 16). `core/ui/more.js` is a new file that pages import, so it
  is on `main` before, or in the same push as, the first page that uses it.
- No `compute.js` changes. No plan field. Nothing a view prints is deleted: it moves.

What one page costs, from the prototype: `taxes/federal` took +72 and -37 lines in `view.js`, four exact-wording
pins to update in three test files, and one decision that was not about folding at all (what the headline is).

### 6.2 Commits in order

| # | commit | files | depends on | who can do it |
|---|---|---|---|---|
| 1 | The helper and its memory | new `core/ui/more.js` (the prototype's 190 lines, plus the three specified pieces: `keep` in `rest()`, `noun` in `moreOptions()`, `choice()`); new `tests/more.test.mjs` (the 11 prototype tests plus one for each specified piece); new `docs/OPTIONAL.md` (sections 1 to 3 of this report as the rule book); `docs/DATA_MODEL.md` "Not in the plan" gains `planner.opened`; `AGENTS.md` design rule "Simple first" gains "(rules and helper: `docs/OPTIONAL.md`)"; `modules/_template/view.js` and its README show one `parts()` call | nothing | claude-b |
| 2 | The budget check | new `tests/first-view.test.mjs`, `tests/first-view.kinds.mjs`, `tests/first-view.known.json`, `qa/first-view-node.mjs` (the `--write` tool), `qa/first-view.mjs` (browser); additive gaps in `qa/fixtures/fake-dom.mjs` (`insertBefore`, `before`, `CSS.escape`, a `select`'s first value) so `CANNOT_DRAW` starts shorter than nine | 1 | claude-b |
| 3 | Federal estimate | `modules/taxes/federal/{view.js,README.md,module.test.mjs}`, the two source-text pins in `tests/wording-left.test.mjs` and `tests/wording-review.test.mjs`; with lessons 5 and 10 of section 5.1 applied (split the working, withheld-so-far box first, the child care hint on the first view) | 1, 2 | claude-b |
| 4 | The path's free step and result pages, one commit each | `cashflow/expenses` (5.5), `balance/net-worth` (5.4), `debt/payoff`, `balance/liquidity`, `insurance/life-needs`, `retirement/withdrawal-strategy`, `retirement/rmd`, `goals/house`, `goals/education`, `goals/goals` | 1, 2 | claude-b |
| 5 | The most used forms get "More options", one commit each | the bill form (with 4), the account form (with 4), `cashflow/income`, `balance/liabilities` (5.10), `investments/holdings`, `insurance/policies`, `household/people`, `retirement/pensions`, `balance/assets` | 1, 2 | claude-b |
| 6 | Settings | `modules/system/settings/{view.js,README.md,module.test.mjs}`: the first view of 5.7, the memory line with "Shut them all", "Erase the copy on this device" also clears `planner.opened`; `qa/` scripts that tap Settings words re-run | 1; a design review of the folded "Plan basics" | claude-b, with the designer |
| 7 | Heavy answer pages, topic by topic (6.3) | 60 or so pages | 1, 2 | claude-b |
| 8 | Long lists and tables | `rest()` on `retirement/cash-flow` (5.9), `taxes/projection`, `transactions/ledger`, `debt/mortgage`'s schedule, `investments/glide-path`, the Over time list on Net worth | 1 | claude-b |
| 9 | After the retirement request lands: its pages checked, not redone | `retirement/projection` (5.2), `system/assumptions` (5.3), `retirement/contributions` (5.6), `scenarios/goal-seek`, `scenarios/sensitivity`, `estate/legacy`, `career/benefits`, `ai/reader`, `transactions/import`: hand-written folds become `part()` calls, the five checks of 5.2, `KNOWN` entries lowered | that request on the shared branch | claude-b |
| 10 | After wave 1 lands: join the two | three lines in `docs/CONVENTIONS.md` that point to `docs/OPTIONAL.md`; the summary's inline style moves into `core/ui/base.css`; `core/ui/dom.js` may re-export the helper (`ui.part`) and give `ui.form` a `more` option that calls `moreOptions()`; `tests/place.test.mjs` gains the agreement cases of 2.4; `overview/pages` | wave 1 on the shared branch | claude-b |
| 11 | After claude-f's claim rows go (stale from 2026-11-13 02:46 UTC, or closed by claude-f) | the 11 pages of 6.5, the Dashboard first; `modules/overview/guide/journeys.js` only if a pinned title must change (none does in this plan) | the rows gone | claude-b, or claude-f from the hand-over |
| 12 | The hand-over for claude-a | new `docs/handoffs/2026-11-12-optional-claude-a.md` (6.4) and one workboard line `claude-b -> claude-a` | 1, 2 | claude-b writes it; claude-a builds |

Commits 1 and 2 change nothing a person sees. Commit 3 is the first visible one and is already built.

### 6.3 Commit 7 in batches: the free pages, heaviest topics first

From the Node counter at the tip, with my first-cut kinds: of the 117 free pages that draw, **74 are over their
budget**. Over budget / drawn, by topic: balance 6/6, career 6/6, debt 5/5, estate 5/5, goals 4/4, taxes 5/6,
property 5/6, insurance 5/6, retirement 12/16, cashflow 7/11, investments 5/11, scenarios 2/3, overview 2/4,
ai 2/6, household 1/3, system 1/5, transactions 1/8, reports 0/6 (no word budget).

| batch | pages (worst household: words / figures / boxes on the first view today) | what the work mostly is |
|---|---|---|
| 7a taxes | `taxes/capital-gains` (408 / 36 / 6, 7 tiles), `taxes/estimated` (424 / 30 / 6, 3 filled buttons), `taxes/brackets` (266 / 60, 7 tiles), `taxes/hsa-fsa` (422 / 7 / 7) | the April answer first, as on Federal estimate; tiles to four; boxes into "Set my own numbers" |
| 7b debts | `debt/mortgage` (349 / 66 / 2), `debt/credit-cards` (278 / 36), `debt/refinance` (4 boxes), `debt/ratios` | the payment table behind "N more years"; one answer per card |
| 7c retirement | `retirement/medicare` (625 / 61), `retirement/longevity` (249 / 15 / 4), then social-security, withdrawal-order, roth-conversions, monte-carlo, historical, sequence-risk, healthcare, fire, buckets, annuities (6 boxes) | answer and one sentence; tables to "The figures"; the working last |
| 7d property and goals | `property/rent-vs-buy` (345 / 20 / 17), `property/home` (294 / 26 / 10), `property/purchase` (210 / 14 / 8), `property/rental` (5.8), vehicles, renovation; `goals/prioritizer` | chips or the plan's own figures first, "Set my own numbers" for the 8 to 17 boxes |
| 7e career | `career/offer-compare` (325 / 5 / 18), `career/business` (555 / 32 / 6, 2 filled), `career/salary` (444 / 37, 6 tiles), `career/side-income` (297 / 8 / 12), `career/equity` (12 boxes, 2 filled), `career/human-capital` | long forms to five boxes and "More options" |
| 7f investments | `investments/risk` (445 / 61), `investments/glide-path` (303 / 50), `investments/backtest` (335 / 33), `investments/limits` (430 / 32), then allocation, rebalance, fees, performance, dividends, asset-location, tax-lots, employer-stock, crypto | tables to "The figures" |
| 7g insurance and estate | `insurance/policies` (12 boxes), term-vs-permanent, cash-value, disability, health, ltc, property; `estate/beneficiaries` (6 filled buttons), `estate/gifting` (6 boxes), estate-tax, inheritance, digital | one filled button; forms to five boxes |
| 7h the rest | `scenarios/stress-tests` (919 / 29, 20 tiles), `scenarios/advisor-plan` (16 boxes), `scenarios/compare`; `cashflow/budget-percent` (282 / 35), budget, recurring, forecast, sinking-funds, subscriptions, spending, income-statement, paycheck; `overview/quick` (489 words), benchmarks, timeline; `household/life-events` (6 filled buttons), the other household pages; transactions; ai; reports (structure checks only) | by count |

The order inside a batch is the page's distance over its budget. A page that is inside its budget is still opened
once: its hand-written folds become `part()` calls so that they are remembered and named like the rest (S10).

### 6.4 Hand-over for claude-a: 13 pages claude-b may never edit

One file, `docs/handoffs/2026-11-12-optional-claude-a.md`, in the form of `docs/handoffs/2026-11-11-touch-claude-a.md`:
"How to work through it" on top (read `docs/OPTIONAL.md`; import the helper; the eight steps of 2.10), then one item
per page with "Now", "Should", "Cause" (file and line) and a proposed fix, and one workboard line that names the
file. The check lists these folders as `CLAUDE_A_LANE`: over-budget counts print as to-do and stay out of the
only-down totals, so a silent lane (the last message is from 2026-10-30) blocks nothing.

What the Node counter sees on them at the tip (worst of three households; I read their card titles, not every line):

| page | title | words / figures / boxes / tiles / filled | kind | what the rules ask for |
|---|---|---|---|---|
| `balance/statement` | Balance sheet | 412 / 54 / 0 / 0 / 1 | report | a report by nature: no word budget; give it the links card and "The figures" only if it grows a second table |
| `cashflow/statement` | Cash-flow statement | 223 / 20 / 0 / 0 / 1 | report | the same |
| `balance/projection` | Net worth projection | 255 / 37 / 0 / 3 / 0 | answer | the headline year and figure; "Along the way" and "What makes it up" become "The figures" and "N more numbers" |
| `goals/charitable` | Giving | 270 / 18 / 3 / 2 / 1 (empty plan 239 / 14 / 3) | answer | the empty plan shows 239 words and 14 figures: one sentence and one way to start; "Give the same, pay less" is the working |
| `taxes/self-employment` | Self-employment | 206 / 18 / 0 / 2 / 1 | answer | "Pay it during the year" stays (it is the action); "Shelter some of it for retirement" becomes a link or a part |
| `debt/consolidation` | Consolidation | 172 / 26 / 0 / 2 / 1 | answer | "Each way, until debt-free": the best way as the answer, the other ways in "The figures" |
| `goals/emergency-fund` | Emergency fund | 210 / 7 / 0 / 2 / 1 | answer | "Where to keep it" becomes "How this is worked out" or a link; 50 words to move |
| `taxes/documents` | Tax documents checklist | 303 / 2 / 0 / 2 / 0 (empty plan 170) | list | first six documents, then "N more documents"; the empty plan gets one sentence |
| `taxes/state` | State tax | 143 / 9 / 0 / 2 / 0 | answer | one figure over; "How it is worked out" takes the shared title "How this is worked out" and joins "On your federal return" and "Paid so far" in one card of rows |
| `taxes/filing-status` | Filing status compare | 145 / 7 / 0 / 2 / 0 | answer | inside the budget; "What filing separately gives up" and "Head of household" become rows |
| `goals/travel` | Travel and events | 73 / 0 / 9 / 0 / 1 | list | nine boxes on an empty list: five, then "More options" |
| `debt/student-loans` | Student loans | 53 / 0 / 0 / 0 / 1 (no loans in the three households) | answer | not measured with loans; "The rules as of 2026" is "How this is worked out" |
| `goals/vehicle` | Vehicle | drew nothing in Node | answer | first make it draw in the stand-in; "The 20/4/10 rule" is "How this is worked out" |

Seven of the thirteen end with a card headed "Next". Under these rules that is the links card, which has one name
across the app (section 8). It goes into the hand-over as one item, not seven.

### 6.5 Hand-over for claude-f: 11 pages under its claim

These are the pages a person sees most. They are held by `docs/TEAM.md` rows that go stale on 2026-11-13 02:46 UTC.
If claude-f is running by then it gets this list as a hand-over file of the same form; if not, claude-b writes one
workboard line to claude-f and claude-r, takes the rows over and builds them as commit 11.

Counts are the Node counter's at the tip, worst of three households; the parts named are the pages' own headings.

| page | kind | words / figures / boxes / tiles / filled today | what the rules ask for |
|---|---|---|---|
| `overview/dashboard` | answer | 200 / 11 / 0 / 4 / 1 | its first screen is the model the budget was taken from (103 words, 8 figures); the whole unopened page is 40 words and 3 figures over: what stands under the next move is where to look, with the designer |
| `overview/next-best-action` | answer | 660 / 37 / 0 / 0 / 1 | the first move whole; "The order" after its first three rows as "N more moves"; "Each month's money" as "N more numbers"; its fold "Why this order" takes the shared title "How this is worked out" |
| `overview/health-score` | answer | 491 / 17 / 0 / 0 / 0 | the score and the two parts that pull it down most; "All seven parts" as "5 more numbers"; "How the score is worked out" takes the shared title |
| `taxes/withholding` | answer | 383 / 14 / 4 / 4 / 2 | one filled button (it has two); the boxes stay in "What a paycheck withholds", a named part whose title a guide step names, shut until the step or the person opens it; "How the W-4 works now" becomes "How this is worked out"; "Each return" becomes "The figures" |
| `estate/documents` | list | 370 / 0 / 0 / 0 / 27 (empty plan: 15 filled) | twenty-seven filled buttons: one filled, the rest outlined; the first six documents, then "N more documents" |
| `overview/guide` | settings | 316 / 0 / 0 / 0 / 0 (empty plan 239) | the guide for the person's stage first; "Other places to start" as rows of one card |
| `overview/plan` | answer | 266 / 5 / 0 / 0 / 1 | the verdict and "What to do next" stay; "What we're counting on" stays where it carries guess marks (R7); "Make it fit you better" and "Keep it up to date" as rows |
| `overview/alerts` | list | 265 / 11 / 0 / 0 / 0 (empty plan 114) | alarms are never folded (R7); "Fine for now" and "Housekeeping" are the parts ("4 fine for now") |
| `overview/monthly-review` | form | 209 / 3 / 1 / 0 / 1 | nine words over a form's budget: a trim; "Months checked in" after six rows as "N more months" |
| `overview/start` | settings | 170 / 0 / 0 / 0 / 1 | inside the budget |
| `overview/guesses` | settings | 71 / 0 / 0 / 0 / 0 | inside the budget; its groups are a list of rows that open (R9's exception) and go through `part()` to be remembered |

`modules/overview/guide/journeys.js` names part titles in its steps ("Figures the plan cannot see" on Federal
estimate, "What a paycheck withholds" on Withholding check, "See or change each bill" on Expenses). This plan keeps
every title a step names, so that file needs no change.

### 6.6 What "done" means for the whole request

- `tests/first-view.known.json` holds no page outside claude-a's lane, or each remaining entry has a one-line reason
  in `tests/first-view.kinds.mjs` (a report; a page whose answer is a table).
- `CANNOT_DRAW` is empty.
- No view outside claude-a's lane writes a `<details>` by hand (S10 for every view, not only touched ones), and the
  links cards have one name.
- The designer's review has seen the first view of every path page at 390 px, and the tester's round has opened
  every part of every page once in the sandbox.

---------------------------------------------------------------------------------------------------------------------

## 7. Risks, and what would make me drop this design

### 7.1 Risks

| # | risk | how likely, from what I saw | what limits it | what I would watch |
|---|---|---|---|---|
| 1 | **Pages drift open.** A person opens parts over weeks and the short page is gone. | Real: with "4 more numbers" left open the family's first screen holds 12 figures again. | Only their own tap is remembered; only five kinds are kept (`KEPT`); an entry is forgotten 90 days after that part was last seen; parts sit after the answer in a fixed order, so an open part never pushes the answer down; Settings shows the count with "Shut them all". | A design review that finds the owner's own phone long again. |
| 2 | **A detail lover pays a tap per part.** Up to 70 taps across the fourteen walked pages, where a switch costs one. | Certain; it is the price of this stance. | Each tap is made where the person wanted that part; nothing is ever in one mode only; a device preference is ten lines later (2.12). | The owner saying "I want one switch", or a review showing the same part opened on page after page. |
| 3 | **The wrong thing is folded.** A check counts words, not meaning. | Happened once in the prototype: the child care hint ended up inside the working. | R7's never-folded list; S5; rule 13's screenshot; the designer's review of path pages. | A tester's finding of the form "I could not find X". |
| 4 | **Pinned words break.** Tests and guide steps name titles and sentences. | Certain: four pins on one page. | Titles a step or test names are kept (section 6.5); sentences move whole; tests are rewritten to "outside" and "inside part X" in the same commit. | `npm test` after each page; the guide's steps are read by `modules/overview/guide/module.test.mjs` and `tests/followups-path.test.mjs`. |
| 5 | **Two stand-ins draw views in tests**, and a helper that needs a real DOM crashes one of them. | Happened. | The helper builds with `ui.h` only and every DOM call is optional; `tests/more.test.mjs` runs it under both. | A new test file with a third stand-in. |
| 6 | **"How this is worked out" becomes a dumping ground.** | Happened: 1,560 px on the prototype. | R11 (1,300 px) measured in the browser check; what does not fit moves to a deeper page, linked. | The browser check's height column. |
| 7 | **The Node count is not perfectly still.** | Seen once: 254 against 250 words on one page. | Ceilings rounded up to the next ten; the "lower me" line is a note, not a failure. | A flaky failure in CI: then the late-drawing page gets a settled wait in the test's `ctx`. |
| 8 | **Thirteen pages stay as they are** (claude-a's lane), and eleven wait for a claim to go. | Certain for a while. | Inline parts promise nothing about other pages, so a page not yet redrawn is only longer, never wrong; the check reports that lane as to-do. | The hand-over file unanswered for weeks: then the lead decides who takes the lane. |
| 9 | **The part's marker is the link's marker.** "›" at the right edge means "opens here" on a part and "goes away" on a link row. | Seen in every screenshot; nobody was confused in my walk because I knew. | Parts and links never share a card (R10: parts card, then links card); the marker turns down when open. | The designer's call (section 8): a different mark for parts is a one-line change in the helper. |
| 10 | **Safari forgets.** Site storage unused for seven days of use can be deleted; a private window has none. | Known behavior, not tested here. | Losing the memory only makes pages short again, one at a time; nothing else depends on it. | A person saying "it keeps shutting": then say so on the Settings line. |
| 11 | **Screen readers.** The summary is `display: block` with an inner flex row, because some displays of `summary` lose "collapsed / expanded" in VoiceOver. | Checked in Chrome's accessibility tree only: each row is a disclosure named "Figures the plan cannot see none typed" with expanded false, then true after a tap; Enter on the keyboard opens it and it is remembered. | Native `<details>`: state and role come from the browser, not from script. | VoiceOver on a real iPhone (section 8). |
| 12 | **Find-in-page.** Chrome opens a shut `<details>` that holds the match; Safari opens it but does not scroll to it (WebKit bug 304174, open). | Not drivable headless; from the skeptic's check. | Nothing is removed from the DOM unless a part is lazy, and lazy is for long tables only (2.7). | The app's own search finding a page by a word that is inside a part: `core/search.js` is wave 1's. |
| 13 | **The budget numbers are mine.** | Certain. Four tiles and "one sentence" are the owner's; the rest are sizes that fit one phone screen. | One table in one file; the owner can tighten any of them and the check follows. | The first ten redrawn pages: if most need the same exception, the number is wrong, not the pages. |
| 14 | **Two efforts land around this one** (wave 1 and the retirement request) and write folds by hand. | Certain. | The helper touches none of their files; commits 9 and 10 convert their folds after they land; wave 1's memory and this one agree by construction (2.4: the visit's memory puts back only what the page did not decide, and the device's memory is part of what the page decides). | `tests/place.test.mjs` with the agreement cases. |

### 7.2 What would make me change it, short of dropping it

- **Memory confuses people** ("why is this page long on my phone and short on yours?"): empty `KEPT`. Parts are then
  remembered for the visit only (wave 1's memory already does that), and the Settings line goes. One line.
- **A habit shows** (the same kind of part opened everywhere): add the device preference the research proposed, for
  that kind only ("Always show how answers are worked out"), beside the Settings line. Ten lines in `part()`.
- **People miss what they need** (taps on parts on nearly every visit to a page): that part belongs on the first
  view; raise that page's first view, not the budget.
- **People never open a part** on a page: its content was not worth keeping there; move it to a deeper page.
  (The app has no analytics and should not grow any for this; both of these come from reviews and the owner's use.)

### 7.3 What would make me drop it

1. **The owner asks for a switch or a mode in so many words.** The request says "toggles", and I read that as
   per-part toggles ("subtle optional complexity"). If the owner meant one control for the whole app, the mode design
   is the answer to the request and this one is not. The helper survives either way: a mode would be one more input
   to the single place where "shut by design" is decided.
2. **The first ten redrawn pages cannot be made to hold their answer in the budget without hiding something from
   R7's list.** That would mean the app's pages are not "an answer plus detail" but "many answers", and the right
   move is splitting pages (more, smaller pages: AGENTS.md already prefers that), not folding.
3. **A first-time person cannot do a page's job without opening anything**, on more than one or two of the path
   pages, in a real review. The research's cheap test is the one that counts; the budget is only its proxy.
4. **VoiceOver on a real iPhone does not announce a part's state**, and no markup of native `<details>` fixes it.
   Then the helper falls back to a button with `aria-expanded` and a region; the rules and words stay, the
   find-in-page and print behavior get worse, and I would rather know before 100 pages use it.
5. **The check proves too noisy to keep**: if `KNOWN` has to be regenerated for reasons other than a redraw more
   than now and then, people will stop reading its diff, and an unread check is worse than none. Then keep the
   structure checks (S1 to S11), drop the counts, and rely on screenshots.

---------------------------------------------------------------------------------------------------------------------

## 8. Decisions that are not mine, and what I did not verify

### 8.1 For the owner or the lead

| # | decision | why it is theirs | my recommendation | cost of the other answer |
|---|---|---|---|---|
| 1 | **Per-part memory and a "Shut them all" line, or one device switch.** | The workboard (2026-11-12 14:55) announced "one device setting for people who always want the detail"; the research recommends it; my brief was to argue against it. | No switch now (2.12). Build the parts; add a preference later if a review shows the habit. | A switch now: every page reviewed and tested in two states; 13 pages that do not follow it on day one. |
| 2 | **The links card's name.** "More on this" is the owner's (2026-11-06) and heads 37 views; the builder's reading of 2026-11-12 and the in-flight Will the money last? view say "Go deeper". | Two names for one thing is the kind of drift this request is about; one of them is an owner decision. | Keep "More on this" everywhere unless the owner picks "Go deeper"; either way one scripted rename, in one commit. | None beyond the rename. |
| 3 | **The budget numbers** (1.2). | They decide how much every page shows; only "four tiles and one sentence" is the owner's. | Start with mine; tighten after the first ten pages. | Tighter: more pages split; looser: less change. |
| 4 | **May a page that does not apply to someone fold its empty add form?** (Retirement contributions for a retired person, 5.6.) | The owner chose "an empty list keeps its add form open" (2026-09-15). | Yes, where the page can say in one sentence why it does not apply; otherwise the form stays open. | The retired person keeps meeting a five-box form about paychecks. |
| 5 | **Folding "Plan basics" on Settings** (5.7). | The owner reviewed that card and its place. | Fold it, first in the order as now; show the designer a screenshot first. | Settings' first view keeps three boxes and is about 300 px longer. |
| 6 | **The part's marker** (risk 9). | The designer's lane. | Keep "›" turning down for now; decide with real pages in front of the designer. | One line in the helper. |

Nothing in this report re-proposes a choice the owner declined: Delete stays beside Edit on Net worth rows; "Plan
basics" stays first; the Assumptions review status stays a notice; nothing new is fixed to the bottom of the screen;
there is one filled button per view.

### 8.2 Not verified

- **VoiceOver or TalkBack on a real phone.** I read Chrome's accessibility tree only (each part is a disclosure
  with its title and status as the name and the right expanded state).
- **Find-in-page**, in any browser: it cannot be driven headless. The Safari behavior is from the skeptic's reading.
- **Printing from Safari**, and from the Home Screen app. The `beforeprint` path and a real PDF were checked in
  headless Chrome.
- **Safari's seven-day storage rule** on the owner's phone link. Read, not observed.
- **The other 150 pages.** The Node counter drew them; I redrew eight on paper and one in code. The kinds map is a
  first cut by hand and will be wrong for some pages (the two statements in claude-a's lane are reports, for one).
- **Wave 1 and the retirement request as landed.** I read their plans, patches and work trees, not a merged tip.
  The agreement in 2.4 is argued from `core/place.js` as written in `w1/build-place`, and is not yet a test.
- **Whether other sessions wrote to the repo** after commit 737fb6a, the base of my worktree.

---------------------------------------------------------------------------------------------------------------------

## 9. Files

All under `$SP/opt/`.
Nothing was written to `$REPO` or to the read-only worktree `opt/app`.

| what | path |
|---|---|
| this report | `$SP/opt/design-inline.md` |
| the prototype worktree (detached at 737fb6a; left in place; no server running) | `$SP/opt/proto-inline` |
| the helper (new, 190 lines) | `$SP/opt/proto-inline/core/ui/more.js` |
| the redrawn page (+72, -37) | `$SP/opt/proto-inline/modules/taxes/federal/view.js` |
| screenshots: `before-federal-*`, `after-federal-*`, `final-numbers-open.png`, `walk-02` to `walk-15`, `walk-11-print.pdf`, `dark-federal-family*.png` | `$SP/opt/proto-inline-shots/` |
| the helper's 11 Node tests (`ROOT=<worktree> node --test more.test.mjs`) | `$SP/opt/inline-work/more.test.mjs` |
| the Node first-view counter and its kinds and budgets | `$SP/opt/inline-work/first-view.mjs`, `.../inline-work/fv-report.mjs` |
| its output at the tip, on the prototype, and the first `KNOWN` | `.../inline-work/fv-tip.json`, `.../inline-work/fv-proto.json`, `.../inline-work/fv-tip-known.json` |
| the ranking of free pages and the two hand-over tables | `.../inline-work/worst.mjs`, `.../inline-work/handover.mjs` |
| the browser counter and the before and after measurements (six households, and one at 320 px) | `.../inline-work/lib.mjs`, `.../inline-work/before.mjs`, `.../inline-work/before.json`, `.../inline-work/after.json` |
| the touch walk and its log | `.../inline-work/walk.mjs`, `.../inline-work/walk.json`, `.../inline-work/walk.log` |
| part heights, everything open, the guide step, dark mode and the accessibility tree | `.../inline-work/heights.mjs`, `.../inline-work/allopen.mjs`, `.../inline-work/guide.mjs`, `.../inline-work/dark-ax.mjs` |
| the repo's own checks on the prototype | `.../inline-work/npm-test2.log` (189,407 tests, 4 fail, all wording pins of this page), `.../inline-work/npm-check.log` (OK) |

(`.../` stands for the folder named in the first line of this section.)
