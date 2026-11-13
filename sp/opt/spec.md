# Spec: simple first, depth on request (for claude-b)

Written 2026-11-13 for claude-b, who builds it and decides without asking the owner (choices are written down as the
builder's, in the page READMEs and one `docs/DESIGN_LOG.md` entry marked "Builder chose", never "Owner chose").
Base: the shared branch at `707355c`, plus wave 1 of the touch stress test as integrated in
`$SP/w1/integ` (`6b755d4`:
`core/place.js`, the `ui.form` field option `more: true` with "More details (optional)", `ui.setMoreOpen`, the
presentation keys, `ctx.redraw`, `ui.reveal`, `data-no-keep`). Nothing in `$REPO`, in `w1/integ`
or in any prototype worktree was edited. One measurement was run read-only on the branch tip (the Node first-view
counter, section 5.2); no server was started.

`$SP` = `$SP`. `$O` = `$SP/opt`.

Read for this spec: `$O/census.md`, `inventory.md`, `research.md`, `walks.md`, `constraints.md`, `verify-code.md`,
`verify-web.md`; the designs `design-inline.md`, `design-dial.md`, `design-stages.md` and their prototypes; the judges
`judge-less.md` (the layperson), `judge-more.md` (the detail lover), `judge-owner.md` (the owner's words),
`judge-build.md` (the maintainer); `$SP/w1/plan-place.md`, `plan-forms.md` and the wave 1 code; `$SP/rv/spec.md` (the
retirement request); `docs/TEAM.md` and `docs/WORKBOARD.md` at `707355c`. Working files of this spec:
`$O/spec-work/` (`digest.json`, `digest.txt`: every usable page's counts and cards; `final.mjs`: the classes of
section 6; `fv-707355c.json`: the counter's output at the tip).

The owner, verbatim. 2026-11-12: "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of
complexity. Default to less is more and allow more complexity or toggles. We want subtle optional complexity".
2026-11-13: "Continue. I want you to make sure that there is no stone left unturned. There should be complete
optionality, and there should not exist a single other application in the entire internet, that doesn't have the
functionality or optionality of this application. Now, it is extremely important to keep in mind that it should stay
simple by default. There should be ways for you to upgrade the complexity and the depth of it, and it should also flow
fluid and easy to understand for a human user." 2026-11-11: "After we finish the initial setup of, okay, we're going to
do a big picture. Once we're in the big picture, you can delve deeper and get better analytics and your results" and
"user experience is key, and it should also provide valuable insights, right? It's got to be valuable."

---------------------------------------------------------------------------------------------------------------------

## 0. The spec in fifteen lines

1. **Build inline**, the design no judge ranked last (scores 7, 7, 8, 8 = 30; dial 24; stages 21), with eleven grafts
   named in 1.3. Every page opens with its answer and one action; everything else is a quiet row under the answer that
   opens in place.
2. **One new file**, `core/ui/more.js`: `part`, `parts`, `rest`, `choice`, `links`, `statusOf`, the device store
   `detail` and the per-part store `kept`. One localStorage key, `planner.more` (`planner.more.sandbox` in the sandbox).
3. **Forms use wave 1's kit**: `more: true` on a field, the line "More details (optional)"; inline's `moreOptions()`
   and its "More options" label are dropped.
4. **The owner's "toggles" has a visible answer**: Settings gets a card, "How much to show", second after Plan basics,
   with two switches, both off by default, on this phone only: **"Show how answers are worked out"** (depth: opens every
   "How this is worked out" and every "N more ..." row) and **"Show every box in forms"** (complexity: opens every
   "More details (optional)", through wave 1's ready `ui.setMoreOpen`). Neither ever opens a part that holds its own
   Save, so neither can draw a second filled button.
5. **The hand beats the switch**: open or shut is decided in one order: a reason now (an error, a save, a landing, a
   guide step), then the person's own last tap on that part, then the switch, then shut.
6. **Memory is narrowed**: only reading parts ("N more ...", "How this is worked out") remember a tap across visits, for
   90 days unseen; parts with boxes are kept for the visit only (wave 1) and come back shut saying "1 set by you".
   Settings says how many parts this phone keeps open, with "Shut them all".
7. **Never folded**: the answer, the one filled action, every alarm and error, every guess mark, every confirmation, a
   hint worth money, a guide step's box, a required box, a box showing our guess, and what the owner already chose.
8. **Budgets per kind of page** (answer 160 words, 8 figures; list 240, 16; form 5 boxes; settings 200 words, 3 boxes),
   counted by a Node test over every rendered view, with per-page counts that may only go down.
9. **The check fits `npm test`**: the whole count took 19.6 s for 159 views and four households on this 4-core machine;
   it runs as six shards that `node --test` runs side by side.
10. **One landing word**, `?show=<part or box>` (already a wave 1 presentation key), lands on one part with the focus on it.
11. **Answer pages say what happens to the person**, one written sentence per case with a test per case, and the green
    line after a save names the new answer.
12. **Page plan**: 159 usable pages, 47 fine (A), 67 a fold or a reorder (B), 45 a new first view (C). claude-b can do
    126 now; 10 wait for claude-f's stale rows, 10 for claude-b's own work in flight; claude-a's 13 get a hand-over.
13. **Build order**: wave 1 lands first; then 21 small commits, each shippable alone: the helper, the check, Federal
    estimate, Expenses and the bill form, the add forms, the working folds, Settings, Net worth and Debts, two path
    commits, then topic by topic.
14. **"More on this"** stays the one name of the links card (owner, 2026-11-06); its rows are worded as questions with
    the answer under them; on a step of the path it is one row, so Next stays near the first screen.
15. The owner gets three sentences (section 10); nothing here waits for an answer.

---------------------------------------------------------------------------------------------------------------------

## 1. The chosen design

### 1.1 The judges' scores

| design | layperson (`judge-less`) | detail lover (`judge-more`) | owner's words (`judge-owner`) | maintainer (`judge-build`) | total |
|---|---|---|---|---|---|
| **inline** (quiet rows, remembered per part) | 7 | 7 | **8** (winner) | **8** (winner) | **30** |
| dial (rows + "Show everything on this page" + a device setting) | 5 | **8** (winner) | 6 | 5 | 24 |
| stages (a short page and a page behind it) | **8** (winner) | 4 | 5 | 4 | 21 |

**Winner: inline.** It is first or second for every judge and the only one no judge ranked last.

### 1.2 Why, in the judges' evidence

- **It is the owner's sentence and little else**: "every piece of complexity is its own quiet toggle, in place, beside
  the answer, and a toggle stays where the person put it. No mode, no second screen, no control that asks a question"
  (`judge-owner.md` 1). Stages "reads in four things" (a gate, a second screen, curation, a new name); the dial reads in
  "everything" (`judge-owner.md` 4).
- **Nothing leaves the page.** A row opens where it is, 0 px jump, and shuts the same way (`judge-less.md` 1). On
  inline every figure stays in the page, so find-in-page can reach all 32 of the Federal estimate's figures; on stages
  3 of 32 (`judge-more.md` 2).
- **Wave 1 cannot hurt it.** It puts no control into the page, so wave 1's typing memory has nothing of it to replay;
  the dial's page tick and stages' "Keep this" ticks were replayed by wave 1 and flipped the person's choice
  (`judge-build.md` 3.1, 3.2). On wave 1 every inline walk passed: redraw after a save, Back, reload, new visit, a guide
  step's `opens:`, typing kept (`judge-build.md` 2.1).
- **Smallest per page, mistakes stay local.** "What a builder writes per page: a list of `{ id, kind, says, set, open,
  body }`" (`judge-build.md` 4). Its only `npm test` failures were four wording pins of the page it rewrote; the dial's
  helper crashed 13 tests under the text-only stand-in (`judge-build.md` 2.2).
- **It measured well where it was built.** Federal estimate for the family: 3.27 screens, 480 words, 45 figures before;
  1.30 screens, 126 words, 3 figures after; a retired person at 320 px from 4.85 screens to 1.97; "No fact was removed"
  (`design-inline.md` 0 item 11, 5.1).

### 1.3 The grafts, each with its source

| # | graft | from | judges' evidence | here |
|---|---|---|---|---|
| G1 | **A device choice in Settings, narrowed to what cannot draw a wall or a second filled button.** Two switches in one card, mapped to the owner's two words of 2026-11-13 ("complexity", "depth"). | dial | `judge-owner.md` 6.1 and 7.1 ("Shipping the helper with nothing in Settings is the one way to fail the sentence as written"); `judge-build.md` 6.5; `judge-more.md` winner (the bill form 4 of 8 boxes to 8 of 8 in two taps) | 1.5, 1.6, 3.6 |
| G2 | **The box a guide step asks for is first in its part**, with its Save on the same screen. | dial | "Federal tax withheld so far" at 597 px against 1,384 (`judge-owner.md` 6.4); `judge-less.md` 5.2 | R13, 6.1 Federal |
| G3 | **A hint worth money stays on the first view** (the single parent's child care line). | dial | inline folded it, stages lost it, the dial kept it at y=412 (`judge-less.md` 3, 6.1; `judge-owner.md` 7.3) | R9 item 6 |
| G4 | **A form part shuts on the next visit and says "1 set by you"**: memory across visits for reading parts only. | dial, and the maintainer | 1.28 screens on the next visit against inline's 2.80 (`judge-owner.md` 6.3, 7.2); `judge-build.md` 6.2 | R27, 3.5 |
| G5 | **The same-markup test**: every adopted view drawn shut and all-open says the same words, figures and boxes. | dial | `judge-owner.md` 6.5; `judge-build.md` 6.4 | 5.2 S13 |
| G6 | **One landing word, `?show=`**, with the keys a part `holds`. | dial | inline's `?open=` lost typing at the landing because it is not a wave 1 presentation key (`judge-build.md` 2.1 A10, 6.3) | 3.9 |
| G7 | **One written sentence per verdict, a test per case** (stages S3). | stages | the dial's prototype told a household with $0 of tax it was "within a few hundred dollars of it" (`judge-less.md` 3; `judge-owner.md` 6.7; `judge-build.md` 6.6) | R5 |
| G8 | **Rows worded as the question they answer, with the answer under it**, for the links card. | stages | "Would itemizing save tax? · itemizing: $37,406" was the best row of the three (`judge-more.md` 2 D, 5.5; `judge-owner.md` 6.6) | R24, 3.2 `links` |
| G9 | **Big picture first on a step of the path, by the address and not by a gate**: the links card is one row while the step bar shows, so Next is near the first screen. | stages | way on at y=784 (stages) against 1,300 (inline) (`judge-less.md` 2; `judge-owner.md` 6.8) | R6 |
| G10 | **A link lands on one part with the focus on it**, 68 px under the top bar. | stages | `judge-more.md` 5.6; `judge-owner.md` 6.9 | 3.9 |
| G11 | **The finished-plan moment offers, never holds back**: once the path is finished, Your plan says once where the switches are. | the detail lover | `judge-more.md` 5.8 (the owner's "Once we're in the big picture, you can delve deeper" without a gate) | 6.2 claude-f, C20 |

Fixes to inline itself that the judges required (all in commit C1 or the page commits):

| # | fix | evidence |
|---|---|---|
| F1 | Forms through wave 1's `ui.form` `more: true` ("More details (optional)"); delete `moreOptions()` and "More options" | a second fold mechanism and a label its own source rules out (`judge-build.md` 3.3, 6.1; `verify-web.md` 1.2) |
| F2 | `KEPT` = `more` and `how` only | a form opened to type one figure made the page 2.80 screens long a day later (`judge-owner.md` 7.2) |
| F3 | The green line after a save names the new answer ("Saved. You would now owe about $1,730 in April.") | in all three designs the person changed the answer from $5,253 to $1,730 and was told a figure that did not change (`judge-owner.md` 2, 7.4) |
| F4 | The Settings line "You keep N parts open on this phone" with "Shut them all", and the 90 days said there | memory that erodes the default must be visible (`judge-owner.md` 7.2; `judge-more.md` 5.3) |
| F5 | Inline's never-folded list widened (money hints, a guide step's box) and tested | `judge-less.md` 5.5, 6.1 |
| F6 | Inline's alarm headline ("$1,241 of tax is overdue now") as the rule when there is an alarm | `judge-less.md` 3, 5.4 |
| F7 | No page prints "null" or "undefined" | the stages prototype printed "null" for every household (`judge-less.md` 6.4) |
| F8 | The stand-in discipline: the helper builds with `ui.h` and `append` only, every DOM call optional, tested under both stand-ins | `judge-build.md` 6.9; the dial's 13 crashes |
| F9 | A guide step's `opens:` titles are tested against what each page draws | `judge-build.md` 6.6 |

### 1.4 Not taken

| what | from | why |
|---|---|---|
| "Show everything on this page" tick under each answer | dial | one slip made Dana's page 6.3 screens with 19 boxes and four filled buttons, the undo 5.8 screens down, still so the next day (`judge-less.md` 3); wave 1 replays it as typing and overrides Settings (`judge-build.md` 3.1) |
| A second page per topic (`?deeper=`), the stage read from the path, "Keep this" ticks | stages | the detail is not in the page (find-in-page reaches 3 of 32 figures), nine inputs split from their working, no household reaches the second stage, "Keep this" replayed by wave 1 (`judge-more.md` 4; `judge-build.md` 3.2; `judge-owner.md` 4) |
| A form part remembered across visits | inline | F2 above |
| `?open=` | inline | G6 above |
| `moreOptions()` and the label "More options" | inline | F1 above |
| "Go deeper" as a heading | stages, the retirement request's in-flight card | "More on this" is the owner's choice of 2026-11-06 (37 views say it); "Go deeper" in the 2026-11-12 entry is the builder's reading and names the pattern. One name for one thing (constraints P7) |
| Folding Plan basics on Settings | inline 5.7 | the owner reviewed that card and its place; nothing here needs it |
| Folding the add form of a list that does not apply (a retired household's contributions) | inline 8.1 #4 | "an empty list keeps its add form open" is the owner's (2026-09-15); the form keeps its first five boxes only, which the five-box rule already gives |
| An address word that writes the device's choice (`?detail=all`) | dial | a shared link would switch someone else's phone (`judge-more.md` 6); `?more=` here counts for the visit only |

### 1.5 The owner's word "toggles": the visible answer

Two kinds of toggle, both on screen, both plain:

1. **Every optional part is a toggle in place.** A row under the answer ("4 more numbers ›", "How this is worked out ›",
   "Itemized deductions · 4 set by you ›") opens where it is and shuts with the same tap. A reading part stays the way
   the person left it on this phone. This is what "subtle" asks for: nothing new on the screen, nothing that asks how
   the app should look.
2. **One card in Settings that a person would call toggles**: "How much to show", second after Plan basics, two
   tick-box rows (the `.toggle-row` Settings already uses), both off, on this phone only, each confirmed in green where
   the thumb is, each undone by the same tick. Drawn (390 px):

```
┌ How much to show ──────────────────────────┐
│ [ ] Show how answers are worked out        │
│     Every "How this is worked out" and     │
│     "N more ..." row starts open.          │
│ [ ] Show every box in forms                │
│     Every form starts with its "More       │
│     details (optional)" boxes showing.     │
│ On this phone only. Your plan and your     │
│ numbers stay the same.                     │
│ You keep 3 parts open on this phone; they  │  only when the count is above 0
│ shut by themselves after 90 days unseen.   │
│ ( Shut them all )                          │
└────────────────────────────────────────────┘
```

**Why two switches and not one.** The judges' common ground is one device choice in Settings, narrowed so it can
never draw a wall of boxes or a second filled button (`judge-owner.md` 6.1, `judge-build.md` 6.5; the layperson judge
would take none, `judge-less.md` 5). This spec keeps that ground: one card, one place, off by default, presentation
only, nothing on any page asks about it. It splits the choice in two because the owner's words of 2026-11-13, which came
after the judging, name two things ("upgrade the complexity and the depth"), and because the two are different wishes:
the walks' Kai wanted "the working under every answer" and "every box in every form" as separate items (`walks.md`
1.4), and the owner's judge refused forms inside the reading switch for good reason (a form part holds its own Save).
"Show how answers are worked out" opens reading parts only; "Show every box in forms" only lengthens a form the person
is already looking at, inside its own Save. The second costs no new mechanism: wave 1 already ships `ui.setMoreOpen`
"for someone who wants every box on screen ... the shell is to call it from a device setting" (`w1/integ`
`core/ui/dom.js`, `docs/CONVENTIONS.md`).

### 1.6 The owner's "ways to upgrade the complexity and the depth": what a person can switch on

| # | what a person does | where | what it changes | what it never changes |
|---|---|---|---|---|
| 1 | Taps a row under an answer | every page, the parts card right after the answer | opens that part in place: more figures, the working, their own boxes. A reading part stays open on this phone next time; a part with boxes stays open for this visit and then says "1 set by you" | the plan, any figure, any other part |
| 2 | Ticks **"Show how answers are worked out"** | Settings › How much to show | every part of kind `more` ("4 more numbers", "25 more years", "3 more accounts") and `how` ("How this is worked out", "Where these numbers come from") starts open, on every page that has one | parts with boxes, add forms, a person's or month's fold, "Show details", Advanced, the menu, the path, any figure |
| 3 | Ticks **"Show every box in forms"** | Settings › How much to show | every form's "More details (optional)" starts open (wave 1's `ui.setMoreOpen(true)`): the bill form shows 8 of 8 boxes, Add a rental all of its boxes | which boxes Save reads (it reads all of them either way), the number of filled buttons, the plan |
| 4 | Taps a row of **"More on this"** | the foot of every answer page, before the way on | goes to the deeper page that answers that row's question (Year by year, Tax year by year, Bracket explorer, Sensitivity...); the row already shows that page's answer | the path: deeper pages are never added to it |
| 5 | Taps **"Type my own"** or opens **"Set my own numbers"** | wherever a choice comes as chips or a figure is our guess | replaces a preset or our guess with an exact figure, on Save | nothing until Save; the chip that is on always comes from the plan |
| 6 | Opens a page by its address with `?show=<part>` (links, guide steps, Needs attention) | any page | that part opens once, under the top bar, with the focus on it; not remembered | the device's choices |

What a person never has to do: choose a level, answer "beginner or expert?", visit Settings, or know there is a switch.
The first view is right by itself; fewer than one person in twenty ever changes a setting (`research.md` [S19]).

---------------------------------------------------------------------------------------------------------------------

## 2. The rules

Each rule names its test: **N** = the Node check over rendered views (section 5.2), **M** = the page's own
`module.test.mjs`, **B** = the browser check `qa/first-view.mjs` (5.3), **H** = the helper's tests (5.1), **S** = the
screenshot read at 390 px before a page is called done (AGENTS.md rule 13).

### 2.1 Words used

- **First view**: the page as it opens for someone who has opened nothing, everything outside a shut part, in the phone
  markup (`.only-wide` skipped), with `planner.more` empty.
- **First screen**: what of it lies above 844 px at 390 px wide (above 568 px at 320).
- **Part**: an optional piece of a page drawn by `part()`: a native `<details>` with a fixed title, a short status and
  a body that opens in place. Kinds: `more`, `how`, `own`, `figures`, `item`, `tech`, `links` (3.2).
- **Reading part**: kind `more` or `how`: figures and words, no box.
- **Kind of page** (one per usable page, in `tests/first-view.kinds.mjs`, not in the manifest, so no other lane's
  folder is edited): **answer** (a verdict worked out from the plan), **list** (things the person keeps), **form** (a
  page whose job is to ask; every add or edit form once opened), **settings** (Settings, Help, Get started, Our guesses,
  Step by step, Quick answers: things to switch or look up), **report** (made to be read whole or printed: `reports/*`,
  the long year tables, All pages, Glossary, Docs, Diagnostics).

### 2.2 First-view budgets, per kind of page

**R1. Every page's first view stays inside its kind's budget**, counted on the unopened page for the worst of the three
households with a plan (`family`, `renterDebt`, `retiredCouple`), and separately on the empty plan. **N**

| kind | words | money and % figures | boxes | tiles | filled buttons | parts (rows) | first screen at 390 x 844 (**B**) |
|---|---|---|---|---|---|---|---|
| **answer** | 160 | 8 | 1 (the one box that changes the answer; usually 0) | 4 | 1 | 5 | ≤ 110 words and 8 figures; the headline and the filled button wholly above 844 px |
| **list** | 240 | 16 | 0 while the list has rows; 5 while it is empty (its add form, owner 2026-09-15) | 4 | 1 | 5 | the headline figure and the first rows |
| **form** | 200 | 4 | 5, every required box among them | 0 | 1 | 1 "More details (optional)" per form | Save wholly above 844 px with the keyboard shut |
| **settings** | 200 | 2 | 3 | 0 | 1 | one per card; technical last | the first card whole |
| report | no limit | no limit | 2 | 4 | 1 | 5 | structure checks only |
| **any kind, on the empty plan** | 100 | 1 | 5 | 0 | 1 | - | one sentence on what to do first and one filled way to start |

Where the numbers come from: four tiles and "one sentence" are the owner's (log 2026-09-16); 160 words and 8 figures
is the Dashboard, the page the walks call the model (103 words and 8 figures on its first screen); five boxes fit one
phone screen with Save in sight (walks: Goals' three boxes 0.5 screen, Income's nine 1.0); six rows is Baymard's
tested floor for a cut list (`verify-web.md` 2 item 1). The rest are this spec's sizes. They live in one table in
`tests/first-view.kinds.mjs`; tightening one is a one-line change.

**R2. A page over its budget at the tip has its counts in `tests/first-view.known.json`**, rounded up to the next ten
words; a count may only go down. A redraw lowers the entry in the same commit. **N**

### 2.3 Answer pages

**R3. The headline says what happens to the person**, as a sentence in the hero's `h1` or one `ui.stat` with its
words: "You would owe about $5,253 in April", not "About $14,723 of federal tax for 2026" and not a bare "$8,450".
When there is an alarm, the alarm is the headline ("$1,241 of tax is overdue now"). A zero is said in words ("No
federal tax to pay for 2026"; owner, 2026-09-15 round 4). **M** per case; **S**

**R4. An answer page reads in this order**, top to bottom: (1) the headline; (2) at most two sentences, at most three
figures; (3) the one filled button; (4) alarms, guess marks, a hint worth money; (5) at most four tiles or six rows a
person would act on; (6) the parts card; (7) the "More on this" card; (8) the shell's way on. **N** for 6, 7, 8; **S**

**R5. One written sentence per case.** The sentence under the headline is written out for every verdict the page can
reach (owe, about right, back, nothing, not known yet, alarm), never assembled from clauses, and each case has a module
test that reads it. **M**

**R6. On a step of the path, the way on is near the top.** While the step bar shows (`?guide=plan`), the "More on this"
card is one shut row and the shell's Next lies within 2 screens (1,688 px at 390) of the top for every household with
a plan. **B**; **N** checks the card is one row on a step.

**R7. After a save, the green line names the new answer** whenever the headline changed: "Saved. You would now owe
about $1,730 in April." (F3). **M** for each answer page that has a form.

**R8. A what-if page asks first, then answers.** With nothing entered it shows its five boxes (form budget) and
"More details (optional)"; once it has an answer from the plan or from saved figures, its inputs fold into "The
figures" with their headline values as the status ("$400,000, $2,200 rent"), and the answer is the first view. **M**

### 2.4 Never folded

**R9. None of these is ever inside a shut part.** A redraw that folds one is wrong, however calm it looks.

| # | never folded | test |
|---|---|---|
| 1 | the answer, and the pair that gives it meaning (what you plan to spend beside what the money can pay for; the debt-free month with its monthly amount; what happens in April) | **S** |
| 2 | **the one filled action**, and the action a link or a guide step promised (constraints V9); a part may hold a promised action only if every address that lands on it opens that part | **N** (S6), **M** |
| 3 | every alarm: red and amber notices, overdue amounts, deadlines, "does not add up" | **N** (S5) |
| 4 | **every error**: a `.notice.error`; a box held back at Save opens the part that holds it and takes the focus | **N** (S5), **H** |
| 5 | every reason to doubt a figure: "our guess", "partly our guesses", "not counted yet", the shell's grey guesses row | **N** (S5 counts `.guess` marks), **S** |
| 6 | **a hint worth money**: a notice or line that names money the person could claim or keep by doing something (a credit, an employer match not taken, a cheaper way to pay), with its link | **N** (S5: every `.notice`; any other such line carries `data-worth` and is checked the same way) |
| 7 | **a guide step's box**: on arrival by that step, its part is open, the box is the first box in it, and its Save is within 700 px below it | **N** (S14), **B** |
| 8 | every confirmation after a save, add or remove (owner, 2026-09-15 round 6) | **M** |
| 9 | a required box; a box that shows our grey guess (a guess is written only "from a box the person saw", `docs/CONVENTIONS.md` Guesses) | **N** (S9) |
| 10 | what the owner already chose to keep in sight: Edit and Delete on Net worth rows; a zero said in words; Your plan's gaps; the Dashboard's rows; the Assumptions review notice; Settings' order; the first person's Social Security fold open (pass 4); Forecast's first month open (pass 2 round 9) | **S**, **M** |
| 11 | builder details: not folded, not on screen at all (owner, 2026-09-15 round 8) | `tests/user-view.test.mjs` as today |

### 2.5 Parts

**R10. One helper, one markup.** Every new or touched optional piece is drawn by `part()`, `parts()`, `rest()` or
`links()`; a touched view writes no `<details>` by hand. Wave 1's form fold (`details.form-more`) is the one other kind
allowed. **N** (S10)

**R11. Parts never nest.** A part holds no part. Two exceptions: a form inside a part may hold its one "More details
(optional)"; a part may hold a list whose rows open (Settings' page topics, the glossary). A third level is a page,
reached from "More on this". **N** (S1)

**R12. At most five parts on a page, as rows of one card** after the answer, in the order: `more`, then `own` and
`figures`, then `how`. One or two parts may sit in the card they belong to. No folded card stands in a column of
folded cards. **N** (S2)

**R13. The box a guide step or a landing asks for is the first box of its part**, and the part's Save is on the same
screen (G2). **N** (S14), **B**

**R14. A part is worth a tap**: it holds at least two figures, three rows or forty words. Less than that is shown. **N** (S7)

**R15. An open part is at most a screen and a half** (1,300 px at 390). Longer belongs on a deeper page, linked. One
exception: a part that is the page's own list ("See or change each bill"). **B**

**R16. Opening or shutting changes nothing in the plan**, asks for no save, loses no typing, and moves the page by
0 px. **N** (S8), **B**

**R17. After a save, the part that was saved stays open and no other part opens or shuts** (owner pass 4 "the one just
saved stays open"; today saving the one-number month on Expenses opens the bill list). **M**

**R18. No second filled button, no bar, no tab.** A part's row is never styled as a button; nothing new is fixed to
the bottom of the screen; chips wrap and never scroll sideways. A filled button inside a part is only that part's own
form's Save. **N** (S6), **B**

### 2.6 Lists

**R19. A list shows six rows, then "N more <things>"** (the first four of each group when it is in groups). A cut never
hides fewer than three rows (a list of eight shows eight), and never hides a row with a guess mark, a warning or an
overdue date (`keep`). **N** (`rest()` is the only way to cut), **H**

**R20. A list with rows folds its add form behind an outlined "+ Add another <thing>"**; an empty list keeps the form
open at its first five boxes (owner, 2026-09-15). **N**

### 2.7 Forms

**R21. A form asks first for at most five boxes**: every required box, and the boxes most entries need. The rest are
`more: true` fields under wave 1's "More details (optional)", directly above the buttons, with a status naming what is
inside ("category, dates") until something inside is the person's ("2 filled in"). A box whose hidden default would
mislead stays out of the fold (the bill's Category: `judge-less.md` 3). A page passes the kit's `moreOpen` as `true` or
not at all, never `false`, so the forms switch and a box that holds something still open the line (3.4). **N**

**R22. What Save writes does not depend on whether "More details (optional)" is open.** A folded box is read and saved
like any other (wave 1). A field with `guess` or `required` is never folded (the kit ignores `more` on it). This settles
the constraints' open point O2: no folded box ever shows a guess, so no folded blank box writes one. **N** (S9: every
form with a `more` field submitted shut and open writes the same plan)

**R23. A simple choice before an exact figure.** Three or four chips taken from real reference points, low to high,
each saying what it is; the chip that is on comes from the plan, also when it is none of ours ("Yours: 5.5%"); "Type my
own" shows one box in place (not a part). Drawn by `choice()`. **S**, **H**

### 2.8 Words

**R24. A part's title is one of the vocabulary phrases** (section 4), or a title a test, a guide step or an owner
decision pins ("Figures the plan cannot see", "Retirement settings", "The split to aim for", "What a paycheck
withholds", "See or change each bill", "Where these numbers come from", "Advanced", "What is still being built",
"Show details"), or, on a page with several `own` parts, two to four words that say what is inside ("Itemized
deductions"). Never a bare "More", "Details", "Other", "Advanced" (outside Settings), "More options", "Expert",
"Simple mode", and never "Go deeper" as a heading. **N** (S4)

**R25. The title is fixed; the status changes.** The status is at most 20 characters, never cut with an ellipsis, and
the person's own state comes first ("4 set by you" replaces "standard is better" when both do not fit). **N** (S3)

**R26. Four status spellings for the person's state**: "N set by you" ("set by you" for one figure; "N filled in" in a
form's "More details (optional)"), "our guess" ("N our guesses"), "not set yet", "N to fix". **N** (S3)

### 2.9 Memory and the switches

**R27. Only the person's own tap on a reading part is remembered across visits** (`kept`, per part, this phone,
`event.isTrusted` on the summary's click, one tick later). A part opened by an error, a save, a landing, a guide step,
the printer, find-in-page or wave 1 putting typing back is not. Parts with boxes, items and technical parts are kept
for the visit by wave 1 only. **H**, **B**

**R28. A remembered part not drawn for 90 days is forgotten**; Settings shows the count and "Shut them all". **H**

**R29. The two switches are off unless the person ticks them**, on this phone only, never asked during setup, never
on by screen width, never set by an address that is stored. **H**

**R30. A switch opens only what its words promise**: "Show how answers are worked out" opens kinds `more` and `how`;
"Show every box in forms" opens wave 1's "More details (optional)". Neither opens `own`, `figures`, `item`, `tech`,
`links`, an add form or the menu. **H**, **N** (S13 with both on)

**R31. Nothing about parts or switches is ever written to the plan**, sent to the computer, or put in a downloaded
copy. The key holds page and part names only: never a figure, a name or anything from an account. **H**, **B**
(plan bytes and every other stored key identical after every open, shut and tick)

**R32. No device control inside a page.** The helper draws no `input`, `select` or `textarea` of its own; the only
place a switch lives is Settings, a System page, where wave 1 never keeps typing. **N** (S15)

---------------------------------------------------------------------------------------------------------------------

## 3. The mechanism

### 3.1 Files

| file | new or changed | when | what |
|---|---|---|---|
| `core/ui/more.js` | **new** (not one of wave 1's files) | C1 | the helper and both stores; imports nothing; safe to import in Node; built from the inline prototype (`$O/proto-inline/core/ui/more.js`, 190 lines) with F1, F2, G1, G6, G8, G9, G10 applied |
| `tests/more.test.mjs` | new | C1 | the helper's tests (5.1), run under the repo's fake DOM and under the text-only stand-in |
| `docs/OPTIONAL.md` | new | C1 | sections 2 to 4 of this spec as the rule book |
| `core/app.js` | one line, after wave 1 lands (claude-b's own file then) | C7 | `detail.init(ui)` beside `ui.setMoneySign(...)` (line 435 in `w1/integ`): reads the switches and calls `ui.setMoreOpen(detail.boxes)` |
| `core/ui/dom.js` | two small kit options, after wave 1 lands | C4 | `opts.moreSays` (the status of "More details (optional)") and `more` ignored on a field with `guess`, as it is on `required` |
| `modules/system/settings/view.js` | the "How much to show" card; "Erase the copy on this device" also clears `planner.more` | C7 | |
| `docs/DATA_MODEL.md` | "Not in the plan": `planner.more` (and the missing `planner.view`, `planner.nav`, `planner.typing`, `planner.place`) | C1 | |
| `docs/CONVENTIONS.md` | three lines: "Optional parts: `core/ui/more.js`, rules in `docs/OPTIONAL.md`"; wave 1's example `moreOpen: !!editing` becomes `moreOpen: editing \|\| undefined` (3.4) | C1 | |
| `modules/_template/view.js`, README | one `parts()` call and one `links()` call | C1 | |
| `tools/shot.mjs` | `--more` adds `more=all` to the address | C2 | |

No plan field, no migration, no `compute.js`, no new global CSS (the helper's few inline styles sit on its own
elements; one rule in `base.css` can replace them later). `core/ui/more.js` lands on `main` before or in the same push
as the first page that imports it, through the main gate (AGENTS.md rule 16).

### 3.2 The API

```js
import { part, parts, rest, choice, links, statusOf, detail, kept } from "../../../core/ui/more.js";
```

| export | signature | what it is for |
|---|---|---|
| `part` | `part(ctx, { id, kind, title?, n?, noun?, says?, set?, guess?, missing?, fix?, open?, holds?, card?, lazy?, body })` → `<details>` | one optional part |
| `parts` | `parts(ctx, ...list)` → `<section class="card" data-parts>` or `null` | the page's parts as rows of one card, in the fixed order (R12); throws in tests above five |
| `rest` | `rest(ctx, { id, items, row, first = 6, noun, keep?, list = "records" })` → `[ul]` or `[ul, part]` | the first six rows, then "N more <noun>" (R19); `keep(item)` true pins a row among the shown ones; lazy above 40 hidden rows |
| `choice` | `choice(ctx, { id, label, presets: [{ value, label }], value, own: { type, label, min?, max? }, onPick })` → node | chips, then "Type my own" showing one box (R23); `onPick(value)` commits through the page's `store.update` on a chip tap or on the box's change, never per keystroke |
| `links` | `links(ctx, rows)` → "More on this" card, or one shut part on a step; rows `{ href, ask, says? }` | the deeper pages, each row the question it answers with its answer under it ("What more income would cost ›" / "22% on the next dollar"); at most five rows |
| `statusOf` | `statusOf({ says, set, guess, missing, fix })` → string | the one status line (R25, R26); pure |
| `detail` | `detail.init(ui)`, `detail.working`, `detail.boxes`, `detail.set({ working?, boxes? })`, `detail.forVisit` | the two switches (3.6) |
| `kept` | `kept.get(page, id)`, `kept.set(page, id, open, designed)`, `kept.count()`, `kept.clear()` | the per-part memory (3.5) |
| constants | `MORE_KEY`, `KEEP_DAYS = 90`, `KEPT_KINDS = ["more", "how"]`, `WORKING_KINDS = ["more", "how"]`, `TITLES`, `STATUS_MAX = 20`, `MAX_PARTS = 5`, `FIRST_ROWS = 6`, `MAX_ENTRIES = 300` | |

`part()`'s fields:

| field | meaning |
|---|---|
| `id` | the part's stable name on its page ("numbers", "how", "figures", "itemized"): the memory's key and the landing's name. Never built from a title or a count |
| `kind` | `more` (title "N more <noun>" from `n` and `noun`), `how` ("How this is worked out", or a pinned source title), `own` ("Set my own numbers", or a named title), `figures` ("The figures"), `item` (named for its item: a person, a month, a card), `tech` ("Show details", "Advanced"), `links` ("More on this", only from `links()` on a step) |
| `title` | only for `item`, `tech`, a pinned title, or an `own` part on a page with several |
| `says` | the status in plain words: a count or the figure inside ("11 steps", "$400,000", "2026") |
| `set`, `guess`, `missing`, `fix` | the person's state inside: figures they set, figures that are our guess, a figure still wanted, things to fix |
| `open` | `true` when the page needs it open on this draw for a reason (just saved, an empty list's add form, a what-if page with no answer yet). Never remembered |
| `holds` | the box keys inside, so `?show=<key>` finds the part |
| `card` | `true`: a folded card of its own (one or two parts that belong to one card); default: a row of `parts()` |
| `lazy` | `true`: the body is built when first opened (3.15) |
| `body` | nodes, or a function returning them |

### 3.3 What it draws

Only classes that `core/ui/base.css` has (`.card`, `.folds`, `.fold`, `.fold-card`, `.fold-title`, `.fold-status`,
`.fold-chev`, `.fold-body`, `.chips`, `.chip`, `.toggle-row`, `.records`):

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

The title in `.fold-title` and everything that changes in `.fold-status` is exactly how wave 1's place memory names a
section (`foldWords()` in `core/place.js` reads `.fold-title` and drops `.fold-status`), so a part keeps its identity
across a change of status. `summary` stays `display: block` with an inner flex row (the shape GOV.UK shipped after
VoiceOver lost "collapsed" on other displays; `research.md` 1.6, `verify-web.md` 4.2). No heading inside `summary`, no
link or button inside the row, a space between title and status.

### 3.4 Open or shut: one order, in one place

`part()` decides, in this order, and stops at the first that applies:

1. **A reason, now** (never remembered): `fix > 0`; a box inside fails its check (an `invalid` listener in the capture
   phase opens the part; wave 1's kit also opens every shut ancestor of a failing box); the page passes `open: true`;
   the address's `?show=` names its `id` or a key in `holds` (once per arrival: a `WeakSet` of route objects); a guide
   step's `opens: "<title>"` (wave 1's `frame.js openFold()` sets `open` after the draw); wave 1 put unsaved typing back
   inside it.
2. **The person's own last tap on this part, on this phone**, for kinds `more` and `how`, if seen in the last 90 days:
   open or shut as they left it.
3. **The switch**: "Show how answers are worked out" on → kinds `more` and `how` open.
4. **Shut.**

Forms keep wave 1's kit as it is (`form()` in `core/ui/dom.js`): when the page passes `moreOpen`, that decides;
otherwise "More details (optional)" is open when one of its boxes already holds something, when the person opened this
form's line earlier on this visit, or when "Show every box in forms" is on (`moreAll`); a box held back at Save opens it
in every case. So a page passes `moreOpen: true` or nothing, never `false` (`moreOpen: editing || undefined`, not
`!!editing`): a `false` would beat the switch and a box that holds something (R21).

**How the hand beats the switch.** Step 2 comes before step 3, and `kept` stores a shut as well as an open: a part the
switch opens and the person shuts stays shut on this phone (stored as `0`), on every later visit. Ticking either way on
"Show how answers are worked out" clears those `0` marks (the person has just said how they want pages to open, as the
dial's Settings card does); "Shut them all" clears the `1` marks (the parts they opened by hand). For "More details
(optional)" the hand wins for the visit: wave 1 keeps the shut per history entry and across a save's redraw ("where the
page drew it as before"); a new visit with the switch on opens it again.

### 3.5 Storage: one key

| | |
|---|---|
| key | `localStorage["planner.more"]`; `planner.more.sandbox` when the address has `?sandbox` (a test run never touches the owner's phone) |
| format | `{ "fmt": 1, "working": 1, "boxes": 1, "parts": { "taxes/federal#how": [1, 20770], "cashflow/expenses#how": [0, 20771] } }`: a switch is stored only when on; a part only when it differs from how the page draws it by default: `1` (they opened it) or `0` (they shut one the switch opens), with the day number it was last drawn. The key is removed when nothing is stored |
| limits | at most 300 parts, oldest first out; an entry not drawn for 90 days is dropped on the next read; its day is refreshed at most once a day |
| read | lazily, in a try/catch; a private window or a sandboxed frame gets an in-memory copy for the visit |
| never | in the plan, in `compute.js`, sent to the computer, in a downloaded copy; no figure, name or account in it |
| cleared by | "Shut them all" (the parts kept open), a tick on "Show how answers are worked out" (the parts shut against it), "Erase the copy on this device" (everything) |
| unreadable | anything that does not parse as `fmt: 1` reads as nothing stored and is overwritten on the next write |
| Safari | Safari may delete a site's storage after seven days without a visit (`verify-web.md` 4.1); a Home Screen app keeps its own. Losing the key makes pages short and both ticks show off: the safe side, and Settings says what is true |
| address | `?more=all`, `?more=working`, `?more=boxes` in the address (before the `#`) turn the switches on **for this visit only**, never stored; for `tools/shot.mjs --more`, `qa/first-view.mjs` and smoke runs |

### 3.6 The two switches

| | "Show how answers are worked out" (`detail.working`) | "Show every box in forms" (`detail.boxes`) |
|---|---|---|
| owner's word | depth | complexity |
| opens | every part of kind `more` and `how`: "4 more numbers", "25 more years", "3 more accounts", "How this is worked out", "How this is done", "Where these numbers come from" | every `ui.form` line "More details (optional)" (wave 1's `moreAll`) |
| never opens | `own`, `figures` (they hold a Save), `item`, `tech`, `links`, add forms, Settings' topics, the menu | parts; add forms stay behind "+ Add another" |
| applied | at each draw, in `part()` step 3 | `detail.init(ui)` at boot keeps the kit's `ui.setMoreOpen` and calls it; `detail.set({ boxes })` on the tick calls it again |
| confirmation | "Done. Pages on this phone now open with how each answer is worked out." / "Done. Pages on this phone open short again." | "Done. Forms on this phone now show every box." / "Done. Forms on this phone open short again." |

Both: off by default; a `.toggle-row` with a real `input type="checkbox"` and its words as the label; act at once,
no Save; the green line through the page's module-level `pending` and `ctx.redraw()` (as Settings already does); no
`planner:*` event and no redraw of another page (Settings holds no part a switch opens). Settings is a System page, so
wave 1 never keeps or replays the tick (`neverKept`). The card says only what is true on every page that has the
parts: it ships in C7, after the working folds of the free pages are `part()`s (C6).

### 3.7 Errors

- A `.notice.error` or `.notice.warn` is never drawn inside a part (S5). A page that knows a part holds something to
  fix passes `fix: n`: the part opens and says "1 to fix".
- A box held back at Save inside a shut part or a shut "More details (optional)": the part opens, the focus and wave 1's
  words go to the box ("Fill this in first."), nothing is saved. Measured on the inline prototype and on the dial's
  bill form (`design-inline.md` 2.5; `design-dial.md` 2.6).
- If the answer cannot be given without a box, the box belongs on the first view (R9 item 9), not in a part.

### 3.8 Changed figures

- The view counts the person's figures inside a part and passes `set`: "2 set by you". In a form's fold: "2 filled in".
- `guess` adds "our guess" when nothing is set; the guess mark on the first view stays (R9 item 5); the status repeats
  it, never replaces it.
- The status keeps saying it when the part is shut, after a reload and on a new visit (it comes from the plan).

### 3.9 Landings

- **One word:** `#/taxes/federal?show=itemized` (a part's `id`) or `?show=withheld` (a key in its `holds`) opens that
  part once per arrival, brings it under the top bar with `ui.reveal(el, { block: "start" })` (68 px from the top, under
  the 56 px bar, as measured) and puts the focus on its summary with `preventScroll`. Not remembered. `show` is in wave
  1's `PRESENTATION` list, so typing kept on the page is found at the landing (the reason `?open=` was dropped).
- **What exists keeps working:** `?show=<key>` on Assumptions still outlines its box (the part opens because it `holds`
  the key); `?edit=`, `?add=`, `?type=spending`, `?check=1` stay the pages' own and pass `open: true` to the part they
  need; a guide step's `opens:` finds the part by its fixed title. A title a step names is never renamed without
  `modules/overview/guide/journeys.js` (claude-f's lane); this spec renames none.

### 3.10 Redraw after a save

The shell redraws after every `store.update`. The page keeps the saved part's `id` in its module-level `pending` and
passes `open: true` for it on the next draw (R17), then clears it. Wave 1's `before()` / `afterSave()` put back the
parts the person opened or shut by hand since the last draw, where the page drew them as before, keep the tapped
button under the thumb and the focus in its box. No other part changes. A page that redraws its own state calls
`ctx.redraw()`, never `store.update(() => {})`.

### 3.11 Back, Forward, reload

| the person | `kept` (this phone) | wave 1 (this tab's history) | after Back, Forward or a reload of that entry | on a new visit (menu, link, Next) | next week |
|---|---|---|---|---|---|
| opens a reading part | stores `1` | notes `{ by: open, drew: shut }` | open | open | open (until 90 days unseen) |
| shuts a reading part the switch opened | stores `0` | notes `{ by: shut, drew: open }` | shut | shut | shut |
| opens a part with boxes (`own`, `figures`) | nothing | notes it | open | shut, "1 set by you" if they saved | shut |
| opens an item (a person, a month) | nothing | notes it | open | as the page draws it | as the page draws it |
| opens "More details (optional)" | nothing | notes it; the kit keeps it for the visit | open | open until the app is reopened | shut (open with the forms switch) |
| lands by `?show=` | nothing | - | open while that entry | as designed | as designed |
| goes Back to an older entry after shutting a part later | `0` or nothing | puts back what that entry showed, where the page drew it as then | as they left that screen | the newer choice | the newer choice |
| types in a box, leaves, comes back | nothing | opens the part holding the typing, "Not saved yet · Undo my typing" | open | open while the typing is kept | - |

So `kept` is "how the page draws a part" and wave 1 is "what this screen looked like when I left it"; neither writes the
other's store. These rows become cases of `tests/place.test.mjs` in C1 (`judge-build.md` 6.8).

### 3.12 Print

A shut `<details>` does not print (measured in Chromium, `research.md` 1.6). The helper listens for `beforeprint`:
builds every lazy body, opens every shut `<details>` under `#content` (wave 1's form folds and pages not yet adopted
included) and shuts the same ones on `afterprint`. Nothing is remembered (no trusted click). Measured on the inline
prototype: a four-page PDF with the walk, the forms and the sources; memory untouched. Not measured in Safari. The
report sheets keep their own print path and hold no parts.

### 3.13 Find-in-page

A part is a native `<details>`: Chrome and Firefox open a shut one when find hits text inside and scroll to it; Safari
from 26.2 opens it but does not scroll to the match (WebKit bug 304174, open; `verify-web.md` 1.1); an older iPhone
finds nothing inside. Opening by find is not a tap: never remembered. Only a body over 40 rows or one that needs
`ctx.computeRemote` may be lazy, so the working and the sources stay findable. Whether find-in-page exists in the Home
Screen app is not verified.

### 3.14 Screen readers, 44 px, dark mode

- Native `<details>`: the browser gives the role and the state; the helper adds no `role` and no `aria-expanded`. The
  marker is `aria-hidden`. VoiceOver on a real iPhone is untested (risk 2).
- The Settings switches are checkboxes with their words as label; their green line is read by the shell once (wave 1:
  green notices are read; the page does not announce again).
- A landing moves the focus to the part's summary; a part opened by a tap keeps the focus on its summary.
- `.fold > summary` is 44 px tall at least; a status over 20 characters wrapped the title into a 102 px row at 320 px
  in the prototype, hence R25.
- The helper has no colour of its own; rows hold their contrast in dark mode (read on two screenshots).

### 3.15 Heavy parts

`lazy: true` only for a body of more than 40 rows (`rest()` sets it) or one that needs `ctx.computeRemote`. A lazy body
is built on first open, at once when a reason, the memory or a switch opens it, on `beforeprint`, and in the same-markup
test. Everything else is in the page from the first draw, as everything is today.

### 3.16 How a view adopts it

```js
import { part, parts, rest, links } from "../../../core/ui/more.js";

root.append(hero(answerFor(d)));                                    // R3 to R5: the case's own sentence
root.append(...alarms, ...worthMoney);                              // R9: outside the parts
root.append(parts(ctx,
  { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", body: () => ui.row(tiles) },
  { id: "figures", kind: "own", title: "Figures the plan cannot see", holds: ["withheld", "otherIncome"],
    set: typed, says: typed ? "" : "none typed", open: pending?.part === "figures", body: [help, figuresForm] },
  { id: "how", kind: "how", says: `${steps.length} steps`, body: () => [walk, leftOut, sources] }));
root.append(links(ctx, [
  { href: "#/taxes/brackets", ask: "What would more income cost?", says: "22% on the next dollar" },
  { href: "#/taxes/projection", ask: "What is the tax in later years?" }]));
```

A form: `ui.form([{ key: "name", ... }, { key: "category", ... }, { key: "essential", more: true, ... },
{ key: "startDate", more: true, ... }], values, save, { submitLabel: "Save", moreSays: "must-pay, dates" })`.
A list: `card.append(...rest(ctx, { id: "accounts", items, row: accountRow, noun: "accounts", keep: (a) => a.guessed }))`.

Steps for one page: (1) read its README, its design-log rows and its tests; (2) decide the answer and write its
sentence per case (R5); (3) move, never delete: every sentence and figure that leaves the first view goes into a named
part or a deeper page; (4) replace module-level "open" variables with `open: pending?.part === id`; (5) the module test
reads "outside the parts" and "inside part X" (the RMD, Roth conversions and How much to take out tests already do);
(6) lower the page's `KNOWN` entry; (7) `node tools/shot.mjs <group>/<id>` at 390 and 320, light and dark, and with
`--more`, and read the pictures; (8) README (what is on the first view, what each part holds, the builder's choices),
CHANGELOG line, claim row in `docs/TEAM.md`.

---------------------------------------------------------------------------------------------------------------------

## 4. The vocabulary

Eight phrases, one job each, all fitting a 320 px row:

| # | phrase | used for | status says |
|---|---|---|---|
| 1 | **"N more <things>"** ("4 more numbers", "3 more accounts", "25 more years") | the rest of the figures, or of a list after six rows (kind `more`) | nothing, or "2 set by you" |
| 2 | **"How this is worked out"** | the sum with the person's own numbers, what it leaves out, where the tables come from, with dates (kind `how`). Source-only parts keep their owner-chosen titles ("Where these numbers come from") | "11 steps", "sources" |
| 3 | **"Set my own numbers"**; for one box, the chip **"Type my own"** | exact boxes behind chips or behind our guess (kind `own`) | "our guess", "2 set by you" |
| 4 | **"The figures"** | the inputs of a what-if page once it has answered (kind `figures`) | the headline inputs ("$400,000, $2,200 rent") |
| 5 | **"More details (optional)"** | a form's optional boxes, above its buttons (wave 1's words) | what is inside ("category, dates"), then "2 filled in" |
| 6 | **"More on this"** | the links card at the foot of a page: each row the question it answers, its answer under it (owner, 2026-11-06) | - |
| 7 | **"How much to show"** | the Settings card, with **"Show how answers are worked out"** and **"Show every box in forms"** | the ticks |
| 8 | **"Shut them all"** | forgets every part this phone keeps open | "You keep N parts open on this phone" |

Status words, one spelling each: "N set by you", "our guess", "not set yet", "N to fix" (R26).
Kept as they are, not new: "+ Add another <thing>" (settled 2026-09-15), "Show details" (settled), "Advanced"
(Settings' technical card only), and every title a test, a guide step or the owner pins (R24).
Replaced over time: "Matters less", "Show all N", "Show more (N left)", "Years ahead", "Type my own amount", "Or type
your own numbers", "Correct these figures", "Change what you typed" (one test pins it: change the test in the same
commit), "Your figures" and "The offers" (claude-a's pages, guide steps name them: they stay), and the seven "Next"
cards in claude-a's folders (to "More on this", by hand-over).

---------------------------------------------------------------------------------------------------------------------

## 5. The machine check

### 5.1 `tests/more.test.mjs`: the helper (C1)

The inline prototype's eleven tests (`$O/inline-work/more.test.mjs`, 11 of 11 pass on wave 1 per `judge-build.md` 2.2),
adapted, plus one per graft: one markup; `kept` stores only what differs from the default and only for `more` and
`how`; an `own` part opened by hand is not kept; 90 days unseen forgets; `open: true`, `fix` and `?show=` open without
being stored; `?show=` by `holds`, once per route object; the order of 3.4 (a stored `0` beats the switch; the switch
opens `how` and not `own`); `detail` reads `?more=` for the visit and never stores it; `detail.set({ boxes })` calls
`ui.setMoreOpen`; a lazy body is built once, and on `beforeprint`; `statusOf` stays within 20 characters with the
person's state first and the four spellings; `rest()` never hides fewer than three rows and never a `keep` row;
`parts()` orders `more`, `own`/`figures`, `how` and refuses a sixth; `links()` is one shut row when
`ctx.route.query.guide` is set; `choice()` marks the plan's value, "Yours: 5.5%" when it is none of the presets; the
helper draws no `input` of its own; every test runs under `qa/fixtures/fake-dom.mjs` and under the text-only stand-in
the three view tests use.

### 5.2 `tests/first-view/*.test.mjs`: every rendered view, counts that may only go down (C2)

**What it draws.** Every usable page's `view.js`, with the real UI kit on the repo's fake DOM (the inline counter,
`$O/inline-work/first-view.mjs`, made into `qa/first-view-lib.mjs`), for four invented households: `family`
(`qa/fixtures/family-plan.mjs`), `renterDebt`, `retiredCouple`, and the empty plan; `planner.more` empty; the route's
query empty, and once more with `guide=plan` for the path's steps.

**What it counts**, outside every shut `<details>` (`.only-wide`, `[hidden]`, `aria-hidden`, `option`, `style`
skipped): words; money and percent figures; boxes a person can type in (not ticks, files, buttons); `.stat` tiles;
filled buttons (`button`, `a.btn` without `secondary`, `link`, `danger`, `chip`, `small`, `ghost`); parts; and,
reported only, the words behind shut parts (proof that nothing was deleted).

**The rule** (the `KNOWN` pattern of `tests/guess-sanity.test.mjs`):
- `tests/first-view.kinds.mjs` gives every usable page its kind and its shard; a usable page without one fails.
- `tests/first-view.known.json` holds, for each page over its kind's budget, its allowed counts: the worst of the three
  plan households, words rounded up to the next ten, and the same for the empty plan.
- A page with no entry must meet its budget. A page with an entry fails when a count rises above it. A count below its
  entry prints "lower me" (never a failure).
- `CLAUDE_A_LANE` (claude-a's 13 folders, as `tests/wording.test.mjs` lists them) prints to-do lines and is kept out of
  every total that may only go down.
- `CANNOT_DRAW` may only shrink. At `707355c` the counter cannot draw ten views: `household/people`,
  `household/calendar`, `investments/allocation`, `investments/employer-stock`, `investments/crypto`,
  `insurance/term-vs-permanent`, `insurance/health`, `system/settings` (`api.ready().then`), and `goals/vehicle`,
  `property/vehicles` (they draw nothing). C2 adds the missing stand-in pieces (`insertBefore`, `before`,
  `CSS.escape`, a `select`'s first value, `api.ready` as a promise) to `qa/fixtures/fake-dom.mjs` and the test's `ctx`.
- `node qa/first-view-node.mjs --write` rewrites the file after a deliberate change; its diff is read like code.

**Where it starts** (this spec's kinds, at `707355c`, `$O/spec-work/digest.json`): 98 of the 149 pages it can draw are
over their kind's budget (answer 64, list 27, settings 4, form 3); 54 are over on the empty plan.

**The structure checks**, on the same drawings:

| id | check | rule |
|---|---|---|
| S1 | no part inside a part, except a form's "More details (optional)" and a part whose rows open | R11 |
| S2 | at most five parts; three or more in one `[data-parts]` card; order `more`, `own`/`figures`, `how` | R12 |
| S3 | a status is at most 20 characters and uses the four spellings for the person's state | R25, R26 |
| S4 | a title is a vocabulary phrase, a pinned title (a list in the test), or a named `own` part on a page with several | R24 |
| S5 | no `.notice` (any kind), `.guess` mark, `[data-worth]` line or `required` box inside a shut part, unless listed in `MOVED_NOTICES` with a reason | R9 items 3 to 6, 9 |
| S6 | at most one filled button outside shut parts; inside a part, only its form's Save | R9 item 2, R18 |
| S7 | every part's body holds two figures, three rows or forty words | R14 |
| S8 | opening and shutting every part calls `store.update` zero times | R16 |
| S9 | every form with a `more` field, submitted shut and open, writes the same plan; no folded field has `guess` or `required`; no view passes `moreOpen: false` (a source scan for `moreOpen:` followed by `false` or `!!`) | R21, R22 |
| S10 | an adopted view (one that imports `core/ui/more.js`) draws no `<details>` without `data-part`, except `details.form-more` | R10 |
| S11 | after a save, only the saved part's `open` differs from before (in each adopted page's own module test, which has the page's save handler; the shard checks that the test exists) | R17 |
| S12 | no text node reads "null", "undefined", "NaN" or "[object Object]" | F7 |
| S13 | **same markup**: an adopted view drawn with `planner.more` empty and drawn with every part forced open and `ui.setMoreOpen(true)` holds the same words, figures and box names once `open` is removed | G5, R30 |
| S14 | every `opens:` and every box a step of `modules/overview/guide/journeys.js` names is drawn by its page for its household, and the box is the first in its part | R9 item 7, R13, F9 |
| S15 | no `input`, `select` or `textarea` inside `[data-parts]` outside a `form` | R32 |
| S16 | with `guide=plan`, the "More on this" card is one row | R6 |

**How it fits `npm test`'s time.** Measured on this 4-core machine at `707355c`: the whole count, 159 views for four
households in one Node process, took **19.6 s** of wall time (`$O/spec-work/fv-707355c.json`; the inline designer
measured 33 s wall and 20 s of processor time on a busier run). `tools/run-tests.mjs` hands every `*.test.mjs` below
`tests/` to one `node --test`, which runs files side by side; so the check is **six shard files**
(`tests/first-view/1.test.mjs` to `6.test.mjs`, about 27 pages each, split by topic in the kinds file), each importing
the shared library once. Expected: about 4 to 6 s per shard and about 25 s of processor time in all, more as pages adopt
the helper (S13 draws an adopted view twice). Rule: no shard may take more than 15 s on this machine (the test prints
its own time); a shard that passes 15 s is split in the same commit. The browser check is not in `npm test`.

### 5.3 `qa/first-view.mjs`: the first screen in a browser (C2)

The census script (`$O/census.mjs`, 3 min 10 s for 954 page views) with budgets on top, run at the start of every phase
beside `node qa/smoke-all.mjs`, and before a push that touches a view. For every page in the household's menu, the same
households, 390 x 844 and 320 x 568, in the sandbox, touch taps:
- the first screen's words, figures and filled buttons against R1's last column; the headline and the filled button
  wholly above the bottom edge; nothing runs off the side at 320;
- on the path's steps (`?guide=plan`), the shell's Next within 1,688 px of the top (R6);
- every part opened by a tap: the page moved 0 px, the row at least 44 px, the open part at most 1,300 px (R15);
- the saved plan and every stored key except `planner.more` byte-identical afterwards (R16, R31);
- one round trip of the memory per page: open a reading part, reload, still open; shut, reload, shut; `planner.more`
  empty again;
- once more with `?more=all`: no sideways scroll, no target under 44 px, at most one filled button per view.
It writes `qa/first-view.known.json` with the same only-down rule and a table that compares a before and an after.

### 5.4 What the checks cannot see

Meaning. A page can meet every number and still fold the wrong thing or use a word a layperson does not know. Rule 13
stays: the 390 px screenshot is read before a page is called done, and the never-folded list is read by eye. The cheap
test of `research.md` 4 goes with it: can a first-time person do the page's job without opening anything?

---------------------------------------------------------------------------------------------------------------------

## 6. The page plan

### 6.0 Classes

- **A, fine**: inside its kind's budget for the three plan households and the empty plan, leads with its answer or its
  job, at most one filled button. Work: none, or a mechanical change of a hand-written fold into `part()` (S10) when
  the page is touched.
- **B, small**: the headline is already right (or the page is a list, form or settings page); the first view is too
  long, has a second filled button, an input fold that starts open, or a form over five boxes. Work: fold into named
  parts, cut a list at six, fold a form's optional boxes, demote a button, reorder. No new sentence.
- **C, rework the first view**: the page has figures but leads with its title or a bare figure, or its headline is not
  what happens to the person, or a what-if page shows its whole form after it has an answer. Work: write the headline
  and one sentence per case (R3, R5, with a test per case), then fold as for B.

Counted from `$O/spec-work/digest.json` (each page's counts at `707355c` and the cards the census saw on it) and read
page by page; the classes are in `$O/spec-work/final.mjs`.

| who may edit | pages | A | B | C |
|---|---|---|---|---|
| claude-b now (6.1) | 126 | 39 | 50 | 37 |
| held: claude-f's claim row (6.2) | 10 | 2 | 7 | 1 |
| held: claude-b's own work in flight, wave 1 and the retirement request (6.2) | 10 | 2 | 3 | 5 |
| claude-a's 13 folders: hand-over (6.3) | 13 | 4 | 7 | 2 |
| **all usable pages** | **159** | **47** | **67** | **45** |

`taxes/withholding` is free since `707355c` (claude-f's MR-7 row was removed as finished); claude-f's remaining row
(since 2026-11-11) is stale by `docs/TEAM.md` rule 2 ("A claim older than a day is stale") from 2026-11-13 02:46 UTC, but
claude-b writes to claude-f and claude-r on the workboard before taking it (C20).

In the tables: "keeps" is the first view; "one tap away" is each part with its phrase and kind. Every B and C page
also gets the "More on this" card where it has deeper pages (rows as questions, G8) and its parts in one card (R12).

### 6.1 claude-b now: 126 pages

**overview** (4; A: `overview/setup`, the questions one per screen, owner 2026-11-06)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `overview/quick` | B | the questions as rows; the first six with a one-line answer each | "N more questions" (`rest`); the "More questions" card joins it | empty plan 417 words today: one sentence and the six rows |
| `overview/benchmarks` | B | "Ahead on 3 of 6" + one sentence naming the one furthest behind, with its link | "5 more numbers" (the other comparisons); "How this is worked out" (the rules of thumb, sourced and dated) | 365 words, 28 figures |
| `overview/timeline` | B | "Your next 59 years" and "Savings along the way" | "N more years" after the first six moments (`rest`, lazy above 40) | report kind; 8.3 screens today |

**household** (5; A: `household/contacts`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `household/people` | B | the Household and Taxes cards | on the empty plan, the add form's first five boxes, the rest in "More details (optional)" | cannot draw in Node yet |
| `household/life-events` | B | the events as outlined rows | "Where the deadlines come from" (named `how`) | six filled buttons today: none filled (the events are choices, not the page's action) |
| `household/documents` | B | "Where your papers are" + how many are still to find | each group a shut `item` row ("Who you are · 0 of 8", open today); "Good places to keep papers" (`how`) | 2.5 screens |
| `household/calendar` | B | this month and next; "Your reminders" with its add | "N more months"; "Your paydays · not set yet" (`own`) for today's open payday boxes | two filled buttons → one; cannot draw in Node yet |

**balance** (6; A: `balance/update`, an exception listed in the kinds file: one box per account is the page's job,
and the check-in's "Save today's totals" lands there)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `balance/net-worth` | B | the figure + one sentence ("You own $572,700 and owe $285,600"); the first six accounts with Edit and Delete (owner); "+ Add another account"; Over time with "Save today's totals" | "2 more numbers" (cash or easy to sell; invested for later); "N more accounts" (`rest`, a guessed row never hidden); add form "More details (optional) · bank, date, whose"; "N more totals" after six saved totals | a result of the path; `design-inline.md` 5.4 |
| `balance/accounts` | B | the account's balance, its date, money in and out | "Balances by day · 0 saved" (`own`, shut; open with 4 boxes today); "Notes" (`own`) | |
| `balance/liquidity` | C | one sentence per case ("Your cash covers about 1 month of bills" / "about 6 months: enough for now", R4-11's words); the next move with its one filled button and its one box | "3 more numbers" (usable today, sellable within a week, locked up); "How this is worked out" (which accounts count, by group) | a step of the path; bare figure today |
| `balance/assets` | B | the total; "Worth a look" (warnings stay); the home; the first six belongings | "N more belongings"; the add form behind "+ Add another" (10 boxes showing today) with "More details (optional)"; "How this is worked out" (worth now) | |
| `balance/liabilities` | B | "You owe $285,600" + one sentence; the amber costly-card line and its button; each debt one line: name, rate, paid off by, balance, Edit › | "3 more numbers" (paying a month, interest a month, payments against income); "How this is worked out" (each row's long sentence, the tax and insurance in a payment) | `design-inline.md` 5.10; end dates never folded |

**cashflow** (11; A: `cashflow/income-statement`, `sinking-funds`, `subscriptions`, `spending`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `cashflow/expenses` | B | a month; left over each month; the owner's one sentence for next year (2026-09-16) | "Set your month in one number" (`own`); "See or change each bill · 13 bills" (pinned: a guide step and a test name it); "How this is worked out" (the left-over sum, each figure a link); the bill form: what, amount, how often, category, then "More details (optional) · must-pay, dates" | step 2 of the path; saving the one-number month no longer opens the bill list (R17); two filled → one |
| `cashflow/income` | B | the month after tax; who brings in what; the first six incomes | "N more incomes"; the add form's "More details (optional) · raise, end date, notes" | empty plan: 9 boxes today → 5 |
| `cashflow/budget` | C | a sentence per case ("Under budget in 5 of 7 envelopes this month" / "Over on groceries by $40"); the envelopes that are over first | "N more envelopes"; "Start from your expenses" becomes one outlined button once a budget exists | leads with its title |
| `cashflow/budget-percent` | B | "Your month after tax" + one sentence with the three shares | "N more numbers" (the "Needs, wants and savings" card); the Needs and Wants folds (`item`) and "The split to aim for" (pinned) in one parts card | 35 figures |
| `cashflow/recurring` | C | "$X a month in regular bills and payments" + the six biggest | "N more bills" | leads with its title, 30 figures |
| `cashflow/forecast` | C | "Lowest point: $X on <date>" or "Never below $X"; the chart with the lowest day marked (owner, pass 2 round 9) | the months as today (first open, others folded, owner); "N more payments" after six in "What is expected"; the starting balance boxes in "Set my own numbers" | leads with its title |
| `cashflow/paycheck` | B | per person one line: "Ana takes home $2,888 every two weeks" | per person "How this is worked out" (the paycheck's lines); "Ana: W-4 and deductions" (named `own`, 13 boxes) per person | 2.8 screens |

**transactions** (8; A: `ledger`, `rules` (an empty list keeps its add form), `categorize`, `statements` (needs the
computer; not offered otherwise), `reconcile`, `transfers`, `duplicates`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `transactions/categories` | B | the first six of Spending and of Income | "N more categories" per group | 2.8 screens |

**debt** (5)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `debt/payoff` | B | "Debt-free by March 2039" + one sentence (the monthly amount, the order); the one filled action; one line per debt with its end month; the extra-a-month box | "How this is worked out" (the three orders, same money) | a step of the path |
| `debt/mortgage` | C | a sentence per case ("Paid off in March 2049: $1,980 a month, $340 of it tax and insurance"); the "What if" extra-a-month box | "How this is worked out" (how the years left were worked out); "N more years" after six schedule years; refinance moves to "More on this" | 66 figures, 3.3 screens |
| `debt/refinance` | C | before an answer, the offer form (4 boxes); after: "Refinancing saves about $X; it pays for itself in N months" / "Not worth it at this rate" | "The figures" (the offer) once answered | what-if (R8) |
| `debt/credit-cards` | B | "$9,800 on 3 cards" + which to pay first; each card one line: balance, rate, paid off by | each card's "Pay more, or move this balance to a 0% card" (`item`, pinned `.cc-more`); "If payments are too much · free help" (`how`); "Moving a balance to a 0% card" (`how`) | 36 figures |
| `debt/ratios` | C | "Lenders would see N% of your income going to debts: <usually fine / high>" | "3 more numbers"; "How this is worked out" (the ratios, 843 px) | leads with its title |

**goals** (4)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `goals/goals` | B | the total toward goals + one sentence; each goal one line with its progress | the goal form's hand-made fold becomes the kit's `more: true` (the same "More details (optional)") | a result of the path |
| `goals/house` | C | a sentence per case ("A $400,000 home in 2029 fits your income" / "needs $X more a month"); "When you get there" (the monthly cost) | "The figures · $400,000" shut once the page has an answer (12 boxes, open today); "2 more numbers" (what your income supports); "How this is worked out" (the price broken down) | a step of the path; empty plan: five boxes and "More details (optional)" |
| `goals/education` | B | the total to save; one line per child (from YEAR, $ a month) | per child "Type of college and share to cover" (named `own`) and "How fast prices rise" (`own`) in one parts card; "How this is worked out" (Good to know) | a step of the path |
| `goals/prioritizer` | B | "$4,834 a month for goals" + the first six as divided | "How much for goals" (named `own`, already) | |

**retirement** (16; A: `retirement/rmd` (a step; "How this is worked out" is pinned: only the `part()` change),
`retirement/fire`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `retirement/social-security` | B | "$66,600 a year from Social Security" + one sentence (the claiming ages); the first person's fold open (owner, pass 4) | the other persons (`item`); "How this is worked out" | |
| `retirement/pensions` | B | the pensions | "+ Add another pension" once one exists: five boxes, "More details (optional) · survivor, raises" | empty plan 8 boxes today |
| `retirement/annuities` | B | the quotes | "Add a quote": five boxes and "More details (optional)"; "How this is worked out" (Good to know) | |
| `retirement/cash-flow` | B | the hero sentence, the two pickers, the first six years | "N more years" (`rest`; the owner's one collapsed row for the empty years stays) | report kind; 5.3 screens |
| `retirement/withdrawal-strategy` | B | the one plain answer for the first retirement year (R4-17) | "3 more ways" (`rest` over the four ways); "How this is worked out" (pinned) | a step; two filled for the retired → one |
| `retirement/withdrawal-order` | B | the headline + what the best order saves | "3 more orders"; "How this is worked out" (Why it matters) | |
| `retirement/roth-conversions` | C | a sentence per case ("Converting about $X a year until 73 saves about $Y of tax" / "Converting would not save you tax") | "N more years" of the table after six; "How this is worked out" (pinned); "Conversion settings" (named `own`) | leads with its title |
| `retirement/monte-carlo` | C | "The money lasts in N of 100 runs" + one sentence | "N more numbers" (the range, still funded at); "How this is done" (named `how`) | two filled → one |
| `retirement/historical` | C | "Starting in any year since 1928, the money lasted in N of M" + one sentence | "N more numbers" (the hardest starts); the chart stays | two filled → one |
| `retirement/sequence-risk` | C | a sentence about the person ("A bad first ten years could leave about $X less at 85") | "How this is worked out" (same years, three orders) | |
| `retirement/healthcare` | B | "Before Medicare" + one sentence with the yearly cost | "Premium and rules · national estimate" (named `own`) | empty plan 124 words: trim |
| `retirement/medicare` | C | "Medicare from <month year>: about $X a month for the two of you"; the income surcharge as an amber line when it applies | "4 more numbers" (what it costs); "The income surcharge" (named `how`); "N more years"; "Your plans' premiums" (`own`); "Health insurance through a job" only when it applies | 3.8 screens, 61 figures |
| `retirement/longevity` | C | "Plan for the money to last to 95: about a 1 in 4 chance one of you lives that long" | each person (`item`); the four boxes in "Set my own numbers" | 3 screens |
| `retirement/buckets` | C | "When you retire (2067): $X in cash, $Y in bonds, the rest invested" | "How this is worked out" (the withdrawals it covers, keeping them full); "Years in each bucket" (`own`) | |

**investments** (14; A: `rebalance`, `fees`, `performance`, `dividends`, `asset-location`, `tax-lots`,
`employer-stock` (cannot draw in Node yet))

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `investments/holdings` | B | the holdings | the add form (9 boxes): five and "More details (optional)"; "Import a positions file" (`own`) | |
| `investments/allocation` | B | "Your mix against your target" + one sentence | "Your target mix · not chosen yet" shut (open today, 7 boxes, 2 filled buttons); inside, chips first and "Type my own" | cannot draw in Node yet |
| `investments/glide-path` | C | "N% in stocks now; about M% when you retire, on your plan's path" | "N more ages" (the milestones, 1,136 px); "Which path to measure against" (`own`) | 50 figures; empty plan 273 words |
| `investments/risk` | B | "A bad year could take about $22,752" + one sentence + the first line of what to do | "4 more mixes" (the standard mixes on your money); "How this is worked out" (the rest of what to do) | 61 figures |
| `investments/backtest` | B | the headline, the mix chips, the growth chart | "N more numbers" (side by side) | |
| `investments/crypto` | B | the coins | "Add a coin" open only while the list is empty, then "+ Add another coin" | cannot draw in Node yet |
| `investments/limits` | B | "$40,680 of tax-advantaged room left this year" + one line per person with the next deadline | "How this is worked out" (the 2026 limits, each with its source and date); "Roth IRA: how much can go in directly" (named `how`); "N more deadlines" | 430 words |

**taxes** (7)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `taxes/federal` | C | `design-inline.md` 5.1 as built, plus: the child care line when a credit is to be had (R9 item 6); "Federal tax withheld so far" first in its part (R13); the green line names the new headline (R7); no "See the estimated payments" when nothing is owed; inside "Figures the plan cannot see", that box and "Save figures" first, the other eight boxes under "More details (optional) · other income, credits" (R11's form exception) | "4 more numbers"; "Figures the plan cannot see" (pinned); "Itemized deductions"; "Year and people"; "How this is worked out" (the walk, what it leaves out, the sources; "What the plan already knows" moves to the Tax report, linked) | a step of the path; the prototype exists |
| `taxes/withholding` | B | "You would likely owe about $5,253 in April" + one sentence + one filled button (two today) | "What a paycheck withholds" (pinned by a guide step; shut unless the step or the person opens it); "How this is worked out" (how the W-4 works now); "The figures" (each return) | the action stays on the first view when Needs attention opens it (V9) |
| `taxes/capital-gains` | C | a sentence per case ("No tax on what you sold in 2026" / "About $X of tax on this year's sales"); the "If you sold one more thing" chips | "3 more numbers" (tiles five to seven); "The figures" (a sale in 2026, 6 boxes); "How this is worked out" (how the rates work) | empty plan: two filled → one |
| `taxes/brackets` | B | "You are in the 22% bracket" + what the next dollar costs + the chips | "3 more numbers"; "How this is worked out" (the 2026 brackets, sourced and dated) | 60 figures |
| `taxes/estimated` | B | the headline; the next payment's date and amount; one filled button (three today) | "3 more payments"; "Last year's return · not entered" (`own`, shut; open today) | a deadline is never folded |
| `taxes/projection` | B | the headline and the chart | "N more years" after six | report kind; 5.6 screens |
| `taxes/hsa-fsa` | C | a sentence per case ("You could put $X more in your HSA this year and save about $Y of tax") | "This year's figures" (`own`, shut once anything is set; 980 px open today); "How this is worked out" (why an HSA comes first) | empty plan 387 words |

**insurance** (8; A: `insurance/cash-value`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `insurance/policies` | B | the policies | the add form (12 boxes; open while the list is empty): five and "More details (optional)" | |
| `insurance/life-needs` | B | the headline + one line per person with the gap | per person "How this is worked out" ("If Ana died this year"); "Two rules of thumb, for comparison" (per person, already) | a step of the path; 514 words |
| `insurance/term-vs-permanent` | C | before an answer five boxes and "More details (optional)"; after: "Term and investing the rest leaves about $X more at 65" | "The figures" (from the illustration) | cannot draw in Node yet |
| `insurance/disability` | C | per person: "If Ana could not work, you would be about $X a month short" | per person "How this is worked out" | bare figure today |
| `insurance/health` | C | "The Silver PPO costs you least: about $X a year" | "Your coverage and your bills" (`own`, shut; open today); "+ Add another plan" with five boxes and "More details (optional)" | cannot draw in Node yet |
| `insurance/ltc` | C | "A nursing home from 85 would cost about $X; your plan can pay N of the years" | "N more numbers" (what care costs); each person (`item`); "The care to plan for" (`own`) | |
| `insurance/property` | C | "2 of 5 checks need a look" + those two | "3 more checks" | leads with its title |

**estate** (5)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `estate/beneficiaries` | C | "6 accounts and policies have no one named" + the list | - | six filled → one |
| `estate/estate-tax` | C | "No federal estate tax: your estate is about $X under the limit" (the limit from the page's own sourced table) | "How this is worked out" (today "How the tax is worked out"); "N more numbers" (the two deaths, the end of the plan) | bare figure today |
| `estate/gifting` | C | "$X given this year, all under the yearly limit" | "+ Add another gift" with five boxes | empty plan 6 boxes |
| `estate/inheritance` | B | what you might receive | "How this is worked out" (good to know) | its five-box form is the form budget |
| `estate/digital` | B | "Your digital life" + three lines of "Start here" | the rest of "Start here" in "How this is worked out" | empty plan 191 words |

**property** (6)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `property/home` | C | "Your home: worth about $380,000; $X of it is yours after the mortgage" | "The home's details · what you paid" shut once filled (10 boxes, open today); "N more numbers" (a year of owning it); "How this is worked out" (if you sold today); "N more years" (ahead); "Update its value" (`own`) | |
| `property/rent-vs-buy` | C | a sentence per case ("Buying comes out ahead after 7 years" / "Renting stays ahead for 10 years") | "The figures · $400,000, $2,200 rent" shut once answered, chips or the plan's figures first and "Set my own numbers" for the rest; "N more years"; "N more numbers" (the first year, a month) | 17 boxes, 3.9 screens |
| `property/rental` | B | the rentals; the add form as `design-inline.md` 5.8: five boxes and "More details (optional) · other costs, the loan" | | 21 boxes today |
| `property/vehicles` | B | the cars; "Keep, buy or lease: the next 5 years" | "Change its details" (`item`); "The new car and the lease" (`own`); "+ Add another car" as the settled button, not a fold | cannot draw in Node yet |
| `property/purchase` | C | "Pay cash in March, or save $X a month for 8 months" | "The purchase · what and when" shut once answered; "2 more ways" | |
| `property/renovation` | C | "A home-equity loan costs least: about $X a month"; a cushion warning stays | "The project" (`own`, shut once set); "The offers" (`own`); "2 more ways" | |

**career** (6)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `career/salary` | C | "Your pay together: about $X next year, $Y in ten years (in today's dollars)" | "2 more numbers" (tiles five and six); each person one line, then `item`; "Raises and promotions" (named `own`, per person); "What raises usually are" (`how`) | 3.6 screens |
| `career/equity` | B | the grants | "The company" (`own`); "Grants" open while none, else "+ Add a grant"; "Purchase-plan shares" (`own`) | two filled → one |
| `career/side-income` | C | "Set aside about $X of every $100 you earn on the side" | "The last 12 months" (`own`): a chip "About the same each month" with one box first, "Type each month" shows the twelve; "How this is worked out" (forms and records) | 12 boxes open today |
| `career/business` | C | a sentence per case ("As an S corporation you would keep about $X more a year" / "Stay as you are for now") | "The business" (`own`, shut once set); "Expenses" and "S corporation figures" (`own`); "How this is worked out" (the two tax cards); retirement plans for the business in "More on this" | 4.2 screens; two filled → one |
| `career/offer-compare` | C | before an offer five boxes and "More details (optional)"; after: "The offer leaves you about $X a year better off in the first year" | "Your job now: the figures" (`own`); "How it compares · 4 years" (`more`) | 18 boxes |
| `career/human-capital` | C | "Your future pay is about 95% of what you are worth" | each earner (`item`); "N more numbers"; "How steady is each job?" (`own`) | bare figure today |

**scenarios** (3; A: `scenarios/compare`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `scenarios/stress-tests` | B | the headline + each shock that breaks the plan, one line each (alarms) | "N more shocks" (the ones it survives); each shock's detail (`item`, shut; ten open today); "How these are worked out" (named `how`) | 7.6 screens, 20 tiles |
| `scenarios/advisor-plan` | C | before an answer five boxes and "More details (optional)"; after: "Their plan lasts to 95; ours runs out at 88" | "The figures" (from their report, 1,805 px) | 16 boxes |

**reports** (6; A: `plan-summary`, `statements`, `retirement`, `tax`, `annual-review`: print sheets, report kind,
structure checks only)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `reports/export` | B | what it is for, the whole plan as one file | "N more tables" after six in "What you typed in" | |

**ai** (6; A: `explain`, `categorizer`, `critic`, `glossary` (a reference list: report kind, search first), `notes`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `ai/assistant` | B | the question box and one filled "Ask" (two filled today) | "Show details" (`tech`) | offered only while the helper answers |

**system** (6; A: `docs`, `diagnostics` (builder pages), `backups`, `audit`)

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `system/settings` | B | Plan basics (first, open, as the owner reviewed it); **How much to show** (new, second, 1.5); Pages; Your data; Advanced (last, folded) | the topic rows of Pages as today | cannot draw in Node yet (`api.ready().then`) |
| `system/help` | B | "How this app works"; "Questions people ask", which gains "Can I see more on every page?" ("Yes. Tap any row under an answer to open it where it is. To have every page show how it is worked out, or every form all its boxes, use Settings › How much to show. Nothing in your plan changes.") | "Your plan has the basics" (636 px) becomes one line and a link | |

### 6.2 Held by another session (20 pages)

**claude-f's row** (`docs/TEAM.md`, since 2026-11-11; stale from 2026-11-13 02:46 UTC). A: `overview/start`,
`overview/guesses` (its groups through `part()` as `item`).

| page | class | keeps | one tap away | note |
|---|---|---|---|---|
| `overview/dashboard` | B | the greeting, the three verdict rows and the one filled button (owner N8; the walks' model) | "Fill in what you skipped" (586 px) as one row "N to fill in ›"; "What's in your plan: 3 of 6 basics" (the owner's folded line) | 200 words, 11 figures |
| `overview/plan` | B | the verdict; "What to do next"; the gaps (owner N6) | "Make it fit you better" and "Keep it up to date" as rows; "What we're counting on" stays where it carries guess marks; once the path is finished, one quiet line: "Want more on every page? Settings › How much to show" (G11) | the end of the path |
| `overview/guide` | B | the guide for the person's stage first | "Other places to start" as rows of one card | 316 words |
| `overview/alerts` | B | every alarm | "Fine for now" and "Housekeeping" as parts | |
| `overview/next-best-action` | C | "Your next move: <move>, $X a month until <month>" | "N more moves" after the first three; "N more numbers" (each month's money); "How this is worked out" (why this order) | 660 words, 3.8 screens |
| `overview/health-score` | B | the score + the two parts that pull it down most | "5 more numbers" (all seven parts); "How this is worked out" (today "How the score is worked out") | |
| `overview/monthly-review` | B | the month's steps (nine words to trim) | "N more months" (months checked in) | |
| `estate/documents` | B | the papers that protect the family; the first six | one filled button (27 today), the rest outlined; "N more documents" | |

**claude-b's own work in flight.** Wave 1 holds `overview/pages`; the retirement request holds the other nine. They
apply the rule in their own fix rounds; after each lands, C19 checks it against this spec and converts its hand-written
folds. A: `ai/reader` (L7: "Read it from a pay stub ›"; a Roth 401(k) line read apart), `transactions/import` (L8: no
column mapping for Quicken files; the columns stay behind the owner's "Columns worked out for you. Change them ›").

| page | class | check after it lands | note |
|---|---|---|---|
| `retirement/projection` | C | headline per case; "What this rests on" (L2) open when the verdict is short or tight, else shut with its status; "Retirement settings" (pinned); the leftover row read-only (L4); its "Go deeper" card heading becomes "More on this" (one line and its test pins) | a step of the path |
| `retirement/contributions` | B | `design-inline.md` 5.6; "Later / Now / Some of each" as chips per row (L6), the exact split behind "Type my own"; one filled button (two today) | |
| `scenarios/goal-seek` | C | the headline per case (L1); "How it is worked out" → "How this is worked out" | a step of the path |
| `scenarios/sensitivity` | C | "We don't know yet" gate (L1); the table after six rows "N more numbers" | |
| `system/assumptions` | C | Careful / Middle / Hopeful as chips (L5) through `choice()`; one filled "Save and mark as reviewed" (owner round 17); the review notice (owner); "Where these numbers come from" (owner's title) | 10 boxes |
| `estate/legacy` | B | "+ Add someone" once someone is added | |
| `career/benefits` | C | "Your 401(k) for 2027" as the answer; six folds today into one parts card of five ("Whose benefits" becomes chips at the top) | |
| `overview/pages` | B | the search box first; each topic a row that opens (R11's exception); a topic holding a match opens | 19.8 screens; wave 1's file until it lands |

### 6.3 claude-a's 13 folders: a hand-over

claude-b never edits these (claude-a's last workboard message is from 2026-10-30; five hand-overs wait). One file,
`docs/handoffs/2026-11-13-optional-claude-a.md`, in the form of `docs/handoffs/2026-11-11-touch-claude-a.md` ("How to
work through it" on top: read `docs/OPTIONAL.md`, import the helper, the eight steps of 3.16; then per page "To see
it", "Seen", "Should", "Cause" with file and line), and one workboard line `claude-b -> claude-a`. The check lists the
folders as `CLAUDE_A_LANE`: to-do lines, outside every only-down total. What reaches them with no edit: print (3.12),
find-in-page, wave 1's memory, the forms switch on any `more` field, and the links from other pages. What does not: the
working switch on their hand-written folds. A: `debt/student-loans` ("Next" card → "More on this"; "The rules as of
2026" → "How this is worked out"), `taxes/filing-status`, `balance/statement` and `cashflow/statement` (report kind).

| page | class | should | note |
|---|---|---|---|
| `goals/emergency-fund` | B | keeps the months covered and its move; "How this is worked out" (where to keep it, 365 px) | |
| `goals/vehicle` | B | keeps the payment answer; "The figures" shut once answered (open today); "How this is worked out" (the 20/4/10 rule) | "Next" → "More on this"; draws nothing in Node |
| `goals/travel` | B | the trips; the add form (9 boxes): five and "More details (optional)" | "Next" → "More on this" |
| `goals/charitable` | C | "Giving $3,000 a year; giving it as <way> saves about $X of tax"; "The figures" shut once answered; "How this is worked out" (give the same, pay less) | empty plan 239 words, 14 figures; "Next" → "More on this" |
| `debt/consolidation` | B | the best way as the answer; "The figures" (each way, until debt-free); "Which debts" and "The offers" (named; a guide step names "The offers") | |
| `taxes/state` | B | the answer; "How it is worked out" → "How this is worked out"; "On your federal return" and "Your figures" (named; a guide step) in one parts card | "Next" → "More on this" |
| `taxes/self-employment` | B | the tax and "Pay it during the year" (the action); "Shelter some of it for retirement" as a part or a link; "Business expenses" (`own`) | |
| `taxes/documents` | B | the first six documents, "N more documents"; the empty plan one sentence | "Next" → "More on this" |
| `balance/projection` | C | "In 2061 you would have about $X in today's money"; "The figures" (along the way); "N more numbers" (what makes it up) | "Next" → "More on this" |

---------------------------------------------------------------------------------------------------------------------

## 7. The build order

**Before anything: wave 1 on the shared branch and through the main gate** (`judge-build.md` 7.1: every "safe" result
was measured on wave 1; without it a part opened by hand shuts after a save). Every commit below: a claim row in
`docs/TEAM.md` for its views, removed when it lands; `npm run registry`, `npm test`, `npm run check`,
`node tools/leak-guard.mjs --worktree`; `node tools/shot.mjs` at 390 and 320, light and dark, and with `--more`, read;
the page walked once in the sandbox (open a part, reload, Back, save inside a part); README, CHANGELOG line; `main`
moves only by `git push` through the gate, and `core/ui/more.js` is on `main` before or with the first page that
imports it. Each is shippable alone: a page not yet converted is only longer, never wrong.

**The ten most valuable first**

| # | commit | files | visible to the owner | depends on |
|---|---|---|---|---|
| C1 | **The helper and its rule book** | new `core/ui/more.js`, `tests/more.test.mjs`, `docs/OPTIONAL.md`; `docs/DATA_MODEL.md` "Not in the plan"; three lines in `docs/CONVENTIONS.md`; `modules/_template`; the agreement cases of 3.11 in `tests/place.test.mjs` | nothing | wave 1 |
| C2 | **The check** | `qa/first-view-lib.mjs`, `tests/first-view/1..6.test.mjs`, `tests/first-view.kinds.mjs`, `tests/first-view.known.json`, `qa/first-view-node.mjs`, `qa/first-view.mjs`; additive stand-in pieces in `qa/fixtures/fake-dom.mjs`; `tools/shot.mjs --more` | nothing | C1 |
| C3 | **Federal estimate** | `modules/taxes/federal/{view.js,README.md,module.test.mjs}` and the two source-text pins (`tests/wording-left.test.mjs`, `tests/wording-review.test.mjs`); one `docs/DESIGN_LOG.md` entry, "Builder chose" (the rule's first page, the vocabulary, the never-folded list) | the model answer page: "You would owe about $5,253 in April", five rows, the links as questions | C1, C2 |
| C4 | **Expenses and the bill form** | `modules/cashflow/expenses/*`; in `core/ui/dom.js` the kit's `moreSays` and "`more` ignored on a field with `guess`" (claude-b's file once wave 1 has landed) | step 2 of the path on one screen; the bill form at four boxes with Save in sight | C3 |
| C5 | **The add forms people use most** | `cashflow/income`, the account form (`balance/net-worth`), the debt form (`balance/liabilities`), `investments/holdings`, `insurance/policies`: `more: true` and `moreSays` only | forms open short | C4 |
| C6 | **Every free working fold through `part()`** | the hand-written "How this is worked out" / "How this is done" / source folds of the free pages (rmd, roth-conversions, withdrawal-strategy, monte-carlo, estate-tax, assets, life-events, healthcare, fire, glide-path, human-capital...), titles unchanged: no first-view change | nothing, except that these folds now follow the working switch | C1 |
| C7 | **Settings: How much to show** | `modules/system/settings/*` (the card; "Erase the copy on this device" clears `planner.more`); `core/app.js` one line `detail.init(ui)`; `system/help` (the new question); the log entry gains the card | **the owner's toggles** | C3 to C6 (so the card's words are true where it opens anything) |
| C8 | **Net worth and Debts** | `balance/net-worth`, `balance/liabilities` | the list rule: six rows, "N more accounts" | C1, C2 |
| C9 | **Pay off debts and Emergency fund** | `debt/payoff`, `balance/liquidity` | two steps of the path, answer first | C1, C2 |
| C10 | **The other free steps of the path** | `insurance/life-needs`, `retirement/withdrawal-strategy`, `goals/house`, `goals/education` (one commit each) | the whole free path short | C1, C2 |

**Then, one page or one small family per commit, heaviest first inside each batch** (by distance over budget):

| # | commit | pages |
|---|---|---|
| C11 | the claude-a hand-over file and its workboard line | `docs/handoffs/2026-11-13-optional-claude-a.md` |
| C12 | tax pages | withholding, estimated, capital-gains, brackets, hsa-fsa, projection |
| C13 | debt pages | mortgage, credit-cards, refinance, ratios |
| C14 | retirement | medicare, longevity, social-security, withdrawal-order, roth-conversions, monte-carlo, historical, sequence-risk, buckets, healthcare, pensions, annuities, cash-flow |
| C15 | home and goals | home, rent-vs-buy, purchase, renovation, rental, vehicles, goals, prioritizer |
| C16 | career | salary, business, offer-compare, side-income, equity, human-capital |
| C17 | investments | risk, glide-path, backtest, limits, holdings (list part), allocation, crypto |
| C18 | insurance and estate | policies (list part), term-vs-permanent, disability, health, ltc, property; beneficiaries, estate-tax, gifting, inheritance, digital |
| C19 | the rest of the free pages, then the retirement request's nine pages once they land | budget, budget-percent, recurring, forecast, paycheck; quick, benchmarks, timeline; household five; categories; stress-tests, advisor-plan; export; assistant; then 6.2's in-flight table, "Go deeper" → "More on this" |
| C20 | claude-f's ten | a workboard line `claude-b -> claude-f, claude-r` first; if no answer and the row is stale, claim and build: Dashboard first, then Your plan with the G11 line |
| C21 | after a design review of the first ten pages | tighten any budget that most pages met easily; move the helper's inline styles into one `base.css` rule |

---------------------------------------------------------------------------------------------------------------------

## 8. Acceptance walks

Run in the sandbox (`?sandbox=1` or `node tools/drive.mjs`), real touch taps, the kit's invented households, after C10
and again after C21. Each line passes or fails; a fail goes to `docs/FEEDBACK.md` with its screenshot.

### 8.1 A layperson (wants less)

| # | who, where | does | passes when |
|---|---|---|---|
| L1 | Ruth (`ruth`, retired, alone), 320 x 568, Federal estimate as a step of the path | reads | the headline is "No federal tax to pay for 2026" or the per-case sentence; nothing has to be opened to know the answer; no "See the estimated payments"; the page with its frame is at most 2 screens at 390 and Next is within 1,688 px; no tick box or setting is on the page |
| L2 | Ruth | opens "How this is worked out" out of curiosity, goes to the Dashboard, comes back the next day by the menu | the part is open again under the answer, the headline at the same height as before; Settings › How much to show says "You keep 1 part open on this phone" with "Shut them all"; one tap on the row shuts it, and the next visit opens short |
| L3 | Dana (`family`), 390, from the tax guide's step "Estimate this year's tax" | lands, types $12,000 in "Federal tax withheld so far", saves | the part is open on arrival, the box is its first, Save is on the same screen; the green line says "Saved. You would now owe about $1,730 in April."; the part stays open; no other part moves; the next evening the part is shut and says "1 set by you" |
| L4 | Dana, Expenses | taps Groceries' Edit, changes the amount, saves | the form shows what, amount, how often, category and "More details (optional) · must-pay, dates"; Save is wholly above 844 px with the keyboard shut; the green line confirms; the bill list did not open or shut anything else |
| L5 | Jordan (`jordan`, one parent of two, no child care entered), Federal estimate | reads | "Paying for child care so you can work? ..." with its link is on the first view |
| L6 | the retired couple who owe now (`retiredCouple`) | opens Federal estimate | the headline is the alarm ("$1,241 of tax is overdue now"); one filled "Plan the estimated payments" |
| L7 | Sam (`sam`, 24, renter), Get started then the path | walks to Your plan | every step's answer is on its first screen; Next on every step within 2 screens; Settings shows the new card with both ticks off, and Sam never needs it |
| L8 | any | opens and shuts every part on the path pages | the saved plan and every stored key but `planner.more` are byte-identical; no page moved under the finger |

### 8.2 A detail lover (wants everything)

| # | who, where | does | passes when |
|---|---|---|---|
| D1 | Kai (`family`, an engineer), Settings › How much to show | ticks "Show how answers are worked out" (1 tap) | a green line where the tick is; Federal estimate opens with "4 more numbers" and "How this is worked out" open and its three form parts shut with their statuses; Year by year shows all its years; still so after a reload, Back, a new visit and the next day |
| D2 | Kai | ticks "Show every box in forms" (1 tap) | the bill form shows 8 of 8 boxes; Add a rental all of its boxes; across the path pages no view has a second filled button and nothing scrolls sideways (the browser check with `?more=all` agrees) |
| D3 | Kai, Federal estimate | shuts "4 more numbers" by hand | it stays shut after a reload, on a new visit and the next day, although the switch is on; other pages unchanged; unticking and ticking the switch again opens it |
| D4 | Lee (`family`, does the taxes), every tax page | reads "More on this" | each tax page lists the other tax pages as questions with their answer under them ("What would more income cost? › 22% on the next dollar"); each opens its page; Back returns to the same spot |
| D5 | Lee | opens `#/taxes/federal?show=itemized` | the itemized part is open 68 px under the top bar with the focus on its summary; typing left there earlier is still in its boxes; nothing is stored in `planner.more` |
| D6 | Lee | types four itemized deductions and saves | the part stays open and says "4 set by you"; the green line names the new headline; shut, the row still says "4 set by you" |
| D7 | Kai, desktop Chrome | finds "taxable income" with the browser's find on a shut Federal estimate | the part opens on the match; after a reload it is shut again (find is not a tap) |
| D8 | Kai | prints Federal estimate | the PDF holds every part open; after printing, the parts and `planner.more` are as before |
| D9 | Kai | unticks both switches, then taps "Shut them all" | every page opens short again; Settings no longer shows the count line |

---------------------------------------------------------------------------------------------------------------------

## 9. Risks

| # | risk | how likely | what limits it | what would change the plan |
|---|---|---|---|---|
| 1 | **Pages drift open** through kept reading parts | real: with "4 more numbers" kept, the family's first screen holds 12 figures again (`design-inline.md` 5.1) | only reading parts are kept; parts sit after the answer in a fixed order, so the answer never moves down; 90 days unseen forgets; Settings shows the count and "Shut them all"; the budget is measured with nothing kept | a design review that finds the owner's phone long again: empty `KEPT_KINDS` (one line), parts then live for the visit only |
| 2 | **VoiceOver on an iPhone does not announce a part's state** | unknown: untested on a real phone; the app's `summary` hides its marker, which O'Hara 2022 names as a cause (`verify-web.md` 4.2) | native `<details>`, `summary` as a block with an inner flex row (GOV.UK's shape) | if it fails, the helper falls back to a button with `aria-expanded` and a region; the rules and words stay; find-in-page and print get worse. Test it before C12 |
| 3 | **The wrong thing is folded** (a check counts words, not meaning) | happened in the inline prototype (the child care line) | R9's list, S5 over every notice and `data-worth` line, rule 13's screenshot, the walks of section 8 | a tester's "I could not find X": move it to the first view |
| 4 | **Pinned words break** | certain: four pins on Federal estimate alone | titles a test, a step or the owner pins stay; sentences move whole; module tests read "outside" and "inside part X" | - |
| 5 | **Two switches double the states** | certain | both presentation only; S13 proves the same words in every state; the browser check runs with `?more=all` | if a review finds the forms switch makes a page unusable, narrow it to forms opened by a tap (not forms on a first view) |
| 6 | **A switch promises more than it opens** (claude-a's 13 pages, pages not yet converted) | certain for claude-a's hand-written folds | the card's words say "every ... row", which is true of every row drawn by `part()`; C6 converts the free pages' working folds before C7 | if the owner finds a page where it "did nothing", that page's fold goes into the next commit |
| 7 | **Safari forgets** the key after seven days away | known behaviour (WebKit, 2020); the Home Screen app keeps its own storage | losing it only makes pages short and the ticks show off, which Settings shows truly | a person saying "it keeps resetting": say so on the card |
| 8 | **The Node count wobbles** | seen once: 254 against 250 words on one late-drawing page | ceilings rounded up to ten; "lower me" is a note | a flaky shard: give that page a settled wait in the test's `ctx` |
| 9 | **The check slows `npm test`** | low: 19.6 s in one process for everything | six parallel shards, 15 s each at most, split when over | - |
| 10 | **Two efforts land around this** (wave 1, the retirement request) | certain | the helper touches none of their files until they land; C19 converts their folds after | - |
| 11 | **The budgets are this spec's numbers** | certain; only "four tiles and one sentence" is the owner's | one table, one file; C21 tightens after ten pages | most pages needing the same exception: the number is wrong, not the pages |
| 12 | **Nobody finds the switches** | likely: fewer than one in twenty change a setting ([S19]) | the rows under each answer are the main way, found in place; Help's question; Your plan's one line after the path (G11) | - |
| 13 | **"More on this" against the retirement request's "Go deeper"** | certain, one card | renamed when C19 converts that page | the owner asking for "Go deeper": one scripted rename across the app |
| 14 | **This makes complexity optional; it adds no feature** | certain | the owner's 2026-11-13 request for every other app's functionality is its own work (other specs) | - |

---------------------------------------------------------------------------------------------------------------------

## 10. Three sentences for the owner

Every page will open with its answer and the one thing to do, and everything else (more numbers, how it is worked
out, your own figures) sits in quiet rows right under it that open where they are with one tap and stay the way you
left them on your phone. If you want more everywhere, Settings gets a card called "How much to show" with two
switches, "Show how answers are worked out" and "Show every box in forms", and both only change what your phone
shows, never your plan or your numbers. We start with the Federal estimate and the pages of your plan's path, then go
topic by topic, and a test counts what every page shows first so it can only get simpler.

---------------------------------------------------------------------------------------------------------------------

## 11. Files

| what | where |
|---|---|
| this spec | `$SP/opt/spec.md` |
| every usable page's counts and cards (from the census and the Node counter) | `$O/spec-work/digest.json`, `$O/spec-work/digest.txt` (`digest.mjs` builds them) |
| the classes of section 6 | `$O/spec-work/final.mjs` (prints the tally) |
| the Node counter's output at `707355c` (19.6 s, read-only run) | `$O/spec-work/fv-707355c.json` |
| the helper to start from | `$O/proto-inline/core/ui/more.js`; its tests `$O/inline-work/more.test.mjs` |
| the counter to start from | `$O/inline-work/first-view.mjs`, `$O/inline-work/fv-report.mjs` |
| the browser census to start from | `$O/census.mjs` |
| wave 1's code this builds on | `$SP/w1/integ` (`core/place.js`, `core/ui/dom.js` `form()` `more` and `setMoreOpen`) |
