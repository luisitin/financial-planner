# Optional detail: what the app already has (inventory)

Read from the tip **737fb6a** (worktree `$SP/opt/app`), code only, no walking. `$SP` =
`$SP`.
Counts come from scripts over the source (kept in `$SP/opt/inv/`: `folds2.txt` every fold with its class, open rule,
title and status; `fields-full.txt` every form field; `state.txt` every module-level variable). What a page looks like
at 390 px was not measured here: sections 3 and 4 rank by what the code draws, and a walker should confirm heights.
161 page folders (159 usable, 2 planned), 162 `view.js` with the template.

The owner's rule (2026-11-12) is in `docs/DESIGN_LOG.md` line 18 and names three example phrases: "2 more numbers",
"Set my own numbers", "More options", plus "Type my own" and "Go deeper".

---------------------------------------------------------------------------------------------------------------------

## 0. The eight facts a designer needs first

1. **One mechanism carries almost everything: the native `<details>`.** 153 places in the code of 97 views (and 1 in
   `core/heal.js`); a loop or a local function draws several folds from one place, so the screen has more. There is
   no shared helper: every view writes the same three-part summary by hand (`h2` or `.fold-title`, `.fold-status`,
   `.fold-chev`), in five markup variants.
2. **No fold says "changed by you" in one way.** 99 of 153 folds have a status line; about 10 say who set the figure,
   in eight spellings ("yours", "set by you", "3 typed", "from the plan", "from your plan", "our guess", "examples",
   "national estimate"). Four say a figure is missing, each in its own words. None says it holds an error; one form
   (`goals/goals`) opens its fold on an `invalid` event.
3. **A fold the person opened is lost on the next save** on about 120 of the 153 fold sites (the shell clears
   `#content` and draws again). About 15 views keep "the one just saved" open with a module-level variable; only 6
   remember what the person did (5 with a `toggle` listener, 1 by reading the open folds before it saves). A reload
   loses all of it.
4. **Wave 1's place memory fixes fact 3 for `<details>` only**, keyed by the summary's title with `.fold-status`
   stripped. A helper that draws a native `<details>` with a stable title gets it free; a "Show more" button that
   swaps hidden content does not.
5. **`ui.form` has no "more" option.** Every `ui.form` draws every box. One page (`goals/goals`) folds its rarely
   needed boxes by moving their labels into a `<details>` after the form is built; that recipe works with today's kit
   and with wave 1's. Wave 1 lists "a kit-wide `more: true` fold for long forms" as a follow-up it does not build.
6. **12 labels in 6 views say "(optional)"; 120 help lines in 45 views say "leave blank"; 88 of about 600 declared
   fields are required.** So roughly 500 boxes are optional and say so, if at all, in small grey help text.
7. **Chips are used for presets on only 3 pages** (capital gains, brackets, goal seek). "Type my own" exists on 2
   (allocation, contributions). There are no tabs anywhere. `toggle-row` is used only in Settings.
8. **A device setting can reach every page without touching a wave-1 file**: `core/view.js` is not claimed, its
   object is already `ctx.view`, and the shell already redraws the page on its `planner:view` event.

---------------------------------------------------------------------------------------------------------------------

## 1. The vocabulary in use

### 1.1 Folds: 153 in 97 views

Markup variants (the same thing written five ways):

| what | count |
|---|---|
| `class="card fold fold-card"` (a whole folded card) | 114 (4 with an own class: `go-fold`, `gd-all`, `alloc-target`, `lg-show`) |
| `class="fold"` (a row inside a card) | 28 (6 with an own class: `ex-fold` x2, `cc-more`, `su-fold` x3) |
| `notice-details` or a bare `<details>` under a notice ("Show details") | 6 in views, 1 in `core/heal.js` |
| own class only (`ln-more` x2 life needs, `hp-q` help questions) | 3 |
| class decided at run time (vehicles' car form, Settings' inner fold) | 2 |
| title in an `h2` / in `.fold-title` / plain text | 85 / 56 / 12 |
| has a `.fold-status` | 99 (54 have none) |
| has an `open` rule | 51 |
| chevron marked `aria-hidden` | 36 of 143 |
| body wrapped in `.fold-body` | 59 |
| inside a `.folds` list | 5 views (settings, glossary, stress tests, ai/explain, ai/critic) |

Summary words by family (my grouping; file and line for each in `$SP/opt/inv/folds2.txt`):

**A. How it is worked out, where it comes from, why: 29 folds, 23 different titles.**
"How this is worked out" x5 (performance, tax lots, RMD, Roth conversions, withdrawal strategy), "How it is worked
out" x2 (goal seek, sensitivity), "How these are worked out" (stress tests), "How this is done" (Monte Carlo), "How the
tax is worked out" (estate tax), "How the score is worked out" (health score), "How "worth now" is worked out"
(belongings), "How it adds up" (guesses), "Where the dates come from" (calendar), "Where the deadlines come from" (life
events), "Where these numbers come from" (assumptions), "Where our guesses come from" (guesses), "Why this order" (next
best action), "What goes into this" (Will the money last?), "What we're counting on" (Your plan), "What the plan assumes
about prices and markets" (guesses), "What the AI will read" x2, "What raises usually are" (salary), "Forms and records"
(side income), "Good places to keep papers" (documents), "The seven parts it will score" (health score), a rule of
thumb "for comparison" x2 (life needs, FIRE). No status line on 23 of the 29.

**B. The person's own figures and settings: 68 folds, about 55 different titles.**
- "The figures" x5 (charitable, house, vehicle, term vs permanent, rent vs buy); "Your figures" (state); "This year's
  figures" / "Change what you typed" (HSA); "Figures the plan cannot see" (federal); "Your job now: the figures",
  "<Offer>: the figures" (offer compare); "S corporation figures"; "Correct these figures" (Social Security).
- "... settings" x2 ("Retirement settings", "Conversion settings"); "Assumptions" (net worth ahead); "Their
  assumptions" (advisor plan).
- A noun for the thing: "Policy terms" x3, "The offers" x2, "The company" x2, "The business", "The project", "The
  purchase", "The home's details", "The new car and the lease", "The care to plan for", "The split to aim for", "The
  last 12 months", "Expenses", "Business expenses", "Itemized deductions", "Year and people", "Last year's return",
  "Advisory fee", "Premium and rules", "Your plans' premiums", "Years in each bucket", "Your target mix", "Grants",
  "Purchase-plan shares", "Raises and promotions", "Your coverage and your bills", "From the statement and the
  illustration", "What a paycheck withholds", "What goes in, and the match"; work benefits' five from one function:
  "Your employer's match", "Health accounts", "Commuting", "Stock purchase plan", "Life insurance through work".
- A question: "How steady is each job?", "Is it a Roth IRA?", "How much for goals", "How fast prices rise", "Which
  debts", "Which path to measure against", "Whose benefits", "How it compares".
- A verb: "Change the year you bought it", "Change a payday", "Update its value", "Set your month in one number",
  "See or change each bill".
- With the word optional: "More details (optional)" (goals), "Split it up (optional)" (setup). These two are the only
  folds in the app that hold the rarely needed boxes of a form.

**C. The rest of a list, or one fold per item: 37 folds.**
"Fine for now", "Housekeeping" (needs attention); "More of our guesses" / "Matters less", "Read from your bank files",
"Skipped for now: ..." (guesses); "Only if you have them" (documents); "Hidden" (bills); "Other choices: each ends with
less than not converting (N)" (Roth); "Everything in this check-in (N)" (monthly review); "Main steps done ✓" and "More
on this" (guide); "What's in your plan: N of M basics" (dashboard); "Just want one answer?" (Get started); "Years
ahead" (salary); "<Offer>: the first year"; "The need year by year, to 2070" (life needs); "Mix by account"; "Balances
by day"; "Statements checked"; "Transactions from <dates>"; "Notes you kept"; "The same income in other states";
"Suggestions" (Ask); "Showing" (ledger filters); and one fold per person, month, event, document group, glossary word,
help topic, help question, stress test, Settings topic, card (credit cards' "Pay more, or move this balance ...").

**D. An add form as a fold: 5** ("Add a coin" / "+ Add another coin", "Add a car" / "+ Add another car" / "Change its
details", "Add a rental" / "+ Add another rental" / "Change <name>", "Add a document of your own", "Import a positions
file"). The usual add form is not a fold but a button, see 1.3.

**E. Technical: 14.** "Show details" x6 in views (+1 in `core/heal.js`), "For whoever set up the AI", "PC connection",
"AI assistant", "What is still being built" x2, "Advanced" (status "Not needed day to day"), "Versions and connection",
"Columns worked out for you" / "Some columns could not be found: pick them".

### 1.2 The status line of a fold (99 folds)

| what the status says | examples | spellings |
|---|---|---|
| how many | "3 bills, $1,240 a month", "2 grants", "5 saved", "4 pages", "N to add", "2 of 6 done", "8 of 8 on" | fine |
| the figure inside | "$400,000", "7.0% a year", "family, $2,400 a year", "60 / 30 / 10", "drug $46.50, supplement $150" | fine |
| nothing typed | "not set", "not set yet", "none yet", "none", "none typed", "none entered", "not entered", "not given", "never" | **9** |
| who set it | "yours", "set by you", "N typed", "from the plan", "from your plan", "our guess", "examples", "national estimate" | **8** |
| something is missing | "N to fill in", "rebuild cost or liability missing", "symbol and price", "what you paid" | 4 |
| a hint of what is inside | "change", "optional", "rates and fees", "rates and terms", "what and when", "receipts, statements", "for comparison", "free help", "Show our guesses", "Worth a look" / "Looked over" | 10+ |

### 1.3 Other ways to see more

| mechanism | where | count |
|---|---|---|
| **"+ Add another <thing>"** button; the form is open only while the list is empty (design log 2026-09-15) | 30 views, 36 buttons, 34 labels ("+ Add another account", "+ Add a pension", "+ Add a lot" x4, "+ Add someone else", "+ Add more shares" ...) | the settled pattern |
| "Show more (N left)" | `transactions/ledger` (100 rows at a time, module-level `state.limit`) | 1 |
| "Show all N" | `system/backups` (module-level `showAll`) | 1 |
| "Show earlier changes" | `system/audit` (module-level `want`) | 1 |
| "Show all the steps" | `overview/guide` (opens the `gd-all` fold and scrolls to it) | 1 |
| "Type my own" / "Type my own amount" / "Or type your own numbers" | `investments/allocation` (opens the target fold and focuses its box), `retirement/contributions` x2, `overview/quick` | 4 |
| a row that opens its form under itself (`aria-expanded`) | `investments/holdings`, `estate/beneficiaries`, `estate/documents`; `insurance/life-needs` "how" button | 4 views |
| a box that appears when a choice asks for it (`hidden` set by a select or tick) | `debt/refinance`, `retirement/contributions`, `goals/education`, `balance/liabilities` (escrow amount only under Yes), `overview/setup`, about 10 views | no shared way |
| **chips** (`.chips` / `.chip.on`) | 22 views | see below |
| **toggle-row** | `system/settings` only: one row per page, and "Show what is still being built" | 1 view |
| tabs | none (`role="tab"` is not used anywhere) | 0 |
| "Go deeper" | not used anywhere at this tip | 0 |
| "More on this" card (links to related pages) | 37 views; 7 views still title it "Next" | the design log of 2026-11-06 asks for the rename |

Chips by what they do: **a filter** (timeline topics, calendar range and kinds, glossary topic, AI categoriser scope and
filter, All pages in the build view); **a period** (monthly review month, annual review year); **a view choice**
(sensitivity "What you can spend / What is left at the end", stress tests "As you retire / Now", goal seek "Room for bad
luck", backtest mix, start year, dollars); **a preset with an exact box beside it** (capital gains $5k/$10k/$25k/$50k,
brackets, goal seek "Leave $0 / $250k / $500k / $1M"); **an answer** (guesses' asks, Expenses "What do you know?",
Update balances "It changed / was a mistake", travel kind, beneficiaries' quick names, compare starters, Ask's
examples); **not a button at all** (RMD's factor table, allocation's legend use `.chip` as a label).

### 1.4 The two views of the app and the menu

- **The household's view / the build view** (`core/view.js`, 2026-11-06): the default hides "soon" pages, counts,
  phases, builder pages and anything that needs the PC or the AI helper while it does not answer. Switch: Settings >
  Advanced > "What is still being built" > a `toggle-row`, or `?view=build` / `?view=user`. Pages read `ctx.view.build`,
  `ctx.live`, `ctx.shown(m)`. This is the app's one existing "less by default, more on request" switch for a device.
- **`nav.showSoon`** (`core/app.js`, `localStorage["planner.nav"]`): "Hide coming soon / Show coming soon" on the
  menu's topics header, build view only.
- **Page toggles** (`core/features.js`): Settings > Pages, one fold per topic, a `toggle-row` per page, a pill only
  when this device or the PC changed it.
- **Menu topics** open and shut (`nav.open`), and "Recent" (`nav.recent`, 12 pages).

### 1.5 Landings that open something (the address says what to open)

| key | page | what it opens | how it is kept from re-running |
|---|---|---|---|
| `?add=<type>` | `balance/net-worth` (from 12 pages: `?add=debt`, `credit`, `property`, `mortgage`, `checking`, `savings`, `investment`, `belonging`) | the add form, titled and pre-set for that type | `landedOn` = the route object (once per arrival) |
| `?add=YYYY-MM-DD` | `transactions/ledger` | the add form on that day | address rewritten with `location.replace` |
| `?edit=<id>` | `balance/net-worth`, `cashflow/expenses`, `insurance/policies`, `investments/holdings` | that row's edit form (Expenses also opens "See or change each bill") | `landedOn` / `opened` / `routeSeen` |
| `?show=<key>` | `system/assumptions` (`?show=emergencyMonths`, and `returnStocks` in the retirement spec) | scrolls to the box and outlines it | a `WeakSet` of route objects (once per arrival) |
| `?type=spending` | `retirement/projection` | opens "Retirement settings" at the spending box | `typedFor` = the route object |
| `?check=1` | `retirement/projection` | **not at this tip**: in the retirement worktree (`$SP/rv/b-ret`), lands on "What this rests on" | as `?type=` |
| `?more=1` | `overview/guide` | the "More guides" list | none needed |
| `?target=last` / `badluck` | `scenarios/goal-seek` | pre-picks a chip | `readRoute` |
| `?loan=`, `?month=`, `?dir=`, `?category=`, `?need=`, `?accountId=`, `?back=`, `?from=` | mortgage, check-in, spending, budget, ledger, import | pick a record, a month, a filter, a way back | per page |
| a guide step's `opens: "<fold title>"` | `cashflow/budget-percent` "The split to aim for", `taxes/federal` "Figures the plan cannot see", `taxes/withholding` "What a paycheck withholds" | `frame.js openFold()` opens the `<details>` whose summary contains the title, on every draw | a `WeakSet` per element |

The guide also finds its "Show me where" target from the step's text: "open Your situation", "open The offers", "open
See or change each bill", "under Your figures", "under The split to aim for" (`guide/compute.js targetsOf`). **Renaming
one of these folds breaks the step** unless `journeys.js` changes with it (claude-f's lane).

### 1.6 The 8 phrases a single vocabulary could keep

Chosen so that each has one job, fits a 320 px summary line, and three of them are the owner's rule's own examples.

| # | phrase | job | replaces |
|---|---|---|---|
| 1 | **"N more <things>"** ("4 more numbers", "12 more years", "3 more accounts") | the rest of a list or of the figures, shown after the first few | "Matters less", "Other choices ... (N)", "Everything in this check-in (N)", "Years ahead", "Show all N", "Show more (N left)", "Show earlier changes" |
| 2 | **"More options"** | the rarely needed boxes of a form, above its button | "More details (optional)", "Split it up (optional)", and the ~500 unmarked optional boxes |
| 3 | **"Set my own numbers"** (one box: **"Type my own"**) | exact boxes after presets or after our guess | "Type my own amount", "Or type your own numbers", "Correct these figures", "Change what you typed", "Your figures" |
| 4 | **"The figures"** (status: the headline figure) | the inputs behind an answer on a what-if page, folded once it has answered | "<X>: the figures", "The project", "The purchase", "The offers", "Policy terms", "... settings", "Assumptions" where they are that page's inputs |
| 5 | **"How this is worked out"** | method, sources, year tables, rules of thumb | the 23 titles of family A |
| 6 | **"+ Add another <thing>"** | the add form of a list that has rows | already settled; 4 fold-style add forms join it |
| 7 | **"Show details"** | technical text under a notice | already settled (7) |
| 8 | **"Go deeper"** | links to the deeper pages | the "More on this" card (37 views) and "Next" (7): **a decision to make**, since 2026-11-06 chose "More on this" and 2026-11-12 says "Go deeper" |

And four status words, one spelling each: **"not set yet"** (9 spellings today), **"yours"** / **"our guess"** (8
spellings), **"N changed"** (new: the rule's "a folded part says when it holds a figure they changed"), **"needs a
look"** (new: it holds an error or a missing figure; today 4 spellings).

Kept as they are: a fold named for its item (a person, a month, an event), "Fine for now" / "Housekeeping", "Just want
one answer?", "Advanced".

---------------------------------------------------------------------------------------------------------------------

## 2. What is remembered, and what is lost

### 2.1 Kept on this device (every key in the code)

| where | key | what | written by |
|---|---|---|---|
| localStorage | `planner.plan` (`planner.plan.sandbox`) | the plan | `core/store.js` |
| localStorage | `planner.plan.sync` | what still has to reach the PC | `core/store.js` |
| localStorage | `planner.nav` | `{ open: { topic: bool }, showSoon, recent: [12 page keys] }` | `core/app.js` |
| localStorage | `planner.features` | `{ "group/id": bool }` page switches | `core/features.js` |
| localStorage | `planner.view` | `"build"` or absent | `core/view.js` |
| localStorage | `planner.connection` | PC address, token, this device's AI settings | `core/api.js` |
| localStorage | `planner.__probe`, `planner.diagnostics` | written and removed at once (does storage work) | store, diagnostics |
| sessionStorage | `planner.plan.undecided` | this tab's version while two versions wait for a choice | `core/store.js` |
| sessionStorage | `planner.setup.drafts` | Get started's typed, unsaved answers | `overview/setup/view.js` |
| sessionStorage | `planner.quickTrail`, `planner.guideTrail` | the one-page "‹ Back to ..." trails | `overview/guide/frame.js` |
| sessionStorage | `planner.erased` | "your plan was erased" said once after the reload | `system/settings/view.js` |
| sessionStorage | `planner.healAt` | the one self-mending reload | `core/heal.js`, `index.html` |

**Nothing about how much detail a person wants is kept on the device.** No fold, chip, "Show all" or "Type my own" is
in any storage. `docs/DATA_MODEL.md` "Not in the plan" lists only two of these keys (`connection`, `features`).

Kept **in the plan** (so it travels to the PC and other devices, and a toggle of it is a plan change): what-if inputs
(`plan.whatIfs.*`), `plan.assumptions`, `plan.guide`, `plan.reviews`, `plan.pageNotes`. A view choice must never go
there: the rule says opening or closing never changes the plan.

### 2.2 Kept while the app stays open (module-level variables; lost on reload)

275 module-level variables in 123 views. Those that carry "what is open or chosen":

| kind | views | examples |
|---|---|---|
| "the fold just saved stays open" | about 15 | `openFold` (benefits, business, equity, paycheck), `openId` (offer compare, side income), `openJob` (salary), `openFor` (Social Security), `figsOpen` (federal), `transferOpen` (credit cards), `grantsOpen` (employer stock), `justSaved` (Will the money last?), `keepOpen` (house) |
| **what the person opened** (a `toggle` listener, or the open folds read before a save) | 6 | `opened` Set (documents), `shown` (life events), `visit.moreOpen` (guesses), `foldOpen` (ai/critic, ai/explain), `openFolds` Set (budget split) |
| the add or edit form that is open | about 14 | `adding`, `editing`, `editId`, `openKey`, `kept.showForm` (people), `starting` (life events) |
| a chip or a view choice | 14 | `topic`, `month`, `year`, `only`, `range`, `metric`, `when`, `legacy`, `scale`, `scope`, `filter`, `what`, `extra`, `kindChoice` |
| "show more" | 3 | `showAll` (backups), `want` (audit), `state.limit` (ledger) |
| a landing already used | 8 | `landedOn`, `opened`, `typedFor`, `readRoute`, `routeSeen`, `arrival` |

Two side effects of this pattern: a variable set by a save is never cleared in several views (`career/benefits`
`openFold`: the fold stays open on every later visit until the app reloads), and most `showForm` flags are local to
`render()`, so an open add form shuts when anything else on the page saves.

### 2.3 Lost today

| the person | on the redraw after any save on that page | on Back | on reload |
|---|---|---|---|
| opened a fold (about 120 of 153 sites have no memory) | shut again | shut | shut |
| opened a fold with "just saved" memory | open only if it was the one saved | shut, or still open from an old save where the variable is never cleared | shut |
| opened one of the 6 remembered folds | kept | kept | shut |
| tapped "+ Add another ..." and typed | the form shuts where `showForm` is a local of `render()` (income, expenses, policies, net worth, contributions ...); it stays where `adding` / `editing` is module-level (about 14 views); the typing is gone either way, except on People (`kept.draft`) and Get started (`drafts`) | form as left where module-level; typing gone | gone (Get started keeps its drafts for the tab) |
| picked a chip | kept (module-level) | kept | back to the default |
| tapped "Show all" / "Show more" | kept (backups, audit, ledger: module-level) | kept | gone |
| arrived by `?edit=` / `?add=` / `?type=` | not re-run (once per route object) | re-run (a new route object) | re-run |

Why: `core/app.js show()` runs `root.innerHTML = ""` for every new address and 50 ms after every `store.update`; a
page keeps only what it stored in a module-level variable before the update.

### 2.4 What wave 1's place memory will keep (`$SP/w1/plan-place.md`, built in `$SP/w1/build-place/core/place.js`)

- **Folds the person opened or shut by tapping their summary**, per history entry, in
  `sessionStorage["planner.place"]` (`.sandbox`), 60 entries, `fmt: 1`, this tab only. Put back after a save on the same
  page (M6), on Back and Forward (M4) and on a reload (B3). A new visit by a link or the menu draws the folds as the
  page designs them (B2).
- **Only native `<details>`.** A fold is named by its summary's `.fold-title, h1-h4, b, strong` text with
  `.fold-status`, `.fold-chev`, `.pill`, `small`, `.muted` removed and figures turned into `#`, cut to 60 characters
  (`foldTitle`), then its section and its index among same-named folds.
- **The page wins**: a fold is put back only where the page drew it as it did before ("the one just saved stays
  open" is not overridden). A fold the page opened by itself is not recorded.
- **Typing** in a form is kept per page for a day (`planner.typing`), and a shut section that holds kept typing is
  opened, with "Not saved yet · Undo my typing".
- The form kit (`$SP/w1/build-forms/core/ui/dom.js`): a box that fails inside a shut `<details>` opens every shut
  ancestor (line 349); a box inside a shut `<details>` is skipped by the Return-key walk (line 266). No `more` option.
- `ctx.redraw()`: a redraw that does not write the plan (at least `overview/monthly-review` and `reports/annual-review`
  call `store.update(() => {})` for that today; wave 1's plan counts 6 views).

What it does not keep, so the optionality work must decide: chips, "Show all" buttons, `aria-expanded` rows, anything
across tabs or after the tab closes, and any per-device liking ("always show me the figures").

Consequences for a helper: (a) draw a native `<details>`; (b) keep the title fixed and put everything that changes
(counts, figures, "2 changed") in `.fold-status`; (c) no two folds with the same title in one card; (d) do not add a
module-level "open" variable for what wave 1 will keep, only for "open because it holds an error or was just saved".

---------------------------------------------------------------------------------------------------------------------

## 3. Forms that put rarely needed boxes on the first view: the 30 worst

"First view" = what a person with nothing entered sees before the button. Box counts are the fields the form
declares. "Needed" is my reading of what the page cannot answer without. Lane notes: **[c]** claude-c's lane
claim on that view (docs/TEAM.md 2026-11-11), **[f]** claude-f's, **[ret]** the retirement request in flight.
None of the 30 is one of claude-a's 13 folders; those are listed after.

| # | page, form | boxes | needed | boxes a first-time person will not know, or optional and not marked |
|---|---|---|---|---|
| 1 | `property/rental` "Add a rental" (fold, open when none) | 21 | name, worth today, rent a month | "Allowance for empty months" %, "Repairs and upkeep, a year, as a share of the value" %, "Property manager, as a share of rent" %, "Land's share of the price (not depreciated)" %, "Value grows each year" %, "Cash you put in", loan owed + rate + payment (beside "Its mortgage", which already knows them), "When it was first rented out", utilities, other costs. Only rent is required; nothing says optional |
| 2 | `property/rent-vs-buy` "The figures" (open until saved) | 18 | price, rent, years, down payment, rate | 9 percent boxes that all have defaults (property tax, insurance and upkeep as a share of value, closing costs, selling costs, home growth, rent growth, return on invested money, "Our top tax rate"), plus mortgage length, HOA, renters insurance and "We itemize" |
| 3 | `career/offer-compare` "An offer" (card, always open for the first) | 18 | who, salary, bonus | match rate, "Matches what you put in, up to this share of your pay", employer's health account money, other benefits worth, paid days off, hours a week, days at the workplace, commute minutes, commute cost, raise, state tax rate, moving costs. Optional only through "leave blank ..." help lines |
| 4 | `goals/house` "The figures" (open until saved) | 12 | price, by when | down payment %, closing costs %, mortgage rate, length, property tax %, insurance %, HOA, "Months of payments kept in reserve" |
| 5 | `insurance/policies` add form | 12 (13 once a home exists) | what, kind, premium, how often, what it pays | "Which home", "Ends", "Renews", "Cash value" (whole life only, shown for car insurance too), "Through an employer", notes, insurer. "What it pays" carries a five-part help line because one box serves every kind |
| 6 | `property/home` "The home's details" (open until a price is saved) | 11 | what you paid, year | "The exact date, if you know it", improvements, upkeep %, "Value grows each year" %, selling costs %, "Selling before two years because of a new job, my health or an event I could not foresee" (a rare tax case, a tick box on the first view) |
| 7 | `property/vehicles` "Add a car" (fold, open when none) | 10 | which car, worth today | miles a year, miles per gallon, fuel price, insurance, upkeep, registration, "Value it loses a year" %, its loan. All have defaults |
| 8 | `career/equity` "Grants" add form (open when none) | 9 | kind, units, grant date | "Options: the price you pay per share" (shown for stock units too), "Vesting starts", "Vests over (months)", "First part vests after (months)", "Then every (months)". The purchase-plan form: 7 boxes, 6 required, among them "Share price when the offering began" |
| 9 | `cashflow/income` add form | 9 | what, kind, whose, amount, how often | "Yearly raise" %, "Starts", "Ends", "Income tax applies to it" (ticked by default) |
| 10 | `investments/holdings` add form | 9 | account, symbol, shares | "Name" (filled in by itself), "Price a share", "What you paid in all", "Kind of investment" (worked out from the symbol), "Expense ratio", "Yield" |
| 11 | `cashflow/expenses` add form **[c]** | 8 | what, category, amount, how often | "I must pay this (not optional)", "Goes up with prices over the years", "Starts", "Ends" |
| 12 | `balance/liabilities` "<debt>: rate and payments" **[c]** | 6 for a loan (8 for a home loan), 4 for a card | rate, required payment | "Extra you pay each month", "Loan length in months", "Started", "What it is borrowed against"; cards: "Credit limit" |
| 13 | `retirement/pensions` add form | 9 | name, whose, monthly, starts at | "Stops at age (optional)", "Lump sum offered instead (optional)", "Monthly with a survivor option (optional)", "The survivor gets". Marked, but all on screen |
| 14 | `balance/assets` add a belonging | 9 | what, kind | where it is, day bought, what you paid, "Years it lasts", worth now (marked optional), insurance that covers it, "Listed by name on the policy" |
| 15 | `insurance/term-vs-permanent` "From the illustration" (card until it has answered) | 8 | death benefit, two premiums, cash value | "Guaranteed cash value then (optional)", "The difference goes into an ordinary investment account (taxed along the way)", "Return on the invested difference" |
| 16 | `property/purchase` "The purchase" (open until a price) | 8 | name, price, when | sales tax, "The payment plan's rate", length, "Months at 0%, if offered", already set aside |
| 17 | `retirement/annuities` "Add a quote" | 7 | name, you pay, it pays a month | from age, joint life, rises with prices, whose life |
| 18 | `insurance/health` add a plan + "Your coverage and your bills" (open when none) | 7 + 2 | name, premium, deductible, out-of-pocket maximum | "Your share after the deductible" %, HSA tick, "Employer's HSA money a year" |
| 19 | `career/business` "The business" (open when empty) | 7 | name, what customers pay | "Which one on the Income page", health insurance you pay, "Home office, square feet", "Business miles a year" |
| 20 | `taxes/federal` "Figures the plan cannot see" (fold; the guide opens it) | 9 | "Federal tax withheld so far" (the one box the guide asks for, 8th of 9) | "Other income taxed at regular rates", "Qualified dividends", "Tax-exempt interest", "Other adjustments", "Other payments" |
| 21 | `cashflow/paycheck` one fold per person | 16 | paychecks a year, federal tax on the stub | "W-4: the two-jobs box in Step 2 is checked", "W-4 Step 3", "Step 4(a)", "4(b)", "4(c)", and 8 deductions a paycheck. Folded, but once open the two needed boxes sit among 14 others |
| 22 | `career/benefits` "Your employer's match" and four more setting folds (all shut) | 20 in 5 folds | match rate, up to | "Then they add (a second step, if any)" and its "up to", "Paychecks a year", "Choosing for the year"; purchase plan: "The price is the lower of the price at the start of the offering and ..." |
| 23 | `investments/employer-stock` add a grant (open when none) | 7 | kind, units, vesting starts | "Options: the price you pay per share", months until vested, "Months before the first vest (the cliff)", "Then vests every ... months" |
| 24 | `taxes/hsa-fsa` "This year's figures" (open when nothing is set) | 7 | plan, you put in | who the plan covers, employer puts in, two FSA elections, "FSA spent so far" |
| 25 | `estate/gifting` "Add a gift" | 7 | to whom, amount | year, from, what, "529 only: spread it over 5 years (front-load)", notes |
| 26 | `balance/net-worth` add an account (the most used form in the app) | 6 | name, type, balance | "Institution" (optional, not marked), "Balance as of" (today by default), "Whose account" |
| 27 | `household/people` add a person | 5 | name, who, birth date | "Retirement age", "Plan to age" (both have a plan-wide default) |
| 28 | `transactions/reconcile` the statement form | 7 | account, two dates, two balances | two "below zero" tick boxes beside the balances |
| 29 | `insurance/cash-value` one fold per policy (opens itself when figures are missing) | 6 | years paid, what cashing in pays | "Premiums paid in total (optional)", "Years ahead to compare", "Cash value then, from an in-force illustration", "Term premium a year for the same coverage" |
| 30 | `insurance/ltc` "The care to plan for" and "Policy terms" | 4 + 3 | kind of care | "Costs where you live" %, "Waiting period (days)", "Years of benefits", inflation rider |

**In flight, do not duplicate [ret]:** `retirement/projection` "Retirement settings" (7 boxes: spending beside
"How tax is worked out", "Flat rate on money taken from pre-tax accounts", "How much to take out each year",
"Starting withdrawal rate"); `system/assumptions` (10 boxes at once, "How much stocks swing (a typical year)"
beside inflation); `retirement/contributions` add form; `scenarios/goal-seek`; `scenarios/sensitivity`; `ai/reader`;
`transactions/import`. `overview/setup` is in claude-c's and claude-f's lanes and already asks one question a
screen with three `su-fold` folds.

**claude-a's folders (hand-over only):** `goals/vehicle` "The figures" (8 boxes, open until saved: sales tax,
trade-in, loan rate, loan length); `debt/consolidation` "The offers" (8 rate and fee boxes, folded); `balance/projection`
"Assumptions" (folded); `taxes/state` "Your figures" (5 boxes, open when the method is unknown, with "Or your rate
(overrides the rest)"); `goals/charitable` "The figures" ("Share of shares' value that is growth").

**Two patterns behind most of the 30:**
1. One `ui.form(FIELDS)` serves add and edit, so the add form shows everything edit needs. `goals/goals` is the one
   that splits them (`MORE = [...]`, `foldMore(ui, form, open)`: name and amount first, seven boxes under "More
   details (optional)", open when editing or when one of them holds something, opened by an `invalid` event).
2. What-if pages (rent vs buy, house, vehicles, rental, home) put every assumption that has a default beside the two
   or three figures only the person knows.

---------------------------------------------------------------------------------------------------------------------

## 4. Pages that show every figure at once

Ranked by what the code draws outside any fold: stat tiles (`ui.stat`), cards, lists. 64 of 161 pages have no fold at
all. A walker should confirm the heights.

| page | outside a fold today | a headline and "the figures" would be |
|---|---|---|
| `taxes/withholding` **[f]** | "Each return" list; one card with 8 tiles (credits back, tax for the year, withheld by December x2, per-person verdicts, still to pay or refund, add per paycheck, could take home); "How the W-4 works now" | the refund-or-owe line and one action; the other tiles behind "6 more numbers"; the W-4 card under "How this is worked out" |
| `taxes/hsa-fsa` | 5 tiles + FSA card with 3 tiles + "What you can still do" + "Why an HSA comes first" | room left and tax saved; the rest folded |
| `taxes/capital-gains` | 7 tiles (long-term, short-term, tax on the sales, room at 0%, extra tax, rate on it, you keep) + "How the rates work" card (no fold on the page) | tax on the sales and you keep; the rates card folded |
| `taxes/brackets` | 4 tiles + two returns + 3 tiles + "What more income would cost" + the whole bracket table (no fold) | bracket, room left, next dollar; the table folded |
| `taxes/federal` | 6 tiles + "Two returns" + "From income to tax" + "What the plan already knows", then 3 folds | refund or owe and the rate; "From income to tax" folded |
| `taxes/estimated` | each return + 5 tiles + the four payments | the next payment and its date |
| `investments/performance` | 4 tiles + per account 3 tiles and a list + "Reading the two numbers" | what the investments earned; accounts as folds |
| `career/benefits` | 7 cards, 8 tiles (401(k), HSA x3, spending accounts, purchase plan x2, life, each paycheck x3) | the match you get or miss; one fold per benefit |
| `property/rental` | per rental: 3 tiles + "The year, line by line" + "The checks a lender makes" + "Tax" + "What it adds to your wealth" | cash flow a year; four folds |
| `balance/accounts` (one account) | 2 tiles, chart, 4 tiles (last 30 days), money in and out lists, statement check, notes | balance and change; the rest folded |
| `debt/mortgage` | 5 tiles + what-if + "How the years left were worked out" (a card, not a fold) + year by year | payoff date and what extra saves |
| `balance/liquidity` | 5 tiles + a card per tier (no fold) | months covered; the tiers folded |
| `cashflow/spending` | 4 tiles + by category + "Who got the most" + "Biggest single lines" (no fold) | spent this month against last; the two lists folded |
| `cashflow/income-statement` | 4 tiles + plan versus real + month by month + two lists (no fold) | kept or short; month by month folded |
| `investments/risk`, `dividends`, `fees` | 4 tiles each + 2 or 3 full lists | one figure each; lists as "N more" |
| `retirement/monte-carlo` | 4 tiles + range chart + "Still funded at..." table | the chance; the table folded |
| `retirement/medicare`, `estate/estate-tax` | 8 cards each, 1 fold | the cost / the tax; year by year and the special cases folded |
| `career/business` | 6 cards before its 3 folds (the tax, own name, S corporation, retirement plans x2) | profit and tax; S corporation and retirement plans folded |
| `scenarios/advisor-plan`, `investments/employer-stock`, `investments/crypto`, `property/home`, `career/equity` | 5 to 9 cards each | one answer card, the rest folded |
| `taxes/projection`, `retirement/cash-flow` | a full year-by-year table on the first view | the first five years, "N more years" |
| claude-a's (hand-over): `balance/projection` (4 tiles, 7 cards), `taxes/state` (9 cards), `taxes/filing-status` (6 cards), `goals/vehicle` (4 tiles, 6 cards) | | |

**Pages that already do it, to copy from:** `cashflow/expenses` (one figure, then "See or change each bill"),
`overview/alerts` ("Fine for now", "Housekeeping"), `overview/plan` ("What we're counting on"), `overview/guesses`
("More of our guesses"), `retirement/roth-conversions` ("Other choices ...", "How this is worked out", "Conversion
settings"), `retirement/rmd` and `withdrawal-strategy` (their tests read the text outside the folds and inside "How
this is worked out" separately), `debt/credit-cards` (a `cc-more` fold per card, open only when it is the best move),
`overview/start` ("Just want one answer?").

There is no shared "first N rows, then N more": caps are ad hoc (`.slice(0, 3)` in health score, Your plan, budget
suggestions), and only three pages offer the rest.

---------------------------------------------------------------------------------------------------------------------

## 5. Where a shared helper can live without touching wave 1's files

Wave 1 owns `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
`modules/overview/guide/frame.js`, and adds `core/place.js`, `core/ui/checks.js`, `core/ui/undo.js`.

**How a view gets `ui` today.** `core/app.js` line 15: `import * as ui from "./ui/dom.js"`, passed as `ctx.ui` in
`makeCtx`. It is a module namespace, so nothing can be added to it from outside: a new `ctx.ui.x` needs either an
export in `dom.js` or a line in `makeCtx`, both wave-1 files.

**What views do instead, already.** 52 views import `core/words.js` directly; 8 import `core/math/periods.js`; 2
import `core/ui/placeholder.js`; shared view helpers that are not pages exist under `modules/` and take `ui` as their
first argument: `modules/reports/report-kit.js` (`section(ui, title, ...body)`, `figs(ui, items)`),
`modules/retirement/charts.js`, `modules/retirement/needs.js`, `modules/ai/health.js`.

**So: a new file `core/ui/more.js`** (free name; nothing claims `core/ui/` beyond the files above), written in the
report-kit style, `fn(ui, ...)`, importing nothing from `dom.js`:

| helper (names are a proposal) | what it draws | built from |
|---|---|---|
| `fold(ui, title, body, { status, open, card, changed, needsLook })` | the one `<details class="fold">` or `card fold fold-card`, title in `.fold-title`, status in `.fold-status`, chevron `aria-hidden` | replaces 153 hand-written summaries over time |
| `moreRows(ui, items, draw, { first = 5, noun })` | the first rows, then a fold "N more <noun>" | `.records`, `.fold` |
| `moreOptions(ui, form, keys, { open })` | moves the named boxes of a built `ui.form` into a fold "More options" above `.form-actions`; open when editing, when one holds a value, or on `invalid` | the `goals/goals` `foldMore` recipe, verbatim |
| `ownNumber(ui, { presets, value, onPick })` | chips first, "Type my own" opens the exact box | `.chips`, `.chip.on`, `ui.moneyBox` |
| `statusOf({ typed, guessed, missing })` | the four status words of 1.6 | pure, node-tested |

A view reaches it with `import { fold } from "../../../core/ui/more.js"`. After wave 1 has landed, one line in
`dom.js` (`export * from "./more.js"`) would also make them `ctx.ui.fold`; that line is wave 1's owner's to add.

**CSS.** Rule 6 (no new global CSS) and wave 1's claim on `base.css` both say: use what is there. It is enough:
`.fold > summary` is already the quiet 44 px row (title, grey status, chevron), `.folds` gives the hairlines,
`.fold-card`, `.chips`, `.chip.on`, `.toggle-row`, `.pill`, `.records`, `button.secondary`. Missing and to be done
with inline style or a scoped `<style>` in the module root (95 views already append one): a fold that spans a `.form`
grid (`grid-column: 1 / -1`; `goals/goals` uses an inline margin), and a text-only button (only `overview/guide` has
one, `.gd-textbtn`, scoped).

**Rules the helper must follow so wave 1 keeps its folds** (section 2.4): native `<details>`, fixed title, changing
words only in `.fold-status`, built with `ui.h`.

**Rules the helper must follow so the node tests can run it** (`qa/fixtures/fake-dom.mjs`, used by 12 module tests
and 8 files in `tests/`): the stand-in has `append`, `prepend`, `replaceChildren`, `replaceWith`, `remove`,
`querySelector(All)` for a tag, `.class` or `[attr="v"]`, `closest`, `addEventListener` and `dispatch`; it has **no
`insertBefore`, `before`, `after`, `:scope`**, and `open` is an attribute (`hasAttribute("open")`), not a live
property. `goals/goals` uses `form.insertBefore`; its module test does not use this stand-in.

**The static site (rule 16).** The service worker keeps no file list, so a new core file needs no registration. A
view that imports `core/ui/more.js` must never meet a site without it: the helper lands and `main` moves through
`tools/main-gate.mjs` before, or in the same push as, the first page that uses it (the forms plan's R11).

**A device-wide "how much detail" switch, if the design wants one.** `core/view.js` is not in wave 1's list. It
already holds the one per-device view choice (`planner.view`), is safe to import in Node, and its object is passed to
every page as `ctx.view`. A second field there (say `view.detail`, key `planner.detail`, read with the same
try/catch) reaches every view with no edit to `core/app.js`, and `view.set`'s `planner:view` event already makes the
shell rebuild the menu and redraw the page on screen unless someone is typing (`core/app.js` `follow`). Its tests are
`tests/user-view.test.mjs`. `core/features.js` (`ctx.features.set(key, bool)`) could also store a switch, but its keys
are page keys and its event only rebuilds the menu.

---------------------------------------------------------------------------------------------------------------------

## 6. Tests and tools that pin fold markup or fold words

`tools/check.mjs` checks nothing about folds, chips or labels. `npm test` does, in these places:

| file | what it pins |
|---|---|
| `tests/heal.test.mjs` 84, 90 | the fail notice's summary is "Show details"; no details, no `<details>` |
| `tests/pages-followup-b.test.mjs` 151-162, 183 | credit cards: each `.cc-more` has a `.fold-title` with the right words; goal seek's chip starts "Room for bad luck" |
| `tests/plain-words-followup.test.mjs` 21 | the HSA fold is named "Change what you typed" on Medicare |
| `tests/wording-review.test.mjs` 170 | Settings' fold words ("PC connection", ...) are allowed to say PC |
| `modules/debt/credit-cards/module.test.mjs` 206, 212 | `.cc-more` is a `DETAILS` and shut by default |
| `modules/cashflow/expenses/module.test.mjs` 361-379 | the bills fold is shut for 7 guessed bills, open after a save, shut again on a fresh draw |
| `modules/overview/guesses/module.test.mjs` 536, 566, 1593, 2119, 2215 | the last `<details>` on the page; folds found by "Skipped for now: ..." and "Read from your bank files"; the source line `moreFold.addEventListener?.("toggle", ...)` word for word |
| `modules/retirement/projection/module.test.mjs` 1730-1740 | `?type=spending` opens "Retirement settings" once, not on the redraw |
| `modules/retirement/rmd`, `roth-conversions`, `withdrawal-strategy` tests | text **outside** every `<details>` versus text **inside** the fold titled "How this is worked out" |
| `modules/scenarios/goal-seek/module.test.mjs` 276-354 | the chips: none for a renter, "Room for bad luck" toggles |
| `modules/overview/plan/module.test.mjs` 311 | the `.pl-v.open` style line |
| `qa/flows/tax-figures.js` 6 | clicks the summary "Figures the plan cannot see" |
| `qa/user-view.mjs` 72-75 | Settings: "Advanced" then "What is still being built" are summaries; the switch's label word for word |
| `qa/flows/path-walk.js` 42 | counts `summary` among the tap targets (44 px) |
| `tools/drive.mjs` 106 | `qa.clickText` looks in `button, a, .chip, .nav-link, [role=button]` (a summary must be named in the second argument) |
| `modules/overview/guide/journeys.js` | 3 steps with `opens: "<fold title>"`, and 6 asks that name a fold ("open Your situation", "open The offers", "open See or change each bill", "under Your figures") |
| `qa/smoke-all.mjs` | every usable page on a phone: errors, overflow, tap targets under 44 px (a new summary or chip is measured) |
| wave 1's coming checks | `tests/place.test.mjs` (fold naming), the touch sweep (`D-*` rules), `tests/ui-checks.test.mjs` (a plain-words guard over the kit's sentences) |

So the words most expensive to change are "How this is worked out" (3 test files), "Retirement settings", "Figures
the plan cannot see", "The split to aim for", "What a paycheck withholds", "Your situation", "The offers", "Your
figures", "See or change each bill", "Advanced", "What is still being built", "Show details", "Skipped for now",
"Read from your bank files", "Change what you typed". Of these, the vocabulary of 1.6 would rename four: "Your
figures" and "The offers" (claude-a's `taxes/state` and `debt/consolidation`, both named in guide steps), "Change what
you typed" (one test) and perhaps "Retirement settings" (in flight, one test, one guide step). Each rename needs its
test or its guide step changed in the same commit; the rest stay.

The tests that split "outside the folds" from "inside" are the app's existing proof of "the first view holds the
answer": the same two functions (`outside`, `foldText`) can become the acceptance check of the optionality work.

---------------------------------------------------------------------------------------------------------------------

## 7. Device settings: where they live and how one is added

**Where.** `modules/system/settings/view.js` (214 lines), in this order: "Plan basics" (plan name, currency, number
and date format: these are in the plan, `plan.meta`), "Pages" (the `core/features.js` switches, one `.fold` per topic
in a `.folds` list, a `.toggle-row` per page, status "8 of 8 on"), "Your data" (download, restore, erase), then in the
household's view one folded card "Advanced" (status "Not needed day to day") holding three inner folds: "PC
connection", "AI assistant", "What is still being built" (the `core/view.js` switch, a `.toggle-row`). In the build
view those three are separate folded cards. The page's manifest writes `["meta"]` only.

**How a device setting is stored today** (three small stores, the same shape each): a module in `core/` with a
`localStorage` key read in a try/catch (a sandboxed frame or a private window falls back to memory), a `set()` that
writes and dispatches a window event, and a listener in `core/app.js`: `core/view.js` (`planner.view`,
`planner:view`: menu and page redraw), `core/features.js` (`planner.features`, `planner:features`: menu only),
`core/api.js` `conn` (`planner.connection`, `planner:connection`: reconnect and redraw).

**How AGENTS.md says to add one.** "A new setting: server-wide ones go in `planner.properties.example` +
`server/server.mjs` DEFAULTS + `publicConfig()`; device ones go in `modules/system/settings`." And
`docs/CONVENTIONS.md` "Where things go": "a device setting | `modules/system/settings`". In practice that means:
1. the value and its key in a `core/` store (for a detail level, `core/view.js`, section 5), never in the plan
   (rule 7 and the owner's rule: opening or closing never changes the plan), never a new place for a token (rule 10);
2. its row in `modules/system/settings/view.js`: a `.toggle-row` (a tick box and plain words) or chips, with
   `ui.notice("ok", ...)` on change; an everyday choice goes above "Your data", a technical one inside "Advanced";
3. `modules/system/settings/README.md`, the "Not in the plan" list of `docs/DATA_MODEL.md` (which today misses
   `planner.view` and `planner.nav`), `docs/CONVENTIONS.md` "View", one CHANGELOG line;
4. a test beside `tests/user-view.test.mjs`, and `qa/user-view.mjs` if the Settings words change (it clicks
   "Advanced" and reads the switch's label);
5. `node tools/shot.mjs system/settings` at phone width.

`system/settings` is not claimed in docs/TEAM.md at this tip; `core/view.js` is not either.

---------------------------------------------------------------------------------------------------------------------

## 8. Open points for the design step

1. **"Go deeper" or "More on this"** for the links card (37 + 7 views): the two design-log entries disagree.
2. **Per fold or per device**: wave 1 keeps a fold per history entry in one tab. Whether a person who always opens
   "the figures" should get them open next week is a device setting (section 7) and a product choice.
3. **`moreOptions` now, or wait for the kit**: the recipe works outside `ui.form` today; a `more` field flag inside
   `ui.form` is cleaner but is a `dom.js` change after wave 1.
4. **Fold renames cost**: section 6 lists the 14 pinned titles; `journeys.js` is claude-f's.
5. **claude-a's 13 folders** hold 9 of the folds named here and 5 of the dense pages: a hand-over note, not an edit.
6. **The four pages in flight for the retirement request** already carry the rule's first reading ("N more numbers",
   presets as chips): the vocabulary of 1.6 should be checked against what they ship, not the other way round.
