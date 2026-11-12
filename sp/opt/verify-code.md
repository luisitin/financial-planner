# Skeptic's check of the four OPTIONALITY reports (census, inventory, walks, constraints)

Tip 737fb6a, the read-only copy `opt/app`, served on port 9821 (stopped; the copy's `git status` is clean, the repo
was not touched). Everything in the sandbox, 390 x 844. My scripts, data and screenshots are in
`$SP/opt/vc`
(`lib.mjs` my own counter, `run12.mjs` + `run12.json`, `cmp12.mjs`, `q1.mjs`, `rerun.json`, `walk2.mjs` to `walk5.mjs`,
`quotes.mjs`, `shots/`).

## Verdict in six lines

1. **The census numbers hold.** Rerun of `census.mjs` on 14 pages x 3 households: 42 of 42 rows identical. A counter I
   wrote without reading theirs agrees on 16 page views to within 0 to 2 words on the first screen and exactly on
   figures, boxes, filled buttons, folds and height. Seven screenshots counted by eye match the rows.
2. **Two census sentences are wrong about the app**, and one is loosely worded: "one Type-my-own button in the whole
   app" (there are three, in two views), "not one go-deeper link" (44 views end in a card of links to related pages;
   the detector looked at the wrong text), and the empty-plan sentence mixes first-screen and whole-page counts.
3. **The inventory is accurate where it gives a file or a count I could reproduce** (31 of 36 claims exact). Five
   small misses: "leave blank" 120 in 45 views (about 103 in 38), words.js 52 (53), `.folds` in 5 views (6),
   belongings form 9 boxes (11), and Home 11 boxes (10 for the family).
4. **The walks' findings reproduce** (13 of 14 "too much" and 9 of 10 "cannot reach" to the letter, the other two in
   substance), including the exact ones: the
   60-word paragraph with seven figures on Federal estimate, Save at y=1830 on Assumptions, the import fold at
   y=1276 on Holdings, 10,639 px of Settings, 13 to 24 controls on "What comes in?", and Federal's three folds
   with three habits. Its first-screen word counts are rougher than the census (block-based) and should not be
   quoted to the unit; three details are off (21 figures is 20, +611 px is +1,160 to +1,235, "three titles" is eight).
5. **Every quoted decision is in the file it names**: 46 of 46 strings from `docs/DESIGN_LOG.md` (2 span a line
   break), 22 of 22 from CONVENTIONS, FEEDBACK, WORKBOARD, TEAM, PLAN, the design-review skill and two READMEs.
6. **Three of the walks' own recommendations re-propose what the log says the owner declined or fixed**: Delete
   inside Edit on Net worth, Plan basics last on Settings, the Assumptions review notice moved into a fold line.
   `constraints.md` has the first as V4, the second as T1 and the third as N1; a design must not take any of the
   three from `walks.md`.

---------------------------------------------------------------------------------------------------------------------

## 1. Census: 12 pages rerun and compared with the screen (16 done)

### 1.1 The script again
`node census.mjs --root app --port 9821 --only family,renter,retired --pages <14 pages> --out vc/rerun.json --no-shots`,
then `node cmp.mjs census.json vc/rerun.json`: **same 42 of 42**.

### 1.2 An independent counter (`vc/lib.mjs`: words by text-node ranges, figures by `$n` / `n%`, boxes, button look by
computed colour, top-level folds), each page opened by a direct load. `census | mine`:

| household, page | screens | words 1st | figures 1st | words all | figures all | boxes 1st / all | filled 1st | folds shut/open |
|---|---|---|---|---|---|---|---|---|
| renter debt/consolidation | 1.25 = | 167 = | 26 = | 179 / 181 | 26 = | 0 / 0 = | 0 = | 2/0 = |
| renter cashflow/budget-percent | 1.98 = | 141 = | 33 = | 280 / 282 | 35 = | 0 / 0 = | 0 = | 3/0 = |
| family debt/credit-cards | 1.31 = | 171 = | 23 = | 196 / 198 | 25 = | 0 / 0 = | 0 = (2 outlined =) | 1/1 = |
| family balance/liabilities | 1.42 = | 123 = | 20 = | 194 / 196 | 21 = | 0 / 0 = | 1 = | 0/0 = |
| family taxes/federal | 3.27 = | 154 = | 14 = | 480 / 482 | 45 = | 0 / 0 = | 1 = | 3/0 = |
| family retirement/cash-flow | 5.28 = | 126 = | 19 = | 920 / 922 | 212 = | 2 / 2 = | 0 = | 0/0 = |
| family property/rental | 2.91 = | 101 / 103 | 0 = | 230 / 243 | 0 = | 5 / 21 = | 0 = | 0/1 = |
| renter cashflow/expenses | 1 = | 53 / 55 | 5 = | 53 / 55 | 5 = | 0 / 0 = | 0 = | 2/0 = |
| family system/settings | 2.28 = | 66 = | 0 = | 196 / 198 | 0 = | 3 / 3 = | 1 = | 19/0 = (22 with nested) |
| family overview/dashboard | 1.71 = | 103 = | 8 = | 157 = | 9 = | 0 / 0 = | 1 = | 1/0 = |
| retired scenarios/stress-tests | 1.76 = | 107 = | 1 = | 166 = | 1 = | 0 / 0 = | 0 = | 11/0 = |
| family investments/holdings | 1.75 = | 65 / 67 | 0 = | 123 / 127 | 0 = | 6 / 9 = | 0 = | 1/0 = |
| family system/assumptions | 2.63 = | 93 = | 5 = | 291 / 293 | 11 = | 2 / 10 = | 0 = | 1/0 = |
| family retirement/projection | 3.3 = | 145 = | 8 = | 490 / 492 | 30 = | 0 / 0 = | 0 = | 1/0 = |
| family cashflow/expenses | 2.27 = | 116 = | 12 = | 300 / 302 | 31 = | 0 / 0 = | 0 = | 1/1 = |
| family balance/net-worth | 2.5 = | 73 = | 12 = | 203 / 205 | 22 = | 0 / 0 = | 0 = | 0/0 = |

The +2 words on most whole pages is the shell's read-out-only step name (`span.vh`, 1 x 1 px, "Your month"), which my
counter takes and the census rightly leaves out; the rental's +13 is my counter taking the `$` and unit marks of
money boxes as words. Nothing material.

### 1.3 Counted by eye on the screenshot (`vc/shots/<household>--<page>.png`)

| screenshot | what I counted | census row |
|---|---|---|
| family Debts | 20 figures (13 money, 7 percent; the last, "$410", is on the bottom edge), 4 tiles, 1 filled button, 3 rows with "Edit ›" drawn as plain words inside tappable rows | 13 + 7, 1 filled, 3 tappable rows: same |
| renter Consolidation | 26 figures ("566 a month" has no $ and is not one), no button, the fold "Which debts, 3 of 4" at the foot | 26, 0 buttons: same |
| family Federal estimate | 14 figures (7 in the paragraph, 7 in the tiles that show), 1 filled button | 14, 1: same |
| family Credit cards | 23 figures (14 money, 9 percent), 2 outlined buttons, one fold standing open | 14 + 9, 2 outlined, 1 open: same |
| family Holdings | 6 boxes above the line (the 6th, "What you paid in all", is cut by it), of 9 | 6 of 9: same |
| renter Expenses | 5 figures, 53 words, 2 shut folds with a status line each, nothing else | 5, 53, 2/0: same |
| renter Budget (50/30/20) | 33 figures | 33: same |

### 1.4 The headline numbers recomputed from `census.json` (`vc/q1.mjs`)
Reproduced exactly: 900 ranked rows on 150 pages; 73 pages with no optional part (their definition: tick boxes and
open folds do not count); family 75 pages over two screens, 40 with no shut fold, 33 with nothing optional; 1,963
shut and 143 open folds, the open ones on 27 pages; 46% of the load behind folds, 17% without the four fold-list
pages; family medians 113 words and 4 figures; 44 pages with 10 or more figures; 61 with 10 or more small-print
lines; 38 pages with a box on the first screen; filled button on the first screen 96 / 54 / 0; 63 pages with none.
"Looking never changes the plan": I opened (and on Federal also shut) every fold by touch on Federal estimate, Work
benefits, Our guesses, Paycheck and Stress tests: the saved plan was byte-identical each time.

### 1.5 What is wrong or loose in census.md
See the list at the end (W1 to W3). Worth knowing when reading the tables: of the 73 "no optional part" pages, 13
open with a fold that stands open (it can be shut) and 13 end in a "More on this" or "Next" card.

---------------------------------------------------------------------------------------------------------------------

## 2. Inventory: 36 claims checked in the code

| # | claim | result |
|---|---|---|
| 1 | 161 page folders, 159 usable, 2 planned, 162 `view.js` | exact |
| 2 | 153 fold sites in 97 views, 1 more in `core/heal.js` | exact (`h("details"`: 153 in 97; `core/heal.js:90`) |
| 3 | 64 pages have no fold | exact (161 - 97; the template has none) |
| 4 | 114 `card fold fold-card`, 28 `fold`, 3 with an own class only | exact (110 + 4, 22 + 6, `ln-more` x2 + `hp-q`) |
| 5 | title in `.fold-title` 56; `.fold-body` 59; chevron `aria-hidden` 36 of 143 | exact |
| 6 | `toggle-row` only in Settings; no `role="tab"`; "Go deeper" nowhere | exact |
| 7 | "More on this" in 37 views, 7 still "Next" | exact; the 7 are all claude-a's folders |
| 8 | 12 labels in 6 views say "(optional)"; 88 required fields | exact |
| 9 | 120 help lines in 45 views say "leave blank" | **off**: 103 in 38 views ("leave ... blank"); 45 is the views with the word "blank" anywhere |
| 10 | chips in 22 views; presets on capital gains, brackets, goal seek | 22 exact; capital gains' four chips seen on screen |
| 11 | "Type my own" on allocation, "Type my own amount" x2 on contributions, "Or type your own numbers" on quick | exact (`allocation/view.js:51`, `contributions/view.js:176, 245`, `quick/view.js:51`) |
| 12 | `goals/goals` folds seven boxes: `MORE`, `foldMore`, `form.insertBefore`, the only `invalid` listener | exact (`view.js:21-32, 108`); on screen 3 boxes shown, 7 folded |
| 13 | "Show more (N left)" ledger, 100 at a time; "Show all N" backups; "Show earlier changes" audit; "Show all the steps" guide | exact (`ledger/view.js:7, 208`; `backups/view.js:12, 97`; `audit/view.js:13, 144`; `guide/view.js:145`) |
| 14 | rows with `aria-expanded` in 4 views | exact |
| 15 | `core/app.js` line 15 imports the kit; `show()` empties `#content`; redraw 50 ms after an update | exact (lines 15, 209, 390) |
| 16 | 52 views import `core/words.js`; 8 `periods.js`; 2 `placeholder.js` | **53**; 8; 2 |
| 17 | the 13 storage keys; DATA_MODEL lists two of them | exact (`core/store.js:56-58` builds `.sync` and `.undecided`; `docs/DATA_MODEL.md:68-71`) |
| 18 | 6 views remember what a person opened | exact: 5 `toggle` listeners (guesses, explain, critic, life events, documents) + `openFolds` in budget-percent |
| 19 | `career/benefits` `openFold` is never cleared | exact (lines 11, 229, 230 only) |
| 20 | three guide steps name a fold in `opens:`; `frame.js openFold` | exact (`journeys.js:248, 315, 316`; `frame.js:92, 267`) |
| 21 | landings `?add=` (from 12 views), `?edit=`, `?show=` (WeakSet), `?type=spending` (`typedFor`), `?more=1`, `?target=last/badluck` (`readRoute`) | exact |
| 22 | test pins: heal 84 and 90, credit cards 206 and 212, `qa/flows/tax-figures.js` 6, `qa/user-view.mjs` 72-75, guesses' source line | exact (`plain-words-followup` 21 is the comment above the assertion) |
| 23 | fake DOM has no `insertBefore` or `:scope`; used by 12 module tests and 8 files in `tests/` | exact |
| 24 | 95 views append a scoped `<style>`; `.gd-textbtn` only in the guide | exact |
| 25 | `core/view.js`: `planner.view`, `planner:view`; the shell follows it | exact (`view.js:8, 33`; `app.js:406`) |
| 26 | the service worker keeps no file list | holds (it saves the files of one whole open; no list in `sw.js`) |
| 27 | `ui.form` has no "more"; wave 1 names `more: true` as a follow-up | exact (`w1/plan-forms.md:411`) |
| 28 | `.folds` list in 5 views | **6**: `household/documents/view.js:63` too |
| 29 | form sizes: rental 21, rent vs buy 18, offer 18, house 12, policies 12, vehicles 10, grants 9 and 7, income 9, holdings 9, expenses 8, pensions 9, net worth 6, a card's edit 4 | exact on screen (rent vs buy is 17 boxes + 1 tick; income 8 + 1; expenses 6 + 2; policies 11 + 1) |
| 30 | Federal "Figures the plan cannot see": 9 boxes, "Federal tax withheld so far" is the 8th | exact |
| 31 | Paycheck 16 boxes a person; Work benefits 20 in 5 folds; Retirement settings 7 | exact (6 + 6 + 2 + 4 + 2) |
| 32 | belongings form 9 boxes | **11** declared (10 boxes + 1 tick on screen); the inventory's own `fields-full.txt` says 11 |
| 33 | Home "The home's details" 11, with a rare tax-case tick "on the first view" | 10 on screen for the family, none required; the 11th, the tick, is drawn only when the two-year test fails (`home/view.js:122`), so most households never see it |
| 34 | no fold on capital gains (7 tiles), brackets (7), emergency fund (5), spending (4), income statement (4); withholding 8 tiles; estimated 5; mortgage's "How the years left were worked out" is a card | exact |
| 35 | Export is not linked from any page | exact: no view holds a link to `reports/export` |
| 36 | rule line: the 2026-11-12 entry is at line 18 of the log and names the five phrases | exact (heading line 18, rule line 23) |

Not reproduced to the number (see "unverified"): 99 folds with a status line (I find 104 `fold-status` spans), 51
with an `open` rule (47 by my pattern), 36 "+ Add" buttons in 30 views (39 strings in 32), 275 module-level
variables in 123 views, "about 120 fold sites have no memory".

---------------------------------------------------------------------------------------------------------------------

## 3. Walks redone

### 3.1 "Too much on the first view" (14 redone, 13 hold)

| # | the walk says | what I got | |
|---|---|---|---|
| 1 | Debts (family): 21 figures on the first screen, the most of the fourteen pages | 20 on the first screen, 21 on the page; still the most of the fourteen (Federal 14, Net worth 12, Expenses 12) | off by one |
| 2 | Federal estimate: headline "About $14,723 of federal tax for 2026"; April in the third sentence of a 60-word paragraph with seven figures; a 49-word note; 116 words before the first tile; 3.3 screens | every number exact (counted word by word on the screenshot; 3.27 screens) | holds |
| 3 | Assumptions: 10 boxes on 2.6 screens, Save at y=1830, an amber notice and a "0 Changed from defaults" tile | 10 boxes, 2.63 screens, Save at y=1830, both texts present | holds |
| 4 | Expenses (family) opens 2.3 screens long with the 13-bill list open; Edit on Groceries shows 8 boxes, 2 required | 2.27 screens, "[open] See or change each bill, 13 bills"; 8 (6 boxes + 2 ticks), 2 required | holds |
| 5 | Will the money last? for a retired person: "The money lasts", three sentences of figures, "Could you stop sooner?", 3.0 screens, "today's dollars" four times | the kit's Ruth: same heading, same three sentences, the button "Could you stop sooner? What would change it ›", 2.97 screens; "today's dollars" 5 times. The retired couple fixture gets "What would change it ›" without the question | holds for a plan where nobody works |
| 6 | Net worth: Edit and Delete on every row (20 buttons), "as of" ten times, no chart for "Over time" | 10 + 10, 10, no drawing on the page | holds |
| 7 | Holdings: a 9-box form (3 required) opens the page; the file import is a fold at y=1276; no link | 9, 3, fold top 1276, no link but the shell's row | holds |
| 8 | Settings: "Plan basics" first with the only filled button on screen; 18 topics; 158 switches; 10,639 px with all open | "Save" is the one filled button; 18 topic folds; 158; 1,927 px shut and 10,639 px open | holds |
| 9 | Contributions for a retired person: a five-box form about "each paycheck" and "what your employer adds" | Ruth and the retired couple: 5 boxes under exactly that sentence | holds |
| 10 | Saving "my month in one number" shuts that fold and opens the bill list (+611 px) | spending choice: the fold shuts and "See or change each bill" opens by itself, 8 bills (a line "Other spending" is added). Growth +1,160 px (Sam, $3,400) and +1,204 px (renter, $3,100). Left-over choice: the used fold stays open ("$300 left over a month") and the bill list opens too, +1,235 px | holds; the size is about double |
| 11 | forms: Income 9 (2 required), add account 6 (2), a card's edit 4 (2), Policies 12 (1), Home 10 (0), Goals 3 with 7 folded | all exact | holds (the "folded" cells of Policies and Home are swapped: Policies has no fold, Home has one) |
| 12 | Get started, "What comes in?": 1.4 to 2.0 screens and 13 to 24 controls on "I work"; Continue under the first screen | 1.37 to 1.98 screens, 13 to 24 controls, Continue at y=923 then y=1437 | holds |
| 13 | menu 27 entries (8, "All 150 pages", 18 topics); All pages 151 links on 19.8 screens; check-in 2 screens, 8 steps, sends her to "Save today's totals" at the bottom of Net worth | 27 (14 fully on screen; the walk says 15); 151 links, 16,745 px; 1.97 screens, 8 steps, the sentence is there | holds |
| 14 | Federal's three folds after their own Save: itemized shuts and still says "standard $32,200 is better" while the walk row says -$34,200; "cannot see" stays open and says "2 typed"; "Year and people" shuts everything | reproduced exactly, in that order | holds |

### 3.2 "Cannot reach the detail" (10 redone, 9 hold)

| # | the walk says | what I got | |
|---|---|---|---|
| 1 | Will the money last? does not link to Year by year, If history repeated, Sensitivity, How much to take out, Stress tests | its links: People, Goal seek, Chance the money lasts, Contributions, Healthcare before 65, Medicare, Assumptions. None of the five | holds |
| 2 | Federal estimate has one link to another tax page | family: "Fix it in your paychecks" (Withholding check) only. Ruth: "See the estimated payments"; the retired couple: "Plan the estimated payments". One link each, never two | holds |
| 3 | Holdings links to none of the pages that read it | none | holds |
| 4 | Pay off debts: no link, no month-by-month schedule | no link; headings are the answer, "Your plan", "When each debt ends", "The three orders, same money" | holds |
| 5 | Assumptions links nowhere | none | holds |
| 6 | every fold is shut again after leaving and coming back, and after a reload | Federal's three: opened by touch, shut after Dashboard and Back, shut after a reload (the tip; wave 1 changes this) | holds |
| 7 | 0 of the 11 rows of "From income to tax" open anything | 11 rows, no link, button or fold inside the card | holds |
| 8 | Export is linked from no table | no view links to it | holds |
| 9 | Settings has nothing about how much detail to show | with every fold open: "exact", "cents", "working", "formula", "simple", "expert" 0 times; "detail" once (a page's name) | holds |
| 10 | a working fold exists on 16 of 159 pages, under three titles | 16 views have a fold titled "How ... worked out", "How this is done" or "How it adds up" (the walk's 16 holds); the fold titles are eight ("How this is worked out" in 5 views, "How it is worked out" in 4, "How these are worked out", "How this is done", "How the tax is worked out", "How the score is worked out", "How "worth now" is worked out", "How it adds up"), 23 with the "Where ... come from" and "Why" kind (the inventory's count) | 16 pages holds; "three titles" is wrong |

The walks' tables of first-screen words are not census-grade: `walks/lib.mjs` adds up whole blocks that start on the
first screen. Family, walk against census and my counter: Dashboard 149 / 103, Your plan 204 / 131, Net worth 92 /
73, Federal 115 / 154, Debts 134 / 123. Heights, boxes, folds and links agree everywhere I looked.

---------------------------------------------------------------------------------------------------------------------

## 4. Quoted decisions against the files

`vc/quotes.mjs`: 46 strings quoted from `docs/DESIGN_LOG.md` in `constraints.md` (R1, R2, R5, R7 and the "builder's
reading" line; the three precedents; N1, N3, N4, N5, N7, N8 x3; H5 x2, H6; T1, T3 x2, T4; V1, V3, V4 x3, V5 x2, V6,
V7, V10; F2, F3, F4 x2, F5 x2, F6, F11; L1 x2, L2, L3, L7; the baseline x2): **46 found, word for word** (the two
baseline sentences span a line break in the log). For 14 of them I also read the entry: the date, round, finding
number and the option chosen are as stated (Net worth pass 2 round 4 finding 1 chose B; Dashboard pass 2 round 1
chose A three times; coming-soon round 8 finding 2 chose A, remove; Net worth round 4 findings 1 to 4; Assumptions
round 17 findings 1 and 2; Expenses pass 3 round 1 findings 1 and 2; Emergency fund round 13 findings 2 and 3;
Settings round 6 findings 1 and 2; Docs round 7).

22 more from other files, all found: CONVENTIONS (two filled buttons, "Never create, except from a box the person
saw", "Typed wins", 16px, the household's view words, the guesses row), FEEDBACK (F-010, F-027, F-035), WORKBOARD
(2026-11-12 14:55 line x3, whole months, claude-g's note), TEAM (stale after a day, claude-f's row), PLAN principle 7,
the design-review skill x3, the start and setup READMEs. Also true: claude-a's last workboard line is 2026-10-30;
the four commits named as "released in effect" (658c5b8, ee09f6e, cb820f2, 5614682) are in the tip's history.

**What the walks propose against the log** (not a misquote; a design that copies `walks.md` would break rule
"Do not undo or re-propose"):
- Net worth, "put Delete inside Edit" (walks section 3 and change 11): this is option A of 2026-09-15 pass 2 round 4
  finding 1, which the owner declined for B, "keep both buttons".
- Settings, "Plan basics ... to the end, beside Advanced" (section 3 and change 12): "Plan basics last" was the
  finding of 2026-09-15 round 6 finding 2; the owner chose "Plan basics, Pages, Your data, then ... folded".
- Assumptions, the amber "You have not looked these over yet" into a fold's summary line (section 3): the owner chose
  "review status as a notice" (2026-09-15 round 17 finding 2).

---------------------------------------------------------------------------------------------------------------------

## 5. Wrong, as a list

| id | report | the claim | what is true | evidence |
|---|---|---|---|---|
| W1 | census, short version 6 | "Type my own amount": one button in the whole app | three buttons in two views; the six households meet one (the renter on Contributions) | `investments/allocation/view.js:51`, `retirement/contributions/view.js:176, 245`; `census.json` has one `own` opener |
| W2 | census, short version 3 and table 1 | not one "go deeper" link; 0 "go deeper / see all" links | no link has those words, but 44 views end in a card of links to related pages ("More on this" 37, "Next" 7); households with a plan meet it on 39 pages; the detector reads each link's own text, never its card's heading | grep; `census.mjs:81, 181, 189`; the rows' own `blocks` |
| W3 | census, short version 8 | empty plan: 96 pages fit one screen; 33 open with boxes on the first screen, 22 with six or more; 15 show five or more figures | 93 at 1.00 screen or less; 33 is right; one page has six boxes on the first screen, 22 is the whole-page count; five or more figures: 13 on the first screen, 15 on the page | `vc/q1.mjs` on `census.json` |
| W4 | inventory, fact 6 | 120 help lines in 45 views say "leave blank" | 103 "leave ... blank" in 38 views; 45 views contain the word "blank" (189 times, comments included) | grep |
| W5 | inventory, section 5 | 52 views import `core/words.js` | 53 | grep |
| W6 | inventory, 1.1 | a `.folds` list in 5 views | 6, with `household/documents` | `view.js:63` |
| W7 | inventory, section 3 row 14 | belongings form: 9 boxes | 11 fields (10 boxes and a tick on screen) | `inv/fields-full.txt:211-222`; `walk4.mjs` |
| W8 | walks, change 8 | a working fold under three titles | eight fold titles of the "how it is worked out" kind in 16 views, 23 with the "where it comes from" kind | grep of the fold titles in `modules/*/*/view.js` |
| W9 | walks, section 3 and change 11 | Debts: 21 figures on the first screen | 20 (21 on the page) | screenshot, census row, my counter |
| W10 | walks, section 0 and change 9 | the one-number save grows the page by 611 px | +1,160 to +1,235 px in three runs; with the left-over choice the used fold stays open | `walk3.mjs` |
| W11 | walks, form table | Policies: 1 folded; Home: 0 folded | Policies has no fold; Home has one box in "Update its value" | `policies/view.js` has no `details`; `home/view.js:100` |
| W12 | walks, the page table | first-screen words (Dashboard 149, Your plan 204, Net worth 92, Federal 115) | 103, 131, 73, 154 | `walks/lib.mjs:38-44`; `run12.json` |
| W13 | walks, changes 11 and 12, Assumptions | fold Delete into Edit; move Plan basics last; review notice into a fold line | each undoes an owner's choice in the log | `docs/DESIGN_LOG.md` lines 207-210, 466-468, 307-309 |

## 6. Not verified (treat as unconfirmed)

- census: the form totals (59 forms, 365 boxes, 53 must-fill, 93 prefilled); table 16 (the two extra plans); the
  `late.mjs` and `--fresh` runs; the rank-agreement figures; the 40 shots beyond the pages above.
- inventory: 275 module-level variables in 123 views; "about 120 of 153 fold sites have no memory"; 99 status lines
  (104 spans found); 51 `open` rules (47 found); 36 "+ Add" buttons in 30 views (39 strings in 32); the counts of
  spellings (9 for "nothing typed", 8 for "who set it"); what wave 1's place memory will keep (only the `more: true`
  line of its plan was opened).
- walks: the five full runs of Get started and the path lengths (10.1 and 20.6 screens, 2,755 words); everything at
  320 px; Kai's two file imports; "Continue is cut off on 7 of 10"; the reveal's y positions; Lee's side business.
- constraints: the page-by-page lists of section 2 (126 free, 11, 11, 13: only the totals and the claim rows were
  read); the owner's quotes kept outside the repo (the hand-over `STATE.md`, the guesses spec); "the only
  owner-chosen number".
